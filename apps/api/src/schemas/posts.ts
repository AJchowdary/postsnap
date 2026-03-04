import { z } from 'zod';

export const CreatePostSchema = z.object({
  template_id: z.string().default('auto'),
  context_text: z.string().min(1, 'Description is required').max(500),
  platforms: z.array(z.enum(['instagram', 'facebook'])).default([]),
  // v1: scheduling disabled (no scheduled_at column)
  status: z.enum(['draft', 'published', 'failed']).default('draft'),
  post_id: z.string().uuid().optional(),
});
export type CreatePostBody = z.infer<typeof CreatePostSchema>;

export const UploadCompleteSchema = z.object({
  path: z.string().min(1),
});

export const GeneratePostSchema = z.object({
  premium_quality: z.boolean().optional().default(false),
});

export const PublishPostSchema = z.object({
  platforms: z.array(z.enum(['instagram', 'facebook'])).min(1),
});

export const CreatePostBodySchema = z.object({
  template: z.string().default('auto'),
  photo: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  caption: z.string().default(''),
  processedImage: z.string().optional().nullable(),
  platforms: z.array(z.enum(['instagram', 'facebook'])).default([]),
  // v1: scheduling disabled (no scheduled_at column)
  status: z.enum(['draft', 'published', 'failed']).default('draft'),
  postId: z.string().optional(),
});

export const GenerateCaptionSchema = z.object({
  description: z.string().min(1).max(500),
  template: z.string().default('auto'),
  businessName: z.string().default('My Business'),
  businessType: z.string().default('restaurant'),
  brandStyle: z.string().default('clean'),
});

export const GenerateImageSchema = z.object({
  photo: z.string().optional(),
  description: z.string().default(''),
  template: z.string().default('auto'),
  businessName: z.string().default('My Business'),
  businessType: z.string().default('restaurant'),
  brandStyle: z.string().default('clean'),
});

export type CreatePostInput = z.infer<typeof CreatePostBodySchema>;
export type PublishPostInput = z.infer<typeof PublishPostSchema>;
