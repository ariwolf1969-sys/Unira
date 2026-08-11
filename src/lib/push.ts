/**
 * Server-side push notification utility using Firebase Cloud Messaging (FCM) HTTP v1.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT env var with the JSON content of the
 * Firebase Admin SDK service account key (from Google Cloud Console).
 *
 * When FIREBASE_SERVICE_ACCOUNT is set, uses the FCM v1 endpoint with
 * OAuth2 access tokens signed from the service account's private key.
 * Otherwise logs to console (dev mode).
 */

const FIREBASE_PROJECT_ID = 'cooperativa-unira';

// Parse service account from env (JSON string)
let serviceAccount: {
  client_email?: string;
  private_key?: string;
  project_id?: string;
} | null = null;

try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    serviceAccount = JSON.parse(raw);
  }
} catch {
  console.error('[push] Failed to parse FIREBASE_SERVICE_ACCOUNT');
}

export interface PushPayload {
  token: string;           // FCM device registration token
  title: string;
  body: string;
  data?: Record<string, string>;
  tag?: string;
}

// ─── OAuth2: get access token from service account ──────────────────────────

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) return null;

  // Return cached token if still valid
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const signatureInput = `${header}.${payload}`;

    // Sign with the private key using Node.js crypto
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(serviceAccount.private_key, 'base64url');

    const jwt = `${signatureInput}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const data = await res.json();
    if (data.access_token) {
      cachedToken = {
        value: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000, // Refresh 60s early
      };
      return data.access_token;
    }
    console.error('[push] OAuth token error:', JSON.stringify(data));
    return null;
  } catch (e) {
    console.error('[push] getAccessToken error:', e);
    return null;
  }
}

// ─── Send notification via FCM v1 ──────────────────────────────────────────

export async function sendPushNotification(payload: PushPayload): Promise<{ success: boolean; error?: string }> {
  const { token, title, body, data, tag } = payload;

  // Dev mode: no service account configured
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔔 [DEV MODE] Push notification (no FIREBASE_SERVICE_ACCOUNT)');
    console.log(`   Token: ${token.slice(0, 20)}...`);
    console.log(`   Title: ${title}`);
    console.log(`   Body:  ${body}`);
    if (data) console.log(`   Data:  ${JSON.stringify(data)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return { success: true };
  }

  // Get OAuth2 access token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'No se pudo obtener token OAuth2' };
  }

  // Build FCM v1 payload
  const fcmPayload: any = {
    message: {
      token,
      notification: {
        title,
        body,
      },
      data: data ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ) : {},
      webpush: {
        notification: {
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          vibrate: [200, 100, 200],
          tag: tag || 'unira-notification',
        },
        fcm_options: {
          link: data?.url || 'https://unira.vercel.app',
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          default_sound: true,
          channel_id: 'unira_trips',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    },
  };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      }
    );

    const result = await res.json();

    if (!res.ok) {
      console.error('FCM v1 error:', res.status, JSON.stringify(result));
      const errorMsg = result.error?.message || `FCM ${res.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (e) {
    console.error('sendPushNotification error:', e);
    return { success: false, error: 'No se pudo conectar con FCM.' };
  }
}

/**
 * Send push to multiple tokens at once.
 */
export async function sendPushBulk(payloads: PushPayload[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    payloads.map((p) => sendPushNotification(p))
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.success) sent++;
    else failed++;
  }

  return { sent, failed };
}

/**
 * Notify a driver about a new trip request.
 */
export async function notifyDriverNewTrip(driverToken: string, tripInfo: {
  tripId: string;
  pickup: string;
  destination: string;
  fare: number;
}) {
  return sendPushNotification({
    token: driverToken,
    title: '🎯 Nuevo viaje disponible',
    body: `${tripInfo.pickup} → ${tripInfo.destination}`,
    tag: `trip-${tripInfo.tripId}`,
    data: {
      type: 'new_trip',
      tripId: tripInfo.tripId,
      fare: String(tripInfo.fare),
    },
  });
}

/**
 * Notify a passenger that a driver accepted their trip.
 */
export async function notifyPassengerTripAccepted(passengerToken: string, tripInfo: {
  tripId: string;
  driverName: string;
  vehicle: string;
  plate: string;
  eta: string;
}) {
  return sendPushNotification({
    token: passengerToken,
    title: '🚗 ¡Conductor encontrado!',
    body: `${tripInfo.driverName} (${tripInfo.plate}) llega en ${tripInfo.eta}`,
    tag: `trip-${tripInfo.tripId}`,
    data: {
      type: 'trip_accepted',
      tripId: tripInfo.tripId,
      url: 'https://unira.vercel.app',
    },
  });
}
