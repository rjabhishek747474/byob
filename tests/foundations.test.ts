import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { env, envSchema } from '@/config/env';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  TenantMismatchError,
  UnauthorizedError,
  ValidationError,
  isAppError,
} from '@/lib/errors';
import {
  errorResponse,
  successResponse,
  withApiHandler,
} from '@/lib/api/response';
import {
  ZERO_INR,
  addMoney,
  applyFixedDiscount,
  applyPercentageDiscount,
  createMoney,
  formatMoney,
  isValidMoney,
  multiplyMoney,
  subtractMoney,
} from '@/lib/money';
import {
  clamp,
  csvEscape,
  generateId,
  generateSecureToken,
  omit,
  pick,
  sanitizeHtml,
  slugify,
} from '@/lib/utils';
import { createLogger, scrubSensitive } from '@/lib/logger';

describe('Foundational Utilities & Config Tests', () => {
  describe('File 1: src/config/env.ts', () => {
    it('provides validated env object with defaults', () => {
      expect(env).toBeDefined();
      expect(env.PORT).toBe(3000);
      expect(env.STORAGE_PROVIDER).toBe('local');
      expect(env.AUTH_PROVIDER).toBe('local');
      expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    });

    it('validates custom config with envSchema', () => {
      const parsed = envSchema.parse({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod-db:5432/app',
        AUTH_SECRET: 'super-secure-production-secret-min-32-chars-long',
      });
      expect(parsed.NODE_ENV).toBe('production');
      expect(parsed.PORT).toBe(3000);
      expect(parsed.DATABASE_URL).toBe('postgresql://prod-db:5432/app');
    });
  });

  describe('File 2: src/lib/errors/index.ts', () => {
    it('creates AppError and subclasses with correct status codes', () => {
      const notFound = new NotFoundError('Item not found');
      expect(notFound.statusCode).toBe(404);
      expect(notFound.code).toBe('NOT_FOUND');
      expect(notFound.isOperational).toBe(true);

      const unauthorized = new UnauthorizedError();
      expect(unauthorized.statusCode).toBe(401);

      const forbidden = new ForbiddenError();
      expect(forbidden.statusCode).toBe(403);

      const conflict = new ConflictError();
      expect(conflict.statusCode).toBe(409);

      const tenantMismatch = new TenantMismatchError();
      expect(tenantMismatch.statusCode).toBe(403);
      expect(tenantMismatch.code).toBe('TENANT_MISMATCH');

      const rateLimit = new RateLimitError('Rate exceeded', 60);
      expect(rateLimit.statusCode).toBe(429);
      expect(rateLimit.retryAfterSeconds).toBe(60);

      const validation = new ValidationError('Bad request', [
        { field: 'email', message: 'Invalid format' },
      ]);
      expect(validation.statusCode).toBe(400);
      expect(validation.fieldErrors).toHaveLength(1);
      expect(validation.fieldErrors[0].field).toBe('email');
    });

    it('identifies AppError via isAppError type guard', () => {
      expect(isAppError(new NotFoundError())).toBe(true);
      expect(isAppError(new Error('Generic'))).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError({ statusCode: 404, code: 'NOT_FOUND', isOperational: true })).toBe(true);
    });
  });

  describe('File 3: src/lib/api/response.ts', () => {
    it('creates successResponse correctly', async () => {
      const res = successResponse({ id: '123' }, { page: 1, pageSize: 10, total: 50 });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ id: '123' });
      expect(json.meta).toEqual({ page: 1, pageSize: 10, total: 50 });
    });

    it('creates errorResponse for AppError and unknown error', async () => {
      const errRes = errorResponse(new NotFoundError('Store not found'), 'corr-1');
      expect(errRes.status).toBe(404);
      expect(errRes.headers.get('x-correlation-id')).toBe('corr-1');
      const errJson = await errRes.json();
      expect(errJson.success).toBe(false);
      expect(errJson.error.code).toBe('NOT_FOUND');
      expect(errJson.error.message).toBe('Store not found');

      const genericRes = errorResponse(new Error('Boom'));
      expect(genericRes.status).toBe(500);
      const genericJson = await genericRes.json();
      expect(genericJson.success).toBe(false);
      expect(genericJson.error.code).toBe('INTERNAL_ERROR');
    });

    it('handles requests with withApiHandler wrapper', async () => {
      const handler = withApiHandler(async () => {
        return { message: 'hello' };
      });
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-correlation-id': 'req-123' },
      });
      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-correlation-id')).toBe('req-123');
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ message: 'hello' });

      // Failing handler
      const failingHandler = withApiHandler(async () => {
        throw new TenantMismatchError('Tenant access denied');
      });
      const failRes = await failingHandler(req);
      expect(failRes.status).toBe(403);
      const failBody = await failRes.json();
      expect(failBody.success).toBe(false);
      expect(failBody.error.code).toBe('TENANT_MISMATCH');
    });
  });

  describe('File 4: src/lib/money/index.ts', () => {
    it('creates and validates integer Money values', () => {
      const m = createMoney(1500, 'INR');
      expect(m.amount).toBe(1500);
      expect(m.currency).toBe('INR');
      expect(isValidMoney(m)).toBe(true);
      expect(ZERO_INR.amount).toBe(0);

      // Throws on float
      expect(() => createMoney(15.5, 'INR')).toThrow(ValidationError);
      // Throws on NaN
      expect(() => createMoney(NaN, 'INR')).toThrow(ValidationError);
      // Throws on Infinity
      expect(() => createMoney(Infinity, 'INR')).toThrow(ValidationError);
    });

    it('adds and subtracts money safely', () => {
      const a = createMoney(1000, 'INR');
      const b = createMoney(500, 'INR');
      expect(addMoney(a, b).amount).toBe(1500);
      expect(subtractMoney(a, b).amount).toBe(500);

      const usd = createMoney(500, 'USD');
      expect(() => addMoney(a, usd)).toThrow(ValidationError);
      expect(() => subtractMoney(a, usd)).toThrow(ValidationError);
    });

    it('multiplies money and applies percentage / fixed discounts', () => {
      const price = createMoney(1000, 'INR');
      expect(multiplyMoney(price, 3).amount).toBe(3000);
      expect(multiplyMoney(price, 1.5).amount).toBe(1500);

      // Percentage discount: 20% off 1000 = 800
      const discounted = applyPercentageDiscount(price, 20);
      expect(discounted.amount).toBe(800);

      // Rounds down
      const oddPrice = createMoney(105, 'INR');
      expect(applyPercentageDiscount(oddPrice, 10).amount).toBe(94);

      // Fixed discount
      const fixedDiscount = createMoney(300, 'INR');
      expect(applyFixedDiscount(price, fixedDiscount).amount).toBe(700);

      // Fixed discount exceeding price clamps to 0
      const largeDiscount = createMoney(2000, 'INR');
      expect(applyFixedDiscount(price, largeDiscount).amount).toBe(0);
    });

    it('formats money properly', () => {
      const formatted = formatMoney(createMoney(1500, 'INR'));
      expect(formatted).toContain('15.00');
    });
  });

  describe('File 5: src/lib/utils/index.ts', () => {
    it('generates unique ULIDs and secure tokens', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).toHaveLength(26);
      expect(id1).not.toBe(id2);

      const token = generateSecureToken(16);
      expect(token).toHaveLength(32);
    });

    it('slugifies text correctly', () => {
      expect(slugify('Hello World! 2026')).toBe('hello-world-2026');
      expect(slugify('  Café & Croissant--Special  ')).toBe('cafe-croissant-special');
    });

    it('sanitizes dangerous HTML tags and event handlers', () => {
      const dirty = '<p>Safe</p><script>alert("hack")</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">link</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('javascript:');
      expect(clean).toContain('<p>Safe</p>');
    });

    it('escapes CSV cells against formula injection', () => {
      expect(csvEscape('=SUM(A1:A10)')).toBe('\t=SUM(A1:A10)');
      expect(csvEscape('+1234')).toBe('\t+1234');
      expect(csvEscape('Normal text, with comma')).toBe('"Normal text, with comma"');
    });

    it('clamps numbers safely', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
      expect(() => clamp(5, 10, 0)).toThrow(ValidationError);
    });

    it('picks and omits keys correctly', () => {
      const original = { a: 1, b: 2, c: 3 };
      expect(omit(original, ['b'])).toEqual({ a: 1, c: 3 });
      expect(pick(original, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });
  });

  describe('File 6: src/lib/logger/index.ts', () => {
    it('scrubs sensitive credentials, emails, and cards', () => {
      const raw = {
        password: 'my-secret-password',
        auth_token: 'xyz123',
        user: {
          email: 'test@example.com',
          message: 'Contact me at admin@domain.org or 4111 1111 1111 1111',
        },
        safeField: 'visible',
      };

      const scrubbed = scrubSensitive(raw) as typeof raw & { safeField: string };
      expect(scrubbed.password).toBe('[REDACTED]');
      expect(scrubbed.auth_token).toBe('[REDACTED]');
      expect(scrubbed.user.email).toBe('[REDACTED]');
      expect(scrubbed.user.message).toContain('[EMAIL_REDACTED]');
      expect(scrubbed.safeField).toBe('visible');
    });

    it('logs JSON entries with context adhering to LOG_LEVEL', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const logger = createLogger({ tenantId: 'tenant-1' });

      // In setup.ts LOG_LEVEL is 'error', so info should be filtered out
      logger.info('Test info event', { correlationId: 'c-1' });
      expect(logSpy).not.toHaveBeenCalled();

      // Error level should be logged to console.error
      logger.error('Test error event', { correlationId: 'c-1', extraData: 42 });
      expect(errorSpy).toHaveBeenCalled();
      const loggedJson = JSON.parse(errorSpy.mock.calls[0][0] as string);
      expect(loggedJson.level).toBe('error');
      expect(loggedJson.message).toBe('Test error event');
      expect(loggedJson.tenantId).toBe('tenant-1');
      expect(loggedJson.correlationId).toBe('c-1');
      expect(loggedJson.extraData).toBe(42);

      // Child logger retains parent context and appends child context
      const childLogger = logger.child({ subService: 'checkout' });
      childLogger.error('Child error event');
      const childJson = JSON.parse(errorSpy.mock.calls[1][0] as string);
      expect(childJson.tenantId).toBe('tenant-1');
      expect(childJson.subService).toBe('checkout');

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });
});
