// Verifies backend error bodies surface their real message instead of "API Error: 400".
global.fetch = jest.fn();

jest.mock('../utils/storage', () => ({
  storage: { getItem: jest.fn().mockResolvedValue('token'), setItem: jest.fn(), removeItem: jest.fn() },
  StorageKeys: { AUTH_TOKEN: 'auth_token', REFRESH_TOKEN: 'refresh_token', USER_DATA: 'user_data' },
}));

import { api } from '../utils/api';

const respond = (status: number, body: unknown) =>
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Bad Request',
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { get: () => null },
  });

describe('api error messages', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));

  it('uses the ProblemDetails title', async () => {
    respond(400, { title: 'Cannot start ride before at least one booking is accepted.', status: 400, detail: '   at StackTrace' });
    await expect(api.post('/rides/x/start', {})).rejects.toThrow('Cannot start ride before at least one booking is accepted.');
  });

  it('uses the first validation error over a generic title', async () => {
    respond(400, { title: 'One or more validation errors occurred.', errors: { Reason: ['Reason is required'] } });
    await expect(api.post('/bookings/x/cancel', {})).rejects.toThrow('Reason is required');
  });

  it('ignores a generic "Bad Request" title', async () => {
    respond(400, { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1', title: 'Bad Request', status: 400 });
    await expect(api.post('/rides/x/tracking', {})).rejects.toThrow('API Error: 400 Bad Request');
  });

  it('supports { Message } bodies', async () => {
    respond(404, { Message: 'Ride not found.' });
    await expect(api.get('/rides/x')).rejects.toThrow('Ride not found.');
  });
});
