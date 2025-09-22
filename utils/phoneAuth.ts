import * as SMS from 'expo-sms';
import { storage, StorageKeys } from './storage';

export interface PhoneAuthConfig {
  otpLength: number;
  otpExpiration: number; // in minutes
  maxAttempts: number;
  rateLimitWindow: number; // in minutes
  smsProvider: 'twilio' | 'firebase' | 'aws-sns';
}

export interface OTPRecord {
  phoneNumber: string;
  otp: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
  verified: boolean;
}

export interface AuthAttempt {
  phoneNumber: string;
  attempts: number;
  lastAttempt: number;
  blockedUntil?: number;
}

export interface PhoneAuthResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

const DEFAULT_CONFIG: PhoneAuthConfig = {
  otpLength: 6,
  otpExpiration: 5, // 5 minutes
  maxAttempts: 3,
  rateLimitWindow: 15, // 15 minutes
  smsProvider: 'twilio', // Recommended for reliability
};

class PhoneAuthService {
  private config: PhoneAuthConfig;
  private otpRecords: Map<string, OTPRecord> = new Map();
  private authAttempts: Map<string, AuthAttempt> = new Map();

  constructor(config: Partial<PhoneAuthConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadStoredData();
  }

  /**
   * Validates phone number format (E.164 international format)
   */
  validatePhoneNumber(phoneNumber: string): { isValid: boolean; formatted?: string; error?: string } {
    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Check if it starts with + and has country code
    if (!cleaned.startsWith('+')) {
      return { isValid: false, error: 'Phone number must include country code (e.g., +1234567890)' };
    }

    // Check length (7-15 digits after country code)
    const digits = cleaned.substring(1);
    if (digits.length < 7 || digits.length > 15) {
      return { isValid: false, error: 'Invalid phone number length' };
    }

    // Basic format validation
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(cleaned)) {
      return { isValid: false, error: 'Invalid phone number format' };
    }

