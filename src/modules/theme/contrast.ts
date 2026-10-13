import { ContrastEvaluation, ThemeColors, ThemeContrastReport } from './types';

/**
 * Parses hex or rgb/rgba color string into [r, g, b] integer components (0-255).
 */
export function parseColor(color: string): [number, number, number] {
  const trimmed = color.trim().toLowerCase();

  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
  }

  if (trimmed.startsWith('rgb')) {
    const match = trimmed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    }
  }

  return [0, 0, 0];
}

/**
 * Calculates relative luminance for an sRGB component per WCAG 2.1 specifications.
 */
function getChannelLuminance(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/**
 * Calculates relative luminance of an RGB color per WCAG 2.1.
 */
export function getRelativeLuminance(color: string): number {
  const [r, g, b] = parseColor(color);
  const R = getChannelLuminance(r);
  const G = getChannelLuminance(g);
  const B = getChannelLuminance(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculates contrast ratio between two colors per WCAG 2.1.
 * Ratio formula: (L1 + 0.05) / (L2 + 0.05), where L1 is the lighter color.
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

/**
 * Evaluates contrast ratio compliance according to WCAG 2.1 AA/AAA thresholds.
 */
export function evaluateContrast(
  foreground: string,
  background: string,
  label: string
): ContrastEvaluation {
  const ratio = getContrastRatio(foreground, background);
  const isCompliantBody = ratio >= 4.5;
  const isCompliantLarge = ratio >= 3.0;

  let score: 'AAA' | 'AA' | 'fail' = 'fail';
  if (ratio >= 7.0) {
    score = 'AAA';
  } else if (ratio >= 4.5) {
    score = 'AA';
  }

  let warning: string | undefined;
  if (!isCompliantBody) {
    if (!isCompliantLarge) {
      warning = `Insufficient contrast (${ratio}:1) for ${label}. Fails minimum 3:1 ratio for large text and 4.5:1 for body text.`;
    } else {
      warning = `Contrast (${ratio}:1) for ${label} meets large text requirement (3:1) but fails body text requirement (4.5:1).`;
    }
  }

  return {
    ratio,
    score,
    isCompliantBody,
    isCompliantLarge,
    warning,
  };
}

/**
 * Evaluates contrast between background & text, and primary & surface/background.
 */
export function evaluateThemeContrast(colors: ThemeColors): ThemeContrastReport {
  const warnings: string[] = [];

  const bodyTextContrast = evaluateContrast(
    colors.text,
    colors.background,
    'body text on background'
  );
  if (bodyTextContrast.warning) {
    warnings.push(bodyTextContrast.warning);
  }

  // Primary text / button foreground relative to primary color
  // Contrast between primary color and white/dark text or surface
  const primaryContrast = evaluateContrast(
    '#ffffff',
    colors.primary,
    'white foreground on primary color'
  );
  if (primaryContrast.warning) {
    warnings.push(primaryContrast.warning);
  }

  return {
    bodyTextContrast,
    primaryContrast,
    warnings,
  };
}

