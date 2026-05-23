import { storage, StorageKeys } from './storage';

const API_BASE_URL = 'http://10.106.57.252:5000/api/v1';

async function getAuthHeader() {
  const token = await storage.getItem<string>(StorageKeys.AUTH_TOKEN);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async post<T>(endpoint: string, body: any): Promise<T> {
    const authHeader = await getAuthHeader();
    const isFormData = body instanceof FormData;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...authHeader,
      },
      body: isFormData ? body : JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async put<T>(endpoint: string, body: any): Promise<T> {
    const authHeader = await getAuthHeader();
    const isFormData = body instanceof FormData;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...authHeader,
      },
      body: isFormData ? body : JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async patch<T>(endpoint: string, body: any): Promise<T> {
    const authHeader = await getAuthHeader();
    const isFormData = body instanceof FormData;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...authHeader,
      },
      body: isFormData ? body : JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async delete<T>(endpoint: string): Promise<T> {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },
};
