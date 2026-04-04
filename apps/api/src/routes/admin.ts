import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { getAdminMetricsLast30Days } from '../services/analyticsMetricsService';
import { processScheduledPosts } from '../jobs/scheduleProcessor';
import { asyncHandler } from '../utils/asyncHandler';
import { sendFail, sendSuccess } from '../utils/apiResponse';

/** 10 requests / 15 min per IP — brute-force protection for admin bearer key. */
const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many admin requests.',
  handler: (_req, _res, next) => next(new Error('Too many admin requests.')),
  skip: (req) => req.method === 'OPTIONS',
});

const router = Router();

function adminMetricsAuth(req: Request, res: Response, next: () => void) {
  const key = config.adminMetricsKey?.trim();
  if (!key) {
    return sendFail(res, 503, 'METRICS_DISABLED', 'Admin metrics are not configured (ADMIN_METRICS_KEY).');
  }
  const auth = req.headers.authorization;
  const bearer = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerKey =
    (typeof req.headers['x-admin-key'] === 'string' ? req.headers['x-admin-key'] : '') ||
    (typeof req.headers['X-Admin-Key'] === 'string' ? (req.headers['X-Admin-Key'] as string) : '');
  if (bearer === key || headerKey === key) return next();
  return sendFail(res, 401, 'UNAUTHORIZED', 'Invalid or missing admin credentials.');
}

router.get(
  '/metrics',
  adminRateLimiter,
  adminMetricsAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const metrics = await getAdminMetricsLast30Days();
    return sendSuccess(res, metrics);
  })
);

/** One-shot scheduled-post processor (same auth as metrics). Bypasses SCHEDULING_ENABLED. */
router.post(
  '/process-scheduled-posts',
  adminRateLimiter,
  adminMetricsAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await processScheduledPosts({ ignoreSchedulingEnabled: true });
    return sendSuccess(res, stats);
  })
);

export default router;
