import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string)?.trim() || randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
