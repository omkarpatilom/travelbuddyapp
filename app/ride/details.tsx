import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { MapPin, Calendar, Clock, Star, Phone, MessageCircle, Users, Car, ArrowLeft } from 'lucide-react-native';
import { mockRides } from '@/data/mockData';

const { width } = Dimensions.get('window');

export default function RideDetailsScreen() {
  const { theme } = useTheme();
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

  const handleBookRide = () => {
    router.push(`/ride/book?id=${ride.id}`);
  };

  const handleCallDriver = () => {
    Alert.alert('Call Driver', `Would you like to call ${ride.driverName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => Alert.alert('Calling...', 'Feature coming soon!') }
    ]);
  };

  const handleChatDriver = () => {
    Alert.alert('Chat', 'Chat feature coming soon!');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Ride Details</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Map Placeholder */}
      <View style={[styles.mapContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.mapPlaceholder}>
          <MapPin size={40} color={theme.colors.primary} />
          <Text style={[styles.mapText, { color: theme.colors.textSecondary }]}>
            Interactive Map View
          </Text>
          <Text style={[styles.mapSubtext, { color: theme.colors.textSecondary }]}>
            {ride.from.address} → {ride.to.address}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Route Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Route</Text>
          
          <View style={styles.routeContainer}>
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: theme.colors.secondary }]} />
              <View style={styles.locationInfo}>
                <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]}>From</Text>
                <Text style={[styles.locationText, { color: theme.colors.text }]}>{ride.from.address}</Text>
              </View>
            </View>
            
            <View style={[styles.routeLine, { backgroundColor: theme.colors.border }]} />
            
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: theme.colors.error }]} />
              <View style={styles.locationInfo}>
                <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]}>To</Text>
                <Text style={[styles.locationText, { color: theme.colors.text }]}>{ride.to.address}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tripInfo}>
            <View style={styles.tripItem}>
              <Text style={[styles.tripLabel, { color: theme.colors.textSecondary }]}>Distance</Text>
              <Text style={[styles.tripValue, { color: theme.colors.text }]}>{ride.distance}</Text>
            </View>
            <View style={styles.tripItem}>
              <Text style={[styles.tripLabel, { color: theme.colors.textSecondary }]}>Duration</Text>
              <Text style={[styles.tripValue, { color: theme.colors.text }]}>{ride.duration}</Text>
            </View>
          </View>
        </View>

        {/* Ride Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ride Information</Text>
          
          <View style={styles.rideInfoGrid}>
            <View style={styles.infoItem}>
              <Calendar size={20} color={theme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Date</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{ride.date}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Clock size={20} color={theme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Time</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{ride.time}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Users size={20} color={theme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Available Seats</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{ride.availableSeats}/{ride.totalSeats}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Car size={20} color={theme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Vehicle</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{ride.carModel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.priceSection}>
            <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>Price per seat</Text>
            <Text style={[styles.price, { color: theme.colors.primary }]}>${ride.price}</Text>
          </View>
        </View>

        {/* Driver Card */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Driver</Text>
          
          <View style={styles.driverCard}>
            <Image source={{ uri: ride.driverAvatar }} style={styles.driverAvatar} />
            <View style={styles.driverInfo}>
              <Text style={[styles.driverName, { color: theme.colors.text }]}>{ride.driverName}</Text>
              <View style={styles.ratingContainer}>
                <Star size={16} color={theme.colors.warning} fill={theme.colors.warning} />
                <Text style={[styles.rating, { color: theme.colors.textSecondary }]}>{ride.driverRating}</Text>
                <Text style={[styles.ratingCount, { color: theme.colors.textSecondary }]}>(25 reviews)</Text>
              </View>
              <Text style={[styles.phoneNumber, { color: theme.colors.textSecondary }]}>+1 (555) ***-**90</Text>
            </View>
            <View style={styles.contactButtons}>
              <TouchableOpacity 
                style={[styles.contactButton, { backgroundColor: theme.colors.secondary }]}
                onPress={handleCallDriver}
              >
                <Phone size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.contactButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleChatDriver}
              >
                <MessageCircle size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.bookButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleBookRide}
          >
            <Text style={styles.bookButtonText}>Book This Ride</Text>
          </TouchableOpacity>
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
  mapContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  mapText: {
    fontSize: 16,
    fontWeight: '600',
  },
  mapSubtext: {
    fontSize: 14,
    textAlign: 'center',
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
  routeContainer: {
    gap: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
  },
  routeLine: {
    width: 2,
    height: 30,
    marginLeft: 5,
  },
  tripInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tripItem: {
    alignItems: 'center',
  },
  tripLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  tripValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  rideInfoGrid: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  priceLabel: {
    fontSize: 16,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 14,
  },
  phoneNumber: {
    fontSize: 14,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    gap: 12,
    marginTop: 20,
  },
  bookButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
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