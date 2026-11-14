"""Find gentle places in the DEM crop that are also good for power (Sun above the terrain horizon) and direct-to-Earth comms
(Earth above the terrain horizon) over one year, using the real Sun/Earth directions from ephemeris.js.

    node tools/export_sky_series.mjs            # writes data/derived/sky_year.json (hourly, 365 d, at the pole)
    python tools/find_spot.py data/derived

Horizon = highest terrain elevation angle along each azimuth, including the lunar curvature (d^2 / 2R drop). The Sun/Earth
elevations are corrected for the observer's offset from the pole: e_local = e_pole + (u . r) / R (u = unit vector towards the body).
"""
import sys, math, json
import numpy as np
from scipy import ndimage

derived = sys.argv[1]
n, px, x0 = 4200, 10.0, -21005.0
R_MOON = 1737400.0
h = np.fromfile(derived + '/dem_crop.i16', dtype='<i2').reshape(n, n).astype(np.float32) * 0.5
sky = json.load(open(derived + '/sky_year.json'))
sun_az, sun_el = np.array(sky['sunAz']), np.array(sky['sunEl'])
ea_az, ea_el = np.array(sky['earthAz']), np.array(sky['earthEl'])

gy, gx = np.gradient(h, px)
S = np.degrees(np.arctan(np.hypot(gx, gy)))                  # slope at a 20 m baseline
mean_s = ndimage.uniform_filter(S, 21)                       # +-100 m
mean_big = ndimage.uniform_filter(S, 61)                     # +-300 m

AZ = np.arange(0, 360, 3.0)
DIST = np.arange(25.0, 12000.0, 25.0)


def horizon_profile(i, j):
    """Terrain horizon elevation (deg) for each azimuth in AZ, seen from DEM pixel (col i, row j) with a 1.8 m eye height."""
    a = np.radians(AZ)[:, None]
    cols = i + DIST[None, :] * np.sin(a) / px
    rows = j - DIST[None, :] * np.cos(a) / px
    ok = (cols > 0) & (cols < n - 1) & (rows > 0) & (rows < n - 1)
    hh = ndimage.map_coordinates(h, [np.clip(rows, 0, n - 1), np.clip(cols, 0, n - 1)], order=1)
    ang = (hh - h[j, i] - 1.8 - DIST[None, :] ** 2 / (2 * R_MOON)) / DIST[None, :]
    ang = np.where(ok, ang, -1.0)
    return np.degrees(np.arctan(ang.max(axis=1)))


def visible_fraction(prof, az, el, X, Z):
    u = np.stack([np.sin(np.radians(az)), -np.cos(np.radians(az))])
    el_local = el + np.degrees((u[0] * X + u[1] * Z) / R_MOON)
    hz = np.interp(az % 360, np.r_[AZ, 360.0], np.r_[prof, prof[0]])
    return el_local > hz


cands = []
for j in range(400, n - 400, 10):
    for i in range(400, n - 400, 10):
        X, Z = x0 + i * px, x0 + j * px
        if math.hypot(X, Z) > 12000: continue
        if mean_s[j, i] > 6.5 or mean_big[j, i] > 8.0: continue
        cands.append((i, j))
print('smooth candidates:', len(cands))

rows = []
for i, j in cands:
    X, Z = x0 + i * px, x0 + j * px
    prof = horizon_profile(i, j)
    sun_ok = visible_fraction(prof, sun_az, sun_el, X, Z)
    earth_ok = visible_fraction(prof, ea_az, ea_el, X, Z)
    rows.append((float((sun_ok & earth_ok).mean()), float(sun_ok.mean()), float(earth_ok.mean()), i, j))
rows.sort(reverse=True)

# reference: the pole itself
ci = int(round((0 - x0) / px))
prof = horizon_profile(ci, ci)
print('pole:  sun visible %.0f%%  Earth visible %.0f%%  both %.0f%%  (mean slope +-100 m %.1f)' % (
    100 * visible_fraction(prof, sun_az, sun_el, 0, 0).mean(), 100 * visible_fraction(prof, ea_az, ea_el, 0, 0).mean(),
    100 * (visible_fraction(prof, sun_az, sun_el, 0, 0) & visible_fraction(prof, ea_az, ea_el, 0, 0)).mean(), mean_s[ci, ci]))
seen = []
print('best smooth spots (365 d from %s):' % sky['start'])
for both, sf, ef, i, j in rows:
    X, Z = x0 + i * px, x0 + j * px
    if any(math.hypot(X - a, Z - b) < 1500 for a, b in seen): continue
    seen.append((X, Z))
    print('  x %6.0f z %6.0f  (%.1f km from pole)  height %5.0f m  slope(+-100 m) %.1f (+-300 m) %.1f deg  | sun %.0f%%  Earth %.0f%%  both %.0f%%' % (
        X, Z, math.hypot(X, Z) / 1000, h[j, i], mean_s[j, i], mean_big[j, i], 100 * sf, 100 * ef, 100 * both))
    if len(seen) >= 10: break
