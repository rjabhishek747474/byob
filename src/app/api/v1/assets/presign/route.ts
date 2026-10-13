import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import {
  getStorageAdapter,
  validateUploadRequest,
} from '@/modules/assets/asset-service';
import { ValidationError } from '@/lib/errors';

const presignSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  sizeBytes: z.number().int().positive('Size must be positive'),
});

/**
 * POST /api/v1/assets/presign
 * Generates an upload ticket/URL for client-side uploads.
 * Requires `asset:upload` permission, tenant-scoped.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requirePermission('asset:upload');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const body = await req.json();
  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      'Invalid presign request parameters',
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
    );
  }

  const { fileName, mimeType, sizeBytes } = parsed.data;

  // Validate upload request rules and derive storageKey
  const { storageKey, sanitizedName } = validateUploadRequest(
    { fileName, mimeType, sizeBytes },
    tenantId
  );

  const adapter = getStorageAdapter();
  const ticket = await adapter.getUploadUrl(storageKey, mimeType, sizeBytes);

  return {
    storageKey,
    fileName: sanitizedName,
    mimeType,
    sizeBytes,
    uploadUrl: ticket.uploadUrl,
    headers: ticket.headers ?? {},
  };
});

