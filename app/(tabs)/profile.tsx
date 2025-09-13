import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { User, Settings, Star, Car, Calendar, Phone, Mail, LogOut, CreditCard as Edit, Shield, CircleHelp as HelpCircle, CreditCard, Bell, ChevronRight } from 'lucide-react-native';
import { mockReviews } from '@/data/mockData';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

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

  const menuItems = [
    {
      icon: Edit,
      title: 'Edit Profile',
      subtitle: 'Update your personal information',
      onPress: () => router.push('/profile/edit'),
    },
    {
      icon: Car,
      title: 'Vehicle Details',
      subtitle: 'Manage your vehicle information',
      onPress: () => router.push('/profile/vehicle'),
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
    {
      icon: Bell,
      title: 'Notifications',
      subtitle: 'Manage notification preferences',
      onPress: () => Alert.alert('Coming Soon', 'Notification settings coming soon!'),
    },
    {
      icon: Shield,
      title: 'Privacy & Security',
      subtitle: 'Control your privacy settings',
      onPress: () => Alert.alert('Coming Soon', 'Privacy settings coming soon!'),
    },
    {
      icon: HelpCircle,
      title: 'Help & Support',
      subtitle: 'Get help and contact support',
      onPress: () => Alert.alert('Coming Soon', 'Help center coming soon!'),
    },
  ];

  const renderMenuItem = (item: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={[styles.menuItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={item.onPress}
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
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.card }]}>
                <User size={40} color={theme.colors.primary} />
              </View>
            )}
            <TouchableOpacity style={styles.editAvatarButton}>
              <Edit size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.userStats}>
              <View style={styles.statItem}>
                <Star size={16} color="#FFD700" fill="#FFD700" />
                <Text style={styles.statText}>{user?.rating}</Text>
              </View>
              <View style={styles.statItem}>
                <Car size={16} color="#FFFFFF" />
                <Text style={styles.statText}>{user?.totalRides} rides</Text>
              </View>
              <View style={styles.statItem}>
                <Calendar size={16} color="#FFFFFF" />
                <Text style={styles.statText}>Since {user?.joinedDate}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.quickStats, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.statColumn}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {user?.totalRides}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Total Rides
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statColumn}>
            <Text style={[styles.statNumber, { color: theme.colors.secondary }]}>
              {user?.rating}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Average Rating
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statColumn}>
            <Text style={[styles.statNumber, { color: theme.colors.accent }]}>
              $245
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Money Saved
            </Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Settings</Text>
          <View style={styles.menuList}>
            {menuItems.map((item, index) => renderMenuItem(item, index))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}
          onPress={handleLogout}
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