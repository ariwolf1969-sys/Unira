'use client';

import { useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore, type Trip } from '@/lib/store';
import { formatCurrency, timeAgo } from '@/lib/utils';
import { vehicleTypes } from '@/lib/places';
import {
  ArrowLeft,
  Car,
  Utensils,
  Package,
  Clock,
  MapPin,
  Star,
  Phone,
  Download,
  Route as RouteIcon,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Navigation,
} from 'lucide-react';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  Trip['type'],
  { icon: React.ReactNode; label: string; color: string; bg: string }
> = {
  ride: {
    icon: <Car className="w-5 h-5" />,
    label: 'Viaje',
    color: 'text-[#0EA5A0]',
    bg: 'bg-[#0EA5A0]/10',
  },
  food: {
    icon: <Utensils className="w-5 h-5" />,
    label: 'Comida',
    color: 'text-[#FF8C42]',
    bg: 'bg-[#FF8C42]/10',
  },
  send: {
    icon: <Package className="w-5 h-5" />,
    label: 'Envío',
    color: 'text-[#3B82F6]',
    bg: 'bg-[#3B82F6]/10',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function TripDetailScreen() {
  const store = useAppStore();
  const { selectedTripId, tripHistory } = store;

  const trip = useMemo(
    () => tripHistory.find((t) => t.id === selectedTripId) || null,
    [tripHistory, selectedTripId]
  );

  const receiptRef = useRef<HTMLDivElement>(null);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedTripId]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleBack = () => {
    store.setSelectedTripId(null);
    store.setCurrentScreen('history');
  };

  const handlePrint = () => {
    // Open the print dialog — @media print CSS hides everything except .print-receipt
    window.print();
  };

  const handleShare = async () => {
    if (!trip) return;
    const text = `Viaje Unira ${trip.origin.name} → ${trip.destination.name} — ${formatCurrency(trip.fare)} (${trip.status === 'completed' ? 'completado' : 'cancelado'})`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Comprobante Unira', text });
      } else {
        await navigator.clipboard.writeText(text);
        store.showToast('Comprobante copiado al portapapeles', 'success');
      }
    } catch {
      // user cancelled share — no-op
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (!trip) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <RouteIcon className="w-9 h-9 text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Viaje no encontrado</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          Es posible que el viaje haya sido eliminado o que la sesión haya cambiado.
        </p>
        <button
          onClick={handleBack}
          className="px-5 py-2.5 bg-[#0EA5A0] text-white rounded-xl font-semibold text-sm hover:bg-[#0C8F8A] transition-colors"
        >
          Volver al historial
        </button>
      </div>
    );
  }

  const config = TYPE_CONFIG[trip.type];
  const isCompleted = trip.status === 'completed';
  const vehicle = vehicleTypes.find((v) => v.id === trip.vehicleType);
  const vehicleName = vehicle?.name || trip.vehicleType || 'Vehículo';
  const tripDate = new Date(trip.createdAt);

  // Fare breakdown estimate (best-effort from stored fields)
  const baseFare = vehicle?.basePrice || 0;
  const distanceFare = trip.distance ? Math.round(trip.distance * (vehicle?.perKm || 0)) : 0;
  const timeFare = trip.duration ? Math.round(trip.duration * (vehicle?.perMin || 0)) : 0;
  const otherFare = Math.max(0, trip.fare - baseFare - distanceFare - timeFare);

  // Map placeholders (when no route saved)
  const hasRoute = trip.route && trip.route.length >= 2;

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-32">
      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 bg-white sticky top-0 z-10 shadow-sm print:hidden">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className={`w-8 h-8 rounded-lg ${config.bg} ${config.color} flex items-center justify-center`}>
            {config.icon}
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Detalle del viaje</h1>
            <p className="text-[11px] text-gray-500 leading-tight">
              {tripDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
              {tripDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <button
          onClick={handleShare}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          aria-label="Compartir"
        >
          <Navigation className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* ─── Map with route ────────────────────────────────────────────── */}
      {hasRoute && (
        <div className="mx-4 mt-3 rounded-2xl overflow-hidden shadow-sm h-64 bg-white print:hidden">
          <MapView
            origin={{ ...trip.origin }}
            destination={{ ...trip.destination }}
            waypoints={trip.waypoints}
            onMapClick={undefined}
            selectMode={null}
            userLocation={null}
          />
        </div>
      )}

      {!hasRoute && (
        <div className="mx-4 mt-3 rounded-2xl bg-white border border-dashed border-gray-200 h-40 flex flex-col items-center justify-center print:hidden">
          <RouteIcon className="w-7 h-7 text-gray-300 mb-1" />
          <p className="text-xs text-gray-400">Sin recorrido guardado</p>
        </div>
      )}

      {/* ─── Status banner ─────────────────────────────────────────────── */}
      <div className="mx-4 mt-3">
        <div
          className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
            isCompleted ? 'bg-emerald-50' : 'bg-red-50'
          }`}
        >
          {isCompleted ? (
            <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-bold ${isCompleted ? 'text-emerald-700' : 'text-red-700'}`}>
              {isCompleted ? 'Viaje completado' : 'Viaje cancelado'}
            </p>
            <p className="text-xs text-gray-500">
              {timeAgo(trip.createdAt)} · {config.label}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Route summary card ────────────────────────────────────────── */}
      <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-900">Recorrido</h2>
        </div>

        {/* Origin */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center pt-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
            {trip.waypoints && trip.waypoints.length > 0 && (
              <div className="w-0.5 h-full min-h-[20px] bg-gray-200 my-1" />
            )}
          </div>
          <div className="flex-1 pb-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase">Origen</p>
            <p className="text-sm font-medium text-gray-900">{trip.origin.name}</p>
            {trip.origin.address && trip.origin.address !== trip.origin.name && (
              <p className="text-xs text-gray-500 line-clamp-2">{trip.origin.address}</p>
            )}
          </div>
        </div>

        {/* Waypoints */}
        {trip.waypoints?.map((wp, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-100" />
              {i < trip.waypoints!.length - 1 && (
                <div className="w-0.5 h-full min-h-[20px] bg-gray-200 my-1" />
              )}
            </div>
            <div className="flex-1 pb-3">
              <p className="text-[10px] font-semibold text-amber-500 uppercase">Parada {i + 1}</p>
              <p className="text-sm font-medium text-gray-900">{wp.name}</p>
              {wp.address && wp.address !== wp.name && (
                <p className="text-xs text-gray-500 line-clamp-2">{wp.address}</p>
              )}
            </div>
          </div>
        ))}

        {/* Destination */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center pt-1">
            <div className="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-100" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase">Destino</p>
            <p className="text-sm font-medium text-gray-900">{trip.destination.name}</p>
            {trip.destination.address && trip.destination.address !== trip.destination.name && (
              <p className="text-xs text-gray-500 line-clamp-2">{trip.destination.address}</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Driver card (only for ride type) ──────────────────────────── */}
      {trip.type === 'ride' && trip.driverName && (
        <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Conductor</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0EA5A0] to-[#0C8F8A] flex items-center justify-center text-white font-bold text-base">
              {trip.driverName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{trip.driverName}</p>
              {trip.driverVehicle && (
                <p className="text-xs text-gray-500">{trip.driverVehicle}</p>
              )}
              {trip.rating && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs text-gray-600">{trip.rating}.0</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Stats grid ────────────────────────────────────────────────── */}
      <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
          <RouteIcon className="w-4 h-4 text-gray-400 mx-auto mb-1" />
          <p className="text-base font-bold text-gray-900">
            {trip.distance ? `${trip.distance} km` : '—'}
          </p>
          <p className="text-[10px] text-gray-500">Distancia</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
          <Clock className="w-4 h-4 text-gray-400 mx-auto mb-1" />
          <p className="text-base font-bold text-gray-900">
            {trip.duration ? `${trip.duration} min` : '—'}
          </p>
          <p className="text-[10px] text-gray-500">Duración</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
          <Car className="w-4 h-4 text-gray-400 mx-auto mb-1" />
          <p className="text-base font-bold text-gray-900 truncate">{vehicleName}</p>
          <p className="text-[10px] text-gray-500">Vehículo</p>
        </div>
      </div>

      {/* ─── Fare breakdown card ───────────────────────────────────────── */}
      <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-900">Detalle del precio</h2>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tarifa base</span>
            <span className="text-gray-900 font-medium">{formatCurrency(baseFare)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Distancia ({trip.distance ? `${trip.distance} km` : '—'})</span>
            <span className="text-gray-900 font-medium">{formatCurrency(distanceFare)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tiempo ({trip.duration ? `${trip.duration} min` : '—'})</span>
            <span className="text-gray-900 font-medium">{formatCurrency(timeFare)}</span>
          </div>
          {otherFare > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Otros (propina / extras)</span>
              <span className="text-gray-900 font-medium">{formatCurrency(otherFare)}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-900">Total</span>
            <span className="text-lg font-bold text-[#0EA5A0]">{formatCurrency(trip.fare)}</span>
          </div>
        </div>
      </div>

      {/* ─── Action buttons ────────────────────────────────────────────── */}
      <div className="mx-4 mt-3 flex gap-2 print:hidden">
        <button
          onClick={handlePrint}
          className="flex-1 bg-[#0EA5A0] text-white rounded-2xl py-3 font-semibold text-sm hover:bg-[#0C8F8A] transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Descargar comprobante
        </button>
      </div>

      {/* ─── Hidden printable receipt (visible only when printing) ─────── */}
      <div ref={receiptRef} className="print-receipt" aria-hidden="true">
        <PrintableReceipt trip={trip} vehicleName={vehicleName} />
      </div>

      {/* ─── Print-only CSS ────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-receipt, .print-receipt * { visibility: visible !important; }
          .print-receipt {
            position: absolute !important;
            top: 0;
            left: 0;
            right: 0;
            padding: 24px;
            background: #fff;
            color: #111;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 12px;
            line-height: 1.5;
          }
          .print-receipt h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
          .print-receipt h2 { font-size: 13px; font-weight: 600; margin: 16px 0 6px; color: #444; text-transform: uppercase; letter-spacing: 0.5px; }
          .print-receipt .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0EA5A0; padding-bottom: 8px; margin-bottom: 12px; }
          .print-receipt .logo { color: #0EA5A0; font-weight: 800; font-size: 22px; }
          .print-receipt .meta { text-align: right; font-size: 10px; color: #555; }
          .print-receipt .row { display: flex; justify-content: space-between; padding: 3px 0; }
          .print-receipt .total { border-top: 1px solid #ccc; margin-top: 8px; padding-top: 8px; font-size: 14px; font-weight: 700; }
          .print-receipt .route { padding: 6px 0; }
          .print-receipt .footer { margin-top: 20px; padding-top: 8px; border-top: 1px dashed #ccc; font-size: 10px; color: #777; text-align: center; }
          @page { margin: 12mm; }
        }
        .print-receipt { display: none; }
        @media print {
          .print-receipt { display: block !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Printable receipt component (rendered hidden, only visible on print) ─────

function PrintableReceipt({ trip, vehicleName }: { trip: Trip; vehicleName: string }) {
  const vehicle = vehicleTypes.find((v) => v.id === trip.vehicleType);
  const baseFare = vehicle?.basePrice || 0;
  const distanceFare = trip.distance ? Math.round(trip.distance * (vehicle?.perKm || 0)) : 0;
  const timeFare = trip.duration ? Math.round(trip.duration * (vehicle?.perMin || 0)) : 0;
  const otherFare = Math.max(0, trip.fare - baseFare - distanceFare - timeFare);
  const date = new Date(trip.createdAt);

  const typeLabel = trip.type === 'ride' ? 'Viaje' : trip.type === 'food' ? 'Comida' : 'Envío';

  return (
    <div>
      <div className="header">
        <div>
          <div className="logo">TEYEVO</div>
          <div style={{ fontSize: 11, color: '#555' }}>Cooperativa de transporte</div>
        </div>
        <div className="meta">
          <div><strong>Comprobante N°</strong> {trip.id.slice(-8).toUpperCase()}</div>
          <div>{date.toLocaleDateString('es-AR')} {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div>Tipo: {typeLabel}</div>
        </div>
      </div>

      <h2>Recorrido</h2>
      <div className="route">
        <div className="row"><span>Origen</span><strong>{trip.origin.name}</strong></div>
        {trip.origin.address && trip.origin.address !== trip.origin.name && (
          <div className="row"><span></span><span>{trip.origin.address}</span></div>
        )}
        {trip.waypoints?.map((wp, i) => (
          <div key={i}>
            <div className="row"><span>Parada {i + 1}</span><strong>{wp.name}</strong></div>
          </div>
        ))}
        <div className="row"><span>Destino</span><strong>{trip.destination.name}</strong></div>
        {trip.destination.address && trip.destination.address !== trip.destination.name && (
          <div className="row"><span></span><span>{trip.destination.address}</span></div>
        )}
      </div>

      {trip.type === 'ride' && trip.driverName && (
        <>
          <h2>Conductor</h2>
          <div className="row"><span>Nombre</span><strong>{trip.driverName}</strong></div>
          {trip.driverVehicle && <div className="row"><span>Vehículo</span><span>{trip.driverVehicle}</span></div>}
          {trip.rating && <div className="row"><span>Calificación</span><span>{trip.rating} / 5 ★</span></div>}
        </>
      )}

      <h2>Detalle del precio</h2>
      <div className="row"><span>Tarifa base</span><span>$ {baseFare.toLocaleString('es-AR')}</span></div>
      <div className="row"><span>Distancia ({trip.distance ? `${trip.distance} km` : '—'})</span><span>$ {distanceFare.toLocaleString('es-AR')}</span></div>
      <div className="row"><span>Tiempo ({trip.duration ? `${trip.duration} min` : '—'})</span><span>$ {timeFare.toLocaleString('es-AR')}</span></div>
      {otherFare > 0 && (
        <div className="row"><span>Otros</span><span>$ {otherFare.toLocaleString('es-AR')}</span></div>
      )}
      <div className="row total"><span>Total</span><span>$ {trip.fare.toLocaleString('es-AR')}</span></div>

      <div className="footer">
        Este comprobante fue generado automáticamente por la app Unira.<br />
        Cooperativa Unira · CUIT 30-XXXXXXXX-N · Buenos Aires, Argentina<br />
        Para reclamos: ayuda@unira.app · +54 9 11 5597-6414
      </div>
    </div>
  );
}
