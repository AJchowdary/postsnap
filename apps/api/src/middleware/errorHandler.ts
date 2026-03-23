import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, PaymentRequiredError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'authorization'];

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) continue;
    out[k] = v;
  }
  return out;
}

function requestId(res: Response): string {
  return (res.locals.requestId as string) || 'unknown';
}

function clientMessage(_err: Error, status: number): string {
  if (config.nodeEnv === 'production' && status >= 500) {
    return 'Something went wrong';
  }
  return _err instanceof Error ? _err.message : 'Something went wrong';
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const rid = requestId(res);

  if (err instanceof PaymentRequiredError && err.payload) {
    res.status(402).json({
      success: false,
      error: {
        code: err.code ?? 'PAYMENT_REQUIRED',
        message: err.message,
      },
      data: err.payload,
      requestId: rid,
    });
    return;
  }
  if (err instanceof AppError) {
    const msg = clientMessage(err, err.statusCode);
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code ?? 'APP_ERROR',
        message: msg,
      },
      requestId: rid,
    });
    return;
  }
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join('; ');
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: message || 'Validation failed',
      },
      requestId: rid,
    });
    return;
  }

  logger.error('Unhandled error', sanitize({ message: err.message, stack: err.stack, requestId: rid }));
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.nodeEnv === 'production' ? 'Something went wrong' : err.message,
    },
    requestId: rid,
  });
}
