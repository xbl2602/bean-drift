import sys, math
import numpy as np
from scipy import ndimage
sys.path.insert(0, sys.argv[2])
import export_dem as E

derived = sys.argv[1]
n = 4200
h = np.fromfile(derived + '/dem_crop.i16', dtype='<i2').reshape(n, n).astype(np.float32) * 0.5
x0 = -21005.0
wx = lambda i: x0 + i * 10.0
# crater centre = centroid of the deep basin
yy, xx = np.mgrid[0:n, 0:n]
basin = h < -2200
cxm, czm = wx(xx[basin].mean()), wx(yy[basin].mean())
print('crater centre (m):', round(cxm), round(czm), 'basin px', int(basin.sum()))
for az in (296, 304, 312, 320):
    lit = E.cast_shadow(h, az, 1.5)
    # candidate camera spots: on the rim ring on the sun side of the crater
    a = math.radians(az); sx, sz = math.sin(a), -math.cos(a)
    best = None
    for R in np.arange(9500, 12500, 250):
        for dth in np.arange(-40, 41, 5):
            t = math.radians(dth); ca, sa = math.cos(t), math.sin(t)
            dx, dz = sx * ca - sz * sa, sx * sa + sz * ca
            px_ = cxm + R * dx; pz_ = czm + R * dz
            i = int(round((px_ - x0) / 10)); j = int(round((pz_ - x0) / 10))
            if not (50 < i < n - 50 and 50 < j < n - 50): continue
            # local maximum within 300 m that is lit
            win = (slice(j - 30, j + 31), slice(i - 30, i + 31))
            hh = h[win]; ll = lit[win]
            hh2 = np.where(ll > 0.95, hh, -1e9)
            k = np.unravel_index(np.argmax(hh2), hh2.shape)
            if hh2[k] < -1e8: continue
            ci, cj = i - 30 + k[1], j - 30 + k[0]
            cand = (hh2[k], wx(ci), wx(cj), R, dth)
            if best is None or cand[0] > best[0]: best = cand
    # lit fraction of the crater's inner wall facing that spot
    r = np.hypot(wx(xx) - cxm, wx(yy) - czm)
    wall = (r > 4000) & (r < 9500)
    far = ((wx(xx) - cxm) * sx + (wx(yy) - czm) * sz) < 0           # half of the wall on the far side from the sun
    print('az', az, 'lit crater floor frac', round(float(lit[r < 3500].mean()), 3), 'lit far-wall frac', round(float(lit[wall & far].mean()), 3), 'best rim spot (h,x,z,R,dth):', None if best is None else tuple(round(float(v), 1) for v in best))
