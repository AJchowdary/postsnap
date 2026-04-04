import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const MAX_REQUEST_ID_LENGTH = 128;

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const raw = (req.headers['x-request-id'] as string)?.trim() ?? '';
  // Sanitize: only accept safe characters within length limit to prevent injection.
  const isSafe = raw.length > 0 && raw.length <= MAX_REQUEST_ID_LENGTH && /^[\w\-:.]+$/.test(raw);
  const id = isSafe ? raw : randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
