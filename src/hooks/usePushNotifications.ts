'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { getMessaging, getToken, onMessage, isSupported, deleteToken } from 'firebase/messaging';
import firebaseApp from '@/lib/firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

/**
 * Hook to manage Firebase Cloud Messaging push notifications.
 * - Requests notification permission
 * - Registers device token with server
 * - Listens for foreground messages → shows toast + adds to notification center
 * - Cleans up token on logout
 */
export function usePushNotifications() {
  const { user, showToast, addNotification } = useAppStore();
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [tokenRegistered, setTokenRegistered] = useState(false);
  const [supported, setSupported] = useState(false);

  // Check if push is supported
  useEffect(() => {
    void isSupported().then((yes) => setSupported(yes));
  }, []);

  // Register device token
  const registerToken = useCallback(async (uid: string) => {
    if (!supported || !('Notification' in window)) return;

    try {
      const messaging = getMessaging(firebaseApp);
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== 'granted') {
        console.log('[push] Notification permission denied');
        return;
      }

      // Get FCM registration token
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY || undefined,
        serviceWorkerRegistration: await navigator.serviceWorker.ready,
      });

      if (!token) {
        console.log('[push] Could not get FCM token');
        return;
      }

      // Register token with our server
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushToken: token }),
      });

      if (res.ok) {
        setTokenRegistered(true);
        console.log('[push] Device token registered');
      }
    } catch (err) {
      console.error('[push] Registration error:', err);
    }
  }, [supported]);

  // Auto-register when user logs in
  useEffect(() => {
    if (user?.uid && user.uid !== 'demo' && supported && !tokenRegistered) {
      void registerToken(user.uid);
    }
  }, [user?.uid, supported, registerToken, tokenRegistered]);

  // Listen for foreground messages → show toast + add to notification center
  useEffect(() => {
    if (!supported) return;

    const messaging = getMessaging(firebaseApp);
    const unsubscribe = onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      const data = payload.data || {};

      if (title) {
        // Show toast to user
        showToast(title, 'info');

        // Add to in-app notification center
        addNotification({
          id: `push-${Date.now()}`,
          title,
          body: body || '',
          type: (data.type as 'trip' | 'promo' | 'payment' | 'system') || 'system',
          read: false,
          date: new Date().toISOString(),
        });

        // If notification has a screen, navigate there
        if (data.screen) {
          const { setCurrentScreen } = useAppStore.getState();
          setCurrentScreen(data.screen);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [supported, showToast, addNotification]);

  // Cleanup token on logout
  const cleanupToken = useCallback(async () => {
    if (!supported || !tokenRegistered) return;
    try {
      const messaging = getMessaging(firebaseApp);
      await deleteToken(messaging);
      // Clear token from server
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushToken: '' }),
      });
      setTokenRegistered(false);
      console.log('[push] Token cleaned up on logout');
    } catch (err) {
      console.error('[push] Cleanup error:', err);
    }
  }, [supported, tokenRegistered]);

  return {
    supported,
    permissionState,
    tokenRegistered,
    registerToken,
    cleanupToken,
    requestPermission: () => {
      if (user?.uid && user.uid !== 'demo') {
        return registerToken(user.uid);
      }
    },
  };
}
