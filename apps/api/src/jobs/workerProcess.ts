/**
 * Canonical entrypoint for the DB-backed generation worker.
 * Run with: npm run start:worker (prod) or npm run worker (dev).
 * Safe to run multiple instances (2+); claim_next_job is atomic.
 */
import { initSentry, captureException } from '../utils/sentry';
import { getDb } from '../db';
import { startWorker } from './generateQueue';
import { config } from '../config';

initSentry({
  environment: config.nodeEnv,
  service: 'worker',
});

async function main() {
  console.log('[worker] starting...');
  await getDb();
  startWorker();
}

main().catch((err) => {
  captureException(err);
  console.error('[worker] fatal:', err);
  process.exit(1);
});
