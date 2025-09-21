import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRides } from '@/contexts/RideContext';
import { Users, DollarSign, ArrowLeft, Edit3, Check, X, Plus, Minus } from 'lucide-react-native';
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
  const [isEditingSeats, setIsEditingSeats] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempSeats, setTempSeats] = useState('1');
  const [tempPrice, setTempPrice] = useState('');
  
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

  const handleEditSeats = () => {
    setTempSeats(formData.seats);
    setIsEditingSeats(true);
  };

  const handleSaveSeats = () => {
    const seatsNum = parseInt(tempSeats);
    if (isNaN(seatsNum) || seatsNum < 1 || seatsNum > 8) {
      Alert.alert('Invalid Seats', 'Number of seats must be between 1 and 8');
      return;
    }
    updateFormData('seats', tempSeats);
    setIsEditingSeats(false);
  };

  const handleEditPrice = () => {
    setTempPrice(formData.price);
    setIsEditingPrice(true);
  };

  const handleSavePrice = () => {
    const priceNum = parseFloat(tempPrice);
    if (isNaN(priceNum) || priceNum < 1) {
      Alert.alert('Invalid Price', 'Price must be at least $1');
      return;
    }
    updateFormData('price', tempPrice);
    setIsEditingPrice(false);
  };

  const adjustSeats = (increment: boolean) => {
    const currentSeats = parseInt(tempSeats);
    const newSeats = increment ? currentSeats + 1 : currentSeats - 1;
    if (newSeats >= 1 && newSeats <= 8) {
      setTempSeats(newSeats.toString());
    }
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
            <View style={[styles.editableField, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.fieldHeader}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Seats</Text>
                <TouchableOpacity 
                  style={[styles.editFieldButton, { backgroundColor: theme.colors.primary + '20' }]}
                  onPress={handleEditSeats}
                >
                  <Edit3 size={14} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.fieldContent}>
                <Users size={20} color={theme.colors.textSecondary} />
                <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
                  {formData.seats} seat{parseInt(formData.seats) > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <View style={[styles.editableField, styles.halfWidth, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.fieldHeader}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Price per seat</Text>
                <TouchableOpacity 
                  style={[styles.editFieldButton, { backgroundColor: theme.colors.primary + '20' }]}
                  onPress={handleEditPrice}
                >
                  <Edit3 size={14} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.fieldContent}>
                <DollarSign size={20} color={theme.colors.textSecondary} />
                <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
                  ${formData.price || '0'}
                </Text>
              </View>
            </View>
          </View>

          {/* Total Earnings Display */}
          {formData.seats && formData.price && (
            <View style={[styles.earningsDisplay, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary }]}>
              <Text style={[styles.earningsLabel, { color: theme.colors.primary }]}>
                Estimated Total Earnings
              </Text>
              <Text style={[styles.earningsValue, { color: theme.colors.primary }]}>
                ${(parseInt(formData.seats) * parseFloat(formData.price || '0')).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Seats Edit Modal */}
        <Modal
          visible={isEditingSeats}
          transparent
          animationType="fade"
          onRequestClose={() => setIsEditingSeats(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.editModal, { backgroundColor: theme.colors.card }]}>
              <View style={styles.editModalHeader}>
                <Text style={[styles.editModalTitle, { color: theme.colors.text }]}>
                  Edit Available Seats
                </Text>
                <TouchableOpacity onPress={() => setIsEditingSeats(false)}>
                  <X size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.editModalContent}>
                <Text style={[styles.editModalDescription, { color: theme.colors.textSecondary }]}>
                  How many passengers can you accommodate?
                </Text>
                
                <View style={styles.seatsEditor}>
                  <TouchableOpacity 
                    style={[styles.seatsButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={() => adjustSeats(false)}
                    disabled={parseInt(tempSeats) <= 1}
                  >
                    <Minus size={20} color={parseInt(tempSeats) <= 1 ? theme.colors.border : theme.colors.text} />
                  </TouchableOpacity>
                  
                  <View style={[styles.seatsDisplay, { backgroundColor: theme.colors.primary }]}>
                    <Users size={24} color="#FFFFFF" />
                    <Text style={styles.seatsCount}>{tempSeats}</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.seatsButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={() => adjustSeats(true)}
                    disabled={parseInt(tempSeats) >= 8}
                  >
                    <Plus size={20} color={parseInt(tempSeats) >= 8 ? theme.colors.border : theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.editModalActions}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: theme.colors.surface }]}
                    onPress={() => setIsEditingSeats(false)}
                  >
                    <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleSaveSeats}
                  >
                    <Check size={20} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Price Edit Modal */}
        <Modal
          visible={isEditingPrice}
          transparent
          animationType="fade"
          onRequestClose={() => setIsEditingPrice(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.editModal, { backgroundColor: theme.colors.card }]}>
              <View style={styles.editModalHeader}>
                <Text style={[styles.editModalTitle, { color: theme.colors.text }]}>
                  Set Price Per Seat
                </Text>
                <TouchableOpacity onPress={() => setIsEditingPrice(false)}>
                  <X size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.editModalContent}>
                <Text style={[styles.editModalDescription, { color: theme.colors.textSecondary }]}>
                  Set a competitive price for each passenger seat
                </Text>
                
                <View style={[styles.priceInputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <DollarSign size={24} color={theme.colors.primary} />
                  <TextInput
                    style={[styles.priceInput, { color: theme.colors.text }]}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={tempPrice}
                    onChangeText={setTempPrice}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                </View>

                {tempPrice && formData.seats && (
                  <View style={[styles.pricePreview, { backgroundColor: theme.colors.primary + '10' }]}>
                    <Text style={[styles.pricePreviewText, { color: theme.colors.primary }]}>
                      Total potential earnings: ${(parseInt(formData.seats) * parseFloat(tempPrice || '0')).toFixed(2)}
                    </Text>
                  </View>
                )}

                <View style={styles.editModalActions}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: theme.colors.surface }]}
                    onPress={() => setIsEditingPrice(false)}
                  >
                    <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleSavePrice}
                  >
                    <Check size={20} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Additional Details</Text>
          
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Add any special instructions or notes (optional)"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.description}
              onChangeText={(value) => updateFormData('description', value)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
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
  editableField: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  editFieldButton: {
    padding: 4,
    borderRadius: 6,
  },
  fieldContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  earningsDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  earningsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  earningsValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  editModalContent: {
    padding: 20,
    gap: 20,
  },
  editModalDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  seatsEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  seatsButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    gap: 8,
  },
  seatsCount: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  pricePreview: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pricePreviewText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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