import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { authRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { RegisterSchema, LoginSchema } from '../schemas/auth';
import { getSupabase } from '../db/supabaseClient';
import { ConflictError, UnauthorizedError } from '../utils/errors';

const router = Router();

router.use(authRateLimiter);

/** POST /auth/register — Supabase signUp; returns { user: { id, email }, token } for frontend. */
router.post(
  '/register',
  validate(RegisterSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password } = req.body as { email: string; password: string };
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('already registered') || msg.includes('already exists') || error.status === 422) {
        throw new ConflictError('Email already registered. Try logging in.');
      }
      throw new UnauthorizedError(error.message ?? 'Registration failed');
    }
    if (!data.user || !data.session) {
      throw new UnauthorizedError('Registration did not return a session. Check email confirmation settings.');
    }
    res.status(201).json({
      user: { id: data.user.id, email: data.user.email ?? email },
      token: data.session.access_token,
    });
  })
);

/** POST /auth/login — Supabase signInWithPassword; returns { user: { id, email }, token }. */
router.post(
  '/login',
  validate(LoginSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password } = req.body as { email: string; password: string };
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      throw new UnauthorizedError(error.message ?? 'Invalid email or password');
    }
    if (!data.user || !data.session) {
      throw new UnauthorizedError('Login did not return a session.');
    }
    res.json({
      user: { id: data.user.id, email: data.user.email ?? email },
      token: data.session.access_token,
    });
  })
);

router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ userId: req.userId });
}));

export default router;
