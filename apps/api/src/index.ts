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

    if (process.env.RUN_WORKER_IN_PROCESS !== 'false') {
      startWorker();
      startScheduler();
    } else {
      logger.info('In-process worker disabled (RUN_WORKER_IN_PROCESS=false); run separate worker(s).');
    }
  } catch (err) {
    captureException(err);
    logger.error('Failed to start server', { error: (err as Error).message });
    process.exit(1);
  }
}

main();
