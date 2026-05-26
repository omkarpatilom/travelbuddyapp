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
import { useTheme } from '@/contexts/ThemeContext';
import { useRides } from '@/contexts/RideContext';
import { api } from '@/utils/api';
import { Users, DollarSign, ArrowLeft } from 'lucide-react-native';
import DatePicker from '@/components/DatePicker';
import LocationPicker from '@/components/LocationPicker';
import VehicleSelector from '@/components/VehicleSelector';
import PreferencesSelector, { RidePreferences } from '@/components/PreferencesSelector';
import MapLocationSelector from '@/components/MapLocationSelector';

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
  
  const { theme } = useTheme();
  const { createRide } = useRides();
  const router = useRouter();

  useEffect(() => {
    fetchVehicles();
  }, []);

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

    if (parseFloat(formData.price) < 1) {
      Alert.alert('Invalid Price', 'Price must be at least $1');
      return false;
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

      const success = await createRide(rideData);
      
      if (success) {
        Alert.alert('Success', 'Your ride has been posted successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', 'Failed to create ride. Please try again.');
      }
    } catch (error) {
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
            <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Users size={20} color={theme.colors.textSecondary} />
              <TouchableOpacity 
                style={styles.seatSelector}
                onPress={() => {
                  Alert.prompt(
                    'Number of Seats',
                    'Enter the number of available seats (1-8)',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'OK', 
                        onPress: (value?: string) => {
                          if (value && parseInt(value) >= 1 && parseInt(value) <= 8) {
                            updateFormData('seats', value);
                          }
                        }
                      }
                    ],
                    'plain-text',
                    formData.seats
                  );
                }}
              >
                <Text style={[styles.input, { color: theme.colors.text }]}>
                  {formData.seats} seat{parseInt(formData.seats) > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <DollarSign size={20} color={theme.colors.textSecondary} />
              <TouchableOpacity 
                style={styles.priceSelector}
                onPress={() => {
                  Alert.prompt(
                    'Price per Seat',
                    'Enter the price per seat in dollars',
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
                  ${formData.price || '0'} per seat
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
});