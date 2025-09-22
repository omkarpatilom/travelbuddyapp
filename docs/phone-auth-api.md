# Phone Authentication API Documentation

## Overview

This document outlines the comprehensive phone number authentication system for TravelBuddy, including OTP-based registration and login flows.

## SMS Service Provider Recommendation

**Recommended Provider: Twilio**
- Industry-leading reliability (99.95% uptime)
- Global SMS delivery to 180+ countries
- Robust API with excellent documentation
- Advanced security features and fraud protection
- Competitive pricing with pay-as-you-go model

**Alternative Providers:**
- AWS SNS (good for AWS-integrated apps)
- Firebase Auth (easy integration with Firebase)
- MessageBird (good European coverage)

## API Endpoints

### 1. Initiate Registration

**Endpoint:** `POST /api/auth/register/initiate`

**Request:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP sent to your phone number",
  "data": {
    "phoneNumber": "+1234567890",
    "expiresIn": 5
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Phone number is already registered. Please login instead."
}
```

### 2. Verify Registration OTP

**Endpoint:** `POST /api/auth/register/verify`

**Request:**
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456",
  "userData": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "user_123",
      "phoneNumber": "+1234567890",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "verified": true,
      "createdAt": "2024-01-20T10:30:00Z"
    },
    "authToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Initiate Login

**Endpoint:** `POST /api/auth/login/initiate`

**Request:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP sent to your phone number",
  "data": {
    "phoneNumber": "+1234567890",
    "expiresIn": 5
  }
}
```

### 4. Verify Login OTP

**Endpoint:** `POST /api/auth/login/verify`

**Request:**
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_123",
      "phoneNumber": "+1234567890",
      "firstName": "John",
      "lastName": "Doe",
      "verified": true
    },
    "authToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 5. Resend OTP

**Endpoint:** `POST /api/auth/otp/resend`

**Request:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "New OTP sent to your phone number",
  "data": {
    "phoneNumber": "+1234567890",
    "expiresIn": 5
  }
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_phone_number (phone_number),
  INDEX idx_created_at (created_at)
);
```

### OTP Records Table
```sql
CREATE TABLE otp_records (
  id VARCHAR(36) PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INT DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_phone_number (phone_number),
  INDEX idx_expires_at (expires_at)
);
```

### Auth Attempts Table (Rate Limiting)
```sql
CREATE TABLE auth_attempts (
  id VARCHAR(36) PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  attempts INT DEFAULT 0,
  last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  blocked_until TIMESTAMP NULL,
  
  UNIQUE KEY unique_phone (phone_number),
  INDEX idx_phone_number (phone_number),
  INDEX idx_blocked_until (blocked_until)
);
```

## Security Considerations

### 1. Rate Limiting
- Maximum 3 OTP requests per 15-minute window per phone number
- Exponential backoff for repeated failures
- IP-based rate limiting for additional protection

### 2. OTP Security
- 6-digit numeric codes for balance of security and usability
- 5-minute expiration time
- Single-use tokens (invalidated after verification)
- Secure random generation using cryptographically strong methods

### 3. Phone Number Validation
- E.164 international format enforcement
- Country code validation
- Length and format checks
- Sanitization of input data

### 4. Brute Force Protection
- Limited OTP verification attempts (3 per OTP)
- Account lockout after multiple failed attempts
- Progressive delays between attempts
- Monitoring and alerting for suspicious activity

### 5. Data Protection
- Encrypted storage of sensitive data
- Automatic cleanup of expired OTP records
- Secure token generation and validation
- HTTPS enforcement for all API calls

### 6. SMS Security
- Use reputable SMS providers with fraud protection
- Monitor for SMS delivery failures and abuse
- Implement fallback mechanisms for SMS delivery issues
- Consider voice call backup for critical regions

## Error Handling

### Common Error Codes
- `INVALID_PHONE_NUMBER`: Phone number format is invalid
- `PHONE_ALREADY_REGISTERED`: Phone number already exists
- `PHONE_NOT_REGISTERED`: Phone number not found for login
- `RATE_LIMITED`: Too many requests, temporary block
- `OTP_EXPIRED`: OTP has expired, request new one
- `OTP_INVALID`: Incorrect OTP entered
- `OTP_ATTEMPTS_EXCEEDED`: Too many invalid OTP attempts
- `SMS_DELIVERY_FAILED`: Failed to send SMS
- `NETWORK_ERROR`: Temporary network or service issue

### Error Response Format
```json
{
  "success": false,
  "message": "User-friendly error message",
  "error": "TECHNICAL_ERROR_CODE",
  "details": {
    "field": "phoneNumber",
    "code": "INVALID_FORMAT"
  }
}
```

## Testing Strategy

### 1. Unit Tests
- Phone number validation functions
- OTP generation and verification
- Rate limiting logic
- Token generation and validation

### 2. Integration Tests
- Complete registration flow
- Complete login flow
- OTP resend functionality
- Error handling scenarios

### 3. Security Tests
- Brute force attack simulation
- Rate limiting effectiveness
- OTP expiration handling
- Token security validation

### 4. Load Tests
- High-volume OTP generation
- Concurrent user registration
- SMS delivery performance
- Database performance under load

### 5. End-to-End Tests
- Full user journey testing
- Cross-platform compatibility
- Network failure scenarios
- SMS delivery edge cases

## Implementation Checklist

### Backend Setup
- [ ] Configure SMS service provider (Twilio recommended)
- [ ] Set up database tables and indexes
- [ ] Implement rate limiting middleware
- [ ] Add monitoring and logging
- [ ] Configure environment variables
- [ ] Set up error tracking (Sentry)

### Frontend Integration
- [ ] Implement phone input with validation
- [ ] Create OTP input component
- [ ] Add loading states and error handling
- [ ] Implement countdown timer for resend
- [ ] Add accessibility features
- [ ] Test on multiple devices and screen sizes

### Security Measures
- [ ] Enable HTTPS/TLS encryption
- [ ] Implement CSRF protection
- [ ] Add request signing/validation
- [ ] Set up monitoring for suspicious activity
- [ ] Configure backup SMS providers
- [ ] Implement audit logging

### Production Deployment
- [ ] Configure production SMS credentials
- [ ] Set up database backups
- [ ] Configure monitoring and alerts
- [ ] Test SMS delivery in target regions
- [ ] Set up analytics and metrics
- [ ] Prepare incident response procedures

## Monitoring and Analytics

### Key Metrics to Track
- SMS delivery success rate
- OTP verification success rate
- Average time to complete auth flow
- Rate limiting trigger frequency
- Failed authentication attempts
- User drop-off points in auth flow

### Alerts to Configure
- SMS delivery failures above threshold
- Unusual spike in failed OTP attempts
- Rate limiting triggers for single phone number
- Database connection issues
- API response time degradation

This comprehensive phone authentication system provides a secure, user-friendly, and scalable solution for TravelBuddy's authentication needs.