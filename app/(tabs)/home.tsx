import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRides } from '@/contexts/RideContext';
import {
  Search,
  Plus,
  Car,
  MapPin,
  Clock,
  Star,
  Moon,
  Sun,
  ArrowUpDown,
  Calendar,
  Award,
  Coins,
  ChevronRight,
  Bell,
  Navigation,
  Home as HomeIcon,
  Briefcase,
  Heart,
} from 'lucide-react-native';
import LocationPicker from '@/components/LocationPicker';
import { api } from '@/utils/api';

const { width } = Dimensions.get('window');

// Mock Quick Routes shortcuts for user convenience
const QUICK_ROUTES = [
  { id: 'qr1', from: 'Springfield Mall', to: 'Metropolis Airport', label: 'Mall ➔ Airport ✈️' },
  { id: 'qr2', from: 'Campus Library', to: 'Downtown Transit Center', label: 'Campus ➔ Downtown 🏙️' },
  { id: 'qr3', from: 'Sector 5 Corporate Park', to: 'Greenwood Heights', label: 'Office ➔ Home 🏠' },
];

export default function HomeScreen() {
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [displayDate, setDisplayDate] = useState('');
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const { theme, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { rides } = useRides();
  const router = useRouter();

  interface SavedLocation {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    type: 'Home' | 'Work' | 'Favorite' | 'Other';
  }

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

  useEffect(() => {
    fetchSavedLocations();
  }, []);

  const fetchSavedLocations = async () => {
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
      console.warn('Failed to fetch saved locations in HomeScreen:', error);
    }
  };

  const handleFrequentlyTraveledSelect = (location: SavedLocation) => {
    setToLocation(location.address);
    
    // Navigate to find ride
    router.push({
      pathname: '/ride/find',
      params: {
        from: fromLocation || 'Current Location',
        to: location.address,
        toLat: location.latitude?.toString(),
        toLon: location.longitude?.toString(),
        date: selectedDate,
      },
    });
  };

  const getLocationIcon = (type: SavedLocation['type']) => {
    switch (type) {
      case 'Home': return <HomeIcon size={20} color={theme.colors.primary} />;
      case 'Work': return <Briefcase size={20} color={theme.colors.secondary} />;
      case 'Favorite': return <Heart size={20} color={theme.colors.accent} />;
      default: return <MapPin size={20} color={theme.colors.textSecondary} />;
    }
  };

  const handleSearch = () => {
    if (!fromLocation || !toLocation) {
      Alert.alert('Incomplete Search', 'Please provide both start and end locations.');
      return;
    }

    router.push({
      pathname: '/ride/find',
      params: {
        from: fromLocation,
        to: toLocation,
        date: selectedDate,
      },
    });
  };

  const handleOfferRide = () => {
    router.push('/ride/offer');
  };

  const handleSwapLocations = () => {
    const temp = fromLocation;
    setFromLocation(toLocation);
    setToLocation(temp);
  };

  const handleQuickRouteSelect = (route: typeof QUICK_ROUTES[0]) => {
    setFromLocation(route.from);
    setToLocation(route.to);
    
    // Auto-scroll slightly or alert user that fields are filled
    Alert.alert(
      'Route Pre-filled',
      `Set route: ${route.from} ➔ ${route.to}`,
      [
        { text: 'Search Now', onPress: () => {
          router.push({
            pathname: '/ride/find',
            params: {
              from: route.from,
              to: route.to,
              date: selectedDate,
            },
          });
        }},
        { text: 'Edit', style: 'cancel' }
      ]
    );
  };

  const showDatePicker = () => {
    setDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisible(false);
  };

  const handleConfirmDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const formattedQueryDate = `${year}-${month}-${day}`;
    setSelectedDate(formattedQueryDate);

    // Readable display date: "May 31, 2026"
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    setDisplayDate(date.toLocaleDateString('en-US', options));
    
    hideDatePicker();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return theme.colors.success;
      case 'started': return theme.colors.secondary;
      case 'completed': return theme.colors.textSecondary;
      case 'cancelled': return theme.colors.error;
      default: return theme.colors.textSecondary;
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Premium Header with Linear Gradient */}
      <LinearGradient
        colors={isDark ? ['#1e293b', '#0f172a'] : [theme.colors.primary, theme.colors.primaryDark]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.userInfoWrapper}>
              <Image
                source={{
                  uri: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80',
                }}
                style={[styles.headerAvatar, { borderColor: theme.colors.card }]}
              />
              <View>
                <Text style={styles.greeting}>Hello, {user?.fullName.split(' ')[0]}! 👋</Text>
                <Text style={styles.subtitle}>Where are we heading today?</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerIconButton}>
                <Bell size={20} color="#FFFFFF" />
                <View style={[styles.badgeDot, { backgroundColor: theme.colors.error }]} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={toggleTheme} style={styles.headerIconButton}>
                {isDark ? (
                  <Sun size={20} color="#FFFFFF" />
                ) : (
                  <Moon size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.mainContent}>
        {/* Search Card Section */}
        <View style={[styles.searchCard, { backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow }]}>
          <Text style={[styles.searchCardTitle, { color: theme.colors.text }]}>Book a Ride</Text>
          
          <View style={styles.inputsWrapper}>
            {/* Start location */}
            <View style={styles.pickerRow}>
              <View style={[styles.dotIndicator, { backgroundColor: theme.colors.secondary }]} />
              <LocationPicker
                value={fromLocation}
                onLocationChange={(loc) => setFromLocation(loc)}
                placeholder="Where from? (pickup)"
                style={styles.locationInput}
                showIcon={false}
              />
            </View>

            {/* Middle Divider with Swap Button Overlay */}
            <View style={styles.dividerRow}>
              <View style={[styles.routeVerticalLine, { backgroundColor: theme.colors.border }]} />
              <TouchableOpacity
                style={[styles.swapButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}
                onPress={handleSwapLocations}
                activeOpacity={0.7}
              >
                <ArrowUpDown size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Destination location */}
            <View style={styles.pickerRow}>
              <View style={[styles.dotIndicator, { backgroundColor: theme.colors.error }]} />
              <LocationPicker
                value={toLocation}
                onLocationChange={(loc) => setToLocation(loc)}
                placeholder="Where to? (destination)"
                style={styles.locationInput}
                showIcon={false}
              />
            </View>

            {/* Travel Date Picker Field */}
            <TouchableOpacity
              style={[styles.dateSelectorField, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={showDatePicker}
              activeOpacity={0.7}
            >
              <Calendar size={18} color={theme.colors.primary} />
              <Text style={[styles.dateText, { color: displayDate ? theme.colors.text : theme.colors.textSecondary }]}>
                {displayDate || 'Select travel date (optional)'}
              </Text>
              {displayDate ? (
                <TouchableOpacity onPress={() => { setDisplayDate(''); setSelectedDate(''); }}>
                  <Plus size={16} color={theme.colors.textSecondary} style={{ transform: [{ rotate: '45deg' }] }} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.searchButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleSearch}
            activeOpacity={0.8}
          >
            <Search size={18} color="#FFFFFF" />
            <Text style={styles.searchButtonText}>Find Rides</Text>
          </TouchableOpacity>
        </View>

        {/* Modal Date Picker */}
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirmDate}
          onCancel={hideDatePicker}
          minimumDate={new Date()}
          themeVariant={isDark ? 'dark' : 'light'}
        />

        {/* Quick Action Premium Grid Tiles */}
        <View style={styles.quickGrid}>
          <TouchableOpacity
            style={[styles.gridTile, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary + '30' }]}
            onPress={() => router.push('/ride/find')}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: theme.colors.primary }]}>
              <Car size={20} color="#FFFFFF" />
            </View>
            <View style={styles.gridTextContainer}>
              <Text style={[styles.gridTileTitle, { color: theme.colors.text }]}>Find a Ride</Text>
              <Text style={[styles.gridTileDesc, { color: theme.colors.textSecondary }]}>Join a trip and save money</Text>
            </View>
            <ChevronRight size={16} color={theme.colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridTile, { backgroundColor: theme.colors.secondary + '10', borderColor: theme.colors.secondary + '30' }]}
            onPress={handleOfferRide}
            activeOpacity={0.8}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: theme.colors.secondary }]}>
              <Plus size={20} color="#FFFFFF" />
            </View>
            <View style={styles.gridTextContainer}>
              <Text style={[styles.gridTileTitle, { color: theme.colors.text }]}>Offer a Ride</Text>
              <Text style={[styles.gridTileDesc, { color: theme.colors.textSecondary }]}>Share seats, split costs</Text>
            </View>
            <ChevronRight size={16} color={theme.colors.secondary} />
          </TouchableOpacity>
        </View>

        {/* Frequently Traveled Section */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Frequently Traveled</Text>
          {savedLocations.length === 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shortcutsContainer}
            >
              {QUICK_ROUTES.map((route) => (
                <TouchableOpacity
                  key={route.id}
                  style={[styles.shortcutChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  onPress={() => handleQuickRouteSelect(route)}
                  activeOpacity={0.7}
                >
                  <Navigation size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.shortcutChipText, { color: theme.colors.text }]}>{route.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.frequentList}>
              {savedLocations.slice(0, 5).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.frequentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  onPress={() => handleFrequentlyTraveledSelect(item)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.frequentIconContainer, { backgroundColor: theme.colors.surface }]}>
                    {getLocationIcon(item.type)}
                  </View>
                  <View style={styles.frequentInfo}>
                    <Text style={[styles.frequentName, { color: theme.colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.frequentAddress, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.rideButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => handleFrequentlyTraveledSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Car size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.rideButtonText}>Ride</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Recent Active Rides Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Available Rides Nearby</Text>
            <TouchableOpacity onPress={() => router.push('/ride/find')}>
              <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>

          {rides.length === 0 ? (
            <View style={[styles.emptyRidesCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Car size={32} color={theme.colors.textSecondary} style={{ opacity: 0.5, marginBottom: 8 }} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>No upcoming rides available right now.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ridesHorizontalScroll}
            >
              {rides.slice(0, 4).map((ride) => (
                <TouchableOpacity
                  key={ride.id}
                  style={[styles.premiumRideCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}
                  onPress={() => router.push(`/ride/details?id=${ride.id}`)}
                  activeOpacity={0.9}
                >
                  <View style={styles.rideCardHeader}>
                    <View style={styles.driverInfoRow}>
                      <Image source={{ uri: ride.driverAvatar }} style={styles.rideCardAvatar} />
                      <View>
                        <Text style={[styles.rideCardDriverName, { color: theme.colors.text }]} numberOfLines={1}>
                          {ride.driverName}
                        </Text>
                        <View style={styles.ratingBox}>
                          <Star size={12} color={theme.colors.warning} fill={theme.colors.warning} />
                          <Text style={[styles.ratingText, { color: theme.colors.textSecondary }]}>
                            {ride.driverRating}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.priceBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Text style={[styles.priceBadgeText, { color: theme.colors.primary }]}>
                        ₹{ride.price}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rideCardRoute}>
                    <View style={styles.routeItemRow}>
                      <View style={[styles.routeDotMini, { backgroundColor: theme.colors.secondary }]} />
                      <Text style={[styles.routeAddressText, { color: theme.colors.text }]} numberOfLines={1}>
                        {ride.from.address}
                      </Text>
                    </View>
                    <View style={[styles.routeLineMini, { backgroundColor: theme.colors.border }]} />
                    <View style={styles.routeItemRow}>
                      <View style={[styles.routeDotMini, { backgroundColor: theme.colors.error }]} />
                      <Text style={[styles.routeAddressText, { color: theme.colors.text }]} numberOfLines={1}>
                        {ride.to.address}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.rideCardFooter, { borderTopColor: theme.colors.border }]}>
                    <View style={styles.footerDetailRow}>
                      <Clock size={12} color={theme.colors.textSecondary} />
                      <Text style={[styles.footerDetailText, { color: theme.colors.textSecondary }]}>
                        {ride.date} • {ride.time}
                      </Text>
                    </View>
                    <Text style={[styles.footerSeatsText, { color: theme.colors.success, fontWeight: '600' }]}>
                      {ride.availableSeats} seats left
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Premium Dashboard Travel Stats Panel */}
        <View style={[styles.statsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
          <Text style={[styles.statsTitle, { color: theme.colors.text }]}>Your Travel Dashboard</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <View style={[styles.statIconWrapper, { backgroundColor: theme.colors.primary + '15' }]}>
                <Car size={18} color={theme.colors.primary} />
              </View>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                {user?.totalRides || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Trips</Text>
            </View>

            <View style={styles.statBox}>
              <View style={[styles.statIconWrapper, { backgroundColor: theme.colors.warning + '15' }]}>
                <Award size={18} color={theme.colors.warning} />
              </View>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                {user?.rating || '4.5'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>User Rating</Text>
            </View>

            <View style={styles.statBox}>
              <View style={[styles.statIconWrapper, { backgroundColor: theme.colors.success + '15' }]}>
                <Coins size={18} color={theme.colors.success} />
              </View>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                ₹245
              </Text>
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
    paddingTop: Platform.OS === 'ios' ? 64 : 50,
    paddingBottom: 48,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    paddingHorizontal: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  mainContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  searchCard: {
    padding: 20,
    borderRadius: 24,
    marginTop: -30,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    gap: 16,
  },
  searchCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  inputsWrapper: {
    gap: 0,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  locationInput: {
    flex: 1,
  },
  dividerRow: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginVertical: -8,
  },
  routeVerticalLine: {
    width: 1.5,
    height: '100%',
    marginLeft: 3.25,
    opacity: 0.5,
  },
  swapButton: {
    position: 'absolute',
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  dateSelectorField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 16,
  },
  dateText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 12,
  },
  gridTile: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  gridIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridTextContainer: {
    gap: 2,
  },
  gridTileTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  gridTileDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  sectionContainer: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
  shortcutsContainer: {
    gap: 8,
    paddingBottom: 4,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  shortcutChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ridesHorizontalScroll: {
    gap: 16,
    paddingBottom: 8,
  },
  emptyRidesCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumRideCard: {
    width: 290,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  rideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rideCardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
  },
  rideCardDriverName: {
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 120,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  ratingText: {
    fontSize: 12,
  },
  priceBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  priceBadgeText: {
    fontSize: 15,
    fontWeight: '800',
  },
  rideCardRoute: {
    gap: 4,
    paddingVertical: 4,
  },
  routeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDotMini: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  routeAddressText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  routeLineMini: {
    width: 1,
    height: 10,
    marginLeft: 2.5,
    opacity: 0.5,
  },
  rideCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerDetailText: {
    fontSize: 11,
  },
  footerSeatsText: {
    fontSize: 12,
  },
  statsCard: {
    marginTop: 32,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  frequentList: {
    gap: 12,
    marginTop: 8,
  },
  frequentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  frequentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frequentInfo: {
    flex: 1,
  },
  frequentName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  frequentAddress: {
    fontSize: 13,
  },
  rideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rideButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});