import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../db/supabaseClient';
import { UnauthorizedError } from '../utils/errors';

export interface AuthRequest extends Request {
  userId?: string;
}

async function verifySupabaseToken(token: string): Promise<string> {
  const { data: { user }, error } = await getSupabase().auth.getUser(token);
  if (error || !user) throw new UnauthorizedError('Invalid or expired token');
  return user.id;
}

/**
 * Verify Supabase Auth JWT. Sets req.userId = auth.uid().
 * Reject invalid or expired tokens. No custom JWT secret.
 */
export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('No token provided'));
    return;
  }
  const token = header.slice(7);
  verifySupabaseToken(token)
    .then((uid) => {
      req.userId = uid;
      next();
    })
    .catch((e) => next(e));
}

/** Optional auth – attaches userId if token valid, does not fail if missing. */
export function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  const token = header.slice(7);
  verifySupabaseToken(token)
    .then((uid) => {
      req.userId = uid;
      next();
    })
    .catch(() => { next(); });
}
