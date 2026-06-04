import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/utils/api';
import { User, Mail, Phone, Camera, ArrowLeft, Save, Trash2 } from 'lucide-react-native';

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const { user, updateUser, refreshProfile } = useAuth();
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();

  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.fullName || !formData.email || !formData.phone) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await updateUser(formData);
      Alert.alert('Success', 'Profile updated successfully!', [
        { 
          text: 'OK', 
          onPress: () => {
            if (onboarding === 'true' || !router.canGoBack()) {
              router.replace('/(tabs)/home');
            } else {
              router.back();
            }
          }
        }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Denied', 'Permission to access gallery is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        // @ts-ignore
        formData.append('file', {
          uri: result.assets[0].uri,
          name: 'profile-photo.jpg',
          type: 'image/jpeg',
        });
        
        await api.post('/users/me/profile-photo', formData);
        await refreshProfile();
        Alert.alert('Success', 'Profile photo updated!');
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to upload photo');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDeletePhoto = async () => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsUploading(true);
            try {
              await api.delete('/users/me/profile-photo');
              await refreshProfile();
              Alert.alert('Success', 'Profile photo removed');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove photo');
            } finally {
              setIsUploading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Save size={24} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.surface }]}>
                <User size={40} color={theme.colors.primary} />
              </View>
            )}
            <TouchableOpacity 
              style={[styles.cameraButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleChangePhoto}
            >
              <Camera size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.photoText, { color: theme.colors.textSecondary }]}>
            Tap to change photo
          </Text>
        </View>

        {/* Personal Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Personal Information</Text>
          
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <User size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Full Name"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.fullName}
              onChangeText={(value) => updateFormData('fullName', value)}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Mail size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Email"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.email}
              editable={false} // Email usually shouldn't be edited easily
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Phone size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Phone Number"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.phone}
              onChangeText={(value) => updateFormData('phone', value)}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Account Stats */}
        <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account Statistics</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.primary }]}>{user?.rating}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Rating</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.secondary }]}>{user?.role}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Role</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.accent }]}>{user?.createdAt ? new Date(user.createdAt).getFullYear() : 'N/A'}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Member Since</Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButtonLarge, { backgroundColor: theme.colors.primary }]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Save size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
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
  saveButton: {
    padding: 8,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  photoSection: {
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    fontSize: 14,
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
  nameRow: {
    flexDirection: 'row',
    gap: 12,
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
  halfWidth: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
    textAlign: 'center',
  },
  saveButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});