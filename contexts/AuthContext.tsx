import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage, StorageKeys } from '@/utils/storage';
import { validateEmail, validatePassword } from '@/utils/validation';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { UserProfileDto, UserRole } from '@/utils/types';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  status: string;
  rating: number;
  totalRides: number;
  isVerified: boolean;
  avatar?: string;
  createdAt: string;
  isGoogleLinked?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<boolean>;
  linkGoogle: (idToken: string) => Promise<boolean>;
  unlinkGoogle: () => Promise<boolean>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role?: UserRole;
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
        try {
          const profile = await userService.getMe();
          const mappedUser = mapUserProfile(profile);
          await storage.setItem(StorageKeys.USER_DATA, mappedUser);
          setUser(mappedUser);
        } catch (error: any) {
          console.error('Error fetching profile:', error.message || error);
          if (error.message?.includes('401')) {
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

  const mapUserProfile = (profile: UserProfileDto): User => ({
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phoneNumber,
    role: profile.role,
    status: profile.status,
    rating: profile.rating,
    totalRides: 0, // Default value as it's not in the backend DTO yet
    isVerified: profile.isVerified,
    avatar: profile.profilePictureUrl || undefined,
    createdAt: profile.createdAt,
    isGoogleLinked: profile.isGoogleLinked,
  });

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!validateEmail(email)) return false;

    setIsLoading(true);
    try {
      const response = await authService.login({ email, password });
      
      if (response.accessToken) {
        await storage.setItem(StorageKeys.AUTH_TOKEN, response.accessToken);
        if (response.refreshToken) {
          await storage.setItem(StorageKeys.REFRESH_TOKEN, response.refreshToken);
        }
        
        const profile = await userService.getMe();
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
    if (!validateEmail(userData.email)) return false;

    const passwordValidation = validatePassword(userData.password);
    if (!passwordValidation.isValid) return false;

    setIsLoading(true);
    try {
      const fullName = `${userData.firstName} ${userData.lastName}`.trim();
      
      await authService.register({
        fullName,
        email: userData.email,
        phoneNumber: userData.phone,
        password: userData.password,
        role: userData.role ?? UserRole.Passenger
      });

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
      const refreshToken = await storage.getItem<string>(StorageKeys.REFRESH_TOKEN);
      if (refreshToken) {
        try {
          await authService.logout(refreshToken);
        } catch (e) {
          console.log('Server logout failed or already logged out:', e);
        }
      }
      
      await storage.removeItem(StorageKeys.AUTH_TOKEN);
      await storage.removeItem(StorageKeys.REFRESH_TOKEN);
      await storage.removeItem(StorageKeys.USER_DATA);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    try {
      if (user) {
        if (userData.fullName || userData.phone) {
          await userService.updateProfile({
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
      throw error;
    }
  };

  const refreshProfile = async () => {
    try {
      const profile = await userService.getMe();
      const mappedUser = mapUserProfile(profile);
      await storage.setItem(StorageKeys.USER_DATA, mappedUser);
      setUser(mappedUser);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await authService.loginWithGoogle(idToken);
      if (response.accessToken) {
        await storage.setItem(StorageKeys.AUTH_TOKEN, response.accessToken);
        if (response.refreshToken) {
          await storage.setItem(StorageKeys.REFRESH_TOKEN, response.refreshToken);
        }
        
        const profile = await userService.getMe();
        const mappedUser = mapUserProfile(profile);
        
        await storage.setItem(StorageKeys.USER_DATA, mappedUser);
        setUser(mappedUser);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Google Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const linkGoogle = async (idToken: string): Promise<boolean> => {
    try {
      await authService.linkGoogle(idToken);
      await refreshProfile();
      return true;
    } catch (error) {
      console.error('Link Google error:', error);
      return false;
    }
  };

  const unlinkGoogle = async (): Promise<boolean> => {
    try {
      await authService.unlinkGoogle();
      await refreshProfile();
      return true;
    } catch (error) {
      console.error('Unlink Google error:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser, refreshProfile, loginWithGoogle, linkGoogle, unlinkGoogle }}>
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