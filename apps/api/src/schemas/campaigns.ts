import { z } from 'zod';

const ASPECT_RATIOS = ['square', 'feed', 'story', 'landscape'] as const;

/** Http(s) or data:image for optional product shots (URL scrape or manual picker). */
function optProductImageUrl() {
  return z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? null : v),
    z
      .union([
        z.null(),
        z
          .string()
          .max(12_000_000)
          .refine(
            (s) => /^https?:\/\//i.test(s) || /^data:image\//i.test(s),
            'Must be http(s) or data:image URL'
          ),
      ])
      .optional()
  );
}

const referenceImageUrlItem = z
  .string()
  .max(12_000_000)
  .refine(
    (s) => /^https?:\/\//i.test(s) || /^data:image\//i.test(s),
    'Each entry must be http(s) or data:image URL'
  );

export const CreateCampaignSchema = z.object({
  title: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(8000),
  product_url: z.string().url().max(2000).optional().nullable(),
  product_name: z.string().trim().max(500).optional().nullable(),
  product_description: z.string().trim().max(8000).optional().nullable(),
  product_image_url: optProductImageUrl(),
  reference_image_urls: z.array(referenceImageUrlItem).max(6).optional(),
  aspect_ratio: z.enum(ASPECT_RATIOS).optional(),
});

export const PatchCampaignSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  prompt: z.string().trim().min(1).max(8000).optional(),
  product_url: z.string().url().max(2000).optional().nullable(),
  product_name: z.string().trim().max(500).optional().nullable(),
  product_description: z.string().trim().max(8000).optional().nullable(),
  product_image_url: optProductImageUrl(),
  reference_image_urls: z.array(referenceImageUrlItem).max(6).nullable().optional(),
  aspect_ratio: z.enum(ASPECT_RATIOS).optional(),
});

export const CampaignSuggestIdeasSchema = z.object({
  hint: z.string().trim().max(200).optional().nullable(),
});

export const GenerateCampaignCreativeSchema = z.object({
  premium_quality: z.boolean().optional(),
  product_name: z.string().trim().max(500).optional().nullable(),
  product_description: z.string().max(8000).optional().nullable(),
  product_image_url: optProductImageUrl(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type PatchCampaignInput = z.infer<typeof PatchCampaignSchema>;
export type GenerateCampaignCreativeInput = z.infer<typeof GenerateCampaignCreativeSchema>;
export type CampaignSuggestIdeasInput = z.infer<typeof CampaignSuggestIdeasSchema>;
