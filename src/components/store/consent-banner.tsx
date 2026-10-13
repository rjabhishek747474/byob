'use client';

import * as React from 'react';
import {
  getOrCreateVisitorId,
  getStoredConsent,
  setStoredConsent,
  trackEvent,
  ConsentPreferences,
} from '@/lib/analytics/tracker';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, Cookie, Settings2 } from 'lucide-react';

const POLICY_VERSION = 'v1.0';

export function ConsentBanner() {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [customizing, setCustomizing] = React.useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      const existing = getStoredConsent();
      if (!existing) {
        setVisible(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || !visible) {
    return null;
  }

  const handleSaveConsent = async (analytics: boolean, marketing = false) => {
    const preferences: ConsentPreferences = {
      necessary: true,
      analytics,
      marketing,
      policyVersion: POLICY_VERSION,
      updatedAt: new Date().toISOString(),
    };

    setStoredConsent(preferences);
    setVisible(false);

    const categoriesGranted: string[] = ['necessary'];
    if (analytics) categoriesGranted.push('analytics');
    if (marketing) categoriesGranted.push('marketing');

    // Dispatch consent update telemetry
    trackEvent('consent_updated', {
      necessary: true,
      analytics,
      marketing,
      policyVersion: POLICY_VERSION,
    });

    // Record consent to backend
    try {
      const visitorId = getOrCreateVisitorId();
      await fetch('/api/v1/analytics/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visitorId,
          policyVersion: POLICY_VERSION,
          categoriesGranted,
        }),
      });
    } catch {
      // Ignore background consent recording failure
    }
  };

  const handleAcceptAll = () => {
    void handleSaveConsent(true, true);
  };

  const handleRejectNonEssential = () => {
    void handleSaveConsent(false, false);
  };

  const handleSaveCustom = () => {
    void handleSaveConsent(analyticsEnabled, false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Privacy and Cookie Consent"
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3 max-w-2xl">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-0.5">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <span>Your Privacy Choices</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600 inline" />
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              We respect your right to privacy. We only use strictly necessary cookies to operate
              our store, and optional privacy-conscious behavioral telemetry to understand product
              journeys without ever storing personal identifiers.
            </p>
          </div>
        </div>

        {!customizing ? (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomizing(true)}
              className="text-xs flex items-center gap-1.5"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Customize
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRejectNonEssential}
              className="text-xs"
            >
              Reject Non-Essential
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleAcceptAll}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              Accept All
            </Button>
          </div>
        ) : (
          <div className="w-full md:w-auto flex flex-col gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-xs font-medium text-gray-900">Necessary Cookies</p>
                <p className="text-[11px] text-gray-500">Essential for cart & checkout</p>
              </div>
              <Switch checked disabled aria-readonly />
            </div>

            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-xs font-medium text-gray-900">Analytics Telemetry</p>
                <p className="text-[11px] text-gray-500">Anonymous funnel and browse insights</p>
              </div>
              <Switch
                checked={analyticsEnabled}
                onCheckedChange={(checked) => setAnalyticsEnabled(checked)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-gray-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomizing(false)}
                className="text-xs"
              >
                Back
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveCustom}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
