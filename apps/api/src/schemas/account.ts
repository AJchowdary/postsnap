import { z } from 'zod';

export const BusinessProfileSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  type: z.enum(['restaurant', 'salon', 'retail', 'gym', 'cafe']),
  city: z.string().optional(),
  logo: z.string().optional().nullable(),
  brandColor: z.string().optional(),
  brandStyle: z.enum(['clean', 'bold', 'minimal']).default('clean'),
  useLogoOverlay: z.boolean().default(false),
});

export const ConnectSocialSchema = z.object({
  platform: z.enum(['instagram', 'facebook']),
  handle: z.string().min(1, 'Handle is required'),
});

export type BusinessProfileInput = z.infer<typeof BusinessProfileSchema>;
export type ConnectSocialInput = z.infer<typeof ConnectSocialSchema>;
