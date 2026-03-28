export type BusinessType = 'restaurant' | 'salon' | 'retail' | 'gym' | 'cafe';
export type BrandVibe = 'professional' | 'bold' | 'warm';
export type BrandDnaSource = 'website' | 'manual' | 'hybrid';
export type BrandStyle = 'clean' | 'bold' | 'minimal';
export type ToneOfVoice = 'casual' | 'professional' | 'conversational' | 'inspiring' | 'bold';
export type PricePositioning = 'budget' | 'mid' | 'premium' | 'luxury';
export type VisualStyle = 'photo-real' | 'illustrated' | 'bold-graphic' | 'lifestyle';
export type StudioStyle =
  | 'clean-white'
  | 'lifestyle'
  | 'dark-dramatic'
  | 'flat-lay'
  | 'outdoor-natural';
export type PreferredCaptionLength = 'short' | 'medium' | 'long';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type Platform = 'instagram' | 'facebook';
export type SubscriptionStatus = 'trial' | 'subscribed' | 'expired';

export interface BusinessProfile {
  name: string;
  /** Internal AI tone bucket (templates, tone guide). */
  type: BusinessType;
  /** Shown in UI and passed to the model as the specific business label. */
  displayType: string;
  /** Extra nuance for AI (e.g. custom search, niche). */
  customDescription: string;
  city?: string;
  logo?: string;
  brandColor?: string;
  /** Brand DNA — AI personality for captions (distinct from legacy brandStyle chips). */
  brandVibe?: BrandVibe;
  dominantColors?: string[];
  websiteUrl?: string;
  websiteSummary?: string;
  toneExample?: string;
  instagramHandle?: string;
  facebookPage?: string;
  brandDnaSource?: BrandDnaSource;
  businessSubcategory?: string;
  neighborhood?: string;
  tagline?: string;
  toneOfVoice?: ToneOfVoice;
  contentPersona?: string;
  coreServices?: string[];
  heroProduct?: string;
  pricePositioning?: PricePositioning;
  uniqueDifferentiator?: string;
  visualStyle?: VisualStyle;
  photoStyleExamples?: string[];
  studioStylePreference?: StudioStyle;
  studioBgColor?: string;
  seasonalContext?: string;
  localEvents?: string[];
  lastPostTopics?: string[];
  topPerformingAngles?: string[];
  preferredCaptionLength?: PreferredCaptionLength;
  preferredPostingDays?: string[];
  photoStudioHistory?: Array<Record<string, unknown>>;
  confidenceOverall?: number;
  enrichmentVersion?: number;
  /** Flywheel: topics to deprioritize (from enrichment) */
  avoidedTopics?: string[];
  /** Per-field confidence 0–1 for LLM-enriched Brand Brain fields */
  brainFieldConfidence?: Record<string, number>;
  /** Total capture_signal events (server) */
  signalCount?: number;
  brandStyle: BrandStyle;
  useLogoOverlay: boolean;
}

export interface SocialAccount {
  platform: Platform;
  /** Display line (e.g. page name or @handle) */
  handle: string;
  /** True when token is valid and publishing is allowed */
  connected: boolean;
  /** Facebook Page name from Meta */
  pageName?: string | null;
  /** Instagram username (without @), from Meta */
  igUsername?: string | null;
  status?: string;
  reconnectRequired?: boolean;
}

export interface Subscription {
  status: SubscriptionStatus;
  daysLeft: number;
  postsLeft: number;
  planName: string;
  price: string;
}

/** Storage paths for platform-specific crops (server); signed URLs not stored. */
export type PostExportAssetsPayload = {
  instagram?: { '1_1'?: string; '4_5'?: string };
  facebook?: { '16_9'?: string; '1_1'?: string };
};

export interface Post {
  id: string;
  template: string;
  photo?: string;
  description: string;
  caption: string;
  processedImage?: string;
  exportAssets?: PostExportAssetsPayload;
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
  /** Longer hint under template (e.g. Auto) */
  helper?: string;
  /** Short line for template cards */
  description?: string;
  beforeAfter?: boolean;
}

