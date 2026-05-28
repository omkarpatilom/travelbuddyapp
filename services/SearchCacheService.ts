import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@search_history';
const MAX_HISTORY = 10;

export interface CachedSearch {
  id: string;
  query: string;
  timestamp: string;
  results: any[];
}

export class SearchCacheService {
  static async saveSearch(query: string, results: any[]): Promise<void> {
    try {
      const existingStr = await AsyncStorage.getItem(CACHE_KEY);
      let history: CachedSearch[] = existingStr ? JSON.parse(existingStr) : [];

      // Only store top 5 results
      const topResults = results.slice(0, 5);

      const newEntry: CachedSearch = {
        id: new Date().getTime().toString(),
        query,
        timestamp: new Date().toISOString(),
        results: topResults,
      };

      history = [newEntry, ...history.filter(h => h.query !== query)].slice(0, MAX_HISTORY);
      
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save search cache', e);
    }
  }

  static async getHistory(): Promise<CachedSearch[]> {
    try {
      const existingStr = await AsyncStorage.getItem(CACHE_KEY);
      return existingStr ? JSON.parse(existingStr) : [];
    } catch (e) {
      console.error('Failed to get search cache', e);
      return [];
    }
  }

  static async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch (e) {
      console.error('Failed to clear search cache', e);
    }
  }
}
