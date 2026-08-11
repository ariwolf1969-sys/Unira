'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { vehicleTypes, getVehicleType, computeDriverPayout, type VehicleType } from '@/lib/places';
import { formatCurrency } from '@/lib/utils';
import {
  Power, PowerOff, MapPin, Star, Clock, DollarSign,
  TrendingUp, Car, ChevronRight, Navigation, Bell,
  ArrowLeft, CheckCircle, AlertCircle, Route, Wallet,
  AlertTriangle, Phone, MessageSquare,
  Calendar, Timer, Users, Route as RouteIcon, X, Eye,
  Sliders, ExternalLink,
} from 'lucide-react';
import { TripChat } from './TripChat';

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

// ─── Sample Data ─────────────────────────────────────────────────────────────

const sampleEarnings = {
  today: 12500,
  week: 78500,
  trips: 14,
  rating: 4.9,
};

const recentDriverTrips = [
  { id: 'dt-1', from: 'Obelisco', to: 'Puerto Madero', fare: 6500, time: 'Hace 30 min', status: 'completed' },
  { id: 'dt-2', from: 'Palermo Soho', to: 'Recoleta Cemetery', fare: 4100, time: 'Hace 1h', status: 'completed' },
  { id: 'dt-3', from: 'Caminito', to: 'San Telmo Market', fare: 3500, time: 'Hace 2h', status: 'completed' },
  { id: 'dt-4', from: 'Teatro Colón', to: 'Abasto Shopping', fare: 5500, time: 'Hace 3h', status: 'completed' },
  { id: 'dt-5', from: 'Estación Retiro', to: 'Dot Baires Shopping', fare: 7800, time: 'Hace 4h', status: 'completed' },
];

// ─── Trip request model (Session 17: multi-destino, 45s timer, stats pasajero) ──
// `capacity` define cuántos destinos puede tener un viaje según el vehículo del conductor.
// El muestreo de requests respeta esa capacidad.

interface TripRequest {
  id: string;
  passengerName: string;
  passengerInitial: string;
  passengerPhoto: string;
  passengerPhone?: string;
  passengerRating: number;       // 0-5
  passengerTripCount: number;    // cantidad de viajes del pasajero
  pickup: string;                // "Buscar al pasajero en"
  destinations: string[];        // 1..capacity destinos
  totalKm: number;
  totalMin: number;
  fare: number;                  // tarifa total que paga el pasajero
  vehicleTypeId: string;         // para calcular payout con la comisión correcta
  createdAt: number;             // timestamp para el countdown
  // Optional: dangerous-zone warnings matched against pickup / destinations.
  // Each entry is "{kind}: {zone name}" — kind is "pickup" | "destino".
  dangerWarnings?: string[];
  // Third party info (viaje para otro)
  thirdParty?: string | null;
  thirdPartyPhoto?: string | null;
}

const TRIP_REQUESTS_POOL: Omit<TripRequest, 'createdAt'>[] = [
  {
    id: 'pr-1',
    passengerName: 'María López',
    passengerInitial: 'M',
    passengerPhoto: '',
    passengerRating: 4.9,
    passengerTripCount: 127,
    pickup: 'Av. Corrientes 1200, Microcentro',
    destinations: [
      'Av. Santa Fe 3500, Palermo',
      'Juncal 2800, Recoleta',
      'Av. Cabildo 1000, Belgrano',
    ],
    totalKm: 11.4,
    totalMin: 32,
    fare: 14900,
    vehicleTypeId: 'auto_4_puertas',
    dangerWarnings: ['pickup: Villa 31 (Retiro)'],
  },
  {
    id: 'pr-2',
    passengerName: 'Carlos Ruiz',
    passengerInitial: 'C',
    passengerPhoto: '',
    passengerRating: 4.7,
    passengerTripCount: 34,
    pickup: 'Av. 9 de Julio 800, San Telmo',
    destinations: [
      'Puerto Madero, CABA',
    ],
    totalKm: 4.1,
    totalMin: 12,
    fare: 7600,
    vehicleTypeId: 'auto_4_puertas',
    dangerWarnings: ['pickup: Villa 21-24 (Barracas)'],
  },
  {
    id: 'pr-3',
    passengerName: 'Familia González',
    passengerInitial: 'F',
    passengerPhoto: '',
    passengerRating: 5.0,
    passengerTripCount: 8,
    pickup: 'Aeroparque Jorge Newbery',
    destinations: [
      'Hotel Hilton, Puerto Madero',
      'Av. Alvear 1300, Recoleta',
      'Juncal 1500, Barrio Norte',
      'Av. Santa Fe 4100, Palermo',
      'Av. Cabildo 2300, Belgrano',
      'Av. Monroe 2500, Villa Urquiza',
      'Av. Congreso 3500, Villa del Parque',
    ],
    totalKm: 38.7,
    totalMin: 75,
    fare: 78000,
    vehicleTypeId: 'van_7',
    dangerWarnings: [],
  },
];

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const weeklyEarnings = [12500, 18000, 14800, 22200, 19000, 24500, 12500];

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIP_ALARM_SECONDS = 45; // margen del conductor para decidir

// ─── Component ───────────────────────────────────────────────────────────────

