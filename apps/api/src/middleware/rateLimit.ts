import { Request, Response, NextFunction } from 'express';
import rateLimit, { type Store, MemoryStore, ipKeyGenerator } from 'express-rate-limit';
import { AuthRequest } from './auth';
import { config } from '../config';
import { RateLimitError } from '../utils/errors';

/**
 * Rate limit store for key endpoints. Default: in-memory (single-instance only).
 * Memory store is per-instance; OK for single API instance. For multi-instance
 * or higher scale, use RATE_LIMIT_STORE=redis (or supabase when implemented).
 * TODO: When RATE_LIMIT_STORE=redis and REDIS_URL is set, use a Redis store.
 * TODO: When RATE_LIMIT_STORE=supabase, use a table-backed store.
 */
function getRateLimitStore(): Store {
  if (config.rateLimitStore === 'memory') {
    return new MemoryStore();
  }
  if (config.rateLimitStore === 'redis') {
    // TODO: return new RedisStore({ sendCommand: (...args) => redis.sendCommand(...) }) when REDIS_URL set
    return new MemoryStore();
  }
  if (config.rateLimitStore === 'supabase') {
    // TODO: return new SupabaseRateLimitStore(getSupabase(), 'rate_limit_keys') with increment/reset
    return new MemoryStore();
  }
  return new MemoryStore();
}

const RATE_LIMIT_MESSAGE_AUTH = 'Too many auth attempts. Try again later.';
const RATE_LIMIT_MESSAGE_POSTS = 'Too many requests. Slow down.';
const RATE_LIMIT_MESSAGE_SUBSCRIPTION = 'Too many subscription requests.';
const RETRY_AFTER_SEC = 60;

function rateLimitHandler(message: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Retry-After', String(RETRY_AFTER_SEC));
    next(new RateLimitError(message));
  };
}

export const authRateLimiter = rateLimit({
  windowMs: config.rateLimitAuthWindowMs,
  max: config.rateLimitAuthMax,
  standardHeaders: true,
  store: getRateLimitStore(),
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  handler: rateLimitHandler(RATE_LIMIT_MESSAGE_AUTH),
});

export const postsRateLimiter = rateLimit({
  windowMs: config.rateLimitPostsWindowMs,
  max: config.rateLimitPostsMax,
  standardHeaders: true,
  store: getRateLimitStore(),
  keyGenerator: (req) => (req as AuthRequest).userId ?? ipKeyGenerator(req.ip ?? ''),
  handler: rateLimitHandler(RATE_LIMIT_MESSAGE_POSTS),
});

export const subscriptionRateLimiter = rateLimit({
  windowMs: config.rateLimitSubscriptionWindowMs,
  max: config.rateLimitSubscriptionMax,
  standardHeaders: true,
  store: getRateLimitStore(),
  keyGenerator: (req) => (req as AuthRequest).userId ?? ipKeyGenerator(req.ip ?? ''),
  handler: rateLimitHandler(RATE_LIMIT_MESSAGE_SUBSCRIPTION),
});
