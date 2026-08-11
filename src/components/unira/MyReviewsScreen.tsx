'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import {
  ArrowLeft,
  Star,
  Clock,
  CheckCircle,
  Lock,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Calendar,
  MapPin,
  Sparkles,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TripInfo {
  id: string;
  originName: string;
  destName: string;
  createdAt: string;
}

interface Rating {
  id: string;
  tripId: string;
  fromUserId: string | null;
  toUserId: string;
  fromRole: string;
  toRole: string;
  stars: number;
  reason: string;
  comment: string;
  createdAt: string;
  visibleToRecipientAt: string;
  releasedAt: string | null;
  seenAt: string | null;
  authorName: string | null;
  trip: TripInfo | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MyReviewsScreen() {
  const store = useAppStore();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  // Load ratings
  const loadRatings = useCallback(async (direction: 'received' | 'sent') => {
    if (!store.user) return;
    if (store.user.uid === 'demo') {
      // Demo mode: show empty state
      setRatings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ratings?userId=${store.user.uid}&direction=${direction}`);
      if (!res.ok) {
        setRatings([]);
        return;
      }
      const data = (await res.json()) as { ratings: Rating[] };
      setRatings(data.ratings);
    } catch (err) {
      console.warn('[my-reviews] load failed:', err);
      setRatings([]);
    } finally {
      setLoading(false);
    }
  }, [store.user]);

  useEffect(() => {
    void loadRatings(tab);
  }, [tab, loadRatings]);

  // ─── Helpers ────────────────────────────────────────────────────────────

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

  const daysUntilRelease = (visibleToRecipientAt: string): number => {
    const ms = new Date(visibleToRecipientAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 bg-white sticky top-0 z-10 shadow-sm">
        <button
          onClick={() => store.setCurrentScreen('profile')}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Mis reseñas</h1>
            <p className="text-[11px] text-gray-500 leading-tight">
              Calificaciones con privacidad anti-represalia
            </p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="px-4 mt-3">
        <div className="bg-white rounded-2xl shadow-sm p-1 flex">
          <button
            onClick={() => setTab('received')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'received' ? 'bg-[#0EA5A0] text-white' : 'text-gray-600'
            }`}
          >
            Recibidas
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'sent' ? 'bg-[#0EA5A0] text-white' : 'text-gray-600'
            }`}
          >
            Enviadas
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="px-4 mt-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Las reseñas son <strong>100% anónimas</strong>. Nunca se revela quién te calificó, ni al conductor ni al pasajero. Esto protege a ambas partes de represalias.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 mt-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#0EA5A0] animate-spin mb-2" />
            <p className="text-sm text-gray-500">Cargando reseñas…</p>
          </div>
        ) : ratings.length === 0 ? (
          <div className="space-y-4">
            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Star className="w-8 h-8 text-gray-300" />
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1">
                {tab === 'received' ? 'Sin reseñas recibidas' : 'Sin reseñas enviadas'}
              </h2>
              <p className="text-sm text-gray-500 text-center max-w-xs">
                {tab === 'received'
                  ? 'Cuando completes viajes, las calificaciones que recibas aparecerán acá.'
                  : 'Las calificaciones que envíes después de cada viaje se guardarán acá.'}
              </p>
            </div>

            {/* Ejemplos demo: cómo se ven las reseñas reales */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#0EA5A0]" />
                <h3 className="text-sm font-bold text-gray-900">Ejemplos de calificaciones</h3>
              </div>
              <p className="text-[11px] text-gray-500 mb-3">
                Así se verán las reseñas que recibas o envíes. Te mostramos dos ejemplos típicos: una positiva (5 estrellas) y una negativa (1 estrella) con el motivo y el comentario del autor.
              </p>

              {/* Ejemplo positivo: 5★ */}
              <div className="border border-emerald-100 rounded-xl p-3 mb-3 bg-emerald-50/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                    <span className="ml-1.5 text-sm font-bold text-gray-900">5.0</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                    <CheckCircle className="w-3 h-3" />
                    Liberada
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span>Pasajero anónimo</span>
                  <span>·</span>
                  <Calendar className="w-3 h-3" />
                  <span>Hace 3 días</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 mb-2 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <p className="text-[11px] text-gray-600 truncate flex-1">
                    <strong className="text-gray-800">Aeroparque</strong> → Av. Cabildo 2300, Belgrano
                  </p>
                </div>
                <div className="flex items-start gap-2 mb-1.5">
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700 flex-1">Conductor puntual y muy amable</p>
                </div>
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500 italic flex-1">"Llegó 5 minutos antes, me ayudó con las valijas y el auto estaba impecable. Excelente servicio, lo recomiendo."</p>
                </div>
              </div>

              {/* Ejemplo negativo: 1★ */}
              <div className="border border-red-100 rounded-xl p-3 bg-red-50/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${s <= 1 ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                      />
                    ))}
                    <span className="ml-1.5 text-sm font-bold text-gray-900">1.0</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">
                    <Clock className="w-3 h-3" />
                    En 5d
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <Lock className="w-3 h-3" />
                  <span>Autor oculto hasta liberación</span>
                  <span>·</span>
                  <Calendar className="w-3 h-3" />
                  <span>Hace 2 días</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 mb-2 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <p className="text-[11px] text-gray-600 truncate flex-1">
                    <strong className="text-gray-800">Microcentro</strong> → La Boca
                  </p>
                </div>
                <div className="flex items-start gap-2 mb-1.5">
                  <ThumbsDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700 flex-1">Vehículo en mal estado</p>
                </div>
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500 italic flex-1">"El auto estaba sucio por dentro y con olor a cigarrillo. Además el conductor fue mal educado cuando le pedí abrir la ventanilla."</p>
                </div>

              </div>

              {/* Nota sobre grabación de viajes */}
              <div className="mt-3 p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-start gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-sky-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-sky-900 leading-relaxed">
                  Si recibiste una calificación injusta, podés respaldarla con la grabación de video del viaje (cuando esté disponible). La grabación se comparte solo con la cooperativa para revisar el incidente y nunca se publica.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {ratings.map((rating) => {
              const isReleased = rating.releasedAt !== null;
              const daysLeft = daysUntilRelease(rating.visibleToRecipientAt);
              const isPositive = rating.stars >= 4;
              const isNegative = rating.stars <= 2;
              return (
                <div key={rating.id} className="bg-white rounded-2xl shadow-sm p-4">
                  {/* Top row: stars + status badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= rating.stars
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-200'
                          }`}
                        />
                      ))}
                      <span className="ml-1.5 text-sm font-bold text-gray-900">{rating.stars}.0</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                      <Lock className="w-3 h-3" />
                      Anónima
                    </span>
                  </div>

                  {/* Author / recipient line */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    {tab === 'received' ? (
                      <>
                        <Lock className="w-3 h-3" />
                        {rating.fromRole === 'driver' ? 'Conductor' : 'Pasajero'} anónimo
                      </>
                    ) : (
                      <>
                        Para: {rating.toRole === 'driver' ? 'Conductor' : 'Pasajero'}
                      </>
                    )}
                    <span>·</span>
                    <Calendar className="w-3 h-3" />
                    {formatDate(rating.createdAt)}
                  </div>

                  {/* Trip info */}
                  {rating.trip && (
                    <div className="bg-gray-50 rounded-xl p-2 mb-2 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <p className="text-[11px] text-gray-600 truncate flex-1">
                        <strong className="text-gray-800">{rating.trip.originName}</strong> → {rating.trip.destName}
                      </p>
                    </div>
                  )}

                  {/* Reason */}
                  {rating.reason && (
                    <div className="flex items-start gap-2 mb-1.5">
                      {isNegative ? (
                        <ThumbsDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      ) : isPositive ? (
                        <ThumbsUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      ) : null}
                      <p className="text-sm text-gray-700 flex-1">{rating.reason}</p>
                    </div>
                  )}

                  {/* Comment */}
                  {rating.comment && (
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-500 italic flex-1">"{rating.comment}"</p>
                    </div>
                  )}


                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
