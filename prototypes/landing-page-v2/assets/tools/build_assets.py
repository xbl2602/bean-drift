#!/usr/bin/env python
"""Build the landing-page-v2 terrain assets from the real LOLA south-pole DEM crop.

Project root is inferred from this file's location:
    <project>/prototypes/landing-page-v2/assets/tools/build_assets.py
so the script can be run from anywhere.

Reads (read-only, never modified):
    <project>/prototypes/lunar-scene-demo/data/derived/dem_crop.i16    4200x4200 int16 LE, DN -> metres = DN * scale
    <project>/prototypes/lunar-scene-demo/data/derived/dem_meta.json   n, px, x0, z0, scale, sunAz, sunEl, pole_height_m
    <project>/prototypes/lunar-scene-demo/data/derived/sky_year.json   hourly sun/earth az+el over one year (at the pole)

Writes only into <project>/prototypes/landing-page-v2/assets/:
    terrain.bin, terrain-meta.json, hillshade.jpg, height.png, slope.png,
    height-gray.png, slope-gray.png,
    horizon-highland.json, horizon-basin.json, sun-visibility.png, earth-visibility.png

Conventions copied from prototypes/lunar-scene-demo/demgrid.js + lola.js:
  * heights are read as little-endian int16 and scaled by dem_meta['scale'] = 0.5  -> metres
  * pixel (i, j) is CENTRED at x = x0 + i * px, z = z0 + j * px; x runs along columns, z along rows (down)
  * world frame: x = east-ish (image right), z = image down, y = height above the 1737.4 km reference sphere
  * azimuth 0 = north = -z, azimuth 90 = east = +x; elevation positive up
  * the scene's own horizonProfile (demgrid.js) uses atan2(h - h0 - d^2/(2R), d) with R = 1737400 m; replicated here

Usage (from the assets dir, or anywhere):
    <python> tools/build_assets.py                 # everything
    <python> tools/build_assets.py --stage base    # terrain + layers only
    <python> tools/build_assets.py --stage vis     # visibility maps only
    <python> tools/build_assets.py --stage horizon # horizon profiles only (recomputes vis for point b)
    <python> tools/build_assets.py --stage verify  # checks only
"""

import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve()
ASSETS = HERE.parents[1]                    # .../prototypes/landing-page-v2/assets
PROJECT = HERE.parents[4]                   # .../hackathon information
DEM_DIR = PROJECT / 'prototypes' / 'lunar-scene-demo' / 'data' / 'derived'

SIZE = 640                                  # terrain grid size (also the PNG size)
VIS_N = 128                                 # visibility map is computed at 128x128, then upscaled to 640
VIS_AZ = 72                                 # 5 deg azimuth bins for the visibility horizon
R_MOON = 1737400.0                          # metres, same reference sphere as the scene
EYE = 1.6                                   # metres, same eye height as prototypes/lunar-scene-demo/common.js
SLOPE_CLAMP_DEG = 45.0                      # slope colour ramp saturates here


# ----------------------------------------------------------------------------------------------------------------------
# input
# ----------------------------------------------------------------------------------------------------------------------

def load_dem():
    meta = json.loads((DEM_DIR / 'dem_meta.json').read_text())
    n = int(meta['n'])
    px = float(meta['px'])
    x0 = float(meta['x0'])
    z0 = float(meta['z0'])
    scale = float(meta['scale'])
    raw = np.fromfile(DEM_DIR / 'dem_crop.i16', dtype='<i2')
    if raw.size != n * n:
        raise SystemExit('dem_crop.i16 is %d samples, expected %d' % (raw.size, n * n))
    # lola.js: createDemGrid({data: raw, ..., scale: meta.scale}) -> first[i] = data[i] * scale
    h = raw.reshape(n, n).astype(np.float32) * scale
    return h, meta


def load_sky():
    sky = json.loads((DEM_DIR / 'sky_year.json').read_text())
    out = {
        'sunAz': np.array(sky['sunAz'], np.float64),
        'sunEl': np.array(sky['sunEl'], np.float64),
        'earthAz': np.array(sky['earthAz'], np.float64),
        'earthEl': np.array(sky['earthEl'], np.float64),
        'start': sky['start'],
        'stepHours': sky['stepHours'],
    }
    return out


