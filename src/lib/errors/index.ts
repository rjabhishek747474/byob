/**
 * Representation of a field-level validation error.
 */
export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Base operational application error class for all domain-specific errors.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 404 Not Found Error: Raised when a requested resource does not exist.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', true, details);
  }
}

/**
 * 401 Unauthorized Error: Raised when authentication is required and has failed or not been provided.
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', true, details);
  }
}

/**
 * 403 Forbidden Error: Raised when authenticated user lacks permissions for the action.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(message, 403, 'FORBIDDEN', true, details);
  }
}

/**
 * 400 Bad Request Error: Raised when a request is malformed or invalid.
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', true, details);
  }
}

/**
 * 400 Validation Error: Raised when request inputs fail validation rules.
 * Contains structured field-level error messages.
 */
export class ValidationError extends AppError {
  public readonly fieldErrors: readonly FieldError[];

  constructor(
    message = 'Validation failed',
    fieldErrors: FieldError[] = [],
    details?: unknown
  ) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
    this.fieldErrors = Object.freeze([...fieldErrors]);
  }
}

/**
 * 409 Conflict Error: Raised when a conflict occurs (e.g. unique constraint violation, concurrent edit).
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

/**
 * 403 Tenant Mismatch Error: Raised when an attempt is made to access resources
 * across tenant boundaries, preventing data leakage in multi-tenant environments.
 */
export class TenantMismatchError extends AppError {
  constructor(
    message = 'Cross-tenant access prohibited',
    details?: unknown
  ) {
    super(message, 403, 'TENANT_MISMATCH', true, details);
  }
}

/**
 * 429 Rate Limit Error: Raised when request limits are exceeded.
 */
export class RateLimitError extends AppError {
  public readonly retryAfterSeconds?: number;

  constructor(
    message = 'Too many requests, please try again later',
    retryAfterSeconds?: number,
    details?: unknown
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true, details);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Type guard to check if an unknown error is an instance of AppError.
 */
export function isAppError(err: unknown): err is AppError {
  if (err instanceof AppError) {
    return true;
  }

  return (
    typeof err === 'object' &&
    err !== null &&
    'isOperational' in err &&
    'statusCode' in err &&
    'code' in err &&
    typeof (err as { statusCode: unknown }).statusCode === 'number' &&
    typeof (err as { code: unknown }).code === 'string' &&
    typeof (err as { isOperational: unknown }).isOperational === 'boolean'
  );
}
