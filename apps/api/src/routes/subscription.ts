import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  getSubscriptionStatus,
  upgradeSubscription,
  restoreSubscription,
  verifySubscription,
} from '../services/subscriptionService';
import { asyncHandler } from '../utils/asyncHandler';
import { subscriptionRateLimiter } from '../middleware/rateLimit';
import { VerifySubscriptionSchema } from '../schemas/subscription';

const router = Router();

router.use(authenticate);
router.use(subscriptionRateLimiter);

router.get('/status', asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = await getSubscriptionStatus(req.userId!);
  res.json(status);
}));

router.post('/upgrade', asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await upgradeSubscription(req.userId!);
  res.json(result);
}));

/** Verify IAP receipt/token server-side; updates subscriptions table. Never unlock without this. */
router.post(
  '/verify',
  validate(VerifySubscriptionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await verifySubscription(req.userId!, req.body);
      res.json({
        status: result.status,
        currentPeriodEnd: result.currentPeriodEnd,
        isEligible: result.isEligible,
        provider: result.provider,
      });
    } catch (err: any) {
      const msg = err?.message ?? 'Verification failed';
      const clientSafe =
        msg.includes('required') ||
        msg.includes('not configured') ||
        msg.includes('not allowed') ||
        msg.includes('Product ID');
      if (clientSafe) {
        res.status(400).json({ error: true, message: msg });
        return;
      }
      res.status(503).json({ error: true, message: 'Subscription verification temporarily unavailable' });
    }
  })
);

/** Restore: send receipt/token in body (same as verify). If no body, falls back to stub (for backward compat). */
router.post(
  '/restore',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as { platform?: string; productId?: string; receipt?: string; purchaseToken?: string; packageName?: string; transactionId?: string };
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
        return res.json({
          status: result.status,
          currentPeriodEnd: result.currentPeriodEnd,
          isEligible: result.isEligible,
          provider: result.provider,
        });
      } catch (err: any) {
        const msg = err?.message ?? 'Restore failed';
        const clientSafe =
          msg.includes('required') ||
          msg.includes('not configured') ||
          msg.includes('not allowed') ||
          msg.includes('Product ID');
        if (clientSafe) {
          res.status(400).json({ error: true, message: msg });
          return;
        }
        res.status(503).json({ error: true, message: 'Subscription verification temporarily unavailable' });
        return;
      }
    }
    const result = await restoreSubscription(req.userId!);
    res.json(result);
  })
);

export default router;
