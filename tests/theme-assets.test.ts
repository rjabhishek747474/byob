import { describe, expect, it } from 'vitest';
import path from 'path';
import {
  LocalStorageAdapter,
  S3StorageAdapter,
  getStorageAdapter,
  sanitizeFileName,
  sanitizeSvgBuffer,
  validateUploadRequest,
} from '@/modules/assets/asset-service';
import {
  MAX_ASSET_SIZE_BYTES,
} from '@/modules/assets/types';
import {
  evaluateContrast,
  evaluateThemeContrast,
  getContrastRatio,
  getRelativeLuminance,
  parseColor,
} from '@/modules/theme/contrast';
import {
  DEFAULT_THEME_CONFIG,
  themeConfigSchema,
} from '@/modules/theme/types';
import { validateThemeConfig } from '@/modules/theme/theme-service';
import { updateStoreSettingsSchema } from '@/modules/settings/settings-service';
import { BadRequestError, ForbiddenError, ValidationError } from '@/lib/errors';

describe('Slice 3: Store Settings, Assets & Theme Engine', () => {
  describe('1. Asset Management & Storage Adapters', () => {
    it('creates LocalStorageAdapter and prevents path traversal', async () => {
      const adapter = new LocalStorageAdapter('./uploads');
      expect(adapter).toBeDefined();

      // Normal safe path inside uploads should not throw path traversal error
      const uploadTicket = await adapter.getUploadUrl('test-file.png', 'image/png', 1024);
      expect(uploadTicket.uploadUrl).toContain('test-file.png');

      // Malicious path traversal attempts must throw ForbiddenError
      await expect(
        adapter.saveLocalFile('../../../etc/passwd', Buffer.from('malicious'))
      ).rejects.toThrow(ForbiddenError);

      await expect(
        adapter.deleteObject('../../outside.png')
      ).rejects.toThrow(ForbiddenError);
    });

    it('creates S3StorageAdapter with KMS and private ACL parameters', async () => {
      const s3Adapter = new S3StorageAdapter('test-bucket', 'ap-south-1');
      const ticket = await s3Adapter.getUploadUrl('tenants/t1/logo.png', 'image/png', 2048);

      expect(ticket.uploadUrl).toContain('test-bucket.s3.ap-south-1.amazonaws.com');
      expect(ticket.uploadUrl).toContain('x-amz-server-side-encryption=aws:kms');
      expect(ticket.headers?.['x-amz-server-side-encryption']).toBe('aws:kms');
      expect(ticket.headers?.['x-amz-acl']).toBe('private');

      const objectUrl = await s3Adapter.getObjectUrl('tenants/t1/logo.png');
      expect(objectUrl).toBe('https://test-bucket.s3.ap-south-1.amazonaws.com/tenants/t1/logo.png');
    });

    it('returns appropriate storage adapter via getStorageAdapter factory', () => {
      const adapter = getStorageAdapter();
      expect(adapter).toBeInstanceOf(LocalStorageAdapter);
    });

    it('sanitizes file names securely', () => {
      expect(sanitizeFileName('../../etc/malicious file#name!.jpg')).toBe('malicious_file_name_.jpg');
      expect(sanitizeFileName('normal-image_01.png')).toBe('normal-image_01.png');
    });

    it('validates upload request with allowlisted MIME types and size cap', () => {
      // Valid request
      const valid = validateUploadRequest(
        {
          fileName: 'banner.webp',
          mimeType: 'image/webp',
          sizeBytes: 1024 * 500,
        },
        'tenant_01'
      );
      expect(valid.isValid).toBe(true);
      expect(valid.storageKey).toMatch(/^tenants\/tenant_01\/[0-9A-Z]{26}-banner\.webp$/);

      // Rejects unsupported MIME type (e.g., pdf or exe)
      expect(() =>
        validateUploadRequest({
          fileName: 'doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        })
      ).toThrow(ValidationError);

      // Rejects file exceeding 10MB
      expect(() =>
        validateUploadRequest({
          fileName: 'huge.png',
          mimeType: 'image/png',
          sizeBytes: MAX_ASSET_SIZE_BYTES + 1,
        })
      ).toThrow(ValidationError);

      // Rejects zero or negative file size
      expect(() =>
        validateUploadRequest({
          fileName: 'empty.png',
          mimeType: 'image/png',
          sizeBytes: 0,
        })
      ).toThrow(ValidationError);

      // Rejects executable file extensions even if spoofed MIME
      expect(() =>
        validateUploadRequest({
          fileName: 'script.exe',
          mimeType: 'image/png',
          sizeBytes: 1024,
        })
      ).toThrow(ValidationError);
    });

    it('inspects and sanitizes SVG files rejecting scripts and event handlers', () => {
      const safeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5"/></svg>');
      expect(() => sanitizeSvgBuffer(safeSvg)).not.toThrow();

      const maliciousSvg1 = Buffer.from('<svg><script>alert("xss")</script></svg>');
      expect(() => sanitizeSvgBuffer(maliciousSvg1)).toThrow(BadRequestError);

      const maliciousSvg2 = Buffer.from('<svg onload="alert(1)"><circle r="5"/></svg>');
      expect(() => sanitizeSvgBuffer(maliciousSvg2)).toThrow(BadRequestError);

      const maliciousSvg3 = Buffer.from('<svg><a href="javascript:alert(1)"><circle r="5"/></a></svg>');
      expect(() => sanitizeSvgBuffer(maliciousSvg3)).toThrow(BadRequestError);
    });
  });

  describe('2. Store Settings Validation Schema', () => {
    it('validates settings with currency, email, social links, and minor units', () => {
      const valid = updateStoreSettingsSchema.safeParse({
        storeName: 'Artisan Boutique',
        currency: 'INR',
        contactEmail: 'hello@boutique.in',
        contactPhone: '+91 9988776655',
        deliveryFeeDefault: 4000, // ₹40.00
        freeDeliveryThreshold: 50000, // ₹500.00
        socialInstagram: 'https://instagram.com/artisan',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects invalid currency format or negative delivery fee', () => {
      const invalidCurrency = updateStoreSettingsSchema.safeParse({
        currency: 'rupees',
      });
      expect(invalidCurrency.success).toBe(false);

      const negativeFee = updateStoreSettingsSchema.safeParse({
        deliveryFeeDefault: -50,
      });
      expect(negativeFee.success).toBe(false);

      const floatFee = updateStoreSettingsSchema.safeParse({
        deliveryFeeDefault: 49.99, // Must be minor unit integer
      });
      expect(floatFee.success).toBe(false);
    });
  });

  describe('3. Theme Schema & Validation', () => {
    it('validates default theme configuration correctly', () => {
      const parsed = themeConfigSchema.safeParse(DEFAULT_THEME_CONFIG);
      expect(parsed.success).toBe(true);

      const validated = validateThemeConfig(DEFAULT_THEME_CONFIG);
      expect(validated.typography.headingFont).toBe('Inter');
    });

    it('rejects unapproved fonts and illegal tokens', () => {
      const invalidFont = {
        ...DEFAULT_THEME_CONFIG,
        typography: {
          ...DEFAULT_THEME_CONFIG.typography,
          headingFont: 'Comic Sans MS',
        },
      };
      expect(() => validateThemeConfig(invalidFont)).toThrow(ValidationError);
    });

    it('rejects script tags and malicious attributes in theme tokens', () => {
      const maliciousTheme = {
        ...DEFAULT_THEME_CONFIG,
        colors: {
          ...DEFAULT_THEME_CONFIG.colors,
          primary: '<script>alert(1)</script>',
        },
      };
      expect(() => validateThemeConfig(maliciousTheme)).toThrow(ValidationError);
    });
  });

  describe('4. WCAG 2.1 Contrast Engine', () => {
    it('parses hex and rgb colors accurately', () => {
      expect(parseColor('#000000')).toEqual([0, 0, 0]);
      expect(parseColor('#ffffff')).toEqual([255, 255, 255]);
      expect(parseColor('#4f46e5')).toEqual([79, 70, 229]);
      expect(parseColor('rgb(255, 0, 128)')).toEqual([255, 0, 128]);
    });

    it('calculates relative luminance per WCAG 2.1 specs', () => {
      expect(getRelativeLuminance('#ffffff')).toBeCloseTo(1.0, 2);
      expect(getRelativeLuminance('#000000')).toBeCloseTo(0.0, 2);
    });

    it('calculates contrast ratio between black and white as 21:1', () => {
      const ratio = getContrastRatio('#000000', '#ffffff');
      expect(ratio).toBe(21);
    });

    it('evaluates contrast compliance correctly with warnings for low contrast', () => {
      // High contrast (pass AAA)
      const high = evaluateContrast('#111827', '#ffffff', 'body text on background');
      expect(high.ratio).toBeGreaterThan(10);
      expect(high.isCompliantBody).toBe(true);
      expect(high.warning).toBeUndefined();

      // Low contrast (fail AA)
      const low = evaluateContrast('#aaaaaa', '#ffffff', 'light gray on white');
      expect(low.isCompliantBody).toBe(false);
      expect(low.warning).toBeDefined();
    });

    it('evaluates theme contrast and generates full report', () => {
      const report = evaluateThemeContrast(DEFAULT_THEME_CONFIG.colors);
      expect(report.bodyTextContrast).toBeDefined();
      expect(report.bodyTextContrast.ratio).toBeGreaterThan(4.5);
      expect(report.bodyTextContrast.isCompliantBody).toBe(true);
    });
  });
});

