"""Apollo 11 landing site NAC DTM (LROC, 2 m/px, equirectangular GeoTIFF) -> a local Int16 height grid for the scene.

Input : data/lroc/NAC_DTM_APOLLO11.TIF   (https://data.lroc.im-ldi.com/lroc/view_rdr_product/NAC_DTM_APOLLO11, 118 MB, 32-bit float)
Output: data/derived/apollo11_dem.i16    Int16, row-major, row 0 = north. height = value * scale + zref
        data/derived/apollo11_meta.json  grid geometry in the scene frame
        data/derived/preview_apollo11.png  hillshade, for a quick look

Scene frame: origin at the landing site, x = east, z = south (so the north-up image maps to x right / z down, like the pole DEM),
y = height above the site (the DTM is relative to the 1737.4 km sphere). Pixel (i, j) has its centre at (x0 + i*px, z0 + j*px).

Run from the prototypes/lunar-scene-demo folder:  python -I tools/export_apollo11.py
"""
import json, math
import numpy as np
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None
SRC, OUT = 'data/lroc/NAC_DTM_APOLLO11.TIF', 'data/derived'
R = 1737400.0
SITE_LAT, SITE_LON = 0.67416, 23.47314        # Apollo 11 "Eagle" descent stage as located in LROC images (good to a few metres)
SCALE = 0.02                                  # metres per Int16 step (the strip has ~260 m of relief in all)
HALF_Z = 4000.0                               # keep +-4 km north-south (the horizon is only 2.4 km away at eye height)

im = Image.open(SRC)
a = np.asarray(im, dtype=np.float32)
tie, pix, geo = im.tag_v2[33922], im.tag_v2[33550], im.tag_v2[34736]
px = float(pix[0])                            # 2.0 m
lon0, lat0 = float(geo[1]), float(geo[2])     # projection centre longitude 180, standard parallel 1.0 deg
X_left, Y_top = tie[3], tie[4]                # projected metres of the top-left corner
print('size', a.shape, 'pixel', px, 'm; centre lon', lon0, 'std parallel', lat0)

# equirectangular: X = R cos(lat0) (lon - lon0), Y = R lat
X_site = R * math.cos(math.radians(lat0)) * math.radians(SITE_LON - lon0)
Y_site = R * math.radians(SITE_LAT)
col_s, row_s = (X_site - X_left) / px, (Y_top - Y_site) / px          # continuous pixel coordinates of the site (pixel edges at integers)
print('site at col %.1f row %.1f of %d x %d  -> %.0f m from the east edge, %.0f m from the west edge' % (
    col_s, row_s, a.shape[1], a.shape[0], (a.shape[1] - col_s) * px, col_s * px))

bad = ~np.isfinite(a) | (a < -1e30)
print('no-data pixels: %d (%.1f%%)' % (bad.sum(), 100 * bad.mean()))

# crop first (cheap), then fill the gaps by normalised convolution with a growing blur
r0 = max(0, int(round(row_s - HALF_Z / px))); r1 = min(a.shape[0], int(round(row_s + HALF_Z / px)))
a, bad = a[r0:r1].copy(), bad[r0:r1]
w = (~bad).astype(np.float32); v = np.where(bad, 0, a).astype(np.float32)
filled = ~bad
for sigma in (4, 8, 16, 32, 64, 128):
    if filled.all():
        break
    num, den = ndimage.gaussian_filter(v * w, sigma), ndimage.gaussian_filter(w, sigma)
    ok = (~filled) & (den > 1e-3)
    v[ok] = num[ok] / den[ok]; w[ok] = 1; filled |= ok
a = v
print('rows kept %d..%d, %d x %d px, still unfilled: %d' % (r0, r1, a.shape[1], a.shape[0], int((~filled).sum())))

# height of the site (bilinear), used as the zero level
ys, xs = row_s - r0 - 0.5, col_s - 0.5
zref = float(ndimage.map_coordinates(a, [[ys], [xs]], order=1)[0])
print('site elevation %.1f m above the reference sphere; crop relief %.1f .. %.1f m (relative to the site)' % (zref, a.min() - zref, a.max() - zref))

q = np.round((a - zref) / SCALE)
assert np.abs(q).max() < 32000, 'relief does not fit Int16 at this scale'
q.astype('<i2').tofile(OUT + '/apollo11_dem.i16')

nz, nx = a.shape
meta = {
    'nx': nx, 'nz': nz, 'px': px, 'scale': SCALE, 'zref': zref,
    'x0': (0.5 - col_s) * px,                       # scene x / z of the centre of pixel (0, 0)
    'z0': (r0 + 0.5 - row_s) * px,
    'site': {'lat': SITE_LAT, 'lon': SITE_LON},
    'source': 'LROC NAC DTM APOLLO11 v1.9 (ASU / NASA), 2 m/px, relative to a 1737.4 km sphere',
}
json.dump(meta, open(OUT + '/apollo11_meta.json', 'w'), indent=1)
print(json.dumps(meta))

# hillshade preview, sun from the east at 25 deg
dy, dx = np.gradient(a, px)
az, el = math.radians(90), math.radians(25)
nrm = np.sqrt(dx * dx + dy * dy + 1)
lx, ly, lz = math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)   # to the sun, x east, y south (rows)
sh = np.clip((-dx * lx - dy * ly + lz) / nrm, 0, 1)
Image.fromarray((sh * 255).astype(np.uint8)).save(OUT + '/preview_apollo11.png')
print('done')
