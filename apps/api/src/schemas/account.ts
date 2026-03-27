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
  brandStyle: z.enum(['clean', 'bold', 'minimal']).default('clean'),
  useLogoOverlay: z.boolean().default(false),
});

export const ScanWebsiteSchema = z.object({
  websiteUrl: z.string().min(1).max(2048),
});

export const ConnectSocialSchema = z.object({
  platform: z.enum(['instagram', 'facebook']),
  handle: z.string().min(1, 'Handle is required'),
});

export type BusinessProfileInput = z.infer<typeof BusinessProfileSchema>;
export type ConnectSocialInput = z.infer<typeof ConnectSocialSchema>;
