import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Browser / native OAuth uses Supabase Auth directly; API routes still verify the same JWT.
 *
 * Production checklist (manual — not automated):
 * - Supabase Dashboard → Authentication → Providers: enable Google + Apple; add redirect URLs
 *   (e.g. quickpost://auth/callback, Expo dev URI from makeRedirectUri).
 * - Google Cloud Console: OAuth client + authorized redirect URIs including Supabase callback.
 * - Apple Developer: Sign In with Apple on the App ID; Service ID / keys as per Supabase Apple docs.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? 'https://placeholder.invalid';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? 'placeholder-anon-key';

export const isSupabaseOAuthConfigured = () =>
  Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
