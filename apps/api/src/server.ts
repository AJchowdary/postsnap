import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { setupExpressErrorHandler } from '@sentry/node';
import { routes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestContext } from './middleware/requestContext';
import { getCorsAllowlist, config } from './config';
import { generalApiLimiter } from './middleware/rateLimit';
import { sendSuccess, sendFail } from './utils/apiResponse';
import { redisClient } from './lib/redis';
import { getSupabase } from './db/supabaseClient';

const corsAllowlist = getCorsAllowlist();
if (config.nodeEnv === 'production' && corsAllowlist.length === 0) {
  throw new Error('CORS_ALLOWLIST must be set in production (comma-separated origins). No wildcard.');
}

function securityHeaders(_req: Request, res: Response, next: () => void) {
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  next();
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(securityHeaders);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || corsAllowlist.includes(origin)) return cb(null, true);
        return cb(new Error('CORS not allowed'), false);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    })
  );
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', async (_req: Request, res: Response) => {
    let redis: 'connected' | 'unavailable' = 'unavailable';
    let database: 'connected' | 'unavailable' = 'unavailable';
    try {
      if (redisClient) {
        try {
          const pong = await redisClient.ping();
          redis = pong === 'PONG' ? 'connected' : 'unavailable';
        } catch {
          redis = 'unavailable';
        }
      }
    } catch {
      redis = 'unavailable';
    }
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from('jobs').select('id').limit(1);
      database = error ? 'unavailable' : 'connected';
    } catch {
      database = 'unavailable';
    }
    sendSuccess(res, {
      status: 'ok',
      redis,
      database,
      aiProvider: config.aiProvider,
      openaiConfigured: Boolean(config.openaiApiKey?.trim()),
      captionModel: config.openaiCaptionModel,
      timestamp: new Date().toISOString(),
    });
  });
  app.get('/api/', (_req: Request, res: Response) =>
    sendSuccess(res, { message: 'Quickpost Node API v1.0', status: 'running' })
  );

  app.use('/api/v1', generalApiLimiter, routes);

  app.use((_req: Request, res: Response) => sendFail(res, 404, 'NOT_FOUND', 'Not found'));
  if (process.env.SENTRY_DSN) {
    setupExpressErrorHandler(app);
  }
  app.use(errorHandler);

  return app;
}
