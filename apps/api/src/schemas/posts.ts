import { z } from 'zod';

const MAX_IMAGE_BASE64_CHARS = 15_000_000; // ~10MB binary as base64
const IG_CAPTION_MAX = 2200;

/** Strips HTML-like tags for safer captions (server-side). */
function stripHtmlLike(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
}

export const CreatePostBodySchema = z.object({
  template: z.string().default('auto'),
  photo: z
    .string()
    .optional()
    .nullable()
    .refine((s) => !s || s.length <= MAX_IMAGE_BASE64_CHARS, 'Image payload too large (max ~10MB)'),
  description: z.string().min(1, 'Description is required').max(500),
  caption: z
    .string()
    .max(IG_CAPTION_MAX)
    .transform((c) => stripHtmlLike(c))
    .default(''),
  processedImage: z
    .string()
    .optional()
    .nullable()
    .refine((s) => !s || s.length <= MAX_IMAGE_BASE64_CHARS, 'Processed image too large'),
  platforms: z.array(z.enum(['instagram', 'facebook'])).default([]),
  status: z.enum(['draft', 'published', 'failed', 'scheduled']).default('draft'),
  postId: z.string().optional(),
});

export const UploadCompleteSchema = z.object({
  path: z.string().min(1),
});

export const GeneratePostSchema = z.object({
  premium_quality: z.boolean().optional().default(false),
});

export const PublishPostSchema = z.object({
  platforms: z.array(z.enum(['instagram', 'facebook'])).min(1),
});

export const GenerateCaptionSchema = z.object({
  description: z.string().min(1).max(500).transform((s) => stripHtmlLike(s)),
  template: z.string().default('auto'),
  businessName: z.string().max(120).default('My Business'),
  businessType: z.string().max(64).default('restaurant'),
  brandStyle: z.string().max(32).default('clean'),
});

export const GenerateImageSchema = z.object({
  photo: z
    .string()
    .optional()
    .refine((s) => !s || s.length <= MAX_IMAGE_BASE64_CHARS, 'Image payload too large (max ~10MB)'),
  description: z.string().max(500).default('').transform((s) => stripHtmlLike(s)),
  template: z.string().default('auto'),
  businessName: z.string().max(120).default('My Business'),
  businessType: z.string().max(64).default('restaurant'),
  brandStyle: z.string().max(32).default('clean'),
});

export type CreatePostInput = z.infer<typeof CreatePostBodySchema>;
export type PublishPostInput = z.infer<typeof PublishPostSchema>;

/** @deprecated use CreatePostInput */
export type CreatePostBody = CreatePostInput;
