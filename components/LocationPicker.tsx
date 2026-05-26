import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { MapPin, Navigation, Clock, Star, Search, X, Map as MapIcon } from 'lucide-react-native';
import { storage, StorageKeys } from '@/utils/storage';
import { requestLocationPermission } from '@/utils/permissions';

interface LocationPickerProps {
  value: string;
  onLocationChange: (location: string, coordinates?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  style?: any;
  showIcon?: boolean;
}

interface LocationSuggestion {
  id: string;
  address: string;
  name?: string;
  coordinates?: { latitude: number; longitude: number };
  type: 'google' | 'recent' | 'favorite' | 'fallback' | 'current';
  distance?: number;
}

interface RecentLocation {
  address: string;
  coordinates: { latitude: number; longitude: number };
  timestamp: number;
}

interface FavoriteLocation {
  id: string;
  name: string;
  address: string;
  coordinates: { latitude: number; longitude: number };
  type: 'home' | 'work' | 'custom';
}

const nominatimAPI = {
  async searchPlaces(query: string): Promise<LocationSuggestion[]> {
    if (query.length < 3) return [];
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=6&accept-language=en`,
        {
          headers: {
            'User-Agent': 'TravelBuddyApp/1.0',
          },
        }
      );
      
      const data = await response.json();
      
      return data.map((item: any) => {
        const address = item.address;
        const name = item.display_name.split(',')[0];
        const fullAddress = item.display_name;

        return {
          id: item.place_id.toString(),
          name: name,
          address: fullAddress,
          coordinates: {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
          },
          type: 'google',
        };
      });
    } catch (error) {
      console.error('Nominatim search failed:', error);
      return [];
    }
  }
};

export default function LocationPicker({
  value,
  onLocationChange,
  placeholder = 'Enter location',
  style,
  showIcon = true,
}: LocationPickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchText, setSearchText] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { theme } = useTheme();
  const searchTimeoutRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadStoredData();
  }, []);

  useEffect(() => {
    setSearchText(value);
  }, [value]);

  useEffect(() => {
    if (searchText.length >= 3 && isExpanded) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      
      searchTimeoutRef.current = setTimeout(() => {
        searchLocations(searchText);
      }, 500);
    } else if (searchText.length < 3 && isExpanded) {
      setSuggestions([]);
      showRecents();
    }
  }, [searchText, isExpanded]);

  const loadStoredData = async () => {
    try {
      const [recent, favorites] = await Promise.all([
        storage.getItem<RecentLocation[]>(StorageKeys.RECENT_LOCATIONS),
        storage.getItem<FavoriteLocation[]>('favoriteLocations'),
      ]);
      
      if (recent) setRecentLocations(recent);
      if (favorites) setFavoriteLocations(favorites);
    } catch (error) {
      console.error('Error loading stored location data:', error);
    }
  };

  const showRecents = () => {
    const recentSugs: LocationSuggestion[] = recentLocations.map(loc => ({
      id: `recent-${loc.timestamp}`,
      address: loc.address,
      coordinates: loc.coordinates,
      type: 'recent',
    }));
    setSuggestions(recentSugs.slice(0, 5));
  };

  const searchLocations = async (query: string) => {
    setIsLoadingSuggestions(true);
    setError(null);
    
    try {
      const apiSuggestions = await nominatimAPI.searchPlaces(query);
      
      // Merge with matching favorites or recents if any
      const matchingRecent = recentLocations
        .filter(loc => loc.address.toLowerCase().includes(query.toLowerCase()))
        .map(loc => ({
          id: `recent-${loc.timestamp}`,
          address: loc.address,
          coordinates: loc.coordinates,
          type: 'recent' as const,
        }));

      const combined = [...matchingRecent, ...apiSuggestions];
      
      // Unique by address
      const unique = combined.filter((v, i, a) => a.findIndex(t => t.address === v.address) === i);
      setSuggestions(unique.slice(0, 8));
    } catch (error) {
      console.error('Error searching locations:', error);
      setError('Search failed');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    setError(null);
    
    try {
      const permission = await requestLocationPermission();
      if (!permission.granted) {
        setError('Location permission required');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const formattedAddress = `${address.street || ''} ${address.city || ''}, ${address.region || ''}`.trim().replace(/^ ,/, '');
        
        const coordinates = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        onLocationChange(formattedAddress, coordinates);
        setSearchText(formattedAddress);
        await saveRecentLocation({ address: formattedAddress, coordinates, timestamp: Date.now() });
        setIsExpanded(false);
      }
    } catch (error) {
      setError('Unable to get location');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const saveRecentLocation = async (location: RecentLocation) => {
    const updated = [location, ...recentLocations.filter(l => l.address !== location.address)].slice(0, 10);
    setRecentLocations(updated);
    await storage.setItem(StorageKeys.RECENT_LOCATIONS, updated);
  };

  const selectSuggestion = async (suggestion: LocationSuggestion) => {
    onLocationChange(suggestion.address, suggestion.coordinates);
    setSearchText(suggestion.address);
    setIsExpanded(false);
    
    if (suggestion.coordinates) {
      await saveRecentLocation({
        address: suggestion.address,
        coordinates: suggestion.coordinates,
        timestamp: Date.now(),
      });
    }
  };

  const handleClear = () => {
    setSearchText('');
    onLocationChange('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const getIconForSuggestionType = (type: string) => {
    switch (type) {
      case 'recent': return <Clock size={18} color={theme.colors.textSecondary} />;
      case 'favorite': return <Star size={18} color={theme.colors.warning} />;
      case 'current': return <Navigation size={18} color={theme.colors.primary} />;
      default: return <MapPin size={18} color={theme.colors.primary} />;
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[
        styles.inputWrapper, 
        { backgroundColor: theme.colors.surface, borderColor: isExpanded ? theme.colors.primary : theme.colors.border }
      ]}>
        {showIcon && <MapPin size={20} color={isExpanded ? theme.colors.primary : theme.colors.textSecondary} />}
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: theme.colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => {
            setIsExpanded(true);
            if (searchText.length < 3) showRecents();
          }}
          autoCorrect={false}
        />
        {isLoadingSuggestions ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : searchText.length > 0 ? (
          <TouchableOpacity onPress={handleClear}>
            <X size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isExpanded && (
        <View style={[styles.dropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.currentLocationBtn, { borderBottomColor: theme.colors.border }]}
            onPress={getCurrentLocation}
            disabled={isLoadingLocation}
          >
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Navigation size={18} color={theme.colors.primary} />
            )}
            <Text style={[styles.currentLocationText, { color: theme.colors.primary }]}>
              {isLoadingLocation ? 'Locating...' : 'Use current location'}
            </Text>
          </TouchableOpacity>

          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => selectSuggestion(item)}
              >
                <View style={[styles.iconBox, { backgroundColor: theme.colors.background }]}>
                  {getIconForSuggestionType(item.type)}
                </View>
                <View style={styles.suggestionTextWrapper}>
                  {item.name && <Text style={[styles.suggestionName, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>}
                  <Text style={[styles.suggestionAddr, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                    {item.address}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              suggestions.length > 0 && searchText.length < 3 ? (
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Recent Locations</Text>
              ) : null
            }
            ListEmptyComponent={
              !isLoadingSuggestions && searchText.length >= 3 ? (
                <View style={styles.emptyBox}>
                  <Search size={40} color={theme.colors.border} />
                  <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>No matches found</Text>
                </View>
              ) : null
            }
          />
          
          <TouchableOpacity 
            style={[styles.closeBtn, { backgroundColor: theme.colors.surface }]}
            onPress={() => setIsExpanded(false)}
          >
            <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  dropdown: {
    position: 'absolute',
    top: 62,
    left: 0,
    right: 0,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: 400,
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  currentLocationText: {
    fontWeight: '600',
    fontSize: 15,
  },
  suggestionItem: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  suggestionAddr: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    letterSpacing: 1,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  closeBtn: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
});