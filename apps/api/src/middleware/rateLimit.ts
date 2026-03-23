import { Request, Response, NextFunction } from 'express';
import rateLimit, { type Store, MemoryStore, ipKeyGenerator } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { AuthRequest } from './auth';
import { config } from '../config';
import { RateLimitError } from '../utils/errors';
import { redisClient } from '../lib/redis';
import { logger } from '../utils/logger';

function createRateLimitStore(prefix: string): Store {
  if (!redisClient) {
    return new MemoryStore();
  }
  const r = redisClient;
  return new RedisStore({
    sendCommand: (...args: string[]) => {
      const [cmd, ...rest] = args;
      return r.call(cmd, ...rest) as Promise<RedisReply>;
    },
    prefix: `rl:${prefix}:`,
  });
}

if (redisClient) {
  logger.info('Rate limiter using Redis store');
} else {
  logger.info('Rate limiter using memory store');
}

function rateLimitNext(message: string) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    next(new RateLimitError(message));
  };
}

/** Auth (login/register): 5 / 15 min per IP */
export const authRateLimiter = rateLimit({
  windowMs: config.rateLimitAuthWindowMs,
  max: config.rateLimitAuthMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('auth'),
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  message: 'Too many auth attempts. Try again later.',
  handler: rateLimitNext('Too many auth attempts. Try again later.'),
  skip: (req) => req.method === 'OPTIONS',
});

/** General API under /api/v1: 100 / 15 min per IP */
export const generalApiLimiter = rateLimit({
  windowMs: config.rateLimitGeneralWindowMs,
  max: config.rateLimitGeneralMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('general'),
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  message: 'Too many requests. Slow down.',
  handler: rateLimitNext('Too many requests. Slow down.'),
  skip: (req) => req.method === 'OPTIONS',
});

/** AI caption + image: 20 / hour per user (requires authenticate before this middleware) */
export const aiRateLimiter = rateLimit({
  windowMs: config.rateLimitAiWindowMs,
  max: config.rateLimitAiMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('ai'),
  keyGenerator: (req) => {
    const uid = (req as AuthRequest).userId;
    if (!uid) return ipKeyGenerator(req.ip ?? '');
    return `ai:${uid}`;
  },
  message: 'AI request limit reached. Try again later.',
  handler: rateLimitNext('AI request limit reached. Try again later.'),
  skip: (req) => req.method === 'OPTIONS',
});

/** Social publish: 30 / day per user */
export const socialPublishRateLimiter = rateLimit({
  windowMs: config.rateLimitPublishDayWindowMs,
  max: config.rateLimitPublishDayMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('publish'),
  keyGenerator: (req) => {
    const uid = (req as AuthRequest).userId;
    if (!uid) return ipKeyGenerator(req.ip ?? '');
    return `publish:${uid}`;
  },
  message: 'Daily posting limit reached. Try again tomorrow.',
  handler: rateLimitNext('Daily posting limit reached. Try again tomorrow.'),
  skip: (req) => req.method === 'OPTIONS',
});

export const subscriptionRateLimiter = rateLimit({
  windowMs: config.rateLimitSubscriptionWindowMs,
  max: config.rateLimitSubscriptionMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRateLimitStore('subscription'),
  keyGenerator: (req) => (req as AuthRequest).userId ?? ipKeyGenerator(req.ip ?? ''),
  message: 'Too many subscription requests.',
  handler: rateLimitNext('Too many subscription requests.'),
  skip: (req) => req.method === 'OPTIONS',
});
