import * as SQLite from 'expo-sqlite';

const isTestEnv = typeof jest !== 'undefined' || process.env.NODE_ENV === 'test';

// Local memory mock tables for Jest testing
const mockTables: Record<string, any[]> = {
  RideSearchHistory: [],
  SavedLocations: [],
  FavoriteDestinations: [],
  RideCache: [],
  NotificationHistory: []
};

// SQLite mock for Test Environment
class MockDatabase {
  async execAsync(sql: string): Promise<void> {
    // Simulates running setup queries
    return Promise.resolve();
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowId: number }> {
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('insert into savedlocations')) {
      const [id, address, latitude, longitude, alias, timestamp] = params;
      mockTables.SavedLocations = mockTables.SavedLocations.filter(x => x.id !== id);
      mockTables.SavedLocations.push({ id, address, latitude, longitude, alias, timestamp });
    } else if (sqlLower.includes('insert into favoritedestinations')) {
      const [id, name, latitude, longitude, timestamp] = params;
      mockTables.FavoriteDestinations = mockTables.FavoriteDestinations.filter(x => x.id !== id);
      mockTables.FavoriteDestinations.push({ id, name, latitude, longitude, timestamp });
    } else if (sqlLower.includes('insert into ridesearchhistory')) {
      const [id, queryText, timestamp] = params;
      mockTables.RideSearchHistory = mockTables.RideSearchHistory.filter(x => x.id !== id);
      mockTables.RideSearchHistory.push({ id, queryText, timestamp });
    } else if (sqlLower.includes('insert into ridecache')) {
      const [id, searchKey, dataJson, timestamp] = params;
      mockTables.RideCache = mockTables.RideCache.filter(x => x.id !== id);
      mockTables.RideCache.push({ id, searchKey, dataJson, timestamp });
    } else if (sqlLower.includes('insert into notificationhistory')) {
      const [id, dataJson, isRead, timestamp] = params;
      mockTables.NotificationHistory = mockTables.NotificationHistory.filter(x => x.id !== id);
      mockTables.NotificationHistory.push({ id, dataJson, isRead, timestamp });
    } else if (sqlLower.includes('delete from')) {
      const tableMatch = sql.match(/delete from (\w+)/i);
      const conditionMatch = sql.match(/where (\w+)\s*=\s*\?/i);
      if (tableMatch) {
        const table = tableMatch[1];
        if (conditionMatch && params.length > 0) {
          const col = conditionMatch[1];
          mockTables[table] = mockTables[table].filter(x => x[col] !== params[0]);
        } else {
          mockTables[table] = [];
        }
      }
    } else if (sqlLower.includes('update notificationhistory')) {
      // SET isRead = ? WHERE id = ?
      const [isRead, id] = params;
      const item = mockTables.NotificationHistory.find(x => x.id === id);
      if (item) {
        item.isRead = isRead;
      }
    }

    return { changes: 1, lastInsertRowId: 1 };
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('select * from savedlocations')) {
      return Promise.resolve(mockTables.SavedLocations as unknown as T[]);
    } else if (sqlLower.includes('select * from favoritedestinations')) {
      return Promise.resolve(mockTables.FavoriteDestinations as unknown as T[]);
    } else if (sqlLower.includes('select * from ridesearchhistory')) {
      const list = [...mockTables.RideSearchHistory];
      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return Promise.resolve(list as unknown as T[]);
    } else if (sqlLower.includes('select * from ridecache')) {
      const searchKey = params[0];
      const match = mockTables.RideCache.filter(x => x.searchKey === searchKey);
      return Promise.resolve(match as unknown as T[]);
    } else if (sqlLower.includes('select * from notificationhistory')) {
      const list = [...mockTables.NotificationHistory];
      list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return Promise.resolve(list as unknown as T[]);
    }
    
    return Promise.resolve([]);
  }

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, params);
    return all.length > 0 ? all[0] : null;
  }
}

let databaseInstance: any = null;

export const getDB = () => {
  if (databaseInstance) return databaseInstance;

  if (isTestEnv) {
    databaseInstance = new MockDatabase();
  } else {
    databaseInstance = SQLite.openDatabaseSync('travelbuddy.db');
  }

  return databaseInstance;
};

// Initialize database schema
export const initSQLiteDB = async (): Promise<void> => {
  const db = getDB();
  try {
    // 1. RideSearchHistory Table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS RideSearchHistory (
        id TEXT PRIMARY KEY,
        queryText TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);

    // 2. SavedLocations Table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS SavedLocations (
        id TEXT PRIMARY KEY,
        address TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        alias TEXT,
        timestamp TEXT NOT NULL
      );
    `);

    // 3. FavoriteDestinations Table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS FavoriteDestinations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);

    // 4. RideCache Table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS RideCache (
        id TEXT PRIMARY KEY,
        searchKey TEXT NOT NULL,
        dataJson TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);

    // 5. NotificationHistory Table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS NotificationHistory (
        id TEXT PRIMARY KEY,
        dataJson TEXT NOT NULL,
        isRead INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL
      );
    `);

    console.log('SQLite schemas verified / initialized successfully');
  } catch (error) {
    console.error('Failed to initialize SQLite schemas:', error);
  }
};