# ----------------------------------------------------------------------------------------------------------------------
# sampling / resampling
# ----------------------------------------------------------------------------------------------------------------------

def area_downsample(h, size):
    """Exact area-weighted mean over the FULL image extent (no pixel dropped at the edges).

    Source 4200 px -> 640 px is a ratio of 6.5625, so plain stride/reshape would either drop 360 columns
    or bias the grid. Uses the piecewise-linear cumulative integral of the (piecewise-constant) pixel data.
    """
    n0, n1 = h.shape
    r0, r1 = n0 / size, n1 / size

    def blocksum(a, ratio, axis):
        n = a.shape[axis]
        c = np.cumsum(a, axis=axis, dtype=np.float64)
        zshape = list(a.shape)
        zshape[axis] = 1
        cc = np.concatenate([np.zeros(zshape, np.float64), c], axis=axis)      # cc[k] = sum a[0..k-1]
        e = np.arange(size + 1) * ratio
        k = np.clip(np.floor(e).astype(np.int64), 0, n)
        fshape = [1] * a.ndim
        fshape[axis] = size + 1
        f = (e - k).reshape(fshape)
        base = np.take(cc, k, axis=axis)
        nxt = np.take(a, np.clip(k, 0, n - 1), axis=axis)
        F = base + f * nxt                                                      # integral at every block edge
        hi = np.take(F, np.arange(1, size + 1), axis=axis)
        lo = np.take(F, np.arange(0, size), axis=axis)
        return hi - lo

    s = blocksum(h, r0, 0) / r0
    s = blocksum(s, r1, 1) / r1
    return s.astype(np.float32)


def bilinear(h, u, v):
    """Bilinear sample of h at fractional pixel-index coords (u = column index, v = row index).

    Outside the grid the nearest edge sample is repeated, which is what the scene's demgrid.sample does too.
    """
    n0, n1 = h.shape
    u = np.clip(u, 0.0, n1 - 1.0)
    v = np.clip(v, 0.0, n0 - 1.0)
    i0 = np.floor(u).astype(np.int64)
    j0 = np.floor(v).astype(np.int64)
    i0 = np.clip(i0, 0, n1 - 2)
    j0 = np.clip(j0, 0, n0 - 2)
    fu = (u - i0).astype(np.float32)
    fv = (v - j0).astype(np.float32)
    a = h[j0, i0] * (1.0 - fu) + h[j0, i0 + 1] * fu
    b = h[j0 + 1, i0] * (1.0 - fu) + h[j0 + 1, i0 + 1] * fu
    return a * (1.0 - fv) + b * fv


def horizon_profile(h, meta, X, Z, az_deg, dist, eye=EYE):
    """Terrain horizon elevation (deg) for every azimuth, seen from (X, Z), one point at a time.

    Ray step exactly as prototypes/lunar-scene-demo/demgrid.js horizonProfile():
        ang = atan2(h(d) - (h0 + eye) - d^2/(2R), d)
    i.e. the lunar curvature drop d^2/(2R) is included (R = 1737400 m), and h0 is the ground height at the observer.
    """
    n = int(meta['n'])
    px = float(meta['px'])
    x0 = float(meta['x0'])
    z0 = float(meta['z0'])
    a = np.radians(np.asarray(az_deg, np.float64))[:, None]
    d = np.asarray(dist, np.float64)[None, :]
    u = (X + d * np.sin(a) - x0) / px
    v = (Z - d * np.cos(a) - z0) / px
    hh = bilinear(h, u, v)
    h0 = float(bilinear(h, np.array([(X - x0) / px]), np.array([(Z - z0) / px]))[0]) + eye
    ang = np.degrees(np.arctan2(hh - h0 - d * d / (2.0 * R_MOON), d))
    return ang.max(axis=1)


