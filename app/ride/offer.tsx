import React, { useState } from 'react';
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
import { Users, DollarSign, ArrowLeft } from 'lucide-react-native';
import DatePicker from '@/components/DatePicker';
import LocationPicker from '@/components/LocationPicker';
import VehicleSelector from '@/components/VehicleSelector';
import PreferencesSelector, { RidePreferences } from '@/components/PreferencesSelector';
import MapLocationSelector from '@/components/MapLocationSelector';

export default function OfferRideScreen() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    seats: '1',
    price: '',
    description: '',
  });
  const [fromLocationData, setFromLocationData] = useState<any>(null);
  const [toLocationData, setToLocationData] = useState<any>(null);
  
  // Mock vehicles data - in real app, this would come from user's vehicles
  const [vehicles] = useState([
    {
      id: '1',
      make: 'Toyota',
      model: 'Camry',
      year: '2020',
      color: 'Blue',
      licensePlate: 'ABC123',
      seats: '4',
      photos: ['https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg?auto=compress&cs=tinysrgb&w=400'],
      isDefault: true,
    },
    {
      id: '2',
      make: 'Honda',
      model: 'Civic',
      year: '2019',
      color: 'White',
      licensePlate: 'XYZ789',
      seats: '4',
      photos: ['https://images.pexels.com/photos/1007410/pexels-photo-1007410.jpeg?auto=compress&cs=tinysrgb&w=400'],
      isDefault: false,
    },
  ]);
  
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles.find(v => v.isDefault) || vehicles[0]);
  const [preferences, setPreferences] = useState<RidePreferences>({
    nonSmoking: true,
    musicAllowed: true,
    petsAllowed: false,
    airConditioning: true,
    conversationLevel: 'moderate',
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const { theme } = useTheme();
  const { createRide } = useRides();
  const router = useRouter();

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.from || !formData.to) {
      Alert.alert('Missing Information', 'Please enter pickup and destination locations');
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
        from: {
          address: formData.from,
          coordinates: { latitude: 37.7749, longitude: -122.4194 }
        },
        to: {
          address: formData.to,
          coordinates: { latitude: 37.4419, longitude: -122.1430 }
        },
        date: selectedDate!.toLocaleDateString(),
        time: selectedTime!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
            fromLocation={fromLocationData}
            toLocation={toLocationData}
            onLocationsSelected={(from, to) => {
              setFromLocationData(from);
              setToLocationData(to);
              updateFormData('from', from.address);
              updateFormData('to', to.address);
            }}
          />

          <LocationPicker
            value={formData.from}
            onLocationChange={(location) => updateFormData('from', location)}
            placeholder="From (pickup location)"
          />

          <LocationPicker
            value={formData.to}
            onLocationChange={(location) => updateFormData('to', location)}
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
            <TouchableOpacity style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Users size={20} color={theme.colors.textSecondary} />
              <Text
                style={[styles.input, { color: theme.colors.text }]}
              >
                {formData.seats} seat{parseInt(formData.seats) > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <DollarSign size={20} color={theme.colors.textSecondary} />
              <Text
                style={[styles.input, { color: theme.colors.text }]}
              >
                ${formData.price || '0'} per seat
              </Text>
            </TouchableOpacity>
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