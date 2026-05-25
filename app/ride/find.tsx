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
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRides, Ride } from '@/contexts/RideContext';
import { Search, MapPin, Calendar, Clock, Star, Users, Filter, ArrowLeft, X, DollarSign, ChevronRight } from 'lucide-react-native';
import DatePicker from '@/components/DatePicker';
import PreferencesSelector, { RidePreferences } from '@/components/PreferencesSelector';
import LocationPicker from '@/components/LocationPicker';

const { width } = Dimensions.get('window');

export default function FindRideScreen() {
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [searchResults, setSearchResults] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    priceRange: { min: 0, max: 200 },
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

  const { theme } = useTheme();
  const { searchRides } = useRides();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.from) setFromLocation(decodeURIComponent(params.from as string));
    if (params.to) setToLocation(decodeURIComponent(params.to as string));
    if (params.date) setSelectedDate(new Date(params.date as string));
    
    if (params.from && params.to) {
      setTimeout(handleSearch, 500);
    }
  }, [params]);

  const handleSearch = async () => {
    if (!fromLocation || !toLocation) {
      Alert.alert('Missing Information', 'Please enter both pickup and destination');
      return;
    }

    setIsLoading(true);
    try {
      const dateString = selectedDate ? selectedDate.toISOString().split('T')[0] : '';
      const simplify = (addr: string) => addr.split(',').slice(0, 2).join(',').trim();

      let results = await searchRides(simplify(fromLocation), simplify(toLocation), dateString, {
        seats: filters.minSeats,
        maxPrice: filters.priceRange.max,
        allowPets: filters.preferences.petsAllowed,
        allowMusic: filters.preferences.musicAllowed,
      });
      
      setSearchResults(results);
    } catch (error) {
      Alert.alert('Error', 'Failed to search rides. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllFilters = () => {
    setFilters({
      priceRange: { min: 0, max: 200 },
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

  const renderRide = ({ item }: { item: Ride }) => (
    <TouchableOpacity 
      style={[styles.rideCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={() => router.push(`/ride/details?id=${item.id}`)}
    >
      <View style={styles.rideHeader}>
        <View style={styles.driverInfo}>
          {item.driverAvatar ? (
            <Image source={{ uri: item.driverAvatar }} style={styles.driverAvatar} />
          ) : (
            <View style={[styles.driverAvatar, { backgroundColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' }]}>
              <Star size={20} color={theme.colors.textSecondary} />
            </View>
          )}
          <View style={styles.driverDetails}>
            <Text style={[styles.driverName, { color: theme.colors.text }]}>{item.driverName}</Text>
            <View style={styles.ratingContainer}>
              <Star size={14} color={theme.colors.warning} fill={theme.colors.warning} />
              <Text style={[styles.rating, { color: theme.colors.textSecondary }]}>{item.driverRating}</Text>
            </View>
          </View>
        </View>
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: theme.colors.primary }]}>${item.price}</Text>
          <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>/ seat</Text>
        </View>
      </View>

      <View style={styles.routeInfo}>
        <View style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: theme.colors.secondary }]} />
          <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
            {item.from.address}
          </Text>
        </View>
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
        <View style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: theme.colors.error }]} />
          <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
            {item.to.address}
          </Text>
        </View>
      </View>

      <View style={styles.rideFooter}>
        <View style={styles.footerDetails}>
          <View style={styles.detailItem}>
            <Calendar size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>{item.date}</Text>
          </View>
          <View style={styles.detailItem}>
            <Clock size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>{item.time}</Text>
          </View>
          <View style={styles.detailItem}>
            <Users size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>{item.availableSeats} left</Text>
          </View>
        </View>
        <ChevronRight size={20} color={theme.colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Find a Ride</Text>
          <TouchableOpacity 
            onPress={() => setShowFilters(true)}
            style={[styles.filterButton, { backgroundColor: theme.colors.primary + '15' }]}
          >
            <Filter size={20} color={theme.colors.primary} />
            {Object.values(filters.preferences).some(v => v) && (
              <View style={[styles.filterDot, { backgroundColor: theme.colors.primary }]} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchSection}>
          <LocationPicker
            value={fromLocation}
            onLocationChange={setFromLocation}
            placeholder="From"
            style={styles.locationPicker}
          />
          <LocationPicker
            value={toLocation}
            onLocationChange={setToLocation}
            placeholder="To"
            style={styles.locationPicker}
          />
          <View style={styles.searchRow}>
            <DatePicker
              value={selectedDate}
              onDateChange={setSelectedDate}
              placeholder="Pick Date"
              style={styles.datePicker}
            />
            <TouchableOpacity 
              style={[styles.searchAction, { backgroundColor: theme.colors.primary }]}
              onPress={handleSearch}
            >
              <Search size={20} color="#FFFFFF" />
              <Text style={styles.searchActionText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Finding best rides for you...</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderRide}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No rides found</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Try adjusting your search criteria or filters to find more results.
              </Text>
              <TouchableOpacity 
                style={[styles.clearButton, { borderColor: theme.colors.primary }]}
                onPress={clearAllFilters}
              >
                <Text style={[styles.clearButtonText, { color: theme.colors.primary }]}>Clear All Filters</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, { color: theme.colors.textSecondary }]}>Max Price</Text>
                <View style={styles.priceInputRow}>
                  <DollarSign size={16} color={theme.colors.textSecondary} />
                  <TextInput
                    style={[styles.priceInput, { color: theme.colors.text }]}
                    value={filters.priceRange.max.toString()}
                    onChangeText={(val) => setFilters(p => ({...p, priceRange: {...p.priceRange, max: parseInt(val) || 0}}))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <PreferencesSelector
                preferences={filters.preferences as any}
                onPreferencesChange={(p) => setFilters(prev => ({ ...prev, preferences: p as any }))}
                mode="passenger"
              />

              <View style={{ height: 40 }} />
            </ScrollView>

            <TouchableOpacity 
              style={[styles.applyButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                setShowFilters(false);
                handleSearch();
              }}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  filterButton: {
    padding: 10,
    borderRadius: 10,
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  searchSection: {
    gap: 12,
  },
  locationPicker: {
    zIndex: 100,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
  },
  datePicker: {
    flex: 1,
  },
  searchAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  searchActionText: {
    color: '#FFFFFF',
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
    justifyContent: 'space-between',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceLabel: {
    fontSize: 12,
  },
  routeInfo: {
    paddingLeft: 4,
    gap: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  line: {
    width: 2,
    height: 12,
    marginLeft: 3,
  },
  locationText: {
    fontSize: 14,
    flex: 1,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  clearButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearButtonText: {
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterSection: {
    gap: 12,
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    gap: 10,
  },
  priceInput: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  applyButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});