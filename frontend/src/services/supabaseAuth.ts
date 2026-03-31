import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase, isSupabaseOAuthConfigured } from '../lib/supabase';

/** Parse Supabase OAuth redirect: query (PKCE) + hash (implicit). Search params override hash. */
function parseAuthRedirectParams(href: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const url = new URL(href);
    if (url.hash?.startsWith('#')) {
      const hp = new URLSearchParams(url.hash.slice(1));
      hp.forEach((value, key) => {
        result[key] = value;
      });
    }
    url.searchParams.forEach((value, key) => {
      result[key] = value;
    });
  } catch {
    /* ignore */
  }
  return result;
}

function oauthErrorMessage(params: Record<string, string>): string {
  const desc = params.error_description ?? params.error ?? 'Sign-in was cancelled or failed.';
  try {
    return decodeURIComponent(desc.replace(/\+/g, ' '));
  } catch {
    return desc;
  }
}

/**
 * Google via WebBrowser + Supabase OAuth (implicit flow). Returns session or throws a friendly Error.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!isSupabaseOAuthConfigured()) {
    throw new Error('Google sign-in is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  const redirectTo = makeRedirectUri({
    scheme: 'quickpost',
    path: 'auth/callback',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw new Error(error.message || 'Could not start Google sign-in.');
  }
  if (!data?.url) {
    throw new Error('Could not start Google sign-in.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Sign-in cancelled.');
  }
  if (result.type !== 'success' || !result.url) {
    throw new Error('Sign-in did not complete.');
  }

  const params = parseAuthRedirectParams(result.url);

  if (params.error) {
    throw new Error(oauthErrorMessage(params));
  }

  if (params.code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(params.code);
    if (exchanged.error) {
      throw new Error(exchanged.error.message || 'Could not complete Google sign-in.');
    }
    return;
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (access_token && refresh_token) {
    const set = await supabase.auth.setSession({ access_token, refresh_token });
    if (set.error) {
      throw new Error(set.error.message || 'Could not complete Google sign-in.');
    }
    return;
  }

  throw new Error('Could not read sign-in response. Try again.');
}

export type AppleSignInDisplayName = {
  givenName: string | null;
  familyName: string | null;
} | null;

/**
 * Apple Sign In (iOS). Returns optional display name for first-time sign-in only.
 */
export async function signInWithApple(): Promise<{ displayName: string | null }> {
  if (!isSupabaseOAuthConfigured()) {
    throw new Error('Apple sign-in is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  if (Platform.OS !== 'ios') {
    throw new Error('Apple sign-in is only available on iOS.');
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error('Apple sign-in is not available on this device.');
  }

  const rawNonce = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return a valid credential.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) {
    throw new Error(error.message || 'Apple sign-in failed.');
  }

  let displayName: string | null = null;
  const fn = credential.fullName;
  if (fn) {
    const parts = [fn.givenName, fn.familyName].filter(Boolean) as string[];
    if (parts.length > 0) {
      displayName = parts.join(' ');
    }
  }

  if (displayName) {
    await supabase.auth.updateUser({
      data: { full_name: displayName, name: displayName },
    });
  }

  return { displayName };
}
