import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRides } from '@/contexts/RideContext';
import { Search, Plus, Car, MapPin, Clock, Star, Moon, Sun } from 'lucide-react-native';
import { mockRides } from '@/data/mockData';

export default function HomeScreen() {
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  
  const { theme, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { rides } = useRides();
  const router = useRouter();

  const handleSearch = () => {
    if (!fromLocation || !toLocation) {
      Alert.alert('Missing Information', 'Please enter both pickup and destination locations');
      return;
    }
    router.push(`/ride/find?from=${encodeURIComponent(fromLocation)}&to=${encodeURIComponent(toLocation)}&date=${selectedDate}`);
  };

  const handleOfferRide = () => {
    router.push('/ride/offer');
  };

  const renderRecentRide = ({ item }: { item: any }) => (
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
          </View>
        </View>
        <Text style={[styles.price, { color: theme.colors.primary }]}>${item.price}</Text>
      </View>
      
      <View style={styles.routeInfo}>
        <View style={styles.locationRow}>
          <MapPin size={16} color={theme.colors.secondary} />
          <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
            {item.from.address}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <MapPin size={16} color={theme.colors.error} />
          <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
            {item.to.address}
          </Text>
        </View>
      </View>

      <View style={styles.rideDetails}>
        <View style={styles.detailItem}>
          <Clock size={14} color={theme.colors.textSecondary} />
          <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
            {item.date} • {item.time}
          </Text>
        </View>
        <Text style={[styles.seatsText, { color: theme.colors.textSecondary }]}>
          {item.availableSeats} seats available
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Hello, {user?.firstName}! 👋</Text>
              <Text style={styles.subtitle}>Where would you like to go today?</Text>
            </View>
            <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
              {isDark ? (
                <Sun size={24} color="#FFFFFF" />
              ) : (
                <Moon size={24} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.searchCard, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.searchInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MapPin size={20} color={theme.colors.secondary} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="From"
                placeholderTextColor={theme.colors.textSecondary}
                value={fromLocation}
                onChangeText={setFromLocation}
              />
            </View>

            <View style={[styles.searchInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MapPin size={20} color={theme.colors.error} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="To"
                placeholderTextColor={theme.colors.textSecondary}
                value={toLocation}
                onChangeText={setToLocation}
              />
            </View>

            <TouchableOpacity 
              style={[styles.searchButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSearch}
            >
              <Search size={20} color="#FFFFFF" />
              <Text style={styles.searchButtonText}>Search Rides</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]}
            onPress={handleOfferRide}
          >
            <Plus size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Offer Ride</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.accent }]}
            onPress={() => router.push('/ride/find')}
          >
            <Car size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Find Ride</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Rides</Text>
            <TouchableOpacity onPress={() => router.push('/ride/find')}>
              <Text style={[styles.sectionLink, { color: theme.colors.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={mockRides.slice(0, 3)}
            keyExtractor={(item) => item.id}
            renderItem={renderRecentRide}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ridesContainer}
          />
        </View>

        <View style={[styles.statsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.statsTitle, { color: theme.colors.text }]}>Your Travel Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.primary }]}>{user?.totalRides}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Rides</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.secondary }]}>{user?.rating}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Rating</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.accent }]}>$245</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Saved</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  themeToggle: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchCard: {
    padding: 20,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
  content: {
    padding: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionLink: {
    fontSize: 16,
    fontWeight: '600',
  },
  ridesContainer: {
    gap: 16,
  },
  rideCard: {
    width: 280,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  rideInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  routeInfo: {
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    flex: 1,
  },
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
  seatsText: {
    fontSize: 12,
  },
  statsCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
});