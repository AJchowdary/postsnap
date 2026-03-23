import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { BusinessProfileSchema } from '../schemas/account';
import { bootstrapAccount, getAccount, upsertBusinessProfile } from '../services/accountService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';

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

export default router;
