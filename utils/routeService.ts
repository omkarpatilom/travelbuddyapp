/**
 * Decodes Google Polyline format (precision 5) to coordinates array
 * @param encoded Polyline string
 */
export function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }
  return points;
}

export interface RouteInfo {
  coordinates: { latitude: number; longitude: number }[];
  distance: string;
  duration: string;
}

/**
 * Fetches route geometry, distance, and duration from OSRM public API
 */
export async function getRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<RouteInfo> {
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=polyline`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = decodePolyline(route.geometry);
        
        const distanceKm = route.distance / 1000;
        const durationSec = route.duration;
        
        const distanceStr = `${distanceKm.toFixed(1)} km`;
        
        let durationStr = 'Unknown';
        const hours = Math.floor(durationSec / 3600);
        const minutes = Math.floor((durationSec % 3600) / 60);
        if (hours > 0) {
          durationStr = `${hours}h ${minutes}m`;
        } else {
          durationStr = `${minutes} mins`;
        }
        
        return {
          coordinates,
          distance: distanceStr,
          duration: durationStr,
        };
      }
    }
  } catch (error) {
    console.warn('Failed to fetch OSRM route details, falling back to straight line:', error);
  }

  // Fallback: simple straight line path between start and end
  return {
    coordinates: [
      { latitude: startLat, longitude: startLon },
      { latitude: endLat, longitude: endLon },
    ],
    distance: `${(calculateDistance(startLat, startLon, endLat, endLon) * 1.3).toFixed(1)} km`,
    duration: `${Math.round((calculateDistance(startLat, startLon, endLat, endLon) * 1.3 / 45) * 60)} mins`,
  };
}

/**
 * Haversine formula to compute straight line distance in km
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
