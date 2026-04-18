'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAppStore, type Trip } from '@/lib/store';
import { formatCurrency, timeAgo } from '@/lib/utils';
import {
  ArrowLeft,
  Car,
  Utensils,
  Package,
  Clock,
  MapPin,
  ChevronRight,
  Activity,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const FILTER_TABS = ['Todos', 'Viajes', 'Comidas', 'Envíos'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

const TYPE_CONFIG: Record<
  Trip['type'],
  { icon: React.ReactNode; label: string; color: string; border: string; bg: string }
> = {
  ride: {
    icon: <Car className="w-5 h-5" />,
    label: 'Viaje',
    color: 'text-[#0EA5A0]',
    border: 'border-l-[#0EA5A0]',
    bg: 'bg-[#0EA5A0]/10',
  },
  food: {
    icon: <Utensils className="w-5 h-5" />,
    label: 'Comida',
    color: 'text-[#FF8C42]',
    border: 'border-l-[#FF8C42]',
    bg: 'bg-[#FF8C42]/10',
  },
  send: {
    icon: <Package className="w-5 h-5" />,
    label: 'Envío',
    color: 'text-[#3B82F6]',
    border: 'border-l-[#3B82F6]',
    bg: 'bg-[#3B82F6]/10',
  },
};

// ─── Date Grouping Helper ────────────────────────────────────────────────────

function getDateGroup(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDate.getTime() === today.getTime()) return 'Hoy';
  if (itemDate.getTime() === yesterday.getTime()) return 'Ayer';
  if (itemDate.getTime() >= weekStart.getTime()) return 'Esta semana';
  return 'Más antiguo';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HistoryScreen() {
  const store = useAppStore();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('Todos');

  // Filter trips
  const filteredTrips = useMemo(() => {
    const typeMap: Record<FilterTab, Trip['type'] | null> = {
      Todos: null,
      Viajes: 'ride',
      Comidas: 'food',
      Envíos: 'send',
    };
    const typeFilter = typeMap[activeFilter];
    if (!typeFilter) return store.tripHistory;
    return store.tripHistory.filter((t) => t.type === typeFilter);
  }, [store.tripHistory, activeFilter]);

  // Group trips by date
  const groupedTrips = useMemo(() => {
    const groups: { label: string; items: Trip[] }[] = [];
    let currentGroup = '';

    filteredTrips.forEach((t) => {
      const group = getDateGroup(t.createdAt);
      if (group !== currentGroup) {
        currentGroup = group;
        groups.push({ label: group, items: [t] });
      } else {
        groups[groups.length - 1].items.push(t);
      }
    });

    return groups;
  }, [filteredTrips]);

  // Handle card click
  const handleTripClick = useCallback(
    (trip: Trip) => {
      const typeLabel = TYPE_CONFIG[trip.type]?.label || 'Servicio';
      const statusLabel = trip.status === 'completed' ? 'Completado' : 'Cancelado';
      store.showToast(
        `${typeLabel}: ${trip.origin.name} → ${trip.destination.name} — ${formatCurrency(trip.fare)} (${statusLabel})`,
        'info'
      );
    },
    [store]
  );

  return (
    <div className="relative min-h-[100dvh] bg-[#F5F7FA] pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => store.setCurrentScreen('home')}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-[#0EA5A0]" />
          <h1 className="text-xl font-bold text-gray-900">Actividad</h1>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 mt-3">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeFilter === tab
                  ? 'bg-[#0EA5A0] text-white shadow-sm shadow-[#0EA5A0]/25'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Trip List */}
      {groupedTrips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Clock className="w-9 h-9 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Sin actividad reciente</h3>
          <p className="text-sm text-gray-500 text-center">
            No tenés registros de actividad con este filtro. Los viajes y pedidos aparecerán acá.
          </p>
        </div>
      ) : (
        <div className="px-4 mt-4 space-y-5 pb-4">
          {groupedTrips.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map((trip) => {
                  const config = TYPE_CONFIG[trip.type];
                  const isCompleted = trip.status === 'completed';

                  return (
                    <button
                      key={trip.id}
                      onClick={() => handleTripClick(trip)}
                      className={`w-full bg-white rounded-2xl shadow-sm border-l-4 ${config.border} p-4 hover:shadow-md active:scale-[0.98] transition-all text-left`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Type Icon */}
                        <div
                          className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0 ${config.color}`}
                        >
                          {config.icon}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-bold ${config.color} uppercase tracking-wide`}
                            >
                              {config.label}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                isCompleted
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-red-50 text-red-500'
                              }`}
                            >
                              {isCompleted ? 'Completado' : 'Cancelado'}
                            </span>
                          </div>

                          {/* Route */}
                          <div className="mt-1.5 space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                              <p className="text-xs text-gray-600 truncate">
                                {trip.origin.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                              <p className="text-xs text-gray-600 truncate">
                                {trip.destination.name}
                              </p>
                            </div>
                          </div>

                          {/* Date & Price */}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1 text-gray-400">
                              <Clock className="w-3 h-3" />
                              <span className="text-[11px]">{timeAgo(trip.createdAt)}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">
                              {formatCurrency(trip.fare)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
