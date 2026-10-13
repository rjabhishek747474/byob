import { clsx, type ClassValue } from 'clsx';

/**
 * Merges class names using clsx.
 *
 * @param inputs - Class names, conditional objects, or arrays of classes.
 * @returns Combined class name string.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
