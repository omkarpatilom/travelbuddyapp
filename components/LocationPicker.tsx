import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { MapPin, Navigation, Clock, Star, Search } from 'lucide-react-native';
import { storage, StorageKeys } from '@/utils/storage';
import { requestLocationPermission } from '@/utils/permissions';

interface LocationPickerProps {
  value: string;
  onLocationChange: (location: string, coordinates?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  style?: any;
}

interface LocationSuggestion {
  id: string;
  address: string;
  coordinates?: { latitude: number; longitude: number };
  type: 'google' | 'recent' | 'favorite' | 'fallback';
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

// Mock Google Places API - Replace with actual implementation
const mockGooglePlacesAPI = {
  async searchPlaces(query: string): Promise<LocationSuggestion[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (query.length < 2) return [];
    
    // Mock suggestions based on query
    const mockSuggestions: LocationSuggestion[] = [
      {
        id: '1',
        address: `${query} Street, San Francisco, CA`,
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
        type: 'google',
      },
      {
        id: '2',
        address: `${query} Avenue, Oakland, CA`,
        coordinates: { latitude: 37.8044, longitude: -122.2712 },
        type: 'google',
      },
      {
        id: '3',
        address: `${query} Boulevard, Berkeley, CA`,
        coordinates: { latitude: 37.8715, longitude: -122.2730 },
        type: 'google',
      },
    ];
    
    return mockSuggestions;
  }
};

// Fallback location search for areas with limited Google API coverage
const fallbackLocationSearch = async (query: string): Promise<LocationSuggestion[]> => {
  const fallbackSuggestions: LocationSuggestion[] = [
    {
      id: 'fallback-1',
      address: `${query} - Local Area`,
      type: 'fallback',
    },
    {
      id: 'fallback-2',
      address: `Near ${query}`,
      type: 'fallback',
    },
  ];
  
  return fallbackSuggestions;
};

export default function LocationPicker({
  value,
  onLocationChange,
  placeholder = 'Enter location',
  style,
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
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadStoredData();
  }, []);

  useEffect(() => {
    setSearchText(value);
  }, [value]);

