import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRides } from '@/contexts/RideContext';
import { Search, MapPin, Calendar, Clock, Star, Users, Filter, ArrowLeft, X, DollarSign, CreditCard as Edit3, Check } from 'lucide-react-native';
import { mockRides } from '@/data/mockData';
import DatePicker from '@/components/DatePicker';
import LocationPicker from '@/components/LocationPicker';
import PreferencesSelector, { RidePreferences } from '@/components/PreferencesSelector';
import MapLocationSelector from '@/components/MapLocationSelector';

export default function FindRideScreen() {
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [searchResults, setSearchResults] = useState(mockRides);
  const [fromLocationData, setFromLocationData] = useState<any>(null);
  const [toLocationData, setToLocationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isEditingLocations, setIsEditingLocations] = useState(false);
  const [tempFromLocation, setTempFromLocation] = useState('');
  const [tempToLocation, setTempToLocation] = useState('');
  
  // Advanced filters
  const [filters, setFilters] = useState({
    priceRange: { min: 0, max: 100 },
    minSeats: 1,
    timeRange: { start: null as Date | null, end: null as Date | null },
    preferences: {
      nonSmoking: false,
      musicAllowed: false,
      petsAllowed: false,
      airConditioning: false,
      conversationLevel: 'moderate' as 'quiet' | 'moderate' | 'chatty',
    } as RidePreferences,
  });
  
  const { theme } = useTheme();
  const { searchRides } = useRides();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.from) setFromLocation(decodeURIComponent(params.from as string));
    if (params.to) setToLocation(decodeURIComponent(params.to as string));
    if (params.date) setSelectedDate(new Date(params.date as string));
    
    // Handle locations from map selection
    if (params.fromLocation) {
      const fromData = JSON.parse(params.fromLocation as string);
      setFromLocationData(fromData);
      setFromLocation(fromData.address);
    }
    if (params.toLocation) {
      const toData = JSON.parse(params.toLocation as string);
      setToLocationData(toData);
      setToLocation(toData.address);
    }
    
    // Auto-search if locations are provided from map
    if (params.fromMap === 'true' && params.fromLocation && params.toLocation) {
      handleSearch();
    }
  }, [params]);

  const handleEditLocations = () => {
    setTempFromLocation(fromLocation);
    setTempToLocation(toLocation);
    setIsEditingLocations(true);
  };

  const handleSaveLocations = () => {
    if (!tempFromLocation || !tempToLocation) {
      Alert.alert('Missing Information', 'Please enter both pickup and destination locations');
      return;
    }
    
    setFromLocation(tempFromLocation);
    setToLocation(tempToLocation);
    setIsEditingLocations(false);
    
    // Auto-search with new locations
    handleSearch();
  };

  const handleCancelEdit = () => {
    setTempFromLocation(fromLocation);
    setTempToLocation(toLocation);
    setIsEditingLocations(false);
  };
  const handleSearch = async () => {
    if (!fromLocation || !toLocation) {
      Alert.alert('Missing Information', 'Please enter both pickup and destination locations');
      return;
    }

    setIsLoading(true);
    try {
      const dateString = selectedDate ? selectedDate.toLocaleDateString() : '';
      let results = await searchRides(fromLocation, toLocation, dateString);
      
      // Apply filters
      results = applyFilters(results);
      setSearchResults(results);
    } catch (error) {
      Alert.alert('Error', 'Failed to search rides. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = (rides: any[]) => {
    return rides.filter(ride => {
      // Price filter
      if (ride.price < filters.priceRange.min || ride.price > filters.priceRange.max) {
        return false;
      }
      
      // Seats filter
      if (ride.availableSeats < filters.minSeats) {
        return false;
      }
      
      // Time range filter
      if (filters.timeRange.start && filters.timeRange.end) {
        const [rideHour, rideMinute] = ride.time.split(':').map(Number);
        const rideTimeMinutes = rideHour * 60 + rideMinute;
        
        const startTimeMinutes = filters.timeRange.start.getHours() * 60 + filters.timeRange.start.getMinutes();
        const endTimeMinutes = filters.timeRange.end.getHours() * 60 + filters.timeRange.end.getMinutes();
        
        if (rideTimeMinutes < startTimeMinutes || rideTimeMinutes > endTimeMinutes) {
          return false;
        }
      }
      
      // Preferences filter
      const { preferences } = filters;
      if (preferences.nonSmoking && !ride.preferences?.nonSmoking) return false;
      if (preferences.musicAllowed && !ride.preferences?.musicAllowed) return false;
      if (preferences.petsAllowed && !ride.preferences?.petsAllowed) return false;
      if (preferences.airConditioning && !ride.preferences?.airConditioning) return false;
      
      return true;
    });
  };

  const clearAllFilters = () => {
    setFilters({
      priceRange: { min: 0, max: 100 },
      minSeats: 1,
      timeRange: { start: null, end: null },
      preferences: {
        nonSmoking: false,
        musicAllowed: false,
        petsAllowed: false,
        airConditioning: false,
        conversationLevel: 'moderate',
      },
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.priceRange.min > 0 || filters.priceRange.max < 100) count++;
    if (filters.minSeats > 1) count++;
    if (filters.timeRange.start || filters.timeRange.end) count++;
    const prefValues = Object.values(filters.preferences);
    if (prefValues.some(v => v !== false && v !== 'moderate')) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();
  const renderRide = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.rideCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={() => router.push(`/ride/details?id=${item.id}`)}
    >
      <View style={styles.rideHeader}>
        <Image source={{ uri: item.driverAvatar }} style={styles.driverAvatar} />
        <View style={styles.rideInfo}>
          <Text style={[styles.driverName, { color: theme.colors.text }]}>{item.driverName}</Text>
          <View style={styles.ratingContainer}>
            <Star size={14} color={theme.colors.warning} fill={theme.colors.warning} />
            <Text style={[styles.rating, { color: theme.colors.textSecondary }]}>{item.driverRating}</Text>
            <Text style={[styles.carInfo, { color: theme.colors.textSecondary }]}>
              • {item.carModel}
            </Text>
          </View>
        </View>
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: theme.colors.primary }]}>${item.price}</Text>
          <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>per seat</Text>
        </View>
      </View>
      
      <View style={styles.routeInfo}>
        <View style={styles.locationRow}>
          <MapPin size={16} color={theme.colors.secondary} />
          <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
            {item.from.address}
          </Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.locationRow}>
          <MapPin size={16} color={theme.colors.error} />
          <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
            {item.to.address}
          </Text>
        </View>
      </View>

      <View style={styles.rideDetails}>
        <View style={styles.detailItem}>
          <Calendar size={14} color={theme.colors.textSecondary} />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {item.date}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Clock size={14} color={theme.colors.textSecondary} />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {item.time}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Users size={14} color={theme.colors.textSecondary} />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {item.availableSeats} seats
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.bookButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push(`/ride/book?id=${item.id}`)}
      >
        <Text style={styles.bookButtonText}>Book Ride</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Find Rides</Text>
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterButton}>
            <Filter size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <MapLocationSelector
            fromLocation={fromLocationData}
            toLocation={toLocationData}
            onLocationsSelected={(from, to) => {
              setFromLocationData(from);
              setToLocationData(to);
              setFromLocation(from.address);
              setToLocation(to.address);
            }}
          />

          {/* Editable Location Display */}
          <View style={[styles.locationDisplayContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.locationDisplayHeader}>
              <Text style={[styles.locationDisplayTitle, { color: theme.colors.text }]}>
                Search Route
              </Text>
              <TouchableOpacity 
                style={[styles.editLocationButton, { backgroundColor: theme.colors.primary + '20' }]}
                onPress={handleEditLocations}
              >
                <Edit3 size={16} color={theme.colors.primary} />
                <Text style={[styles.editLocationText, { color: theme.colors.primary }]}>
                  Edit
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.locationDisplay}>
              <View style={styles.locationRow}>
                <MapPin size={16} color={theme.colors.secondary} />
                <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
                  From: {fromLocation || 'Select pickup location'}
                </Text>
              </View>
              <View style={styles.locationRow}>
                <MapPin size={16} color={theme.colors.error} />
                <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
                  To: {toLocation || 'Select destination'}
                </Text>
              </View>
            </View>
          </View>

          <DatePicker
            value={selectedDate}
            onDateChange={setSelectedDate}
            placeholder="Select Date"
            minimumDate={new Date()}
          />

          <TouchableOpacity 
            style={[styles.searchButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Search size={20} color="#FFFFFF" />
                <Text style={styles.searchButtonText}>Search</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Location Edit Modal */}
      <Modal
        visible={isEditingLocations}
        transparent
        animationType="slide"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.editLocationModal, { backgroundColor: theme.colors.card }]}>
            <View style={styles.editModalHeader}>
              <Text style={[styles.editModalTitle, { color: theme.colors.text }]}>
                Edit Locations
              </Text>
              <TouchableOpacity onPress={handleCancelEdit}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.editModalContent}>
              <LocationPicker
                value={tempFromLocation}
                onLocationChange={setTempFromLocation}
                placeholder="From (pickup location)"
              />

              <LocationPicker
                value={tempToLocation}
                onLocationChange={setTempToLocation}
                placeholder="To (destination)"
              />

              <View style={styles.editModalActions}>
                <TouchableOpacity
                  style={[styles.cancelEditButton, { backgroundColor: theme.colors.surface }]}
                  onPress={handleCancelEdit}
                >
                  <Text style={[styles.cancelEditText, { color: theme.colors.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.saveEditButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSaveLocations}
                >
                  <Check size={20} color="#FFFFFF" />
                  <Text style={styles.saveEditText}>Update & Search</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      {/* Advanced Filters Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.filtersModal, { backgroundColor: theme.colors.card }]}>
            <View style={styles.filtersHeader}>
              <Text style={[styles.filtersTitle, { color: theme.colors.text }]}>
                Advanced Filters
              </Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filtersContent}>
              {/* Price Range */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterTitle, { color: theme.colors.text }]}>
                  Price Range
                </Text>
                <View style={styles.priceRange}>
                  <View style={[styles.priceInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <DollarSign size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.priceText, { color: theme.colors.text }]}>
                      {filters.priceRange.min}
                    </Text>
                  </View>
                  <Text style={[styles.priceRangeSeparator, { color: theme.colors.textSecondary }]}>to</Text>
                  <View style={[styles.priceInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <DollarSign size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.priceText, { color: theme.colors.text }]}>
                      {filters.priceRange.max}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Minimum Seats */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterTitle, { color: theme.colors.text }]}>
                  Minimum Available Seats
                </Text>
                <View style={styles.seatsSelector}>
                  {[1, 2, 3, 4].map(seats => (
                    <TouchableOpacity
                      key={seats}
                      style={[
                        styles.seatOption,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                        filters.minSeats === seats && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' },
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, minSeats: seats }))}
                    >
                      <Text style={[styles.seatOptionText, { color: theme.colors.text }]}>
                        {seats}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Time Range */}
              <View style={styles.filterSection}>
                <Text style={[styles.filterTitle, { color: theme.colors.text }]}>
                  Departure Time Range
                </Text>
                <View style={styles.timeRange}>
                  <DatePicker
                    value={filters.timeRange.start}
                    onDateChange={(time) => setFilters(prev => ({ ...prev, timeRange: { ...prev.timeRange, start: time } }))}
                    placeholder="Start Time"
                    mode="time"
                    style={styles.timeInput}
                  />
                  <DatePicker
                    value={filters.timeRange.end}
                    onDateChange={(time) => setFilters(prev => ({ ...prev, timeRange: { ...prev.timeRange, end: time } }))}
                    placeholder="End Time"
                    mode="time"
                    style={styles.timeInput}
                  />
                </View>
              </View>

              {/* Preferences */}
              <View style={styles.filterSection}>
                <PreferencesSelector
                  preferences={filters.preferences}
                  onPreferencesChange={(prefs) => setFilters(prev => ({ ...prev, preferences: prefs }))}
                  mode="passenger"
                />
              </View>
            </ScrollView>

            <View style={styles.filtersActions}>
              <TouchableOpacity
                style={[styles.clearFiltersButton, { backgroundColor: theme.colors.surface }]}
                onPress={clearAllFilters}
              >
                <Text style={[styles.clearFiltersText, { color: theme.colors.textSecondary }]}>
                  Clear All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyFiltersButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  setShowFilters(false);
                  handleSearch();
                }}
              >
                <Text style={styles.applyFiltersText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={renderRide}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No rides found</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              Try adjusting your search criteria or check back later
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  filterButton: {
    padding: 8,
    position: 'relative',
  },
  searchContainer: {
    gap: 12,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  locationDisplayContainer: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  locationDisplayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationDisplayTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  editLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
  },
  editLocationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationDisplay: {
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
  },
  editLocationModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  editModalContent: {
    padding: 20,
    gap: 16,
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelEditButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelEditText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveEditButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveEditText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    gap: 16,
  },
  rideCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  rideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  rideInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
  },
  carInfo: {
    fontSize: 14,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  priceLabel: {
    fontSize: 12,
  },
  routeInfo: {
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
  },
  locationText: {
    fontSize: 15,
    flex: 1,
    fontWeight: '500',
  },
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  detailText: {
    fontSize: 14,
  },
  bookButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filtersModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filtersTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  filtersContent: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  priceRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  priceText: {
    fontSize: 16,
  },
  priceRangeSeparator: {
    fontSize: 14,
  },
  seatsSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  seatOption: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
  },
  seatOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeRange: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  filtersActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  clearFiltersButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearFiltersText: {
    fontSize: 16,
    fontWeight: '600',
  },
  applyFiltersButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyFiltersText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});