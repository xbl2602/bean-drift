"""Fetch apparent Sun and Earth azimuth/elevation for lunar-surface observers from JPL Horizons.

Writes a fixture JSON. The test compares our ephemeris (skyAtLatLon) against it.
Horizons: CENTER='coord@301' (Moon), SITE_COORD east-longitude/latitude/altitude(km), QUANTITIES=4 (airless apparent AZ/EL).
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SITES = [
    ("apollo-11 (IAU Statio Tranquillitatis)", 0.6741, 23.4732),
    ("chang-e-4 (IAU Statio Tianhe)", -45.45, 177.6),
    ("malapert crater centre (IAU)", -84.9998, 11.4031),
    ("shackleton crater centre (IAU)", -89.67, 129.78),
    ("haworth crater centre (IAU)", -87.45, -5.17),
    ("far-side centre", 0.0, 180.0),
    ("near-side limb", 0.0, -88.0),
    ("mid-latitude north", 45.0, 60.0),
]
TIMES = [
    "2026-11-15T12:00:00Z", "2027-02-03T06:00:00Z", "2027-08-30T00:00:00Z", "2028-03-01T15:00:00Z",
    "2029-05-10T09:00:00Z", "2030-01-01T00:00:00Z", "2030-06-15T12:00:00Z", "2030-10-21T07:30:00Z",
    "2005-03-20T18:00:00Z", "2015-09-09T03:00:00Z", "2035-07-04T21:00:00Z", "2043-12-25T12:00:00Z",
    "2060-04-12T05:00:00Z", "2090-11-30T14:00:00Z",
]


def horizons(command: str, lon: float, lat: float, times: list[str]) -> list[tuple[float, float]]:
    # Horizons returns rows in chronological order whatever the TLIST order, so TIMES must be sorted and each row's date is checked below.
    tl = [t.replace("T", " ").replace("Z", "") for t in times]
    q = {
        "format": "json", "COMMAND": f"'{command}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'", "COORD_TYPE": "'GEODETIC'", "SITE_COORD": f"'{lon},{lat},0'",
        "TLIST": "'" + "' '".join(tl) + "'", "QUANTITIES": "'4'", "ANG_FORMAT": "'DEG'", "APPARENT": "'AIRLESS'",
        "CAL_FORMAT": "'CAL'", "TIME_DIGITS": "'SECONDS'", "EXTRA_PREC": "'YES'", "TIME_TYPE": "'UT'",
    }
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(q, safe="'@ ")
    text = json.loads(urllib.request.urlopen(url, timeout=90).read().decode())["result"]
    body = text.split("$$SOE")[1].split("$$EOE")[0]
    out = []
    for idx, line in enumerate(body.strip().splitlines()):
        stamp = datetime.strptime(line.strip()[:17], "%Y-%b-%d %H:%M")
        want = datetime.strptime(times[idx], "%Y-%m-%dT%H:%M:%SZ")
        if stamp != want:
            raise RuntimeError(f"row {idx} is {stamp}, expected {want}")
        nums = re.findall(r"-?\d+\.\d+", line.split(" ", 2)[-1])
        # last two floats on the line are azimuth and elevation
        out.append((float(nums[-2]), float(nums[-1])))
    if len(out) != len(times):
        raise RuntimeError(f"expected {len(times)} rows, got {len(out)}:\n{body[:400]}")
    return out


TIMES = sorted(TIMES)
rows = []
for name, lat, lon in SITES:
    sun = horizons("10", lon, lat, TIMES)
    earth = horizons("399", lon, lat, TIMES)
    for i, t in enumerate(TIMES):
        rows.append({"site": name, "latDeg": lat, "lonDeg": lon, "timeUtc": t,
                     "sun": {"azimuthDeg": sun[i][0], "elevationDeg": sun[i][1]},
                     "earth": {"azimuthDeg": earth[i][0], "elevationDeg": earth[i][1]}})
    print("fetched", name, file=sys.stderr)
    time.sleep(0.5)
fixture = {
    "source": "JPL Horizons API (https://ssd-api.jpl.nasa.gov/doc/horizons.api), observer on the Moon: CENTER=coord@301, COORD_TYPE=GEODETIC, SITE_COORD=east-longitude,latitude,0 km, QUANTITIES=4 (airless apparent azimuth/elevation, degrees, azimuth clockwise from north), TIME_TYPE=UT",
    "fetchedUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "rows": rows,
}
json.dump(fixture, open(sys.argv[1], "w", encoding="utf-8"), indent=1)
print("rows:", len(rows))
