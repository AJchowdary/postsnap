export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

export interface PaymentRequiredPayload {
  upgrade_required: true;
  reason: 'trial_ended' | 'subscription_inactive';
  status: 'trial_expired';
  trial_end_at?: string;
  days_left: number;
}

export class PaymentRequiredError extends AppError {
  constructor(
    message = 'Subscription required to publish',
    public readonly payload?: PaymentRequiredPayload
  ) {
    super(402, message, 'PAYMENT_REQUIRED');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, message, 'RATE_LIMIT_EXCEEDED');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

/** Meta connection invalid/expired/revoked; UI should prompt reconnect. */
export class ReconnectRequiredError extends AppError {
  constructor(message = 'Reconnect required') {
    super(403, message, 'RECONNECT_REQUIRED');
  }
}

/** Publishing temporarily disabled (e.g. PUBLISH_ENABLED=false). */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(503, message, 'SERVICE_UNAVAILABLE');
  }
}
