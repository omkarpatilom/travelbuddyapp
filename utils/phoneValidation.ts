/**
 * Comprehensive phone number validation utilities
 * Supports international formats and provides detailed validation feedback
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formatted?: string;
  country?: string;
  countryCode?: string;
  nationalNumber?: string;
  type?: 'mobile' | 'landline' | 'unknown';
  error?: string;
}

export interface CountryInfo {
  code: string;
  name: string;
  dialCode: string;
  format: string;
  minLength: number;
  maxLength: number;
}

// Common country codes and their information
export const COUNTRY_CODES: Record<string, CountryInfo> = {
  'US': { code: 'US', name: 'United States', dialCode: '+1', format: '+1 (XXX) XXX-XXXX', minLength: 10, maxLength: 10 },
  'CA': { code: 'CA', name: 'Canada', dialCode: '+1', format: '+1 (XXX) XXX-XXXX', minLength: 10, maxLength: 10 },
  'GB': { code: 'GB', name: 'United Kingdom', dialCode: '+44', format: '+44 XXXX XXXXXX', minLength: 10, maxLength: 10 },
  'IN': { code: 'IN', name: 'India', dialCode: '+91', format: '+91 XXXXX XXXXX', minLength: 10, maxLength: 10 },
  'AU': { code: 'AU', name: 'Australia', dialCode: '+61', format: '+61 XXX XXX XXX', minLength: 9, maxLength: 9 },
  'DE': { code: 'DE', name: 'Germany', dialCode: '+49', format: '+49 XXX XXXXXXX', minLength: 10, maxLength: 12 },
  'FR': { code: 'FR', name: 'France', dialCode: '+33', format: '+33 X XX XX XX XX', minLength: 9, maxLength: 9 },
  'JP': { code: 'JP', name: 'Japan', dialCode: '+81', format: '+81 XX XXXX XXXX', minLength: 10, maxLength: 11 },
  'BR': { code: 'BR', name: 'Brazil', dialCode: '+55', format: '+55 XX XXXXX XXXX', minLength: 10, maxLength: 11 },
  'MX': { code: 'MX', name: 'Mexico', dialCode: '+52', format: '+52 XXX XXX XXXX', minLength: 10, maxLength: 10 },
};

// Mobile number prefixes for major countries
const MOBILE_PREFIXES: Record<string, string[]> = {
  'US': ['2', '3', '4', '5', '6', '7', '8', '9'], // All area codes can have mobile
  'GB': ['7'], // UK mobile numbers start with 7
  'IN': ['6', '7', '8', '9'], // Indian mobile numbers start with 6-9
  'AU': ['4'], // Australian mobile numbers start with 4
  'DE': ['15', '16', '17'], // German mobile prefixes
  'FR': ['6', '7'], // French mobile numbers start with 6 or 7
};

export class PhoneValidator {
  /**
   * Validates and formats a phone number
   */
  static validate(phoneNumber: string, defaultCountry?: string): PhoneValidationResult {
    if (!phoneNumber) {
      return { isValid: false, error: 'Phone number is required' };
    }

    // Clean the input
    const cleaned = this.cleanPhoneNumber(phoneNumber);
    
    if (!cleaned) {
      return { isValid: false, error: 'Invalid phone number format' };
    }

    // Check if it starts with +
    if (!cleaned.startsWith('+')) {
      if (defaultCountry) {
        const countryInfo = COUNTRY_CODES[defaultCountry.toUpperCase()];
        if (countryInfo) {
          return this.validate(countryInfo.dialCode + cleaned, defaultCountry);
        }
      }
      return { isValid: false, error: 'Phone number must include country code (e.g., +1234567890)' };
    }

    // Extract country code and national number
    const result = this.parsePhoneNumber(cleaned);
    if (!result.isValid) {
      return result;
    }

    // Additional validation
    return this.validateParsedNumber(result);
  }

  /**
   * Cleans phone number by removing non-digit characters except +
   */
  private static cleanPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/[^\d+]/g, '');
  }

  /**
   * Parses phone number to extract country code and national number
   */
  private static parsePhoneNumber(phoneNumber: string): PhoneValidationResult {
    // Remove the + sign for processing
    const digits = phoneNumber.substring(1);
    
    if (digits.length < 7 || digits.length > 15) {
      return { isValid: false, error: 'Phone number must be between 7 and 15 digits' };
    }

    // Try to match against known country codes
    for (const [countryCode, info] of Object.entries(COUNTRY_CODES)) {
      const dialCode = info.dialCode.substring(1); // Remove +
      
      if (digits.startsWith(dialCode)) {
        const nationalNumber = digits.substring(dialCode.length);
        
        if (nationalNumber.length >= info.minLength && nationalNumber.length <= info.maxLength) {
          return {
            isValid: true,
            formatted: phoneNumber,
            country: countryCode,
            countryCode: info.dialCode,
            nationalNumber: nationalNumber,
          };
        }
      }
    }

    // If no specific country match, do basic validation
    if (digits.length >= 7 && digits.length <= 15) {
      // Try to guess country from first few digits
      const countryGuess = this.guessCountry(digits);
      
      return {
        isValid: true,
        formatted: phoneNumber,
        country: countryGuess,
        countryCode: countryGuess ? COUNTRY_CODES[countryGuess]?.dialCode : undefined,
        nationalNumber: countryGuess ? digits.substring(COUNTRY_CODES[countryGuess].dialCode.length - 1) : digits,
      };
    }

    return { isValid: false, error: 'Invalid phone number length' };
  }

  /**
   * Validates parsed phone number with additional checks
   */
  private static validateParsedNumber(result: PhoneValidationResult): PhoneValidationResult {
    if (!result.isValid || !result.country || !result.nationalNumber) {
      return result;
    }

    const countryInfo = COUNTRY_CODES[result.country];
    if (!countryInfo) {
      return result; // Return as-is if country not in our database
    }

    // Check if it's likely a mobile number
    const type = this.detectNumberType(result.nationalNumber, result.country);
    
    // Format the number nicely
    const formatted = this.formatPhoneNumber(result.formatted!, result.country);

    return {
      ...result,
      type,
      formatted,
    };
  }

  /**
   * Detects if a number is mobile or landline
   */
  private static detectNumberType(nationalNumber: string, country: string): 'mobile' | 'landline' | 'unknown' {
    const mobilePrefixes = MOBILE_PREFIXES[country];
    
    if (!mobilePrefixes) {
      return 'unknown';
    }

    for (const prefix of mobilePrefixes) {
      if (nationalNumber.startsWith(prefix)) {
        return 'mobile';
      }
    }

    return 'landline';
  }

  /**
   * Formats phone number according to country conventions
   */
  private static formatPhoneNumber(phoneNumber: string, country: string): string {
    const countryInfo = COUNTRY_CODES[country];
    if (!countryInfo) {
      return phoneNumber;
    }

    // For now, return the clean E.164 format
    // In a full implementation, you'd format according to country conventions
    return phoneNumber;
  }

  /**
   * Guesses country from phone number digits
   */
  private static guessCountry(digits: string): string | undefined {
    // Simple heuristics for common country codes
    if (digits.startsWith('1')) return 'US';
    if (digits.startsWith('44')) return 'GB';
    if (digits.startsWith('91')) return 'IN';
    if (digits.startsWith('61')) return 'AU';
    if (digits.startsWith('49')) return 'DE';
    if (digits.startsWith('33')) return 'FR';
    if (digits.startsWith('81')) return 'JP';
    if (digits.startsWith('55')) return 'BR';
    if (digits.startsWith('52')) return 'MX';
    
    return undefined;
  }

  /**
   * Gets country information by country code
   */
  static getCountryInfo(countryCode: string): CountryInfo | undefined {
    return COUNTRY_CODES[countryCode.toUpperCase()];
  }

  /**
   * Gets all supported countries
   */
  static getSupportedCountries(): CountryInfo[] {
    return Object.values(COUNTRY_CODES);
  }

  /**
   * Validates phone number for SMS capability
   */
  static validateForSMS(phoneNumber: string): PhoneValidationResult {
    const result = this.validate(phoneNumber);
    
    if (!result.isValid) {
      return result;
    }

    // Additional SMS-specific validation
    if (result.type === 'landline') {
      return {
        ...result,
        isValid: false,
        error: 'SMS can only be sent to mobile numbers',
      };
    }

    return result;
  }

  /**
   * Formats phone number for display
   */
  static formatForDisplay(phoneNumber: string, country?: string): string {
    const result = this.validate(phoneNumber, country);
    
    if (!result.isValid || !result.formatted) {
      return phoneNumber;
    }

    return result.formatted;
  }

  /**
   * Checks if two phone numbers are the same
   */
  static areEqual(phone1: string, phone2: string): boolean {
    const result1 = this.validate(phone1);
    const result2 = this.validate(phone2);
    
    if (!result1.isValid || !result2.isValid) {
      return false;
    }

    return result1.formatted === result2.formatted;
  }
}

// Export commonly used functions
export const validatePhoneNumber = PhoneValidator.validate;
export const validatePhoneForSMS = PhoneValidator.validateForSMS;
export const formatPhoneForDisplay = PhoneValidator.formatForDisplay;
export const arePhoneNumbersEqual = PhoneValidator.areEqual;