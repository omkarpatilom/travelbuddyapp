import { storage, StorageKeys } from './storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// The backend currently runs against a remote DB with real-world response
// times of several seconds, sometimes 20s+, for legitimate requests (not a
// hang - confirmed against live traffic). 10s was aborting requests that
// were still going to succeed, e.g. ride search. Revisit downward once the
// backend latency issue itself is fixed.
const REQUEST_TIMEOUT_MS = 30000;
// Writes carrying FormData (file/photo uploads) can legitimately take longer
// than a plain JSON request on a slow connection - give them more room before
// aborting instead of reusing the same bound as everything else.
const UPLOAD_TIMEOUT_MS = 60000;

if (!process.env.EXPO_PUBLIC_API_URL && process.env.NODE_ENV !== 'test') {
  console.warn(
    'EXPO_PUBLIC_API_URL is not defined in environment variables. Falling back to default URL.',
  );
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await storage.getItem<string>(StorageKeys.AUTH_TOKEN);
  if (token) {
    console.log('Sending Token:', token.substring(0, 10) + '...');
    return { Authorization: `Bearer ${token}` };
  }
  console.log('No Token found in storage');
  return {};
}

// Helper to bundle standard headers and bypass ngrok warning pages in Expo Go
async function getApiHeaders(
  isFormData = false,
): Promise<Record<string, string>> {
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

/** The parts of a fetch Response that handleResponse relies on. */
type ApiResponse = Pick<Response, 'ok' | 'status' | 'statusText' | 'text'>;

/**
 * Multipart uploads go through React Native's native XMLHttpRequest. Expo's
 * fetch (the global fetch since the winter runtime) cannot serialise React
 * Native file parts ({ uri, name, type }) and fails with "Unsupported
 * FormDataPart implementation"; XHR streams the file from its uri natively.
 */
function sendMultipart(
  url: string,
  init: { method: string; headers: Record<string, string>; body: FormData; signal: AbortSignal },
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method, url);
    // The multipart boundary header is set by XHR itself.
    Object.entries(init.headers).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'content-type') xhr.setRequestHeader(key, value);
    });

    const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });
    if (init.signal.aborted) return reject(abortError());
    init.signal.addEventListener('abort', () => {
      xhr.abort();
      reject(abortError());
    });

    xhr.onload = () => {
      const body = xhr.responseText ?? '';
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        text: () => Promise.resolve(body),
      });
    };
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.ontimeout = () => reject(abortError());
    xhr.send(init.body);
  });
}

function send(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: any; signal: AbortSignal },
): Promise<ApiResponse> {
  return init.body instanceof FormData
    ? sendMultipart(url, init as Parameters<typeof sendMultipart>[1])
    : fetch(url, init);
}

// Safe response JSON parser
async function handleResponse<T>(
  response: ApiResponse,
  endpoint: string,
  originalRequest?: () => Promise<T>,
): Promise<T> {
  if (
    response.status === 401 &&
    !endpoint.includes('/auth/login') &&
    !endpoint.includes('/auth/refresh-token')
  ) {
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
        errorMessage = extractErrorMessage(errorData) || errorMessage;
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

/**
 * Pulls a human-readable message out of a backend error body. The .NET services
 * answer with ProblemDetails (message in `title`, validation errors in `errors`)
 * or `{ message }` / `{ Message }`. `detail` is ignored: in development it holds
 * a server stack trace.
 */
function extractErrorMessage(errorData: any): string | undefined {
  if (!errorData || typeof errorData !== 'object') return undefined;
  if (errorData.errors && typeof errorData.errors === 'object') {
    for (const messages of Object.values(errorData.errors)) {
      if (Array.isArray(messages) && typeof messages[0] === 'string') return messages[0];
    }
  }
  const candidates = [errorData.message, errorData.Message, errorData.error, errorData.title];
  // "Bad Request"-style titles carry no information; prefer anything more specific.
  return candidates.find(
    (c) => typeof c === 'string' && c.trim() !== '' && !/^(bad request|not found|unauthorized|forbidden)$/i.test(c.trim())
  );
}

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const execute = async (): Promise<T> => {
      const headers = await getApiHeaders(false);
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        clearTimeout(id);
        if (response.status === 404) return null;
        return handleResponse<T>(
          response,
          endpoint,
          execute as () => Promise<T>,
        );
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
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), isFormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

      try {
        const response = await send(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers,
          body: isFormData ? body : JSON.stringify(body),
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

  async put<T>(endpoint: string, body: any): Promise<T> {
    const execute = async (): Promise<T> => {
      const isFormData = body instanceof FormData;
      const headers = await getApiHeaders(isFormData);
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), isFormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

      try {
        const response = await send(`${API_BASE_URL}${endpoint}`, {
          method: 'PUT',
          headers,
          body: isFormData ? body : JSON.stringify(body),
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

  async patch<T>(endpoint: string, body: any): Promise<T> {
    const execute = async (): Promise<T> => {
      const isFormData = body instanceof FormData;
      const headers = await getApiHeaders(isFormData);
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), isFormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

      try {
        const response = await send(`${API_BASE_URL}${endpoint}`, {
          method: 'PATCH',
          headers,
          body: isFormData ? body : JSON.stringify(body),
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

  async delete<T>(endpoint: string): Promise<T> {
    const execute = async (): Promise<T> => {
      const headers = await getApiHeaders(false);
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'DELETE',
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
};
