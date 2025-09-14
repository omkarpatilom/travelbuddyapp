import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  MapPin, 
  Navigation, 
  RotateCcw, 
  Search, 
  X, 
  Check,
  Crosshair,
  ArrowUpDown
} from 'lucide-react-native';
import { requestLocationPermission } from '@/utils/permissions';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  placeId?: string;
}

interface InteractiveMapProps {
  onLocationsSelected: (from: LocationData, to: LocationData) => void;
  initialFrom?: LocationData;
  initialTo?: LocationData;
  onClose?: () => void;
  style?: any;
}

interface MapMarker {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title: string;
  description: string;
  type: 'from' | 'to';
}

export default function InteractiveMap({
  onLocationsSelected,
  initialFrom,
  initialTo,
  onClose,
  style,
}: InteractiveMapProps) {
  const [region, setRegion] = useState<Region>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });

  const [fromLocation, setFromLocation] = useState<LocationData | null>(initialFrom || null);
  const [toLocation, setToLocation] = useState<LocationData | null>(initialTo || null);
  const [fromSearchText, setFromSearchText] = useState(initialFrom?.address || '');
  const [toSearchText, setToSearchText] = useState(initialTo?.address || '');
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showDirections, setShowDirections] = useState(false);

  const mapRef = useRef<MapView>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const { theme } = useTheme();

  useEffect(() => {
    getCurrentLocation();
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (fromLocation && toLocation) {
      setShowDirections(true);
      fitToCoordinates();
    } else {
      setShowDirections(false);
    }
  }, [fromLocation, toLocation]);

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const permission = await requestLocationPermission();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Location access is needed to show your current position');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      };

      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Location Error', 'Unable to get your current location');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleMapPress = async (event: any) => {
    const { coordinate } = event.nativeEvent;
    
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });

      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const formattedAddress = `${address.street || ''} ${address.city || ''}, ${address.region || ''} ${address.postalCode || ''}`.trim();
        
        const locationData: LocationData = {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          address: formattedAddress,
        };

        if (activeField === 'from' || (!fromLocation && !activeField)) {
          setFromLocation(locationData);
          setFromSearchText(formattedAddress);
          setActiveField('to');
        } else if (activeField === 'to' || (!toLocation && fromLocation)) {
          setToLocation(locationData);
          setToSearchText(formattedAddress);
          setActiveField(null);
        }
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      Alert.alert('Error', 'Unable to get address for this location');
    }
  };

  const searchLocation = async (query: string, field: 'from' | 'to') => {
    if (query.length < 3) {
      setSearchSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      // Mock Google Places API - replace with actual implementation
      const mockResults = [
        {
          place_id: '1',
          description: `${query} Street, San Francisco, CA`,
          geometry: { location: { lat: 37.7749, lng: -122.4194 } },
        },
        {
          place_id: '2',
          description: `${query} Avenue, Oakland, CA`,
          geometry: { location: { lat: 37.8044, lng: -122.2712 } },
        },
        {
          place_id: '3',
          description: `${query} Boulevard, Berkeley, CA`,
          geometry: { location: { lat: 37.8715, lng: -122.2730 } },
        },
      ];

      setSearchSuggestions(mockResults);
    } catch (error) {
      console.error('Error searching locations:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchTextChange = (text: string, field: 'from' | 'to') => {
    if (field === 'from') {
      setFromSearchText(text);
    } else {
      setToSearchText(text);
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(text, field);
    }, 300);
  };

  const selectSuggestion = (suggestion: any, field: 'from' | 'to') => {
    const locationData: LocationData = {
      latitude: suggestion.geometry.location.lat,
      longitude: suggestion.geometry.location.lng,
      address: suggestion.description,
      placeId: suggestion.place_id,
    };

    if (field === 'from') {
      setFromLocation(locationData);
      setFromSearchText(suggestion.description);
    } else {
      setToLocation(locationData);
      setToSearchText(suggestion.description);
    }

    setSearchSuggestions([]);
    setActiveField(null);

    // Animate to selected location
    const newRegion = {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      latitudeDelta: LATITUDE_DELTA / 4,
      longitudeDelta: LONGITUDE_DELTA / 4,
    };
    mapRef.current?.animateToRegion(newRegion, 1000);
  };

  const useCurrentLocationForPickup = async () => {
    setIsLoadingLocation(true);
    try {
      const permission = await requestLocationPermission();
      if (!permission.granted) return;

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
        
        const locationData: LocationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: formattedAddress,
        };

        setFromLocation(locationData);
        setFromSearchText(formattedAddress);
        setActiveField('to');

        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: LATITUDE_DELTA / 2,
          longitudeDelta: LONGITUDE_DELTA / 2,
        };
        mapRef.current?.animateToRegion(newRegion, 1000);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Unable to get your current location');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const swapLocations = () => {
    const tempFrom = fromLocation;
    const tempFromText = fromSearchText;
    
    setFromLocation(toLocation);
    setFromSearchText(toSearchText);
    setToLocation(tempFrom);
    setToSearchText(tempFromText);
  };

  const clearLocation = (field: 'from' | 'to') => {
    if (field === 'from') {
      setFromLocation(null);
      setFromSearchText('');
    } else {
      setToLocation(null);
      setToSearchText('');
    }
    setShowDirections(false);
  };

  const fitToCoordinates = () => {
    if (fromLocation && toLocation && mapRef.current) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: fromLocation.latitude, longitude: fromLocation.longitude },
          { latitude: toLocation.latitude, longitude: toLocation.longitude },
        ],
        {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        }
      );
    }
  };

  const handleConfirm = () => {
    if (fromLocation && toLocation) {
      onLocationsSelected(fromLocation, toLocation);
    } else {
      Alert.alert('Incomplete Selection', 'Please select both pickup and destination locations');
    }
  };

  const renderMarkers = () => {
    const markers = [];

    if (fromLocation) {
      markers.push(
        <Marker
          key="from"
          coordinate={{
            latitude: fromLocation.latitude,
            longitude: fromLocation.longitude,
          }}
          title="Pickup Location"
          description={fromLocation.address}
          pinColor="#22C55E"
        />
      );
    }

    if (toLocation) {
      markers.push(
        <Marker
          key="to"
          coordinate={{
            latitude: toLocation.latitude,
            longitude: toLocation.longitude,
          }}
          title="Destination"
          description={toLocation.address}
          pinColor="#EF4444"
        />
      );
    }

    return markers;
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { backgroundColor: theme.colors.background },
        {
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [height, 0],
            }),
          }],
        },
        style
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Select Locations</Text>
        <TouchableOpacity onPress={getCurrentLocation} style={styles.centerButton} disabled={isLoadingLocation}>
          {isLoadingLocation ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Crosshair size={24} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Controls */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
        {/* From Field */}
        <View style={styles.searchRow}>
          <View style={[styles.searchInput, { backgroundColor: theme.colors.background, borderColor: activeField === 'from' ? theme.colors.primary : theme.colors.border }]}>
            <MapPin size={20} color="#22C55E" />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="From (Pickup location)"
              placeholderTextColor={theme.colors.textSecondary}
              value={fromSearchText}
              onChangeText={(text) => handleSearchTextChange(text, 'from')}
              onFocus={() => setActiveField('from')}
            />
            {fromLocation && (
              <TouchableOpacity onPress={() => clearLocation('from')}>
                <X size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.currentLocationButton, { backgroundColor: theme.colors.primary }]}
            onPress={useCurrentLocationForPickup}
            disabled={isLoadingLocation}
          >
            <Navigation size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Swap Button */}
        <View style={styles.swapContainer}>
          <TouchableOpacity 
            style={[styles.swapButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={swapLocations}
            disabled={!fromLocation || !toLocation}
          >
            <ArrowUpDown size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* To Field */}
        <View style={styles.searchRow}>
          <View style={[styles.searchInput, { backgroundColor: theme.colors.background, borderColor: activeField === 'to' ? theme.colors.primary : theme.colors.border }]}>
            <MapPin size={20} color="#EF4444" />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="To (Destination)"
              placeholderTextColor={theme.colors.textSecondary}
              value={toSearchText}
              onChangeText={(text) => handleSearchTextChange(text, 'to')}
              onFocus={() => setActiveField('to')}
            />
            {toLocation && (
              <TouchableOpacity onPress={() => clearLocation('to')}>
                <X size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Suggestions */}
        {searchSuggestions.length > 0 && (
          <View style={[styles.suggestions, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {searchSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.suggestionItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => selectSuggestion(suggestion, activeField || 'from')}
              >
                <MapPin size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.suggestionText, { color: theme.colors.text }]}>
                  {suggestion.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        showsScale
        loadingEnabled
        loadingIndicatorColor={theme.colors.primary}
        customMapStyle={theme.isDark ? darkMapStyle : []}
      >
        {renderMarkers()}
        
        {showDirections && fromLocation && toLocation && (
          <MapViewDirections
            origin={{
              latitude: fromLocation.latitude,
              longitude: fromLocation.longitude,
            }}
            destination={{
              latitude: toLocation.latitude,
              longitude: toLocation.longitude,
            }}
            apikey="YOUR_GOOGLE_MAPS_API_KEY" // Replace with your API key
            strokeWidth={4}
            strokeColor={theme.colors.primary}
            optimizeWaypoints
            onReady={fitToCoordinates}
          />
        )}
      </MapView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        {fromLocation && toLocation && (
          <View style={styles.routeInfo}>
            <Text style={[styles.routeText, { color: theme.colors.text }]}>
              Route: {fromLocation.address.split(',')[0]} → {toLocation.address.split(',')[0]}
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          style={[
            styles.confirmButton,
            { backgroundColor: fromLocation && toLocation ? theme.colors.primary : theme.colors.border }
          ]}
          onPress={handleConfirm}
          disabled={!fromLocation || !toLocation}
        >
          <Check size={20} color="#FFFFFF" />
          <Text style={styles.confirmButtonText}>
            Confirm Locations
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// Dark mode map style
const darkMapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#242f3e' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#242f3e' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#746855' }],
  },
  // Add more dark mode styling as needed
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  centerButton: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  currentLocationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapContainer: {
    alignItems: 'center',
    marginVertical: -5,
  },
  swapButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestions: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 5,
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 12,
    borderBottomWidth: 1,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
  },
  map: {
    flex: 1,
  },
  bottomActions: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: Platform.OS === 'ios' ? 35 : 15,
    gap: 15,
  },
  routeInfo: {
    alignItems: 'center',
  },
  routeText: {
    fontSize: 14,
    textAlign: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});