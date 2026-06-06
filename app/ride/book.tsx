import React, { useState, useEffect } from 'react';
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
import { useRides, Ride } from '@/contexts/RideContext';
import { useAuth } from '@/contexts/AuthContext';
import { User, Phone, Users, IndianRupee, ArrowLeft, CreditCard, MapPin, ChevronDown } from 'lucide-react-native';
import { mockRides } from '@/data/mockData';
import { formatPrice } from '@/utils/validation';

export default function BookRideScreen() {
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [requestedPickup, setRequestedPickup] = useState('');
  const [requestedDropoff, setRequestedDropoff] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [ride, setRide] = useState<Ride | null>(null);
  
  const { theme } = useTheme();
  const { bookRide, getRideById } = useRides();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const rideId = params.id as string;

  useEffect(() => {
    if (rideId) {
      fetchRideDetails();
    }
  }, [rideId]);

  const fetchRideDetails = async () => {
    setIsLoading(true);
    const data = await getRideById(rideId);
    setRide(data);
    setIsLoading(false);
  };

  // Auto-fill passenger details from user profile
  useEffect(() => {
    if (user) {
      setPassengerName(user.fullName);
      setPassengerPhone(user.phone);
    }
  }, [user]);

  // Pre-fill requested pickup and dropoff with driver offered locations
  useEffect(() => {
    if (ride) {
      setRequestedPickup(ride.from.address);
      setRequestedDropoff(ride.to.address);
    }
  }, [ride]);

  if (isLoading && !ride) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

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

    if (!requestedPickup.trim() || !requestedDropoff.trim()) {
      Alert.alert('Missing Location', 'Please specify requested pickup and dropoff addresses');
      return;
    }

    if (selectedSeats > ride.availableSeats) {
      Alert.alert('Not Available', 'Not enough seats available');
      return;
    }

    setIsLoading(true);
    try {
      const specialRequestPayload = JSON.stringify({
        requestedPickup: requestedPickup.trim(),
        requestedDropoff: requestedDropoff.trim(),
        notes: specialNotes.trim()
      });

      const success = await bookRide(rideId, selectedSeats, {
        name: passengerName,
        phone: passengerPhone,
        specialRequest: specialRequestPayload
      });

      if (success) {
        Alert.alert(
          'Booking Confirmed!',
          `Your ride has been booked successfully. Total cost: ${formatPrice(totalPrice)}`,
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
              Number of passengers (Available seats: {ride.availableSeats})
            </Text>
            
            <TouchableOpacity 
              style={[styles.dropdownButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => setDropdownOpen(!dropdownOpen)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Users size={20} color={theme.colors.primary} />
                <Text style={[styles.dropdownButtonText, { color: theme.colors.text }]}>
                  {selectedSeats} Passenger{selectedSeats > 1 ? 's' : ''}
                </Text>
              </View>
              <ChevronDown size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {dropdownOpen && (
              <View style={[styles.dropdownList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                {Array.from({ length: ride.availableSeats }, (_, i) => i + 1).map((seats) => (
                  <TouchableOpacity
                    key={seats}
                    style={[
                      styles.dropdownOption,
                      { borderBottomColor: theme.colors.border },
                      selectedSeats === seats && { backgroundColor: theme.colors.primary + '10' }
                    ]}
                    onPress={() => {
                      setSelectedSeats(seats);
                      setDropdownOpen(false);
                    }}
                  >
                    <Text style={[
                      styles.dropdownOptionText, 
                      { color: theme.colors.text },
                      selectedSeats === seats && { color: theme.colors.primary, fontWeight: 'bold' }
                    ]}>
                      {seats} Passenger{seats > 1 ? 's' : ''}
                    </Text>
                    {selectedSeats === seats && (
                      <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
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

        {/* Requested Journey Details */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Requested Pickup & Dropoff</Text>
          <Text style={[styles.subtitleText, { color: theme.colors.textSecondary }]}>
            Specify your requested locations if they differ from the offered ride route.
          </Text>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <MapPin size={20} color={theme.colors.secondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Requested Pickup Address"
              placeholderTextColor={theme.colors.textSecondary}
              value={requestedPickup}
              onChangeText={setRequestedPickup}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <MapPin size={20} color={theme.colors.error} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Requested Destination Address"
              placeholderTextColor={theme.colors.textSecondary}
              value={requestedDropoff}
              onChangeText={setRequestedDropoff}
            />
          </View>
        </View>

        {/* Special Requests / Notes */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Special Notes (Optional)</Text>
          
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, alignItems: 'flex-start', minHeight: 80, paddingTop: 10 }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text, height: '100%', textAlignVertical: 'top' }]}
              placeholder="Add any instructions, preferences, or pickup notes for the driver..."
              placeholderTextColor={theme.colors.textSecondary}
              value={specialNotes}
              onChangeText={setSpecialNotes}
              multiline={true}
              numberOfLines={3}
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
              {formatPrice(ride.price)}
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
              {formatPrice(totalPrice)}
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
              <IndianRupee size={20} color="#FFFFFF" />
              <Text style={styles.bookButtonText}>Book Ride - {formatPrice(totalPrice)}</Text>
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
  subtitleText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 4,
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
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  dropdownButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownList: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  dropdownOptionText: {
    fontSize: 16,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});