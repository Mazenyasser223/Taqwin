
import { create } from 'zustand';
import { User, UserRole } from '../types';
import authService from '../services/authService';
import { clearAuthSession } from '../lib/authStorage';
import { getHashQueryParams, isAuthOAuthError } from '../lib/hashRouteQuery';
import profileService from '../services/profileService';
import { clearOnboardingBackup, syncUserWithProfile } from '../services/onboardingStorage';
import type { LoginData, RegisterData, VerifyEmailData } from '../services/authService';

async function loadUserSettings() {
  const { useSettingsStore } = await import('./useSettingsStore');
  void useSettingsStore.getState().load();
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** False until initAuth() finishes (avoids redirect to landing on refresh). */
  authHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (data: LoginData) => Promise<{
    success: boolean;
    requiresVerification?: boolean;
    requiresTwoFactor?: boolean;
    tempToken?: string;
    rememberMe?: boolean;
  }>;
  register: (data: RegisterData) => Promise<{
    success: boolean;
    requiresVerification?: boolean;
    devVerificationCode?: string;
    verifyMessage?: string;
  }>;
  verifyEmail: (data: VerifyEmailData) => Promise<{ success: boolean }>;
  resendVerification: (email: string) => Promise<{ success: boolean; devVerificationCode?: string }>;
  logout: () => void;
  setUser: (user: User) => void;
  initAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  authHydrated: false,
  isLoading: false,
  error: null,

  login: async (data: LoginData) => {
    set({ isLoading: true, error: null });
    
    const response = await authService.login(data);
    
    if (response.requiresVerification) {
      set({
        isLoading: false,
        error: 'Please verify your email before signing in.',
      });
      return { success: false, requiresVerification: true };
    }

    if (response.error) {
      set({ isLoading: false, error: response.error });
      return { success: false };
    }

    if (response.data?.requiresVerification) {
      set({
        isLoading: false,
        error: 'Please verify your email before signing in.',
      });
      return { success: false, requiresVerification: true };
    }

    if (response.data?.requiresTwoFactor && response.data.tempToken) {
      set({ isLoading: false, error: null });
      return {
        success: true,
        requiresTwoFactor: true,
        tempToken: response.data.tempToken,
        rememberMe: Boolean(data.rememberMe),
      };
    }

    if (response.data?.token && response.data?.user) {
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      void loadUserSettings();
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
      return {
        success: true,
        requiresVerification: true,
        devVerificationCode: response.data?.devVerificationCode,
        verifyMessage:
          typeof response.data?.message === 'string' ? response.data.message : undefined,
      };
    }

    if (response.data?.user && response.data?.token) {
      clearOnboardingBackup(response.data.user.id);
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      void loadUserSettings();
      return { success: true };
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
      clearOnboardingBackup(response.data.user.id);
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      void loadUserSettings();
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

    const devVerificationCode = (response.data as { devVerificationCode?: string } | undefined)
      ?.devVerificationCode;
    set({ isLoading: false });
    return { success: true, devVerificationCode };
  },

  logout: () => {
    const userId = authService.getStoredUser()?.id;
    authService.logout();
    clearOnboardingBackup(userId);
    set({ user: null, isAuthenticated: false, error: null });
    if (typeof window !== 'undefined') {
      const base = `${window.location.origin}${window.location.pathname}`;
      window.location.replace(`${base}#/`);
    }
  },

  setUser: (user: User) => {
    set({ user, isAuthenticated: true });
    void loadUserSettings();
  },

  initAuth: async () => {
    try {
      const oauthErr = getHashQueryParams().get('error');
      if (isAuthOAuthError(oauthErr)) {
        clearAuthSession();
        set({ user: null, isAuthenticated: false });
        return;
      }

      const storedUser = authService.getStoredUser();
      const token = authService.getToken();

      if (storedUser && token) {
        const response = await authService.getCurrentUser();
        if (!response.data) {
          authService.logout();
          set({ user: null, isAuthenticated: false });
          return;
        }
        let user = response.data;
        const profileRes = await profileService.getProfile();
        if (profileRes.data) {
          user = syncUserWithProfile(user, profileRes.data);
        } else {
          authService.syncStoredUser(user);
        }
        set({ user, isAuthenticated: true });
        void loadUserSettings();
      }
    } finally {
      set({ authHydrated: true });
    }
  },

  refreshUser: async () => {
    const token = authService.getToken();
    if (!token) return;
    const response = await authService.getCurrentUser();
    if (!response.data) return;
    let user = response.data;
    const profileRes = await profileService.getProfile();
    if (profileRes.data) {
      user = syncUserWithProfile(user, profileRes.data);
    } else {
      authService.syncStoredUser(user);
    }
    set({ user, isAuthenticated: true });
    void loadUserSettings();
  },

  clearError: () => set({ error: null }),
}));
