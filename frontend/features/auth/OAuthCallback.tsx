/**
 * OAuth Callback Handler
 * Handles redirect from backend OAuth (Google)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import authService from '../../services/authService';
import { setSignupPendingRole } from '../../lib/authStorage';
import { getPostAuthPath } from '../../lib/authRoutes';
import { motion } from 'framer-motion';
import { Logo } from '../../components/shared/Logo';

export const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, refreshUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const userDataStr = searchParams.get('user');
    const errorMsg = searchParams.get('error');

    if (errorMsg) {
      setError(errorMsg);
      const base = `${window.location.pathname}${window.location.search}`;
      setTimeout(() => {
        window.location.replace(`${base}#/auth?mode=signup&error=oauth_failed`);
      }, 1500);
      return;
    }

    if (token && userDataStr) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataStr));

        authService.handleOAuthCallback(token, userData, true);
        setUser(userData);

        void (async () => {
          setSignupPendingRole(true);
          await refreshUser();
          const user = useAuthStore.getState().user;
          navigate(getPostAuthPath(user, 'signup'));
        })();
      } catch (err) {
        console.error('Failed to parse OAuth callback:', err);
        setError('Authentication failed. Please try again.');
        const base = `${window.location.pathname}${window.location.search}`;
        setTimeout(() => {
          window.location.replace(`${base}#/auth?mode=signup&error=oauth_failed`);
        }, 1500);
      }
    } else {
      setError('Invalid authentication response');
      const base = `${window.location.pathname}${window.location.search}`;
      setTimeout(() => {
        window.location.replace(`${base}#/auth?mode=signup&error=oauth_failed`);
      }, 1500);
    }
  }, [searchParams, navigate, setUser]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6"
      >
        <Logo size="lg" className="mx-auto" />
        
        {error ? (
          <>
            <div className="size-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl text-red-500">error</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">{error}</h2>
            <p className="text-faint">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="size-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <span className="material-symbols-outlined text-3xl text-primary">lock_open</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">Signing you in...</h2>
            <div className="flex gap-2 justify-center">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