def grid_xy(meta, size):
    """Pixel-centre world coords of a size x size grid covering exactly the same extent as the source DEM."""
    n = int(meta['n'])
    px = float(meta['px'])
    x0 = float(meta['x0'])
    z0 = float(meta['z0'])
    spacing = n * px / size
    # source extent = [x0 - px/2, x0 + (n-1)*px + px/2]; centre of the first new cell:
    xg0 = x0 - px / 2 + spacing / 2
    zg0 = z0 - px / 2 + spacing / 2
    xs = xg0 + np.arange(size) * spacing
    zs = zg0 + np.arange(size) * spacing
    return xs, zs, spacing, xg0, zg0


# ----------------------------------------------------------------------------------------------------------------------
# colour
# ----------------------------------------------------------------------------------------------------------------------

def gradient_map(stops, t):
    xs = np.array([s[0] for s in stops], np.float32)
    cols = np.array([s[1] for s in stops], np.float32)
    out = np.empty(t.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(t, xs, cols[:, c])
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


HEIGHT_STOPS = [
    (0.00, (3, 12, 17)),       # deep teal-black (low)
    (0.18, (7, 41, 49)),
    (0.38, (17, 83, 88)),
    (0.55, (63, 110, 95)),
    (0.70, (140, 128, 82)),
    (0.84, (210, 174, 116)),   # amber
    (1.00, (255, 240, 214)),   # warm white (high)
]

SLOPE_STOPS = [
    (0.00, (223, 237, 229)),   # flat: pale sage
    (0.22, (170, 206, 157)),
    (0.45, (196, 197, 116)),
    (0.68, (214, 160, 84)),
    (0.85, (196, 98, 59)),
    (1.00, (146, 48, 44)),     # steep: brick red
]

SUN_VIS_STOPS = [
    (0.00, (6, 7, 12)),
    (0.12, (13, 27, 44)),
    (0.25, (18, 56, 72)),
    (0.40, (26, 96, 104)),
    (0.55, (84, 122, 88)),
    (0.70, (160, 148, 88)),
    (0.85, (226, 190, 122)),
    (1.00, (255, 240, 200)),   # warm amber-white = sun visible most of the year
]

EARTH_VIS_STOPS = [
    (0.00, (6, 7, 12)),
    (0.12, (12, 26, 48)),
    (0.25, (18, 52, 86)),
    (0.40, (30, 88, 124)),
    (0.55, (58, 128, 160)),
    (0.70, (104, 172, 198)),
    (0.85, (162, 214, 232)),
    (1.00, (235, 252, 255)),   # pale cyan = Earth visible most of the year
]


def save_png(rgb, name):
    im = Image.fromarray(rgb, 'RGB')
    im.save(ASSETS / name, optimize=True)
    return im


# ----------------------------------------------------------------------------------------------------------------------
# stage: terrain grid + static layers
# ----------------------------------------------------------------------------------------------------------------------

def stage_base():
    t0 = time.time()
    h, meta = load_dem()
    print('[base] DEM %dx%d loaded, min %.1f max %.1f m (full res)' % (h.shape[0], h.shape[1], h.min(), h.max()))

    h640 = area_downsample(h, SIZE)
    hq = np.round(h640).astype(np.int16)                      # what terrain.bin stores
    hf = hq.astype(np.float32)
    min_m, max_m = float(hq.min()), float(hq.max())

    xs, zs, spacing, xg0, zg0 = grid_xy(meta, SIZE)
    pole_h = float(bilinear(hf, np.array([(0.0 - xg0) / spacing]), np.array([(0.0 - zg0) / spacing]))[0])

    # terrain.bin: int16 little-endian, row major, metres (scale already applied)
    hq.astype('<i2').tofile(ASSETS / 'terrain.bin')
    print('[base] terrain.bin %dx%d int16 LE  spacing %.4f m  min %.1f max %.1f m  pole-height(640-grid) %.1f m'
          % (SIZE, SIZE, spacing, min_m, max_m, pole_h))

    terrain_meta = {
        'size': SIZE,
        'spacingM': float(spacing),
        'minM': min_m,
        'maxM': max_m,
        'sunAzDeg': float(meta['sunAz']),
        'sunElDeg': float(meta['sunEl']),
        'x0': float(xg0),
        'z0': float(zg0),
        'poleHeightM': float(meta['pole_height_m']),
    }
    (ASSETS / 'terrain-meta.json').write_text(json.dumps(terrain_meta, indent=1) + '\n')
    print('[base] terrain-meta.json', terrain_meta)

    # slope from real DEM gradients (metres per metre -> degrees)
    dz, dx = np.gradient(hf, spacing)                         # dz = d/drow(z), dx = d/dcol(x)
    slope = np.degrees(np.arctan(np.hypot(dx, dz))).astype(np.float32)
    print('[base] slope deg: p50 %.1f  p90 %.1f  p99 %.1f  max %.1f'
          % tuple(np.percentile(slope, [50, 90, 99, 100])))

    # hillshade, sun at the meta azimuth/elevation (az 0 = -z, 90 = +x)
    az = math.radians(float(meta['sunAz']))
    el = math.radians(float(meta['sunEl']))
    s = np.array([math.sin(az) * math.cos(el), math.sin(el), -math.cos(az) * math.cos(el)], np.float32)
    nrm = np.sqrt(dx * dx + 1.0 + dz * dz)
    cos_inc = (-dx * s[0] + s[1] - dz * s[2]) / nrm           # normal = (-dx, 1, -dz)/|..|
    shade = 0.08 + 0.92 * np.clip(cos_inc, 0.0, 1.0) ** 0.55  # ambient + gamma so the 1.5 deg grazing sun still reads
    img = Image.fromarray((np.clip(shade, 0, 1) * 255.0 + 0.5).astype(np.uint8), 'L')
    img.save(ASSETS / 'hillshade.jpg', quality=82, optimize=True)
    print('[base] hillshade.jpg  cos_inc p1 %.3f p99 %.3f' % tuple(np.percentile(cos_inc, [1, 99])))

    # height colour map
    t = np.clip((hf - min_m) / max(1e-6, max_m - min_m), 0, 1)
    save_png(gradient_map(HEIGHT_STOPS, t), 'height.png')
    # 8-bit linear value maps (no colour ramp; the front-end tints them in a shader):
    #   height-gray.png: 0 = minM, 255 = maxM (linear)
    #   slope-gray.png : 0 = 0 deg, 255 = actual maximum slope of the 640 grid (linear)
    Image.fromarray(np.round(t * 255.0).astype(np.uint8), 'L').save(ASSETS / 'height-gray.png', optimize=True)
    slope_max = float(slope.max())
    ts = np.clip(slope / slope_max, 0.0, 1.0)
    Image.fromarray(np.round(ts * 255.0).astype(np.uint8), 'L').save(ASSETS / 'slope-gray.png', optimize=True)
    print('[base] height-gray.png  0..255 = %.1f..%.1f m (linear)'
          % (min_m, max_m))
    print('[base] slope-gray.png   0..255 = %.2f..%.2f deg (linear, actual max)'
          % (float(slope.min()), slope_max))
    # slope colour map (0..45 deg ramp)
    save_png(gradient_map(SLOPE_STOPS, np.clip(slope / SLOPE_CLAMP_DEG, 0, 1)), 'slope.png')
    print('[base] done in %.1f s' % (time.time() - t0))


# ----------------------------------------------------------------------------------------------------------------------
# stage: one-year sun / earth visibility
# ----------------------------------------------------------------------------------------------------------------------

def compute_visibility():
    t0 = time.time()
    h, meta = load_dem()
    sky = load_sky()
    xs, zs, spacing, xg0, zg0 = grid_xy(meta, VIS_N)

    azs = np.arange(0.0, 360.0, 360.0 / VIS_AZ)               # 72 bins, 5 deg
    # ray march distances: geometrically spaced, 20 m .. 14 km (same 14 km cap as the scene's horizonProfile)
    dist = np.geomspace(20.0, 14000.0, 160)
    d2 = dist * dist / (2.0 * R_MOON)

    sun_az, sun_el = sky['sunAz'], sky['sunEl']
    ea_az, ea_el = sky['earthAz'], sky['earthEl']
    # direction of the body in the local tangent plane (x east, z image-down), used for the plane-parallel elevation offset
    sun_ux, sun_uz = np.sin(np.radians(sun_az)), -np.cos(np.radians(sun_az))
    ea_ux, ea_uz = np.sin(np.radians(ea_az)), -np.cos(np.radians(ea_az))
    az_ext = np.r_[azs, 360.0]

    sun_frac = np.zeros((VIS_N, VIS_N), np.float32)
    earth_frac = np.zeros((VIS_N, VIS_N), np.float32)
    heights = np.zeros((VIS_N, VIS_N), np.float32)

    def frac(prof, az_h, el_h, ux, uz, X, Z):
        hz = np.interp(az_h, az_ext, np.r_[prof, prof[0]])
        el_local = el_h + np.degrees((ux * X + uz * Z) / R_MOON)   # observer offset from the pole (~<=0.4 deg)
        return float(np.mean(el_local > hz))

    a = np.radians(azs)[:, None]
    sin_a, cos_a = np.sin(a), np.cos(a)
    for j in range(VIS_N):
        Z = zs[j]
        for i in range(VIS_N):
            X = xs[i]
            u = (X + dist[None, :] * sin_a - float(meta['x0'])) / float(meta['px'])
            v = (Z - dist[None, :] * cos_a - float(meta['z0'])) / float(meta['px'])
            hh = bilinear(h, u, v)
            h0 = float(bilinear(h, np.array([u[0, 0]]), np.array([v[0, 0]]))[0]) + EYE
            prof = np.degrees(np.arctan2(hh - h0 - d2[None, :], dist[None, :])).max(axis=1)
            heights[j, i] = h0 - EYE
            sun_frac[j, i] = frac(prof, sun_az, sun_el, sun_ux, sun_uz, X, Z)
            earth_frac[j, i] = frac(prof, ea_az, ea_el, ea_ux, ea_uz, X, Z)
        if j % 16 == 0:
            print('[vis] row %3d/%d  %.1f s' % (j, VIS_N, time.time() - t0))

    save_png(gradient_map(SUN_VIS_STOPS, np.clip(sun_frac, 0, 1)), 'sun-visibility.png')
    save_png(gradient_map(EARTH_VIS_STOPS, np.clip(earth_frac, 0, 1)), 'earth-visibility.png')
    # 128 -> 640 without inventing structure: bicubic upscale of the measured grid
    for name in ('sun-visibility.png', 'earth-visibility.png'):
        im = Image.open(ASSETS / name)
        im.resize((SIZE, SIZE), Image.BICUBIC).save(ASSETS / name, optimize=True)

    print('[vis] sun  visible fraction: min %.3f  mean %.3f  max %.3f'
          % (sun_frac.min(), sun_frac.mean(), sun_frac.max()))
    print('[vis] earth visible fraction: min %.3f  mean %.3f  max %.3f'
          % (earth_frac.min(), earth_frac.mean(), earth_frac.max()))
    print('[vis] sun   percentiles  1/10/25/50/75/90/99: '
          + ' '.join('%.2f' % v for v in np.percentile(sun_frac, [1, 10, 25, 50, 75, 90, 99])))
    print('[vis] earth percentiles  1/10/25/50/75/90/99: '
          + ' '.join('%.2f' % v for v in np.percentile(earth_frac, [1, 10, 25, 50, 75, 90, 99])))
    for label, (X, Z) in (('pole', (0.0, 0.0)), ('spot-a (lola.js)', (7895.0, -4105.0))):
        i = int(np.argmin(np.abs(xs - X)))
        j = int(np.argmin(np.abs(zs - Z)))
        print('[vis] anchor %-16s at (%7.0f, %7.0f): sun %.2f  earth %.2f  (h %.0f m)'
              % (label, xs[i], zs[j], sun_frac[j, i], earth_frac[j, i], heights[j, i]))
    print('[vis] done in %.1f s' % (time.time() - t0))
    return {'sun_frac': sun_frac, 'earth_frac': earth_frac, 'heights': heights,
            'xs': xs, 'zs': zs, 'spacing': spacing, 'x0': xg0, 'z0': zg0}


# ----------------------------------------------------------------------------------------------------------------------
# stage: horizon profiles (full-resolution ray march)
# ----------------------------------------------------------------------------------------------------------------------

def pick_point_a(h, meta):
    """High ground near the region centre.

    Takes local maxima of the DEM on a 200 m scan inside 9 km of the pole and keeps the highest one whose
    FULL 14 km horizon profile stays inside a [-4.5, 27] deg window (the page's sanity range is [-5, 30]; the
    tiny margin covers the finer 2.5 deg azimuth sampling of the delivered JSON).  A true isolated summit can
    look down ~11 deg into Shackleton crater, which is honest but outside the range the page expects, so it is
    rejected.  Rays must also stay inside the 42 km crop (no edge clamping in the delivered profile).
    The winner is then refined at 20 m spacing in a +-150 m window.
    """
    n = int(meta['n'])
    px = float(meta['px'])
    x0 = float(meta['x0'])
    z0 = float(meta['z0'])
    st = 20                                                    # 200 m scan
    sub = h[::st, ::st]
    ss = x0 + np.arange(n) * px
    ssub = ss[::st]
    X, Z = np.meshgrid(ssub, ssub)
    r = np.hypot(X, Z)

    mx = np.zeros(sub.shape, bool)                             # local maxima on the scan grid
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            if di == 0 and dj == 0:
                continue
            mx |= sub > np.roll(np.roll(sub, dj, 0), di, 1)

    margin = n * px / 2 - 14000.0
    mask = mx & (r <= 9000.0) & (np.abs(X) <= margin) & (np.abs(Z) <= margin)
    jj, ii = np.where(mask)
    order = np.argsort(sub[jj, ii])[::-1]

    az = np.arange(0.0, 360.0, 2.5)
    dist = np.geomspace(15.0, 14000.0, 200)

    def passes(cx, cz):
        prof = horizon_profile(h, meta, cx, cz, az, dist)
        return bool(prof.min() >= -4.5 and prof.max() <= 27.0)

    base = None
    for k in order[:300]:
        cx, cz = float(X[jj[k], ii[k]]), float(Z[jj[k], ii[k]])
        if passes(cx, cz):
            base = (cx, cz)
            break
    if base is None:                                           # fallback: highest point, range be damned
        k = int(np.argmax(np.where(mask, sub, -1e9)))
        jj0, ii0 = np.unravel_index(k, sub.shape)
        base = (float(X[jj0, ii0]), float(Z[jj0, ii0]))

    step = 20.0                                                # refine at 20 m inside +-150 m
    off = np.arange(-150.0, 150.1, step)
    best = base
    best_h = float(bilinear(h, np.array([(base[0] - x0) / px]), np.array([(base[1] - z0) / px]))[0])
    for dx in off:
        for dz in off:
            cx, cz = base[0] + dx, base[1] + dz
            hh = float(bilinear(h, np.array([(cx - x0) / px]), np.array([(cz - z0) / px]))[0])
            if hh > best_h and passes(cx, cz):
                best, best_h = (cx, cz), hh
    return float(best[0]), float(best[1]), best_h


def pick_point_b(vis, meta):
    """Low, heavily occluded point: on the 128x128 visibility grid pick the point with the lowest sun fraction,
    then the lowest terrain height; rays must stay inside the DEM (no edge clamping in the horizon JSON)."""
    heights = vis['heights']
    sun = vis['sun_frac']
    xs, zs = vis['xs'], vis['zs']
    n = int(meta['n'])
    px = float(meta['px'])
    x0 = float(meta['x0'])
    z0 = float(meta['z0'])
    margin = n * px / 2 - 14000.0                            # 7010 m: a 14 km ray still stays inside the crop
    X = xs[None, :].repeat(VIS_N, 0)
    Z = zs[:, None].repeat(VIS_N, 1)
    inside = (np.abs(X) <= margin) & (np.abs(Z) <= margin)
    low = heights < -500.0
    cand = np.argwhere(inside & low)
    if len(cand) == 0:
        cand = np.argwhere(inside)
    vals_frac = sun[cand[:, 0], cand[:, 1]]
    vals_h = heights[cand[:, 0], cand[:, 1]]
    order = np.lexsort((vals_h, vals_frac))
    j, i = cand[order[0]]
    return float(xs[i]), float(zs[j]), float(heights[j, i]), float(sun[j, i])


def polar_latlon(X, Z):
    """Polar-tangent-plane approximation used for the report:
       r = hypot(x, z) m from the pole; colatitude = r / R_MOON rad;
       lat = -90 + degrees(r / R_MOON)   (south pole, so latitude starts at -90)
       lon = degrees(atan2(x, -z)) mod 360  (azimuth 0 = lon 0, +x = lon 90E, matching ephemeris.js)
    """
    r = math.hypot(X, Z)
    lat = -90.0 + math.degrees(r / R_MOON)
    lon = math.degrees(math.atan2(X, -Z)) % 360.0
    return lat, lon


def stage_horizon(vis=None):
    t0 = time.time()
    h, meta = load_dem()
    if vis is None:
        print('[horizon] no visibility data in this run, computing it first')
        vis = compute_visibility()

    ax, az_, ah = pick_point_a(h, meta)
    bx, bz_, bh, bs = pick_point_b(vis, meta)
    print('[horizon] point a (highland) = (%.1f, %.1f) m, h %.1f m' % (ax, az_, ah))
    print('[horizon] point b (basin)    = (%.1f, %.1f) m, h %.1f m, sun-vis %.3f' % (bx, bz_, bh, bs))

    az_deg = np.arange(0.0, 360.0, 2.5)                       # 144 samples
    dist = np.arange(10.0, 14000.1, 10.0)                     # 10 m ray steps (DEM resolution), 14 km cap as demgrid.js
    sun_az = float(meta['sunAz'])
    sun_el = float(meta['sunEl'])

    out = {}
    for name, X, Z, tag in (('highland', ax, az_, 'high ground near the region centre'),
                            ('basin', bx, bz_, 'low, heavily terrain-occluded point')):
        prof = horizon_profile(h, meta, X, Z, az_deg, dist)
        lat, lon = polar_latlon(X, Z)
        doc = {
            'name': name,
            'description': tag,
            'point': {
                'xM': round(X, 2),
                'zM': round(Z, 2),
                'latDeg': round(lat, 6),
                'lonDeg': round(lon, 6),
                'heightM': round(float(bilinear(h, np.array([(X - float(meta['x0'])) / float(meta['px'])]),
                                                np.array([(Z - float(meta['z0'])) / float(meta['px'])]))[0]), 2),
            },
            'azimuthDeg': [round(float(a), 3) for a in az_deg],
            'elevationDeg': [round(float(e), 4) for e in prof],
            'sunAzDeg': sun_az,
            'sunElDeg': sun_el,
            'eyeM': EYE,
            'curvatureCorrection': 'included: -d^2/(2*1737400 m)',
            'source': 'dem_crop.i16 (4200x4200, 10 m/px) full-resolution ray march',
        }
        (ASSETS / ('horizon-%s.json' % name)).write_text(json.dumps(doc) + '\n')
        k = int(np.argmax(prof))
        print('[horizon] %-9s max %.2f deg at az %.1f  min %.2f  mean %.2f  (lat %.4f lon %.4f)'
              % (name, prof[k], az_deg[k], prof.min(), prof.mean(), lat, lon))
        out[name] = prof
    print('[horizon] done in %.1f s' % (time.time() - t0))
    return out


# ----------------------------------------------------------------------------------------------------------------------
# stage: verify
# ----------------------------------------------------------------------------------------------------------------------

def stage_verify():
    ok = True
    print('[verify] checking assets in', ASSETS)

    def check(cond, msg):
        nonlocal ok
        print(('  PASS  ' if cond else '  FAIL  ') + msg)
        ok = ok and bool(cond)

    meta = json.loads((ASSETS / 'terrain-meta.json').read_text())
    tb = np.fromfile(ASSETS / 'terrain.bin', dtype='<i2')
    check(tb.size == SIZE * SIZE, 'terrain.bin has %d samples (want %d)' % (tb.size, SIZE * SIZE))
    tb = tb.reshape(SIZE, SIZE)
    check(abs(float(tb.min()) - meta['minM']) < 1e-6 and abs(float(tb.max()) - meta['maxM']) < 1e-6,
          'terrain.bin min/max %.1f/%.1f == meta minM/maxM %.1f/%.1f' % (tb.min(), tb.max(), meta['minM'], meta['maxM']))
    check(meta['size'] == SIZE and 42000.0 - meta['spacingM'] * SIZE < 1e-6,
          'meta spacingM %.4f covers %.1f m' % (meta['spacingM'], meta['spacingM'] * SIZE))

    for name, mode in (('height.png', None), ('slope.png', None), ('sun-visibility.png', None),
                       ('earth-visibility.png', None), ('hillshade.jpg', 'L'),
                       ('height-gray.png', 'L'), ('slope-gray.png', 'L')):
        p = ASSETS / name
        im = Image.open(p)
        im.load()
        check(im.size == (SIZE, SIZE), '%s %dx%d mode %s' % (name, im.size[0], im.size[1], im.mode))
        if mode:
            check(im.mode == mode, '%s mode is %s' % (name, im.mode))

    # 8-bit linear value maps: height-gray must span exactly 0..255 (minM..maxM); slope-gray max = 255
    hg = np.asarray(Image.open(ASSETS / 'height-gray.png'))
    sg = np.asarray(Image.open(ASSETS / 'slope-gray.png'))
    check(int(hg.min()) == 0 and int(hg.max()) == 255, 'height-gray.png spans %d..%d (want 0..255)' % (hg.min(), hg.max()))
    check(int(sg.max()) == 255, 'slope-gray.png max %d (want 255); min %d' % (sg.max(), sg.min()))
    check(np.array_equal(hg, np.round((tb.astype(np.float32) - meta['minM']) / (meta['maxM'] - meta['minM']) * 255.0).astype(np.uint8)),
          'height-gray.png is the linear map of terrain.bin over [minM, maxM]')
    dz640, dx640 = np.gradient(tb.astype(np.float32), meta['spacingM'])
    slope640 = np.degrees(np.arctan(np.hypot(dx640, dz640))).astype(np.float32)
    check(np.array_equal(sg, np.round(np.clip(slope640 / slope640.max(), 0, 1) * 255.0).astype(np.uint8)),
          'slope-gray.png is the linear map of the DEM gradient, 0..%.2f deg' % slope640.max())

    for name in ('highland', 'basin'):
        p = ASSETS / ('horizon-%s.json' % name)
        d = json.loads(p.read_text())
        az = np.array(d['azimuthDeg'], np.float64)
        el = np.array(d['elevationDeg'], np.float64)
        check(len(az) == 144 and len(el) == 144, 'horizon-%s.json has %d az / %d el samples' % (name, len(az), len(el)))
        check(np.allclose(np.diff(az), 2.5), 'horizon-%s.json azimuth step 2.5 deg' % name)
        check(el.min() >= -5.0 and el.max() <= 30.0,
              'horizon-%s.json elevation range [%.2f, %.2f] deg inside [-5, 30]' % (name, el.min(), el.max()))
        check(float(el.std()) > 0.05, 'horizon-%s.json elevation std %.3f deg (not constant)' % (name, el.std()))
        check(all(k in d['point'] for k in ('xM', 'zM', 'latDeg', 'lonDeg')), 'horizon-%s.json point keys' % name)

    for f in sorted(ASSETS.glob('*')):
        if f.is_file():
            mb = f.stat().st_size / 1024 / 1024
            check(mb < 2.0, '%-24s %8.1f KB  (< 2 MB)' % (f.name, f.stat().st_size / 1024))
    print('[verify] %s' % ('ALL CHECKS PASSED' if ok else 'SOME CHECKS FAILED'))
    return ok


# ----------------------------------------------------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', default='all', choices=['all', 'base', 'vis', 'horizon', 'verify'])
    args = ap.parse_args()
    ASSETS.mkdir(parents=True, exist_ok=True)
    vis = None
    if args.stage in ('all', 'base'):
        stage_base()
    if args.stage in ('all', 'vis'):
        vis = compute_visibility()
    if args.stage in ('all', 'horizon'):
        stage_horizon(vis)
    if args.stage in ('all', 'verify'):
        if not stage_verify():
            sys.exit(1)


if __name__ == '__main__':
    main()
