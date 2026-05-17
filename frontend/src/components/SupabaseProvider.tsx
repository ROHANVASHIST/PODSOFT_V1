import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface AppUser {
  uid: string;
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
}

interface SupabaseContextType {
  user: AppUser | null;
  loading: boolean;
  login: () => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

const mapUser = (sbUser: any): AppUser | null => {
  if (!sbUser) return null;
  return {
    id: sbUser.id,
    uid: sbUser.id,
    email: sbUser.email || '',
    displayName: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'User',
    photoURL: sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture || '',
  };
};

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(mapUser(session?.user));
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapUser(session?.user));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/drive',
      },
    });
    if (error) throw error;
  };

  const signup = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
    });
    if (error) throw error;
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
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

// Alias for backwards compatibility with existing imports if needed
export const useFirebase = useSupabase;
