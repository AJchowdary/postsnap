import { z } from 'zod';

// ─── Domain Types ───────────────────────────────────────────────────────────

export type BusinessType = 'restaurant' | 'salon_tattoo';
export type BrandStyle = 'clean' | 'bold' | 'minimal';
export type Platform = 'instagram' | 'facebook';
export type SocialStatus = 'connected' | 'disconnected' | 'expired' | 'revoked';
export type SubscriptionStatus =
  | 'trial_active'
  | 'trial_expired'
  | 'active_subscription'
  | 'canceled'
  | 'grace_period'
  | 'past_due';
export type PostStatus =
  | 'draft'
  | 'generating'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'partial_failed'
  | 'failed';

// ─── Database Row Types ──────────────────────────────────────────────────────

export interface Account {
  id: string;
  owner_user_id: string;
  business_type: BusinessType;
  created_at: string;
}

export interface BusinessProfile {
  account_id: string;
  name: string;
  city: string;
  logo_url: string | null;
  brand_color: string | null;
  brand_style: BrandStyle;
  overlay_default_on: boolean;
  updated_at: string;
}

export interface SocialConnection {
  id: string;
  account_id: string;
  platform: Platform;
  handle_or_page: string | null;
  status: SocialStatus;
  created_at: string;
}

export interface Subscription {
  account_id: string;
  status: SubscriptionStatus;
  trial_type: 'time' | 'post_count';
  trial_end_at: string | null;
  trial_posts_limit: number | null;
  trial_posts_used: number;
  provider: string;
  current_period_end: string | null;
  updated_at: string;
}

export interface Template {
  id: string;
  business_type: BusinessType | 'all';
  title: string;
  description: string;
  default_overlay_text: string | null;
  created_at: string;
}

export interface CaptionData {
  instagram: { caption: string; hashtags: string[] };
  facebook: { caption: string; hashtags: string[] };
}

export interface Post {
  id: string;
  account_id: string;
  status: PostStatus;
  template_id: string;
  context_text: string;
  original_image_path: string | null;
  processed_image_path: string | null;
  caption_json: CaptionData | Record<string, never>;
  publish_targets: Platform[];
  created_at: string;
  updated_at: string;
}

export interface PostPublishResult {
  id: string;
  post_id: string;
  platform: Platform;
  platform_post_id: string | null;
  status: 'success' | 'failed';
  error_message: string | null;
  published_at: string | null;
}

// ─── API Request/Response Types ──────────────────────────────────────────────

export interface BootstrapInput {
  businessType: BusinessType;
  businessName: string;
  city?: string;
}

export interface SessionPayload {
  account: Account;
  profile: BusinessProfile;
  subscription: Subscription & { days_left?: number; effective_status: SubscriptionStatus };
  socialConnections: SocialConnection[];
}

export interface CreatePostInput {
  templateId: string;
  contextText: string;
}

export interface CreatePostResponse {
  post: Post;
  uploadUrl: string;
  uploadPath: string;
}

export interface PublishInput {
  targets: Platform[];
}

export interface PublishResponse {
  post: Post;
  results: PostPublishResult[];
  summary: {
    success: Platform[];
    failed: Platform[];
    status: PostStatus;
  };
}

export interface EntitlementError {
  upgrade_required: true;
  reason: 'trial_ended' | 'subscription_inactive' | 'no_remaining_posts';
  status: SubscriptionStatus;
  trial_end_at: string | null;
  days_left: number;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

// ─── API Client Method Signatures ───────────────────────────────────────────

export interface ApiClient {
  bootstrap(input: BootstrapInput): Promise<SessionPayload>;
  getMe(): Promise<SessionPayload>;
  getTemplates(businessType: BusinessType): Promise<Template[]>;
  connectSocial(platform: Platform, handleOrPage?: string): Promise<SocialConnection>;
  disconnectSocial(platform: Platform): Promise<void>;
  createPost(input: CreatePostInput): Promise<CreatePostResponse>;
  markUploadComplete(postId: string, originalImagePath: string): Promise<Post>;
  generatePost(postId: string): Promise<{ queued: boolean; postId: string }>;
  publishPost(postId: string, input: PublishInput): Promise<PublishResponse>;
  listPosts(filter?: 'drafts' | 'published' | 'all'): Promise<Post[]>;
  getPost(postId: string): Promise<Post & { publishResults?: PostPublishResult[] }>;
  upgradeSubscription(): Promise<Subscription>;
  restoreSubscription(): Promise<Subscription>;
}
