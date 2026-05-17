import { supabase } from './supabase';

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user && session?.provider_token) {
      cachedAccessToken = session.provider_token;
      if (onAuthSuccess) onAuthSuccess(session.user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user && session?.provider_token) {
      cachedAccessToken = session.provider_token;
      if (onAuthSuccess) onAuthSuccess(session.user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });

  return () => subscription.unsubscribe();
};

export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/drive',
      },
    });
    if (error) throw error;
    return null;
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.provider_token) {
    cachedAccessToken = session.provider_token;
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await supabase.auth.signOut();
  cachedAccessToken = null;
};
