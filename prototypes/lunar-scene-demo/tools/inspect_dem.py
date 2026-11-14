import sys, time
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
src, outdir = sys.argv[1], sys.argv[2]
t0 = time.time()
im = Image.open(src)
print('mode', im.mode, 'size', im.size)
a = np.asarray(im)
print('dtype', a.dtype, 'shape', a.shape, 'decode s', round(time.time() - t0, 1))
print('raw min/max', a.min(), a.max())
# LBL: height_m = DN * 0.5 + 1737400 - 1737400 (relative to the reference radius) -> metres relative to sphere
dn = a.astype(np.int32) - 32768                       # the JP2 stores DN + 32768 (matches DERIVED_MINIMUM/MAXIMUM -8760..4744 DN)
h = dn * 0.5
print('height m min/max', h.min(), h.max(), 'mean', h.mean())
np.save(outdir + '/height_m_full.npy', h.astype(np.float32))
# polar stereographic: pole at pixel (7583.5, 7583.5) 1-based => 0-based index 7582.5
c = 7582.5
N = h.shape[0]
# crop +-20 km around the pole (2000 px each side at 10 m)
r = 2000
crop = h[int(c) - r:int(c) + r, int(c) - r:int(c) + r]
print('crop shape', crop.shape, 'min/max', crop.min(), crop.max())
lo, hi = np.percentile(crop, [1, 99])
img = np.clip((crop - lo) / (hi - lo), 0, 1)
# hillshade
dy, dx = np.gradient(crop, 10.0)
az, el = np.radians(315), np.radians(25)
slope = np.arctan(np.hypot(dx, dy)); aspect = np.arctan2(-dx, dy)
hs = np.sin(el) * np.cos(slope) + np.cos(el) * np.sin(slope) * np.cos(az - aspect)
hs = np.clip(hs, 0, 1)
Image.fromarray((hs * 255).astype(np.uint8)).resize((1000, 1000), Image.LANCZOS).save(outdir + '/preview_hillshade_40km.png')
Image.fromarray((img * 255).astype(np.uint8)).resize((1000, 1000), Image.LANCZOS).save(outdir + '/preview_height_40km.png')
# deepest point within the crop (Shackleton floor expected)
iy, ix = np.unravel_index(np.argmin(crop), crop.shape)
print('crop min at (row, col)', iy, ix, 'offset from pole km', (ix - r) * 0.01, (iy - r) * 0.01, 'height', crop[iy, ix])
print('total s', round(time.time() - t0, 1))
