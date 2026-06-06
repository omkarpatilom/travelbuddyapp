import * as SecureStore from 'expo-secure-store';

// Helper to determine if we are running in Jest/Node test environment without Native SecureStore
const isTestEnv = typeof jest !== 'undefined' || process.env.NODE_ENV === 'test';

// Simple in-memory fallback for test environment
const mockMemoryStorage: Record<string, string> = {};

export const secureStore = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (isTestEnv) {
        mockMemoryStorage[key] = value;
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`SecureStore Error setting ${key}:`, error);
      // Fallback
      mockMemoryStorage[key] = value;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (isTestEnv) {
        return mockMemoryStorage[key] || null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`SecureStore Error getting ${key}:`, error);
      return mockMemoryStorage[key] || null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (isTestEnv) {
        delete mockMemoryStorage[key];
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`SecureStore Error removing ${key}:`, error);
      delete mockMemoryStorage[key];
    }
  }
};
