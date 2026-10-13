const rad = (d: number) => (d * Math.PI) / 180;

// Haversine distance in metres (same as fms-backend analytics.DistanceM).
export function distanceM(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
): number {
    const x =
        Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(x));
}
