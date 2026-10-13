import { successResponse, errorResponse } from '@/lib/api/response';

/**
 * POST /api/v1/auth/logout
 * Clears the byob_session HTTP-only cookie and returns success envelope.
 */
export async function POST() {
  try {
    const response = successResponse({
      message: 'Successfully logged out.',
    });

    // Clear session cookie
    response.cookies.set('byob_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
