'use client';

import * as React from 'react';
import {
  Save,
  Store,
  Globe,
  Mail,
  Phone,
  Truck,
  Bell,
  Share2,
  Upload,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface StoreSettingsData {
  storeName: string;
  currency: string;
  timezone: string;
  locale: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTwitter: string;
  socialYoutube: string;
  socialWhatsapp: string;
  announcementText: string;
  announcementActive: boolean;
  deliveryFeeDefault: number; // minor units
  freeDeliveryThreshold: number | null; // minor units
  logoAssetId?: string;
  faviconAssetId?: string;
}

export default function StoreSettingsPage() {
  const [settings, setSettings] = React.useState<StoreSettingsData>({
    storeName: 'My Brand Store',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    contactEmail: 'support@mybrand.com',
    contactPhone: '+91 98765 43210',
    address: '101 Startup Hub, Bengaluru, India',
    socialFacebook: 'https://facebook.com/mybrand',
    socialInstagram: 'https://instagram.com/mybrand',
    socialTwitter: 'https://x.com/mybrand',
    socialYoutube: '',
    socialWhatsapp: '+919876543210',
    announcementText: 'Grand opening offer: 20% off all orders with code BOSS20!',
    announcementActive: true,
    deliveryFeeDefault: 5000, // ₹50.00
    freeDeliveryThreshold: 49900, // ₹499.00
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = React.useState('');

  React.useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/v1/admin/settings');
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) {
            setSettings((prev) => ({
              ...prev,
              ...body.data,
              socialFacebook: body.data.socialFacebook ?? '',
              socialInstagram: body.data.socialInstagram ?? '',
              socialTwitter: body.data.socialTwitter ?? '',
              socialYoutube: body.data.socialYoutube ?? '',
              socialWhatsapp: body.data.socialWhatsapp ?? '',
              contactEmail: body.data.contactEmail ?? '',
              contactPhone: body.data.contactPhone ?? '',
              address: body.data.address ?? '',
              announcementText: body.data.announcementText ?? '',
            }));
          }
        }
      } catch (err) {
        console.warn('Using default store settings in preview mode', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setStatusMessage('');

    try {
      const res = await fetch('/api/v1/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const body = await res.json();
      if (res.ok && body.success) {
        setSaveStatus('saved');
        setStatusMessage('Store settings saved successfully!');
        setTimeout(() => setSaveStatus('idle'), 3500);
      } else {
        setSaveStatus('error');
        setStatusMessage(body.error?.message || 'Failed to save store settings.');
      }
    } catch (err: unknown) {
      setSaveStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Network error saving settings.');
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Store Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your store identity, currency, shipping rules, and contact information.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === 'saving' || isLoading}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {saveStatus === 'saved' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 text-green-800 border border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium">{statusMessage}</p>
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm font-medium">{statusMessage}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Store Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <CardTitle>General Information</CardTitle>
            </div>
            <CardDescription>Basic business identifiers seen across invoices and storefront.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Store Name</label>
                <Input
                  value={settings.storeName}
                  onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                  placeholder="e.g. My Premium Apparel"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Store Currency</label>
                <Input
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value.toUpperCase() })}
                  maxLength={3}
                  placeholder="INR, USD, EUR"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Timezone</label>
                <Input
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  placeholder="Asia/Kolkata"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Locale</label>
                <Input
                  value={settings.locale}
                  onChange={(e) => setSettings({ ...settings, locale: e.target.value })}
                  placeholder="en-IN"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media & Brand Assets */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle>Branding & Media</CardTitle>
            </div>
            <CardDescription>Store logo and favicon graphics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 bg-muted/20">
                <div className="p-3 bg-muted rounded-full">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Store Logo</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP, or SVG up to 10MB</p>
                </div>
                <Button type="button" variant="outline" size="sm">
                  Upload Logo
                </Button>
              </div>

              <div className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 bg-muted/20">
                <div className="p-3 bg-muted rounded-full">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Store Favicon</p>
                  <p className="text-xs text-muted-foreground mt-1">32x32px or 64x64px ICO, PNG, or SVG</p>
                </div>
                <Button type="button" variant="outline" size="sm">
                  Upload Favicon
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Contact Details</CardTitle>
            </div>
            <CardDescription>Customer support contact points displayed on storefront.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Support Email</label>
                <Input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  placeholder="support@domain.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Contact Phone</label>
                <Input
                  value={settings.contactPhone}
                  onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Physical Business Address</label>
              <Input
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Full address for storefront policies and invoices"
              />
            </div>
          </CardContent>
        </Card>

        {/* Shipping & Delivery Fees */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <CardTitle>Delivery & Shipping Rules</CardTitle>
            </div>
            <CardDescription>Default shipping rates and free delivery threshold in minor currency units.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Default Delivery Fee (Minor units, e.g. 5000 = ₹50.00)
                </label>
                <Input
                  type="number"
                  value={settings.deliveryFeeDefault}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      deliveryFeeDefault: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  min={0}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Free Delivery Threshold (Minor units, e.g. 49900 = ₹499.00)
                </label>
                <Input
                  type="number"
                  value={settings.freeDeliveryThreshold ?? ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      freeDeliveryThreshold: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  min={0}
                  placeholder="Optional"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Announcement Bar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>Store Announcement Bar</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {settings.announcementActive ? 'Enabled' : 'Disabled'}
                </span>
                <Switch
                  checked={settings.announcementActive}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, announcementActive: checked })
                  }
                />
              </div>
            </div>
            <CardDescription>Highlighted message banner at the very top of your storefront.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Announcement Message</label>
              <Input
                value={settings.announcementText}
                onChange={(e) => setSettings({ ...settings, announcementText: e.target.value })}
                placeholder="e.g. Free shipping on all prepaid orders this weekend!"
              />
            </div>
          </CardContent>
        </Card>

        {/* Social Media Links */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              <CardTitle>Social Media Links</CardTitle>
            </div>
            <CardDescription>Social platform profiles linked from your header and footer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Instagram URL</label>
                <Input
                  value={settings.socialInstagram}
                  onChange={(e) => setSettings({ ...settings, socialInstagram: e.target.value })}
                  placeholder="https://instagram.com/username"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Facebook URL</label>
                <Input
                  value={settings.socialFacebook}
                  onChange={(e) => setSettings({ ...settings, socialFacebook: e.target.value })}
                  placeholder="https://facebook.com/page"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">X / Twitter URL</label>
                <Input
                  value={settings.socialTwitter}
                  onChange={(e) => setSettings({ ...settings, socialTwitter: e.target.value })}
                  placeholder="https://x.com/handle"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">YouTube Channel URL</label>
                <Input
                  value={settings.socialYoutube}
                  onChange={(e) => setSettings({ ...settings, socialYoutube: e.target.value })}
                  placeholder="https://youtube.com/@channel"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

