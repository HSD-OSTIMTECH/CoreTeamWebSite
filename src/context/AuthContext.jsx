import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUserFromStorage = () => {
    try {
      const savedUser = localStorage.getItem('custom_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (err) {
      console.error('Kullanıcı verisi ayrıştırılamadı:', err);
      return null;
    }
  };

  const syncAuth = async () => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const customUser = loadUserFromStorage();

      if (authSession) {
        setSession(authSession);
        setUser(authSession.user);
      } else if (customUser) {
        setSession({ user: customUser, isCustom: true });
        setUser(customUser);
      } else {
        setSession(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Oturum senkronizasyon hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncAuth();

    // Supabase auth değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      } else {
        const customUser = loadUserFromStorage();
        if (customUser) {
          setSession({ user: customUser, isCustom: true });
          setUser(customUser);
        } else {
          setSession(null);
          setUser(null);
        }
      }
    });

    // Sekmeler arası ve localStorage değişikliklerini dinle
    const handleStorageChange = () => {
      const customUser = loadUserFromStorage();
      if (customUser) {
        setSession({ user: customUser, isCustom: true });
        setUser(customUser);
      } else {
        syncAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = (userData, token) => {
    if (userData) {
      localStorage.setItem('custom_user', JSON.stringify(userData));
    }
    if (token) {
      localStorage.setItem('token', token);
    }
    setUser(userData);
    setSession({ user: userData, isCustom: true });
    window.dispatchEvent(new Event('storage'));
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase oturumu kapatılırken hata:', err);
    }
    localStorage.removeItem('custom_user');
    localStorage.removeItem('token');
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
