import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { authRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.use(authRateLimiter);

router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ userId: req.userId });
}));

export default router;
