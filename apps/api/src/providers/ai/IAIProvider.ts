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
}

export type CaptionResult = {
  instagram: { caption: string; hashtags: string[] };
  facebook: { caption: string; hashtags: string[] };
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
}

/** Result of My Photo pipeline: enhanced + optional in-image text, and clean enhanced only. */
export type ProcessImageResult = {
  withOverlay: string | null;
  clean: string | null;
};

export interface IAIProvider {
  generateCaption(params: CaptionParams): Promise<CaptionResult>;
  processImage(params: ImageParams): Promise<ProcessImageResult | null>;
}
