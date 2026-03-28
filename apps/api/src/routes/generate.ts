import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { validateImagePayload } from '../middleware/validateImagePayload';
import { GenerateCaptionSchema, GenerateImageSchema } from '../schemas/posts';
import { getAIProvider } from '../providers/ai';
import { asyncHandler } from '../utils/asyncHandler';
import { aiRateLimiter } from '../middleware/rateLimit';
import { sendSuccess } from '../utils/apiResponse';
import { requireAccountForUser } from '../services/accountService';
import { scoreCaption, scoringContextFromCaptionParams } from '../providers/ai/qualityScorer';

const router = Router();

router.use(authenticate);
router.use(aiRateLimiter);

router.post(
  '/caption',
  validate(GenerateCaptionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const accountId = await requireAccountForUser(req.userId!);
    const ai = getAIProvider();
    const result = await ai.generateCaption({
      description: req.body.description,
      template: req.body.template,
      businessName: req.body.businessName,
      businessType: req.body.businessType,
      brandStyle: req.body.brandStyle,
      platform: req.body.platform,
      displayType: req.body.displayType,
      aiCategory: req.body.aiCategory,
      customDescription: req.body.customDescription,
      brandColor: req.body.brandColor,
      brandVibe: req.body.brandVibe,
      dominantColors: req.body.dominantColors,
      websiteSummary: req.body.websiteSummary,
      city: req.body.city,
      instagramHandle: req.body.instagramHandle,
      studioStylePreference: req.body.studioStylePreference,
      toneOfVoice: req.body.toneOfVoice,
      contentPersona: req.body.contentPersona,
      uniqueDifferentiator: req.body.uniqueDifferentiator,
      visualStyle: req.body.visualStyle,
      studioBgColor: req.body.studioBgColor,
      brandColors: req.body.dominantColors,
      coreServices: req.body.coreServices,
      heroProduct: req.body.heroProduct,
      neighborhood: req.body.neighborhood,
      detectionContext: { accountId, source: 'api' },
    });
    const caption = result.instagram?.caption ?? result.facebook?.caption ?? '';
    const qs =
      result.meta?.qualityScore != null && result.meta.qualityDimensions
        ? {
            score: result.meta.qualityScore,
            dimensions: result.meta.qualityDimensions,
            verdict: result.meta.qualityVerdict ?? null,
            tags: [],
            rationale: `Total ${result.meta.qualityScore} — ${result.meta.qualityVerdict ?? 'n/a'}`,
          }
        : (() => {
            const s = scoreCaption(
              caption,
              scoringContextFromCaptionParams(
                {
                  city: req.body.city,
                  businessName: req.body.businessName,
                  coreServices: req.body.coreServices,
                  heroProduct: req.body.heroProduct,
                  brandVibe: req.body.brandVibe,
                  toneOfVoice: req.body.toneOfVoice,
                },
                req.body.neighborhood
              )
            );
            return {
              score: s.total,
              dimensions: s.dimensions,
              verdict: s.verdict,
              tags: [],
              rationale: `Total ${s.total} — ${s.verdict}`,
            };
          })();
    return sendSuccess(res, {
      caption,
      quality: qs,
      retry: result.meta
        ? {
            attempts: result.meta.attempts,
            strategy: result.meta.strategy,
            reason: result.meta.reason ?? null,
            qualityRetryCount: result.meta.qualityRetryCount ?? 0,
          }
        : null,
    });
  })
);

router.post(
  '/image',
  validate(GenerateImageSchema),
  validateImagePayload,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ai = getAIProvider();
    const processed = await ai.processImage({
      photoBase64: req.body.photo,
      templateId: req.body.template ?? 'auto',
      businessName: req.body.businessName,
      businessType: req.body.businessType,
      brandStyle: req.body.brandStyle,
      description: req.body.description ?? '',
      displayType: req.body.displayType,
      aiCategory: req.body.aiCategory,
      customDescription: req.body.customDescription,
      brandColor: req.body.brandColor ?? null,
      brandVibe: req.body.brandVibe,
      websiteSummary: req.body.websiteSummary,
      dominantColors: req.body.dominantColors,
      city: req.body.city,
      instagramHandle: req.body.instagramHandle,
      studioStylePreference: req.body.studioStylePreference,
      toneOfVoice: req.body.toneOfVoice,
      contentPersona: req.body.contentPersona,
      uniqueDifferentiator: req.body.uniqueDifferentiator,
      visualStyle: req.body.visualStyle,
      studioBgColor: req.body.studioBgColor,
      brandColors: req.body.dominantColors,
    });
    if (!processed) {
      return sendSuccess(res, {
        processed_image: null,
        processed_image_with_overlay: null,
        processed_image_clean: null,
        processed_image_variants: [],
      });
    }
    const primary = processed.withOverlay ?? processed.clean;
    return sendSuccess(res, {
      processed_image: primary,
      processed_image_with_overlay: processed.withOverlay,
      processed_image_clean: processed.clean,
      processed_image_variants: processed.variants ?? [],
    });
  })
);

export default router;
