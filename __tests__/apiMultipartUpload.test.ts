// Expo's global fetch rejects React Native file parts ("Unsupported FormDataPart
// implementation"), so multipart bodies must go through XMLHttpRequest.
global.fetch = jest.fn();

jest.mock('../utils/storage', () => ({
  storage: { getItem: jest.fn().mockResolvedValue('token-123'), setItem: jest.fn(), removeItem: jest.fn() },
  StorageKeys: { AUTH_TOKEN: 'auth_token', REFRESH_TOKEN: 'refresh_token', USER_DATA: 'user_data' },
}));

import { api } from '../utils/api';

class FakeXhr {
  static last: FakeXhr;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  statusText = '';
  responseText = '';
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  constructor() { FakeXhr.last = this; }
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(key: string, value: string) { this.headers[key] = value; }
  abort() {}
  send(body: unknown) { this.body = body; }
  respond(status: number, text: string) {
    this.status = status;
    this.statusText = status === 200 ? 'OK' : 'Bad Request';
    this.responseText = text;
    this.onload?.();
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('multipart uploads', () => {
  const realXhr = global.XMLHttpRequest;
  beforeAll(() => { (global as any).XMLHttpRequest = FakeXhr; });
  afterAll(() => { (global as any).XMLHttpRequest = realXhr; });
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, 'error').mockImplementation(() => {}); });

  const fileForm = () => {
    const form = new FormData();
    form.append('file', { uri: 'file:///licence.jpg', name: 'licence.jpg', type: 'image/jpeg' } as any);
    return form;
  };

  it('sends FormData via XMLHttpRequest with auth and without a fixed content type', async () => {
    const form = fileForm();
    const pending = api.post<{ documentId: string }>('/Verification/license', form);
    await flush();

    const xhr = FakeXhr.last;
    expect(global.fetch).not.toHaveBeenCalled();
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toMatch(/\/Verification\/license$/);
    expect(xhr.headers.Authorization).toBe('Bearer token-123');
    expect(Object.keys(xhr.headers).map((k) => k.toLowerCase())).not.toContain('content-type');
    expect(xhr.body).toBe(form);

    xhr.respond(200, JSON.stringify({ documentId: 'd1' }));
    await expect(pending).resolves.toEqual({ documentId: 'd1' });
  });

  it('surfaces the server error message', async () => {
    const pending = api.post('/Verification/license', fileForm());
    await flush();
    FakeXhr.last.respond(400, JSON.stringify({ message: 'Unsupported file. Upload a JPG, PNG, WEBP image or a PDF.' }));
    await expect(pending).rejects.toThrow('Unsupported file. Upload a JPG, PNG, WEBP image or a PDF.');
  });

  it('reports network failures', async () => {
    const pending = api.post('/Verification/license', fileForm());
    await flush();
    FakeXhr.last.onerror?.();
    await expect(pending).rejects.toThrow('Network request failed');
  });

  it('keeps JSON bodies on fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve('{}') });
    await api.post('/rides/x/start', {});
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
