import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { successResponse, errorResponse } from '@/lib/api/response';
import { RateLimitError, UnauthorizedError } from '@/lib/errors';

/**
 * Zod schema for login request body validation.
 */
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long'),
});

// In-memory rate limiting store: 10 attempts per 15 minutes per IP
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const ipRateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimitStore.get(ip);

  if (!record || now > record.resetAt) {
    ipRateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  record.count += 1;
  return true;
}

// Demo test user
// TODO: Replace with tenant/user database query via Drizzle ORM
const TEST_USER = {
  id: 'usr_01J8K90000000000000000001',
  email: 'admin@byob.store',
  name: 'Alex Doe',
  passwordHash: bcrypt.hashSync('AdminPassword123!', 10),
  role: 'platform_admin',
};

/**
 * POST /api/v1/auth/login
 * Authenticates user credentials, issues JWT session cookie, and returns safe user profile.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting (10 per 15min)
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    if (!checkRateLimit(clientIp)) {
      return errorResponse(
        new RateLimitError(
          'Too many login attempts. Please try again after 15 minutes.',
          15 * 60
        )
      );
    }

    // 2. Parse & validate request payload with Zod
    const body = await req.json();
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(parseResult.error);
    }

    const { email, password } = parseResult.data;

    // 3. User lookup
    // TODO: Connect to Drizzle ORM query:
    // const user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
    const user =
      email.toLowerCase() === TEST_USER.email.toLowerCase() ? TEST_USER : null;

    if (!user) {
      return errorResponse(
        new UnauthorizedError('Invalid email or password.')
      );
    }

    // 4. Verify password with bcryptjs
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse(
        new UnauthorizedError('Invalid email or password.')
      );
    }

    // 5. Create JWT session token
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      env.AUTH_SECRET,
      {
        expiresIn: '7d',
        issuer: 'byob-auth',
      }
    );

    // 6. Build response with secure session cookie and user profile
    const response = successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set('byob_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
