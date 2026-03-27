import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { BusinessProfileSchema, ScanWebsiteSchema } from '../schemas/account';
import { bootstrapAccount, getAccount, scanAndSaveWebsite, upsertBusinessProfile } from '../services/accountService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendFail, sendSuccess } from '../utils/apiResponse';

const router = Router();

router.post(
  '/bootstrap',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const account = await bootstrapAccount(req.userId!);
    return sendSuccess(res, account);
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const account = await getAccount(req.userId!);
    return sendSuccess(res, account ?? {});
  })
);

router.put(
  '/profile',
  authenticate,
  validate(BusinessProfileSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const profile = await upsertBusinessProfile(req.userId!, req.body);
    return sendSuccess(res, profile);
  })
);

router.post(
  '/scan-website',
  authenticate,
  validate(ScanWebsiteSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const out = await scanAndSaveWebsite(req.userId!, req.body.websiteUrl);
    if (!out) {
      return sendFail(res, 400, 'SCAN_FAILED', 'Could not scan website. Set up manually instead.');
    }
    return sendSuccess(res, { account: out.account, scan: out.scan });
  })
);

export default router;
