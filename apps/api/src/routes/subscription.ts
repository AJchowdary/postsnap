import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  getSubscriptionStatus,
  restoreSubscription,
  verifySubscription,
} from '../services/subscriptionService';
import { asyncHandler } from '../utils/asyncHandler';
import { subscriptionRateLimiter } from '../middleware/rateLimit';
import { VerifySubscriptionSchema } from '../schemas/subscription';
import { sendSuccess, sendFail } from '../utils/apiResponse';

const router = Router();

router.use(authenticate);
router.use(subscriptionRateLimiter);

router.get('/status', asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = await getSubscriptionStatus(req.userId!);
  return sendSuccess(res, status);
}));

router.post(
  '/verify',
  validate(VerifySubscriptionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await verifySubscription(req.userId!, req.body);
      return sendSuccess(res, {
        status: result.status,
        currentPeriodEnd: result.currentPeriodEnd,
        isEligible: result.isEligible,
        provider: result.provider,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      const clientSafe =
        msg.includes('required') ||
        msg.includes('not configured') ||
        msg.includes('not allowed') ||
        msg.includes('Product ID');
      if (clientSafe) {
        return sendFail(res, 400, 'VERIFY_FAILED', msg);
      }
      return sendFail(res, 503, 'SERVICE_UNAVAILABLE', 'Subscription verification temporarily unavailable');
    }
  })
);

router.post(
  '/restore',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as {
      platform?: string;
      productId?: string;
      receipt?: string;
      purchaseToken?: string;
      packageName?: string;
      transactionId?: string;
    };
    if (body?.platform && body?.productId && (body?.receipt || body?.purchaseToken)) {
      try {
        const result = await verifySubscription(req.userId!, {
          platform: body.platform as 'ios' | 'android',
          productId: body.productId,
          receipt: body.receipt,
          purchaseToken: body.purchaseToken,
          packageName: body.packageName,
          transactionId: body.transactionId,
        });
        return sendSuccess(res, {
          status: result.status,
          currentPeriodEnd: result.currentPeriodEnd,
          isEligible: result.isEligible,
          provider: result.provider,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Restore failed';
        const clientSafe =
          msg.includes('required') ||
          msg.includes('not configured') ||
          msg.includes('not allowed') ||
          msg.includes('Product ID');
        if (clientSafe) {
          return sendFail(res, 400, 'RESTORE_FAILED', msg);
        }
        return sendFail(res, 503, 'SERVICE_UNAVAILABLE', 'Subscription verification temporarily unavailable');
      }
    }
    const result = await restoreSubscription(req.userId!);
    return sendSuccess(res, result);
  })
);

export default router;
