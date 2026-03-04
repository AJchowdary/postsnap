import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, PaymentRequiredError } from '../utils/errors';
import { logger } from '../utils/logger';

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'authorization'];

function sanitize(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) continue;
    out[k] = v;
  }
  return out;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof PaymentRequiredError && err.payload) {
    res.status(402).json(err.payload);
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: true,
      code: err.code,
      message: err.message,
    });
    return;
  }
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join('; ');
    res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: message || 'Validation failed',
    });
    return;
  }

  logger.error('Unhandled error', sanitize({ message: err.message, stack: err.stack }));
  res.status(500).json({
    error: true,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}
