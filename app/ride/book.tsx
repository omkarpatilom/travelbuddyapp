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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRides } from '@/contexts/RideContext';
import { useAuth } from '@/contexts/AuthContext';
import { User, Phone, Users, DollarSign, ArrowLeft, CreditCard } from 'lucide-react-native';
import { mockRides } from '@/data/mockData';

export default function BookRideScreen() {
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { theme } = useTheme();
  const { bookRide } = useRides();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const rideId = params.id as string;

  // Find the ride by ID
  const ride = mockRides.find(r => r.id === rideId);

  if (!ride) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.text }]}>Ride not found</Text>
      </View>
    );
  }

  const totalPrice = ride.price * selectedSeats;

  const handleBooking = async () => {
    if (!passengerName || !passengerPhone) {
      Alert.alert('Missing Information', 'Please fill in all passenger details');
      return;
    }

    if (selectedSeats > ride.availableSeats) {
      Alert.alert('Not Available', 'Not enough seats available');
      return;
    }

    setIsLoading(true);
    try {
      const success = await bookRide(rideId, selectedSeats, {
        name: passengerName,
        phone: passengerPhone,
      });

      if (success) {
        Alert.alert(
          'Booking Confirmed!',
          `Your ride has been booked successfully. Total cost: $${totalPrice}`,
          [{ text: 'OK', onPress: () => router.push('/(tabs)/bookings') }]
        );
      } else {
        Alert.alert('Booking Failed', 'Unable to book the ride. Please try again.');
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Book Ride</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Ride Summary */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ride Summary</Text>
          
          <View style={styles.rideInfo}>
            <Text style={[styles.routeText, { color: theme.colors.text }]}>
              {ride.from.address} → {ride.to.address}
            </Text>
            <Text style={[styles.dateTimeText, { color: theme.colors.textSecondary }]}>
              {ride.date} at {ride.time}
            </Text>
            <Text style={[styles.driverText, { color: theme.colors.textSecondary }]}>
              Driver: {ride.driverName}
            </Text>
          </View>
        </View>

        {/* Seat Selection */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Select Seats</Text>
          
          <View style={styles.seatSelector}>
            <Text style={[styles.seatLabel, { color: theme.colors.textSecondary }]}>
              Number of seats (Available: {ride.availableSeats})
            </Text>
            
            <View style={styles.seatControls}>
              <TouchableOpacity 
                style={[styles.seatButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => setSelectedSeats(Math.max(1, selectedSeats - 1))}
                disabled={selectedSeats <= 1}
              >
                <Text style={[styles.seatButtonText, { color: theme.colors.text }]}>-</Text>
              </TouchableOpacity>
              
              <View style={[styles.seatDisplay, { backgroundColor: theme.colors.primary }]}>
                <Users size={20} color="#FFFFFF" />
                <Text style={styles.seatCount}>{selectedSeats}</Text>
              </View>
              
              <TouchableOpacity 
                style={[styles.seatButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => setSelectedSeats(Math.min(ride.availableSeats, selectedSeats + 1))}
                disabled={selectedSeats >= ride.availableSeats}
              >
                <Text style={[styles.seatButtonText, { color: theme.colors.text }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Passenger Details */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Passenger Details</Text>
          
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <User size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Full Name"
              placeholderTextColor={theme.colors.textSecondary}
              value={passengerName}
              onChangeText={setPassengerName}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Phone size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Phone Number"
              placeholderTextColor={theme.colors.textSecondary}
              value={passengerPhone}
              onChangeText={setPassengerPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Payment Summary */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Payment Summary</Text>
          
          <View style={styles.paymentRow}>
            <Text style={[styles.paymentLabel, { color: theme.colors.textSecondary }]}>
              Price per seat
            </Text>
            <Text style={[styles.paymentValue, { color: theme.colors.text }]}>
              ${ride.price}
            </Text>
          </View>

          <View style={styles.paymentRow}>
            <Text style={[styles.paymentLabel, { color: theme.colors.textSecondary }]}>
              Number of seats
            </Text>
            <Text style={[styles.paymentValue, { color: theme.colors.text }]}>
              {selectedSeats}
            </Text>
          </View>

          <View style={[styles.paymentRow, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: theme.colors.text }]}>
              Total Amount
            </Text>
            <Text style={[styles.totalValue, { color: theme.colors.primary }]}>
              ${totalPrice}
            </Text>
          </View>
        </View>

        {/* Payment Method */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Payment Method</Text>
          
          <TouchableOpacity style={[styles.paymentMethod, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <CreditCard size={20} color={theme.colors.primary} />
            <Text style={[styles.paymentMethodText, { color: theme.colors.text }]}>
              Credit Card ending in 4242
            </Text>
          </TouchableOpacity>
        </View>

        {/* Book Button */}
        <TouchableOpacity 
          style={[styles.bookButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleBooking}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <DollarSign size={20} color="#FFFFFF" />
              <Text style={styles.bookButtonText}>Book Ride - ${totalPrice}</Text>
            </>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
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
  },
  rideInfo: {
    gap: 8,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dateTimeText: {
    fontSize: 14,
  },
  driverText: {
    fontSize: 14,
  },
  seatSelector: {
    gap: 12,
  },
  seatLabel: {
    fontSize: 14,
  },
  seatControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  seatButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  seatDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
  },
  seatCount: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '500',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});