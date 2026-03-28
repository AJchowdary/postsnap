/**
 * Canonical entrypoint for the DB-backed generation worker.
 * Run with: npm run start:worker (prod) or npm run worker (dev).
 * Safe to run multiple instances (2+): Postgres `claim_next_job` is atomic; optional Redis `job:lock:*`
 * adds a second layer when `REDIS_URL` is set (e.g. multiple Render workers).
 */
import { initSentry, captureException } from '../utils/sentry';
import { getDb } from '../db';
import { startWorker } from './generateQueue';
import { startSeasonalContextScheduler } from './seasonalContextWorker';
import { startScheduler } from './scheduleProcessor';
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
  if (config.runSeasonalContextWorker) {
    startSeasonalContextScheduler();
    logger.info('[worker] seasonal context scheduler (Mon 06:00 UTC) enabled');
  } else {
    logger.info('[worker] seasonal context scheduler disabled (RUN_SEASONAL_CONTEXT_WORKER=false)');
  }
  if (config.runSchedulerInProcess && config.schedulingEnabled) {
    startScheduler();
    logger.info('[worker] schedule processor enabled (30s interval)');
  }
}

main().catch((err) => {
  captureException(err);
  logger.error('[worker] fatal', { error: (err as Error).message });
  process.exit(1);
});
