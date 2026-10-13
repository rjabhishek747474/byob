import { AsyncLocalStorage } from 'node:async_hooks';
import { ulid } from 'ulid';

/**
 * Standard header key for distributed correlation tracking.
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Storage context capturing the active correlation ID across asynchronous request boundaries.
 */
const correlationStorage = new AsyncLocalStorage<string>();

/**
 * Retrieves the correlation ID from incoming request headers, or generates a new ULID.
 *
 * @param request - Native Web API Request or NextRequest instance
 * @returns Valid correlation ID string
 */
export function getCorrelationId(request: Request): string {
  const headerId =
    request.headers.get(CORRELATION_ID_HEADER) ||
    request.headers.get('x-request-id');

  if (headerId && headerId.trim().length > 0) {
    return headerId.trim();
  }

  return ulid();
}

/**
 * Wraps an asynchronous execution block within the correlation ID's AsyncLocalStorage context.
 *
 * @param correlationId - Correlation identifier to associate with the current execution context
 * @param fn - Asynchronous work callback
 * @returns Result of the executed callback
 */
export function withCorrelation<T>(
  correlationId: string,
  fn: () => Promise<T>
): Promise<T> {
  return correlationStorage.run(correlationId, fn);
}

/**
 * Returns the correlation ID bound to the current execution thread, if initialized.
 *
 * @returns Correlation ID string or undefined if called outside a correlation context
 */
export function getCurrentCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}
