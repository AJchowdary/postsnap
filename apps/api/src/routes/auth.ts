import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { authRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { RegisterSchema, LoginSchema } from '../schemas/auth';
import { getSupabase } from '../db/supabaseClient';
import { ConflictError, UnauthorizedError } from '../utils/errors';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();

router.use(authRateLimiter);

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
    return sendSuccess(
      res,
      {
        user: { id: data.user.id, email: data.user.email ?? email },
        token: data.session.access_token,
      },
      201
    );
  })
);

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
    return sendSuccess(res, {
      user: { id: data.user.id, email: data.user.email ?? email },
      token: data.session.access_token,
    });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    return sendSuccess(res, { userId: req.userId });
  })
);

export default router;
