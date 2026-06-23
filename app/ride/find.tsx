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
import { formatPrice } from '@/utils/validation';
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
  const { from, to, date, fromLat, fromLon, toLat, toLon, vehicleCategory, seats } = useLocalSearchParams();

  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [fromCoords, setFromCoords] = useState<{ latitude: number; longitude: number } | undefined>();
  const [toCoords, setToCoords] = useState<{ latitude: number; longitude: number } | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [searchResults, setSearchResults] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Custom premium states for filters and sorting
  const [passengerCount, setPassengerCount] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Car']);
  const [selectedComfort, setSelectedComfort] = useState<string[]>([]);
  const [selectedSafety, setSelectedSafety] = useState<string[]>([]);
  const [selectedExperience, setSelectedExperience] = useState<string[]>([]);
  const [minSeats, setMinSeats] = useState(1);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('Recommended');
  const [showSortModal, setShowSortModal] = useState(false);
  
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
      if (vehicleCategory) {
        setSelectedCategories([vehicleCategory as string]);
      }
      if (seats) {
        setPassengerCount(parseInt(seats as string) || 1);
        setMinSeats(parseInt(seats as string) || 1);
      }
    };

    init();
  }, [from, to, date, fromLat, fromLon, toLat, toLon, vehicleCategory, seats]);

  useEffect(() => {
    if (fromLocation && toLocation && fromCoords && toCoords) {
      performSearch();
    }
  }, [fromCoords, toCoords]);

  const performSearch = async () => {
    console.log('Performing search with:', { fromLocation, toLocation, fromCoords, toCoords, selectedDate, passengerCount });
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
        seats: passengerCount,
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

  const getCategoryEmoji = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'car': return '🚗';
      case 'bike': return '🏍';
      case 'bus': return '🚌';
      case 'van': return '🚐';
      case 'ev': return '⚡';
      default: return '🚗';
    }
  };

  const getRideFeatureString = (item: Ride) => {
    const parts = [];
    if (item.features?.includes('ac')) parts.push('AC');
    if (item.features?.includes('charging_port')) parts.push('Charging');
    if (item.isDriverVerified || item.isVehicleVerified) parts.push('Verified');
    return parts.length > 0 ? parts.join(' • ') : 'Standard';
  };

  const getFilteredAndSortedRides = () => {
    let filtered = [...searchResults];

    // Filter by Vehicle Category (Layer 1)
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(ride => selectedCategories.includes(ride.vehicleCategory || 'Car'));
    }

    // Filter by Comfort Features (Layer 2)
    if (selectedComfort.length > 0) {
      filtered = filtered.filter(ride => {
        const rideFeatures = ride.features || [];
        return selectedComfort.every(feature => rideFeatures.includes(feature));
      });
    }

    // Filter by Safety (Layer 3)
    if (selectedSafety.includes('Verified Driver')) {
      filtered = filtered.filter(ride => ride.isDriverVerified);
    }
    if (selectedSafety.includes('Verified Vehicle')) {
      filtered = filtered.filter(ride => ride.isVehicleVerified);
    }

    // Filter by Experience
    if (selectedExperience.includes('Quiet Ride')) {
      filtered = filtered.filter(ride => ride.preferences.conversationLevel === 'quiet');
    }
    if (selectedExperience.includes('Chat Friendly')) {
      filtered = filtered.filter(ride => ride.preferences.conversationLevel === 'chatty');
    }
    if (selectedExperience.includes('Pet Friendly')) {
      filtered = filtered.filter(ride => ride.preferences.petsAllowed);
    }

    // Filter by Seats
    filtered = filtered.filter(ride => ride.availableSeats >= minSeats);

    // Filter by Budget
    if (minPrice) {
      filtered = filtered.filter(ride => ride.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter(ride => ride.price <= parseFloat(maxPrice));
    }

    // Filter by Departure Time
    if (selectedTimeSlots.length > 0) {
      filtered = filtered.filter(ride => {
        if (!ride.time) return false;
        const hour = parseInt(ride.time.split(':')[0]) || 0;
        return selectedTimeSlots.some(slot => {
          if (slot === 'Morning') return hour >= 6 && hour < 12;
          if (slot === 'Afternoon') return hour >= 12 && hour < 17;
          if (slot === 'Evening') return hour >= 17 && hour < 21;
          if (slot === 'Night') return hour >= 21 || hour < 6;
          return false;
        });
      });
    }

    // Apply Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'Lowest Price') {
        return a.price - b.price;
      }
      if (sortBy === 'Highest Rating') {
        return b.driverRating - a.driverRating;
      }
      if (sortBy === 'Earliest Departure') {
        return a.time.localeCompare(b.time);
      }
      if (sortBy === 'Most Seats Available') {
        return b.availableSeats - a.availableSeats;
      }
      if (sortBy === 'Nearest Pickup') {
        return (a.pickupDistanceMeters || 0) - (b.pickupDistanceMeters || 0);
      }
      // Recommended
      return (b.driverRating * 100 - b.price) - (a.driverRating * 100 - a.price);
    });

    return filtered;
  };

  const renderRide = ({ item }: { item: Ride }) => (
    <TouchableOpacity 
      style={[styles.rideCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={() => router.push(`/ride/details?id=${item.id}&prefCategories=${encodeURIComponent(selectedCategories.join(','))}&prefComfort=${encodeURIComponent(selectedComfort.join(','))}&prefSafety=${encodeURIComponent(selectedSafety.join(','))}&prefExperience=${encodeURIComponent(selectedExperience.join(','))}`)}
    >
      <View style={styles.rideTop}>
        <View style={styles.rideHeaderRow}>
          <Text style={[styles.rideCategoryText, { color: theme.colors.text }]}>
            {getCategoryEmoji(item.vehicleCategory)} {item.vehicleCategory}
          </Text>
          <View style={styles.priceTag}>
            <Text style={[styles.priceValue, { color: theme.colors.primary }]}>{formatPrice(item.price)}</Text>
          </View>
        </View>

        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: theme.colors.secondary }]} />
            <Text style={[styles.routeText, { color: theme.colors.text }]} numberOfLines={1}>{item.from.address}</Text>
          </View>
          <View style={[styles.routeVerticalLineMini, { backgroundColor: theme.colors.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: theme.colors.error }]} />
            <Text style={[styles.routeText, { color: theme.colors.text }]} numberOfLines={1}>{item.to.address}</Text>
          </View>
        </View>

        <View style={styles.driverInfoRowCompact}>
          <Image 
            source={{ uri: item.driverAvatar || 'https://ui-avatars.com/api/?name=' + item.driverName }} 
            style={styles.driverSmallAvatar} 
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.driverSmallName, { color: theme.colors.text }]}>{item.driverName}</Text>
            <View style={styles.miniRating}>
              <Star size={11} color={theme.colors.warning} fill={theme.colors.warning} />
              <Text style={[styles.miniRatingText, { color: theme.colors.textSecondary }]}>{item.driverRating}</Text>
            </View>
          </View>
          <View style={styles.timeSeatsInfo}>
            <Text style={[styles.rideTimeText, { color: theme.colors.text }]}>{item.time}</Text>
            <Text style={[styles.seatsLeftText, { color: theme.colors.success }]}>{item.availableSeats} Seats Left</Text>
          </View>
        </View>

        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />

        <View style={styles.cardFeaturesRow}>
          <Text style={[styles.cardFeaturesText, { color: theme.colors.textSecondary }]}>
            {getRideFeatureString(item)}
          </Text>
          <View style={styles.badgesWrapper}>
            {item.isDriverVerified && (
              <View style={[styles.miniBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                <Text style={[styles.miniBadgeText, { color: theme.colors.primary }]}>Verified</Text>
              </View>
            )}
            {item.preferences.petsAllowed && (
              <View style={[styles.miniBadge, { backgroundColor: theme.colors.accent + '15' }]}>
                <Text style={[styles.miniBadgeText, { color: theme.colors.accent }]}>Pet Friendly</Text>
              </View>
            )}
            {item.preferences.nonSmoking && (
              <View style={[styles.miniBadge, { backgroundColor: theme.colors.success + '15' }]}>
                <Text style={[styles.miniBadgeText, { color: theme.colors.success }]}>Non-Smoking</Text>
              </View>
            )}
            <View style={[styles.miniBadge, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
              <Text style={[styles.miniBadgeText, { color: theme.colors.textSecondary }]}>
                Chat: {item.preferences.conversationLevel}
              </Text>
            </View>
          </View>
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              onPress={() => setShowSortModal(true)}
              style={[styles.filterBtn, { borderColor: theme.colors.border }]}
            >
              <ArrowUpDown size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setShowFilters(true)}
              style={[styles.filterBtn, { borderColor: theme.colors.border }]}
            >
              <Filter size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
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

          {/* Row for Date and Passenger selection */}
          <View style={styles.searchDetailsRow}>
            <View style={styles.dateInputWrapper}>
              <DatePicker
                value={selectedDate}
                onDateChange={setSelectedDate}
                style={styles.dateInput}
              />
            </View>
            <View style={[styles.stepperInputWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Users size={16} color={theme.colors.primary} />
              <View style={styles.stepperControlRow}>
                <TouchableOpacity
                  style={styles.stepperMiniBtn}
                  onPress={() => {
                    const newCount = Math.max(1, passengerCount - 1);
                    setPassengerCount(newCount);
                    setMinSeats(newCount);
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontWeight: '700' }}>-</Text>
                </TouchableOpacity>
                <Text style={{ color: theme.colors.text, fontWeight: '700', marginHorizontal: 6 }}>{passengerCount}</Text>
                <TouchableOpacity
                  style={styles.stepperMiniBtn}
                  onPress={() => {
                    const newCount = Math.min(8, passengerCount + 1);
                    setPassengerCount(newCount);
                    setMinSeats(newCount);
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontWeight: '700' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.mainSearchBtn, { backgroundColor: theme.colors.primary }]}
            onPress={performSearch}
          >
            <Search size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.mainSearchBtnText}>Search Rides</Text>
          </TouchableOpacity>
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
            data={getFilteredAndSortedRides()}
            keyExtractor={(item) => item.id}
            renderItem={renderRide}
            contentContainerStyle={styles.listPadding}
            ListEmptyComponent={
              <View style={styles.centerBox}>
                <Map size={64} color={theme.colors.border} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No rides found</Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                  We couldn't find any rides matching your criteria. Try applying different filters.
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

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Vehicle Type */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Vehicle Type</Text>
                <View style={styles.filterChipsRow}>
                  {['Car', 'Bike', 'Bus', 'Van', 'EV'].map(cat => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.filterChip,
                          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                          isSelected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' }
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedCategories(selectedCategories.filter(c => c !== cat));
                          } else {
                            setSelectedCategories([...selectedCategories, cat]);
                          }
                        }}
                      >
                        <Text style={[styles.filterChipText, { color: isSelected ? theme.colors.primary : theme.colors.text }]}>
                          {cat === 'Car' ? '🚗 Car' : cat === 'Bike' ? '🏍 Bike' : cat === 'Bus' ? '🚌 Bus' : cat === 'Van' ? '🚐 Van' : '⚡ EV'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Comfort Features */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Comfort Features</Text>
                <View style={styles.filterChipsRow}>
                  {[
                    { id: 'ac', name: 'AC' },
                    { id: 'charging_port', name: 'Charging Port' },
                    { id: 'music', name: 'Music' },
                    { id: 'wifi', name: 'WiFi' },
                    { id: 'luggage_space', name: 'Luggage Space' }
                  ].map(feat => {
                    const isSelected = selectedComfort.includes(feat.id);
                    return (
                      <TouchableOpacity
                        key={feat.id}
                        style={[
                          styles.filterChip,
                          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                          isSelected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' }
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedComfort(selectedComfort.filter(f => f !== feat.id));
                          } else {
                            setSelectedComfort([...selectedComfort, feat.id]);
                          }
                        }}
                      >
                        <Text style={[styles.filterChipText, { color: isSelected ? theme.colors.primary : theme.colors.text }]}>
                          {feat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Safety Preferences */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Safety Preferences</Text>
                <View style={styles.filterCheckboxList}>
                  {['Verified Driver', 'Verified Vehicle', 'Women Friendly'].map(pref => {
                    const isSelected = selectedSafety.includes(pref);
                    return (
                      <TouchableOpacity
                        key={pref}
                        style={[styles.checkboxRow, { borderColor: theme.colors.border }]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedSafety(selectedSafety.filter(s => s !== pref));
                          } else {
                            setSelectedSafety([...selectedSafety, pref]);
                          }
                        }}
                      >
                        <View style={[styles.checkboxBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }, isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                          {isSelected && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>}
                        </View>
                        <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>{pref}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Experience Preferences */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Ride Experience</Text>
                <View style={styles.filterCheckboxList}>
                  {['Quiet Ride', 'Chat Friendly', 'Pet Friendly'].map(pref => {
                    const isSelected = selectedExperience.includes(pref);
                    return (
                      <TouchableOpacity
                        key={pref}
                        style={[styles.checkboxRow, { borderColor: theme.colors.border }]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedExperience(selectedExperience.filter(e => e !== pref));
                          } else {
                            setSelectedExperience([...selectedExperience, pref]);
                          }
                        }}
                      >
                        <View style={[styles.checkboxBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }, isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                          {isSelected && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>}
                        </View>
                        <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>{pref}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Price Range */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Budget (Price Limit per Seat)</Text>
                <View style={styles.budgetRow}>
                  <TextInput
                    style={[styles.budgetInput, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                    keyboardType="numeric"
                    placeholder="Min Price"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={minPrice}
                    onChangeText={setMinPrice}
                  />
                  <Text style={{ color: theme.colors.text }}>to</Text>
                  <TextInput
                    style={[styles.budgetInput, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                    keyboardType="numeric"
                    placeholder="Max Price"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                  />
                </View>
              </View>

              {/* Departure Time */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Departure Time</Text>
                <View style={styles.filterChipsRow}>
                  {['Morning', 'Afternoon', 'Evening', 'Night'].map(slot => {
                    const isSelected = selectedTimeSlots.includes(slot);
                    return (
                      <TouchableOpacity
                        key={slot}
                        style={[
                          styles.filterChip,
                          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                          isSelected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' }
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedTimeSlots(selectedTimeSlots.filter(s => s !== slot));
                          } else {
                            setSelectedTimeSlots([...selectedTimeSlots, slot]);
                          }
                        }}
                      >
                        <Text style={[styles.filterChipText, { color: isSelected ? theme.colors.primary : theme.colors.text }]}>
                          {slot === 'Morning' ? '🌅 Morning' : slot === 'Afternoon' ? '☀️ Afternoon' : slot === 'Evening' ? '🌇 Evening' : '🌙 Night'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.filterActionsRow}>
              <TouchableOpacity
                style={[styles.clearBtn, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setSelectedCategories([]);
                  setSelectedComfort([]);
                  setSelectedSafety([]);
                  setSelectedExperience([]);
                  setMinPrice('');
                  setMaxPrice('');
                  setSelectedTimeSlots([]);
                }}
              >
                <Text style={[styles.clearBtnText, { color: theme.colors.text }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.applyBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={showSortModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Sort Options</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {[
                'Recommended',
                'Lowest Price',
                'Highest Rating',
                'Earliest Departure',
                'Nearest Pickup',
                'Most Seats Available'
              ].map(opt => {
                const isSelected = sortBy === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.sortRow, { borderColor: theme.colors.border }]}
                    onPress={() => {
                      setSortBy(opt);
                      setShowSortModal(false);
                    }}
                  >
                    <Text style={[styles.sortText, { color: isSelected ? theme.colors.primary : theme.colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                      {opt}
                    </Text>
                    {isSelected && <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
  searchDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  dateInputWrapper: {
    flex: 1.2,
  },
  dateInput: {
    width: '100%',
  },
  stepperInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 12,
  },
  stepperControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  stepperMiniBtn: {
    padding: 8,
  },
  mainSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    marginTop: 4,
    width: '100%',
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
    gap: 12,
  },
  rideHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rideCategoryText: {
    fontSize: 16,
    fontWeight: '800',
  },
  priceTag: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  routeSection: {
    gap: 2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeVerticalLineMini: {
    width: 1.5,
    height: 12,
    marginLeft: 3.25,
    opacity: 0.5,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  driverInfoRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  driverSmallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  driverSmallName: {
    fontSize: 14,
    fontWeight: '700',
  },
  miniRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  miniRatingText: {
    fontSize: 11,
  },
  timeSeatsInfo: {
    alignItems: 'flex-end',
  },
  rideTimeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  seatsLeftText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  dividerLine: {
    height: 1,
    opacity: 0.15,
  },
  cardFeaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFeaturesText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badgesWrapper: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '600',
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
    padding: 24,
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
    fontWeight: '800',
  },
  filterGroup: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterCheckboxList: {
    gap: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  budgetInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '600',
  },
  filterActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  clearBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 2,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sortText: {
    fontSize: 15,
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