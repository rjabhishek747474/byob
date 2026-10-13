import { z } from 'zod/v4';

export const ALLOWED_FONTS = [
  'Inter',
  'Roboto',
  'Playfair Display',
  'Poppins',
  'Montserrat',
  'Plus Jakarta Sans',
] as const;

export type AllowedFont = (typeof ALLOWED_FONTS)[number];

const hexOrRgbRegex = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\))$/;

export const colorTokenSchema = z
  .string()
  .regex(hexOrRgbRegex, 'Must be a valid hex or rgb color string');

export const themeColorsSchema = z.object({
  primary: colorTokenSchema,
  secondary: colorTokenSchema,
  accent: colorTokenSchema,
  background: colorTokenSchema,
  surface: colorTokenSchema,
  text: colorTokenSchema,
  mutedText: colorTokenSchema,
  border: colorTokenSchema,
  success: colorTokenSchema,
  warning: colorTokenSchema,
  danger: colorTokenSchema,
});

export const themeTypographySchema = z.object({
  headingFont: z.enum(ALLOWED_FONTS),
  bodyFont: z.enum(ALLOWED_FONTS),
  baseFontSize: z.enum(['14px', '16px', '18px']),
  headingWeight: z.enum(['500', '600', '700', '800']),
});

export const themeLayoutSchema = z.object({
  containerWidth: z.enum(['sm', 'md', 'lg', 'xl', 'full']),
  borderRadius: z.enum(['none', 'sm', 'md', 'lg', 'full']),
  spacingScale: z.enum(['compact', 'comfortable', 'spacious']),
});

/**
 * Strict ThemeConfig schema.
 * Rejects any custom CSS, JavaScript, HTML tags, or unapproved fonts.
 */
export const themeConfigSchema = z
  .object({
    colors: themeColorsSchema,
    typography: themeTypographySchema,
    layout: themeLayoutSchema,
  })
  .strict();

export type ThemeColors = z.infer<typeof themeColorsSchema>;
export type ThemeTypography = z.infer<typeof themeTypographySchema>;
export type ThemeLayout = z.infer<typeof themeLayoutSchema>;
export type ThemeConfig = z.infer<typeof themeConfigSchema>;

export interface ContrastEvaluation {
  ratio: number;
  score: 'AAA' | 'AA' | 'fail';
  isCompliantBody: boolean; // >= 4.5
  isCompliantLarge: boolean; // >= 3.0
  warning?: string;
}

export interface ThemeContrastReport {
  bodyTextContrast: ContrastEvaluation;
  primaryContrast: ContrastEvaluation;
  warnings: string[];
}

export interface ThemeDto {
  id: string;
  tenantId: string;
  name: string;
  draftConfig: ThemeConfig;
  publishedConfig: ThemeConfig | null;
  publishedAt: Date | null;
  publishedBy: string | null;
  version: number;
  contrastReport?: ThemeContrastReport;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  colors: {
    primary: '#4f46e5',
    secondary: '#06b6d4',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    mutedText: '#6b7280',
    border: '#e5e7eb',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    baseFontSize: '16px',
    headingWeight: '700',
  },
  layout: {
    containerWidth: 'xl',
    borderRadius: 'md',
    spacingScale: 'comfortable',
  },
};

