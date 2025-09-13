import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { Camera, Plus, X, CreditCard as Edit } from 'lucide-react-native';

interface PhotoUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  minPhotos?: number;
  style?: any;
}

export default function PhotoUploader({
  photos,
  onPhotosChange,
  maxPhotos = 8,
  minPhotos = 3,
  style,
}: PhotoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { theme } = useTheme();

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera roll permissions to upload photos',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() },
        ]
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Maximum Photos', `You can only upload up to ${maxPhotos} photos`);
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: maxPhotos - photos.length,
      });

      if (!result.canceled) {
        const newPhotos = result.assets.map(asset => asset.uri);
        onPhotosChange([...photos, ...newPhotos]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const takePhoto = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Maximum Photos', `You can only upload up to ${maxPhotos} photos`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera permissions to take photos');
      return;
    }

    setIsUploading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        onPhotosChange([...photos, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(updatedPhotos);
  };

  const showImageOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const editPhoto = async (index: number) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const updatedPhotos = [...photos];
        updatedPhotos[index] = result.assets[0].uri;
        onPhotosChange(updatedPhotos);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to edit photo. Please try again.');
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Vehicle Photos ({photos.length}/{maxPhotos})
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Add at least {minPhotos} photos of your vehicle
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
        <View style={styles.photosRow}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <View style={styles.photoOverlay}>
                <TouchableOpacity
                  style={[styles.photoAction, { backgroundColor: theme.colors.primary }]}
                  onPress={() => editPhoto(index)}
                >
                  <Edit size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoAction, { backgroundColor: theme.colors.error }]}
                  onPress={() => removePhoto(index)}
                >
                  <X size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {index === 0 && (
                <View style={[styles.primaryBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.primaryText}>Primary</Text>
                </View>
              )}
            </View>
          ))}

          {photos.length < maxPhotos && (
            <TouchableOpacity
              style={[styles.addPhotoButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={showImageOptions}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <>
                  <Plus size={24} color={theme.colors.primary} />
                  <Text style={[styles.addPhotoText, { color: theme.colors.primary }]}>
                    Add Photo
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {photos.length < minPhotos && (
        <Text style={[styles.warningText, { color: theme.colors.error }]}>
          Please add at least {minPhotos - photos.length} more photo{minPhotos - photos.length > 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
  },
  photosContainer: {
    flexGrow: 0,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 120,
    height: 90,
    borderRadius: 12,
  },
  photoOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  photoAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  addPhotoButton: {
    width: 120,
    height: 90,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});