// Location cache queries
export const sqliteStorage = {
  // Saved locations
  async saveLocation(location: { id: string; address: string; latitude: number; longitude: number; alias?: string }): Promise<void> {
    const db = getDB();
    const timestamp = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO SavedLocations (id, address, latitude, longitude, alias, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET address=excluded.address, latitude=excluded.latitude, longitude=excluded.longitude, alias=excluded.alias, timestamp=excluded.timestamp;`,
      [location.id, location.address, location.latitude, location.longitude, location.alias || null, timestamp]
    );
  },

  async getSavedLocations(): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync('SELECT * FROM SavedLocations ORDER BY timestamp DESC;');
  },

  async deleteSavedLocation(id: string): Promise<void> {
    const db = getDB();
    await db.runAsync('DELETE FROM SavedLocations WHERE id = ?;', [id]);
  },

  // Favorite Destinations
  async saveFavoriteDestination(fav: { id: string; name: string; latitude: number; longitude: number }): Promise<void> {
    const db = getDB();
    const timestamp = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO FavoriteDestinations (id, name, latitude, longitude, timestamp)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, latitude=excluded.latitude, longitude=excluded.longitude, timestamp=excluded.timestamp;`,
      [fav.id, fav.name, fav.latitude, fav.longitude, timestamp]
    );
  },

  async getFavoriteDestinations(): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync('SELECT * FROM FavoriteDestinations ORDER BY timestamp DESC;');
  },

  async deleteFavoriteDestination(id: string): Promise<void> {
    const db = getDB();
    await db.runAsync('DELETE FROM FavoriteDestinations WHERE id = ?;', [id]);
  },

  // Ride Search History
  async addSearchHistory(queryText: string): Promise<void> {
    const db = getDB();
    const id = new Date().getTime().toString();
    const timestamp = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO RideSearchHistory (id, queryText, timestamp) VALUES (?, ?, ?);',
      [id, queryText, timestamp]
    );
    
    // Maintain max limit of 10 items in history
    const history = await db.getAllAsync<{ id: string }>('SELECT id FROM RideSearchHistory ORDER BY timestamp DESC;');
    if (history.length > 10) {
      const toDeleteIds = history.slice(10).map((x) => x.id);
      for (const delId of toDeleteIds) {
        await db.runAsync('DELETE FROM RideSearchHistory WHERE id = ?;', [delId]);
      }
    }
  },

  async getSearchHistory(): Promise<any[]> {
    const db = getDB();
    return await db.getAllAsync('SELECT * FROM RideSearchHistory ORDER BY timestamp DESC;');
  },

  async clearSearchHistory(): Promise<void> {
    const db = getDB();
    await db.runAsync('DELETE FROM RideSearchHistory;');
  },

  // Ride API Result Cache
  async cacheRides(searchKey: string, rides: any[]): Promise<void> {
    const db = getDB();
    const id = searchKey;
    const timestamp = new Date().toISOString();
    const dataJson = JSON.stringify(rides);
    await db.runAsync(
      `INSERT INTO RideCache (id, searchKey, dataJson, timestamp)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET dataJson=excluded.dataJson, timestamp=excluded.timestamp;`,
      [id, searchKey, dataJson, timestamp]
    );
  },

  async getCachedRides(searchKey: string): Promise<any[] | null> {
    const db = getDB();
    const cached = await db.getFirstAsync<{ dataJson: string; timestamp: string }>(
      'SELECT dataJson, timestamp FROM RideCache WHERE searchKey = ?;',
      [searchKey]
    );
    if (!cached) return null;

    // Check 5 minutes cache TTL
    const cacheTime = new Date(cached.timestamp).getTime();
    const now = new Date().getTime();
    if (now - cacheTime > 5 * 60 * 1000) {
      await db.runAsync('DELETE FROM RideCache WHERE searchKey = ?;', [searchKey]);
      return null;
    }

    try {
      return JSON.parse(cached.dataJson);
    } catch {
      return null;
    }
  },

  // Notification Cache
  async cacheNotifications(notifications: any[]): Promise<void> {
    const db = getDB();
    const timestamp = new Date().toISOString();
    
    // Clear old cache before writing new notifications to avoid duplicates or infinite storage growth
    await db.runAsync('DELETE FROM NotificationHistory;');

    for (const notif of notifications) {
      const isRead = notif.isRead ? 1 : 0;
      await db.runAsync(
        'INSERT INTO NotificationHistory (id, dataJson, isRead, timestamp) VALUES (?, ?, ?, ?);',
        [notif.id, JSON.stringify(notif), isRead, timestamp]
      );
    }
  },

  async getCachedNotifications(): Promise<any[]> {
    const db = getDB();
    const rows = await db.getAllAsync<{ dataJson: string }>('SELECT dataJson FROM NotificationHistory ORDER BY timestamp DESC;');
    const results: any[] = [];
    for (const row of rows) {
      try {
        results.push(JSON.parse(row.dataJson));
      } catch {}
    }
    return results;
  },

  async updateNotificationReadStatus(id: string, isRead: boolean): Promise<void> {
    const db = getDB();
    const isReadInt = isRead ? 1 : 0;
    
    // Update local cache table value
    await db.runAsync('UPDATE NotificationHistory SET isRead = ? WHERE id = ?;', [isReadInt, id]);
    
    // Also update the JSON content stored in database
    const cached = await db.getFirstAsync<{ dataJson: string }>('SELECT dataJson FROM NotificationHistory WHERE id = ?;', [id]);
    if (cached) {
      try {
        const data = JSON.parse(cached.dataJson);
        data.isRead = isRead;
        await db.runAsync('UPDATE NotificationHistory SET dataJson = ? WHERE id = ?;', [JSON.stringify(data), id]);
      } catch {}
    }
  },

  // Logout clear
  async clearAuthRelatedCache(): Promise<void> {
    const db = getDB();
    await db.runAsync('DELETE FROM RideCache;');
    await db.runAsync('DELETE FROM NotificationHistory;');
    // We retain search history and saved/favorite locations as per guidelines.
  }
};
