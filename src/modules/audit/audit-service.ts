import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema/tenants';
import { generateId } from '@/lib/utils';
import type { DbOrTx } from '@/lib/db';

/**
 * Audit log outcome type.
 */
export type AuditOutcome = 'success' | 'failure' | 'denied';

/**
 * Parameters for recording an audit log entry.
 */
export interface RecordAuditLogParams {
  tenantId?: string | null;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: AuditOutcome;
  metadata?: Record<string, unknown> | null;
  correlationId?: string | null;
}

/**
 * Filter and pagination parameters for querying audit logs.
 */
export interface ListAuditLogsParams {
  tenantId?: string | null;
  actorId?: string;
  action?: string;
  resourceType?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Sensitive field names that must be scrubbed recursively from metadata payloads.
 */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /credit[-_]?card/i,
  /cvv/i,
  /pan/i,
  /ssn/i,
  /private[-_]?key/i,
  /api[-_]?key/i,
  /hash/i,
];

/**
 * Recursively scrubs sensitive values from an arbitrary metadata structure.
 *
 * @param obj - Arbitrary data to sanitize
 * @returns Sanitized copy of object, array, or primitive
 */
export function scrubSensitiveData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => scrubSensitiveData(item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = scrubSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Records an immutable audit log entry in the database.
 * Sensitive data within metadata is scrubbed before storage.
 *
 * @param params - Audit entry details
 * @param tx - Optional transaction handle
 * @returns Created audit log record
 */
export async function recordAuditLog(
  params: RecordAuditLogParams,
  tx?: DbOrTx
) {
  const executor = tx ?? db;
  const id = generateId();

  const sanitizedMetadata = params.metadata
    ? scrubSensitiveData(params.metadata)
    : null;

  const [entry] = await executor
    .insert(auditLogs)
    .values({
      id,
      tenantId: params.tenantId ?? null,
      actorId: params.actorId ?? null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      outcome: params.outcome ?? 'success',
      metadata: sanitizedMetadata,
      correlationId: params.correlationId ?? null,
    })
    .returning();

  return entry;
}

/**
 * Lists audit logs filtered by tenant and optional filters with pagination.
 * Tenant filtering is strictly applied when `tenantId` is supplied.
 *
 * @param params - Query filters and pagination options
 * @param tx - Optional transaction handle
 * @returns Array of audit logs and total count
 */
export async function listAuditLogs(
  params: ListAuditLogsParams = {},
  tx?: DbOrTx
) {
  const executor = tx ?? db;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (params.tenantId !== undefined) {
    if (params.tenantId === null) {
      conditions.push(sql`${auditLogs.tenantId} IS NULL`);
    } else {
      conditions.push(eq(auditLogs.tenantId, params.tenantId));
    }
  }

  if (params.actorId) {
    conditions.push(eq(auditLogs.actorId, params.actorId));
  }

  if (params.action) {
    conditions.push(eq(auditLogs.action, params.action));
  }

  if (params.resourceType) {
    conditions.push(eq(auditLogs.resourceType, params.resourceType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    executor
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    executor
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause),
  ]);

  const count = Number(countResult[0]?.count ?? items.length);

  return {
    items,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize) || 1,
  };
}
