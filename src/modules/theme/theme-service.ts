import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '@/lib/db';
import { auditLogs, themes } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { evaluateThemeContrast } from './contrast';
import {
  DEFAULT_THEME_CONFIG,
  ThemeConfig,
  ThemeDto,
  themeConfigSchema,
} from './types';

/**
 * Validates a theme configuration using strict Zod schema.
 * Rejects any custom CSS, JavaScript, HTML tags, or unapproved fonts.
 */
export function validateThemeConfig(config: unknown): ThemeConfig {
  const parsed = themeConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new ValidationError(
      'Theme configuration validation failed',
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
    );
  }

  // Double check no HTML or script injection in string fields
  const serialized = JSON.stringify(parsed.data).toLowerCase();
  const dangerousTokens = ['<script', '</script>', 'javascript:', '<style', 'onload='];
  for (const token of dangerousTokens) {
    if (serialized.includes(token)) {
      throw new ValidationError('Theme configuration contains prohibited script or HTML tokens', [
        { field: 'config', message: `Prohibited token detected: ${token}` },
      ]);
    }
  }

  return parsed.data;
}

/**
 * Retrieves theme record for tenant, creating initial record with default tokens if missing.
 */
export async function getTheme(tenantId: string): Promise<ThemeDto> {
  const [existing] = await db
    .select()
    .from(themes)
    .where(eq(themes.tenantId, tenantId))
    .limit(1);

  if (existing) {
    const draftConfig = existing.draftConfig as ThemeConfig;
    const publishedConfig = (existing.publishedConfig as ThemeConfig) || null;
    const contrastReport = evaluateThemeContrast(draftConfig.colors);

    return {
      id: existing.id,
      tenantId: existing.tenantId,
      name: existing.name,
      draftConfig,
      publishedConfig,
      publishedAt: existing.publishedAt,
      publishedBy: existing.publishedBy,
      version: existing.version,
      contrastReport,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
  }

  // Create default theme for tenant
  const themeId = ulid();
  const [created] = await db
    .insert(themes)
    .values({
      id: themeId,
      tenantId,
      name: 'default',
      draftConfig: DEFAULT_THEME_CONFIG,
      publishedConfig: DEFAULT_THEME_CONFIG,
      publishedAt: new Date(),
      version: 1,
    })
    .returning();

  const draftConfig = created.draftConfig as ThemeConfig;
  const publishedConfig = created.publishedConfig as ThemeConfig;
  const contrastReport = evaluateThemeContrast(draftConfig.colors);

  return {
    id: created.id,
    tenantId: created.tenantId,
    name: created.name,
    draftConfig,
    publishedConfig,
    publishedAt: created.publishedAt,
    publishedBy: created.publishedBy,
    version: created.version,
    contrastReport,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * Updates draft theme tokens for tenant.
 */
export async function updateDraftTheme(
  tenantId: string,
  config: unknown,
  _actorId: string
): Promise<ThemeDto> {
  const validatedConfig = validateThemeConfig(config);

  // Ensure record exists
  await getTheme(tenantId);

  const [updated] = await db
    .update(themes)
    .set({
      draftConfig: validatedConfig,
      updatedAt: new Date(),
    })
    .where(eq(themes.tenantId, tenantId))
    .returning();

  const contrastReport = evaluateThemeContrast(validatedConfig.colors);

  return {
    id: updated.id,
    tenantId: updated.tenantId,
    name: updated.name,
    draftConfig: updated.draftConfig as ThemeConfig,
    publishedConfig: (updated.publishedConfig as ThemeConfig) || null,
    publishedAt: updated.publishedAt,
    publishedBy: updated.publishedBy,
    version: updated.version,
    contrastReport,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Publishes draft theme: copies draft to published, increments version, records audit log.
 */
export async function publishTheme(
  tenantId: string,
  actorId: string
): Promise<ThemeDto> {
  const current = await getTheme(tenantId);
  if (!current) {
    throw new NotFoundError(`Theme not found for tenant: ${tenantId}`);
  }

  // Ensure draft is strictly validated before publish
  const draftConfig = validateThemeConfig(current.draftConfig);
  const newVersion = (current.version || 0) + 1;
  const now = new Date();

  const [published] = await db
    .update(themes)
    .set({
      publishedConfig: draftConfig,
      publishedAt: now,
      publishedBy: actorId,
      version: newVersion,
      updatedAt: now,
    })
    .where(eq(themes.tenantId, tenantId))
    .returning();

  // Record audit log
  await db.insert(auditLogs).values({
    id: ulid(),
    tenantId,
    actorId,
    action: 'theme:publish',
    resourceType: 'theme',
    resourceId: published.id,
    outcome: 'success',
    metadata: {
      version: newVersion,
      colors: draftConfig.colors,
    },
  });

  const contrastReport = evaluateThemeContrast(draftConfig.colors);

  return {
    id: published.id,
    tenantId: published.tenantId,
    name: published.name,
    draftConfig: published.draftConfig as ThemeConfig,
    publishedConfig: published.publishedConfig as ThemeConfig,
    publishedAt: published.publishedAt,
    publishedBy: published.publishedBy,
    version: published.version,
    contrastReport,
    createdAt: published.createdAt,
    updatedAt: published.updatedAt,
  };
}

/**
 * Exports current draft theme as validated clean JSON package.
 */
export async function exportTheme(tenantId: string): Promise<{
  version: number;
  exportedAt: string;
  theme: ThemeConfig;
}> {
  const current = await getTheme(tenantId);
  const validated = validateThemeConfig(current.draftConfig);

  return {
    version: current.version,
    exportedAt: new Date().toISOString(),
    theme: validated,
  };
}

/**
 * Imports and strictly validates a JSON theme package, rejecting any malicious or unsupported tokens.
 */
export async function importTheme(
  tenantId: string,
  jsonPackage: unknown,
  actorId: string
): Promise<ThemeDto> {
  if (typeof jsonPackage !== 'object' || jsonPackage === null) {
    throw new ValidationError('Invalid theme import package', [
      { field: 'themePackage', message: 'Import payload must be an object' },
    ]);
  }

  const rawConfig =
    'theme' in jsonPackage && typeof (jsonPackage as { theme: unknown }).theme === 'object'
      ? (jsonPackage as { theme: unknown }).theme
      : jsonPackage;

  const validatedConfig = validateThemeConfig(rawConfig);

  const updated = await updateDraftTheme(tenantId, validatedConfig, actorId);

  // Record audit log
  await db.insert(auditLogs).values({
    id: ulid(),
    tenantId,
    actorId,
    action: 'theme:import',
    resourceType: 'theme',
    resourceId: updated.id,
    outcome: 'success',
    metadata: {
      importedKeys: Object.keys(validatedConfig),
    },
  });

  return updated;
}

