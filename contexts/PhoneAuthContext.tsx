import React, { createContext, useContext, useState, useEffect } from 'react';
import { phoneAuthService } from '@/utils/phoneAuth';
import { storage, StorageKeys } from '@/utils/storage';

export interface PhoneAuthUser {
  id: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  verified: boolean;
  createdAt: string;
}

interface PhoneAuthContextType {
  user: PhoneAuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phoneNumber: string, otp: string) => Promise<boolean>;
  register: (phoneNumber: string, otp: string, userData: any) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const PhoneAuthContext = createContext<PhoneAuthContextType | undefined>(undefined);

export function PhoneAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PhoneAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await storage.getItem<string>(StorageKeys.AUTH_TOKEN);
      const userData = await storage.getItem<PhoneAuthUser>(StorageKeys.USER_DATA);
      
      if (token && userData) {
        // Verify token is still valid
        const tokenData = JSON.parse(atob(token));
        if (tokenData.exp > Date.now()) {
          setUser(userData);
        } else {
          // Token expired, clear data
          await logout();
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phoneNumber: string, otp: string): Promise<boolean> => {
    try {
      const response = await phoneAuthService.verifyLoginOTP(phoneNumber, otp);
      
      if (response.success) {
        const { user: userData, authToken } = response.data;
        
        await storage.setItem(StorageKeys.AUTH_TOKEN, authToken);
        await storage.setItem(StorageKeys.USER_DATA, userData);
        
        setUser(userData);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const register = async (phoneNumber: string, otp: string, userData: any): Promise<boolean> => {
    try {
      const response = await phoneAuthService.verifyRegistrationOTP(phoneNumber, otp, userData);
      
      if (response.success) {
        const { user: newUser, authToken } = response.data;
        
        await storage.setItem(StorageKeys.AUTH_TOKEN, authToken);
        await storage.setItem(StorageKeys.USER_DATA, newUser);
        
        setUser(newUser);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await storage.removeItem(StorageKeys.AUTH_TOKEN);
      await storage.removeItem(StorageKeys.USER_DATA);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    
    try {
      // In a real app, you'd fetch updated user data from the server
      const userData = await storage.getItem<PhoneAuthUser>(StorageKeys.USER_DATA);
      if (userData) {
        setUser(userData);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <PhoneAuthContext.Provider 
      value={{ 
        user, 
        isLoading, 
        isAuthenticated: !!user,
        login, 
        register, 
        logout, 
        refreshUser 
      }}
    >
      {children}
    </PhoneAuthContext.Provider>
  );
}

export function usePhoneAuth() {
  const context = useContext(PhoneAuthContext);
  if (context === undefined) {
    throw new Error('usePhoneAuth must be used within a PhoneAuthProvider');
  }
  return context;
}