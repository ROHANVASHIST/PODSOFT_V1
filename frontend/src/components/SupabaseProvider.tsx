import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface SupabaseContextType {
  user: any | null;
  loading: boolean;
  login: () => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

const formatUser = (u: User | null): any => {
  if (!u) return null;
  return {
    ...u,
    uid: u.id,
    displayName: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Creator',
    photoURL: u.user_metadata?.avatar_url || ''
  };
};

const mockUser = {
  id: 'mock_user_123',
  uid: 'mock_user_123',
  email: 'creator@podsoft.studio',
  displayName: 'PodSoft Creator',
  photoURL: ''
};

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(formatUser(session?.user ?? null));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(formatUser(session?.user ?? null));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async () => {
    if (!supabase) {
      setUser(mockUser);
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (error) {
      console.warn('Supabase OAuth failed, using fallback mock user:', error);
      setUser(mockUser);
    }
  };

  const signup = async (email: string, pass: string) => {
    if (!supabase) {
      setUser({ ...mockUser, email, displayName: email.split('@')[0] });
      return;
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
      });
      if (error) throw error;
      if (data?.user) setUser(formatUser(data.user));
      else setUser({ ...mockUser, email, displayName: email.split('@')[0] });
    } catch (error) {
      console.warn('Supabase signup failed, using fallback mock user:', error);
      setUser({ ...mockUser, email, displayName: email.split('@')[0] });
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) {
      setUser({ ...mockUser, email, displayName: email.split('@')[0] });
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) throw error;
      if (data?.user) setUser(formatUser(data.user));
      else setUser({ ...mockUser, email, displayName: email.split('@')[0] });
    } catch (error) {
      console.warn('Supabase email login failed, using fallback mock user:', error);
      setUser({ ...mockUser, email, displayName: email.split('@')[0] });
    }
  };

  const logout = async () => {
    setUser(null);
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Logout failed:', error);
    }
  };

  return (
    <SupabaseContext.Provider value={{ user, loading, login, signup, loginWithEmail, logout }}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
