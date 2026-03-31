/**
 * Quickpost API client — Node.js/Express backend. Endpoints use /api/v1.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform as RNPlatform } from 'react-native';
import { Post, Platform, PostStatus, SocialAccount } from '../types';
import type { ImageAspectPreset } from '../constants/imageAspect';

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
        // 10.0.2.2 reaches the dev machine only from the Android *emulator*, not a physical phone.
        if (Constants.isDevice === false) {
          return `http://10.0.2.2:${port}`;
        }
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

/**
 * Physical phones cannot use localhost / emulator-only hosts — requests hang until fetch times out.
 * Simulators/emulators are allowed (they can reach the dev machine).
 */
function assertApiReachableOnDevice(): void {
  if (!__DEV__ || RNPlatform.OS === 'web') return;
  if (Constants.isDevice !== true) return;

  if (isLoopbackApiUrl(BASE_URL)) {
    throw new Error(
      'API URL is localhost — your phone cannot reach your computer. In frontend/.env set EXPO_PUBLIC_API_BASE_URL_DEVICE=http://YOUR_LAN_IP:4000 (same Wi‑Fi as the phone), then restart Expo.'
    );
  }
  if (RNPlatform.OS === 'android' && BASE_URL.includes('10.0.2.2')) {
    throw new Error(
      'API host 10.0.2.2 only works on Android emulator. On a real phone, set EXPO_PUBLIC_API_BASE_URL_DEVICE=http://YOUR_LAN_IP:4000 and restart Expo.'
    );
  }
}

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
  assertApiReachableOnDevice();
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
      // Caller-provided signal (e.g. user cancelled scan) — do not treat as timeout.
      if (options?.signal?.aborted) {
        throw new Error('Request cancelled');
      }
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

