'use client';

import * as React from 'react';
import {
  Palette,
  Type,
  Layout,
  Upload,
  Download,
  Send,
  Eye,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DEFAULT_THEME_CONFIG,
  ThemeConfig,
  ThemeContrastReport,
  ALLOWED_FONTS,
} from '@/modules/theme/types';
import { evaluateThemeContrast } from '@/modules/theme/contrast';

export default function ThemeEditorPage() {
  const [theme, setTheme] = React.useState<ThemeConfig>(DEFAULT_THEME_CONFIG);
  const [publishedVersion, setPublishedVersion] = React.useState<number>(1);
  const [publishedAt, setPublishedAt] = React.useState<string | null>(null);
  const contrastReport = React.useMemo(
    () => evaluateThemeContrast(theme.colors),
    [theme.colors]
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load existing tenant theme
  React.useEffect(() => {
    async function fetchTheme() {
      try {
        const res = await fetch('/api/v1/admin/theme');
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) {
            setTheme(body.data.draftConfig);
            setPublishedVersion(body.data.version);
            setPublishedAt(body.data.publishedAt);
          }
        }
      } catch (err) {
        console.warn('Running theme editor in standalone preview mode', err);
      }
    }
    fetchTheme();
  }, []);

  const handleColorChange = (key: keyof ThemeConfig['colors'], value: string) => {
    setTheme((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: value,
      },
    }));
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/v1/admin/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setStatusMessage({ type: 'success', text: 'Theme draft saved successfully!' });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage({ type: 'error', text: body.error?.message || 'Failed to save theme draft.' });
      }
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Network error.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setStatusMessage(null);
    try {
      // Save draft first
      await fetch('/api/v1/admin/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme),
      });

      const res = await fetch('/api/v1/admin/theme/publish', {
        method: 'POST',
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setPublishedVersion(body.data.version);
        setPublishedAt(body.data.publishedAt);
        setStatusMessage({
          type: 'success',
          text: `Theme published live! (v${body.data.version})`,
        });
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        setStatusMessage({ type: 'error', text: body.error?.message || 'Failed to publish theme.' });
      }
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Publish error.' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExport = () => {
    const exportData = {
      version: publishedVersion,
      exportedAt: new Date().toISOString(),
      theme,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `byob-theme-v${publishedVersion}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const importedTheme = parsed.theme || parsed;

        const res = await fetch('/api/v1/admin/theme/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(importedTheme),
        });
        const body = await res.json();
        if (res.ok && body.success) {
          setTheme(body.data.draftConfig);
          setStatusMessage({ type: 'success', text: 'Theme imported and applied to draft!' });
          setTimeout(() => setStatusMessage(null), 3000);
        } else {
          setStatusMessage({ type: 'error', text: body.error?.message || 'Invalid theme configuration.' });
        }
      } catch (err) {
        setStatusMessage({ type: 'error', text: 'Failed to parse JSON theme file.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header with actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Theme Engine</h1>
            <Badge variant="outline" className="text-xs">
              Live: v{publishedVersion}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Customize typography, color palettes, and layout aesthetics with real-time WCAG accessibility checks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            <Button variant="outline" size="sm" type="button" className="flex items-center gap-1.5">
              <Upload className="h-4 w-4" />
              Import
            </Button>
          </label>

          <Button variant="outline" size="sm" onClick={handleExport} type="button" className="flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSaving}
            type="button"
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>

          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isPublishing}
            type="button"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
            {isPublishing ? 'Publishing...' : 'Publish Theme'}
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            statusMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          )}
          <p className="text-sm font-medium">{statusMessage.text}</p>
        </div>
      )}

      {/* WCAG Accessibility Warnings Banner */}
      {contrastReport.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">WCAG 2.1 Contrast Warnings Detected</h4>
              <ul className="text-xs list-disc list-inside space-y-0.5 text-amber-800">
                {contrastReport.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Editor Controls (7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Color Tokens */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Color Palette</CardTitle>
              </div>
              <CardDescription>Brand identity colors, backgrounds, and functional UI tokens.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.keys(theme.colors) as Array<keyof ThemeConfig['colors']>).map((colorKey) => (
                  <div key={colorKey} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                    <div>
                      <span className="text-xs font-semibold capitalize text-foreground">{colorKey}</span>
                      <p className="text-xs text-muted-foreground font-mono">{theme.colors[colorKey]}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.colors[colorKey].startsWith('#') ? theme.colors[colorKey].slice(0, 7) : '#000000'}
                        onChange={(e) => handleColorChange(colorKey, e.target.value)}
                        className="h-8 w-8 rounded cursor-pointer border border-border"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Typography Tokens */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Type className="h-5 w-5 text-primary" />
                <CardTitle>Typography</CardTitle>
              </div>
              <CardDescription>Curated web safe and Google Fonts with strict allowlist enforcement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Heading Font</label>
                  <select
                    value={theme.typography.headingFont}
                    onChange={(e) =>
                      setTheme({
                        ...theme,
                        typography: {
                          ...theme.typography,
                          headingFont: e.target.value as ThemeConfig['typography']['headingFont'],
                        },
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {ALLOWED_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Body Font</label>
                  <select
                    value={theme.typography.bodyFont}
                    onChange={(e) =>
                      setTheme({
                        ...theme,
                        typography: {
                          ...theme.typography,
                          bodyFont: e.target.value as ThemeConfig['typography']['bodyFont'],
                        },
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {ALLOWED_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Base Font Size</label>
                  <select
                    value={theme.typography.baseFontSize}
                    onChange={(e) =>
                      setTheme({
                        ...theme,
                        typography: {
                          ...theme.typography,
                          baseFontSize: e.target.value as '14px' | '16px' | '18px',
                        },
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="14px">Compact (14px)</option>
                    <option value="16px">Standard (16px)</option>
                    <option value="18px">Large (18px)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Heading Weight</label>
                  <select
                    value={theme.typography.headingWeight}
                    onChange={(e) =>
                      setTheme({
                        ...theme,
                        typography: {
                          ...theme.typography,
                          headingWeight: e.target.value as '500' | '600' | '700' | '800',
                        },
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="500">Medium (500)</option>
                    <option value="600">Semibold (600)</option>
                    <option value="700">Bold (700)</option>
                    <option value="800">Extrabold (800)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Layout Tokens */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Layout className="h-5 w-5 text-primary" />
                <CardTitle>Layout & Styling Geometry</CardTitle>
              </div>
              <CardDescription>Container sizing, corner roundness, and spacing densities.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Max Container Width</label>
                  <select
                    value={theme.layout.containerWidth}
                    onChange={(e) =>
                      setTheme({
                        ...theme,
                        layout: {
                          ...theme.layout,
                          containerWidth: e.target.value as ThemeConfig['layout']['containerWidth'],
                        },
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="sm">Small (640px)</option>
                    <option value="md">Medium (768px)</option>
                    <option value="lg">Large (1024px)</option>
                    <option value="xl">Extra Large (1280px)</option>
                    <option value="full">Full Width</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Border Radius</label>
                  <select
                    value={theme.layout.borderRadius}
                    onChange={(e) =>
                      setTheme({
                        ...theme,
                        layout: {
                          ...theme.layout,
                          borderRadius: e.target.value as ThemeConfig['layout']['borderRadius'],
                        },
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="none">Sharp (0px)</option>
                    <option value="sm">Subtle (4px)</option>
                    <option value="md">Rounded (8px)</option>
                    <option value="lg">Pill (16px)</option>
                    <option value="full">Full Circle</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Spacing Scale</label>
                  <select
                    value={theme.layout.spacingScale}
                    onChange={(e) =>
                      setTheme({
                        ...theme,
                        layout: {
                          ...theme.layout,
                          spacingScale: e.target.value as ThemeConfig['layout']['spacingScale'],
                        },
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Storefront Preview (5 columns) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Live Preview</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    Contrast: {contrastReport.bodyTextContrast.ratio}:1 ({contrastReport.bodyTextContrast.score})
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Simulated storefront card rendering */}
              <div
                style={{
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontFamily: theme.typography.bodyFont,
                  borderColor: theme.colors.border,
                }}
                className="rounded-xl border p-5 shadow-sm space-y-4"
              >
                {/* Storefront banner simulation */}
                <div
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  }}
                  className="p-3 rounded-lg border flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{ backgroundColor: theme.colors.primary }}
                      className="h-3 w-3 rounded-full"
                    />
                    <span
                      style={{
                        fontFamily: theme.typography.headingFont,
                        fontWeight: Number(theme.typography.headingWeight),
                      }}
                      className="text-xs uppercase tracking-wider"
                    >
                      Brand Storefront
                    </span>
                  </div>
                  <span
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: '#ffffff',
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                  >
                    Sale
                  </span>
                </div>

                {/* Hero preview text */}
                <div className="space-y-1.5">
                  <h3
                    style={{
                      fontFamily: theme.typography.headingFont,
                      fontWeight: Number(theme.typography.headingWeight),
                      fontSize: '1.25rem',
                      lineHeight: '1.3',
                      color: theme.colors.text,
                    }}
                  >
                    Summer Artisan Collection
                  </h3>
                  <p
                    style={{
                      fontSize: theme.typography.baseFontSize,
                      color: theme.colors.mutedText,
                    }}
                  >
                    Hand-crafted minimalism designed for modern entrepreneurs and creators.
                  </p>
                </div>

                {/* Interactive elements */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    style={{
                      backgroundColor: theme.colors.primary,
                      color: '#ffffff',
                      borderRadius:
                        theme.layout.borderRadius === 'none'
                          ? '0px'
                          : theme.layout.borderRadius === 'sm'
                            ? '4px'
                            : theme.layout.borderRadius === 'md'
                              ? '8px'
                              : theme.layout.borderRadius === 'lg'
                                ? '16px'
                                : '9999px',
                    }}
                    className="px-4 py-2 text-xs font-semibold shadow-sm transition hover:opacity-95"
                  >
                    Shop Now
                  </button>

                  <button
                    type="button"
                    style={{
                      backgroundColor: theme.colors.secondary,
                      color: '#ffffff',
                      borderRadius:
                        theme.layout.borderRadius === 'none'
                          ? '0px'
                          : theme.layout.borderRadius === 'sm'
                            ? '4px'
                            : theme.layout.borderRadius === 'md'
                              ? '8px'
                              : theme.layout.borderRadius === 'lg'
                                ? '16px'
                                : '9999px',
                    }}
                    className="px-4 py-2 text-xs font-semibold shadow-sm transition hover:opacity-95"
                  >
                    Explore Lookbook
                  </button>
                </div>

                {/* Badge tags simulation */}
                <div className="pt-2 border-t flex items-center justify-between text-xs" style={{ borderColor: theme.colors.border }}>
                  <span style={{ color: theme.colors.mutedText }}>Free delivery over ₹499</span>
                  <span style={{ color: theme.colors.success }} className="font-semibold">
                    In Stock (45 items)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

