import { z } from 'zod/v4';

/**
 * Validates whether the application is running in a production environment.
 */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Zod schema defining all required and optional environment variables
 * for the multi-tenant e-commerce platform.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default('http://localhost:3000'),

  DATABASE_URL: isProduction
    ? z.string().min(1, 'DATABASE_URL is required in production')
    : z
        .string()
        .min(1)
        .default('postgresql://postgres:postgres@localhost:5432/beyourownboss'),

  DATABASE_URL_TEST: z.string().optional(),

  AUTH_SECRET: isProduction
    ? z.string().min(32, 'AUTH_SECRET must be at least 32 characters in production')
    : z
        .string()
        .min(32)
        .default('development-secret-key-must-be-at-least-32-chars-long'),

  AUTH_PROVIDER: z.enum(['local', 'cognito']).default('local'),

  AWS_REGION: z.string().optional(),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),

  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('./uploads'),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  PLATFORM_DOMAIN: z.string().default('localhost:3000'),
  CDN_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_CDN_DOMAIN: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
});

/**
 * Typed environment configuration representation.
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates environment variables.
 * In production, fails immediately with detailed issues.
 * In development, uses sensible fallbacks when values are omitted.
 */
function loadEnv(): Env {
  const isBuildPhase =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.npm_lifecycle_event === 'build';

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => ` - [${issue.path.join('.') || 'root'}]: ${issue.message}`)
      .join('\n');

    if (isProduction && !isBuildPhase) {
      throw new Error(
        `[CRITICAL] Invalid environment variables in production:\n${errorDetails}`
      );
    } else {
      // In development, test, or during Next.js build-time static evaluation, provide fallbacks
      return envSchema.parse({
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? 'development',
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://postgres:postgres@localhost:5432/beyourownboss',
        AUTH_SECRET:
          process.env.AUTH_SECRET ??
          'development-secret-key-must-be-at-least-32-chars-long',
      });
    }
  }

  return result.data;
}

/**
 * Validated, typed environment configuration constant.
 */
export const env: Readonly<Env> = Object.freeze(loadEnv());
