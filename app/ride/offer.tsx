import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRides } from '@/contexts/RideContext';
import { MapPin, Calendar, Clock, Users, DollarSign, Car, ArrowLeft } from 'lucide-react-native';

export default function OfferRideScreen() {
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    date: '',
    time: '',
    seats: '1',
    price: '',
    carModel: '',
    carColor: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const { theme } = useTheme();
  const { createRide } = useRides();
  const router = useRouter();

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const required = ['from', 'to', 'date', 'time', 'seats', 'price', 'carModel', 'carColor'];
    for (const field of required) {
      if (!formData[field as keyof typeof formData]) {
        Alert.alert('Missing Information', `Please fill in the ${field} field`);
        return false;
      }
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
        date: formData.date,
        time: formData.time,
        availableSeats: parseInt(formData.seats),
        totalSeats: parseInt(formData.seats),
        price: parseFloat(formData.price),
        carModel: formData.carModel,
        carColor: formData.carColor,
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
          
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <MapPin size={20} color={theme.colors.secondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="From (pickup location)"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.from}
              onChangeText={(value) => updateFormData('from', value)}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <MapPin size={20} color={theme.colors.error} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="To (destination)"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.to}
              onChangeText={(value) => updateFormData('to', value)}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Schedule</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Calendar size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={theme.colors.textSecondary}
                value={formData.date}
                onChangeText={(value) => updateFormData('date', value)}
              />
            </View>

            <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Clock size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Time (HH:MM)"
                placeholderTextColor={theme.colors.textSecondary}
                value={formData.time}
                onChangeText={(value) => updateFormData('time', value)}
              />
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ride Details</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Users size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Available seats"
                placeholderTextColor={theme.colors.textSecondary}
                value={formData.seats}
                onChangeText={(value) => updateFormData('seats', value)}
                keyboardType="numeric"
              />
            </View>

            <View style={[styles.inputContainer, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <DollarSign size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Price per seat"
                placeholderTextColor={theme.colors.textSecondary}
                value={formData.price}
                onChangeText={(value) => updateFormData('price', value)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Vehicle Information</Text>
          
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Car size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Car model (e.g., Toyota Camry)"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.carModel}
              onChangeText={(value) => updateFormData('carModel', value)}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.colorDot, { backgroundColor: theme.colors.textSecondary }]} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Car color"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.carColor}
              onChangeText={(value) => updateFormData('carColor', value)}
            />
          </View>

          <View style={[styles.inputContainer, styles.textArea, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <TextInput
              style={[styles.input, styles.textAreaInput, { color: theme.colors.text }]}
              placeholder="Additional notes (optional)"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.description}
              onChangeText={(value) => updateFormData('description', value)}
              multiline
              numberOfLines={3}
            />
          </View>
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
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  textArea: {
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  textAreaInput: {
    minHeight: 60,
    textAlignVertical: 'top',
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