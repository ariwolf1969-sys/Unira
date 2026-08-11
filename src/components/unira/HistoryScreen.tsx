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
  ChevronRight,
  Activity,
  Calendar,
  X,
  Filter,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const FILTER_TABS = ['Todos', 'Viajes', 'Comidas', 'Envíos'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

const DATE_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'range', label: 'Rango...' },
] as const;
type DateFilterId = (typeof DATE_FILTERS)[number]['id'];

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

function getDateGroup(date: Date | string): string {
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
  const [dateFilter, setDateFilter] = useState<DateFilterId>('all');
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');

  // Apply both type filter and date filter
  const filteredTrips = useMemo(() => {
    const typeMap: Record<FilterTab, Trip['type'] | null> = {
      Todos: null,
      Viajes: 'ride',
      Comidas: 'food',
      Envíos: 'send',
    };
    const typeFilter = typeMap[activeFilter];

    let result = store.tripHistory;
    if (typeFilter) result = result.filter((t) => t.type === typeFilter);

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoff: Date | null = null;
      let rangeStartDt: Date | null = null;
      let rangeEndDt: Date | null = null;

      if (dateFilter === '7d') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateFilter === '30d') {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (dateFilter === 'month') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (dateFilter === 'range') {
        if (rangeStart) rangeStartDt = new Date(rangeStart + 'T00:00:00');
        if (rangeEnd) rangeEndDt = new Date(rangeEnd + 'T23:59:59');
      }

      result = result.filter((t) => {
        const d = new Date(t.createdAt);
        if (dateFilter === 'range') {
          if (rangeStartDt && d < rangeStartDt) return false;
          if (rangeEndDt && d > rangeEndDt) return false;
          return true;
        }
        return cutoff ? d >= cutoff : true;
      });
    }

    return result;
  }, [store.tripHistory, activeFilter, dateFilter, rangeStart, rangeEnd]);

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

  // Handle card click — open trip detail
  const handleTripClick = useCallback(
    (trip: Trip) => {
      store.openTripDetail(trip.id);
    },
    [store]
  );

  const handleDateFilterClick = (id: DateFilterId) => {
    if (id === 'range') {
      setShowRangePicker(true);
    } else {
      setDateFilter(id);
      setShowRangePicker(false);
    }
  };

  const applyRange = () => {
    setDateFilter('range');
    setShowRangePicker(false);
  };

  const clearRange = () => {
    setRangeStart('');
    setRangeEnd('');
    setDateFilter('all');
    setShowRangePicker(false);
  };

  const activeDateFilterLabel = useMemo(() => {
    if (dateFilter === 'range' && (rangeStart || rangeEnd)) {
      const fmt = (s: string) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '…';
      return `${fmt(rangeStart)} - ${fmt(rangeEnd)}`;
    }
    return DATE_FILTERS.find((f) => f.id === dateFilter)?.label || 'Todos';
  }, [dateFilter, rangeStart, rangeEnd]);

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

      {/* Type Filter Tabs */}
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

      {/* Date Filter Chips */}
      <div className="px-4 mt-2">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-full bg-white text-gray-500">
            <Calendar className="w-3 h-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Filtro</span>
          </div>
          {DATE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => handleDateFilterClick(f.id)}
              className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-all ${
                dateFilter === f.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
          {dateFilter !== 'all' && (
            <button
              onClick={() => { setDateFilter('all'); setRangeStart(''); setRangeEnd(''); }}
              className="flex-shrink-0 px-2 py-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-all"
              aria-label="Quitar filtro de fecha"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {dateFilter !== 'all' && (
          <p className="text-[10px] text-gray-500 mt-1.5 px-2">
            Mostrando: <strong className="text-gray-700">{activeDateFilterLabel}</strong> · {filteredTrips.length} resultado{filteredTrips.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Range picker modal */}
      {showRangePicker && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowRangePicker(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Seleccionar rango</h3>
              <button
                onClick={() => setShowRangePicker(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Desde</label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#0EA5A0]/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Hasta</label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#0EA5A0]/30"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={clearRange}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors"
                >
                  Limpiar
                </button>
                <button
                  onClick={applyRange}
                  disabled={!rangeStart && !rangeEnd}
                  className="flex-1 py-2.5 rounded-xl bg-[#0EA5A0] text-white font-semibold text-sm hover:bg-[#0C8F8A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trip List */}
      {groupedTrips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            {dateFilter !== 'all' ? <Filter className="w-9 h-9 text-gray-400" /> : <Clock className="w-9 h-9 text-gray-400" />}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {dateFilter !== 'all' ? 'Sin resultados en este rango' : 'Sin actividad reciente'}
          </h3>
          <p className="text-sm text-gray-500 text-center">
            {dateFilter !== 'all'
              ? 'No se encontraron viajes con el filtro seleccionado. Probá con otro rango o tipo.'
              : 'No tenés registros de actividad con este filtro. Los viajes y pedidos aparecerán acá.'}
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
                              {trip.distance ? (
                                <>
                                  <span className="text-gray-300 mx-1">·</span>
                                  <span className="text-[11px]">{trip.distance} km</span>
                                </>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-bold text-gray-900">
                                {formatCurrency(trip.fare)}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                            </div>
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
