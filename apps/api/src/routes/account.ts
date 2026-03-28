import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  BootstrapAccountSchema,
  BusinessProfileSchema,
  CaptureSignalSchema,
  ScanWebsiteSchema,
} from '../schemas/account';
import { TrackAnalyticsEventSchema, type TrackAnalyticsEventInput } from '../schemas/analyticsEvent';
import {
  bootstrapAccount,
  captureSignal,
  getAccount,
  requireAccountForUser,
  scanAndSaveWebsite,
  upsertBusinessProfile,
} from '../services/accountService';
import { trackEvent, type EventName } from '../services/analyticsEvents';
import { asyncHandler } from '../utils/asyncHandler';
import { sendFail, sendSuccess } from '../utils/apiResponse';

const router = Router();

router.post(
  '/bootstrap',
  authenticate,
  validate(BootstrapAccountSchema),
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

router.post(
  '/signal',
  authenticate,
  validate(CaptureSignalSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const account = await captureSignal(req.userId!, req.body);
    return sendSuccess(res, { account });
  })
);

router.post(
  '/analytics-event',
  authenticate,
  validate(TrackAnalyticsEventSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const accountId = await requireAccountForUser(req.userId!);
    const body = req.body as TrackAnalyticsEventInput;
    await trackEvent({
      name: body.event as EventName,
      accountId,
      postId: body.postId ?? null,
      properties: body.properties,
    });
    return sendSuccess(res, { ok: true });
  })
);

export default router;
