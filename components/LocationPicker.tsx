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
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Search, X, Navigation, Clock, Star, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { api } from '@/utils/api';

interface LocationPickerProps {
  value: string;
  onLocationChange: (location: string, coordinates?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  style?: any;
  showIcon?: boolean;
}

export default function LocationPicker({
  value,
  onLocationChange,
  placeholder = 'Search location...',
  style,
  showIcon = true,
}: LocationPickerProps) {
  const { theme, isDark } = useTheme();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Sync internal search text with prop value when modal opens
  useEffect(() => {
    if (isModalVisible) {
      setSearchText(value);
      if (value.length < 3) {
        showRecents();
      }
      // Get location for biasing search
      loadLocationForBiasing();
    }
  }, [isModalVisible]);

  const loadLocationForBiasing = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getLastKnownPositionAsync({});
        if (location) {
          setCurrentUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      }
    } catch (error) {
      console.log('Error getting location for biasing:', error);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchText.length >= 3 && isModalVisible) {
        fetchSuggestions(searchText);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchText]);

  const fetchSuggestions = async (text: string) => {
    setIsLoadingSuggestions(true);
    try {
      let url = `/places/autocomplete?q=${encodeURIComponent(text)}`;
      if (currentUserLocation) {
        url += `&lat=${currentUserLocation.latitude}&lon=${currentUserLocation.longitude}`;
      }
      const data = await api.get<any[]>(url);
      setSuggestions(data || []);
    } catch (error) {
      console.error('Failed to fetch suggestions', error);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const showRecents = () => {
    // Mock recent locations
    setSuggestions([
      { id: 'r1', name: 'Home', description: '123 Main St, Springfield', type: 'recent' },
      { id: 'r2', name: 'Work', description: '456 Business Ave, Metropolis', type: 'recent' },
      { id: 'r3', name: 'Airport', description: 'International Terminal, Gateway City', type: 'recent' },
    ]);
  };

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      
      // Reverse geocode
      const data = await api.get<any>(`/places/reverse?lat=${latitude}&lon=${longitude}`);
      const address = data.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      
      handleSelect({
        description: address,
        lat: latitude,
        lon: longitude,
        name: 'Current Location'
      });
    } catch (error) {
      console.error('Error getting location', error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSelect = (item: any) => {
    // Combine name and description for a complete location string
    let finalValue = '';
    
    if (item.name && item.name !== 'Current Location') {
      // If description already starts with name, don't duplicate it
      if (item.description && item.description.startsWith(item.name)) {
        finalValue = item.description;
      } else {
        finalValue = `${item.name}${item.description ? ', ' + item.description : ''}`;
      }
    } else {
      finalValue = item.description || item.address || item.name;
    }
    
    // Final cleanup
    finalValue = finalValue.replace(/,\s*$/, '').trim();
    
    onLocationChange(finalValue, { latitude: item.lat, longitude: item.lon });
    setIsModalVisible(false);
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
      <TouchableOpacity 
        style={[
          styles.trigger, 
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
        ]}
        onPress={() => setIsModalVisible(true)}
        activeOpacity={0.7}
      >
        {showIcon && <MapPin size={20} color={theme.colors.textSecondary} />}
        <Text 
          style={[
            styles.triggerText, 
            { color: value ? theme.colors.text : theme.colors.textSecondary }
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        {value ? (
          <TouchableOpacity onPress={() => onLocationChange('')}>
            <X size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <Search size={16} color={theme.colors.textSecondary} />
        )}
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setIsModalVisible(false)}
              style={styles.backBtn}
            >
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={[styles.searchInputWrapper, { backgroundColor: theme.colors.surface }]}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                ref={inputRef}
                style={[styles.modalInput, { color: theme.colors.text }]}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textSecondary}
                value={searchText}
                onChangeText={setSearchText}
                autoFocus={true}
                autoCorrect={false}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <X size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={({ item }) => {
              const addressText = item.description || item.address || item.country || '';
              return (
                <TouchableOpacity
                  style={[styles.suggestionItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => handleSelect(item)}
                >
                  <View style={[styles.iconBox, { backgroundColor: theme.colors.surface }]}>
                    {getIconForSuggestionType(item.type)}
                  </View>
                  <View style={styles.suggestionTextWrapper}>
                    {item.name && <Text style={[styles.suggestionName, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>}
                    {addressText ? (
                      <Text style={[styles.suggestionAddr, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                        {addressText}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListHeaderComponent={
              <>
                <TouchableOpacity
                  style={[styles.currentLocationBtn, { borderBottomColor: theme.colors.border }]}
                  onPress={getCurrentLocation}
                  disabled={isLoadingLocation}
                >
                  <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                    {isLoadingLocation ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <Navigation size={18} color={theme.colors.primary} />
                    )}
                  </View>
                  <Text style={[styles.currentLocationText, { color: theme.colors.primary }]}>
                    {isLoadingLocation ? 'Locating...' : 'Use current location'}
                  </Text>
                </TouchableOpacity>

                {suggestions.length > 0 && searchText.length < 3 && (
                  <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Recent Locations</Text>
                )}
              </>
            }
            ListEmptyComponent={
              !isLoadingSuggestions && searchText.length >= 3 ? (
                <View style={styles.emptyBox}>
                  <Search size={48} color={theme.colors.border} />
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No matches found for "{searchText}"</Text>
                </View>
              ) : null
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
          />
          
          {isLoadingSuggestions && (
            <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background + '80' }]}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  modalInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
    borderBottomWidth: 1,
  },
  currentLocationText: {
    fontWeight: '600',
    fontSize: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 0.5,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  suggestionAddr: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    letterSpacing: 1,
  },
  emptyBox: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 16,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});