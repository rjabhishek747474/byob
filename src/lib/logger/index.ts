export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Priority values for log level filtering.
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * List of regex patterns for identifying sensitive field keys.
 * Never log passwords, tokens, secrets, emails, phone numbers, addresses, or payment cards.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /passw(or)?d/i,
  /secret/i,
  /token/i,
  /auth(orization)?/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /cookie/i,
  /jwt/i,
  /session/i,
  /email/i,
  /phone([_-]?number)?/i,
  /mobile/i,
  /address/i,
  /street/i,
  /postal[_-]?code/i,
  /zip[_-]?code/i,
  /pincode/i,
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /cvv/i,
  /cvc/i,
  /ssn/i,
  /aadhaar/i,
];

/**
 * Pattern to mask raw emails within strings if found.
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Pattern to mask 13-19 digit card numbers within strings if found.
 */
const CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;

/**
 * Recursively masks sensitive fields, emails, phone numbers, and credentials
 * from objects or arrays before logging.
 *
 * @param obj - Object, array, primitive, or Error to scrub
 * @param seen - WeakSet tracking visited objects to avoid circular recursion
 */
export function scrubSensitive<T>(obj: T, seen = new WeakSet<object>()): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj
      .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
      .replace(CARD_REGEX, '[CARD_REDACTED]') as unknown as T;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (seen.has(obj as object)) {
    return '[CIRCULAR]' as unknown as T;
  }
  seen.add(obj as object);

  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: scrubSensitive(obj.message, seen),
      stack: process.env.NODE_ENV === 'production' ? undefined : obj.stack,
    } as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => scrubSensitive(item, seen)) as unknown as T;
  }

  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) =>
      pattern.test(key)
    );

    if (isSensitiveKey) {
      scrubbed[key] = '[REDACTED]';
    } else {
      scrubbed[key] = scrubSensitive(value, seen);
    }
  }

  return scrubbed as T;
}

/**
 * Standard log entry format for structured JSON logging.
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

/**
 * Structured Logger interface.
 */
export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  child(additionalContext: Record<string, unknown>): Logger;
}

/**
 * Resolves current configured log level from environment.
 */
function getConfiguredLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
    return envLevel;
  }
  return 'info';
}

/**
 * Factory creating a structured JSON logger with contextual metadata.
 *
 * @param context - Base context attached to each log (e.g. tenantId, correlationId, service)
 */
export function createLogger(context: Record<string, unknown> = {}): Logger {
  const writeLog = (
    level: LogLevel,
    message: string,
    extra: Record<string, unknown> = {}
  ): void => {
    const minLevel = getConfiguredLogLevel();
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
      return;
    }

    const merged = { ...context, ...extra };
    const scrubbed = scrubSensitive(merged) as Record<string, unknown>;

    const correlationId =
      typeof scrubbed.correlationId === 'string'
        ? (scrubbed.correlationId as string)
        : undefined;

    const tenantId =
      typeof scrubbed.tenantId === 'string'
        ? (scrubbed.tenantId as string)
        : undefined;

    delete scrubbed.correlationId;
    delete scrubbed.tenantId;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === 'string' ? message : String(message),
      ...(correlationId ? { correlationId } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...scrubbed,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      case 'info':
      default:
        console.log(output);
        break;
    }
  };

  return {
    debug(message: string, extra?: Record<string, unknown>): void {
      writeLog('debug', message, extra);
    },
    info(message: string, extra?: Record<string, unknown>): void {
      writeLog('info', message, extra);
    },
    warn(message: string, extra?: Record<string, unknown>): void {
      writeLog('warn', message, extra);
    },
    error(message: string, extra?: Record<string, unknown>): void {
      writeLog('error', message, extra);
    },
    child(additionalContext: Record<string, unknown>): Logger {
      return createLogger({
        ...context,
        ...additionalContext,
      });
    },
  };
}

/**
 * Default singleton structured logger instance.
 */
export const logger = createLogger();
