import { api } from '@/utils/api';

// Live Integration Test: Hitting ngrok -> API Gateway -> Backend Services -> Database
describe('TravelBuddy Live E2E Integration Test Suite', () => {
  const randomSuffix = Math.floor(Math.random() * 90000) + 10000;
  const testEmail = `e2e_jest_tester_${randomSuffix}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Jest E2E Tester';
  const testPhone = `9${randomSuffix}`;

  let authToken = '';
  let userId = '';

  beforeAll(() => {
    // Ensure we are pointing to the real ngrok domain in integration environment
    console.log('--------------------------------------------------');
    console.log('Starting Live E2E Integration Test...');
    console.log(`Target API Endpoint: ${process.env.EXPO_PUBLIC_API_URL || 'https://whippet-concise-ghastly.ngrok-free.app/api/v1'}`);
    console.log(`Test Email: ${testEmail}`);
    console.log('--------------------------------------------------');
  });

  it('1. User Registration Flow (UI -> API -> Ngrok -> Gateway -> UserService -> DB)', async () => {
    const payload = {
      fullName: testName,
      email: testEmail,
      phoneNumber: testPhone,
      password: testPassword,
      role: 2, // Passenger role
    };

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://whippet-concise-ghastly.ngrok-free.app/api/v1'}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(payload),
      });

      console.log(`Registration Response HTTP Status: ${response.status}`);
      expect(response.status).toBe(200);

      const data = await response.json();
      console.log('Registration Success, User registered in DB!');
      expect(data).toBeDefined();
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  });

  it('2. User Login Flow & JWT Token Capture', async () => {
    const payload = {
      email: testEmail,
      password: testPassword,
    };

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://whippet-concise-ghastly.ngrok-free.app/api/v1'}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.accessToken).toBeDefined();
      authToken = data.accessToken;
      console.log(`Captured JWT Token: ${authToken.substring(0, 20)}...`);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  });

  it('3. User Profile Fetching via Authenticated Request', async () => {
    expect(authToken).toBeTruthy();

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://whippet-concise-ghastly.ngrok-free.app/api/v1'}/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.email).toBe(testEmail);
      expect(data.fullName).toBe(testName);
      userId = data.id;
      console.log(`User Profile Verified! User ID in MySQL DB: ${userId}`);
    } catch (error) {
      console.error('Profile fetch failed:', error);
      throw error;
    }
  });

  it('4. User Preferences Update Flow', async () => {
    expect(authToken).toBeTruthy();

    const preferencesPayload = {
      allowMusic: true,
      allowSmoking: false,
      allowPets: true,
      preferredLanguage: 'EN',
    };

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://whippet-concise-ghastly.ngrok-free.app/api/v1'}/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(preferencesPayload),
      });

      expect([200, 204]).toContain(response.status);
      console.log('User Preferences successfully updated in microservice database!');
    } catch (error) {
      console.error('Preferences update failed:', error);
      throw error;
    }
  });
});
