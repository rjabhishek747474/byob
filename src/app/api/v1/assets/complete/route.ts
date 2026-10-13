import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import {
  getStorageAdapter,
  processAndStoreAsset,
} from '@/modules/assets/asset-service';
import { BadRequestError, ValidationError } from '@/lib/errors';

const completeSchema = z.object({
  storageKey: z.string().min(1, 'Storage key is required'),
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  fileBase64: z.string().optional(),
});

/**
 * POST /api/v1/assets/complete
 * Finalizes upload, verifies metadata/checksum, marks asset 'ready'.
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
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      'Invalid completion request',
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
    );
  }

  const { storageKey, fileName, mimeType, fileBase64 } = parsed.data;

  // Enforce tenant scoping on storage key
  if (!storageKey.startsWith(`tenants/${tenantId}/`)) {
    throw new BadRequestError('Storage key does not belong to active tenant');
  }

  let buffer: Buffer;
  if (fileBase64) {
    buffer = Buffer.from(fileBase64, 'base64');
  } else {
    // Attempt to read from storage adapter if already written
    const adapter = getStorageAdapter();
    if (adapter.readObject) {
      buffer = await adapter.readObject(storageKey);
    } else {
      throw new BadRequestError('File buffer or base64 payload is required to finalize asset');
    }
  }

  const asset = await processAndStoreAsset({
    tenantId,
    storageKey,
    buffer,
    fileName,
    mimeType,
  });

  return asset;
});

