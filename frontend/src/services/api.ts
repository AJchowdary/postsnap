/**
 * PostSnap API Client
 * Talks to the Node.js/Express backend (via Python proxy on port 8001).
 * All endpoints prefixed with /api.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Post, Platform } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_PREFIX = '/api/v1';
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

  const response = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await clearToken();
    throw new Error('UNAUTHORIZED');
  }
  if (response.status === 402) {
    const body = await response.json().catch(() => ({}));
    const err = new Error(body.reason === 'trial_ended' ? 'Trial ended' : 'Subscription required') as Error & { payload?: unknown };
    err.payload = body;
    throw err;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `API Error: ${response.status}`);
  }
  return response.json();
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

export const updateBusinessProfile = async (profile: {
  name: string;
  type: string;
  city?: string;
  brandStyle: string;
  useLogoOverlay: boolean;
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
}

export interface GenerateImageParams {
  photo: string;
  template: string;
  businessName: string;
  businessType: string;
  brandStyle: string;
  description: string;
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

export const generatePostImage = async (
  params: GenerateImageParams
): Promise<string | null> => {
  try {
    const data = await apiCall<{ processed_image: string | null }>('/generate/image', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return data.processed_image;
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
        postId: post.id, // for upsert
        scheduledAt: post.scheduledAt ?? null,
      }),
    });
    return normalizePost(data, post);
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
  try {
    await apiCall(`/posts/${postId}`, { method: 'DELETE' });
  } catch {
    // silently ignore
  }
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

// ---- Social Accounts ----
export const connectSocialAccount = async (platform: string, handle: string) => {
  try {
    return await apiCall('/social/connect', {
      method: 'POST',
      body: JSON.stringify({ platform, handle }),
    });
  } catch {
    return { success: true };
  }
};

export const disconnectSocialAccount = async (platform: string) => {
  try {
    return await apiCall(`/social/disconnect/${platform}`, { method: 'DELETE' });
  } catch {
    return { success: true };
  }
};

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
