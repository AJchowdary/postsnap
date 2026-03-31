import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  CreateCampaignSchema,
  PatchCampaignSchema,
  GenerateCampaignCreativeSchema,
  CampaignSuggestIdeasSchema,
} from '../schemas/campaigns';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  softDeleteCampaign,
  generateCampaignCreative,
} from '../services/campaignService';
import { suggestCampaignIdeas } from '../services/campaignSuggestionService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import type { GenerateCampaignCreativeInput } from '../schemas/campaigns';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const items = await listCampaigns(req.userId!);
    return sendSuccess(res, items);
  })
);

router.post(
  '/',
  validate(CreateCampaignSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const created = await createCampaign(req.userId!, req.body);
    return sendSuccess(res, created, 201);
  })
);

router.post(
  '/suggest-ideas',
  validate(CampaignSuggestIdeasSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await suggestCampaignIdeas(req.userId!, req.body.hint);
    return sendSuccess(res, result);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const item = await getCampaign(req.userId!, req.params.id);
    return sendSuccess(res, item);
  })
);

router.patch(
  '/:id',
  validate(PatchCampaignSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const updated = await updateCampaign(req.userId!, req.params.id, req.body);
    return sendSuccess(res, updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await softDeleteCampaign(req.userId!, req.params.id);
    return sendSuccess(res, { deleted: true });
  })
);

router.post(
  '/:id/generate',
  validate(GenerateCampaignCreativeSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as GenerateCampaignCreativeInput;
    const result = await generateCampaignCreative(req.userId!, req.params.id, body.premium_quality, {
      product_name: body.product_name,
      product_description: body.product_description,
      product_image_url: body.product_image_url,
    });
    return sendSuccess(res, result, 202);
  })
);

export default router;