    return { isValid: true, formatted: cleaned };
  }

  /**
   * Generates a random OTP
   */
  private generateOTP(): string {
    const min = Math.pow(10, this.config.otpLength - 1);
    const max = Math.pow(10, this.config.otpLength) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Checks if phone number is rate limited
   */
  private isRateLimited(phoneNumber: string): { limited: boolean; remainingTime?: number } {
    const attempt = this.authAttempts.get(phoneNumber);
    if (!attempt) return { limited: false };

    const now = Date.now();
    
    // Check if blocked
    if (attempt.blockedUntil && now < attempt.blockedUntil) {
      const remainingTime = Math.ceil((attempt.blockedUntil - now) / (1000 * 60));
      return { limited: true, remainingTime };
    }

    // Reset attempts if rate limit window has passed
    const windowExpired = now - attempt.lastAttempt > this.config.rateLimitWindow * 60 * 1000;
    if (windowExpired) {
      this.authAttempts.delete(phoneNumber);
      return { limited: false };
    }

    return { limited: false };
  }

  /**
   * Records an authentication attempt
   */
  private recordAttempt(phoneNumber: string): void {
    const now = Date.now();
    const existing = this.authAttempts.get(phoneNumber);

    if (existing) {
      existing.attempts += 1;
      existing.lastAttempt = now;

      // Block if max attempts reached
      if (existing.attempts >= this.config.maxAttempts) {
        existing.blockedUntil = now + (this.config.rateLimitWindow * 60 * 1000);
      }
    } else {
      this.authAttempts.set(phoneNumber, {
        phoneNumber,
        attempts: 1,
        lastAttempt: now,
      });
    }

    this.saveStoredData();
  }

  /**
   * Sends OTP via SMS (mock implementation - replace with actual SMS service)
   */
  private async sendSMS(phoneNumber: string, otp: string): Promise<PhoneAuthResponse> {
    try {
      const message = `Your TravelBuddy verification code is: ${otp}. This code expires in ${this.config.otpExpiration} minutes. Do not share this code with anyone.`;

      // Check if SMS is available on device
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        // In production, use actual SMS service like Twilio
        console.log(`SMS would be sent to ${phoneNumber}: ${message}`);
        return { success: true, message: 'OTP sent successfully' };
      }

      // For development/testing - this would open SMS app
      // In production, replace with actual SMS service API call
      await SMS.sendSMSAsync([phoneNumber], message);
      
      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return { 
        success: false, 
        message: 'Failed to send OTP', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Initiates phone number registration
   */
  async initiateRegistration(phoneNumber: string): Promise<PhoneAuthResponse> {
    // Validate phone number
    const validation = this.validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      return { success: false, message: validation.error! };
    }

    const formattedPhone = validation.formatted!;

    // Check rate limiting
    const rateLimitCheck = this.isRateLimited(formattedPhone);
    if (rateLimitCheck.limited) {
      return { 
        success: false, 
        message: `Too many attempts. Please try again in ${rateLimitCheck.remainingTime} minutes.` 
      };
    }

    // Check if phone number is already registered
    const existingUser = await this.checkUserExists(formattedPhone);
    if (existingUser) {
      return { success: false, message: 'Phone number is already registered. Please login instead.' };
    }

    // Generate and store OTP
    const otp = this.generateOTP();
    const expiresAt = Date.now() + (this.config.otpExpiration * 60 * 1000);

    const otpRecord: OTPRecord = {
      phoneNumber: formattedPhone,
      otp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
      verified: false,
    };

    this.otpRecords.set(formattedPhone, otpRecord);
    this.saveStoredData();

    // Send OTP
    const smsResult = await this.sendSMS(formattedPhone, otp);
    if (!smsResult.success) {
      this.otpRecords.delete(formattedPhone);
      return smsResult;
    }

    return { 
      success: true, 
      message: 'OTP sent to your phone number',
      data: { phoneNumber: formattedPhone, expiresIn: this.config.otpExpiration }
    };
  }

  /**
   * Initiates phone number login
   */
  async initiateLogin(phoneNumber: string): Promise<PhoneAuthResponse> {
    // Validate phone number
    const validation = this.validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      return { success: false, message: validation.error! };
    }

    const formattedPhone = validation.formatted!;

    // Check rate limiting
    const rateLimitCheck = this.isRateLimited(formattedPhone);
    if (rateLimitCheck.limited) {
      return { 
        success: false, 
        message: `Too many attempts. Please try again in ${rateLimitCheck.remainingTime} minutes.` 
      };
    }

    // Check if user exists
    const userExists = await this.checkUserExists(formattedPhone);
    if (!userExists) {
      return { success: false, message: 'Phone number not registered. Please sign up first.' };
    }

    // Generate and store OTP
    const otp = this.generateOTP();
    const expiresAt = Date.now() + (this.config.otpExpiration * 60 * 1000);

    const otpRecord: OTPRecord = {
      phoneNumber: formattedPhone,
      otp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
      verified: false,
    };

    this.otpRecords.set(formattedPhone, otpRecord);
    this.saveStoredData();

    // Send OTP
    const smsResult = await this.sendSMS(formattedPhone, otp);
    if (!smsResult.success) {
      this.otpRecords.delete(formattedPhone);
      return smsResult;
    }

    return { 
      success: true, 
      message: 'OTP sent to your phone number',
      data: { phoneNumber: formattedPhone, expiresIn: this.config.otpExpiration }
    };
  }

  /**
   * Verifies OTP for registration
   */
  async verifyRegistrationOTP(phoneNumber: string, enteredOTP: string, userData: any): Promise<PhoneAuthResponse> {
    const validation = this.validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      return { success: false, message: validation.error! };
    }

    const formattedPhone = validation.formatted!;
    const otpRecord = this.otpRecords.get(formattedPhone);

    if (!otpRecord) {
      return { success: false, message: 'No OTP found. Please request a new one.' };
    }

    // Check if OTP is expired
    if (Date.now() > otpRecord.expiresAt) {
      this.otpRecords.delete(formattedPhone);
      return { success: false, message: 'OTP has expired. Please request a new one.' };
    }

    // Check if too many attempts
    if (otpRecord.attempts >= this.config.maxAttempts) {
      this.otpRecords.delete(formattedPhone);
      this.recordAttempt(formattedPhone);
      return { success: false, message: 'Too many invalid attempts. Please request a new OTP.' };
    }

    // Verify OTP
    if (otpRecord.otp !== enteredOTP) {
      otpRecord.attempts += 1;
      this.saveStoredData();
      return { 
        success: false, 
        message: `Invalid OTP. ${this.config.maxAttempts - otpRecord.attempts} attempts remaining.` 
      };
    }

    // OTP verified - create user account
    try {
      const user = await this.createUser(formattedPhone, userData);
      otpRecord.verified = true;
      this.otpRecords.delete(formattedPhone); // Clean up
      
      // Generate auth token
      const authToken = this.generateAuthToken(user);
      
      return { 
        success: true, 
        message: 'Registration successful',
        data: { user, authToken }
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to create user account',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verifies OTP for login
   */
  async verifyLoginOTP(phoneNumber: string, enteredOTP: string): Promise<PhoneAuthResponse> {
    const validation = this.validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      return { success: false, message: validation.error! };
    }

    const formattedPhone = validation.formatted!;
    const otpRecord = this.otpRecords.get(formattedPhone);

    if (!otpRecord) {
      return { success: false, message: 'No OTP found. Please request a new one.' };
    }

    // Check if OTP is expired
    if (Date.now() > otpRecord.expiresAt) {
      this.otpRecords.delete(formattedPhone);
      return { success: false, message: 'OTP has expired. Please request a new one.' };
    }

    // Check if too many attempts
    if (otpRecord.attempts >= this.config.maxAttempts) {
      this.otpRecords.delete(formattedPhone);
      this.recordAttempt(formattedPhone);
      return { success: false, message: 'Too many invalid attempts. Please request a new OTP.' };
    }

    // Verify OTP
    if (otpRecord.otp !== enteredOTP) {
      otpRecord.attempts += 1;
      this.saveStoredData();
      return { 
        success: false, 
        message: `Invalid OTP. ${this.config.maxAttempts - otpRecord.attempts} attempts remaining.` 
      };
    }

    // OTP verified - authenticate user
    try {
      const user = await this.getUserByPhone(formattedPhone);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      otpRecord.verified = true;
      this.otpRecords.delete(formattedPhone); // Clean up
      
      // Generate auth token
      const authToken = this.generateAuthToken(user);
      
      return { 
        success: true, 
        message: 'Login successful',
        data: { user, authToken }
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Authentication failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Resends OTP
   */
  async resendOTP(phoneNumber: string): Promise<PhoneAuthResponse> {
    const validation = this.validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      return { success: false, message: validation.error! };
    }

    const formattedPhone = validation.formatted!;

    // Check rate limiting
    const rateLimitCheck = this.isRateLimited(formattedPhone);
    if (rateLimitCheck.limited) {
      return { 
        success: false, 
        message: `Too many attempts. Please try again in ${rateLimitCheck.remainingTime} minutes.` 
      };
    }

    // Generate new OTP
    const otp = this.generateOTP();
    const expiresAt = Date.now() + (this.config.otpExpiration * 60 * 1000);

    const otpRecord: OTPRecord = {
      phoneNumber: formattedPhone,
      otp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
      verified: false,
    };

    this.otpRecords.set(formattedPhone, otpRecord);
    this.saveStoredData();

    // Send OTP
    const smsResult = await this.sendSMS(formattedPhone, otp);
    if (!smsResult.success) {
      this.otpRecords.delete(formattedPhone);
      return smsResult;
    }

    return { 
      success: true, 
      message: 'New OTP sent to your phone number',
      data: { phoneNumber: formattedPhone, expiresIn: this.config.otpExpiration }
    };
  }

  // Mock database operations - replace with actual database calls
  private async checkUserExists(phoneNumber: string): Promise<boolean> {
    const users = await storage.getItem<any[]>('users') || [];
    return users.some(user => user.phoneNumber === phoneNumber);
  }

  private async createUser(phoneNumber: string, userData: any): Promise<any> {
    const users = await storage.getItem<any[]>('users') || [];
    const newUser = {
      id: Date.now().toString(),
      phoneNumber,
      ...userData,
      createdAt: new Date().toISOString(),
      verified: true,
    };
    users.push(newUser);
    await storage.setItem('users', users);
    return newUser;
  }

  private async getUserByPhone(phoneNumber: string): Promise<any> {
    const users = await storage.getItem<any[]>('users') || [];
    return users.find(user => user.phoneNumber === phoneNumber);
  }

  private generateAuthToken(user: any): string {
    // In production, use proper JWT library
    const payload = {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      iat: Date.now(),
      exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    };
    return btoa(JSON.stringify(payload));
  }

  private async loadStoredData(): Promise<void> {
    try {
      const otpData = await storage.getItem<[string, OTPRecord][]>('otpRecords');
      const attemptData = await storage.getItem<[string, AuthAttempt][]>('authAttempts');
      
      if (otpData) {
        this.otpRecords = new Map(otpData);
      }
      if (attemptData) {
        this.authAttempts = new Map(attemptData);
      }
    } catch (error) {
      console.error('Failed to load stored auth data:', error);
    }
  }

  private async saveStoredData(): Promise<void> {
    try {
      await storage.setItem('otpRecords', Array.from(this.otpRecords.entries()));
      await storage.setItem('authAttempts', Array.from(this.authAttempts.entries()));
    } catch (error) {
      console.error('Failed to save auth data:', error);
    }
  }

  /**
   * Cleanup expired OTPs and auth attempts
   */
  cleanup(): void {
    const now = Date.now();
    
    // Clean expired OTPs
    for (const [phone, record] of this.otpRecords.entries()) {
      if (now > record.expiresAt) {
        this.otpRecords.delete(phone);
      }
    }

    // Clean expired auth attempts
    for (const [phone, attempt] of this.authAttempts.entries()) {
      const windowExpired = now - attempt.lastAttempt > this.config.rateLimitWindow * 60 * 1000;
      const blockExpired = !attempt.blockedUntil || now > attempt.blockedUntil;
      
      if (windowExpired && blockExpired) {
        this.authAttempts.delete(phone);
      }
    }

    this.saveStoredData();
  }
}

// Export singleton instance
export const phoneAuthService = new PhoneAuthService();

// Cleanup expired records every 5 minutes
setInterval(() => {
  phoneAuthService.cleanup();
}, 5 * 60 * 1000);