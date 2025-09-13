import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';

export interface PermissionResult {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

export const requestLocationPermission = async (): Promise<PermissionResult> => {
  try {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      if (!canAskAgain) {
        Alert.alert(
          'Location Permission Required',
          'Location access is required to find nearby rides and provide accurate pickup locations. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return { granted: false, canAskAgain, status };
    }

    return { granted: true, canAskAgain: true, status };
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return { granted: false, canAskAgain: false, status: 'error' };
  }
};

export const requestCameraPermission = async (): Promise<PermissionResult> => {
  try {
    const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      if (!canAskAgain) {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is required to take photos of your vehicle. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return { granted: false, canAskAgain, status };
    }

    return { granted: true, canAskAgain: true, status };
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return { granted: false, canAskAgain: false, status: 'error' };
  }
};

export const requestMediaLibraryPermission = async (): Promise<PermissionResult> => {
  try {
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      if (!canAskAgain) {
        Alert.alert(
          'Photo Library Permission Required',
          'Photo library access is required to select vehicle photos. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return { granted: false, canAskAgain, status };
    }

    return { granted: true, canAskAgain: true, status };
  } catch (error) {
    console.error('Error requesting media library permission:', error);
    return { granted: false, canAskAgain: false, status: 'error' };
  }
};

export const requestNotificationPermission = async (): Promise<PermissionResult> => {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    }

    const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
    
    if (status !== 'granted') {
      if (!canAskAgain) {
        Alert.alert(
          'Notification Permission Required',
          'Notifications help you stay updated about your rides and bookings. Please enable them in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return { granted: false, canAskAgain, status };
    }

    return { granted: true, canAskAgain: true, status };
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return { granted: false, canAskAgain: false, status: 'error' };
  }
};

export const checkLocationPermission = async (): Promise<boolean> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking location permission:', error);
    return false;
  }
};

export const checkCameraPermission = async (): Promise<boolean> => {
  try {
    const { status } = await ImagePicker.getCameraPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking camera permission:', error);
    return false;
  }
};

export const checkMediaLibraryPermission = async (): Promise<boolean> => {
  try {
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking media library permission:', error);
    return false;
  }
};

export const checkNotificationPermission = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return false;
  }
};