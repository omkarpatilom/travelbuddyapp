import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { User, Settings, Star, Car, Calendar, Phone, Mail, LogOut, CreditCard as Edit, Shield, CircleHelp as HelpCircle, CreditCard, Bell, ChevronRight, MapPin, TrendingUp, CheckCircle } from 'lucide-react-native';
import { mockReviews } from '@/data/mockData';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, logout, refreshProfile, isLoading } = useAuth();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          }
        },
      ]
    );
  };

  if (isLoading || !user) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text }}>Loading profile...</Text>
      </View>
    );
  }

  const menuGroups = [
    ...(user?.role === 'Driver' ? [{
      title: 'Driver Dashboard',
      items: [
        {
          icon: TrendingUp,
          title: 'Earnings & Stats',
          subtitle: 'View your performance and earnings',
          onPress: () => Alert.alert('Coming Soon', 'Driver stats coming soon!'),
        },
        {
          icon: CheckCircle,
          title: 'Verification Status',
          subtitle: user.isVerified ? 'Fully verified driver' : 'Verification pending or required',
          onPress: () => router.push('/profile/verification'),
        },
      ]
    }] : []),
    {
      title: 'Account Settings',
      items: [
        {
          icon: Edit,
          title: 'Edit Profile',
          subtitle: 'Update your personal information',
          onPress: () => router.push('/profile/edit'),
        },
        {
          icon: MapPin,
          title: 'Saved Locations',
          subtitle: 'Home, work, and favorite spots',
          onPress: () => router.push('/profile/saved-locations'),
        },
        {
          icon: Bell,
          title: 'Notifications',
          subtitle: 'Manage notification preferences',
          onPress: () => router.push('/profile/notifications'),
        },
        {
          icon: Shield,
          title: 'Security',
          subtitle: 'Password, 2FA, and active sessions',
          onPress: () => router.push('/profile/security'),
        },
      ]
    },
    {
      title: 'Ride & Vehicle',
      items: [
        {
          icon: Car,
          title: 'Vehicle Details',
          subtitle: 'Manage your vehicle information',
          onPress: () => router.push('/profile/vehicle'),
        },
        {
          icon: Settings,
          title: 'Ride Preferences',
          subtitle: 'Music, smoking, and passenger defaults',
          onPress: () => router.push('/profile/preferences'),
        },
        {
          icon: Star,
          title: 'Reviews & Ratings',
          subtitle: `${mockReviews.length} reviews`,
          onPress: () => router.push('/profile/reviews'),
        },
        {
          icon: CreditCard,
          title: 'Payment Methods',
          subtitle: 'Manage your cards and payments',
          onPress: () => Alert.alert('Coming Soon', 'Payment methods feature coming soon!'),
        },
      ]
    },
    {
      title: 'Safety & Support',
      items: [
        {
          icon: Shield,
          title: 'Safety Center',
          subtitle: 'Emergency contacts and SOS',
          onPress: () => router.push('/profile/safety'),
        },
        {
          icon: HelpCircle,
          title: 'Help & Support',
          subtitle: 'Get help and contact support',
          onPress: () => Alert.alert('Coming Soon', 'Help center coming soon!'),
        },
      ]
    }
  ];

  const renderMenuItem = (item: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={[styles.menuItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint={item.subtitle}
    >
      <View style={[styles.menuIcon, { backgroundColor: theme.colors.primary + '20' }]}>
        <item.icon size={20} color={theme.colors.primary} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, { color: theme.colors.text }]}>{item.title}</Text>
        <Text style={[styles.menuSubtitle, { color: theme.colors.textSecondary }]}>{item.subtitle}</Text>
      </View>
      <ChevronRight size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} accessible={false}>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} accessible={true} accessibilityLabel="Profile Picture" />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.card }]} accessible={true} accessibilityLabel="Default Profile Picture">
                <User size={40} color={theme.colors.primary} />
              </View>
            )}
            <TouchableOpacity 
              style={styles.editAvatarButton} 
              accessibilityRole="button" 
              accessibilityLabel="Edit Profile Picture"
              onPress={() => router.push('/profile/edit')}
            >
              <Edit size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfo} accessible={true}>
            <Text style={styles.userName} accessibilityLabel={`User name ${user?.fullName || 'Traveler'}`}>
              {user?.fullName || 'Traveler'}
            </Text>
            <Text style={styles.userEmail} accessibilityLabel={`Email address ${user?.email}`}>{user?.email}</Text>
            <View style={styles.userStats}>
              <View style={styles.statItem} accessible={true} accessibilityLabel={`Rating ${user?.rating?.toFixed(1) || '0.0'}`}>
                <Star size={16} color="#FFD700" fill="#FFD700" />
                <Text style={styles.statText}>{user?.rating?.toFixed(1) || '0.0'}</Text>
              </View>
              <View style={styles.statItem} accessible={true} accessibilityLabel={`Verification status ${user?.isVerified ? 'Verified' : 'Unverified'}`}>
                <Shield size={16} color="#FFFFFF" />
                <Text style={styles.statText}>{user?.isVerified ? 'Verified' : 'Unverified'}</Text>
              </View>
              <View style={styles.statItem} accessible={true} accessibilityLabel={`Member since ${user?.createdAt ? new Date(user.createdAt).getFullYear() : '2026'}`}>
                <Calendar size={16} color="#FFFFFF" />
                <Text style={styles.statText}>Since {user?.createdAt ? new Date(user.createdAt).getFullYear() : '2026'}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.quickStats, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} accessible={true} accessibilityRole="summary">
          <View style={styles.statColumn} accessible={true} accessibilityLabel={`Total Rides ${user?.totalRides || 0}`}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {user?.totalRides || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Total Rides
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statColumn} accessible={true} accessibilityLabel={`Average Rating ${user?.rating?.toFixed(1) || '0.0'}`}>
            <Text style={[styles.statNumber, { color: theme.colors.secondary }]}>
              {user?.rating?.toFixed(1) || '0.0'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Average Rating
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statColumn} accessible={true} accessibilityLabel="Money Saved ₹0">
            <Text style={[styles.statNumber, { color: theme.colors.accent }]}>
              ₹0
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Money Saved
            </Text>
          </View>
        </View>

        {menuGroups.map((group, gIndex) => (
          <View key={gIndex} style={styles.menuSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} accessibilityRole="header">{group.title}</Text>
            <View style={styles.menuList}>
              {group.items.map((item, index) => renderMenuItem(item, index))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <LogOut size={20} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 8,
  },
  profileInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  userStats: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  quickStats: {
    flexDirection: 'row',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  menuSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuList: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 24,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});