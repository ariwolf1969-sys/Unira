'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';

// Client-side analytics hook
// Respects cookie consent — only sends if user accepted analytics cookies

interface AnalyticsEvent {
  event: string;
  screen?: string;
  metadata?: Record<string, string | number>;
}

export function useAnalytics() {
  const userId = useAppStore((s) => s.user?.uid);
  const currentScreen = useAppStore((s) => s.currentScreen);
  const hasConsent = useRef(false);

  // Check cookie consent on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('teyevo_cookie_consent');
      if (raw) {
        const parsed = JSON.parse(raw);
        hasConsent.current = parsed.accepted && parsed.analytics;
      }
    } catch { /* ignore */ }
  }, []);

  // Track screen views
  useEffect(() => {
    if (!hasConsent.current || !currentScreen) return;
    trackEvent({
      event: 'screen_view',
      screen: currentScreen,
    });
  }, [currentScreen]);

  const trackEvent = useCallback(
    ({ event, screen, metadata }: AnalyticsEvent) => {
      if (!hasConsent.current) return;

      // Fire-and-forget — don't block UI
      fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cookie-consent': 'true',
        },
        body: JSON.stringify({
          event,
          userId: userId || undefined,
          screen: screen || currentScreen,
          metadata,
        }),
      }).catch(() => { /* silent */ });
    },
    [userId, currentScreen]
  );

  return { trackEvent };
}
