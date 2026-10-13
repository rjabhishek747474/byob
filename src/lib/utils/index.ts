import { randomBytes } from 'crypto';
import { ulid } from 'ulid';
import { ValidationError } from '../errors';

/**
 * Generates an external-facing, lexicographically sortable unique identifier (ULID).
 */
export function generateId(): string {
  return ulid();
}

/**
 * Generates a cryptographically secure random token in hexadecimal format.
 *
 * @param length - Number of random bytes to generate (default 32 bytes -> 64 hex characters)
 */
export function generateSecureToken(length = 32): string {
  if (typeof length !== 'number' || length <= 0 || !Number.isInteger(length)) {
    throw new ValidationError('Token byte length must be a positive integer');
  }
  return randomBytes(length).toString('hex');
}

/**
 * Converts a text string into an SEO-friendly, URL-safe slug.
 *
 * @param text - The raw string to slugify
 */
export function slugify(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Strips script tags, style tags, dangerous event handlers, and javascript: URLs.
 * Suitable for basic server-side sanitization without an active DOM tree.
 *
 * TODO: Use jsdom + DOMPurify or isomorphic-dompurify for more thorough server-side DOM sanitization.
 *
 * @param html - Raw input HTML string
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') {
    return '';
  }

  return (
    html
      // Remove <script> tags and contents
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove <style> tags and contents
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove <iframe>, <object>, <embed>, <applet> tags and contents
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
      // Strip on* inline event handler attributes (e.g., onclick="...", onload=...)
      .replace(/\s*on[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s*on[a-z]+\s*=\s*[^>\s]+/gi, '')
      // Strip javascript: URLs in href/src
      .replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1="#"')
      .replace(/(href|src)\s*=\s*javascript:[^>\s]+/gi, '$1="#"')
      // Strip data: text/html URLs
      .replace(/(href|src)\s*=\s*(['"])\s*data:text\/html[^'"]*\2/gi, '$1="#"')
  );
}

/**
 * Escapes CSV values to protect against CSV formula injection (CSV Injection / DDE).
 * If the value starts with =, +, -, @, \t, or \r, prefixes it with a tab character.
 * Also escapes quotes and wraps in quotes if containing delimiters.
 *
 * @param value - Cell value to escape
 */
export function csvEscape(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  let sanitized = value;

  // Protect against spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = `\t${sanitized}`;
  }

  // Escape standard CSV characters: quotes, commas, newlines
  if (/[",\n\r]/.test(sanitized)) {
    sanitized = `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

/**
 * Restricts a number to be within the specified minimum and maximum bounds.
 *
 * @param value - Value to clamp
 * @param min - Lower bound
 * @param max - Upper bound
 */
export function clamp(value: number, min: number, max: number): number {
  if (
    typeof value !== 'number' ||
    typeof min !== 'number' ||
    typeof max !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    throw new ValidationError('All arguments to clamp must be finite numbers');
  }

  if (min > max) {
    throw new ValidationError(
      `Clamp minimum (${min}) cannot exceed maximum (${max})`
    );
  }

  return Math.min(Math.max(value, min), max);
}

/**
 * Returns a new object excluding the specified keys.
 *
 * @param obj - Source object
 * @param keys - Array of keys to omit
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * Returns a new object with only the specified keys.
 *
 * @param obj - Source object
 * @param keys - Array of keys to pick
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}
