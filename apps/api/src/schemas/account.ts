import { z } from 'zod';

export const BusinessProfileSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  type: z.enum(['restaurant', 'salon', 'retail', 'gym', 'cafe']),
  displayType: z.string().max(120).optional(),
  customDescription: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  logo: z.string().optional().nullable(),
  brandColor: z.string().max(32).optional(),
  brandVibe: z.enum(['professional', 'bold', 'warm']).optional(),
  dominantColors: z.array(z.string().max(16)).max(12).optional(),
  websiteUrl: z.string().max(2048).optional(),
  websiteSummary: z.string().max(2000).optional(),
  toneExample: z.string().max(500).optional(),
  instagramHandle: z.string().max(120).optional(),
  facebookPage: z.string().max(500).optional(),
  brandDnaSource: z.enum(['website', 'manual', 'hybrid']).optional(),
  businessSubcategory: z.string().max(120).optional(),
  neighborhood: z.string().max(120).optional(),
  tagline: z.string().max(200).optional(),
  toneOfVoice: z.enum(['casual', 'professional', 'conversational', 'inspiring', 'bold']).optional(),
  contentPersona: z.string().max(200).optional(),
  coreServices: z.array(z.string().max(120)).max(20).optional(),
  heroProduct: z.string().max(120).optional(),
  pricePositioning: z.enum(['budget', 'mid', 'premium', 'luxury']).optional(),
  uniqueDifferentiator: z.string().max(300).optional(),
  visualStyle: z.enum(['photo-real', 'illustrated', 'bold-graphic', 'lifestyle']).optional(),
  photoStyleExamples: z.array(z.string().max(2048)).max(20).optional(),
  studioStylePreference: z
    .enum(['clean-white', 'lifestyle', 'dark-dramatic', 'flat-lay', 'outdoor-natural'])
    .optional(),
  studioBgColor: z.string().max(32).optional(),
  seasonalContext: z.string().max(300).optional(),
  localEvents: z.array(z.string().max(180)).max(20).optional(),
  lastPostTopics: z.array(z.string().max(120)).max(20).optional(),
  topPerformingAngles: z.array(z.string().max(120)).max(20).optional(),
  preferredCaptionLength: z.enum(['short', 'medium', 'long']).optional(),
  preferredPostingDays: z.array(z.string().max(20)).max(7).optional(),
  photoStudioHistory: z.array(z.record(z.any())).max(100).optional(),
  confidenceOverall: z.number().min(0).max(1).optional(),
  brainFieldConfidence: z.record(z.number().min(0).max(1)).optional(),
  enrichmentVersion: z.number().int().min(1).optional(),
  brandStyle: z.enum(['clean', 'bold', 'minimal']).default('clean'),
  useLogoOverlay: z.boolean().default(false),
});

export const ScanWebsiteSchema = z.object({
  websiteUrl: z.string().min(1).max(2048),
});

/**
 * POST /account/bootstrap — handler uses auth only; body must be empty JSON.
 * Omitted or null body is treated as {}. Unknown keys are rejected (.strict).
 */
export const BootstrapAccountSchema = z.preprocess(
  (data: unknown) => (data === undefined || data === null ? {} : data),
  z.object({}).strict()
);

export const CaptureSignalSchema = z.object({
  signalType: z.enum([
    'publish',
    'regenerate',
    'edit_caption',
    'studio_style_selected',
    'variant_selected',
    'thumbs_up',
    'thumbs_down',
    'save_without_publish',
    'topic_skip',
  ]),
  topic: z.string().max(120).optional(),
  angle: z.string().max(80).optional(),
  studioStyle: z
    .enum(['clean-white', 'lifestyle', 'dark-dramatic', 'flat-lay', 'outdoor-natural'])
    .optional(),
  /** Structured payloads: postId, platform, qualityScore, originalCaption, editedCaption, editDelta, shownTopics, selectedTopic, context, reason, previousAngle, etc. */
  metadata: z.record(z.any()).optional(),
});

export const ConnectSocialSchema = z.object({
  platform: z.enum(['instagram', 'facebook']),
  handle: z.string().min(1, 'Handle is required'),
});

export type BootstrapAccountInput = z.infer<typeof BootstrapAccountSchema>;
export type BusinessProfileInput = z.infer<typeof BusinessProfileSchema>;
export type ConnectSocialInput = z.infer<typeof ConnectSocialSchema>;
export type CaptureSignalInput = z.infer<typeof CaptureSignalSchema>;
