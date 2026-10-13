/**
 * Asset management and storage types
 */

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_ASSET_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface StorageAdapter {
  /**
   * Generates a signed or direct upload URL for client-side uploads.
   */
  getUploadUrl(
    key: string,
    mimeType: string,
    sizeBytes: number
  ): Promise<{ uploadUrl: string; headers?: Record<string, string> }>;

  /**
   * Generates a public or signed retrieval URL for accessing an asset.
   */
  getObjectUrl(key: string): Promise<string>;

  /**
   * Deletes an object from the underlying storage.
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Saves a file buffer directly to storage.
   */
  saveLocalFile(key: string, buffer: Buffer): Promise<void>;

  /**
   * Reads an object buffer if available from storage.
   */
  readObject?(key: string): Promise<Buffer>;
}

export interface ValidateUploadRequestInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ProcessAndStoreAssetInput {
  tenantId: string;
  storageKey: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface AssetDto {
  id: string;
  tenantId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  checksum: string | null;
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed';
  url?: string;
  createdAt: Date;
}
