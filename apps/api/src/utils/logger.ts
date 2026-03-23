import winston from 'winston';
import { config } from '../config';
import { redactForLog } from './logRedaction';

export { redactForLog } from './logRedaction';

export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const safe = redactForLog(meta) as Record<string, unknown>;
      const extra = Object.keys(safe).length ? ' ' + JSON.stringify(safe) : '';
      return `${timestamp} [${level}] ${message}${extra}`;
    })
  ),
  transports: [new winston.transports.Console()],
});
