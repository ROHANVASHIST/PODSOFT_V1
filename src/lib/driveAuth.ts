import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!supabase) {
    onAuthFailure?.();
    return () => {};
  }
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user && session.provider_token) {
      cachedAccessToken = session.provider_token;
      if (onAuthSuccess) onAuthSuccess(session.user, session.provider_token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });

  return supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user && session.provider_token) {
      cachedAccessToken = session.provider_token;
      if (onAuthSuccess) onAuthSuccess(session.user, session.provider_token);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!supabase) {
    console.warn('Supabase not initialized, cannot sign in');
    return null;
  }
  try {
    isSigningIn = true;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/drive',
        redirectTo: window.location.origin,
      },
    });
    
    if (error) throw error;
    
    // The redirect will handle the actual sign-in, session will be updated.
    return null; 
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  if (supabase) {
    await supabase.auth.signOut();
  }
  cachedAccessToken = null;
};
