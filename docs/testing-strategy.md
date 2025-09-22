# Phone Authentication Testing Strategy

## Overview

This document outlines a comprehensive testing strategy for the phone number authentication system, covering unit tests, integration tests, security tests, and end-to-end testing scenarios.

## Testing Framework Setup

### Dependencies
```json
{
  "devDependencies": {
    "@testing-library/react-native": "^12.0.0",
    "@testing-library/jest-native": "^5.4.0",
    "jest": "^29.0.0",
    "jest-expo": "^50.0.0",
    "react-test-renderer": "^18.0.0",
    "msw": "^1.0.0",
    "supertest": "^6.0.0"
  }
}
```

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)'
  ],
  collectCoverageFrom: [
    'utils/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## Unit Tests

### 1. Phone Validation Tests

```typescript
// __tests__/utils/phoneValidation.test.ts
import { PhoneValidator } from '@/utils/phoneValidation';

describe('PhoneValidator', () => {
  describe('validate', () => {
    test('should validate US phone numbers', () => {
      const result = PhoneValidator.validate('+1234567890');
      expect(result.isValid).toBe(true);
      expect(result.country).toBe('US');
      expect(result.type).toBe('mobile');
    });

    test('should reject invalid phone numbers', () => {
      const result = PhoneValidator.validate('123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle international formats', () => {
      const testCases = [
        { phone: '+44123456789', country: 'GB' },
        { phone: '+91123456789', country: 'IN' },
        { phone: '+61123456789', country: 'AU' },
      ];

      testCases.forEach(({ phone, country }) => {
        const result = PhoneValidator.validate(phone);
        expect(result.isValid).toBe(true);
        expect(result.country).toBe(country);
      });
    });

    test('should detect mobile vs landline', () => {
      const mobileResult = PhoneValidator.validate('+447123456789');
      expect(mobileResult.type).toBe('mobile');
      
      const landlineResult = PhoneValidator.validate('+442012345678');
      expect(landlineResult.type).toBe('landline');
    });
  });

  describe('validateForSMS', () => {
    test('should accept mobile numbers', () => {
      const result = PhoneValidator.validateForSMS('+1234567890');
      expect(result.isValid).toBe(true);
    });

    test('should reject landline numbers', () => {
      const result = PhoneValidator.validateForSMS('+442012345678');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('mobile');
    });
  });
});
```

### 2. Phone Auth Service Tests

```typescript
// __tests__/utils/phoneAuth.test.ts
import { phoneAuthService } from '@/utils/phoneAuth';

// Mock SMS service
jest.mock('@/utils/twilioService', () => ({
  TwilioService: {
    sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id' })
  }
}));

describe('PhoneAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateRegistration', () => {
    test('should send OTP for valid phone number', async () => {
      const result = await phoneAuthService.initiateRegistration('+1234567890');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('OTP sent');
      expect(result.data).toHaveProperty('phoneNumber');
      expect(result.data).toHaveProperty('expiresIn');
    });

    test('should reject invalid phone number', async () => {
      const result = await phoneAuthService.initiateRegistration('invalid');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid');
    });

    test('should prevent duplicate registration', async () => {
      // Mock existing user
      jest.spyOn(phoneAuthService as any, 'checkUserExists')
        .mockResolvedValue(true);

      const result = await phoneAuthService.initiateRegistration('+1234567890');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already registered');
    });
  });

  describe('verifyRegistrationOTP', () => {
    test('should verify correct OTP', async () => {
      // First initiate registration
      await phoneAuthService.initiateRegistration('+1234567890');
      
      // Mock the OTP (in real tests, you'd need to access the generated OTP)
      const mockOTP = '123456';
      jest.spyOn(phoneAuthService as any, 'otpRecords', 'get')
        .mockReturnValue(new Map([
          ['+1234567890', {
            phoneNumber: '+1234567890',
            otp: mockOTP,
            expiresAt: Date.now() + 300000,
            attempts: 0,
            verified: false
          }]
        ]));

      const result = await phoneAuthService.verifyRegistrationOTP(
        '+1234567890', 
        mockOTP, 
        { firstName: 'Test', lastName: 'User' }
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('user');
      expect(result.data).toHaveProperty('authToken');
    });

    test('should reject incorrect OTP', async () => {
      await phoneAuthService.initiateRegistration('+1234567890');
      
      const result = await phoneAuthService.verifyRegistrationOTP(
        '+1234567890', 
        '000000', 
        { firstName: 'Test', lastName: 'User' }
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid OTP');
    });

    test('should handle expired OTP', async () => {
      // Mock expired OTP
      jest.spyOn(phoneAuthService as any, 'otpRecords', 'get')
        .mockReturnValue(new Map([
          ['+1234567890', {
            phoneNumber: '+1234567890',
            otp: '123456',
            expiresAt: Date.now() - 1000, // Expired
            attempts: 0,
            verified: false
          }]
        ]));

      const result = await phoneAuthService.verifyRegistrationOTP(
        '+1234567890', 
        '123456', 
        { firstName: 'Test', lastName: 'User' }
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('expired');
    });
  });

  describe('rate limiting', () => {
    test('should enforce rate limits', async () => {
      const phoneNumber = '+1234567890';
      
      // Make multiple requests
      for (let i = 0; i < 4; i++) {
        await phoneAuthService.initiateRegistration(phoneNumber);
      }
      
      // Fourth request should be rate limited
      const result = await phoneAuthService.initiateRegistration(phoneNumber);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Too many attempts');
    });
  });
});
```

### 3. Component Tests

```typescript
// __tests__/components/PhoneInput.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PhoneInput from '@/components/PhoneInput';
import { ThemeProvider } from '@/contexts/ThemeContext';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('PhoneInput', () => {
  test('should render correctly', () => {
    const { getByPlaceholderText } = renderWithTheme(
      <PhoneInput value="" onChangeText={() => {}} />
    );
    
    expect(getByPlaceholderText('Phone number')).toBeTruthy();
  });

  test('should format phone number input', () => {
    const mockOnChange = jest.fn();
    const { getByPlaceholderText } = renderWithTheme(
      <PhoneInput value="" onChangeText={mockOnChange} />
    );
    
    const input = getByPlaceholderText('Phone number');
    fireEvent.changeText(input, '1234567890');
    
    expect(mockOnChange).toHaveBeenCalledWith('+11234567890');
  });

  test('should validate phone number', () => {
    const mockValidationChange = jest.fn();
    const { getByPlaceholderText } = renderWithTheme(
      <PhoneInput 
        value="+1234567890" 
        onChangeText={() => {}} 
        onValidationChange={mockValidationChange}
      />
    );
    
    expect(mockValidationChange).toHaveBeenCalledWith(
      expect.objectContaining({ isValid: true })
    );
  });
});
```

## Integration Tests

### 1. Authentication Flow Tests

```typescript
// __tests__/integration/authFlow.test.ts
import { phoneAuthService } from '@/utils/phoneAuth';
import { TwilioService } from '@/utils/twilioService';

// Mock external services
jest.mock('@/utils/twilioService');

describe('Authentication Flow Integration', () => {
  test('complete registration flow', async () => {
    const phoneNumber = '+1234567890';
    const userData = { firstName: 'John', lastName: 'Doe' };
    
    // Step 1: Initiate registration
    const initiateResult = await phoneAuthService.initiateRegistration(phoneNumber);
    expect(initiateResult.success).toBe(true);
    
    // Step 2: Verify OTP (mock the OTP)
    const mockOTP = '123456';
    // In real integration tests, you'd extract the OTP from the service
    
    const verifyResult = await phoneAuthService.verifyRegistrationOTP(
      phoneNumber, 
      mockOTP, 
      userData
    );
    
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.data.user.phoneNumber).toBe(phoneNumber);
    expect(verifyResult.data.authToken).toBeDefined();
  });

  test('complete login flow', async () => {
    const phoneNumber = '+1234567890';
    
    // Assume user already exists
    jest.spyOn(phoneAuthService as any, 'checkUserExists')
      .mockResolvedValue(true);
    
    // Step 1: Initiate login
    const initiateResult = await phoneAuthService.initiateLogin(phoneNumber);
    expect(initiateResult.success).toBe(true);
    
    // Step 2: Verify OTP
    const mockOTP = '123456';
    const verifyResult = await phoneAuthService.verifyLoginOTP(phoneNumber, mockOTP);
    
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.data.authToken).toBeDefined();
  });
});
```

### 2. Context Integration Tests

```typescript
// __tests__/integration/phoneAuthContext.test.tsx
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { PhoneAuthProvider, usePhoneAuth } from '@/contexts/PhoneAuthContext';

const TestComponent = () => {
  const { user, isAuthenticated, login } = usePhoneAuth();
  
  return (
    <div>
      <span testID="auth-status">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</span>
      <span testID="user-phone">{user?.phoneNumber || 'no-user'}</span>
    </div>
  );
};

describe('PhoneAuthContext Integration', () => {
  test('should manage authentication state', async () => {
    const { getByTestId } = render(
      <PhoneAuthProvider>
        <TestComponent />
      </PhoneAuthProvider>
    );
    
    expect(getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    
    // Test login flow
    await act(async () => {
      // Mock successful login
      // This would involve mocking the phoneAuthService
    });
    
    expect(getByTestId('auth-status')).toHaveTextContent('authenticated');
  });
});
```

## Security Tests

### 1. Rate Limiting Tests

```typescript
// __tests__/security/rateLimiting.test.ts
describe('Rate Limiting Security', () => {
  test('should block excessive OTP requests', async () => {
    const phoneNumber = '+1234567890';
    const results = [];
    
    // Make multiple rapid requests
    for (let i = 0; i < 5; i++) {
      const result = await phoneAuthService.initiateRegistration(phoneNumber);
      results.push(result);
    }
    
    // First 3 should succeed, rest should be blocked
    expect(results.slice(0, 3).every(r => r.success)).toBe(true);
    expect(results.slice(3).every(r => !r.success)).toBe(true);
  });

  test('should implement exponential backoff', async () => {
    const phoneNumber = '+1234567890';
    
    // Trigger rate limit
    for (let i = 0; i < 4; i++) {
      await phoneAuthService.initiateRegistration(phoneNumber);
    }
    
    const start = Date.now();
    const result = await phoneAuthService.initiateRegistration(phoneNumber);
    const duration = Date.now() - start;
    
    expect(result.success).toBe(false);
    expect(duration).toBeGreaterThan(1000); // Should have delay
  });
});
```

### 2. OTP Security Tests

```typescript
// __tests__/security/otpSecurity.test.ts
describe('OTP Security', () => {
  test('should generate cryptographically secure OTPs', () => {
    const otps = new Set();
    
    // Generate many OTPs and check for uniqueness
    for (let i = 0; i < 1000; i++) {
      const otp = phoneAuthService.generateOTP();
      expect(otp).toMatch(/^\d{6}$/);
      otps.add(otp);
    }
    
    // Should have high uniqueness (allowing for some collisions)
    expect(otps.size).toBeGreaterThan(950);
  });

  test('should expire OTPs after timeout', async () => {
    const phoneNumber = '+1234567890';
    
    await phoneAuthService.initiateRegistration(phoneNumber);
    
    // Mock time passage
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000); // 6 minutes
    
    const result = await phoneAuthService.verifyRegistrationOTP(
      phoneNumber, 
      '123456', 
      { firstName: 'Test' }
    );
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('expired');
  });

  test('should limit OTP verification attempts', async () => {
    const phoneNumber = '+1234567890';
    
    await phoneAuthService.initiateRegistration(phoneNumber);
    
    // Make multiple failed attempts
    for (let i = 0; i < 4; i++) {
      await phoneAuthService.verifyRegistrationOTP(
        phoneNumber, 
        '000000', 
        { firstName: 'Test' }
      );
    }
    
    const result = await phoneAuthService.verifyRegistrationOTP(
      phoneNumber, 
      '000000', 
      { firstName: 'Test' }
    );
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('Too many');
  });
});
```

## End-to-End Tests

### 1. User Journey Tests

```typescript
// __tests__/e2e/userJourney.test.ts
import { by, device, element, expect as detoxExpect } from 'detox';

describe('Phone Authentication E2E', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  test('should complete registration flow', async () => {
    // Navigate to registration
    await element(by.id('register-button')).tap();
    
    // Fill in user details
    await element(by.id('first-name-input')).typeText('John');
    await element(by.id('last-name-input')).typeText('Doe');
    await element(by.id('phone-input')).typeText('+1234567890');
    
    // Continue to OTP
    await element(by.id('continue-button')).tap();
    
    // Enter OTP (in test environment, use known test OTP)
    await element(by.id('otp-input')).typeText('123456');
    
    // Should navigate to home screen
    await detoxExpect(element(by.id('home-screen'))).toBeVisible();
  });

  test('should handle network errors gracefully', async () => {
    // Simulate network failure
    await device.setURLBlacklist(['*']);
    
    await element(by.id('register-button')).tap();
    await element(by.id('phone-input')).typeText('+1234567890');
    await element(by.id('continue-button')).tap();
    
    // Should show error message
    await detoxExpect(element(by.text('Network error'))).toBeVisible();
    
    // Restore network
    await device.setURLBlacklist([]);
  });
});
```

## Load Testing

### 1. Concurrent User Tests

```typescript
// __tests__/load/concurrentUsers.test.ts
describe('Load Testing', () => {
  test('should handle concurrent OTP requests', async () => {
    const phoneNumbers = Array.from({ length: 100 }, (_, i) => `+123456${i.toString().padStart(4, '0')}`);
    
    const promises = phoneNumbers.map(phone => 
      phoneAuthService.initiateRegistration(phone)
    );
    
    const results = await Promise.all(promises);
    
    // Most should succeed (allowing for some rate limiting)
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBeGreaterThan(80);
  });

  test('should maintain performance under load', async () => {
    const start = Date.now();
    
    const promises = Array.from({ length: 50 }, () => 
      phoneAuthService.initiateRegistration('+1234567890')
    );
    
    await Promise.all(promises);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });
});
```

## Test Data Management

### 1. Test Fixtures

```typescript
// __tests__/fixtures/phoneNumbers.ts
export const TEST_PHONE_NUMBERS = {
  valid: {
    us: '+1234567890',
    uk: '+447123456789',
    india: '+919876543210',
    australia: '+61412345678'
  },
  invalid: [
    '123',
    'invalid',
    '+1',
    '+123456789012345678', // Too long
    '+12345' // Too short
  ],
  landline: {
    us: '+12125551234',
    uk: '+442012345678'
  }
};

export const TEST_USERS = {
  john: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phoneNumber: '+1234567890'
  },
  jane: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    phoneNumber: '+1234567891'
  }
};
```

### 2. Mock Services

```typescript
// __tests__/mocks/twilioService.ts
export const mockTwilioService = {
  sendSMS: jest.fn().mockResolvedValue({ 
    success: true, 
    messageId: 'mock-message-id' 
  }),
  sendVerificationCode: jest.fn().mockResolvedValue({ 
    success: true, 
    messageId: 'mock-verification-id' 
  }),
  verifyCode: jest.fn().mockResolvedValue({ 
    success: true, 
    messageId: 'mock-check-id' 
  })
};
```

## Continuous Integration

### 1. GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Phone Authentication

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run security tests
      run: npm run test:security
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

## Test Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=__tests__/unit",
    "test:integration": "jest --testPathPattern=__tests__/integration",
    "test:security": "jest --testPathPattern=__tests__/security",
    "test:e2e": "detox test",
    "test:load": "jest --testPathPattern=__tests__/load",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

This comprehensive testing strategy ensures the phone authentication system is robust, secure, and performs well under various conditions.