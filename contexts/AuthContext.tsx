import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage, StorageKeys } from '@/utils/storage';
import { validateEmail, validatePassword } from '@/utils/validation';
import { api } from '@/utils/api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  status: string;
  rating: number;
  isVerified: boolean;
  avatar?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await storage.getItem<string>(StorageKeys.AUTH_TOKEN);
      if (token) {
        // Fetch fresh user data from server
        try {
          const profile = await api.get<any>('/users/me');
          const mappedUser = mapUserProfile(profile);
          await storage.setItem(StorageKeys.USER_DATA, mappedUser);
          setUser(mappedUser);
        } catch (error: any) {
          console.error('Error fetching profile:', error.message || error);
          if (error.message?.includes('401')) {
            // Token is invalid or expired
            await logout();
          } else {
            const cachedUser = await storage.getItem<User>(StorageKeys.USER_DATA);
            if (cachedUser) {
              setUser(cachedUser);
            } else {
              await logout();
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const mapUserProfile = (profile: any): User => ({
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phoneNumber,
    role: profile.role,
    status: profile.status,
    rating: profile.rating,
    isVerified: profile.isVerified,
    avatar: profile.profilePictureUrl || undefined,
    createdAt: profile.createdAt,
  });

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!validateEmail(email)) {
      return false;
    }

    setIsLoading(true);
    try {
      const response = await api.post<any>('/auth/login', { email, password });
      
      if (response.accessToken) {
        await storage.setItem(StorageKeys.AUTH_TOKEN, response.accessToken);
        
        // Fetch profile to get full user details
        const profile = await api.get<any>('/users/me');
        const mappedUser = mapUserProfile(profile);
        
        await storage.setItem(StorageKeys.USER_DATA, mappedUser);
        setUser(mappedUser);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<boolean> => {
    if (!validateEmail(userData.email)) {
      return false;
    }

    const passwordValidation = validatePassword(userData.password);
    if (!passwordValidation.isValid) {
      return false;
    }

    setIsLoading(true);
    try {
      const fullName = `${userData.firstName} ${userData.lastName}`.trim();
      
      await api.post<any>('/auth/register', {
        fullName,
        email: userData.email,
        phoneNumber: userData.phone,
        password: userData.password,
        role: 'Passenger' // Default role
      });

      // After successful registration, log in
      return await login(userData.email, userData.password);
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    } finally {
      setIsLoading(false);
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

  const updateUser = async (userData: Partial<User>) => {
    try {
      if (user) {
        // If updating profile details, call the API
        if (userData.fullName || userData.phone) {
          await api.put('/users/me', {
            fullName: userData.fullName || user.fullName,
            phoneNumber: userData.phone || user.phone
          });
        }
        
        const updatedUser = { ...user, ...userData };
        await storage.setItem(StorageKeys.USER_DATA, updatedUser);
        setUser(updatedUser);
      }
    } catch (error) {
      console.error('Update user error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}