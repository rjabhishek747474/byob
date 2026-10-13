import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '@/lib/db';
import { assets } from '@/lib/db/schema';
import { env } from '@/config/env';
import sharp from 'sharp';
import { BadRequestError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import {
  ALLOWED_MIME_TYPES,
  AllowedMimeType,
  AssetDto,
  MAX_ASSET_SIZE_BYTES,
  ProcessAndStoreAssetInput,
  StorageAdapter,
  ValidateUploadRequestInput,
} from './types';

/**
 * Sanitizes file names to prevent directory traversal and invalid characters.
 */
export function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName);
  return baseName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 150);
}

/**
 * Local filesystem storage adapter for development and testing.
 * Defense against path traversal attacks using path.resolve.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), baseDir || env.LOCAL_STORAGE_PATH || 'uploads');
  }

  private resolveSafePath(key: string): string {
    const resolvedPath = path.resolve(this.baseDir, key);
    const normalizedBase = path.normalize(this.baseDir);

    if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
      throw new ForbiddenError('Path traversal detected: Access denied outside storage root');
    }

    return resolvedPath;
  }

  async getUploadUrl(
    key: string,
    mimeType: string,
    _sizeBytes: number
  ): Promise<{ uploadUrl: string; headers?: Record<string, string> }> {
    const appUrl = (env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    return {
      uploadUrl: `${appUrl}/api/v1/assets/upload-local?key=${encodeURIComponent(key)}`,
      headers: {
        'Content-Type': mimeType,
      },
    };
  }

  async getObjectUrl(key: string): Promise<string> {
    const appUrl = (env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${appUrl}/api/v1/assets/serve?key=${encodeURIComponent(key)}`;
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async saveLocalFile(key: string, buffer: Buffer): Promise<void> {
    const filePath = this.resolveSafePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  async readObject(key: string): Promise<Buffer> {
    const filePath = this.resolveSafePath(key);
    return await fs.readFile(filePath);
  }
}

/**
 * S3 Storage Adapter for AWS S3 compatible storage.
 */
export class S3StorageAdapter implements StorageAdapter {
  private bucket: string;
  private region: string;
  private cdnDomain?: string;

  constructor(bucket = 'byob-assets', region = 'ap-south-1', cdnDomain?: string) {
    this.bucket = bucket;
    this.region = region;
    this.cdnDomain = cdnDomain;
  }

  async getUploadUrl(
    key: string,
    mimeType: string,
    _sizeBytes: number
  ): Promise<{ uploadUrl: string; headers?: Record<string, string> }> {
    const encodedKey = encodeURI(key);
    const host = `${this.bucket}.s3.${this.region}.amazonaws.com`;
    const uploadUrl = `https://${host}/${encodedKey}?x-amz-server-side-encryption=aws:kms`;

    return {
      uploadUrl,
      headers: {
        'Content-Type': mimeType,
        'x-amz-server-side-encryption': 'aws:kms',
        'x-amz-acl': 'private',
      },
    };
  }

  async getObjectUrl(key: string): Promise<string> {
    if (this.cdnDomain) {
      const cdn = this.cdnDomain.replace(/\/$/, '');
      return `${cdn}/${encodeURI(key)}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURI(key)}`;
  }

  async deleteObject(_key: string): Promise<void> {
    // S3 deletion stub
  }

  async saveLocalFile(_key: string, _buffer: Buffer): Promise<void> {
    throw new Error('saveLocalFile is not supported directly on S3StorageAdapter');
  }
}

let activeStorageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!activeStorageAdapter) {
    if (env.STORAGE_PROVIDER === 's3' && env.S3_BUCKET) {
      activeStorageAdapter = new S3StorageAdapter(
        env.S3_BUCKET,
        env.S3_REGION || 'ap-south-1',
        env.CDN_DOMAIN
      );
    } else {
      activeStorageAdapter = new LocalStorageAdapter();
    }
  }
  return activeStorageAdapter;
}

