import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { validateImagePayload } from '../middleware/validateImagePayload';
import { GenerateCaptionSchema, GenerateImageSchema } from '../schemas/posts';
import { getAIProvider } from '../providers/ai';
import { asyncHandler } from '../utils/asyncHandler';
import { aiRateLimiter } from '../middleware/rateLimit';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();

router.use(authenticate);
router.use(aiRateLimiter);

router.post(
  '/caption',
  validate(GenerateCaptionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ai = getAIProvider();
    const result = await ai.generateCaption({
      description: req.body.description,
      template: req.body.template,
      businessName: req.body.businessName,
      businessType: req.body.businessType,
      brandStyle: req.body.brandStyle,
      platform: req.body.platform,
    });
    const caption = result.instagram?.caption ?? result.facebook?.caption ?? '';
    return sendSuccess(res, { caption });
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
    });
    return sendSuccess(res, { processed_image: processed });
  })
);

export default router;