  useEffect(() => {
    if (searchText.length >= 2) {
      // Debounce search
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      searchTimeoutRef.current = setTimeout(() => {
        searchLocations(searchText);
      }, 300);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText]);

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

  const searchLocations = async (query: string) => {
    setIsLoadingSuggestions(true);
    setError(null);
    
    try {
      let allSuggestions: LocationSuggestion[] = [];
      
      // Add recent locations that match query
      const matchingRecent = recentLocations
        .filter(loc => loc.address.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .map(loc => ({
          id: `recent-${loc.timestamp}`,
          address: loc.address,
          coordinates: loc.coordinates,
          type: 'recent' as const,
        }));
      
      // Add favorite locations that match query
      const matchingFavorites = favoriteLocations
        .filter(loc => 
          loc.name.toLowerCase().includes(query.toLowerCase()) ||
          loc.address.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 2)
        .map(loc => ({
          id: `favorite-${loc.id}`,
          address: `${loc.name} - ${loc.address}`,
          coordinates: loc.coordinates,
          type: 'favorite' as const,
        }));
      
      allSuggestions = [...matchingFavorites, ...matchingRecent];
      
      try {
        // Try Google Places API first
        const googleSuggestions = await mockGooglePlacesAPI.searchPlaces(query);
        allSuggestions = [...allSuggestions, ...googleSuggestions];
      } catch (googleError) {
        console.warn('Google Places API failed, using fallback:', googleError);
        
        // Use fallback search
        const fallbackSuggestions = await fallbackLocationSearch(query);
        allSuggestions = [...allSuggestions, ...fallbackSuggestions];
        
        setError('Limited location data available in this area');
      }
      
      // Remove duplicates and limit results
      const uniqueSuggestions = allSuggestions
        .filter((suggestion, index, self) => 
          index === self.findIndex(s => s.address === suggestion.address)
        )
        .slice(0, 8);
      
      setSuggestions(uniqueSuggestions);
    } catch (error) {
      console.error('Error searching locations:', error);
      setError('Unable to search locations. Please try again.');
      setSuggestions([]);
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
        timeout: 10000,
      });

      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const formattedAddress = `${address.street || ''} ${address.city || ''}, ${address.region || ''} ${address.postalCode || ''}`.trim();
        
        const locationData = {
          address: formattedAddress,
          coordinates: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          timestamp: Date.now(),
        };

        onLocationChange(formattedAddress, locationData.coordinates);
        setSearchText(formattedAddress);
        await saveRecentLocation(locationData);
        setIsExpanded(false);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      setError('Unable to get current location. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const saveRecentLocation = async (location: RecentLocation) => {
    try {
      const updated = [location, ...recentLocations.filter(l => l.address !== location.address)]
        .slice(0, 10); // Keep only 10 recent locations
      setRecentLocations(updated);
      await storage.setItem(StorageKeys.RECENT_LOCATIONS, updated);
    } catch (error) {
      console.error('Error saving recent location:', error);
    }
  };

  const selectSuggestion = async (suggestion: LocationSuggestion) => {
    onLocationChange(suggestion.address, suggestion.coordinates);
    setSearchText(suggestion.address);
    setIsExpanded(false);
    setSuggestions([]);
    
    // Save to recent locations if it has coordinates
    if (suggestion.coordinates && suggestion.type !== 'recent') {
      const locationData = {
        address: suggestion.address,
        coordinates: suggestion.coordinates,
        timestamp: Date.now(),
      };
      await saveRecentLocation(locationData);
    }
  };

  const handleTextChange = (text: string) => {
    setSearchText(text);
    onLocationChange(text);
    if (!isExpanded) setIsExpanded(true);
  };

  const getIconForSuggestionType = (type: string) => {
    switch (type) {
      case 'recent':
        return <Clock size={16} color={theme.colors.textSecondary} />;
      case 'favorite':
        return <Star size={16} color={theme.colors.warning} />;
      case 'google':
        return <MapPin size={16} color={theme.colors.primary} />;
      case 'fallback':
        return <Search size={16} color={theme.colors.textSecondary} />;
      default:
        return <MapPin size={16} color={theme.colors.textSecondary} />;
    }
  };

  const renderSuggestion = ({ item }: { item: LocationSuggestion }) => (
    <TouchableOpacity
      style={[styles.suggestionItem, { backgroundColor: theme.colors.surface }]}
      onPress={() => selectSuggestion(item)}
    >
      {getIconForSuggestionType(item.type)}
      <View style={styles.suggestionContent}>
        <Text style={[styles.suggestionText, { color: theme.colors.text }]} numberOfLines={1}>
          {item.address}
        </Text>
        {item.distance && (
          <Text style={[styles.suggestionDistance, { color: theme.colors.textSecondary }]}>
            {item.distance}km away
          </Text>
        )}
      </View>
      {item.type === 'fallback' && (
        <Text style={[styles.fallbackBadge, { color: theme.colors.warning }]}>
          Limited data
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.inputContainer,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          isExpanded && styles.inputExpanded,
          error && styles.inputError,
        ]}
        onPress={() => setIsExpanded(true)}
      >
        <MapPin size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.input, { color: theme.colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          value={searchText}
          onChangeText={handleTextChange}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => setTimeout(() => setIsExpanded(false), 200)}
        />
        {isLoadingSuggestions && (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}
      </TouchableOpacity>

      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}

      {isExpanded && (
        <View style={[styles.dropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.currentLocationButton, { backgroundColor: theme.colors.primary }]}
            onPress={getCurrentLocation}
            disabled={isLoadingLocation}
          >
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Navigation size={16} color="#FFFFFF" />
            )}
            <Text style={styles.currentLocationText}>
              {isLoadingLocation ? 'Getting location...' : 'Use Current Location'}
            </Text>
          </TouchableOpacity>

          {suggestions.length > 0 && (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              renderItem={renderSuggestion}
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          )}

          {suggestions.length === 0 && searchText.length >= 2 && !isLoadingSuggestions && (
            <View style={styles.noResultsContainer}>
              <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>
                No locations found for "{searchText}"
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  inputExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 12,
    maxHeight: 300,
    zIndex: 1001,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  currentLocationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 12,
    marginBottom: 4,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 14,
    marginBottom: 2,
  },
  suggestionDistance: {
    fontSize: 12,
  },
  fallbackBadge: {
    fontSize: 10,
    fontWeight: '600',
  },
  noResultsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
  },
});