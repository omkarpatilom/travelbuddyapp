import { storage, StorageKeys } from './storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  console.warn('EXPO_PUBLIC_API_URL is not defined in environment variables');
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

// Safe response JSON parser that handles empty responses (e.g. 204 No Content) and plain-text
async function handleResponse<T>(response: Response, endpoint: string): Promise<T> {
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
    // If it's not valid JSON, return as plain text (casted to T)
    return text as unknown as T;
  }
}

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const headers = await getApiHeaders(false);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(id);

      return handleResponse<T>(response, endpoint);
    } catch (e: any) {
      clearTimeout(id);
      if (e.name === 'AbortError') throw new Error('Request Timeout');
      throw e;
    }
  },

  async post<T>(endpoint: string, body: any): Promise<T> {
    const isFormData = body instanceof FormData;
    const headers = await getApiHeaders(isFormData);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: isFormData ? body : JSON.stringify(body),
    });

    return handleResponse<T>(response, endpoint);
  },

  async put<T>(endpoint: string, body: any): Promise<T> {
    const isFormData = body instanceof FormData;
    const headers = await getApiHeaders(isFormData);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: isFormData ? body : JSON.stringify(body),
    });

    return handleResponse<T>(response, endpoint);
  },

  async patch<T>(endpoint: string, body: any): Promise<T> {
    const isFormData = body instanceof FormData;
    const headers = await getApiHeaders(isFormData);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: isFormData ? body : JSON.stringify(body),
    });

    return handleResponse<T>(response, endpoint);
  },

  async delete<T>(endpoint: string): Promise<T> {
    const headers = await getApiHeaders(false);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });

    return handleResponse<T>(response, endpoint);
  },
};
