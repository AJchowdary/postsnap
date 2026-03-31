import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { validateImagePayload } from '../middleware/validateImagePayload';
import { GenerateCaptionSchema, GenerateImageSchema } from '../schemas/posts';
import { EditCaptionSchema } from '../schemas/editCaption';
import { getAIProvider } from '../providers/ai';
import { requireAccountRecordForUser } from '../services/accountService';
import { runEditCaption } from '../services/editCaptionService';
import { asyncHandler } from '../utils/asyncHandler';
import { aiRateLimiter } from '../middleware/rateLimit';
import { sendSuccess } from '../utils/apiResponse';
import { scoreCaption, scoringContextFromCaptionParams } from '../providers/ai/qualityScorer';
import { formattedAccountToBrandDNA } from '../prompts/quickpostAI';
import { config } from '../config';

const router = Router();

router.use(authenticate);
router.use(aiRateLimiter);

router.post(
  '/caption',
  validate(GenerateCaptionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const accountRecord = await requireAccountRecordForUser(req.userId!);
    const accountId = String(accountRecord.id);
    const brandProfile = formattedAccountToBrandDNA(accountRecord);
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
      brandProfile: brandProfile ?? undefined,
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
      aiProvider: config.aiProvider,
      openaiConfigured: Boolean(config.openaiApiKey?.trim()),
    });
  })
);

router.post(
  '/image',
  validate(GenerateImageSchema),
  validateImagePayload,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const accountRecord = await requireAccountRecordForUser(req.userId!);
    const brandProfile = formattedAccountToBrandDNA(accountRecord);
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
      aspectPreset: req.body.aspectPreset,
      brandProfile: brandProfile ?? undefined,
    });
    if (!processed) {
      return sendSuccess(res, {
        processed_image: null,
        processed_image_with_overlay: null,
        processed_image_clean: null,
        processed_image_variants: [],
        aiProvider: config.aiProvider,
        openaiConfigured: Boolean(config.openaiApiKey?.trim()),
      });
    }
    const primary = processed.withOverlay ?? processed.clean;
    return sendSuccess(res, {
      processed_image: primary,
      processed_image_with_overlay: processed.withOverlay,
      processed_image_clean: processed.clean,
      processed_image_variants: processed.variants ?? [],
      aiProvider: config.aiProvider,
      openaiConfigured: Boolean(config.openaiApiKey?.trim()),
    });
  })
);

router.post(
  '/edit-caption',
  validate(EditCaptionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const accountRecord = await requireAccountRecordForUser(req.userId!);
    const businessName =
      req.body.businessName?.trim() || (accountRecord.name as string | undefined)?.trim() || 'Your business';
    const city = req.body.city?.trim() || (accountRecord.city as string | undefined)?.trim() || '';
    const brandVibe =
      typeof accountRecord.brandVibe === 'string' ? accountRecord.brandVibe : undefined;
    const toneOfVoice =
      typeof accountRecord.toneOfVoice === 'string' ? accountRecord.toneOfVoice : undefined;

    const brandProfile = formattedAccountToBrandDNA(accountRecord);

    const result = await runEditCaption({
      userRequest: req.body.userRequest,
      currentCaption: req.body.currentCaption,
      currentHashtags: req.body.currentHashtags,
      businessName,
      city,
      ideaText: req.body.ideaText,
      brandVibe,
      toneOfVoice,
      chatHistory: req.body.chatHistory,
      brandProfile: brandProfile ?? undefined,
    });

    return sendSuccess(res, {
      message: result.message,
      newCaption: result.newCaption,
      newHashtags: result.newHashtags,
      aiProvider: config.aiProvider,
      openaiConfigured: Boolean(config.openaiApiKey?.trim()),
    });
  })
);

export default router;
