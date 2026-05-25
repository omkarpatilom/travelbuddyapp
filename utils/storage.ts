import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
  AUTH_TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
  THEME_PREFERENCE: 'themePreference',
  RECENT_LOCATIONS: 'recentLocations',
  SEARCH_HISTORY: 'searchHistory',
  RIDE_PREFERENCES: 'ridePreferences',
  NOTIFICATION_SETTINGS: 'notificationSettings',
  EMERGENCY_CONTACTS: 'emergencyContacts',
  SAFETY_SETTINGS: 'safetySettings',
  VERIFICATION_DOCUMENTS: 'verificationDocuments',
} as const;

export const storage = {
  async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error(`Error storing ${key}:`, error);
      throw error;
    }
  },

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`Error retrieving ${key}:`, error);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      throw error;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },

  async getAllKeys(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return [...keys];
    } catch (error) {
      console.error('Error getting all keys:', error);
      return [];
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      return [...pairs];
    } catch (error) {
      console.error('Error getting multiple items:', error);
      return [];
    }
  },

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    try {
      await AsyncStorage.multiSet(keyValuePairs);
    } catch (error) {
      console.error('Error setting multiple items:', error);
      throw error;
    }
  },
};

// Utility functions for common storage operations
export const storeUserData = (userData: any) => 
  storage.setItem(StorageKeys.USER_DATA, userData);

export const getUserData = () => 
  storage.getItem(StorageKeys.USER_DATA);

export const storeAuthToken = (token: string) => 
  storage.setItem(StorageKeys.AUTH_TOKEN, token);

export const getAuthToken = () => 
  storage.getItem<string>(StorageKeys.AUTH_TOKEN);

export const storeRefreshToken = (token: string) => 
  storage.setItem(StorageKeys.REFRESH_TOKEN, token);

export const getRefreshToken = () => 
  storage.getItem<string>(StorageKeys.REFRESH_TOKEN);

export const clearAuthData = async () => {
  await Promise.all([
    storage.removeItem(StorageKeys.AUTH_TOKEN),
    storage.removeItem(StorageKeys.REFRESH_TOKEN),
    storage.removeItem(StorageKeys.USER_DATA),
  ]);
};