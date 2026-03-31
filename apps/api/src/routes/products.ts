import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ProductScrapeSchema } from '../schemas/products';
import { scrapeProductPage } from '../services/productScrapeService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();

router.use(authenticate);

router.post(
  '/scrape',
  validate(ProductScrapeSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await scrapeProductPage(req.body.url);
    return sendSuccess(res, result);
  })
);

export default router;
