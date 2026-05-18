import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface SupabaseContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const signup = async (email: string, pass: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
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
