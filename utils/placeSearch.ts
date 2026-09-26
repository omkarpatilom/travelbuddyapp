import * as Location from 'expo-location';

export type Coordinates = { latitude: number; longitude: number };

/**
 * The device's last known position, used to rank place suggestions nearest-first
 * and restrict them to the user's country. Never prompts: without permission (or
 * a known position) it resolves to null, and the API falls back to its default
 * country and relevance order.
 */
export async function getSuggestionOrigin(): Promise<Coordinates | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const position = await Location.getLastKnownPositionAsync({});
    return position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null;
  } catch (error) {
    console.log('Error getting location for place suggestions:', error);
    return null;
  }
}

export function placeAutocompleteUrl(text: string, origin?: Coordinates | null): string {
  let url = `/places/autocomplete?q=${encodeURIComponent(text)}`;
  if (origin) {
    url += `&lat=${origin.latitude}&lon=${origin.longitude}`;
  }
  return url;
}
