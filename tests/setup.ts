/**
 * Global test environment setup for Vitest test suite.
 */
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.AUTH_SECRET = 'test-secret-key-at-least-32-characters-long-for-jwt-signing';
process.env.AUTH_PROVIDER = 'local';
process.env.STORAGE_PROVIDER = 'local';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/byob_test';
