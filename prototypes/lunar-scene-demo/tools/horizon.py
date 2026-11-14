import sys, math
import numpy as np
from scipy import ndimage

derived = sys.argv[1]
n = 4200
h = np.fromfile(derived + '/dem_crop.i16', dtype='<i2').reshape(n, n).astype(np.float32) * 0.5
cx = cz = 2100.0 - 0.5            # pole sits at index 2100 - ... (x0 = -21005 => pole at (2100.5) px centre)
cx = cz = 2100.5
h0 = ndimage.map_coordinates(h, [[cz], [cx]], order=1)[0]
print('pole height', h0)
ts = np.arange(30, 21000, 10.0)
print('az(deg)  horizon elevation (deg)  [az 0 = up(-z), 90 = right(+x), image axes]')
rows = []
for az in range(0, 360, 10):
    a = math.radians(az)
    xs = cx + ts / 10.0 * math.sin(a)
    zs = cz + ts / 10.0 * (-math.cos(a))
    hh = ndimage.map_coordinates(h, [zs, xs], order=1, mode='nearest')
    ang = np.degrees(np.arctan2(hh - (h0 + 1.8), ts))
    k = int(np.argmax(ang))
    rows.append((az, ang[k], ts[k]))
    print(f'{az:3d}  {ang[k]:6.2f}   at {ts[k]/1000:5.1f} km')
