export type BusinessType = 'restaurant' | 'salon' | 'retail' | 'gym' | 'cafe';
export type BrandStyle = 'clean' | 'bold' | 'minimal';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type Platform = 'instagram' | 'facebook';
export type SubscriptionStatus = 'trial' | 'subscribed' | 'expired';

export interface BusinessProfile {
  name: string;
  type: BusinessType;
  city?: string;
  logo?: string;
  brandColor?: string;
  brandStyle: BrandStyle;
  useLogoOverlay: boolean;
}

export interface SocialAccount {
  platform: Platform;
  handle: string;
  connected: boolean;
}

export interface Subscription {
  status: SubscriptionStatus;
  daysLeft: number;
  postsLeft: number;
  planName: string;
  price: string;
}

export interface Post {
  id: string;
  template: string;
  photo?: string;
  description: string;
  caption: string;
  processedImage?: string;
  platforms: Platform[];
  status: PostStatus;
  createdAt: string;
  publishedAt?: string;
  scheduledAt?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface Template {
  id: string;
  label: string;
  emoji: string;
  helper?: string;
  beforeAfter?: boolean;
}

export const TEMPLATES_BY_TYPE: Record<BusinessType, Template[]> = {
  restaurant: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.' },
    { id: 'today-special', label: "Today's Special", emoji: '🍽️' },
    { id: 'new-item', label: 'New Item', emoji: '🆕' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '👨‍🍳' },
    { id: 'promo', label: 'Promo', emoji: '🎉' },
  ],
  salon: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.' },
    { id: 'before-after', label: 'Before & After', emoji: '💇', beforeAfter: true },
    { id: 'new-look', label: 'New Look', emoji: '💅' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🪞' },
    { id: 'promo', label: 'Promo', emoji: '🎉' },
  ],
  retail: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.' },
    { id: 'new-arrival', label: 'New Arrival', emoji: '🛍️' },
    { id: 'sale', label: 'Sale', emoji: '💸' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🏪' },
    { id: 'promo', label: 'Promo', emoji: '🎉' },
  ],
  gym: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.' },
    { id: 'transformation', label: 'Transformation', emoji: '💪', beforeAfter: true },
    { id: 'new-class', label: 'New Class', emoji: '🏋️' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🎯' },
    { id: 'promo', label: 'Promo', emoji: '🎉' },
  ],
  cafe: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.' },
    { id: 'today-special', label: "Today's Special", emoji: '☕' },
    { id: 'new-item', label: 'New Item', emoji: '🥐' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🫖' },
    { id: 'promo', label: 'Promo', emoji: '🎉' },
  ],
};

export const POST_IDEAS: Record<BusinessType, Array<{ title: string; emoji: string; template: string; description: string }>> = {
  restaurant: [
    { title: "Today's Special", emoji: '🍽️', template: 'today-special', description: "What's the chef's special today?" },
    { title: 'Behind the Scenes', emoji: '👨‍🍳', template: 'behind-scenes', description: 'Show your kitchen or team at work' },
    { title: 'Weekend Promo', emoji: '🎉', template: 'promo', description: 'Any weekend offers or events?' },
  ],
  salon: [
    { title: 'Before & After', emoji: '💇', template: 'before-after', description: 'Show a stunning transformation' },
    { title: 'New Look', emoji: '💅', template: 'new-look', description: "Share a client's fresh style" },
    { title: 'Book a Session', emoji: '📅', template: 'promo', description: 'Promote available appointment slots' },
  ],
  retail: [
    { title: 'New Arrival', emoji: '🛍️', template: 'new-arrival', description: "What's new in your store?" },
    { title: 'Weekend Sale', emoji: '💸', template: 'sale', description: 'Any discounts or special offers?' },
    { title: 'Staff Pick', emoji: '⭐', template: 'behind-scenes', description: "Team's favourite product this week" },
  ],
  gym: [
    { title: 'Transformation', emoji: '💪', template: 'transformation', description: 'Show a member transformation' },
    { title: 'New Class', emoji: '🏋️', template: 'new-class', description: 'Announce a new class or schedule' },
    { title: 'Motivation Monday', emoji: '🔥', template: 'promo', description: 'Share weekly motivation' },
  ],
  cafe: [
    { title: "Today's Special", emoji: '☕', template: 'today-special', description: "What's on the menu today?" },
    { title: 'New Drink', emoji: '🥤', template: 'new-item', description: 'Introduce a new beverage or food item' },
    { title: 'Cozy Corner', emoji: '🫖', template: 'behind-scenes', description: 'Show your cafe atmosphere' },
  ],
};