export const TEMPLATES_BY_TYPE: Record<BusinessType, Template[]> = {
  restaurant: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.', description: 'Smart pick for your photo' },
    { id: 'today-special', label: "Today's Special", emoji: '🍽️', description: 'Highlight the dish of the day' },
    { id: 'new-item', label: 'New Item', emoji: '🆕', description: 'Introduce a new menu item' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '👨‍🍳', description: 'Kitchen, prep, or team' },
    { id: 'promo', label: 'Promo', emoji: '🎉', description: 'Offers and announcements' },
    { id: 'weekend-special', label: 'Weekend Special', emoji: '📅', description: 'Friday–Sunday deals' },
    { id: 'chef-pick', label: "Chef's Pick", emoji: '⭐', description: 'Staff favorite plate' },
    { id: 'happy-hour', label: 'Happy Hour', emoji: '🍹', description: 'Drink & snack specials' },
    { id: 'seasonal-menu', label: 'Seasonal Menu', emoji: '🍂', description: 'Seasonal ingredients' },
    { id: 'customer-review', label: 'Customer Review', emoji: '💬', description: 'Quote a happy guest' },
    { id: 'grand-opening', label: 'Grand Opening', emoji: '🎊', description: 'Launch or reopen buzz' },
    { id: 'limited-time', label: 'Limited Time', emoji: '⏳', description: 'Urgency for a short run' },
    { id: 'combo-deal', label: 'Combo Deal', emoji: '🍱', description: 'Bundle meals or drinks' },
    { id: 'catering-available', label: 'Catering', emoji: '📦', description: 'Events & large orders' },
    { id: 'family-meal', label: 'Family Meal', emoji: '👨‍👩‍👧', description: 'Shareable feasts' },
  ],
  salon: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.', description: 'Smart pick for your photo' },
    { id: 'before-after', label: 'Before & After', emoji: '💇', beforeAfter: true, description: 'Show the transformation' },
    { id: 'new-look', label: 'New Look', emoji: '💅', description: 'Fresh cut or color' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🪞', description: 'Salon life & tools' },
    { id: 'promo', label: 'Promo', emoji: '🎉', description: 'Offers and bookings' },
    { id: 'transformation', label: 'Transformation', emoji: '✂️', description: 'Dramatic style change' },
    { id: 'nail-art', label: 'Nail Art', emoji: '💎', description: 'Manicure highlights' },
    { id: 'hair-color', label: 'Hair Color', emoji: '🎨', description: 'Color & highlights' },
    { id: 'bridal-special', label: 'Bridal Special', emoji: '💐', description: 'Wedding-ready looks' },
    { id: 'mens-grooming', label: "Men's Grooming", emoji: '🧔', description: 'Cuts, beard, fades' },
    { id: 'kids-haircut', label: 'Kids Haircut', emoji: '👶', description: 'Family-friendly cuts' },
    { id: 'seasonal-look', label: 'Seasonal Look', emoji: '🌸', description: 'Trends for the season' },
    { id: 'product-highlight', label: 'Product Highlight', emoji: '🧴', description: 'Retail or care lines' },
    { id: 'team-spotlight', label: 'Team Spotlight', emoji: '👥', description: 'Introduce a stylist' },
    { id: 'book-now', label: 'Book Now', emoji: '📅', description: 'Fill your calendar' },
  ],
  retail: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.', description: 'Smart pick for your photo' },
    { id: 'new-arrival', label: 'New Arrival', emoji: '🛍️', description: 'Just landed in store' },
    { id: 'sale', label: 'Sale', emoji: '💸', description: 'Discounts & markdowns' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🏪', description: 'Stocking & team' },
    { id: 'promo', label: 'Promo', emoji: '🎉', description: 'Campaigns & codes' },
    { id: 'flash-sale', label: 'Flash Sale', emoji: '⚡', description: 'Short burst pricing' },
    { id: 'bundle-deal', label: 'Bundle Deal', emoji: '📦', description: 'Multi-buy savings' },
    { id: 'customer-pick', label: 'Customer Pick', emoji: '⭐', description: 'Top-rated product' },
    { id: 'clearance', label: 'Clearance', emoji: '🏷️', description: 'Last sizes & colors' },
    { id: 'back-in-stock', label: 'Back in Stock', emoji: '🔔', description: 'Fan favorites return' },
    { id: 'gift-idea', label: 'Gift Idea', emoji: '🎁', description: 'Holiday & gifting' },
    { id: 'trending-now', label: 'Trending Now', emoji: '🔥', description: "What's hot this week" },
    { id: 'limited-stock', label: 'Limited Stock', emoji: '⏳', description: 'Scarcity messaging' },
    { id: 'loyalty-reward', label: 'Loyalty Reward', emoji: '💳', description: 'Points & perks' },
    { id: 'store-event', label: 'Store Event', emoji: '🎪', description: 'Pop-up or in-store day' },
  ],
  gym: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.', description: 'Smart pick for your photo' },
    { id: 'transformation', label: 'Transformation', emoji: '💪', beforeAfter: true, description: 'Before & after fitness' },
    { id: 'new-class', label: 'New Class', emoji: '🏋️', description: 'Schedule & trainers' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🎯', description: 'Floor, equipment, team' },
    { id: 'promo', label: 'Promo', emoji: '🎉', description: 'Membership offers' },
    { id: 'member-spotlight', label: 'Member Spotlight', emoji: '🌟', description: 'Celebrate a member' },
    { id: 'workout-tip', label: 'Workout Tip', emoji: '📝', description: 'Form or routine tip' },
    { id: 'challenge', label: 'Challenge', emoji: '🏆', description: '30-day or team challenge' },
    { id: 'nutrition-tip', label: 'Nutrition Tip', emoji: '🥗', description: 'Fuel & recovery' },
    { id: 'equipment-highlight', label: 'Equipment', emoji: '⚙️', description: 'New machines or zones' },
    { id: 'trainer-feature', label: 'Trainer Feature', emoji: '🧑‍🏫', description: 'Coach intro or Q&A' },
    { id: 'open-house', label: 'Open House', emoji: '🚪', description: 'Tour or trial day' },
    { id: 'free-trial', label: 'Free Trial', emoji: '🎟️', description: 'Try before you join' },
    { id: 'results', label: 'Results', emoji: '📈', description: 'Progress & wins' },
    { id: 'motivation', label: 'Motivation', emoji: '🔥', description: 'Quote or mindset' },
  ],
  cafe: [
    { id: 'auto', label: 'Auto', emoji: '✨', helper: 'Auto picks the best style for this photo.', description: 'Smart pick for your photo' },
    { id: 'today-special', label: "Today's Special", emoji: '☕', description: 'Drink or food of the day' },
    { id: 'new-item', label: 'New Item', emoji: '🥐', description: 'New pastry or blend' },
    { id: 'behind-scenes', label: 'Behind the Scenes', emoji: '🫖', description: 'Bar & beans' },
    { id: 'promo', label: 'Promo', emoji: '🎉', description: 'Deals & loyalty' },
    { id: 'morning-brew', label: 'Morning Brew', emoji: '🌅', description: 'Breakfast crowd' },
    { id: 'seasonal-drink', label: 'Seasonal Drink', emoji: '🍁', description: 'Limited latte or tea' },
    { id: 'pastry-pick', label: 'Pastry Pick', emoji: '🧁', description: 'Baked goods spotlight' },
    { id: 'loyalty-card', label: 'Loyalty Card', emoji: '💳', description: 'Stamps & rewards' },
    { id: 'barista-feature', label: 'Barista Feature', emoji: '👩‍🍳', description: 'Meet the team' },
    { id: 'cozy-corner', label: 'Cozy Corner', emoji: '🛋️', description: 'Ambiance & seating' },
    { id: 'live-music', label: 'Live Music', emoji: '🎵', description: 'Events & nights' },
    { id: 'study-spot', label: 'Study Spot', emoji: '📚', description: 'Wi‑Fi & quiet hours' },
    { id: 'weekend-brunch', label: 'Weekend Brunch', emoji: '🥞', description: 'Saturday & Sunday menu' },
    { id: 'happy-hour', label: 'Happy Hour', emoji: '🍹', description: 'Afternoon specials' },
  ],
};

export const POST_IDEAS: Record<BusinessType, { title: string; emoji: string; template: string; description: string }[]> = {
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
