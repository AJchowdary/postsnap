import type { ImageAspectPreset } from './imageAspectPreset';
import type { BrandDNAProfile } from '../../prompts/quickpostAI';

export interface CaptionParams {
  description: string;
  template: string;
  businessName: string;
  businessType: string;
  brandStyle: string;
  /** e.g. Instagram, Facebook, or combined — used in caption prompt */
  platform?: string;
  /** User-facing business label */
  displayType?: string;
  /** Tone bucket (same idea as businessType when not customized) */
  aiCategory?: string;
  /** Extra nuance for the model */
  customDescription?: string;
  brandColor?: string;
  brandVibe?: string;
  dominantColors?: string[];
  websiteSummary?: string;
  city?: string;
  instagramHandle?: string;
  studioStylePreference?: string;
  /** Brand Brain — folded into brief + legacy caption prompts */
  toneOfVoice?: string;
  contentPersona?: string;
  uniqueDifferentiator?: string;
  visualStyle?: string;
  studioBgColor?: string;
  /** Palette (dominant / secondary); complements brandColor */
  brandColors?: string[];
  /** Brand Brain — generic caption detector */
  coreServices?: string[];
  heroProduct?: string;
  /** Optional audit logging for generic detection */
  detectionContext?: { accountId?: string; postId?: string; source?: 'api' | 'worker' };
  neighborhood?: string;
  /** Server-enriched Brand DNA block for prompts (optional). */
  brandProfile?: BrandDNAProfile;
}

export type CaptionResult = {
  instagram: { caption: string; hashtags: string[] };
  facebook: { caption: string; hashtags: string[] };
  meta?: {
    attempts: number;
    strategy: 'brief-primary' | 'brief-retry' | 'legacy-fallback';
    reason?: string;
    qualityScore?: number;
    qualityDimensions?: {
      localSpecificity: number;
      businessSpecificity: number;
      voiceMatch: number;
      engagementHook: number;
      nonGenericLanguage: number;
    };
    qualityVerdict?: 'deliver' | 'retry-partial' | 'retry-full';
    qualityRetryCount?: number;
  };
};

export interface ImageParams {
  photoBase64?: string;
  imagePath?: string;
  templateId: string;
  businessName: string;
  businessType: string;
  brandStyle: string;
  brandColor?: string | null;
  description: string;
  overlayText?: string | null;
  logoUrl?: string | null;
  premiumQuality?: boolean;
  displayType?: string;
  aiCategory?: string;
  customDescription?: string;
  brandVibe?: string;
  websiteSummary?: string;
  dominantColors?: string[];
  city?: string;
  instagramHandle?: string;
  /** Preset id (e.g. clean-white) or free-text studio direction (describe mode). */
  studioStylePreference?: string;
  toneOfVoice?: string;
  contentPersona?: string;
  uniqueDifferentiator?: string;
  visualStyle?: string;
  studioBgColor?: string;
  brandColors?: string[];
  /** Output aspect for generated / edited images */
  aspectPreset?: ImageAspectPreset;
  /** Optional; text-only image branch reuses caption brief pipeline. */
  brandProfile?: BrandDNAProfile;
}

/** Result of My Photo pipeline: enhanced + optional in-image text, and clean enhanced only. */
export type ProcessImageResult = {
  withOverlay: string | null;
  clean: string | null;
  variants?: string[];
};

export interface IAIProvider {
  generateCaption(params: CaptionParams): Promise<CaptionResult>;
  processImage(params: ImageParams): Promise<ProcessImageResult | null>;
}
