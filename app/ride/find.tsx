import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRides, Ride } from '@/contexts/RideContext';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Clock, 
  Star, 
  Users, 
  Filter, 
  ArrowLeft, 
  X, 
  IndianRupee, 
  ChevronRight,
  ArrowUpDown,
  Circle,
  Map,
  Info,
  Home as HomeIcon,
  Briefcase,
  Heart,
  Navigation,
  Car
} from 'lucide-react-native';
import DatePicker from '@/components/DatePicker';
import PreferencesSelector from '@/components/PreferencesSelector';
import LocationPicker from '@/components/LocationPicker';
import * as Location from 'expo-location';
import { api } from '@/utils/api';

const { width } = Dimensions.get('window');

export default function FindRideScreen() {
  const { theme, isDark } = useTheme();
  const { searchRides } = useRides();
  const router = useRouter();
  const { from, to, date, fromLat, fromLon, toLat, toLon } = useLocalSearchParams();

  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [fromCoords, setFromCoords] = useState<{ latitude: number; longitude: number } | undefined>();
  const [toCoords, setToCoords] = useState<{ latitude: number; longitude: number } | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [searchResults, setSearchResults] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  interface SavedLocation {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    type: 'Home' | 'Work' | 'Favorite' | 'Other';
  }

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  useEffect(() => {
    fetchSavedLocations();
    if (!from) {
      prefillCurrentLocation();
    }
  }, []);

  const fetchSavedLocations = async () => {
    setIsLoadingSaved(true);
    try {
      const data = await api.get<any[]>('/saved-locations');
      if (data) {
        setSavedLocations(data.map(item => {
          let derivedType: SavedLocation['type'] = 'Favorite';
          const lowerName = item.name.toLowerCase();
          if (lowerName === 'home') {
            derivedType = 'Home';
          } else if (lowerName === 'work') {
            derivedType = 'Work';
          } else if (lowerName === 'favorite') {
            derivedType = 'Favorite';
          } else {
            derivedType = 'Other';
          }
          return {
            id: item.id,
            name: item.name,
            address: item.address,
            latitude: item.latitude,
            longitude: item.longitude,
            type: derivedType,
          };
        }));
      }
    } catch (error) {
      console.warn('Failed to fetch saved locations in FindRideScreen:', error);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const prefillCurrentLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        if (location) {
          const { latitude, longitude } = location.coords;
          // Reverse geocode
          const data = await api.get<any>(`/places/reverse?lat=${latitude}&lon=${longitude}`);
          const address = data.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setFromLocation('Current Location');
          setFromCoords({ latitude, longitude });
        }
      }
    } catch (e) {
      console.log('Failed to prefill current location:', e);
    }
  };

  const handleSelectSavedLocation = (location: SavedLocation) => {
    setToLocation(location.address);
    setToCoords({ latitude: location.latitude, longitude: location.longitude });

    if (!fromLocation) {
      setFromLocation('Current Location');
      if (!fromCoords) {
        // Springfield fallback coordinates
        setFromCoords({ latitude: 37.7749, longitude: -122.4194 });
      }
    }
  };

  const getLocationIcon = (type: SavedLocation['type']) => {
    switch (type) {
      case 'Home': return <HomeIcon size={18} color={theme.colors.primary} />;
      case 'Work': return <Briefcase size={18} color={theme.colors.secondary} />;
      case 'Favorite': return <Heart size={18} color={theme.colors.accent} />;
      default: return <MapPin size={18} color={theme.colors.textSecondary} />;
    }
  };
  
  const [filters, setFilters] = useState({
    priceRange: { min: 0, max: 500 },
    minSeats: 1,
    preferences: {
      nonSmoking: false,
      musicAllowed: false,
      petsAllowed: false,
      airConditioning: false,
      conversationLevel: 'moderate',
    },
  });

  useEffect(() => {
    const init = async () => {
      if (from) {
        const decodedFrom = decodeURIComponent(from as string);
        setFromLocation(decodedFrom);
      }
      if (to) {
        const decodedTo = decodeURIComponent(to as string);
        setToLocation(decodedTo);
      }

      let hasFromCoords = false;
      let hasToCoords = false;

      if (fromLat && fromLon) {
        setFromCoords({ latitude: parseFloat(fromLat as string), longitude: parseFloat(fromLon as string) });
        hasFromCoords = true;
      }
      if (toLat && toLon) {
        setToCoords({ latitude: parseFloat(toLat as string), longitude: parseFloat(toLon as string) });
        hasToCoords = true;
      }

      if (from && !hasFromCoords) {
        const decodedFrom = decodeURIComponent(from as string);
        try {
          const data = await api.get<any>(`/places/geocode?q=${encodeURIComponent(decodedFrom)}`);
          if (data && data.lat) setFromCoords({ latitude: data.lat, longitude: data.lon });
        } catch (e) { console.warn('Failed to geocode from location'); }
      }
      
      if (to && !hasToCoords) {
        const decodedTo = decodeURIComponent(to as string);
        try {
          const data = await api.get<any>(`/places/geocode?q=${encodeURIComponent(decodedTo)}`);
          if (data && data.lat) setToCoords({ latitude: data.lat, longitude: data.lon });
        } catch (e) { console.warn('Failed to geocode to location'); }
      }
      
      if (date) setSelectedDate(new Date(date as string));
    };

    init();
  }, [from, to, date, fromLat, fromLon, toLat, toLon]);

  useEffect(() => {
    if (fromLocation && toLocation && fromCoords && toCoords) {
      performSearch();
    }
  }, [fromCoords, toCoords]);

  const performSearch = async () => {
    if (!fromLocation || !toLocation) {
      Alert.alert('Incomplete Search', 'Please provide both start and end locations.');
      return;
    }

    if (!fromCoords || !toCoords) {
        setIsLoading(true);
        try {
            let fCoords = fromCoords;
            let tCoords = toCoords;
            
            if (!fCoords) {
                const data = await api.get<any>(`/places/geocode?q=${encodeURIComponent(fromLocation)}`);
                if (data && data.lat) fCoords = { latitude: data.lat, longitude: data.lon };
            }
            if (!tCoords) {
                const data = await api.get<any>(`/places/geocode?q=${encodeURIComponent(toLocation)}`);
                if (data && data.lat) tCoords = { latitude: data.lat, longitude: data.lon };
            }
            
            if (!fCoords || !tCoords) {
                Alert.alert('Location Error', 'Could not resolve locations to coordinates.');
                setIsLoading(false);
                return;
            }
            
            setFromCoords(fCoords);
            setToCoords(tCoords);
            return;
        } catch (e) {
            console.error('Final geocode attempt failed', e);
            Alert.alert('Search Error', 'Unable to resolve locations.');
            setIsLoading(false);
            return;
        }
    }

    setIsLoading(true);
    setHasSearched(true);
    try {
      const dateString = selectedDate ? selectedDate.toISOString().split('T')[0] : '';
      
      const results = await searchRides({
        from: fromLocation.trim(),
        to: toLocation.trim(),
        date: dateString,
        fromCoords,
        toCoords,
        seats: filters.minSeats,
        maxPrice: filters.priceRange.max,
        allowPets: filters.preferences.petsAllowed,
        allowMusic: filters.preferences.musicAllowed,
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      Alert.alert('Search Error', 'Unable to fetch rides. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const swapLocations = () => {
    const tempLoc = fromLocation;
    const tempCoords = fromCoords;
    setFromLocation(toLocation);
    setFromCoords(toCoords);
    setToLocation(tempLoc);
    setToCoords(tempCoords);
  };

  const renderRide = ({ item }: { item: Ride }) => (
    <TouchableOpacity 
      style={[styles.rideCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={() => router.push(`/ride/details?id=${item.id}`)}
    >
      <View style={styles.rideTop}>
        <View style={styles.timeInfo}>
          <Text style={[styles.rideTime, { color: theme.colors.text }]}>{item.time}</Text>
          {item.pickupDistanceMeters ? (
            <Text style={[styles.rideDistance, { color: theme.colors.primary }]}>
              {item.pickupDistanceMeters < 1000 
                ? `${Math.round(item.pickupDistanceMeters)}m` 
                : `${(item.pickupDistanceMeters / 1000).toFixed(1)}km`} away
            </Text>
          ) : (
            <Text style={[styles.rideDuration, { color: theme.colors.textSecondary }]}>{item.duration || '2h 15m'}</Text>
          )}
        </View>
        <View style={styles.routeVisual}>
          <Circle size={8} color={theme.colors.primary} fill={theme.colors.primary} />
          <View style={[styles.routeLine, { backgroundColor: theme.colors.border }]} />
          <MapPin size={12} color={theme.colors.secondary} />
        </View>
        <View style={styles.routeDetails}>
          <Text style={[styles.routeText, { color: theme.colors.text }]} numberOfLines={1}>{item.from.address}</Text>
          <Text style={[styles.routeText, { color: theme.colors.text, marginTop: 14 }]} numberOfLines={1}>{item.to.address}</Text>
        </View>
        <View style={styles.priceTag}>
          <Text style={[styles.priceValue, { color: theme.colors.primary }]}>₹{item.price}</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <View style={styles.rideBottom}>
        <View style={styles.driverQuickInfo}>
          <Image 
            source={{ uri: item.driverAvatar || 'https://ui-avatars.com/api/?name=' + item.driverName }} 
            style={styles.driverSmallAvatar} 
          />
          <View>
            <Text style={[styles.driverSmallName, { color: theme.colors.text }]}>{item.driverName}</Text>
            <View style={styles.miniRating}>
              <Star size={10} color={theme.colors.warning} fill={theme.colors.warning} />
              <Text style={[styles.miniRatingText, { color: theme.colors.textSecondary }]}>{item.driverRating}</Text>
            </View>
          </View>
        </View>

        <View style={styles.rideFeatures}>
          <View style={[styles.featureBadge, { backgroundColor: theme.colors.surface }]}>
            <Users size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>{item.availableSeats} seats</Text>
          </View>
          {item.preferences.musicAllowed && (
            <View style={[styles.featureBadge, { backgroundColor: theme.colors.surface }]}>
              <Text style={styles.featureEmoji}>🎵</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Search Header */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.card }]}>
        <View style={styles.headerNav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Find a Ride</Text>
          <TouchableOpacity 
            onPress={() => setShowFilters(true)}
            style={[styles.filterBtn, { borderColor: theme.colors.border }]}
          >
            <Filter size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputsWrapper}>
          <View style={styles.routeContainer}>
            <View style={styles.inputRouteVisual}>
              <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.square, { backgroundColor: theme.colors.secondary }]} />
            </View>
            <View style={styles.routeInputs}>
              <LocationPicker
                value={fromLocation}
                onLocationChange={(loc, coords) => {
                  setFromLocation(loc);
                  if (coords) setFromCoords(coords);
                }}
                placeholder="From where?"
                style={styles.picker}
                showIcon={false}
              />
              <View style={[styles.inputGap, { backgroundColor: theme.colors.border }]} />
              <LocationPicker
                value={toLocation}
                onLocationChange={(loc, coords) => {
                  setToLocation(loc);
                  if (coords) setToCoords(coords);
                }}
                placeholder="To where?"
                style={styles.picker}
                showIcon={false}
              />
            </View>
            <TouchableOpacity style={[styles.swapBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onPress={swapLocations}>
              <ArrowUpDown size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomInputs}>
            <DatePicker
              value={selectedDate}
              onDateChange={setSelectedDate}
              style={styles.dateInput}
            />
            <TouchableOpacity 
              style={[styles.mainSearchBtn, { backgroundColor: theme.colors.primary }]}
              onPress={performSearch}
            >
              <Text style={styles.mainSearchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Results Section */}
      <View style={styles.resultsContainer}>
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>Searching for rides...</Text>
          </View>
        ) : hasSearched ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderRide}
            contentContainerStyle={styles.listPadding}
            ListEmptyComponent={
              <View style={styles.centerBox}>
                <Map size={64} color={theme.colors.border} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No rides found</Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                  We couldn't find any rides matching your criteria. Try different dates or locations.
                </Text>
              </View>
            }
          />
        ) : (
          <View style={styles.preSearchBoxContainer}>
            {savedLocations.length > 0 ? (
              <ScrollView contentContainerStyle={styles.savedLocationsListContainer} keyboardShouldPersistTaps="handled">
                <Text style={[styles.savedSectionTitle, { color: theme.colors.text }]}>Your Saved Locations</Text>
                <View style={styles.savedGrid}>
                  {savedLocations.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.savedCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                      onPress={() => handleSelectSavedLocation(item)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.savedIconBox, { backgroundColor: theme.colors.surface }]}>
                        {getLocationIcon(item.type)}
                      </View>
                      <View style={styles.savedCardInfo}>
                        <Text style={[styles.savedCardName, { color: theme.colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.savedCardAddress, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                          {item.address}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.preSearchBox}>
                <Info size={40} color={theme.colors.primary} style={{ opacity: 0.5 }} />
                <Text style={[styles.preSearchText, { color: theme.colors.textSecondary }]}>
                  Enter your trip details above to see available rides.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.textSecondary }]}>Price limit per seat</Text>
                <View style={[styles.priceInputWrapper, { backgroundColor: theme.colors.surface }]}>
                  <IndianRupee size={20} color={theme.colors.primary} />
                  <TextInput
                    style={[styles.priceField, { color: theme.colors.text }]}
                    keyboardType="numeric"
                    value={filters.priceRange.max.toString()}
                    onChangeText={(v) => setFilters(f => ({ ...f, priceRange: { ...f.priceRange, max: parseInt(v) || 0 } }))}
                  />
                </View>
              </View>

              <PreferencesSelector
                preferences={filters.preferences as any}
                onPreferencesChange={(p) => setFilters(f => ({ ...f, preferences: p as any }))}
                mode="passenger"
              />
            </ScrollView>

            <TouchableOpacity 
              style={[styles.applyBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => { setShowFilters(false); performSearch(); }}
            >
              <Text style={styles.applyBtnText}>Show Results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  iconBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  filterBtn: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 10,
  },
  inputsWrapper: {
    marginTop: 10,
    gap: 16,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
  },
  inputRouteVisual: {
    width: 24,
    alignItems: 'center',
    paddingVertical: 18,
    marginRight: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  square: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  routeInputs: {
    flex: 1,
  },
  picker: {
    height: 50,
  },
  inputGap: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 10,
  },
  swapBtn: {
    position: 'absolute',
    right: 15,
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    borderWidth: 1,
    borderColor: '#eee',
  },
  bottomInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
  },
  mainSearchBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainSearchBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  resultsContainer: {
    flex: 1,
  },
  listPadding: {
    padding: 20,
    gap: 16,
  },
  rideCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  rideTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeInfo: {
    alignItems: 'center',
    width: 60,
  },
  rideTime: {
    fontSize: 16,
    fontWeight: '700',
  },
  rideDistance: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  rideDuration: {
    fontSize: 11,
    marginTop: 2,
  },
  routeVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  routeLine: {
    width: 1,
    height: 30,
    marginVertical: 4,
  },
  routeDetails: {
    flex: 1,
    justifyContent: 'space-between',
    height: 55,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  priceTag: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    opacity: 0.1,
  },
  rideBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverQuickInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverSmallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  driverSmallName: {
    fontSize: 13,
    fontWeight: '600',
  },
  miniRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniRatingText: {
    fontSize: 11,
  },
  rideFeatures: {
    flexDirection: 'row',
    gap: 8,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  featureText: {
    fontSize: 11,
    fontWeight: '500',
  },
  featureEmoji: {
    fontSize: 12,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 15,
  },
  statusText: {
    fontSize: 15,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  preSearchBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 15,
  },
  preSearchText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  filterGroup: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRadius: 15,
    height: 55,
    gap: 10,
  },
  priceField: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  applyBtn: {
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  preSearchBoxContainer: {
    flex: 1,
    padding: 20,
  },
  savedLocationsListContainer: {
    paddingBottom: 20,
  },
  savedSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  savedGrid: {
    gap: 12,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  savedIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedCardInfo: {
    flex: 1,
  },
  savedCardName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  savedCardAddress: {
    fontSize: 13,
    lineHeight: 18,
  },
});