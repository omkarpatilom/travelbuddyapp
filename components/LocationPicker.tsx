import React, { useState, useEffect } from 'react';
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
import { MapPin, Navigation, Clock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationPickerProps {
  value: string;
  onLocationChange: (location: string, coordinates?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  style?: any;
}

interface RecentLocation {
  address: string;
  coordinates: { latitude: number; longitude: number };
  timestamp: number;
}

export default function LocationPicker({
  value,
  onLocationChange,
  placeholder = 'Enter location',
  style,
}: LocationPickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchText, setSearchText] = useState(value);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    loadRecentLocations();
  }, []);

  useEffect(() => {
    setSearchText(value);
  }, [value]);

  const loadRecentLocations = async () => {
    try {
      const stored = await AsyncStorage.getItem('recentLocations');
      if (stored) {
        setRecentLocations(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading recent locations:', error);
    }
  };

  const saveRecentLocation = async (location: RecentLocation) => {
    try {
      const updated = [location, ...recentLocations.filter(l => l.address !== location.address)]
        .slice(0, 5); // Keep only 5 recent locations
      setRecentLocations(updated);
      await AsyncStorage.setItem('recentLocations', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent location:', error);
    }
  };

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to use current location',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Location.requestForegroundPermissionsAsync() },
          ]
        );
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
      Alert.alert('Error', 'Unable to get current location. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const selectRecentLocation = async (location: RecentLocation) => {
    onLocationChange(location.address, location.coordinates);
    setSearchText(location.address);
    setIsExpanded(false);
    
    // Update timestamp and move to top
    const updatedLocation = { ...location, timestamp: Date.now() };
    await saveRecentLocation(updatedLocation);
  };

  const handleTextChange = (text: string) => {
    setSearchText(text);
    onLocationChange(text);
  };

  const renderRecentLocation = ({ item }: { item: RecentLocation }) => (
    <TouchableOpacity
      style={[styles.recentItem, { backgroundColor: theme.colors.surface }]}
      onPress={() => selectRecentLocation(item)}
    >
      <Clock size={16} color={theme.colors.textSecondary} />
      <Text style={[styles.recentText, { color: theme.colors.text }]} numberOfLines={1}>
        {item.address}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.inputContainer,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          isExpanded && styles.inputExpanded,
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
      </TouchableOpacity>

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

          {recentLocations.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                Recent Locations
              </Text>
              <FlatList
                data={recentLocations}
                keyExtractor={(item) => item.address}
                renderItem={renderRecentLocation}
                style={styles.recentList}
                keyboardShouldPersistTaps="handled"
              />
            </>
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
  input: {
    flex: 1,
    fontSize: 16,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  recentList: {
    maxHeight: 150,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 12,
    marginBottom: 4,
  },
  recentText: {
    flex: 1,
    fontSize: 14,
  },
});