import { Router, Request, Response } from 'express';
import { config } from '../config';
import { getAdminMetricsLast30Days } from '../services/analyticsMetricsService';
import { asyncHandler } from '../utils/asyncHandler';
import { sendFail, sendSuccess } from '../utils/apiResponse';

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
  adminMetricsAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const metrics = await getAdminMetricsLast30Days();
    return sendSuccess(res, metrics);
  })
);

export default router;
