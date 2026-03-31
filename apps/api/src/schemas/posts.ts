import { z } from 'zod';

const MAX_IMAGE_BASE64_CHARS = 15_000_000; // ~10MB binary as base64
const IG_CAPTION_MAX = 2200;

/** Strips HTML-like tags for safer captions (server-side). */
function stripHtmlLike(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
}

/** Mobile/web clients often send `null` or "" for absent optional fields. */
function optStr(max: number) {
  return z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.string().max(max).optional()
  );
}

function optBrandVibe() {
  return z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.enum(['professional', 'bold', 'warm']).optional()
  );
}

function optStudioStyle() {
  return z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z
      .enum(['clean-white', 'lifestyle', 'dark-dramatic', 'flat-lay', 'outdoor-natural'])
      .optional()
  );
}

/** Image route: preset enum or free-text studio direction. */
function optStudioStyleOrText() {
  return z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z
      .union([
        z.enum(['clean-white', 'lifestyle', 'dark-dramatic', 'flat-lay', 'outdoor-natural']),
        z.string().max(500),
      ])
      .optional()
  );
}

function optDominantColors() {
  return z.preprocess((v) => {
    if (v === null || v === undefined) return undefined;
    if (!Array.isArray(v)) return undefined;
    const out = v
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => s.slice(0, 16));
    return out.length ? out : undefined;
  }, z.array(z.string().max(16)).max(12).optional());
}

function optCoreServices() {
  return z.preprocess((v) => {
    if (v === null || v === undefined) return undefined;
    if (!Array.isArray(v)) return undefined;
    const out = v
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => s.slice(0, 120));
    return out.length ? out : undefined;
  }, z.array(z.string().max(120)).max(20).optional());
}

/** `null` from JSON clients must become `undefined` so `.default()` applies. */
function reqStrWithDefault(max: number, def: string) {
  return z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.string().max(max).default(def)
  );
}

const CreatePostBodyBaseSchema = z.object({
  template: reqStrWithDefault(64, 'auto'),
  photo: z
    .string()
    .optional()
    .nullable()
    .refine((s) => !s || s.length <= MAX_IMAGE_BASE64_CHARS, 'Image payload too large (max ~10MB)'),
  description: z.preprocess(
    (v) => (v === null || v === undefined ? '' : v),
    z.string().min(1, 'Description is required').max(500)
  ),
  caption: z.preprocess(
    (v) => (v === null || v === undefined ? '' : v),
    z
      .string()
      .max(IG_CAPTION_MAX)
      .transform((c) => stripHtmlLike(c))
      .default('')
  ),
  processedImage: z
    .string()
    .optional()
    .nullable()
    .refine((s) => !s || s.length <= MAX_IMAGE_BASE64_CHARS, 'Processed image too large'),
  platforms: z.preprocess(
    (v) => (v === null || v === undefined ? undefined : v),
    z.array(z.enum(['instagram', 'facebook'])).default([])
  ),
  status: z.preprocess(
    (v) => (v === null || v === undefined ? undefined : v),
    z.enum(['draft', 'published', 'failed', 'scheduled']).default('draft')
  ),
  postId: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.string().optional()
  ),
  scheduledAt: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.string().max(64).optional()
  ),
});

export const CreatePostBodySchema = CreatePostBodyBaseSchema.superRefine((data, ctx) => {
  if (data.status === 'scheduled') {
    const raw = data.scheduledAt?.trim();
    if (!raw) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledAt'],
        message: 'scheduledAt is required when status is scheduled',
      });
      return;
    }
    const t = Date.parse(raw);
    if (Number.isNaN(t)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledAt'],
        message: 'Invalid scheduled time',
      });
      return;
    }
    if (t <= Date.now() - 120_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledAt'],
        message: 'Schedule time must be in the future',
      });
    }
  } else if (data.scheduledAt != null && String(data.scheduledAt).trim() !== '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scheduledAt'],
      message: 'scheduledAt is only allowed when status is scheduled',
    });
  }
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
  description: z.preprocess(
    (v) => (v === null || v === undefined ? '' : v),
    z.string().min(1).max(500).transform((s) => stripHtmlLike(s))
  ),
  template: reqStrWithDefault(80, 'auto'),
  businessName: reqStrWithDefault(120, 'My Business'),
  businessType: reqStrWithDefault(64, 'restaurant'),
  brandStyle: reqStrWithDefault(32, 'clean'),
  /** Optional — e.g. Instagram, Facebook */
  platform: optStr(80),
  displayType: optStr(120),
  aiCategory: optStr(32),
  customDescription: optStr(500),
  brandColor: optStr(32),
  brandVibe: optBrandVibe(),
  dominantColors: optDominantColors(),
  websiteSummary: optStr(2000),
  city: optStr(120),
  instagramHandle: optStr(120),
  studioStylePreference: optStudioStyle(),
  toneOfVoice: optStr(80),
  contentPersona: optStr(200),
  uniqueDifferentiator: optStr(300),
  visualStyle: optStr(80),
  studioBgColor: optStr(32),
  coreServices: optCoreServices(),
  heroProduct: optStr(120),
  neighborhood: optStr(120),
});

export const GenerateImageSchema = z.object({
  photo: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z
      .string()
      .optional()
      .refine((s) => !s || s.length <= MAX_IMAGE_BASE64_CHARS, 'Image payload too large (max ~10MB)')
  ),
  description: z.preprocess(
    (v) => (v === null || v === undefined ? '' : v),
    z.string().max(500).transform((s) => stripHtmlLike(s))
  ),
  template: reqStrWithDefault(80, 'auto'),
  businessName: reqStrWithDefault(120, 'My Business'),
  businessType: reqStrWithDefault(64, 'restaurant'),
  brandStyle: reqStrWithDefault(32, 'clean'),
  displayType: optStr(120),
  aiCategory: optStr(32),
  customDescription: optStr(500),
  brandColor: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.string().max(32).optional()
  ),
  brandVibe: optBrandVibe(),
  websiteSummary: optStr(2000),
  dominantColors: optDominantColors(),
  city: optStr(120),
  instagramHandle: optStr(120),
  studioStylePreference: optStudioStyleOrText(),
  toneOfVoice: optStr(80),
  contentPersona: optStr(200),
  uniqueDifferentiator: optStr(300),
  visualStyle: optStr(80),
  studioBgColor: optStr(32),
  aspectPreset: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.enum(['square', 'feed', 'story', 'landscape']).optional()
  ),
});

export type CreatePostInput = z.infer<typeof CreatePostBodySchema>;
export type PublishPostInput = z.infer<typeof PublishPostSchema>;

/** @deprecated use CreatePostInput */
export type CreatePostBody = CreatePostInput;
