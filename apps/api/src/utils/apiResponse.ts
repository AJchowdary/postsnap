import { Response } from 'express';

export function getRequestId(res: Response): string {
  return (res.locals.requestId as string) || 'unknown';
}

export function sendSuccess(res: Response, data: unknown, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    requestId: getRequestId(res),
  });
}

export function sendFail(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({
    success: false,
    error: { code, message },
    requestId: getRequestId(res),
  });
}
