import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { setupExpressErrorHandler } from '@sentry/node';
import { routes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { getCorsAllowlist, config } from './config';

const corsAllowlist = getCorsAllowlist();
if (config.nodeEnv === 'production' && corsAllowlist.length === 0) {
  throw new Error('CORS_ALLOWLIST must be set in production (comma-separated origins). No wildcard.');
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
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
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) =>
    res.json({
      status: 'ok',
      service: 'api',
      version: process.env.RENDER_GIT_COMMIT || process.env.VERSION || '1.0.0',
      time: new Date().toISOString(),
    })
  );
  app.get('/api/', (_req, res) =>
    res.json({ message: 'Quickpost Node API v1.0', status: 'running' })
  );

  app.use('/api/v1', routes);
  app.use('/api', routes);

  app.use((_req, res) => res.status(404).json({ error: true, message: 'Not found' }));
  if (process.env.SENTRY_DSN) {
    setupExpressErrorHandler(app);
  }
  app.use(errorHandler);

  return app;
}
