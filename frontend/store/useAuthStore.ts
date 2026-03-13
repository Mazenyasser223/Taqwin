
import { create } from 'zustand';
import { User, UserRole } from '../types';
import authService from '../services/authService';
import type { LoginData, RegisterData, VerifyEmailData } from '../services/authService';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (data: LoginData) => Promise<{ success: boolean; requiresVerification?: boolean }>;
  register: (data: RegisterData) => Promise<{ success: boolean; requiresVerification?: boolean }>;
  verifyEmail: (data: VerifyEmailData) => Promise<{ success: boolean }>;
  resendVerification: (email: string) => Promise<{ success: boolean }>;
  logout: () => void;
  setUser: (user: User) => void;
  initAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (data: LoginData) => {
    set({ isLoading: true, error: null });
    
    const response = await authService.login(data);
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return { success: false };
    }

    if (response.data?.requiresVerification) {
      set({ isLoading: false });
      return { success: true, requiresVerification: true };
    }

    if (response.data?.user) {
      set({ 
        user: response.data.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
      return { success: true };
    }

    set({ isLoading: false, error: 'Login failed' });
    return { success: false };
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });
    
    const response = await authService.register(data);
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return { success: false };
    }

    if (response.data?.requiresVerification) {
      set({ isLoading: false });
      return { success: true, requiresVerification: true };
    }

    set({ isLoading: false });
    return { success: true };
  },

  verifyEmail: async (data: VerifyEmailData) => {
    set({ isLoading: true, error: null });
    
    const response = await authService.verifyEmail(data);
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return { success: false };
    }

    if (response.data?.user) {
      set({ 
        user: response.data.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
      return { success: true };
    }

    set({ isLoading: false, error: 'Email verification failed' });
    return { success: false };
  },

  resendVerification: async (email: string) => {
    set({ isLoading: true, error: null });
    
    const response = await authService.resendVerificationCode(email);
    
    if (response.error) {
      set({ isLoading: false, error: response.error });
      return { success: false };
    }

    set({ isLoading: false });
    return { success: true };
  },

  logout: () => {
    authService.logout();
    set({ user: null, isAuthenticated: false, error: null });
  },

  setUser: (user: User) => {
    set({ user, isAuthenticated: true });
  },

  initAuth: async () => {
    // Try to restore auth from localStorage
    const storedUser = authService.getStoredUser();
    const token = authService.getToken();

    if (storedUser && token) {
      // Verify token is still valid by fetching current user
      const response = await authService.getCurrentUser();
      
      if (response.data) {
        set({ user: response.data, isAuthenticated: true });
      } else {
        // Token invalid, clear storage
        authService.logout();
        set({ user: null, isAuthenticated: false });
      }
    }
  },

  clearError: () => set({ error: null }),
}));
