/**
 * Canonical entrypoint for the DB-backed generation worker.
 * Run with: npm run start:worker (prod) or npm run worker (dev).
 * Safe to run multiple instances (2+); claim_next_job is atomic.
 */
import { initSentry, captureException } from '../utils/sentry';
import { getDb } from '../db';
import { startWorker } from './generateQueue';
import { config } from '../config';
import { logger } from '../utils/logger';

initSentry({
  environment: config.nodeEnv,
  service: 'worker',
});

async function main() {
  logger.info('[worker] starting...');
  await getDb();
  startWorker();
}

main().catch((err) => {
  captureException(err);
  logger.error('[worker] fatal', { error: (err as Error).message });
  process.exit(1);
});