export function DriverScreen() {
  const { user, setCurrentScreen, showToast, isOnline, setIsOnline, tripVerificationCode, setTripVerificationCode } = useAppStore();
  const [acceptingTrip, setAcceptingTrip] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'trips' | 'earnings'>('overview');

  // ── CBU display state (loaded from /api/driver-config so the earnings
  // panel can show the real masked CBU instead of a hardcoded demo value).
  const [cbuInfo, setCbuInfo] = useState<{ last4: string; alias: string; holder: string } | null>(null);

  // ── Real earnings data ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [realEarnings, setRealEarnings] = useState<any>(null);

  // Fetch real earnings when component mounts and user is a driver
  useEffect(() => {
    if (user?.uid && user.uid !== 'demo') {
      fetch(`/api/drivers/${user.uid}/earnings`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) setRealEarnings(data);
        })
        .catch(() => {}); // silent fail, fall back to sample data
    }
  }, [user?.uid]);

  // ── Trip alarm state (Session 17) ──
  // Lista de requests activas con su countdown. Cuando expira el timer de una
  // request, se elimina automáticamente (auto-rechazo).
  const [pendingRequests, setPendingRequests] = useState<TripRequest[]>([]);
  const [expiredIds, setExpiredIds] = useState<Set<string>>(new Set());
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  // Driver vehicle type from user profile (default = auto_4_puertas)
  const driverVehicle: VehicleType = getVehicleType(user?.vehicleType || 'auto_4_puertas');
  const driverCapacity = driverVehicle.capacity;

  const userName = user?.name || 'Conductor';

  // ── Load driver CBU info when the earnings tab opens (or when entering driver mode) ──
  useEffect(() => {
    if (!user?.uid || user.uid === 'demo') return;
    if (selectedTab !== 'earnings') return;
    let cancelled = false;
    void fetch(`/api/driver-config?userId=${user.uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.config) return;
        const cfg = data.config;
        const cbu: string = cfg.cbuNumber || '';
        if (cbu.length === 22) {
          setCbuInfo({ last4: cbu.slice(-4), alias: cfg.cbuAlias || '', holder: cfg.cbuHolderName || '' });
        } else {
          setCbuInfo(null);
        }
      })
      .catch(() => {
        if (!cancelled) setCbuInfo(null);
      });
    return () => { cancelled = true; };
  }, [user?.uid, selectedTab]);

  // ── Quick action handlers ──
  // "Navegar" opens a bottom sheet that lets the driver pick Waze or Google
  // Maps. We pass the driver's current geolocation so the map opens centered
  // on them. If geolocation is unavailable, we fall back to a plain "open
  // the app" deep link (Waze ul, Google Maps). During an active trip the
  // in-trip UI has its own "SOS / Navigate" button that passes the trip's
  // pickup/destination coords.
  const [showNavigateSheet, setShowNavigateSheet] = useState(false);

  const handleNavigate = useCallback(() => {
    setShowNavigateSheet(true);
  }, []);

  const openMapApp = useCallback(async (app: 'waze' | 'gmaps') => {
    setShowNavigateSheet(false);
    let url: string;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('no geo'));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000,
        });
      });
      const { latitude, longitude } = pos.coords;
      url = app === 'waze'
        ? `https://waze.com/ul?ll=${latitude}%2C${longitude}&navigate=yes`
        : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    } catch {
      // No geolocation — just open the app's main screen
      url = app === 'waze' ? 'https://waze.com/ul' : 'https://www.google.com/maps';
      showToast('No pudimos obtener tu ubicación. Abrimos el mapa sin destino.', 'info');
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [showToast]);

  const handleRatings = useCallback(() => {
    setCurrentScreen('my-reviews');
  }, [setCurrentScreen]);

  const handleSchedule = useCallback(() => {
    // Schedule is part of driver-config; the screen scrolls there automatically.
    setCurrentScreen('driver-config');
    showToast('Editá tus horarios en la sección "Horarios de disponibilidad".', 'info');
  }, [setCurrentScreen, showToast]);

  const handleConfig = useCallback(() => {
    setCurrentScreen('driver-config');
  }, [setCurrentScreen]);

  // ── Real-time GPS tracking for driver location ──
  const driverWatchRef = useRef<number | null>(null);

  // ── Broadcast GPS to trip during active trip (for passenger live tracking) ──
  const tripBroadcastRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // When driver has an active trip AND code is verified (trip started),
    // broadcast GPS position to the trip's location endpoint every 3s
    // so the passenger can see live tracking on the map.
    if (activeTrip && codeVerified && user?.uid && user.uid !== 'demo') {
      tripBroadcastRef.current = setInterval(async () => {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error('no geo'));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true, timeout: 5000, maximumAge: 5000,
            });
          });
          await fetch(`/api/trips/${activeTrip.id}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.uid,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading || 0,
              speed: pos.coords.speed || 0,
            }),
          });
        } catch { /* GPS unavailable, skip this broadcast */ }
      }, 3000);
    }
    return () => {
      if (tripBroadcastRef.current) {
        clearInterval(tripBroadcastRef.current);
        tripBroadcastRef.current = null;
      }
    };
  }, [activeTrip, codeVerified, user?.uid]);

  // ── Online/Offline toggle with API ──
  const handleToggleOnline = useCallback(async () => {
    const newOnline = !isOnline;
    setIsOnline(newOnline);

    if (user?.uid && user.uid !== 'demo') {
      try {
        let lat: number | undefined, lng: number | undefined;
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true, timeout: 8000, maximumAge: 30000,
            });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch { /* no GPS */ }

        await fetch('/api/drivers/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, online: newOnline, lat, lng }),
        });

        // Start GPS broadcast when going online
        if (newOnline && navigator.geolocation) {
          driverWatchRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              const { latitude, longitude, heading, speed, accuracy, altitude } = pos.coords;
              void fetch('/api/drivers/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: user.uid, online: true,
                  lat: latitude, lng: longitude,
                  heading: heading || 0,
                }),
              }).catch((err) => {
                console.warn('[driver] GPS status update failed:', err);
              });
              // ── Phase 2: GPS trace collection ──
              // Send GPS ping to tracking API (every 3s from watchPosition).
              // This builds the trace database for custom routing & traffic data.
              // Only send if user is a real user (not demo).
              if (user.uid !== 'demo') {
                void fetch('/api/tracking/ping', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: user.uid,
                    lat: latitude,
                    lng: longitude,
                    speed: speed || 0,
                    heading: heading || 0,
                    accuracy: accuracy || 0,
                    altitude: altitude || 0,
                  }),
                }).catch((err) => {
                  console.warn('[driver] GPS ping failed:', err);
                });
              }
            },
            (err) => {
              console.warn('[driver] GPS watchPosition error:', err.message, err.code);
            },
            { enableHighAccuracy: true, maximumAge: 10000 }
          );
        } else {
          if (driverWatchRef.current) {
            navigator.geolocation.clearWatch(driverWatchRef.current);
            driverWatchRef.current = null;
          }
        }
      } catch (err) {
        console.warn('[driver] Status API failed:', err);
      }
    }
  }, [isOnline, setIsOnline, user]);

  // ── Poll for pending trip requests (real matching) ──
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOnline || !user?.uid || user.uid === 'demo') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    // Poll every 3 seconds for pending requests
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/drivers/${user.uid}/requests`);
        const data = await res.json();

        // If there's an active trip, set it
        if (data.activeTrip && !activeTrip) {
          setActiveTrip({
            id: data.activeTrip.id,
            passengerName: data.activeTrip.passenger?.name || 'Pasajero',
            passengerInitial: (data.activeTrip.passenger?.name || 'P')[0],
            passengerPhoto: data.activeTrip.passenger?.facePhoto || data.activeTrip.passenger?.avatar || '',
            passengerRating: data.activeTrip.passenger?.rating || 0,
            passengerTripCount: data.activeTrip.passenger?.tripCount || 0,
            pickup: data.activeTrip.origin?.name || '',
            destinations: [data.activeTrip.destination?.name || ''],
            totalKm: data.activeTrip.distance || 0,
            totalMin: data.activeTrip.duration || 0,
            fare: data.activeTrip.fare || 0,
            vehicleTypeId: user.vehicleType || 'auto_4_puertas',
            createdAt: data.activeTrip.acceptedAt ? new Date(data.activeTrip.acceptedAt).getTime() : Date.now(),
            thirdParty: data.activeTrip.passenger?.thirdParty || null,
            thirdPartyPhoto: data.activeTrip.passenger?.thirdPartyPhoto || null,
          });
          setTripVerificationCode(data.activeTrip.verificationCode);
          setPendingRequests([]);
          return;
        }

        // Convert real pending requests to local format
        if (data.pendingRequests && data.pendingRequests.length > 0 && !activeTrip) {
          const newReqs: TripRequest[] = data.pendingRequests.map((r: any) => ({
            id: r.id,
            passengerName: 'Pasajero',
            passengerInitial: 'P',
            passengerPhoto: '',
            passengerRating: 0,
            passengerTripCount: 0,
            pickup: r.pickup || '',
            destinations: [r.destination || ''],
            totalKm: r.distance || 0,
            totalMin: r.duration || 0,
            fare: r.fare || 0,
            vehicleTypeId: r.requestedVehicleType || 'auto_4_puertas',
            createdAt: new Date(r.createdAt).getTime(),
          }));
          setPendingRequests((prev) => {
            const existingIds = new Set(prev.map(r => r.id));
            const fresh = newReqs.filter(r => !existingIds.has(r.id));
            return [...fresh, ...prev];
          });
        }
      } catch { /* ignore poll errors */ }
    }, 3000);

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [isOnline, user?.uid, activeTrip]);

  // ── Spawn pending requests when going online (SAMPLE DATA FALLBACK) ──
  // Only used when user is in demo mode (no real account)
  useEffect(() => {
    if (!isOnline) {
      setPendingRequests([]);
      return;
    }
    if (user?.uid && user.uid !== 'demo') return; // Real mode uses API polling

    // Seed with up to 2 requests on first mount, respecting driver capacity
    setPendingRequests((prev) => {
      if (prev.length > 0) return prev;
      const seed = TRIP_REQUESTS_POOL
        .filter(r => r.destinations.length <= driverCapacity)
        .slice(0, 2)
        .map(r => ({ ...r, createdAt: Date.now() }));
      return seed;
    });
  }, [isOnline, driverCapacity, user?.uid]);

  // ── Countdown tick: every 1s, check expired requests ──
  useEffect(() => {
    if (pendingRequests.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const newExpired = new Set(expiredIds);
      let anyExpired = false;
      for (const req of pendingRequests) {
        const elapsed = Math.floor((now - req.createdAt) / 1000);
        if (elapsed >= TRIP_ALARM_SECONDS && !newExpired.has(req.id) && !acceptingTrip) {
          newExpired.add(req.id);
          anyExpired = true;
        }
      }
      if (anyExpired) {
        setExpiredIds(newExpired);
        // Remove expired requests after a brief "expirado" animation
        setTimeout(() => {
          setPendingRequests(prev => prev.filter(r => !newExpired.has(r.id)));
        }, 800);
        showToast('Una solicitud expiró (45s sin respuesta)', 'info');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingRequests, expiredIds, acceptingTrip, showToast]);

  const handleAcceptTrip = async (tripId: string) => {
    setAcceptingTrip(tripId);

    // Try real API accept
    if (user?.uid && user.uid !== 'demo') {
      try {
        const res = await fetch(`/api/trips/${tripId}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverId: user.uid }),
        });
        const data = await res.json();
        if (data.trip) {
          setAcceptingTrip(null);
          const t = data.trip;
          const p = data.passenger;
          setActiveTrip({
            id: t.id,
            passengerName: p?.name || 'Pasajero',
            passengerInitial: (p?.name || 'P')[0],
            passengerPhoto: p?.facePhoto || '',
            passengerPhone: p?.phone || '',
            passengerRating: p?.rating || 0,
            passengerTripCount: p?.tripCount || 0,
            pickup: t.origin?.name || '',
            destinations: [t.destination?.name || ''],
            totalKm: t.distance || 0,
            totalMin: t.duration || 0,
            fare: t.fare || 0,
            vehicleTypeId: user.vehicleType || 'auto_4_puertas',
            createdAt: Date.now(),
          });
          setTripVerificationCode(t.verificationCode);
          setPendingRequests(prev => prev.filter(r => r.id !== tripId));
          showToast('Viaje aceptado! Pedile el código al pasajero', 'success');
          return;
        }
      } catch (err) {
        console.warn('[driver] Accept API failed:', err);
      }
    }

    // Fallback simulation
    const code = String(Math.floor(1000 + Math.random() * 9000));
    await new Promise((r) => setTimeout(r, 800));
    setAcceptingTrip(null);
    const trip = pendingRequests.find(t => t.id === tripId);
    if (trip) {
      setActiveTrip(trip);
      setTripVerificationCode(code);
      setPendingRequests(prev => prev.filter(r => r.id !== tripId));
    }
    showToast('Viaje aceptado! Pedile el código al pasajero', 'success');
  };

  const handleVerifyCode = async () => {
    if (codeInput.length !== 4) return;
    if (codeInput === tripVerificationCode) {
      // Try real API verify
      if (user?.uid && user.uid !== 'demo' && activeTrip) {
        try {
          await fetch(`/api/trips/${activeTrip.id}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: codeInput }),
          });
        } catch (err) {
          console.warn('[driver] Verify API failed:', err);
        }
      }
      setCodeVerified(true);
      showToast('Código verificado! Viaje iniciado', 'success');
    } else {
      setCodeError(true);
      setCodeInput('');
      const inp = document.querySelectorAll('.drv-code');
      if (inp[0]) inp[0].focus();
      setTimeout(() => setCodeError(false), 2000);
    }
  };

  const handleCancelTrip = async () => {
    if (activeTrip && user?.uid && user.uid !== 'demo') {
      try {
        await fetch(`/api/trips/${activeTrip.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancelledBy: 'driver' }),
        });
      } catch { /* ignore */ }
    }
    setActiveTrip(null);
    setCodeInput('');
    setCodeVerified(false);
    setTripVerificationCode(null);
    showToast('Viaje cancelado', 'info');
  };

  const handleRejectTrip = async (tripId: string) => {
    // Try real API decline
    if (user?.uid && user.uid !== 'demo') {
      try {
        await fetch(`/api/trips/${tripId}/decline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverId: user.uid }),
        });
      } catch { /* ignore */ }
    }
    setPendingRequests(prev => prev.filter(r => r.id !== tripId));
    showToast('Solicitud rechazada', 'info');
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-24">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-b-3xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 pt-12 pb-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentScreen('role')}
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Modo Conductor</h1>
              <p className="text-gray-500 text-xs">{userName}</p>
            </div>
          </div>

          {/* Online/Offline Toggle */}
          <button
            onClick={handleToggleOnline}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all active:scale-95 ${
              isOnline
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isOnline ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
            {isOnline ? 'En línea' : 'Desconectado'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: `$${(realEarnings?.today?.netEarnings ?? sampleEarnings.today).toLocaleString('es-AR')}`, label: 'Hoy', icon: DollarSign, color: '#0EA5A0' },
            { value: (realEarnings?.today?.tripCount ?? sampleEarnings.trips).toString(), label: 'Viajes', icon: Car, color: '#F97316' },
            { value: user?.averageRating?.toFixed(1) || sampleEarnings.rating.toString(), label: 'Rating', icon: Star, color: '#EAB308' },
            { value: `$${(realEarnings?.week?.netEarnings ?? sampleEarnings.week).toLocaleString('es-AR')}`, label: 'Semana', icon: TrendingUp, color: '#8B5CF6' },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={idx}
              className="bg-[#F5F7FA] rounded-xl p-3 text-center"
            >
              <stat.icon className="w-4 h-4 mx-auto mb-1" style={{ color: stat.color }} />
              <p className="text-sm font-bold text-gray-900">{stat.value}</p>
              <p className="text-[10px] text-gray-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5">
        <div className="flex bg-white rounded-xl p-1 shadow-sm">
          {(['overview', 'trips', 'earnings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`flex-1 h-10 rounded-lg text-xs font-semibold transition-all ${
                selectedTab === tab
                  ? 'text-white shadow-lg'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              style={selectedTab === tab ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' } : undefined}
            >
              {tab === 'overview' ? 'Inicio' : tab === 'trips' ? 'Viajes' : 'Ganancias'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 space-y-5">
        {selectedTab === 'overview' && (
          <>
            {/* Driver vehicle banner (Session 17) */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
              <div className="bg-white rounded-2xl p-3.5 shadow-sm flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{driverVehicle.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    Cap. {driverCapacity} pasajeros · Comisión {user?.isSocio ? 5 : driverVehicle.commissionPct}% · Tarifa ${driverVehicle.perKm}/km
                  </p>
                </div>
                {user?.vehiclePlate && (
                  <span className="text-xs font-mono font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                    {user.vehiclePlate}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Pending Requests — Trip alarm modal (Session 17) */}
            {isOnline && (
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#0EA5A0] animate-pulse" />
                    Solicitudes ({pendingRequests.length})
                  </h2>
                  <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    45s para responder
                  </span>
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                    <Bell className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm font-medium text-gray-500">Esperando solicitudes…</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Las solicitudes se asignan según tu categoría ({driverVehicle.name})
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {pendingRequests.map((req) => {
                        const payout = computeDriverPayout(req.fare, req.vehicleTypeId, user?.isSocio);
                        const isExpired = expiredIds.has(req.id);
                        const isExpanded = expandedRoute === req.id;
                        return (
                          <motion.div
                            key={req.id}
                            layout
                            initial={{ opacity: 0, y: 16, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                            className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${
                              isExpired ? 'border-gray-200 opacity-50' : 'border-[#0EA5A0]/30'
                            }`}
                          >
                            {/* Header: pasajero + rating + countdown */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden"
                                  style={{ background: req.passengerPhoto ? 'transparent' : 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
                                  {req.passengerPhoto ? (
                                    <img src={req.passengerPhoto} alt={req.passengerName} className="w-full h-full object-cover" />
                                  ) : req.passengerInitial}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{req.passengerName}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="flex items-center gap-0.5">
                                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                      <span className="text-xs font-medium text-gray-700">{req.passengerRating.toFixed(1)}</span>
                                    </span>
                                    <span className="text-[10px] text-gray-400">·</span>
                                    <span className="text-xs text-gray-500">{req.passengerTripCount} viajes</span>
                                  </div>
                                </div>
                              </div>
                              <CountdownRing
                                createdAt={req.createdAt}
                                totalSeconds={TRIP_ALARM_SECONDS}
                                expired={isExpired}
                              />
                            </div>

                            {/* Stats grid: total km, total min, payout */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div className="bg-[#F5F7FA] rounded-lg p-2 text-center">
                                <RouteIcon className="w-3.5 h-3.5 mx-auto text-gray-400 mb-0.5" />
                                <p className="text-xs font-bold text-gray-900">{req.totalKm} km</p>
                                <p className="text-[10px] text-gray-500">total</p>
                              </div>
                              <div className="bg-[#F5F7FA] rounded-lg p-2 text-center">
                                <Clock className="w-3.5 h-3.5 mx-auto text-gray-400 mb-0.5" />
                                <p className="text-xs font-bold text-gray-900">{req.totalMin} min</p>
                                <p className="text-[10px] text-gray-500">estimado</p>
                              </div>
                              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                                <Wallet className="w-3.5 h-3.5 mx-auto text-emerald-600 mb-0.5" />
                                <p className="text-xs font-bold text-emerald-700">{formatCurrency(payout.payout)}</p>
                                <p className="text-[10px] text-emerald-600">tu neto</p>
                              </div>
                            </div>

                            {/* Pickup + destinations */}
                            <div className="rounded-xl bg-[#F5F7FA] p-3 mb-3">
                              {/* Dangerous-zone warning banner */}
                              {req.dangerWarnings && req.dangerWarnings.length > 0 && (
                                <div className="mb-2 -mt-1 rounded-lg bg-red-50 border border-red-200 p-2 flex items-start gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide">Zona con advertencia de seguridad</p>
                                    {req.dangerWarnings.map((w, i) => {
                                      const [kind, ...rest] = w.split(':');
                                      const label = kind.trim() === 'pickup' ? 'Pickup' : 'Destino';
                                      return (
                                        <p key={i} className="text-[11px] text-red-800 mt-0.5">
                                          <span className="font-semibold">{label}:</span> {rest.join(':').trim()}
                                        </p>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <div className="flex items-start gap-2">
                                <div className="flex flex-col items-center pt-0.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-[#0EA5A0] flex-shrink-0" />
                                  {req.destinations.slice(0, isExpanded ? req.destinations.length : Math.min(2, req.destinations.length)).map((_, i) => (
                                    <div key={i} className="w-0.5 h-4 bg-gray-300 my-0.5" />
                                  ))}
                                  <div className="w-2.5 h-2.5 rounded-full bg-[#F97316] flex-shrink-0 mt-0.5" />
                                </div>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Buscar en</p>
                                    <p className="text-xs font-medium text-gray-900 truncate">{req.pickup}</p>
                                  </div>
                                  {req.destinations.slice(0, isExpanded ? req.destinations.length : Math.min(2, req.destinations.length)).map((dest, i) => (
                                    <div key={i}>
                                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Destino {i + 1}
                                      </p>
                                      <p className="text-xs font-medium text-gray-900 truncate">{dest}</p>
                                    </div>
                                  ))}
                                  {!isExpanded && req.destinations.length > 2 && (
                                    <button
                                      onClick={() => setExpandedRoute(req.id)}
                                      className="text-[11px] font-medium text-[#0EA5A0] hover:underline flex items-center gap-1 mt-1"
                                    >
                                      <Eye className="w-3 h-3" />
                                      Ver {req.destinations.length - 2} destinos más
                                    </button>
                                  )}
                                  {isExpanded && (
                                    <button
                                      onClick={() => setExpandedRoute(null)}
                                      className="text-[11px] font-medium text-gray-500 hover:underline flex items-center gap-1 mt-1"
                                    >
                                      <X className="w-3 h-3" />
                                      Ver menos
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Fare + payout summary */}
                            <div className="flex items-center justify-between mb-3 px-1">
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tarifa del pasajero</p>
                                <p className="text-base font-bold text-gray-900">{formatCurrency(req.fare)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                                  Comisión ({payout.pct}%)
                                </p>
                                <p className="text-xs font-medium text-gray-500">
                                  −{formatCurrency(payout.commission)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-emerald-600 uppercase tracking-wider">Te quedan</p>
                                <p className="text-base font-bold text-emerald-700">{formatCurrency(payout.payout)}</p>
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRejectTrip(req.id)}
                                disabled={isExpired}
                                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
                              >
                                Rechazar
                              </button>
                              <button
                                onClick={() => handleAcceptTrip(req.id)}
                                disabled={acceptingTrip === req.id || isExpired}
                                className="flex-[2] h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}
                              >
                                {acceptingTrip === req.id ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Aceptando…
                                  </span>
                                ) : (
                                  <span className="flex items-center justify-center gap-1.5">
                                    Aceptar viaje
                                    <ChevronRight className="w-4 h-4" />
                                  </span>
                                )}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

            {/* Recent Trips */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
              <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Route className="w-4 h-4 text-[#F97316]" />
                Viajes recientes
              </h2>
              <div className="space-y-2.5">
                {recentDriverTrips.slice(0, 3).map((trip) => (
                  <div key={trip.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-[#0EA5A0]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {trip.from} → {trip.to}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{trip.time}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-base font-bold text-gray-900">${trip.fare}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
              <h2 className="text-base font-bold text-gray-900 mb-3">Acciones rápidas</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Sliders, label: 'Configuración', desc: 'Modo destino, horarios, CBU', color: '#0EA5A0', action: handleConfig },
                  { icon: Wallet, label: 'Ganancias', desc: 'Ver resumen semanal', color: '#22C55E', action: () => setSelectedTab('earnings') },
                  { icon: Star, label: 'Calificaciones', desc: 'Tu rating y reviews', color: '#EAB308', action: handleRatings },
                  { icon: Navigation, label: 'Navegar', desc: 'GPS en tiempo real', color: '#3B82F6', action: handleNavigate },
                  { icon: Calendar, label: 'Horarios', desc: 'Gestionar disponibilidad', color: '#8B5CF6', action: handleSchedule },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => action.action?.()}
                    className="bg-white rounded-2xl p-4 shadow-sm text-left hover:shadow-md active:scale-[0.98] transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                      style={{ backgroundColor: action.color + '15' }}>
                      <action.icon className="w-5 h-5" style={{ color: action.color }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}

        {selectedTab === 'trips' && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            <h2 className="text-base font-bold text-gray-900 mb-3">Historial de viajes</h2>
            <div className="space-y-2.5">
              {recentDriverTrips.map((trip) => (
                <div key={trip.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-[#0EA5A0] flex-shrink-0" />
                        <p className="text-sm font-medium text-gray-900 truncate">{trip.from}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#F97316] flex-shrink-0" />
                        <p className="text-sm font-medium text-gray-700 truncate">{trip.to}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{trip.time}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-base font-bold text-[#0EA5A0]">${trip.fare}</p>
                      <div className="flex items-center gap-0.5 justify-end mt-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium text-gray-600">5.0</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {selectedTab === 'earnings' && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="space-y-5">
            {/* Weekly Earnings Chart */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#8B5CF6]" />
                Ganancias semanales
              </h2>
              <div className="flex items-end justify-between h-40 gap-2">
                {(realEarnings?.dailyEarnings?.length ? realEarnings.dailyEarnings.map((d: { earnings: number; date: string; trips: number }) => ({ amount: d.earnings, label: d.date })) : weeklyEarnings.map((amount, idx) => ({ amount, label: weekDays[idx] }))).map((item: { amount: number; label: string }, idx: number) => {
                  const allAmounts = realEarnings?.dailyEarnings?.length ? realEarnings.dailyEarnings.map((d: { earnings: number }) => d.earnings) : weeklyEarnings;
                  const maxEarning = Math.max(...allAmounts, 1);
                  const height = (item.amount / maxEarning) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-gray-500">
                        ${(item.amount / 1000).toFixed(1)}k
                      </span>
                      <div className="w-full rounded-lg transition-all" style={{
                        height: `${height}%`,
                        minHeight: '8px',
                        background: idx === allAmounts.length - 1
                          ? 'linear-gradient(180deg, #0EA5A0, #0C8CE9)'
                          : 'linear-gradient(180deg, #E5E7EB, #D1D5DB)',
                      }} />
                      <span className={`text-[10px] font-medium ${idx === allAmounts.length - 1 ? 'text-[#0EA5A0] font-bold' : 'text-gray-400'}`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-[#22C55E]" />
                  <span className="text-xs font-medium text-gray-500">Total semana</span>
                </div>
                <p className="text-xl font-bold text-gray-900">${(realEarnings?.week?.netEarnings ?? sampleEarnings.week).toLocaleString('es-AR')}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-xs font-medium text-gray-500">Promedio/día</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  ${Math.round((realEarnings?.week?.netEarnings ?? sampleEarnings.week) / 7).toLocaleString('es-AR')}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Car className="w-4 h-4 text-[#F97316]" />
                  <span className="text-xs font-medium text-gray-500">Viajes semana</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{realEarnings?.week?.tripCount ?? sampleEarnings.trips}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-[#EAB308]" />
                  <span className="text-xs font-medium text-gray-500">Rating semanal</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{sampleEarnings.rating}</p>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Próximo deposito</p>
                  <p className="text-xs text-gray-500 mt-0.5">Se acredita el lunes</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#0EA5A0]">$78.500</p>
                  {cbuInfo ? (
                    <p className="text-xs text-gray-400">
                      CBU •••• {cbuInfo.last4}
                      {cbuInfo.alias ? ` · ${cbuInfo.alias}` : ''}
                    </p>
                  ) : (
                    <button
                      onClick={() => setCurrentScreen('driver-config')}
                      className="text-xs text-[#0EA5A0] font-semibold hover:underline mt-0.5 inline-flex items-center gap-1"
                    >
                      Configurá tu CBU/CVU
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      {/* Navigate bottom sheet — choose Waze or Google Maps */}
      {showNavigateSheet && (
        <div
          className="fixed inset-0 z-[998] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowNavigateSheet(false)}
        >
          <div
            className="w-full max-w-[430px] bg-[#F5F7FA] rounded-t-3xl p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-gray-300 mb-1" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Abrir navegación</h2>
              <button
                onClick={() => setShowNavigateSheet(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
                aria-label="Cerrar"
              >
                <span className="text-gray-500 text-lg">×</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Abrimos el mapa con tu ubicación actual. Durante un viaje activo, usá el botón SOS del viaje para navegar al pickup o destino.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => void openMapApp('waze')}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                  style={{ background: 'linear-gradient(135deg, #33CCFF, #0099CC)' }}>
                  W
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-900">Waze</p>
                  <p className="text-xs text-gray-500">Mejor para tráfico en tiempo real</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => void openMapApp('gmaps')}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                  style={{ background: 'linear-gradient(135deg, #4285F4, #34A853)' }}>
                  G
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-900">Google Maps</p>
                  <p className="text-xs text-gray-500">Rutas y direcciones precisas</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Active Trip Verification */}
      {activeTrip && !codeVerified && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-[430px] bg-[#F5F7FA] rounded-t-3xl p-4 pb-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-gray-300 mb-1" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-0.5 text-center">Verificar código</h2>
            <p className="text-[11px] text-gray-500 text-center mb-3">Pedile el código al pasajero</p>
            <div className="bg-white rounded-2xl p-3 mb-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden"
                  style={{ background: activeTrip.passengerPhoto ? 'transparent' : 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
                  {activeTrip.passengerPhoto ? (
                    <img src={activeTrip.passengerPhoto} alt={activeTrip.passengerName} className="w-full h-full object-cover" />
                  ) : activeTrip.passengerInitial}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {activeTrip.thirdParty ? `Viaje para: ${activeTrip.thirdParty}` : activeTrip.passengerName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {activeTrip.totalKm} km · {activeTrip.totalMin} min · {activeTrip.destinations.length} destino(s)
                  </p>
                </div>
                <span className="text-base font-bold text-[#0EA5A0]">{formatCurrency(activeTrip.fare)}</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center pt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#0EA5A0] flex-shrink-0" />
                  {activeTrip.destinations.map((_, i) => (
                    <div key={i} className="w-0.5 h-3 bg-gray-200 my-0.5" />
                  ))}
                  <div className="w-2 h-2 rounded-full bg-[#F97316] flex-shrink-0 mt-0.5" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Buscar en</p>
                  <p className="text-xs text-gray-700 truncate">{activeTrip.pickup}</p>
                  {activeTrip.destinations.map((dest, i) => (
                    <div key={i}>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Destino {i + 1}</p>
                      <p className="text-xs text-gray-700 truncate">{dest}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Third party photo if viaje para otro */}
            {activeTrip.thirdPartyPhoto && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1.5">Foto del pasajero real</p>
                <img src={activeTrip.thirdPartyPhoto} alt="Pasajero real" className="w-16 h-16 rounded-xl object-cover" />
              </div>
            )}
            <p className="text-sm font-semibold text-gray-700 mb-2 text-center">Ingresá el código de 4 dígitos</p>
            <div className="flex justify-center gap-2 mb-2">
              {[0,1,2,3].map((i) => (
                <input key={i} type="text" inputMode="numeric" maxLength={1} value={codeInput[i] || ''} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v) { const c = codeInput.split(''); c[i] = v[0]; const nc = c.join(''); setCodeInput(nc); const inp = document.querySelectorAll('.drv-code'); if (i < 3 && inp[i+1]) inp[i+1].focus(); } }} onKeyDown={(e) => { if (e.key === 'Backspace') { if (!codeInput[i] && i > 0) { setCodeInput(codeInput.slice(0, i)); const inp = document.querySelectorAll('.drv-code'); if (inp[i-1]) inp[i-1].focus(); } else { const c = codeInput.split(''); c[i] = ''; setCodeInput(c.join('')); } } }} className="drv-code w-12 h-12 rounded-xl text-center text-xl font-bold bg-white border-2 border-gray-200 outline-none focus:border-[#0EA5A0] transition-all" />
              ))}
            </div>
            <p className="text-[10px] text-gray-400 text-center mb-5">{codeError ? (<span className="text-red-500 font-semibold">Código incorrecto</span>) : (<>Demo: <span className="text-[#0EA5A0] font-semibold">{tripVerificationCode || '----'}</span></>)}</p>
            <div className="flex gap-2">
              <button onClick={handleCancelTrip} className="flex-1 h-11 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all">Cancelar</button>
              <button onClick={handleVerifyCode} disabled={codeInput.length < 4} className="flex-1 h-12 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm shadow-lg shadow-[#0EA5A0]/25 active:scale-95 transition-all disabled:opacity-50">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Verified */}
      {activeTrip && codeVerified && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center shadow-xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">¡Viaje iniciado!</h2>
            <p className="text-sm text-gray-500 mb-4">
              Conducí con seguridad hacia {activeTrip.destinations[0]}
              {activeTrip.destinations.length > 1 && ` y ${activeTrip.destinations.length - 1} destino(s) más`}
            </p>
            {/* Contact passenger buttons */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => {
                  if (activeTrip?.passengerPhone) {
                    window.open(`tel:${activeTrip.passengerPhone}`, '_self');
                  } else {
                    showToast('El pasajero no compartió su teléfono', 'error');
                  }
                }}
                className="flex-1 py-3 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm shadow-[#0EA5A0]/25 active:scale-95 transition-all"
              >
                <Phone className="w-4 h-4" /> Llamar
              </button>
              <button
                onClick={() => {
                  const chatBtn = document.querySelector('[data-trip-chat-fab]') as HTMLElement;
                  if (chatBtn) chatBtn.click();
                  else showToast('Usá el botón de chat flotante', 'info');
                }}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <MessageSquare className="w-4 h-4" /> Mensaje
              </button>
            </div>
            <button onClick={async () => {
              // Call server to complete the trip — with proper error handling
              if (user?.uid && user.uid !== 'demo' && activeTrip) {
                try {
                  const res = await fetch(`/api/trips/${activeTrip.id}/complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      driverId: user.uid,
                      actualDistance: activeTrip.totalKm,
                      actualDuration: activeTrip.totalMin,
                    }),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    showToast(data.error || 'Error al completar el viaje', 'error');
                    return; // Don't clear trip on failure
                  }
                  showToast('Viaje completado correctamente', 'success');
                } catch (err) {
                  console.warn('[driver] Complete trip API failed:', err);
                  showToast('Error de conexión. Intentá de nuevo.', 'error');
                  return; // Don't clear trip on failure
                }
              }
              setActiveTrip(null);
              setCodeInput('');
              setCodeVerified(false);
            }} className="w-full h-12 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm shadow-lg shadow-[#0EA5A0]/25 active:scale-95 transition-all">Completar viaje</button>
          </div>
        </div>
      )}
      {/* Trip chat — visible when driver has an active verified trip */}
      {activeTrip && codeVerified && (
        <TripChat
          tripId={activeTrip.id}
          otherUserId={user?.uid || null}
          otherUserName={activeTrip.passengerName || 'Pasajero'}
          visible={true}
        />
      )}
      </div>
    </div>
  );
}

// ─── Countdown ring (Session 17: 45s timer visible en cada request) ──────────
// SVG circular progress que decrementa cada segundo. Rojo cuando quedan ≤10s.

function CountdownRing({
  createdAt, totalSeconds, expired,
}: {
  createdAt: number;
  totalSeconds: number;
  expired: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const elapsedMs = now - createdAt;
  const remaining = Math.max(0, totalSeconds - Math.floor(elapsedMs / 1000));
  const progress = expired ? 0 : remaining / totalSeconds;
  const isUrgent = remaining <= 10 && remaining > 0;

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  const color = expired ? '#9CA3AF' : isUrgent ? '#EF4444' : '#0EA5A0';

  return (
    <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle
          cx="22" cy="22" r={radius}
          fill="none" stroke="#E5E7EB" strokeWidth="3"
        />
        <circle
          cx="22" cy="22" r={radius}
          fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {expired ? (
          <X className="w-4 h-4 text-gray-400" />
        ) : (
          <span
            className={`text-xs font-bold ${isUrgent ? 'text-red-500' : 'text-[#0EA5A0]'}`}
            style={{ minWidth: '16px', textAlign: 'center' }}
          >
            {remaining}
          </span>
        )}
      </div>
    </div>
  );
}
