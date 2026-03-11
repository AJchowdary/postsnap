export interface CaptionParams {
  description: string;
  template: string;
  businessName: string;
  businessType: string;
  brandStyle: string;
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
}

export interface IAIProvider {
  generateCaption(params: CaptionParams): Promise<CaptionResult>;
  processImage(params: ImageParams): Promise<string | null>;
}
