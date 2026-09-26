import * as Location from 'expo-location';
import { getSuggestionOrigin, placeAutocompleteUrl } from '../utils/placeSearch';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

const mocked = Location as jest.Mocked<typeof Location>;

describe('placeSearch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the origin so the API can rank nearest-first within the user country', () => {
    expect(placeAutocompleteUrl('Katraj', { latitude: 16.705, longitude: 74.2433 }))
      .toBe('/places/autocomplete?q=Katraj&lat=16.705&lon=74.2433');
  });

  it('omits the origin when location is unavailable', () => {
    expect(placeAutocompleteUrl('Kat raj', null)).toBe('/places/autocomplete?q=Kat%20raj');
  });

  it('uses the last known position when permission is granted', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    mocked.getLastKnownPositionAsync.mockResolvedValue({ coords: { latitude: 18.52, longitude: 73.85 } } as any);

    await expect(getSuggestionOrigin()).resolves.toEqual({ latitude: 18.52, longitude: 73.85 });
  });

  it('never prompts and resolves null without permission', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);

    await expect(getSuggestionOrigin()).resolves.toBeNull();
    expect(mocked.getLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it('resolves null when the location lookup fails', async () => {
    mocked.getForegroundPermissionsAsync.mockRejectedValue(new Error('unavailable'));

    await expect(getSuggestionOrigin()).resolves.toBeNull();
  });
});
