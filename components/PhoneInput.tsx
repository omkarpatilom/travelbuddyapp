import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Phone, ChevronDown, Search, Check } from 'lucide-react-native';
import { PhoneValidator, COUNTRY_CODES, CountryInfo, PhoneValidationResult } from '@/utils/phoneValidation';

interface PhoneInputProps {
  value: string;
  onChangeText: (phoneNumber: string) => void;
  onValidationChange?: (result: PhoneValidationResult) => void;
  placeholder?: string;
  defaultCountry?: string;
  style?: any;
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function PhoneInput({
  value,
  onChangeText,
  onValidationChange,
  placeholder = "Phone number",
  defaultCountry = 'US',
  style,
  disabled = false,
  autoFocus = false,
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(
    COUNTRY_CODES[defaultCountry] || COUNTRY_CODES['US']
  );
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [validationResult, setValidationResult] = useState<PhoneValidationResult>({ isValid: true });
  const [isFocused, setIsFocused] = useState(false);

  const { theme } = useTheme();

  useEffect(() => {
    validatePhoneNumber(value);
  }, [value]);

  const validatePhoneNumber = (phoneNumber: string) => {
    if (!phoneNumber) {
      const result = { isValid: true };
      setValidationResult(result);
      onValidationChange?.(result);
      return;
    }

    const result = PhoneValidator.validateForSMS(phoneNumber);
    setValidationResult(result);
    onValidationChange?.(result);

    // Update selected country if we can detect it
    if (result.isValid && result.country && COUNTRY_CODES[result.country]) {
      setSelectedCountry(COUNTRY_CODES[result.country]);
    }
  };

  const handleTextChange = (text: string) => {
    let formattedText = text;

    // If text doesn't start with + and we have a selected country, add the country code
    if (text && !text.startsWith('+') && selectedCountry) {
      formattedText = selectedCountry.dialCode + text.replace(/[^\d]/g, '');
    }

    // Clean the text to only include + and digits
    formattedText = formattedText.replace(/[^\d+]/g, '');

    onChangeText(formattedText);
  };

  const handleCountrySelect = (country: CountryInfo) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    
    // If there's existing text without country code, prepend the new country code
    if (value && !value.startsWith('+')) {
      const cleanNumber = value.replace(/[^\d]/g, '');
      onChangeText(country.dialCode + cleanNumber);
    } else if (!value) {
      // If no value, just set the country code
      onChangeText(country.dialCode);
    }
  };

  const getDisplayValue = () => {
    if (!value) return '';
    
    // If value starts with selected country code, show national format
    if (value.startsWith(selectedCountry.dialCode)) {
      const nationalNumber = value.substring(selectedCountry.dialCode.length);
      return nationalNumber;
    }
    
    // Otherwise show the full international format
    return value;
  };

  const getFilteredCountries = () => {
    const countries = Object.values(COUNTRY_CODES);
    
    if (!searchQuery) {
      return countries.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return countries
      .filter(country => 
        country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        country.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        country.dialCode.includes(searchQuery)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const renderCountryItem = ({ item }: { item: CountryInfo }) => (
    <TouchableOpacity
      style={[
        styles.countryItem,
        { backgroundColor: theme.colors.surface },
        selectedCountry.code === item.code && { backgroundColor: theme.colors.primary + '20' }
      ]}
      onPress={() => handleCountrySelect(item)}
    >
      <View style={styles.countryInfo}>
        <Text style={[styles.countryFlag, { fontSize: 24 }]}>
          {getCountryFlag(item.code)}
        </Text>
        <View style={styles.countryDetails}>
          <Text style={[styles.countryName, { color: theme.colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.countryCode, { color: theme.colors.textSecondary }]}>
            {item.dialCode}
          </Text>
        </View>
      </View>
      {selectedCountry.code === item.code && (
        <Check size={20} color={theme.colors.primary} />
      )}
    </TouchableOpacity>
  );

  const getCountryFlag = (countryCode: string): string => {
    // Simple flag emoji mapping - in production, use a proper flag library
    const flags: Record<string, string> = {
      'US': '🇺🇸', 'CA': '🇨🇦', 'GB': '🇬🇧', 'IN': '🇮🇳', 'AU': '🇦🇺',
      'DE': '🇩🇪', 'FR': '🇫🇷', 'JP': '🇯🇵', 'BR': '🇧🇷', 'MX': '🇲🇽',
    };
    return flags[countryCode] || '🌍';
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[
        styles.inputContainer,
        { 
          backgroundColor: theme.colors.surface, 
          borderColor: isFocused 
            ? (validationResult.isValid ? theme.colors.primary : theme.colors.error)
            : theme.colors.border 
        },
        !validationResult.isValid && value && styles.errorBorder,
      ]}>
        <TouchableOpacity
          style={[styles.countrySelector, { borderRightColor: theme.colors.border }]}
          onPress={() => setShowCountryPicker(true)}
          disabled={disabled}
        >
          <Text style={styles.flag}>{getCountryFlag(selectedCountry.code)}</Text>
          <Text style={[styles.dialCode, { color: theme.colors.text }]}>
            {selectedCountry.dialCode}
          </Text>
          <ChevronDown size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TextInput
          style={[styles.phoneInput, { color: theme.colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          value={getDisplayValue()}
          onChangeText={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType="phone-pad"
          autoFocus={autoFocus}
          editable={!disabled}
        />

        {validationResult.isValid && value && validationResult.type && (
          <View style={[styles.typeIndicator, { backgroundColor: theme.colors.success + '20' }]}>
            <Text style={[styles.typeText, { color: theme.colors.success }]}>
              {validationResult.type === 'mobile' ? '📱' : '☎️'}
            </Text>
          </View>
        )}
      </View>

      {!validationResult.isValid && value && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {validationResult.error}
        </Text>
      )}

      {validationResult.isValid && value && validationResult.country && (
        <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
          {validationResult.formatted} • {COUNTRY_CODES[validationResult.country]?.name}
        </Text>
      )}

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Select Country
              </Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Text style={[styles.closeButton, { color: theme.colors.primary }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search countries..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={getFilteredCountries()}
              keyExtractor={(item) => item.code}
              renderItem={renderCountryItem}
              style={styles.countriesList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  errorBorder: {
    borderWidth: 2,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    gap: 6,
  },
  flag: {
    fontSize: 20,
  },
  dialCode: {
    fontSize: 16,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  typeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 12,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 20,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  countriesList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  countryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  countryFlag: {
    width: 32,
    textAlign: 'center',
  },
  countryDetails: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  countryCode: {
    fontSize: 14,
  },
});