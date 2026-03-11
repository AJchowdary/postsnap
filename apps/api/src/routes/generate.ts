import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { GenerateCaptionSchema, GenerateImageSchema } from '../schemas/posts';
import { getAIProvider } from '../providers/ai';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.post('/caption', validate(GenerateCaptionSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const ai = getAIProvider();
  const result = await ai.generateCaption({
    description: req.body.description,
    template: req.body.template,
    businessName: req.body.businessName,
    businessType: req.body.businessType,
    brandStyle: req.body.brandStyle,
  });
  res.json({ caption: result.instagram?.caption ?? result.facebook?.caption ?? '' });
}));

router.post('/image', validate(GenerateImageSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const ai = getAIProvider();
  const processed = await ai.processImage({
    photoBase64: req.body.photo,
    templateId: req.body.template,
    businessName: req.body.businessName,
    businessType: req.body.businessType,
    brandStyle: req.body.brandStyle,
    description: req.body.description ?? '',
  });
  res.json({ processed_image: processed });
}));

export default router;
