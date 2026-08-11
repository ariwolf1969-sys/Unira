'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  MapPin,
  Navigation,
  Clock,
  Car,
  Bike,
  Crown,
  CarFront,
  CheckCircle,
  Loader2,
  AlertCircle,
  Eye,
  ExternalLink,
} from 'lucide-react';

const MapView = dynamic(() => import('@/components/unira/MapView'), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

interface SharedTripData {
  trip: {
    id: string;
    type: string;
    status: string;
    originName: string;
    originAddress: string;
    destName: string;
    destAddress: string;
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    driverFirstName: string | null;
    driverVehicle: string | null;
    vehicleType: string;
    fare: number;
    distance: number | null;
    duration: number | null;
    createdAt: string;
    progress: number;
    remainingMin: number;
    currentPos: { lat: number; lng: number } | null;
    route: [number, number][];
    // Grupo J: true when the position comes from a live driver GPS ping
    // (received within the last 60s), false when it's a time-based simulation.
    isLive?: boolean;
  };
  share: {
    expiresAt: string;
    viewCount: number;
  };
}

interface ApiError {
  error: string;
}

// ─── Vehicle icons ───────────────────────────────────────────────────────────

const VEHICLE_ICONS: Record<string, React.ElementType> = {
  moto: Bike,
  auto: Car,
  premium: Crown,
  taxi: CarFront,
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SharedTripPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<SharedTripData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve token from params
  useEffect(() => {
    void params.then((p) => setToken(p.token));
  }, [params]);

  // Fetch trip data, poll every 5s while trip is in progress
  const fetchData = useCallback(async (tok: string) => {
    try {
      const res = await fetch(`/api/share/${tok}`, { cache: 'no-store' });
      if (res.status === 404) {
        setError('Enlace inválido o expirado');
        setLoading(false);
        return;
      }
      if (res.status === 410) {
        setError('Este enlace de seguimiento expiró');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError('Error al cargar el viaje');
        setLoading(false);
        return;
      }
      const json = (await res.json()) as SharedTripData;
      setData(json);
      setLoading(false);
    } catch {
      setError('Error de conexión');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    // Initial fetch deferred via setTimeout to avoid setState synchronously
    // inside the effect body (react-hooks/set-state-in-effect rule).
    const initialTimer = setTimeout(() => {
      void fetchData(token);
    }, 0);
    // Poll every 3 seconds for live updates (Grupo J: matches the broadcast
    // interval so the share page reflects the latest driver position with
    // minimal latency).
    pollRef.current = setInterval(() => {
      void fetchData(token);
    }, 3000);
    return () => {
      clearTimeout(initialTimer);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [token, fetchData]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col items-center justify-center px-6">
        <Loader2 className="w-8 h-8 text-[#0EA5A0] animate-spin mb-3" />
        <p className="text-sm text-gray-600">Cargando viaje compartido…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-1">No se pudo abrir el enlace</h1>
        <p className="text-sm text-gray-500 text-center mb-6">{error}</p>
        <a
          href="/"
          className="px-5 py-2.5 bg-[#0EA5A0] text-white rounded-xl font-semibold text-sm hover:bg-[#0C8F8A] transition-colors inline-flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Ir a Unira
        </a>
      </div>
    );
  }

  if (!data) return null;

  const { trip, share } = data;
  const isCompleted = trip.status === 'completed';
  const isLive = trip.isLive === true && !isCompleted;
  const VehicleIcon = VEHICLE_ICONS[trip.vehicleType] ?? Car;

  // Build waypoints for MapView (origin = pickup, destination = dropoff)
  const originPlace = { name: trip.originName, address: trip.originAddress, lat: trip.originLat, lng: trip.originLng };
  const destPlace = { name: trip.destName, address: trip.destAddress, lat: trip.destLat, lng: trip.destLng };

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA]">
      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#0EA5A0] to-[#0B8A86] px-4 pt-6 pb-5 text-white">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-white">
                U
              </div>
              <span className="font-bold text-base tracking-wide">TEYEVO</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-white/80">
              <Eye className="w-3.5 h-3.5" />
              <span>{share.viewCount} vistas</span>
            </div>
          </div>

          <h1 className="text-xl font-bold leading-tight flex items-center gap-2 flex-wrap">
            {isCompleted ? 'Viaje completado' : 'Seguimiento de viaje'}
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 border border-white/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                <span className="text-[10px] font-bold text-white tracking-wide uppercase">En vivo</span>
              </span>
            )}
          </h1>
          <p className="text-sm text-white/80 mt-1">
            {isCompleted
              ? 'El viaje finalizó correctamente.'
              : isLive
                ? `Posición actualizada en tiempo real · ETA ${trip.remainingMin} min`
                : `Tiempo estimado de llegada: ${trip.remainingMin} min`}
          </p>
        </div>
      </div>

      {/* ─── Map ─────────────────────────────────────────────────────── */}
      <div className="max-w-md mx-auto px-4 -mt-4">
        <div className="rounded-2xl overflow-hidden shadow-lg h-72 bg-white">
          {trip.route.length >= 2 ? (
            <MapView
              origin={originPlace}
              destination={destPlace}
              onMapClick={undefined}
              selectMode={null}
              userLocation={trip.currentPos ? { lat: trip.currentPos.lat, lng: trip.currentPos.lng } : null}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
              <Navigation className="w-8 h-8 mb-2" />
              <p className="text-xs">Sin datos de recorrido</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Trip info ───────────────────────────────────────────────── */}
      <div className="max-w-md mx-auto px-4 mt-4 pb-8 space-y-3">
        {/* Status card */}
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${isCompleted ? 'bg-emerald-50' : isLive ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          {isCompleted ? (
            <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
          ) : isLive ? (
            <span className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-5 w-5 rounded-full bg-emerald-400 opacity-60" />
              <Navigation className="relative w-5 h-5 text-emerald-600" />
            </span>
          ) : (
            <Clock className="w-6 h-6 text-amber-500 flex-shrink-0 animate-pulse" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-bold ${isCompleted ? 'text-emerald-700' : isLive ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isCompleted ? 'Finalizado' : isLive ? 'En vivo' : 'En curso'}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(trip.createdAt).toLocaleString('es-AR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          {!isCompleted && (
            <div className="text-right">
              <p className="text-xl font-bold text-emerald-700">{trip.remainingMin}</p>
              <p className="text-[10px] text-gray-500">min</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {!isCompleted && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Progreso del viaje</span>
              <span>{Math.round(trip.progress * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0EA5A0] to-[#0C8CE9] transition-all duration-1000 ease-linear"
                style={{ width: `${Math.min(trip.progress * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Route card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
              <div className="w-0.5 h-12 bg-gray-200 my-1" />
              <div className="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Origen</p>
              <p className="text-sm font-medium text-gray-900 truncate">{trip.originName}</p>
              {trip.originAddress && trip.originAddress !== trip.originName && (
                <p className="text-xs text-gray-500 line-clamp-2">{trip.originAddress}</p>
              )}
              <div className="my-2" />
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Destino</p>
              <p className="text-sm font-medium text-gray-900 truncate">{trip.destName}</p>
              {trip.destAddress && trip.destAddress !== trip.destName && (
                <p className="text-xs text-gray-500 line-clamp-2">{trip.destAddress}</p>
              )}
            </div>
          </div>
        </div>

        {/* Driver card */}
        {trip.driverFirstName && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0EA5A0] to-[#0C8CE9] flex items-center justify-center text-white font-bold text-base">
                {trip.driverFirstName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{trip.driverFirstName}</p>
                {trip.driverVehicle && (
                  <p className="text-xs text-gray-500 truncate">{trip.driverVehicle}</p>
                )}
              </div>
              <div className="w-10 h-10 rounded-full bg-[#0EA5A0]/10 flex items-center justify-center text-[#0EA5A0]">
                <VehicleIcon className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {trip.distance !== null && (
            <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
              <Navigation className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-base font-bold text-gray-900">{trip.distance} km</p>
              <p className="text-[10px] text-gray-500">Distancia</p>
            </div>
          )}
          {trip.duration !== null && (
            <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
              <Clock className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <p className="text-base font-bold text-gray-900">{trip.duration} min</p>
              <p className="text-[10px] text-gray-500">Duración</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-2">
          <p className="text-xs text-gray-400">
            Enlace expira el {new Date(share.expiresAt).toLocaleString('es-AR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#0EA5A0] hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Conocé Unira
          </a>
        </div>
      </div>

      {/* Suppress unused warning for searchParams (kept for future query parsing) */}
      <span className="hidden">{searchParams?.toString()}</span>
    </div>
  );
}
