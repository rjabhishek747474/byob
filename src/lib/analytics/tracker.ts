import { ulid } from 'ulid';
import {
  AnalyticsEventEnvelope,
  AnalyticsEventName,
  ConsentCategory,
  ESSENTIAL_OPERATIONAL_EVENTS,
  validateEventProperties,
} from '@/modules/analytics/types';

const STORAGE_KEY_CONSENT = 'byob_consent_preferences';
const STORAGE_KEY_SESSION_ID = 'byob_analytics_session_id';
const STORAGE_KEY_VISITOR_ID = 'byob_analytics_visitor_id';
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const STORAGE_KEY_SESSION_LAST_ACTIVE = 'byob_analytics_last_active';

export interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  policyVersion: string;
  updatedAt: string;
}

/**
 * Retrieves stored consent preferences from browser localStorage.
 */
export function getStoredConsent(): ConsentPreferences | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CONSENT);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentPreferences;
  } catch {
    return null;
  }
}

/**
 * Persists consent preferences into localStorage.
 */
export function setStoredConsent(preferences: ConsentPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_CONSENT, JSON.stringify(preferences));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Resolves or initializes pseudonymous visitor ID (persists across sessions).
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') {
    return ulid();
  }
  try {
    let vid = window.localStorage.getItem(STORAGE_KEY_VISITOR_ID);
    if (!vid) {
      vid = ulid();
      window.localStorage.setItem(STORAGE_KEY_VISITOR_ID, vid);
    }
    return vid;
  } catch {
    return ulid();
  }
}

/**
 * Resolves or initializes session ID (resets after 30 minutes of inactivity).
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return ulid();
  }
  try {
    const now = Date.now();
    const lastActive = parseInt(
      window.sessionStorage.getItem(STORAGE_KEY_SESSION_LAST_ACTIVE) || '0',
      10
    );
    let sid = window.sessionStorage.getItem(STORAGE_KEY_SESSION_ID);

    if (!sid || now - lastActive > SESSION_EXPIRY_MS) {
      sid = ulid();
      window.sessionStorage.setItem(STORAGE_KEY_SESSION_ID, sid);
    }

    window.sessionStorage.setItem(STORAGE_KEY_SESSION_LAST_ACTIVE, now.toString());
    return sid;
  } catch {
    return ulid();
  }
}

/**
 * Event buffer for batching
 */
const eventBuffer: AnalyticsEventEnvelope[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 2000;
const MAX_BUFFER_SIZE = 15;

/**
 * Flushes accumulated events to the server.
 */
export async function flushEvents(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (eventBuffer.length === 0) {
    return;
  }

  const batch = eventBuffer.splice(0, eventBuffer.length);
  const payload = JSON.stringify({ events: batch });
  const endpoint = '/api/v1/analytics/events';

  // Prefer navigator.sendBeacon during page unload / background
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (sent) return;
    } catch {
      // Fallback to fetch
    }
  }

  if (typeof fetch !== 'undefined') {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
        keepalive: true,
      });
    } catch (err) {
      // Do not crash application on analytics drop
      console.warn('Analytics event dispatch failed:', err);
    }
  }
}

/**
 * Helper to generate standard UUID v4 for deduplication.
 */
function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Dispatches a behavioral telemetry event if consent permits.
 *
 * @param eventName - One of the 21 strictly defined event taxonomy names
 * @param properties - Event payload properties (must strictly adhere to Anti-PII rules)
 */
export function trackEvent(
  eventName: AnalyticsEventName,
  properties: Record<string, unknown> = {}
): void {
  if (typeof window === 'undefined') {
    return;
  }

  // 1. Validate properties against Anti-PII & allowlist
  const validation = validateEventProperties(eventName, properties);
  if (!validation.valid) {
    console.warn(`[BYOB Analytics] Event dropped due to validation error: ${validation.error}`);
    return;
  }

  // 2. Check consent preferences
  const consent = getStoredConsent();
  const consentCategories: ConsentCategory[] = ['necessary'];

  if (consent?.analytics) {
    consentCategories.push('analytics');
  }
  if (consent?.marketing) {
    consentCategories.push('marketing');
  }

  const isAnalyticsAllowed = consent?.analytics === true;
  const isEssentialEvent = ESSENTIAL_OPERATIONAL_EVENTS.includes(eventName);

  if (!isAnalyticsAllowed && !isEssentialEvent) {
    // Drop event silently if user withheld consent
    return;
  }

  const envelope: AnalyticsEventEnvelope = {
    schemaVersion: 1,
    eventId: generateUUIDv4(),
    eventName,
    occurredAt: new Date().toISOString(),
    sessionId: getOrCreateSessionId(),
    visitorId: getOrCreateVisitorId(),
    path: window.location.pathname || '/',
    consentCategories,
    properties,
  };

  eventBuffer.push(envelope);

  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    void flushEvents();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      void flushEvents();
    }, FLUSH_INTERVAL_MS);
  }
}

// Auto-flush on page unload / hide
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushEvents();
    }
  });
  window.addEventListener('pagehide', () => {
    void flushEvents();
  });
}
