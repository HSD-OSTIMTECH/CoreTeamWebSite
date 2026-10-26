import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { isTokenExpired, getTokenRemainingMs } from '../lib/security';
import { dispatchSessionExpired } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const expiryTimerRef = useRef(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const scheduleExpiry = useCallback((token) => {
    clearExpiryTimer();
    if (!token) return;

    const remainingMs = getTokenRemainingMs(token);
    if (remainingMs <= 0) {
      dispatchSessionExpired('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
      setUser(null);
      setSession(null);
      return;
    }

    expiryTimerRef.current = setTimeout(() => {
      dispatchSessionExpired('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
      setUser(null);
      setSession(null);
    }, remainingMs);
  }, [clearExpiryTimer]);

  const loadUserFromStorage = () => {
    try {
      const savedUser = localStorage.getItem('custom_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (err) {
      console.error('Kullanıcı verisi ayrıştırılamadı:', err);
      return null;
    }
  };

  const syncAuth = useCallback(async () => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const customUser = loadUserFromStorage();
      const token = localStorage.getItem('token');

      if (authSession) {
        clearExpiryTimer();
        setSession(authSession);
        setUser(authSession.user);
      } else if (customUser) {
        if (!token || isTokenExpired(token)) {
          // Token süresi geçmiş veya token yoksa temizle ve oturum kapandı uyarısı ver
          dispatchSessionExpired('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
          clearExpiryTimer();
          setSession(null);
          setUser(null);
        } else {
          setSession({ user: customUser, isCustom: true });
          setUser(customUser);
          scheduleExpiry(token);
        }
      } else {
        clearExpiryTimer();
        setSession(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Oturum senkronizasyon hatası:', err);
    } finally {
      setLoading(false);
    }
  }, [clearExpiryTimer, scheduleExpiry]);

  useEffect(() => {
    syncAuth();

    // Supabase auth değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (currentSession) {
        clearExpiryTimer();
        setSession(currentSession);
        setUser(currentSession.user);
      } else {
        syncAuth();
      }
    });

    // Sekmeler arası ve localStorage değişikliklerini dinle
    const handleStorageChange = () => {
      syncAuth();
    };

    // Sekme görünür olduğunda veya odaklandığında token süresini anlık denetle
    const verifyTokenOnFocus = () => {
      const token = localStorage.getItem('token');
      if (token && isTokenExpired(token)) {
        dispatchSessionExpired('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
        clearExpiryTimer();
        setUser(null);
        setSession(null);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verifyTokenOnFocus();
      }
    };

    const handleSessionExpiredEvent = () => {
      clearExpiryTimer();
      setUser(null);
      setSession(null);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', verifyTokenOnFocus);
    window.addEventListener('auth:session-expired', handleSessionExpiredEvent);

    return () => {
      subscription.unsubscribe();
      clearExpiryTimer();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', verifyTokenOnFocus);
      window.removeEventListener('auth:session-expired', handleSessionExpiredEvent);
    };
  }, [syncAuth, clearExpiryTimer]);

  const login = (userData, token) => {
    if (userData) {
      localStorage.setItem('custom_user', JSON.stringify(userData));
    }
    if (token) {
      localStorage.setItem('token', token);
    }
    sessionStorage.removeItem('session_expired_message');
    setUser(userData);
    setSession({ user: userData, isCustom: true });
    scheduleExpiry(token);
  };

  const logout = async () => {
    clearExpiryTimer();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase oturumu kapatılırken hata:', err);
    }
    localStorage.removeItem('custom_user');
    localStorage.removeItem('token');
    sessionStorage.removeItem('session_expired_message');
    setUser(null);
    setSession(null);
    window.dispatchEvent(new Event('storage'));
  };

  const value = {
    user,
    session,
    loading,
    login,
    logout,
    refreshUser: syncAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
