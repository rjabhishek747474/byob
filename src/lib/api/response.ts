import { NextRequest, NextResponse } from 'next/server';
import { ValidationError, isAppError } from '../errors';

/**
 * Metadata for paginated API responses.
 */
export interface ApiResponseMeta {
  page?: number;
  pageSize?: number;
  total?: number;
}

/**
 * Standard API response envelope matching platform design rules.
 */
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      meta?: ApiResponseMeta;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };

/**
 * Creates a raw success response envelope object.
 *
 * @param data - Payload data
 * @param meta - Optional pagination / search metadata
 */
export function createSuccessPayload<T>(
  data: T,
  meta?: ApiResponseMeta
): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(meta !== undefined ? { meta } : {}),
  };
}

/**
 * Creates a raw error response envelope object and status code.
 *
 * @param error - Any caught error or AppError
 */
export function createErrorPayload(error: unknown): {
  body: ApiResponse<never>;
  statusCode: number;
} {
  const isProduction = process.env.NODE_ENV === 'production';

  if (error instanceof ValidationError) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: {
            fieldErrors: error.fieldErrors,
            ...(error.details && typeof error.details === 'object'
              ? error.details
              : {}),
          },
        },
      },
    };
  }

  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  // Handle Zod validation errors if encountered
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'ZodError' &&
    'issues' in error
  ) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: (error as { issues: unknown }).issues,
        },
      },
    };
  }

  // Unknown unhandled error
  const message = isProduction
    ? 'An unexpected error occurred. Please try again later.'
    : error instanceof Error
      ? error.message
      : 'Internal server error';

  const details = !isProduction && error instanceof Error
    ? { stack: error.stack }
    : undefined;

  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
        details,
      },
    },
  };
}

/**
 * Helper to construct a successful Next.js response with consistent envelope.
 *
 * @param data - The response payload
 * @param meta - Optional pagination metadata
 * @param init - Optional NextResponse options (e.g. status, headers)
 */
export function successResponse<T>(
  data: T,
  meta?: ApiResponseMeta,
  init?: ResponseInit
): NextResponse<ApiResponse<T>> {
  const body = createSuccessPayload(data, meta);
  return NextResponse.json(body, {
    status: 200,
    ...init,
  });
}

/**
 * Helper to construct an error Next.js response with consistent envelope.
 * Handles AppError, ValidationError, ZodError, and unknown errors gracefully.
 *
 * @param error - The caught error
 * @param correlationIdOrInit - Optional correlation ID string or ResponseInit
 */
export function errorResponse(
  error: unknown,
  correlationIdOrInit?: string | ResponseInit
): NextResponse<ApiResponse<never>> {
  const { body, statusCode } = createErrorPayload(error);

  const init: ResponseInit =
    typeof correlationIdOrInit === 'string'
      ? { headers: { 'x-correlation-id': correlationIdOrInit } }
      : (correlationIdOrInit ?? {});

  const headers = new Headers(init.headers);
  if (
    typeof correlationIdOrInit === 'string' &&
    !headers.has('x-correlation-id')
  ) {
    headers.set('x-correlation-id', correlationIdOrInit);
  }

  return NextResponse.json(body, {
    status: statusCode,
    ...init,
    headers,
  });
}

/**
 * Route context for Next.js dynamic parameters.
 */
export type RouteContext<TParams = Record<string, string | string[]>> = {
  params?: Promise<TParams> | TParams;
};

/**
 * Route handler function definition.
 */
export type ApiRouteHandler<TResponse = unknown, TParams = Record<string, string | string[]>> = (
  req: NextRequest,
  context?: RouteContext<TParams>
) => Promise<NextResponse | Response | ApiResponse<TResponse> | TResponse> | NextResponse | Response | ApiResponse<TResponse> | TResponse;

/**
 * High-order wrapper for Next.js route handlers.
 * Catches unhandled errors, attaches correlation IDs, and ensures
 * all responses adhere to the standard envelope format.
 *
 * @param handler - Next.js route handler function
 */
export function withApiHandler<TResponse = unknown, TParams = Record<string, string | string[]>>(
  handler: ApiRouteHandler<TResponse, TParams>
) {
  return async (
    req: NextRequest,
    context?: RouteContext<TParams>
  ): Promise<NextResponse> => {
    const correlationId =
      req.headers.get('x-correlation-id') ||
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    try {
      const result = await handler(req, context);

      // If handler already returned a NextResponse or Response
      if (result instanceof Response) {
        if (!result.headers.has('x-correlation-id')) {
          result.headers.set('x-correlation-id', correlationId);
        }
        return result as NextResponse;
      }

      // Check if already shaped as ApiResponse
      if (
        typeof result === 'object' &&
        result !== null &&
        'success' in result &&
        typeof (result as { success: unknown }).success === 'boolean'
      ) {
        return NextResponse.json(result as ApiResponse<TResponse>, {
          status: (result as { success: boolean }).success ? 200 : 400,
          headers: {
            'x-correlation-id': correlationId,
          },
        });
      }

      // Plain data returned from handler
      return successResponse(result as TResponse, undefined, {
        headers: {
          'x-correlation-id': correlationId,
        },
      });
    } catch (err: unknown) {
      return errorResponse(err, {
        headers: {
          'x-correlation-id': correlationId,
        },
      });
    }
  };
}
