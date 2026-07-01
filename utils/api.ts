import { storage, StorageKeys } from './storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.7:5000/api/v1';

if (!process.env.EXPO_PUBLIC_API_URL && process.env.NODE_ENV !== 'test') {
  console.warn('EXPO_PUBLIC_API_URL is not defined in environment variables. Falling back to default URL.');
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await storage.getItem<string>(StorageKeys.AUTH_TOKEN);
  if (token) {
    console.log('Sending Token:', token.substring(0, 10) + '...');
    return { 'Authorization': `Bearer ${token}` };
  }
  console.log('No Token found in storage');
  return {};
}

// Helper to bundle standard headers and bypass ngrok warning pages in Expo Go
async function getApiHeaders(isFormData = false): Promise<Record<string, string>> {
  const authHeader = await getAuthHeader();
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
    ...authHeader,
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
}

async function handleRefreshToken(): Promise<string | null> {
  const accessToken = await storage.getItem<string>(StorageKeys.AUTH_TOKEN);
  const refreshToken = await storage.getItem<string>(StorageKeys.REFRESH_TOKEN);

  if (!accessToken || !refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ token: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.accessToken) {
        await storage.setItem(StorageKeys.AUTH_TOKEN, data.accessToken);
        if (data.refreshToken) {
          await storage.setItem(StorageKeys.REFRESH_TOKEN, data.refreshToken);
        }
        return data.accessToken;
      }
    }
    return null;
  } catch (error) {
    console.error('Refresh token error:', error);
    return null;
  }
}

// Safe response JSON parser
async function handleResponse<T>(response: Response, endpoint: string, originalRequest?: () => Promise<T>): Promise<T> {
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh-token')) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await handleRefreshToken();
      isRefreshing = false;
      if (newToken) {
        onRefreshed(newToken);
        if (originalRequest) return originalRequest();
      }
    } else {
      return new Promise((resolve) => {
        subscribeTokenRefresh((token) => {
          resolve(originalRequest!());
        });
      });
    }
  }

  const text = await response.text().catch(() => '');
  
  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      if (text) {
        const errorData = JSON.parse(text);
        errorMessage = errorData.message || errorData.error || errorMessage;
      }
    } catch {}
    console.error(`Request Failed: ${endpoint}`, response.status, text);
    throw new Error(errorMessage);
  }

  if (!text || text.trim() === '') {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    return text as unknown as T;
  }
}

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const execute = async (): Promise<T> => {
      const headers = await getApiHeaders(false);
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        clearTimeout(id);
        return handleResponse<T>(response, endpoint, execute);
      } catch (e: any) {
        clearTimeout(id);
        if (e.name === 'AbortError') throw new Error('Request Timeout');
        throw e;
      }
    };
    return execute();
  },

  // Like get<T> but returns null on 404 instead of throwing — use for optional lookups
  async getOrNull<T>(endpoint: string): Promise<T | null> {
    const execute = async (): Promise<T | null> => {
      const headers = await getApiHeaders(false);
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        clearTimeout(id);
        if (response.status === 404) return null;
        return handleResponse<T>(response, endpoint, execute as () => Promise<T>);
      } catch (e: any) {
        clearTimeout(id);
        if (e.name === 'AbortError') throw new Error('Request Timeout');
        throw e;
      }
    };
    return execute();
  },

  async post<T>(endpoint: string, body: any): Promise<T> {
    const execute = async (): Promise<T> => {
      const isFormData = body instanceof FormData;
      const headers = await getApiHeaders(isFormData);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: isFormData ? body : JSON.stringify(body),
      });

      return handleResponse<T>(response, endpoint, execute);
    };
    return execute();
  },

  async put<T>(endpoint: string, body: any): Promise<T> {
    const execute = async (): Promise<T> => {
      const isFormData = body instanceof FormData;
      const headers = await getApiHeaders(isFormData);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers,
        body: isFormData ? body : JSON.stringify(body),
      });

      return handleResponse<T>(response, endpoint, execute);
    };
    return execute();
  },

  async patch<T>(endpoint: string, body: any): Promise<T> {
    const execute = async (): Promise<T> => {
      const isFormData = body instanceof FormData;
      const headers = await getApiHeaders(isFormData);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers,
        body: isFormData ? body : JSON.stringify(body),
      });

      return handleResponse<T>(response, endpoint, execute);
    };
    return execute();
  },

  async delete<T>(endpoint: string): Promise<T> {
    const execute = async (): Promise<T> => {
      const headers = await getApiHeaders(false);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers,
      });

      return handleResponse<T>(response, endpoint, execute);
    };
    return execute();
  },
};
