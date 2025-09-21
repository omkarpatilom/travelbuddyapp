import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRides } from '@/contexts/RideContext';
import { Plus, Calendar, Clock, MapPin, Users, CreditCard as Edit, X } from 'lucide-react-native';
import { mockRides } from '@/data/mockData';

export default function MyRidesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { myRides } = useRides();
  const router = useRouter();

  // Filter rides for current user (mock data)
  const userRides = mockRides.filter(ride => ride.driverId === user?.id || ride.driverId === '1');

  const handleEditRide = (rideId: string) => {
    router.push(`/ride/offer?edit=${rideId}`);
  };

  const handleCancelRide = (rideId: string) => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride? All passengers will be notified.',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', 'Your ride has been cancelled. Passengers have been notified.');
          }
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return theme.colors.success;
      case 'completed': return theme.colors.textSecondary;
      case 'cancelled': return theme.colors.error;
      default: return theme.colors.textSecondary;
    }
  };

  const renderRide = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.rideCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={() => router.push(`/ride/details?id=${item.id}`)}
    >
      <View style={styles.rideHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
        
        {item.status === 'active' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              onPress={() => handleEditRide(item.id)}
              style={[styles.actionButton, { backgroundColor: theme.colors.primary + '20' }]}
            >
              <Edit size={16} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleCancelRide(item.id)}
              style={[styles.actionButton, { backgroundColor: theme.colors.error + '20' }]}
            >
              <X size={16} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.locationRow}>
          <MapPin size={18} color={theme.colors.secondary} />
          <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
            {item.from.address}
          </Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.locationRow}>
          <MapPin size={18} color={theme.colors.error} />
          <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
            {item.to.address}
          </Text>
        </View>
      </View>

      <View style={styles.rideInfo}>
        <View style={styles.infoRow}>
          <Calendar size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            {item.date}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Clock size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            {item.time}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Users size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            {item.availableSeats}/{item.totalSeats} available
          </Text>
        </View>
      </View>

      <View style={styles.rideFooter}>
        <View style={styles.carInfo}>
          <Text style={[styles.carText, { color: theme.colors.textSecondary }]}>
            {item.carModel} • {item.carColor}
          </Text>
        </View>
        <Text style={[styles.price, { color: theme.colors.primary }]}>
          ${item.price}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.colors.text }]}>My Rides</Text>
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/ride/offer')}
          >
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Offer Ride</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.quickStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {userRides.filter(r => r.status === 'active').length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Active
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.secondary }]}>
              {userRides.filter(r => r.status === 'completed').length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Completed
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.accent }]}>
              ${userRides.reduce((sum, ride) => sum + (ride.price * (ride.totalSeats - ride.availableSeats)), 0)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Earned
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={userRides}
        keyExtractor={(item) => item.id}
        renderItem={renderRide}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyIcon, { color: theme.colors.textSecondary }]}>🚗</Text>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No rides yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              Start offering rides to earn money and help others travel!
            </Text>
            <TouchableOpacity 
              style={[styles.offerButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push('/ride/offer')}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.offerButtonText}>Offer Your First Ride</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  listContent: {
    padding: 20,
    gap: 16,
  },
  rideCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  routeContainer: {
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
  },
  locationText: {
    fontSize: 15,
    flex: 1,
    fontWeight: '500',
  },
  rideInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  infoText: {
    fontSize: 14,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  carInfo: {
    flex: 1,
  },
  carText: {
    fontSize: 14,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  offerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  offerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});