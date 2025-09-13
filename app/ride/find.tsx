import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRides } from '@/contexts/RideContext';
import { Search, MapPin, Calendar, Clock, Star, Users, Filter, ArrowLeft } from 'lucide-react-native';
import { mockRides } from '@/data/mockData';

export default function FindRideScreen() {
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [searchResults, setSearchResults] = useState(mockRides);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100 });
  
  const { theme } = useTheme();
  const { searchRides } = useRides();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.from) setFromLocation(decodeURIComponent(params.from as string));
    if (params.to) setToLocation(decodeURIComponent(params.to as string));
    if (params.date) setSelectedDate(params.date as string);
  }, [params]);

  const handleSearch = async () => {
    if (!fromLocation || !toLocation) {
      Alert.alert('Missing Information', 'Please enter both pickup and destination locations');
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchRides(fromLocation, toLocation, selectedDate);
      setSearchResults(results);
    } catch (error) {
      Alert.alert('Error', 'Failed to search rides. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
          <View style={[styles.searchInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <MapPin size={20} color={theme.colors.secondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="From"
              placeholderTextColor={theme.colors.textSecondary}
              value={fromLocation}
              onChangeText={setFromLocation}
            />
          </View>

          <View style={[styles.searchInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <MapPin size={20} color={theme.colors.error} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="To"
              placeholderTextColor={theme.colors.textSecondary}
              value={toLocation}
              onChangeText={setToLocation}
            />
          </View>

          <View style={[styles.searchInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Calendar size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor={theme.colors.textSecondary}
              value={selectedDate}
              onChangeText={setSelectedDate}
            />
          </View>

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
  },
  searchContainer: {
    gap: 12,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
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
});