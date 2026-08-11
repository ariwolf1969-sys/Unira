'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore, type Trip } from '@/lib/store';
import { timeAgo } from '@/lib/utils';
import { compressImage } from '@/lib/image';
import {
  ArrowLeft,
  Search,
  Package,
  Plus,
  X,
  Camera,
  ChevronRight,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Backpack,
  Smartphone,
  Wallet,
  Key,
  Glasses,
  BookOpen,
  CircleHelp,
  Users,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LostItem {
  id: string;
  reporterType: 'passenger' | 'driver';
  reporterId: string;
  reporterName: string;
  reporterPhone: string;
  tripId?: string | null;
  itemType: string;
  description: string;
  photo?: string;
  status: 'open' | 'matched' | 'closed';
  foundLocation?: string;
  createdAt: string;
  resolvedAt?: string | null;
}

type Tab = 'mine' | 'found' | 'report';

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEM_TYPES = [
  { id: 'mochila', label: 'Mochila / Bolso', icon: Backpack },
  { id: 'celular', label: 'Celular / Tablet', icon: Smartphone },
  { id: 'billetera', label: 'Billetera / Documentos', icon: Wallet },
  { id: 'llaves', label: 'Llaves', icon: Key },
  { id: 'anteojo', label: 'Anteojos', icon: Glasses },
  { id: 'libro', label: 'Libro / Cuaderno', icon: BookOpen },
  { id: 'otro', label: 'Otro objeto', icon: Package },
];

const STATUS_CONFIG: Record<LostItem['status'], { label: string; color: string; bg: string }> = {
  open: { label: 'Abierto', color: 'text-amber-700', bg: 'bg-amber-50' },
  matched: { label: 'Con coincidencia', color: 'text-sky-700', bg: 'bg-sky-50' },
  closed: { label: 'Resuelto', color: 'text-emerald-700', bg: 'bg-emerald-50' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function LostItemsScreen() {
  const store = useAppStore();
  const [tab, setTab] = useState<Tab>('mine');
  const [myItems, setMyItems] = useState<LostItem[]>([]);
  const [foundItems, setFoundItems] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!store.user) return;
    setLoading(true);
    try {
      const [mineRes, foundRes] = await Promise.all([
        fetch(`/api/lost-items?userId=${store.user.uid}`),
        fetch('/api/lost-items?found=true'),
      ]);
      const mine = mineRes.ok ? ((await mineRes.json()).items as LostItem[]) : [];
      const found = foundRes.ok ? ((await foundRes.json()).items as LostItem[]) : [];
      setMyItems(mine);
      setFoundItems(found);
    } catch (err) {
      console.warn('[lost-items] fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [store.user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleBack = () => {
    store.setCurrentScreen('profile');
  };

  const handleSubmitted = () => {
    setShowForm(false);
    setTab('mine');
    fetchItems();
    store.showToast('Reporte creado. Te avisaremos si hay coincidencia.', 'success');
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Package className="w-5 h-5 text-violet-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Objetos perdidos</h1>
        </div>
      </div>

      {/* Info banner */}
      <div className="mx-4 mt-3 bg-violet-50 rounded-2xl p-3 flex items-start gap-2">
        <CircleHelp className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-violet-900 leading-snug">
          Si perdiste algo en un viaje, reportalo acá. Los conductores ven la lista y pueden contactarte si encuentran tu objeto.
        </p>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-3">
        <div className="flex gap-2">
          {([
            { id: 'mine', label: `Mis reportes${myItems.length > 0 ? ` (${myItems.length})` : ''}` },
            { id: 'found', label: `Encontrados${foundItems.length > 0 ? ` (${foundItems.length})` : ''}` },
            { id: 'report', label: 'Reportar' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => t.id === 'report' ? setShowForm(true) : setTab(t.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                tab === t.id && t.id !== 'report'
                  ? 'bg-[#0EA5A0] text-white shadow-sm'
                  : t.id === 'report'
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/25'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.id === 'report' && <Plus className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-2" />
            <p className="text-sm text-gray-500">Cargando...</p>
          </div>
        ) : tab === 'mine' ? (
          myItems.length === 0 ? (
            <EmptyState
              icon={<Package className="w-9 h-9 text-gray-400" />}
              title="Sin reportes"
              message="Todavía no reportaste objetos perdidos. Tocá «Reportar» para crear uno."
            />
          ) : (
            <div className="space-y-2">
              {myItems.map((item) => (
                <ItemCard key={item.id} item={item} onContact={undefined} isMine />
              ))}
            </div>
          )
        ) : tab === 'found' ? (
          foundItems.length === 0 ? (
            <EmptyState
              icon={<Search className="w-9 h-9 text-gray-400" />}
              title="Sin hallazgos reportados"
              message="Los conductores que encuentren objetos los publicarán acá. Volvé a revisar más tarde."
            />
          ) : (
            <div className="space-y-2">
              {foundItems.map((item) => (
                <ItemCard key={item.id} item={item} onContact={() => handleContact(item)} />
              ))}
            </div>
          )
        ) : null}
      </div>

      {/* Report form modal */}
      {showForm && (
        <ReportForm
          onClose={() => setShowForm(false)}
          onSubmitted={handleSubmitted}
          recentTrips={store.tripHistory}
        />
      )}
    </div>
  );

  function handleContact(item: LostItem) {
    if (!store.user) return;
    const msg = `Hola ${item.reporterName}, vi tu reporte de "${item.itemType}" en Unira. Mi contacto: ${store.user.phone || ''}`;
    store.showToast(`Llamá al ${item.reporterPhone} para coordinar`, 'info');
    // Optionally open tel: link
    if (typeof window !== 'undefined') {
      try {
        navigator.clipboard?.writeText(item.reporterPhone);
      } catch {
        // ignore
      }
    }
    void msg;
  }
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 text-center">{message}</p>
    </div>
  );
}

// ─── Item Card ───────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onContact,
  isMine = false,
}: {
  item: LostItem;
  onContact?: () => void;
  isMine?: boolean;
}) {
  const status = STATUS_CONFIG[item.status];
  const typeConfig = ITEM_TYPES.find((t) => t.id === item.itemType) || ITEM_TYPES[ITEM_TYPES.length - 1];
  const TypeIcon = typeConfig.icon;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-start gap-3">
        {item.photo ? (
          <img
            src={item.photo}
            alt={item.itemType}
            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-gray-100"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <TypeIcon className="w-6 h-6 text-violet-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900 truncate">{typeConfig.label}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.description}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {timeAgo(item.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {item.reporterType === 'driver' ? 'Conductor' : 'Pasajero'}
            </span>
            {item.foundLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {item.foundLocation}
              </span>
            )}
          </div>
          {!isMine && item.status === 'open' && onContact && (
            <button
              onClick={onContact}
              className="mt-2 w-full bg-violet-50 text-violet-700 rounded-xl py-2 text-xs font-semibold hover:bg-violet-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              Contactar al conductor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Report Form ─────────────────────────────────────────────────────────────

function ReportForm({
  onClose,
  onSubmitted,
  recentTrips,
}: {
  onClose: () => void;
  onSubmitted: () => void;
  recentTrips: Trip[];
}) {
  const store = useAppStore();
  const [itemType, setItemType] = useState<string>('mochila');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string>('');
  const [tripId, setTripId] = useState<string>('');
  const [foundLocation, setFoundLocation] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Driver vs passenger — depends on store.role
  const isDriver = store.user?.isDriver === true;

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 800, 0.7);
      setPhoto(compressed.dataUrl);
    } catch (err) {
      console.warn('[photo] compress failed', err);
      store.showToast('No se pudo procesar la foto', 'error');
    }
  };

  const handleSubmit = async () => {
    if (!store.user) return;
    if (!description.trim()) {
      store.showToast('Agregá una descripción del objeto', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/lost-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterType: isDriver ? 'driver' : 'passenger',
          reporterId: store.user.uid,
          reporterName: store.user.name,
          reporterPhone: store.user.phone,
          tripId: tripId || null,
          itemType,
          description: description.trim(),
          photo,
          foundLocation: isDriver ? foundLocation.trim() : '',
        }),
      });
      if (!res.ok) throw new Error('POST failed');
      onSubmitted();
    } catch (err) {
      console.warn('[lost-items] submit failed', err);
      store.showToast('Error al crear el reporte', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90dvh] overflow-y-auto hide-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isDriver ? 'Reportar hallazgo' : 'Reportar objeto perdido'}
            </h2>
            <p className="text-xs text-gray-500">
              {isDriver
                ? 'Publicá el objeto que encontraste en tu vehículo.'
                : 'Describí el objeto que perdiste para que el conductor pueda contactarte.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Item type picker */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de objeto</label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {ITEM_TYPES.map((t) => {
                const Icon = t.icon;
                const active = itemType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setItemType(t.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                      active ? 'bg-violet-100 border-2 border-violet-400' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-violet-600' : 'text-gray-500'}`} />
                    <span className={`text-[10px] font-medium text-center leading-tight ${active ? 'text-violet-700' : 'text-gray-600'}`}>
                      {t.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Color, marca, contenido, características distintivas..."
              className="w-full mt-2 px-3 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
              maxLength={500}
            />
            <p className="text-[10px] text-gray-400 text-right mt-0.5">{description.length}/500</p>
          </div>

          {/* Photo */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Foto (opcional)</label>
            <div className="mt-2">
              {photo ? (
                <div className="relative">
                  <img src={photo} alt="preview" className="w-full h-40 rounded-xl object-cover" />
                  <button
                    onClick={() => setPhoto('')}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                  <Camera className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Tocá para subir una foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhoto}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Associated trip (passenger only) */}
          {!isDriver && recentTrips.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Viaje asociado (opcional)</label>
              <select
                value={tripId}
                onChange={(e) => setTripId(e.target.value)}
                className="w-full mt-2 px-3 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-violet-400/30"
              >
                <option value="">— Sin viaje asociado —</option>
                {recentTrips.slice(0, 10).map((t) => (
                  <option key={t.id} value={t.id}>
                    {new Date(t.createdAt).toLocaleDateString('es-AR')} · {t.origin.name} → {t.destination.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Found location (driver only) */}
          {isDriver && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dónde lo encontraste (opcional)</label>
              <input
                type="text"
                value={foundLocation}
                onChange={(e) => setFoundLocation(e.target.value)}
                placeholder="Ej: Asiento trasero derecho, baúl..."
                className="w-full mt-2 px-3 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-violet-400/30"
                maxLength={100}
              />
            </div>
          )}

          {/* Contact info (read-only) */}
          <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="text-xs">
              <p className="text-gray-500">Te contactarán al:</p>
              <p className="font-semibold text-gray-900">{store.user?.phone || 'Sin teléfono'}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Publicar reporte
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
