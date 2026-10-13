import jwt from 'jsonwebtoken';
import { getPermissions } from './permissions';
import { type AuthSession, jwtPayloadSchema, type JWTPayload } from './types';

/**
 * In-memory blacklist for invalidated session tokens (MVP store).
 * Maps token string to its epoch expiration timestamp in milliseconds.
 */
const tokenBlacklist = new Map<string, number>();

/**
 * Cleanup expired blacklisted tokens periodically to prevent memory bloat.
 */
function pruneBlacklist(): void {
  const now = Date.now();
  for (const [token, expiry] of tokenBlacklist.entries()) {
    if (expiry <= now) {
      tokenBlacklist.delete(token);
    }
  }
}

/**
 * Retrieves the cryptographic signing secret for JWTs directly from process.env.
 * Throws in production if not defined or insufficient length.
 */
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET environment variable is required in production.');
    }
    return 'development-secret-key-must-be-at-least-32-chars-long';
  }
  return secret;
}

/**
 * Issues a signed JSON Web Token (JWT) with a 24-hour expiration window.
 *
 * @param user - Core user identity details { id, email, name, role?, tenantId?, tenantSlug? }
 * @returns Resolves to signed JWT string
 */
export async function createSession(user: {
  id: string;
  email: string;
  name?: string;
  role?: AuthSession['role'];
  tenantId?: string;
  tenantSlug?: string;
}): Promise<string> {
  const secret = getAuthSecret();

  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    ...(user.name ? { name: user.name } : {}),
    ...(user.role ? { role: user.role } : {}),
    ...(user.tenantId ? { tenantId: user.tenantId } : {}),
    ...(user.tenantSlug ? { tenantSlug: user.tenantSlug } : {}),
  };

  return new Promise<string>((resolve, reject) => {
    jwt.sign(
      payload,
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '24h',
      },
      (err, token) => {
        if (err || !token) {
          reject(err ?? new Error('Failed to sign session JWT'));
        } else {
          resolve(token);
        }
      }
    );
  });
}

/**
 * Verifies a JWT token against the signing secret and blacklist.
 *
 * @param token - Bearer or cookie JWT string
 * @returns Decoded AuthSession if valid and active, null otherwise
 */
export async function verifySession(token: string): Promise<AuthSession | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  // Check in-memory revocation blacklist
  if (tokenBlacklist.has(token)) {
    const expiresAt = tokenBlacklist.get(token);
    if (expiresAt && expiresAt > Date.now()) {
      return null;
    }
    // Clean up if past expiration
    tokenBlacklist.delete(token);
  }

  const secret = getAuthSecret();

  try {
    const decoded = await new Promise<jwt.JwtPayload | string>((resolve, reject) => {
      jwt.verify(token, secret, { algorithms: ['HS256'] }, (err, payload) => {
        if (err || !payload) {
          reject(err ?? new Error('Invalid token'));
        } else {
          resolve(payload);
        }
      });
    });

    if (typeof decoded === 'string') {
      return null;
    }

    const parseResult = jwtPayloadSchema.safeParse(decoded);
    if (!parseResult.success) {
      return null;
    }

    const payload = parseResult.data;
    const permissions = payload.role ? getPermissions(payload.role) : [];

    const session: AuthSession = {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      permissions,
    };

    return session;
  } catch {
    return null;
  }
}

/**
 * Invalidates an active JWT session by appending it to the in-memory blacklist.
 *
 * @param token - Token to revoke
 */
export function invalidateSession(token: string): void {
  if (!token || typeof token !== 'string') {
    return;
  }

  // Prune any outdated blacklist entries periodically
  if (tokenBlacklist.size > 1000) {
    pruneBlacklist();
  }

  try {
    // Decode without full signature verification to extract expiration time
    const decoded = jwt.decode(token);
    if (decoded && typeof decoded === 'object' && typeof decoded.exp === 'number') {
      const expMs = decoded.exp * 1000;
      tokenBlacklist.set(token, expMs);
      return;
    }
  } catch {
    // Fallback to default 24h expiration from now
  }

  tokenBlacklist.set(token, Date.now() + 24 * 60 * 60 * 1000);
}