export async function savePushToken(token: string): Promise<{ ok: boolean }> {
  return apiCall('/account/push-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function setPushNotificationsEnabledApi(enabled: boolean): Promise<{ account: Record<string, unknown> }> {
  return apiCall('/account/push-notifications', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export type InAppNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  postId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getNotifications(opts?: { limit?: number }): Promise<{ notifications: InAppNotification[] }> {
  const q = opts?.limit != null ? `?limit=${encodeURIComponent(String(opts.limit))}` : '';
  return apiCall(`/account/notifications${q}`);
}

export async function getUnreadNotificationCount(): Promise<{ count: number }> {
  return apiCall('/account/notifications/unread-count');
}

export async function markNotificationRead(notificationId: string): Promise<{ notification: InAppNotification }> {
  return apiCall(`/account/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function markAllRead(): Promise<{ updated: number }> {
  return apiCall('/account/notifications/read-all', { method: 'POST', body: JSON.stringify({}) });
}

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
  websiteUrl: string,
  opts?: { signal?: AbortSignal }
): Promise<{ account: Record<string, unknown>; scan: WebsiteScanResult }> => {
  return apiCall('/account/scan-website', {
    method: 'POST',
    body: JSON.stringify({ websiteUrl }),
    ...(opts?.signal ? { signal: opts.signal } : {}),
  });
};

/** Matches server `scrapeProductPage` success shape (camelCase from adapter). */
export type ProductScrapeApiSuccess = {
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  price: string | null;
  url: string;
};

export type ProductScrapeApiFailure = { error: 'BLOCKED' | 'EMPTY' | 'TIMEOUT' };

export type ProductScrapeApiResult = ProductScrapeApiSuccess | ProductScrapeApiFailure;

const PRODUCT_SCRAPE_TIMEOUT_MS = 8000;

/** Fetch product metadata from a public URL (~8s deadline, same idea as website scan overlay). */
export async function scrapeProductFromUrl(
  url: string,
  opts?: { signal?: AbortSignal }
): Promise<ProductScrapeApiResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PRODUCT_SCRAPE_TIMEOUT_MS);
  const onParentAbort = () => controller.abort();
  opts?.signal?.addEventListener('abort', onParentAbort);
  try {
    return await apiCall<ProductScrapeApiResult>('/products/scrape', {
      method: 'POST',
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
    opts?.signal?.removeEventListener('abort', onParentAbort);
  }
}

export type SignalPayload = {
  signalType:
    | 'publish'
    | 'regenerate'
    | 'edit_caption'
    | 'studio_style_selected'
    | 'variant_selected'
    | 'thumbs_up'
    | 'thumbs_down'
    | 'save_without_publish'
    | 'topic_skip';
  topic?: string;
  angle?: string;
  studioStyle?: 'clean-white' | 'lifestyle' | 'dark-dramatic' | 'flat-lay' | 'outdoor-natural';
  metadata?: Record<string, unknown>;
};

export const captureSignal = async (payload: SignalPayload): Promise<{ account: Record<string, unknown> }> => {
  return apiCall('/account/signal', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export type AnalyticsEventName =
  | 'ONBOARDING_STARTED'
  | 'ONBOARDING_COMPLETED'
  | 'POST_GENERATED'
  | 'POST_PUBLISHED'
  | 'POST_REGENERATED'
  | 'POST_EDITED'
  | 'STUDIO_USED'
  | 'BRAND_BRAIN_ENRICHED'
  | 'QUALITY_RETRY_TRIGGERED'
  | 'GENERIC_DETECTED';

export const trackAnalyticsEvent = async (payload: {
  event: AnalyticsEventName;
  postId?: string;
  properties?: Record<string, unknown>;
}): Promise<{ ok: boolean }> => {
  return apiCall('/account/analytics-event', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateBusinessProfile = async (profile: {
  name: string;
  type: string;
  displayType: string;
  customDescription: string;
  city?: string;
  logo?: string | null;
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
  businessSubcategory?: string;
  neighborhood?: string;
  tagline?: string;
  toneOfVoice?: 'casual' | 'professional' | 'conversational' | 'inspiring' | 'bold';
  contentPersona?: string;
  coreServices?: string[];
  heroProduct?: string;
  pricePositioning?: 'budget' | 'mid' | 'premium' | 'luxury';
  uniqueDifferentiator?: string;
  visualStyle?: 'photo-real' | 'illustrated' | 'bold-graphic' | 'lifestyle';
  photoStyleExamples?: string[];
  studioStylePreference?: 'clean-white' | 'lifestyle' | 'dark-dramatic' | 'flat-lay' | 'outdoor-natural';
  studioBgColor?: string;
  seasonalContext?: string;
  localEvents?: string[];
  lastPostTopics?: string[];
  topPerformingAngles?: string[];
  preferredCaptionLength?: 'short' | 'medium' | 'long';
  preferredPostingDays?: string[];
  photoStudioHistory?: Array<Record<string, unknown>>;
  confidenceOverall?: number;
  enrichmentVersion?: number;
  brainFieldConfidence?: Record<string, number>;
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
  studioStylePreference?: 'clean-white' | 'lifestyle' | 'dark-dramatic' | 'flat-lay' | 'outdoor-natural';
  toneOfVoice?: string;
  contentPersona?: string;
  uniqueDifferentiator?: string;
  visualStyle?: string;
  studioBgColor?: string;
}

export type GenerateCaptionQuality = {
  score: number;
  tags: string[];
  rationale: string;
};

export type GenerateCaptionResponse = {
  caption: string;
  quality?: GenerateCaptionQuality;
  /** Debug: which AI provider produced the caption. */
  aiProvider?: string;
  openaiConfigured?: boolean;
  retry?: {
    attempts: number;
    strategy: 'brief-primary' | 'brief-retry' | 'legacy-fallback';
    reason?: string | null;
  } | null;
};

export const generateCaptionDetailed = async (
  params: GenerateCaptionParams
): Promise<GenerateCaptionResponse> => {
  const data = await apiCall<GenerateCaptionResponse>('/generate/caption', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (!data.caption?.trim()) {
    throw new Error('Caption generation returned empty content.');
  }
  return data;
};

export interface GenerateImageParams {
  photo?: string;
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
  /** Preset id (clean-white, …) or free-text studio direction */
  studioStylePreference?: string;
  toneOfVoice?: string;
  contentPersona?: string;
  uniqueDifferentiator?: string;
  visualStyle?: string;
  studioBgColor?: string;
  /** Matches POST /generate/image — square, wide feed, or tall story */
  aspectPreset?: ImageAspectPreset;
}

export const generateCaption = async (params: GenerateCaptionParams): Promise<string> => {
  const data = await generateCaptionDetailed(params);
  return data.caption;
};

export type GenerateImageResult = {
  processed_image: string | null;
  withOverlay: string | null;
  clean: string | null;
  variants?: string[];
  aiProvider?: string;
  openaiConfigured?: boolean;
};

export const generatePostImage = async (
  params: GenerateImageParams
): Promise<GenerateImageResult | null> => {
  try {
    const data = await apiCall<{
      processed_image: string | null;
      processed_image_with_overlay: string | null;
      processed_image_clean: string | null;
      processed_image_variants?: string[];
      aiProvider?: string;
      openaiConfigured?: boolean;
    }>('/generate/image', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return {
      processed_image: data.processed_image,
      withOverlay: data.processed_image_with_overlay,
      clean: data.processed_image_clean,
      variants: data.processed_image_variants ?? [],
      aiProvider: (data as { aiProvider?: string }).aiProvider,
      openaiConfigured: (data as { openaiConfigured?: boolean }).openaiConfigured,
    };
  } catch {
    return null;
  }
};

export type EditCaptionChatTurn = { role: 'user' | 'assistant'; content: string };

export type EditCaptionResponse = {
  message: string;
  newCaption: string;
  newHashtags: string[];
};

export const editCaptionWithAI = async (body: {
  userRequest: string;
  currentCaption: string;
  currentHashtags: string[];
  businessName: string;
  city: string;
  ideaText: string;
  chatHistory: EditCaptionChatTurn[];
}): Promise<EditCaptionResponse> => {
  return apiCall<EditCaptionResponse>('/generate/edit-caption', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

// ---- Posts ----
/** Server-enforced max drafts per account (mirrors API `DRAFT_LIMIT`). */
export const DRAFT_LIMIT = 6;

export type DraftsPayload = {
  posts: Post[];
  count: number;
  limit: number;
};

/** GET /posts/drafts — drafts only, with count and limit for UI. */
export const fetchDraftsFromBackend = async (): Promise<DraftsPayload> => {
  try {
    const data = await apiCall<{ posts: any[]; count: number; limit: number }>('/posts/drafts');
    const posts = Array.isArray(data.posts) ? data.posts : [];
    return {
      posts: posts.map((d) => normalizePost(d, {})),
      count: typeof data.count === 'number' ? data.count : posts.length,
      limit: typeof data.limit === 'number' ? data.limit : DRAFT_LIMIT,
    };
  } catch {
    return { posts: [], count: 0, limit: DRAFT_LIMIT };
  }
};

export const savePostToBackend = async (post: Partial<Post>): Promise<Post> => {
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

export const fetchPostById = async (postId: string): Promise<Post> => {
  const data = await apiCall<any>(`/posts/${encodeURIComponent(postId)}`);
  return normalizePost(data, {});
};

/** Count of drafts for the current account (uses GET /posts/drafts). */
export async function getDraftCount(): Promise<number> {
  const { count } = await fetchDraftsFromBackend();
  return count;
}

// ---- Campaigns ----
export type CampaignAspectRatio = 'square' | 'feed' | 'story' | 'landscape';

export type CampaignSummary = {
  id: string;
  title: string;
  prompt: string;
  productUrl: string | null;
  productName: string | null;
  productDescription: string | null;
  productImageUrl: string | null;
  /** Up to 6 reference images (URLs or data URLs) for style / composition. */
  referenceImageUrls?: string[];
  aspectRatio: CampaignAspectRatio;
  createdAt: string;
  updatedAt: string;
  creativeCount: number;
  thumbnailUrl: string | null;
};

export type CampaignIdeaCard = {
  id: string;
  emoji: string;
  /** Short label for UI (e.g. pill). */
  contentAngle: string;
  headline: string;
  rationale: string;
  prompt: string;
};

/** POST /campaigns/suggest-ideas — Brand Brain–aware campaign/post ideas. */
export async function getCampaignSuggestions(prompt?: string): Promise<{ ideas: CampaignIdeaCard[] }> {
  return apiCall('/campaigns/suggest-ideas', {
    method: 'POST',
    body: JSON.stringify({ hint: prompt?.trim() || null }),
  });
}

export const fetchCampaigns = async (): Promise<CampaignSummary[]> => {
  return apiCall<CampaignSummary[]>('/campaigns');
};

export const fetchCampaign = async (id: string): Promise<CampaignSummary> => {
  return apiCall<CampaignSummary>(`/campaigns/${encodeURIComponent(id)}`);
};

export const createCampaign = async (body: {
  title: string;
  prompt: string;
  product_url?: string | null;
  product_name?: string | null;
  product_description?: string | null;
  product_image_url?: string | null;
  reference_image_urls?: string[];
  aspect_ratio?: CampaignAspectRatio;
}): Promise<CampaignSummary> => {
  return apiCall<CampaignSummary>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const updateCampaign = async (
  id: string,
  body: Partial<{
    title: string;
    prompt: string;
    product_url: string | null;
    product_name: string | null;
    product_description: string | null;
    product_image_url: string | null;
    reference_image_urls: string[] | null;
    aspect_ratio: CampaignAspectRatio;
  }>
): Promise<CampaignSummary> => {
  return apiCall<CampaignSummary>(`/campaigns/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
};

export const deleteCampaign = async (id: string): Promise<void> => {
  await apiCall(`/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

export const generateCampaignCreative = async (
  campaignId: string,
  opts?: {
    premium_quality?: boolean;
    product_name?: string | null;
    product_description?: string | null;
    product_image_url?: string | null;
  }
): Promise<{ post: Post; jobId: string; status: string }> => {
  const data = await apiCall<{ post: any; jobId: string; status: string }>(
    `/campaigns/${encodeURIComponent(campaignId)}/generate`,
    {
      method: 'POST',
      body: JSON.stringify(opts ?? {}),
    }
  );
  return {
    post: normalizePost(data.post, {}),
    jobId: data.jobId,
    status: data.status,
  };
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
function normalizePost(data: any, original: Partial<Post>): Post {
  const processed =
    data.processedImageUrl ||
    data.processed_image_url ||
    data.processedImage ||
    data.processed_image ||
    original.processedImage;
  return {
    id: data.id || data._id || Date.now().toString(),
    template: data.template || original.template || 'auto',
    photo: data.photo ?? original.photo,
    description: data.description || original.description || '',
    caption: data.caption || original.caption || '',
    processedImage: processed,
    photoUrl: data.photoUrl ?? data.photo_url ?? original.photoUrl,
    processedImageUrl: data.processedImageUrl ?? data.processed_image_url ?? original.processedImageUrl,
    platforms: data.platforms || original.platforms || [],
    status: (data.status || original.status || 'draft') as PostStatus,
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
    publishedAt: data.publishedAt || data.published_at || original.publishedAt,
    scheduledAt: data.scheduledAt || data.scheduled_at || original.scheduledAt,
    campaignId: data.campaignId || data.campaign_id || original.campaignId,
  };
}
