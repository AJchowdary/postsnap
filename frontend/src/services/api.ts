/**
 * Quickpost API client — Node.js/Express backend. Endpoints use /api/v1.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform as RNPlatform } from 'react-native';
import { Post, Platform, SocialAccount } from '../types';

const API_PREFIX = '/api/v1';

/** Default fetch timeout (ms). Override with EXPO_PUBLIC_API_FETCH_TIMEOUT_MS. */
const FETCH_TIMEOUT_MS =
  Math.max(5000, parseInt(process.env.EXPO_PUBLIC_API_FETCH_TIMEOUT_MS || '60000', 10) || 60000);

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function isLoopbackApiUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const normalized = url.includes('://') ? url : `http://${url}`;
    const u = new URL(normalized);
    const h = u.hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost');
  } catch {
    return false;
  }
}

/**
 * Web: uses EXPO_PUBLIC_API_BASE_URL (localhost is the browser’s machine).
 * Native + loopback: uses EXPO_PUBLIC_API_BASE_URL_DEVICE / PRODUCTION, or Android emulator host (10.0.2.2).
 */
function resolveApiBaseUrl(): string {
  const primary = stripTrailingSlash(
    process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_BACKEND_URL || ''
  );

  if (RNPlatform.OS === 'web') {
    return primary;
  }

  if (primary && isLoopbackApiUrl(primary)) {
    const deviceUrl = stripTrailingSlash(
      process.env.EXPO_PUBLIC_API_BASE_URL_DEVICE ||
        process.env.EXPO_PUBLIC_API_BASE_URL_PRODUCTION ||
        ''
    );
    if (deviceUrl) return deviceUrl;

    if (RNPlatform.OS === 'android') {
      try {
        const u = new URL(primary.includes('://') ? primary : `http://${primary}`);
        const port = u.port || '4000';
        return `http://10.0.2.2:${port}`;
      } catch {
        return primary;
      }
    }

    if (__DEV__) {
      console.warn(
        '[api] EXPO_PUBLIC_API_BASE_URL is localhost but this is a native build. ' +
          'Set EXPO_PUBLIC_API_BASE_URL_DEVICE (e.g. https://quickpost-tl4u.onrender.com or http://192.168.x.x:4000).'
      );
    }
  }

  return primary;
}

const BASE_URL = resolveApiBaseUrl();
const AUTH_TOKEN_KEY = '@quickpost_token';

// ---- Token helpers ----
let _token: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (_token) return _token;
  _token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return _token;
}

export async function saveToken(token: string) {
  _token = token;
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function clearToken() {
  _token = null;
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}

function unwrapJson<T>(json: unknown): T {
  if (
    json !== null &&
    typeof json === 'object' &&
    'success' in json &&
    (json as { success: boolean }).success === true &&
    'data' in json
  ) {
    return (json as { data: T }).data;
  }
  return json as T;
}

// ---- Core fetch ----
async function apiCall<T>(
  path: string,
  options?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const token = options?.skipAuth ? null : await loadToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${BASE_URL}${API_PREFIX}${path}`;
  let response: Response;
  try {
    if (options?.signal) {
      response = await fetch(url, { ...options, headers });
    } else {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        response = await fetch(url, { ...options, headers, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Request timeout after ${FETCH_TIMEOUT_MS / 1000}s (check API URL and network)`);
    }
    throw e;
  }

  if (response.status === 401) {
    await clearToken();
    throw new Error('UNAUTHORIZED');
  }
  if (response.status === 402) {
    const body = await response.json().catch(() => ({})) as {
      data?: unknown;
      success?: boolean;
      upgrade_required?: boolean;
      reason?: string;
    };
    const payload = body?.data ?? body;
    const err = new Error(
      (payload as { reason?: string })?.reason === 'trial_ended' ? 'Trial ended' : 'Subscription required'
    ) as Error & { payload?: unknown };
    err.payload = payload;
    throw err;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as {
      error?: { message?: string; code?: string };
      message?: string;
    };
    const msg =
      body?.error?.message ?? body?.message ?? `API Error: ${response.status}`;
    throw new Error(msg);
  }
  const json = await response.json();
  return unwrapJson<T>(json);
}

