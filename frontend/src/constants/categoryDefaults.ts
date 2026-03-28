/**
 * Single source of truth for category → Brand Brain defaults (no-website onboarding + backfill).
 * Default confidence for applied brain fields: 0.55 (`brainFieldConfidence` + `confidenceOverall`).
 */
import type {
  BrandVibe,
  BusinessType,
  BusinessProfile,
  PricePositioning,
  PreferredCaptionLength,
  StudioStyle,
  ToneOfVoice,
  VisualStyle,
} from '../types';

export const DEFAULT_CATEGORY_CONFIDENCE = 0.55;

export type CategoryBrandDefaults = Partial<
  Pick<
    BusinessProfile,
    | 'toneOfVoice'
    | 'contentPersona'
    | 'pricePositioning'
    | 'coreServices'
    | 'visualStyle'
    | 'studioStylePreference'
    | 'preferredCaptionLength'
    | 'brandVibe'
  >
>;

const DISPLAY_LABEL: Record<BusinessType, string> = {
  restaurant: 'Restaurant',
  salon: 'Salon & Beauty',
  retail: 'Retail Store',
  gym: 'Gym & Fitness',
  cafe: 'Cafe & Coffee Shop',
};

export function defaultDisplayForBusinessType(t: BusinessType): string {
  return DISPLAY_LABEL[t];
}

const DEFAULTS: Record<BusinessType, CategoryBrandDefaults> = {
  restaurant: {
    toneOfVoice: 'conversational',
    brandVibe: 'warm',
    contentPersona: 'Local food lover sharing plates, specials, and community moments.',
    pricePositioning: 'mid',
    coreServices: ['Dine-in', 'Takeout', 'Seasonal menu'],
    visualStyle: 'lifestyle',
    studioStylePreference: 'lifestyle',
    preferredCaptionLength: 'medium',
  },
  salon: {
    toneOfVoice: 'inspiring',
    brandVibe: 'professional',
    contentPersona: 'Beauty expert showcasing transformations, care tips, and booking CTAs.',
    pricePositioning: 'mid',
    coreServices: ['Cuts & color', 'Styling', 'Consultations'],
    visualStyle: 'photo-real',
    studioStylePreference: 'clean-white',
    preferredCaptionLength: 'medium',
  },
  retail: {
    toneOfVoice: 'professional',
    brandVibe: 'bold',
    contentPersona: 'Shop curator highlighting new drops, deals, and reasons to visit.',
    pricePositioning: 'mid',
    coreServices: ['In-store shopping', 'New arrivals', 'Gift ideas'],
    visualStyle: 'lifestyle',
    studioStylePreference: 'flat-lay',
    preferredCaptionLength: 'medium',
  },
  gym: {
    toneOfVoice: 'bold',
    brandVibe: 'bold',
    contentPersona: 'Coach celebrating member wins, classes, and motivation with clear CTAs.',
    pricePositioning: 'mid',
    coreServices: ['Group classes', 'Personal training', 'Membership'],
    visualStyle: 'bold-graphic',
    studioStylePreference: 'dark-dramatic',
    preferredCaptionLength: 'short',
  },
  cafe: {
    toneOfVoice: 'casual',
    brandVibe: 'warm',
    contentPersona: 'Neighborhood barista sharing drinks, pastries, and cozy café moments.',
    pricePositioning: 'mid',
    coreServices: ['Coffee & espresso', 'Pastries', 'Grab & go'],
    visualStyle: 'lifestyle',
    studioStylePreference: 'outdoor-natural',
    preferredCaptionLength: 'medium',
  },
};

export function getDefaultsForCategory(category: BusinessType): CategoryBrandDefaults {
  return { ...DEFAULTS[category] };
}

/** Use when merging server data: fill defaults only if missing or confidence &lt; 0.4. */
export function shouldApplyDefaultForField(
  field: string,
  value: unknown,
  brainFieldConfidence: Record<string, number> | undefined
): boolean {
  const conf = brainFieldConfidence?.[field];
  if (conf !== undefined && conf >= 0.4) return false;
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return conf !== undefined && conf < 0.4;
}

export type ManualOnboardingInput = {
  name: string;
  type: BusinessType;
  displayType: string;
  customDescription: string;
  city?: string;
  brandColor: string;
  brandVibe: BrandVibe;
  dominantColors: string[];
};

/** No-website manual path: full Brand Brain defaults from `getDefaultsForCategory` + uniform 0.55 confidence. */
export function buildManualOnboardingProfilePayload(input: ManualOnboardingInput) {
  const d = getDefaultsForCategory(input.type);
  const brainFieldConfidence: Record<string, number> = {
    toneOfVoice: DEFAULT_CATEGORY_CONFIDENCE,
    contentPersona: DEFAULT_CATEGORY_CONFIDENCE,
    pricePositioning: DEFAULT_CATEGORY_CONFIDENCE,
    coreServices: DEFAULT_CATEGORY_CONFIDENCE,
    visualStyle: DEFAULT_CATEGORY_CONFIDENCE,
    studioStylePreference: DEFAULT_CATEGORY_CONFIDENCE,
    preferredCaptionLength: DEFAULT_CATEGORY_CONFIDENCE,
    brandVibe: DEFAULT_CATEGORY_CONFIDENCE,
  };

  return {
    name: input.name,
    type: input.type,
    displayType: input.displayType,
    customDescription: input.customDescription,
    city: input.city,
    brandColor: input.brandColor,
    brandVibe: input.brandVibe,
    dominantColors: input.dominantColors,
    brandDnaSource: 'manual' as const,
    brandStyle: 'clean' as const,
    useLogoOverlay: false,
    toneOfVoice: d.toneOfVoice as ToneOfVoice | undefined,
    contentPersona: d.contentPersona,
    pricePositioning: d.pricePositioning as PricePositioning | undefined,
    coreServices: d.coreServices,
    visualStyle: d.visualStyle as VisualStyle | undefined,
    studioStylePreference: d.studioStylePreference as StudioStyle | undefined,
    preferredCaptionLength: (d.preferredCaptionLength ?? 'medium') as PreferredCaptionLength,
    confidenceOverall: DEFAULT_CATEGORY_CONFIDENCE,
    enrichmentVersion: 2,
    brainFieldConfidence,
  };
}