export function validateUploadRequest(
  input: ValidateUploadRequestInput,
  tenantId?: string
): { isValid: boolean; storageKey: string; sanitizedName: string } {
  const { fileName, mimeType, sizeBytes } = input;

  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    throw new ValidationError(`Unsupported file MIME type: ${mimeType}`, [
      { field: 'mimeType', message: 'MIME type not allowed' },
    ]);
  }

  if (sizeBytes <= 0 || sizeBytes > MAX_ASSET_SIZE_BYTES) {
    throw new ValidationError(
      `File size (${sizeBytes} bytes) exceeds maximum limit of 10MB (${MAX_ASSET_SIZE_BYTES} bytes)`,
      [{ field: 'sizeBytes', message: 'File size exceeds 10MB limit' }]
    );
  }

  const lowerName = fileName.toLowerCase();
  const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.ts', '.html', '.htm', '.vbs', '.py'];
  if (dangerousExts.some((ext) => lowerName.endsWith(ext))) {
    throw new ValidationError('File extension is disallowed for security reasons', [
      { field: 'fileName', message: 'Disallowed file extension' },
    ]);
  }

  const sanitized = sanitizeFileName(fileName);
  const keyUlid = ulid();
  const storageKey = tenantId
    ? `tenants/${tenantId}/${keyUlid}-${sanitized}`
    : `${keyUlid}-${sanitized}`;

  return {
    isValid: true,
    storageKey,
    sanitizedName: sanitized,
  };
}

export function sanitizeSvgBuffer(svgBuffer: Buffer): void {
  const content = svgBuffer.toString('utf-8').toLowerCase();
  const dangerousTokens = [
    '<script',
    '</script>',
    'javascript:',
    'onload=',
    'onerror=',
    'onclick=',
    'onmouseover=',
    'xlink:href=data:',
    'xlink:href=\'data:',
    '<iframe',
    '<embed',
    '<object',
  ];

  for (const token of dangerousTokens) {
    if (content.includes(token)) {
      throw new BadRequestError(`SVG file contains prohibited malicious element or attribute: ${token}`);
    }
  }
}

export async function processAndStoreAsset(
  input: ProcessAndStoreAssetInput
): Promise<AssetDto> {
  const { tenantId, storageKey, buffer, fileName, mimeType } = input;

  if (mimeType === 'image/svg+xml') {
    sanitizeSvgBuffer(buffer);
  }

  let finalBuffer = buffer;
  let width: number | null = null;
  let height: number | null = null;

  if (['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(mimeType)) {
    try {
      const image = sharp(buffer);
      const meta = await image.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      // Strip EXIF/metadata
      finalBuffer = await sharp(buffer).rotate().toBuffer();
    } catch (err) {
      console.warn('Failed to process image with sharp, fallback to raw buffer', err);
    }
  }

  const checksum = crypto.createHash('sha256').update(finalBuffer).digest('hex');
  const sizeBytes = finalBuffer.length;
  const adapter = getStorageAdapter();

  await adapter.saveLocalFile(storageKey, finalBuffer);

  const assetId = ulid();
  const [created] = await db
    .insert(assets)
    .values({
      id: assetId,
      tenantId,
      storageKey,
      fileName,
      mimeType,
      sizeBytes,
      width,
      height,
      checksum,
      processingStatus: 'ready',
    })
    .returning();

  const url = await adapter.getObjectUrl(storageKey);

  return {
    id: created.id,
    tenantId: created.tenantId,
    storageKey: created.storageKey,
    fileName: created.fileName,
    mimeType: created.mimeType,
    sizeBytes: created.sizeBytes,
    width: created.width,
    height: created.height,
    checksum: created.checksum,
    processingStatus: created.processingStatus,
    url,
    createdAt: created.createdAt,
  };
}

export async function getAssetById(
  tenantId: string,
  assetId: string
): Promise<AssetDto> {
  if (!tenantId || !assetId) {
    throw new BadRequestError('Tenant ID and Asset ID are required');
  }

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)))
    .limit(1);

  if (!asset) {
    throw new NotFoundError(`Asset not found: ${assetId}`);
  }

  const adapter = getStorageAdapter();
  const url = await adapter.getObjectUrl(asset.storageKey);

  return {
    id: asset.id,
    tenantId: asset.tenantId,
    storageKey: asset.storageKey,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    checksum: asset.checksum,
    processingStatus: asset.processingStatus,
    url,
    createdAt: asset.createdAt,
  };
}

export async function deleteAsset(
  tenantId: string,
  assetId: string
): Promise<void> {
  if (!tenantId || !assetId) {
    throw new BadRequestError('Tenant ID and Asset ID are required');
  }

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)))
    .limit(1);

  if (!asset) {
    throw new NotFoundError(`Asset not found: ${assetId}`);
  }

  const adapter = getStorageAdapter();
  await adapter.deleteObject(asset.storageKey);

  await db
    .delete(assets)
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)));
}
