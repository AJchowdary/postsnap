import { initSentry, captureException } from './utils/sentry';
import { createApp } from './server';
import { config, validateProductionEnv } from './config';
import { logger } from './utils/logger';
import { getDb } from './db';
import { startWorker } from './jobs/generateQueue';
import { startScheduler } from './jobs/scheduleProcessor';

initSentry({
  environment: config.nodeEnv,
  service: 'api',
});

async function main() {
  try {
    validateProductionEnv();
    await getDb();

    const app = createApp();
    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`Quickpost Node API running on port ${config.port} [${config.nodeEnv}]`);
      logger.info(`DB: Supabase | AI provider: ${config.aiProvider}`);
    });

    if (config.runWorkerInProcess) {
      startWorker();
      if (config.runSchedulerInProcess && config.schedulingEnabled) {
        startScheduler();
      } else {
        logger.info('Scheduler disabled (RUN_SCHEDULER_IN_PROCESS or SCHEDULING_ENABLED not set).');
      }
    } else {
      logger.info('In-process worker disabled (default); run separate worker(s) (e.g. npm run start:worker).');
    }
  } catch (err) {
    captureException(err);
    logger.error('Failed to start server', { error: (err as Error).message });
    process.exit(1);
  }
}

main();
