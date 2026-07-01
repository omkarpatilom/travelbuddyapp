import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useRides } from '@/contexts/RideContext';
import { CACHE_KEYS } from '@/cache/cacheKeys';
import { api } from '@/utils/api';
import { Users, IndianRupee, ArrowLeft } from 'lucide-react-native';
import { formatPrice } from '@/utils/validation';
import DatePicker from '@/components/DatePicker';
import LocationPicker from '@/components/LocationPicker';
import VehicleSelector from '@/components/VehicleSelector';
import PreferencesSelector, { RidePreferences } from '@/components/PreferencesSelector';
import MapLocationSelector from '@/components/MapLocationSelector';
import DropdownSelector from '@/components/DropdownSelector';


interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: string;
  color: string;
  licensePlate: string;
  seats: string;
  photos: string[];
  isDefault: boolean;
}

interface PricingSuggestion {
  suggestedRideCost: number;
  suggestedPricePerSeat: number;
  minPricePerSeat: number;
  maxPricePerSeat: number;
  distanceKm: number;
  durationMinutes: number;
  vehicleType: string;
  vehicleMultiplier: number;
}

export default function OfferRideScreen() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    from: '',
    fromCoords: { latitude: 0, longitude: 0 },
    to: '',
    toCoords: { latitude: 0, longitude: 0 },
    seats: '1',
    price: '',
    description: '',
  });
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [preferences, setPreferences] = useState<RidePreferences>({
    nonSmoking: true,
    musicAllowed: true,
    petsAllowed: false,
    airConditioning: true,
    conversationLevel: 'moderate',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingVehicles, setIsFetchingVehicles] = useState(true);

  const [pricingSuggestion, setPricingSuggestion] = useState<PricingSuggestion | null>(null);
  const [isFetchingPricing, setIsFetchingPricing] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  
  const { theme } = useTheme();
  const { createRide } = useRides();
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const fetchPricingSuggestion = async () => {
      if (
        !formData.fromCoords.latitude ||
        !formData.fromCoords.longitude ||
        !formData.toCoords.latitude ||
        !formData.toCoords.longitude ||
        !selectedVehicle
      ) {
        return;
      }

      setIsFetchingPricing(true);
      setPricingError(null);
      try {
        const query = `?vehicleId=${selectedVehicle.id}&fromLat=${formData.fromCoords.latitude}&fromLng=${formData.fromCoords.longitude}&toLat=${formData.toCoords.latitude}&toLng=${formData.toCoords.longitude}&seats=${formData.seats}&tollAdjustment=0`;
        const data = await api.get<PricingSuggestion>(`/pricing/suggest${query}`);
        setPricingSuggestion(data);
        
        if (!formData.price) {
          setFormData(prev => ({ ...prev, price: data.suggestedPricePerSeat.toString() }));
        }
      } catch (error: any) {
        console.error('Error fetching pricing suggestion:', error);
        setPricingError(error.message || 'Failed to fetch suggested pricing');
      } finally {
        setIsFetchingPricing(false);
      }
    };

    fetchPricingSuggestion();
  }, [formData.fromCoords.latitude, formData.fromCoords.longitude, formData.toCoords.latitude, formData.toCoords.longitude, selectedVehicle, formData.seats]);

  const getCategoryAndValidation = () => {
    if (!pricingSuggestion || !formData.price) return { category: null, isValid: true, error: null };
    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum)) return { category: null, isValid: true, error: null };

    if (priceNum < pricingSuggestion.minPricePerSeat) {
      return { 
        category: null, 
        isValid: false, 
        error: `Price must be at least ₹${pricingSuggestion.minPricePerSeat}` 
      };
    }
    if (priceNum > pricingSuggestion.maxPricePerSeat) {
      return { 
        category: null, 
        isValid: false, 
        error: `Price cannot exceed ₹${pricingSuggestion.maxPricePerSeat}` 
      };
    }

    const suggested = pricingSuggestion.suggestedPricePerSeat;
    let category: 'Budget' | 'Standard' | 'Premium' = 'Standard';
    if (priceNum <= suggested) {
      category = 'Budget';
    } else if (priceNum <= suggested * 1.2) {
      category = 'Standard';
    } else {
      category = 'Premium';
    }

    return { category, isValid: true, error: null };
  };

  const { category: currentCategory, isValid: isPriceValid, error: priceValidationError } = getCategoryAndValidation();

  useEffect(() => {
    fetchVehicles();
    fetchDefaultPreferences();
  }, []);

  const fetchDefaultPreferences = async () => {
    try {
      const data = await api.get<any>('/preferences');
      if (data) {
        setPreferences({
          nonSmoking: !data.allowSmoking,
          musicAllowed: data.allowMusic,
          petsAllowed: data.allowPets,
          airConditioning: data.comfortAmenities?.includes('ac') ?? true,
          conversationLevel: data.conversationLevel?.toLowerCase() === 'quiet' ? 'quiet' : 
                             data.conversationLevel?.toLowerCase() === 'chatty' ? 'chatty' : 'moderate',
        });
      }
    } catch (error) {
      console.warn('Failed to load default preferences:', error);
    }
  };

  useEffect(() => {
    if (selectedVehicle) {
      const capacity = parseInt(selectedVehicle.seats) || 4;
      const defaultAvailable = Math.max(1, capacity - 1);
      setFormData(prev => ({ ...prev, seats: defaultAvailable.toString() }));
    }
  }, [selectedVehicle]);

  const getSeatOptions = () => {
    if (!selectedVehicle) return ['1'];
    const capacity = parseInt(selectedVehicle.seats) || 4;
    const maxAvailable = Math.max(1, capacity - 1);
    const options = [];
    for (let i = 1; i <= maxAvailable; i++) {
      options.push(i.toString());
    }
    return options;
  };

  const fetchVehicles = async () => {
    try {
      const data = await api.get<any[]>('/vehicles/my-vehicles');
      const mappedVehicles = await Promise.all(data.map(async (v: any) => {
        let photos: string[] = [];
        try {
          const photoData = await api.get<any[]>(`/VehiclePhotos/${v.id}/photos`);
          photos = photoData.map(p => p.fileUrl);
        } catch (e) { console.error('Error fetching photos', e); }

        return {
          id: v.id,
          make: v.brand,
          model: v.model,
          year: new Date(v.createdAt).getFullYear().toString(),
          color: v.color,
          licensePlate: v.registrationNumber,
          seats: v.totalSeats.toString(),
          photos,
          isDefault: v.isDefault,
        };
      }));
      setVehicles(mappedVehicles);
      const defaultVehicle = mappedVehicles.find(v => v.isDefault) || mappedVehicles[0];
      if (defaultVehicle) setSelectedVehicle(defaultVehicle);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setIsFetchingVehicles(false);
    }
  };

  const updateLocationData = (field: 'from' | 'to', location: string, coordinates?: { latitude: number; longitude: number }) => {
    setFormData(prev => ({ 
      ...prev, 
      [field]: location,
      [`${field}Coords`]: coordinates || prev[`${field}Coords` as keyof typeof prev]
    }));
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.from || !formData.to) {
      Alert.alert('Missing Information', 'Please enter pickup and destination locations');
      return false;
    }
    
    if (formData.fromCoords.latitude === 0 || formData.toCoords.latitude === 0) {
      Alert.alert('Location Error', 'Please select a specific location from the dropdown suggestions.');
      return false;
    }

    if (!selectedDate || !selectedTime) {
      Alert.alert('Missing Information', 'Please select date and time');
      return false;
    }

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    maxDate.setHours(23, 59, 59, 999);
    if (selectedDate > maxDate) {
      Alert.alert('Invalid Date', 'You can only schedule rides up to 30 days in advance.');
      return false;
    }
    
    if (!formData.seats || !formData.price) {
      Alert.alert('Missing Information', 'Please enter seats and price');
      return false;
    }
    
    if (!selectedVehicle) {
      Alert.alert('Missing Information', 'Please select a vehicle');
      return false;
    }

    if (parseInt(formData.seats) < 1 || parseInt(formData.seats) > 8) {
      Alert.alert('Invalid Seats', 'Number of seats must be between 1 and 8');
      return false;
    }

    if (parseFloat(formData.price) < 50) {
      Alert.alert('Invalid Price', 'Price must be at least ₹ 50');
      return false;
    }

    if (pricingSuggestion) {
      const priceNum = parseFloat(formData.price);
      if (priceNum < pricingSuggestion.minPricePerSeat || priceNum > pricingSuggestion.maxPricePerSeat) {
        Alert.alert('Invalid Price', `Your price must be between ₹${pricingSuggestion.minPricePerSeat} and ₹${pricingSuggestion.maxPricePerSeat}.`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const rideData = {
        vehicleId: selectedVehicle!.id,
        from: {
          address: formData.from,
          coordinates: formData.fromCoords
        },
        to: {
          address: formData.to,
          coordinates: formData.toCoords
        },
        date: selectedDate!.toISOString().split('T')[0], // YYYY-MM-DD
        time: selectedTime!.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), // HH:mm
        availableSeats: parseInt(formData.seats),
        totalSeats: parseInt(formData.seats),
        price: parseFloat(formData.price),
        carModel: `${selectedVehicle!.make} ${selectedVehicle!.model}`,
        carColor: selectedVehicle!.color,
        preferences,
      };

      console.log('[DEBUG] offer.tsx: Submitting ride creation:', rideData);
      const success = await createRide(rideData);
      console.log('[DEBUG] offer.tsx: Ride creation result:', success);

      if (success) {
        // Force-invalidate my-rides cache to ensure the new ride appears immediately
        await queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.rides, 'my-rides'] });
        await queryClient.refetchQueries({ queryKey: [CACHE_KEYS.rides, 'my-rides'] });
        console.log('[DEBUG] offer.tsx: my-rides cache invalidated and refetched');
        Alert.alert('Success', 'Your ride has been posted successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', 'Failed to create ride. Please try again.');
      }
    } catch (error) {
      console.error('[DEBUG] offer.tsx: Error during ride creation:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetchingVehicles) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Offer a Ride</Text>
          <View style={styles.placeholder} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Route Details</Text>
          
          <MapLocationSelector
            fromLocation={{ address: formData.from, ...formData.fromCoords }}
            toLocation={{ address: formData.to, ...formData.toCoords }}
            onLocationsSelected={(from, to) => {
              updateLocationData('from', from.address, { latitude: from.latitude, longitude: from.longitude });
              updateLocationData('to', to.address, { latitude: to.latitude, longitude: to.longitude });
            }}
          />

          <LocationPicker
            value={formData.from}
            onLocationChange={(loc, coords) => updateLocationData('from', loc, coords)}
            placeholder="From (pickup location)"
          />

          <LocationPicker
            value={formData.to}
            onLocationChange={(loc, coords) => updateLocationData('to', loc, coords)}
            placeholder="To (destination)"
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Schedule</Text>
          
          <View style={styles.row}>
            <DatePicker
              value={selectedDate}
              onDateChange={setSelectedDate}
              placeholder="Select Date"
              minimumDate={new Date()}
              maximumDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
              style={styles.halfWidth}
            />

            <DatePicker
              value={selectedTime}
              onDateChange={setSelectedTime}
              placeholder="Select Time"
              mode="time"
              style={styles.halfWidth}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Vehicle Selection</Text>
          
          <VehicleSelector
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            onVehicleSelect={setSelectedVehicle}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ride Details</Text>
          
          <View style={styles.row}>
            <DropdownSelector
              style={styles.halfWidth}
              value={formData.seats}
              options={getSeatOptions()}
              onValueChange={(value) => updateFormData('seats', value)}
              icon={<Users size={20} color={theme.colors.textSecondary} />}
              placeholder="Seats"
            />

            <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <IndianRupee size={20} color={theme.colors.textSecondary} />
              <TouchableOpacity 
                style={styles.priceSelector}
                onPress={() => {
                  Alert.prompt(
                    'Price per Seat',
                    'Enter the price per seat in rupees',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'OK', 
                        onPress: (value?: string) => {
                          if (value && parseFloat(value) > 0) {
                            updateFormData('price', value);
                          }
                        }
                      }
                    ],
                    'plain-text',
                    formData.price
                  );
                }}
              >
                <Text style={[styles.input, { color: theme.colors.text }]}>
                  {formData.price ? formatPrice(parseFloat(formData.price)) : '₹ 0'} per seat
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pricing Guide Widget */}
          {isFetchingPricing && (
            <View style={styles.pricingLoader}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.pricingText, { color: theme.colors.textSecondary }]}>Calculating suggested fare...</Text>
            </View>
          )}

          {!isFetchingPricing && pricingSuggestion && (
            <View style={[styles.pricingGuide, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.pricingRow}>
                <Text style={[styles.pricingLabel, { color: theme.colors.textSecondary }]}>Suggested Price:</Text>
                <Text style={[styles.pricingValue, { color: theme.colors.text }]}>₹{pricingSuggestion.suggestedPricePerSeat} / seat</Text>
              </View>
              <View style={styles.pricingRow}>
                <Text style={[styles.pricingLabel, { color: theme.colors.textSecondary }]}>Allowed Range:</Text>
                <Text style={[styles.pricingValue, { color: theme.colors.text }]}>₹{pricingSuggestion.minPricePerSeat} - ₹{pricingSuggestion.maxPricePerSeat}</Text>
              </View>

              {currentCategory && (
                <View style={styles.pricingRow}>
                  <Text style={[styles.pricingLabel, { color: theme.colors.textSecondary }]}>Category:</Text>
                  <View style={[
                    styles.badge,
                    currentCategory === 'Budget' ? styles.badgeBudget :
                    currentCategory === 'Standard' ? styles.badgeStandard : styles.badgePremium
                  ]}>
                    <Text style={[
                      styles.badgeText,
                      currentCategory === 'Budget' ? styles.badgeTextBudget :
                      currentCategory === 'Standard' ? styles.badgeTextStandard : styles.badgeTextPremium
                    ]}>{currentCategory}</Text>
                  </View>
                </View>
              )}

              {priceValidationError && (
                <Text style={styles.pricingErrorText}>{priceValidationError}</Text>
              )}
            </View>
          )}

          {pricingError && (
            <Text style={styles.pricingErrorText}>{pricingError}</Text>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <PreferencesSelector
            preferences={preferences}
            onPreferencesChange={setPreferences}
            mode="driver"
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Post Ride</Text>
          )}
        </TouchableOpacity>
        
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  section: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
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
  input: {
    flex: 1,
    fontSize: 16,
  },
  seatSelector: {
    flex: 1,
  },
  priceSelector: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  pricingLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    justifyContent: 'center',
  },
  pricingText: {
    fontSize: 14,
  },
  pricingGuide: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingLabel: {
    fontSize: 14,
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  pricingErrorText: {
    color: '#D93025',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeBudget: {
    backgroundColor: '#E6F4EA',
  },
  badgeTextBudget: {
    color: '#137333',
  },
  badgeStandard: {
    backgroundColor: '#E8F0FE',
  },
  badgeTextStandard: {
    color: '#1A73E8',
  },
  badgePremium: {
    backgroundColor: '#F3E8FF',
  },
  badgeTextPremium: {
    color: '#7E22CE',
  },
});