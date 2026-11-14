import sys, json, math
import numpy as np
from PIL import Image
from scipy import ndimage

PX = 10.0                                   # metres per DEM pixel


def cast_shadow(h, sun_az_deg, sun_el_deg, px=PX):
    """Lit fraction (1 = lit, 0 = shadow) for a DEM, sun at azimuth az (0 = -Z/up, 90 = +X/right) and elevation el.
    World x = column, world z = row (down). Rotates the DEM so the sun is on the +column side, then sweeps."""
    a = math.radians(sun_az_deg)
    sx, sz = math.sin(a), -math.cos(a)                     # direction towards the sun in (col, row) coordinates
    phi = math.degrees(math.atan2(sz, sx))                 # angle of that direction measured from +col towards +row
    tan_el = math.tan(math.radians(sun_el_deg))
    # ndimage.rotate turns the picture counter-clockwise on screen (row down) for positive angles.
    # We need the sun direction (angle phi, clockwise on screen because rows go down) to end up at +col => rotate CCW by phi.
    big = ndimage.rotate(h, phi, reshape=True, order=1, mode='nearest')
    s = np.empty_like(big)
    depth = np.zeros_like(big)
    cur = big[:, -1].copy()
    s[:, -1] = cur
    for j in range(big.shape[1] - 2, -1, -1):
        shadow_h = cur - tan_el * px                      # height of the shadow plane one pixel nearer to the sun, lowered by the slope
        depth[:, j] = shadow_h - big[:, j]                # >0: ground is below the plane => shadowed
        cur = np.maximum(big[:, j], shadow_h)
    lit = 1.0 - np.clip(depth / 3.0, 0.0, 1.0)            # ~3 m penumbra in height terms
    back = ndimage.rotate(lit, -phi, reshape=True, order=1, mode='nearest')
    y0 = (back.shape[0] - h.shape[0]) // 2
    x0 = (back.shape[1] - h.shape[1]) // 2
    out = back[y0:y0 + h.shape[0], x0:x0 + h.shape[1]]
    return np.clip(out, 0, 1)


def selftest():
    n = 401
    h = np.zeros((n, n), np.float32)
    h[195:206, 195:206] = 200.0                           # a 100 m wide, 200 m tall pillar at the centre
    for az in (0, 90, 180, 270, 135):
        lit = cast_shadow(h, az, 10.0)
        ys, xs = np.where(lit < 0.5)
        ys = ys[(np.abs(ys - 200) < 150) | True]
        far = np.hypot(xs - 200, ys - 200) > 12
        cx, cy = (xs[far].mean() - 200), (ys[far].mean() - 200)
        print('az', az, 'sun dir (col,row)', round(math.sin(math.radians(az)), 2), round(-math.cos(math.radians(az)), 2),
              '-> shadow centroid offset (col,row)', round(cx, 1), round(cy, 1), 'shadow px', int(far.sum()))


if __name__ == '__main__':
    if sys.argv[1] == 'selftest':
        selftest()
        sys.exit()
    derived, az, el = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    half = 2100
    h = np.load(derived + '/height_m_full.npy')
    c = 7582.5
    i0 = int(round(c)) - half                              # first pixel index of the crop (square)
    crop = h[i0:i0 + 2 * half, i0:i0 + 2 * half].astype(np.float32)
    n = crop.shape[0]
    x0 = (i0 - c) * PX
    dn = np.round(crop * 2.0).astype(np.int16)             # metres = DN * 0.5
    dn.astype('<i2').tofile(derived + '/dem_crop.i16')
    lit = cast_shadow(crop, az, el)
    small = lit.reshape(n // 2, 2, n // 2, 2).mean(axis=(1, 3))
    Image.fromarray((small * 255).astype(np.uint8), 'L').save(derived + '/shadow.png', optimize=True)
    meta = {'n': n, 'px': PX, 'x0': x0, 'z0': x0, 'scale': 0.5, 'shadowN': n // 2, 'sunAz': az, 'sunEl': el,
            'pole_height_m': float(crop[half, half]), 'min_m': float(crop.min()), 'max_m': float(crop.max())}
    json.dump(meta, open(derived + '/dem_meta.json', 'w'), indent=1)
    print(meta)
    print('lit fraction', float(lit.mean()))
    Image.fromarray((np.clip((crop - crop.min()) / (crop.max() - crop.min()), 0, 1) * 255).astype(np.uint8)).resize((1050, 1050)).save(derived + '/preview_crop.png')
    Image.fromarray((small * 255).astype(np.uint8), 'L').resize((1050, 1050)).save(derived + '/preview_shadow.png')
