'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import { interpolateAlongRoute, type LatLng } from '@/lib/route';
import {
  ArrowLeft,
  Navigation,
  Play,
  Square,
  Copy,
  Check,
  Loader2,
  Radio,
  MapPin,
  ExternalLink,
  Clock,
  Gauge,
} from 'lucide-react';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
// DriverSimulatorScreen — Grupo J + Grupo L preview
//
// Lets a user (typically the developer or admin) simulate the driver-side
// GPS broadcast for an active in_progress trip. Picks the user's most
// recent in_progress trip, loads its route polyline, and broadcasts
// interpolated positions every 3s to /api/trips/[id]/location.
//
// This is the manual counterpart to the automatic broadcast that RideScreen
// already does during the in_trip step. Useful for:
//   - Verifying the share page (/viaje/[token]) updates in real-time
//   - Testing the live tracking flow end-to-end without booking a real trip
//   - Grupo L (testing with two phones): run the simulator on one device,
//     open the share link on another device, watch the dot move.
// ─────────────────────────────────────────────────────────────────────────────

interface TripInfo {
  id: string;
  status: string;
  originName: string;
  destName: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  createdAt: string;
  route: LatLng[];
}

interface LiveLocation {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updatedAt: string | null;
  isLive: boolean;
}

export function DriverSimulatorScreen() {
  const store = useAppStore();
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<TripInfo | null>(null);
  const [live, setLive] = useState<LiveLocation | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef(0);
  const prevPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);

  // ── Load the user's most recent in_progress trip ──
  const loadTrip = useCallback(async () => {
    if (!store.user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips?userId=${store.user.uid}`);
      if (!res.ok) throw new Error('No se pudo cargar el viaje');
      const { trips } = await res.json() as { trips: Array<{ id: string; status: string; origin: { name: string; lat: number; lng: number }; destination: { name: string; lat: number; lng: number }; createdAt: string; route?: LatLng[] }> };

      // Find most recent in_progress trip; fall back to most recent trip overall
      const inProgress = trips.find((t) => t.status === 'in_progress');
      const target = inProgress ?? trips[0];

      if (!target) {
        setError('No tenés viajes para simular. Pedí uno primero desde la pantalla de TEYEVORide.');
        setLoading(false);
        return;
      }

      setTrip({
        id: target.id,
        status: target.status,
        originName: target.origin.name,
        destName: target.destination.name,
        originLat: target.origin.lat,
        originLng: target.origin.lng,
        destLat: target.destination.lat,
        destLng: target.destination.lng,
        createdAt: target.createdAt,
        route: target.route ?? [],
      });

      // Also try to fetch a share token (reuses active if exists)
      const shareRes = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: target.id, userId: store.user.uid }),
      });
      if (shareRes.ok) {
        const { token } = await shareRes.json() as { token: string };
        setShareToken(token);
        setShareUrl(`${window.location.origin}/viaje/${token}`);
      }
    } catch (err) {
      console.error('[sim] loadTrip error:', err);
      setError('Error al cargar el viaje.');
    } finally {
      setLoading(false);
    }
  }, [store.user, store.showToast]);

  // ── Poll live location to display current state ──
  const pollLive = useCallback(async () => {
    if (!trip) return;
    try {
      const res = await fetch(`/api/trips/${trip.id}/location`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json() as { location: LiveLocation; progress: number; remainingMin: number };
      setLive(json.location);
      setProgress(json.progress);
      progressRef.current = json.progress;
    } catch (err) {
      console.warn('[sim] pollLive error:', err);
    }
  }, [trip]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (!trip) return;
    void pollLive();
    pollIntervalRef.current = setInterval(() => void pollLive(), 2000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [trip, pollLive]);

  // ── Start / stop the simulation ──
  const handleStartSim = useCallback(() => {
    if (!trip || !store.user || trip.route.length < 2) {
      store.showToast('El viaje no tiene una ruta para simular.', 'error');
      return;
    }
    setSimulating(true);
    prevPosRef.current = null;
    progressRef.current = 0;

    const SIM_DURATION_MS = 30000; // 30s to traverse the route
    const TICK_MS = 1000; // broadcast every 1s for smoother visualization

    simIntervalRef.current = setInterval(() => {
      const tripId = trip.id;
      const user = store.user;
      const route = trip.route;
      if (!user) return;

      // Advance progress
      const newProgress = Math.min(1, progressRef.current + TICK_MS / SIM_DURATION_MS);
      progressRef.current = newProgress;
      setProgress(newProgress);

      const pos = interpolateAlongRoute(route, newProgress);
      if (!pos) return;

      const now = Date.now();
      const prev = prevPosRef.current;
      let heading: number | undefined;
      let speed: number | undefined;
      if (prev) {
        const dtSec = Math.max(0.1, (now - prev.t) / 1000);
        const distKm = haversine(prev.lat, prev.lng, pos.lat, pos.lng);
        speed = distKm > 0.0001 ? distKm / (dtSec / 3600) : 0;
        heading = bearing(prev.lat, prev.lng, pos.lat, pos.lng);
      }
      prevPosRef.current = { lat: pos.lat, lng: pos.lng, t: now };

      void fetch(`/api/trips/${tripId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, lat: pos.lat, lng: pos.lng, heading, speed }),
      }).catch((err) => console.warn('[sim] broadcast err:', err));

      // Stop when we reach the end
      if (newProgress >= 1) {
        if (simIntervalRef.current) clearInterval(simIntervalRef.current);
        setSimulating(false);
        store.showToast('Simulación completada — el vehículo llegó a destino.', 'success');
      }
    }, TICK_MS);
  }, [trip, store]);

  const handleStopSim = useCallback(() => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    setSimulating(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleCopyUrl = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      store.showToast('No se pudo copiar el enlace', 'error');
    }
  }, [shareUrl, store]);

  // ─── Render ─────────────────────────────────────────────────────────────

  const originPlace = trip ? { name: trip.originName, address: '', lat: trip.originLat, lng: trip.originLng } : null;
  const destPlace = trip ? { name: trip.destName, address: '', lat: trip.destLat, lng: trip.destLng } : null;
  const currentPos = trip && live ? { lat: live.lat, lng: live.lng } : null;

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col items-center justify-center">
        <Loader2 className="w-7 h-7 text-[#0EA5A0] animate-spin mb-3" />
        <p className="text-sm text-gray-600">Cargando viaje…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-24">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 shadow-sm">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => store.setCurrentScreen('profile')}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#0EA5A0]" />
                Simulador de conductor
              </h1>
              <p className="text-xs text-gray-500">Tracking en tiempo real — Grupo J</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-4 space-y-4">
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm text-amber-800">{error}</p>
            <button
              onClick={() => store.setCurrentScreen('ride')}
              className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold"
            >
              Ir a pedir un viaje
            </button>
          </div>
        )}

        {trip && (
          <>
            {/* Trip info card */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex flex-col items-center pt-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                  <div className="w-0.5 h-10 bg-gray-200 my-1" />
                  <div className="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-100" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Origen</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{trip.originName}</p>
                  <div className="my-2" />
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Destino</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{trip.destName}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${trip.status === 'in_progress' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {trip.status === 'in_progress' ? 'En curso' : trip.status === 'completed' ? 'Completado' : trip.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Puntos ruta</p>
                  <p className="text-sm font-bold text-gray-900">{trip.route.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Trip ID</p>
                  <p className="text-xs font-mono text-gray-600 truncate">{trip.id.slice(-8)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Creado</p>
                  <p className="text-xs text-gray-600">
                    {new Date(trip.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Live status card */}
            {live && (
              <div className={`rounded-2xl p-4 ${live.isLive ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {live.isLive ? (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                  ) : (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                  <p className={`text-sm font-bold ${live.isLive ? 'text-emerald-700' : 'text-gray-700'}`}>
                    {live.isLive ? 'En vivo' : 'Sin signal'}
                  </p>
                  {live.updatedAt && (
                    <span className="text-[10px] text-gray-500 ml-auto">
                      hace {Math.round((Date.now() - new Date(live.updatedAt).getTime()) / 1000)}s
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-500">Posición</p>
                    <p className="text-[11px] font-mono text-gray-700">{live.lat.toFixed(4)}, {live.lng.toFixed(4)}</p>
                  </div>
                  <div className="text-center">
                    <Navigation className="w-3.5 h-3.5 text-gray-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-500">Dirección</p>
                    <p className="text-sm font-bold text-gray-700">{live.heading !== null ? `${Math.round(live.heading)}°` : '—'}</p>
                  </div>
                  <div className="text-center">
                    <Gauge className="w-3.5 h-3.5 text-gray-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-500">Velocidad</p>
                    <p className="text-sm font-bold text-gray-700">{live.speed !== null ? `${Math.round(live.speed)} km/h` : '—'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Progreso</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0EA5A0] to-[#0C8CE9] transition-all duration-500"
                  style={{ width: `${Math.min(progress * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Map */}
            {originPlace && destPlace && (
              <div className="rounded-2xl overflow-hidden shadow-sm h-64 bg-white">
                <MapView
                  origin={originPlace}
                  destination={destPlace}
                  onMapClick={undefined}
                  selectMode={null}
                  userLocation={currentPos}
                />
              </div>
            )}

            {/* Simulation controls */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Control de simulación
              </p>
              <p className="text-xs text-gray-500">
                Al iniciar, se transmite la posición interpolada del vehículo al server cada 1 segundo. El recorrido dura ~30s. Abrí el enlace público en otra pestaña para ver el dot moverse en vivo.
              </p>
              {!simulating ? (
                <button
                  onClick={handleStartSim}
                  disabled={trip.route.length < 2}
                  className="w-full py-3 rounded-xl bg-[#0EA5A0] text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  Iniciar simulación
                </button>
              ) : (
                <button
                  onClick={handleStopSim}
                  className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <Square className="w-4 h-4" />
                  Detener simulación
                </button>
              )}
            </div>

            {/* Share link */}
            {shareUrl && (
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Enlace público de seguimiento
                </p>
                <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <p className="text-xs text-gray-700 truncate flex-1 font-mono">{shareUrl}</p>
                  <button
                    onClick={handleCopyUrl}
                    className="w-8 h-8 rounded-lg bg-[#0EA5A0]/10 flex items-center justify-center text-[#0EA5A0] flex-shrink-0"
                    aria-label="Copiar enlace"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold text-center"
                >
                  Abrir en nueva pestaña
                </a>
                {shareToken && (
                  <p className="text-[10px] text-gray-400 text-center">
                    Token: <span className="font-mono">{shareToken}</span>
                  </p>
                )}
              </div>
            )}

            {/* ── Grupo L: Two-phone testing guide ── */}
            <div className="bg-gradient-to-br from-[#0EA5A0]/10 to-[#0C8CE9]/10 border border-[#0EA5A0]/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#0EA5A0]" />
                <p className="text-sm font-bold text-gray-900">
                  Probar con dos teléfonos (Grupo L)
                </p>
              </div>
              <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
                <div className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0EA5A0] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                  <p><strong>Teléfono 1 (conductor):</strong> Abrí esta pantalla y tocá "Iniciar simulación". El vehículo empezará a moverse por la ruta.</p>
                </div>
                <div className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0EA5A0] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                  <p><strong>Teléfono 2 (pasajero o familiar):</strong> Abrí el enlace de seguimiento en otra pestaña o dispositivo. Vas a ver el dot azul moverse en vivo.</p>
                </div>
                <div className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0EA5A0] text-white text-[10px] font-bold flex items-center justify-center">3</span>
                  <p>Comprobá que el badge "EN VIVO" aparezca y el ETA se recalcule en tiempo real.</p>
                </div>
                <div className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0EA5A0] text-white text-[10px] font-bold flex items-center justify-center">4</span>
                  <p>También podés probar el botón SOS desde el teléfono del pasajero — la alerta aparece en el panel de admin (tab "SOS") con un link directo al tracking en vivo.</p>
                </div>
              </div>
              <div className="bg-white/60 rounded-xl p-3 mt-2">
                <p className="text-[11px] text-gray-600">
                  <strong>Tip:</strong> Si no tenés dos teléfonos físicos, abrí esta pantalla en tu computadora y el enlace de seguimiento en el celular (o viceversa). El polling funciona igual.
                </p>
              </div>
            </div>

            {/* Reset / cleanup */}
            <button
              onClick={() => void loadTrip()}
              className="w-full py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold active:scale-95 transition-all"
            >
              Recargar viaje
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
