import { z } from "zod";

const finite = z.number().finite();
const coordinate = { latDeg: finite.min(-90).max(90), lonDeg: finite.min(-180).max(180) };
export const nearbyMapSchema = z.object({
  locations: z.array(z.object({
    queryCoord: z.object(coordinate),
    nearbyFeatures: z.array(z.object({
      ...coordinate, name: z.string().max(200), featureType: z.string().max(100),
      diameterKm: finite.nonnegative(), distanceKm: finite.nonnegative(), withinFeatureRadius: z.boolean(),
    })).max(5),
  })).max(4),
});
export type NearbyLocation = z.infer<typeof nearbyMapSchema>["locations"][number];

/** Local azimuthal-equidistant projection: radial distance from the query is preserved. */
export function projectNearby(origin: { latDeg: number; lonDeg: number }, target: { latDeg: number; lonDeg: number }) {
  const radians = Math.PI / 180;
  const lat1 = origin.latDeg * radians, lat2 = target.latDeg * radians;
  const deltaLon = (target.lonDeg - origin.lonDeg) * radians;
  const a = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const distanceKm = 2 * 1737.4 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
  const bearing = Math.atan2(Math.sin(deltaLon) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon));
  return { eastKm: distanceKm * Math.sin(bearing), northKm: distanceKm * Math.cos(bearing), distanceKm };
}