// ---- Auth ----
export const authRegister = async (
  email: string,
  password: string
): Promise<{ user: { id: string; email: string }; token: string }> => {
  return apiCall('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
};

export const authLogin = async (
  email: string,
  password: string
): Promise<{ user: { id: string; email: string }; token: string }> => {
  return apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
};

export const authMe = async (): Promise<{ userId: string }> => {
  return apiCall('/auth/me');
};

// ---- Account / Bootstrap ----
export const bootstrapAccount = async (): Promise<any> => {
  return apiCall('/account/bootstrap', { method: 'POST' });
};

export const getMyAccount = async (): Promise<any> => {
  return apiCall('/account/me');
};

export type WebsiteScanResult = {
  brandSummary: string;
  suggestedVibe: 'professional' | 'bold' | 'warm';
  suggestedColor: string;
  suggestedColors: string[];
  businessType: string;
  city: string | null;
  instagramHandle: string | null;
  tone: string;
};

export const scanWebsite = async (
  websiteUrl: string
): Promise<{ account: Record<string, unknown>; scan: WebsiteScanResult }> => {
  return apiCall('/account/scan-website', {
    method: 'POST',
    body: JSON.stringify({ websiteUrl }),
  });
};

export const updateBusinessProfile = async (profile: {
  name: string;
  type: string;
  displayType: string;
  customDescription: string;
  city?: string;
  brandStyle: string;
  useLogoOverlay: boolean;
  brandColor?: string;
  brandVibe?: 'professional' | 'bold' | 'warm';
  dominantColors?: string[];
  websiteUrl?: string;
  websiteSummary?: string;
  toneExample?: string;
  instagramHandle?: string;
  facebookPage?: string;
  brandDnaSource?: 'website' | 'manual' | 'hybrid';
}): Promise<any> => {
  return apiCall('/account/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
};

// ---- Caption & Image Generation ----
export interface GenerateCaptionParams {
  description: string;
  template: string;
  businessName: string;
  businessType: string;
  brandStyle: string;
  displayType: string;
  aiCategory: string;
  customDescription: string;
  brandColor?: string;
  brandVibe?: string;
  dominantColors?: string[];
  websiteSummary?: string;
  city?: string;
  instagramHandle?: string;
}

export interface GenerateImageParams {
  photo: string;
  template: string;
  businessName: string;
  businessType: string;
  brandStyle: string;
  description: string;
  displayType: string;
  aiCategory: string;
  customDescription: string;
  brandColor?: string;
  brandVibe?: string;
  websiteSummary?: string;
  dominantColors?: string[];
  city?: string;
  instagramHandle?: string;
}

export const generateCaption = async (params: GenerateCaptionParams): Promise<string> => {
  try {
    const data = await apiCall<{ caption: string }>('/generate/caption', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return data.caption || fallbackCaption(params);
  } catch {
    return fallbackCaption(params);
  }
};

export type GenerateImageResult = {
  processed_image: string | null;
  withOverlay: string | null;
  clean: string | null;
};

export const generatePostImage = async (
  params: GenerateImageParams
): Promise<GenerateImageResult | null> => {
  try {
    const data = await apiCall<{
      processed_image: string | null;
      processed_image_with_overlay: string | null;
      processed_image_clean: string | null;
    }>('/generate/image', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return {
      processed_image: data.processed_image,
      withOverlay: data.processed_image_with_overlay,
      clean: data.processed_image_clean,
    };
  } catch {
    return null;
  }
};

// ---- Posts ----
export const savePostToBackend = async (post: Partial<Post>): Promise<Post> => {
  try {
    const data = await apiCall<any>('/posts', {
      method: 'POST',
      body: JSON.stringify({
        template: post.template || 'auto',
        photo: post.photo,
        description: post.description || '',
        caption: post.caption || '',
        processedImage: post.processedImage,
        platforms: post.platforms || [],
        status: post.status || 'draft',
        postId: post.id,
        scheduledAt: post.scheduledAt ?? null,
      }),
    });
    const inner = data?.post ?? data;
    return normalizePost(inner, post);
  } catch {
    return localPost(post);
  }
};

export const publishPostToBackend = async (
  postId: string,
  platforms: string[]
): Promise<{ success: boolean; message: string; jobId?: string }> => {
  const data = await apiCall<{ success?: boolean; message?: string; jobId?: string }>(
    `/posts/${postId}/publish`,
    {
      method: 'POST',
      body: JSON.stringify({ platforms }),
    }
  );
  const success = data.success !== false && (!!data.jobId || data.success === true);
  return {
    success,
    message: data.message ?? (success ? 'Accepted' : 'Failed'),
    jobId: data.jobId,
  };
};

export const deletePostFromBackend = async (postId: string): Promise<void> => {
  await apiCall(`/posts/${postId}`, { method: 'DELETE' });
};

export const fetchPostsFromBackend = async (status?: string): Promise<Post[]> => {
  try {
    const query = status ? `?status=${status}` : '';
    const data = await apiCall<any[]>(`/posts${query}`);
    return data.map((d) => normalizePost(d, {}));
  } catch {
    return [];
  }
};

// ---- Social / Meta OAuth ----
/** Matches GET /social/connections response (camelCase from API). */
export interface SocialConnectionMetaDto {
  status: string;
  reconnectRequired?: boolean;
  pageName?: string | null;
  pageId?: string | null;
  expiresAt?: string | null;
  username?: string | null;
  igBusinessId?: string | null;
}

export interface SocialConnectionsResponse {
  facebook: SocialConnectionMetaDto | null;
  instagram: SocialConnectionMetaDto | null;
}

/** Must match apps/api `META_REDIRECT_URI` (Facebook Valid OAuth Redirect URI). */
export function getMetaOAuthRedirectUrlForBrowser(): string {
  const base = BASE_URL.replace(/\/$/, '');
  const explicit = process.env.EXPO_PUBLIC_META_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${base}${API_PREFIX}/social/meta/callback`;
}

export async function fetchSocialConnections(): Promise<SocialConnectionsResponse> {
  return apiCall<SocialConnectionsResponse>('/social/connections');
}

export async function getMetaOAuthLoginUrl(
  platform: Platform
): Promise<{ url: string }> {
  return apiCall<{ url: string }>(
    `/social/meta/login-url?platform=${encodeURIComponent(platform)}`
  );
}

/** Legacy “fake” connect (handle only). Errors propagate to the caller. */
export const connectSocialAccount = async (platform: string, handle: string) => {
  return apiCall<{ success: boolean }>('/social/connect', {
    method: 'POST',
    body: JSON.stringify({ platform, handle }),
  });
};

/** Meta-aware disconnect: clears tokens and Graph IDs server-side. */
export const disconnectSocialAccount = async (platform: Platform) => {
  return apiCall<{ success: boolean }>(`/social/connections/${platform}`, {
    method: 'DELETE',
  });
};

export function mapConnectionsToSocialAccounts(
  data: SocialConnectionsResponse
): { instagram: SocialAccount | null; facebook: SocialAccount | null } {
  const mapFacebook = (fb: SocialConnectionMetaDto | null): SocialAccount | null => {
    if (!fb || fb.status === 'disconnected') return null;
    const usable =
      (fb.status === 'connected' || fb.status === 'active') && !fb.reconnectRequired;
    const label = fb.pageName || fb.pageId || 'Facebook Page';
    return {
      platform: 'facebook',
      handle: label,
      connected: usable,
      pageName: fb.pageName ?? null,
      status: fb.status,
      reconnectRequired: !!fb.reconnectRequired,
    };
  };
  const mapInstagram = (ig: SocialConnectionMetaDto | null): SocialAccount | null => {
    if (!ig || ig.status === 'disconnected') return null;
    const usable =
      (ig.status === 'connected' || ig.status === 'active') && !ig.reconnectRequired;
    const raw = ig.username?.replace(/^@/, '') || '';
    const label = raw ? `@${raw}` : ig.igBusinessId || 'Instagram';
    return {
      platform: 'instagram',
      handle: label,
      connected: usable,
      igUsername: ig.username ?? null,
      status: ig.status,
      reconnectRequired: !!ig.reconnectRequired,
    };
  };
  return {
    facebook: mapFacebook(data.facebook),
    instagram: mapInstagram(data.instagram),
  };
}

// ---- Subscription ----
export const getSubscriptionStatus = async () => {
  try {
    return await apiCall<any>('/subscription/status');
  } catch {
    return null;
  }
};

export const upgradeSubscription = async () => {
  try {
    return await apiCall<{ success: boolean }>('/subscription/upgrade', { method: 'POST' });
  } catch {
    return { success: false };
  }
};

/** IAP: verify receipt/token server-side. Never unlock without this. */
export const verifySubscriptionPurchase = async (body: {
  platform: 'ios' | 'android';
  productId: string;
  receipt?: string;
  purchaseToken?: string;
  packageName?: string;
  transactionId?: string;
}) => {
  return apiCall<{
    status: string;
    currentPeriodEnd: string | null;
    isEligible: boolean;
    provider: string | null;
  }>('/subscription/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

/** IAP restore: send receipt/token to backend. */
export const restoreSubscriptionPurchase = async (body: {
  platform: 'ios' | 'android';
  productId: string;
  receipt?: string;
  purchaseToken?: string;
  packageName?: string;
  transactionId?: string;
}) => {
  return apiCall<{
    status: string;
    currentPeriodEnd: string | null;
    isEligible: boolean;
    provider: string | null;
  }>('/subscription/restore', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

// ---- Helpers ----
function fallbackCaption(params: GenerateCaptionParams): string {
  const emojis: Record<string, string> = {
    restaurant: '🍽️',
    salon: '💅',
    retail: '🛍️',
    gym: '💪',
    cafe: '☕',
  };
  const emoji = emojis[params.businessType] || '✨';
  return `${emoji} ${params.description}! Visit us today. #local #smallbusiness #${params.businessType}`;
}

function normalizePost(data: any, original: Partial<Post>): Post {
  return {
    id: data.id || data._id || Date.now().toString(),
    template: data.template || original.template || 'auto',
    photo: data.photo ?? original.photo,
    description: data.description || original.description || '',
    caption: data.caption || original.caption || '',
    processedImage: data.processedImage ?? data.processed_image ?? original.processedImage,
    platforms: data.platforms || original.platforms || [],
    status: data.status || original.status || 'draft',
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
    publishedAt: data.publishedAt || data.published_at || original.publishedAt,
    scheduledAt: data.scheduledAt || data.scheduled_at || original.scheduledAt,
  };
}

function localPost(post: Partial<Post>): Post {
  return {
    id: Date.now().toString(),
    template: post.template || 'auto',
    photo: post.photo,
    description: post.description || '',
    caption: post.caption || '',
    processedImage: post.processedImage,
    platforms: post.platforms || [],
    status: post.status || 'draft',
    createdAt: new Date().toISOString(),
    publishedAt: post.publishedAt,
    scheduledAt: post.scheduledAt,
  };
}
