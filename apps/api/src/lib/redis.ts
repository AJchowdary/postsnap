import Redis from 'ioredis';
import { logger } from '../utils/logger';

let _client: Redis | null = null;

const url = process.env.REDIS_URL?.trim();

if (url) {
  _client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  _client.on('ready', () => {
    logger.info('Redis connected');
  });

  _client.on('error', (err: Error) => {
    logger.error('Redis connection error', { error: err.message });
  });
}

/** Redis client when `REDIS_URL` is set; otherwise `null`. */
export const redisClient: Redis | null = _client;

export function isRedisAvailable(): boolean {
  return _client !== null && _client.status === 'ready';
}
