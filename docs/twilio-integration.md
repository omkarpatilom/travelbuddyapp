# Twilio SMS Integration Guide

## Overview

This guide provides step-by-step instructions for integrating Twilio SMS service with the TravelBuddy phone authentication system.

## Prerequisites

1. Twilio Account (sign up at https://www.twilio.com)
2. Verified phone number for testing
3. Twilio Account SID and Auth Token

## Setup Instructions

### 1. Install Twilio SDK

```bash
npm install twilio
```

### 2. Environment Configuration

Add the following environment variables to your `.env` file:

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid (optional)
```

### 3. Twilio Service Implementation

Create `utils/twilioService.ts`:

```typescript
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhoneNumber) {
  throw new Error('Twilio credentials not configured');
}

const client = twilio(accountSid, authToken);

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class TwilioService {
  /**
   * Send SMS using Twilio
   */
  static async sendSMS(to: string, message: string): Promise<SMSResult> {
    try {
      const result = await client.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: to,
      });

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error) {
      console.error('Twilio SMS error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send OTP using Twilio Verify Service (recommended for production)
   */
  static async sendVerificationCode(phoneNumber: string): Promise<SMSResult> {
    try {
      const verification = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verifications.create({
          to: phoneNumber,
          channel: 'sms',
        });

      return {
        success: verification.status === 'pending',
        messageId: verification.sid,
      };
    } catch (error) {
      console.error('Twilio Verify error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify OTP using Twilio Verify Service
   */
  static async verifyCode(phoneNumber: string, code: string): Promise<SMSResult> {
    try {
      const verificationCheck = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verificationChecks.create({
          to: phoneNumber,
          code: code,
        });

      return {
        success: verificationCheck.status === 'approved',
        messageId: verificationCheck.sid,
      };
    } catch (error) {
      console.error('Twilio Verify check error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

### 4. Update Phone Auth Service

Update `utils/phoneAuth.ts` to use Twilio:

```typescript
import { TwilioService } from './twilioService';

// Replace the sendSMS method in PhoneAuthService class
private async sendSMS(phoneNumber: string, otp: string): Promise<PhoneAuthResponse> {
  try {
    const message = `Your TravelBuddy verification code is: ${otp}. This code expires in ${this.config.otpExpiration} minutes. Do not share this code with anyone.`;
    
    const result = await TwilioService.sendSMS(phoneNumber, message);
    
    if (result.success) {
      return { success: true, message: 'OTP sent successfully' };
    } else {
      return { 
        success: false, 
        message: 'Failed to send OTP', 
        error: result.error 
      };
    }
  } catch (error) {
    console.error('SMS sending failed:', error);
    return { 
      success: false, 
      message: 'Failed to send OTP', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
```

## Twilio Verify Service (Recommended)

For production applications, use Twilio's Verify service which provides:
- Built-in rate limiting
- Fraud protection
- Multiple delivery channels (SMS, Voice, Email)
- Automatic retry logic
- Analytics and monitoring

### Setup Verify Service

1. Go to Twilio Console → Verify → Services
2. Create a new Verify Service
3. Configure settings:
   - Code length: 6 digits
   - Code expiration: 5 minutes
   - Max attempts: 3
   - Rate limiting: Enabled

### Using Verify Service

```typescript
// For registration/login initiation
const result = await TwilioService.sendVerificationCode(phoneNumber);

// For OTP verification
const verifyResult = await TwilioService.verifyCode(phoneNumber, enteredOTP);
```

## Error Handling

### Common Twilio Error Codes

- `21211`: Invalid phone number
- `21614`: Phone number is not a valid mobile number
- `21408`: Permission to send SMS has not been enabled
- `20003`: Authentication error
- `21610`: Message cannot be sent to the destination number

### Error Handling Implementation

```typescript
export function handleTwilioError(error: any): string {
  const errorCode = error.code;
  
  switch (errorCode) {
    case 21211:
    case 21614:
      return 'Invalid phone number format';
    case 21408:
      return 'SMS service temporarily unavailable';
    case 20003:
      return 'Service configuration error';
    case 21610:
      return 'Cannot send SMS to this number';
    default:
      return 'Failed to send verification code';
  }
}
```

## Testing

### Test Phone Numbers

Twilio provides test phone numbers for development:
- `+15005550006` - Valid mobile number
- `+15005550001` - Invalid phone number
- `+15005550007` - Number that cannot receive SMS

### Testing in Development

```typescript
// Add to your phone auth service for testing
private async sendSMS(phoneNumber: string, otp: string): Promise<PhoneAuthResponse> {
  // In development, log OTP instead of sending SMS
  if (process.env.NODE_ENV === 'development') {
    console.log(`Development OTP for ${phoneNumber}: ${otp}`);
    return { success: true, message: 'OTP sent successfully (development mode)' };
  }
  
  // Production SMS sending logic
  return await this.sendTwilioSMS(phoneNumber, otp);
}
```

## Cost Optimization

### 1. Use Verify Service
- More cost-effective than individual SMS
- Includes fraud protection
- Automatic optimization

### 2. Implement Smart Retry
```typescript
const MAX_RETRIES = 2;
let retryCount = 0;

while (retryCount < MAX_RETRIES) {
  const result = await TwilioService.sendSMS(phoneNumber, message);
  
  if (result.success) {
    break;
  }
  
  retryCount++;
  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
}
```

### 3. Regional Optimization
- Use local Twilio phone numbers for better delivery rates
- Consider regional SMS providers for specific countries

## Security Best Practices

### 1. Webhook Validation
```typescript
import { validateRequest } from 'twilio';

export function validateTwilioWebhook(req: any): boolean {
  const twilioSignature = req.headers['x-twilio-signature'];
  const url = `https://yourdomain.com${req.url}`;
  
  return validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    req.body,
    url,
    twilioSignature
  );
}
```

### 2. Rate Limiting
- Implement application-level rate limiting
- Use Twilio's built-in rate limiting
- Monitor for abuse patterns

### 3. Phone Number Validation
```typescript
import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';

const phoneUtil = PhoneNumberUtil.getInstance();

export function validatePhoneNumber(phoneNumber: string, countryCode?: string): boolean {
  try {
    const number = phoneUtil.parse(phoneNumber, countryCode);
    return phoneUtil.isValidNumber(number);
  } catch (error) {
    return false;
  }
}
```

## Monitoring and Analytics

### 1. Twilio Console Monitoring
- SMS delivery rates
- Error rates by country
- Cost analysis
- Usage patterns

### 2. Application Monitoring
```typescript
// Add metrics tracking
export class SMSMetrics {
  static trackSMSSent(phoneNumber: string, success: boolean) {
    // Track with your analytics service
    analytics.track('SMS_SENT', {
      success,
      country: this.getCountryFromPhone(phoneNumber),
      timestamp: new Date().toISOString(),
    });
  }
  
  static trackOTPVerified(phoneNumber: string, attempts: number) {
    analytics.track('OTP_VERIFIED', {
      attempts,
      country: this.getCountryFromPhone(phoneNumber),
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Troubleshooting

### Common Issues

1. **SMS not delivered**
   - Check phone number format
   - Verify Twilio account balance
   - Check carrier restrictions

2. **Authentication errors**
   - Verify Account SID and Auth Token
   - Check environment variable configuration

3. **Rate limiting**
   - Implement exponential backoff
   - Use Verify service for better limits

### Debug Mode

```typescript
// Enable debug logging
const client = twilio(accountSid, authToken, {
  logLevel: 'debug'
});
```

This integration guide provides a robust foundation for implementing Twilio SMS in your phone authentication system.