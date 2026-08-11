'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import {
  ArrowLeft,
  Car,
  DollarSign,
  Zap,
  Clock,
  MapPin,
  Save,
  Loader2,
  CheckCircle,
  Radar,
  Plus,
  Trash2,
  Navigation,
  CreditCard,
  Banknote,
  AlertTriangle,
  Search,
  X,
  Building2,
  User as UserIcon,
  Wind,
  Radio,
  VolumeX,
  Cigarette,
  PawPrint,
  Armchair,
  Luggage,

  UserCircle,
  ShieldBan,
  Phone,
  MessageSquare,
  PhoneCall,
} from 'lucide-react';
import { findDangerousZone } from '@/lib/dangerousZones';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScheduleEntry {
  day: number; // 0 = Sunday, 6 = Saturday
  from: string; // "HH:mm"
  to: string; // "HH:mm"
}

interface PreferredZone {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

type PaymentMethod = 'cash' | 'credit_card';
type TripPreference = 'ac' | 'radio' | 'silence' | 'smoking' | 'pets' | 'front_seat' | 'luggage' | 'children';
type GenderOption = 'any' | 'male' | 'female';

interface DriverConfig {
  userId: string;
  communicationPreference: 'both' | 'calls' | 'messages';
  maxPickupKm: number;
  minFare: number;
  minPerKm: number;
  minPassengerRating: number;
  autoAccept: boolean;
  schedule: ScheduleEntry[];
  preferredZones: PreferredZone[];
  radarAlertsEnabled: boolean;
  radarAlertRadius: number;
  // Modo Destino
  destinationModeEnabled: boolean;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationRadiusKm: number;
  // Payment methods
  acceptedPaymentMethods: PaymentMethod[];
  // Datos para depósitos (CBU/CVU)
  cbuAlias: string;
  cbuNumber: string;
  cbuHolderName: string;
  // Preferences
  genderPreference: GenderOption;
  tripPreferences: TripPreference[];
  smokingAllowed: boolean;
  petsAllowed: boolean;
  musicAllowed: boolean;
  prefersSilence: boolean;
  hasAC: boolean;
  driverGender: string;
  minDriverRating: number;
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: typeof Banknote; color: string; bg: string }[] = [
  { id: 'cash', label: 'Efectivo', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'credit_card', label: 'Tarjeta de crédito', icon: CreditCard, color: 'text-sky-600', bg: 'bg-sky-50' },
];

const TRIP_PREFS: { id: TripPreference; label: string; desc: string; icon: typeof Wind }[] = [
  { id: 'ac', label: 'Aire acondicionado', desc: 'El vehículo tiene aire acondicionado', icon: Wind },
  { id: 'radio', label: 'Radio / Música', desc: 'Se permite escuchar música o radio durante el viaje', icon: Radio },
  { id: 'silence', label: 'Viaje silencioso', desc: 'El conductor prefiere viajar en silencio', icon: VolumeX },
  { id: 'smoking', label: 'Se permite fumar', desc: 'Los pasajeros pueden fumar en el vehículo', icon: Cigarette },
  { id: 'pets', label: 'Mascotas permitidas', desc: 'Se permiten mascotas en el vehículo', icon: PawPrint },
  { id: 'front_seat', label: 'Asiento delantero', desc: 'El pasajero puede ocupar el asiento delantero', icon: Armchair },
  { id: 'luggage', label: 'Equipaje grande', desc: 'El vehículo tiene espacio para equipaje grande', icon: Luggage },
];

const GENDER_OPTIONS: { id: GenderOption; label: string; icon: typeof UserCircle }[] = [
  { id: 'any', label: 'Indistinto', icon: UserCircle },
  { id: 'male', label: 'Conductor hombre', icon: UserCircle },
  { id: 'female', label: 'Conductora mujer', icon: UserCircle },
];

// ─── Address search (Nominatim) ──────────────────────────────────────────────

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DriverConfigScreen() {
  const store = useAppStore();
  const [config, setConfig] = useState<DriverConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [degraded, setDegraded] = useState(false);

  // Address search state (Modo Destino)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load config on mount
  useEffect(() => {
    if (!store.user?.uid) return;
    if (store.user.uid === 'demo') {
      const demoCfg: DriverConfig = {
        userId: 'demo',
        maxPickupKm: 10,
        minFare: 0,
        minPerKm: 0,
            minPassengerRating: 0,
        autoAccept: false,
        schedule: [],
        preferredZones: [],
        radarAlertsEnabled: true,
        radarAlertRadius: 300,
        destinationModeEnabled: false,
        destinationAddress: '',
        destinationLat: 0,
        destinationLng: 0,
        destinationRadiusKm: 4,
        acceptedPaymentMethods: [],
        cbuAlias: '',
        cbuNumber: '',
        cbuHolderName: '',
        genderPreference: 'any',
        communicationPreference: 'both' as const,
        tripPreferences: [],
        smokingAllowed: false,
        petsAllowed: true,
        musicAllowed: true,
        prefersSilence: false,
        hasAC: true,
        driverGender: '',
        minDriverRating: 0,
      };
      setConfig(demoCfg);
      setSearchQuery(demoCfg.destinationAddress);
      setLoading(false);
      return;
    }
    void fetch(`/api/driver-config?userId=${store.user.uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          const cfg = data.config as DriverConfig;
          setConfig(cfg);
          setSearchQuery(cfg.destinationAddress);
          if (data.degraded) setDegraded(true);
        } else {
          setConfig({
            userId: store.user!.uid,
            maxPickupKm: 10,
            minFare: 0,
            minPerKm: 0,
            minPassengerRating: 0,
            autoAccept: false,
            schedule: [],
            preferredZones: [],
            radarAlertsEnabled: true,
            radarAlertRadius: 300,
            destinationModeEnabled: false,
            destinationAddress: '',
            destinationLat: 0,
            destinationLng: 0,
            destinationRadiusKm: 4,
            acceptedPaymentMethods: [],
            cbuAlias: '',
            cbuNumber: '',
            cbuHolderName: '',
            genderPreference: 'any',
            communicationPreference: 'both' as const,
            tripPreferences: [],
            smokingAllowed: false,
            petsAllowed: true,
            musicAllowed: true,
            prefersSilence: false,
            hasAC: true,
            driverGender: '',
            minDriverRating: 0,
          });
        }
      })
      .catch((err) => {
        console.warn('[driver-config] load failed:', err);
        setConfig({
          userId: store.user!.uid,
          maxPickupKm: 10,
          minFare: 0,
          minPerKm: 0,
            minPassengerRating: 0,
          autoAccept: false,
          schedule: [],
          preferredZones: [],
          radarAlertsEnabled: true,
          radarAlertRadius: 300,
          destinationModeEnabled: false,
          destinationAddress: '',
          destinationLat: 0,
          destinationLng: 0,
          destinationRadiusKm: 4,
          acceptedPaymentMethods: [],
          cbuAlias: '',
          cbuNumber: '',
          cbuHolderName: '',
          genderPreference: 'any',
          communicationPreference: 'both' as const,
          tripPreferences: [],
          smokingAllowed: false,
          petsAllowed: true,
          musicAllowed: true,
          prefersSilence: false,
          hasAC: true,
          driverGender: '',
          minDriverRating: 0,
        });
      })
      .finally(() => setLoading(false));
  }, [store.user?.uid]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const update = useCallback(<K extends keyof DriverConfig>(key: K, value: DriverConfig[K]) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedAt(null);
  }, []);

  // Debounced Nominatim address search (limited to Argentina for relevance)
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ar&limit=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'es', 'User-Agent': 'TEYEVOApp/1.0 (cooperativa)' },
      });
      if (!res.ok) {
        setSearchResults([]);
        return;
      }
      const data = (await res.json()) as NominatimResult[];
      setSearchResults(data);
      setShowResults(true);
    } catch (err) {
      console.warn('[destino] search failed:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onSearchChange = useCallback(
    (val: string) => {
      setSearchQuery(val);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => runSearch(val), 400);
    },
    [runSearch]
  );

  const pickSearchResult = useCallback(
    (r: NominatimResult) => {
      const addr = r.display_name.split(',').slice(0, 3).join(',').trim();
      update('destinationAddress', addr);
      update('destinationLat', parseFloat(r.lat));
      update('destinationLng', parseFloat(r.lon));
      setSearchQuery(addr);
      setShowResults(false);
      // Warn if destination is in a dangerous zone
      const zone = findDangerousZone(parseFloat(r.lat), parseFloat(r.lon));
      if (zone) {
        store.showToast(`Zona con advertencia de seguridad: ${zone.name}`, 'info');
      }
    },
    [update, store]
  );

  const clearDestination = useCallback(() => {
    update('destinationModeEnabled', false);
    update('destinationAddress', '');
    update('destinationLat', 0);
    update('destinationLng', 0);
    setSearchQuery('');
    setShowResults(false);
  }, [update]);

  const togglePaymentMethod = useCallback(
    (method: PaymentMethod) => {
      if (!config) return;
      const has = config.acceptedPaymentMethods.includes(method);
      const next = has
        ? config.acceptedPaymentMethods.filter((m) => m !== method)
        : [...config.acceptedPaymentMethods, method];
      update('acceptedPaymentMethods', next);
    },
    [config, update]
  );

  const handleSave = useCallback(async () => {
    if (!config || !store.user) return;
    setSaving(true);
    if (store.user.uid === 'demo') {
      await new Promise((r) => setTimeout(r, 500));
      setSaving(false);
      setSavedAt(Date.now());
      store.showToast('Configuración guardada (modo demo)', 'success');
      return;
    }
    try {
      const res = await fetch('/api/driver-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        const msg =
          data?.error ||
          (res.status === 500
            ? 'No se pudo guardar (base de datos del servidor sin sincronizar).'
            : 'No se pudo guardar la configuración.');
        store.showToast(msg, 'error');
        setSaving(false);
        return;
      }
      setSavedAt(Date.now());
      store.showToast('Configuración guardada', 'success');
    } catch (err) {
      console.warn('[driver-config] save failed:', err);
      store.showToast('Error de conexión', 'error');
    } finally {
      setSaving(false);
    }
  }, [config, store]);

  const addScheduleEntry = useCallback(() => {
    if (!config) return;
    update('schedule', [...config.schedule, { day: 1, from: '09:00', to: '18:00' }]);
  }, [config, update]);

  const updateScheduleEntry = useCallback((index: number, patch: Partial<ScheduleEntry>) => {
    if (!config) return;
    const next = config.schedule.map((s, i) => (i === index ? { ...s, ...patch } : s));
    update('schedule', next);
  }, [config, update]);

  const removeScheduleEntry = useCallback((index: number) => {
    if (!config) return;
    update('schedule', config.schedule.filter((_, i) => i !== index));
  }, [config, update]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0EA5A0] animate-spin" />
        <p className="text-sm text-gray-500 mt-3">Cargando configuración…</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col items-center justify-center px-6">
        <p className="text-sm text-gray-600 mb-4">No se pudo cargar la configuración.</p>
        <button
          onClick={() => store.setCurrentScreen('profile')}
          className="px-5 py-2.5 bg-[#0EA5A0] text-white rounded-xl font-semibold text-sm"
        >
          Volver
        </button>
      </div>
    );
  }

  // Block if user is not in driver role
  if (store.user?.role !== 'driver') {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
          <Car className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-1">Solo disponible en modo conductor</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Cambiá al modo conductor desde tu perfil para acceder a esta configuración.
        </p>
        <button
          onClick={() => store.setCurrentScreen('role')}
          className="px-5 py-2.5 bg-[#0EA5A0] text-white rounded-xl font-semibold text-sm"
        >
          Cambiar a modo conductor
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-32">
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
          <div className="w-8 h-8 rounded-lg bg-[#0EA5A0]/10 flex items-center justify-center text-[#0EA5A0]">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Configuración de conductor</h1>
            <p className="text-[11px] text-gray-500 leading-tight">
              Definí tus preferencias para aceptar viajes
            </p>
          </div>
        </div>
      </div>

      {degraded && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            La base de datos del servidor no tiene la tabla de configuración sincronizada.
            Los cambios no se guardarán hasta que el administrador ejecute <code className="font-mono bg-amber-100 px-1 rounded">prisma db push</code>.
          </p>
        </div>
      )}

      <div className="px-4 mt-3 space-y-3">
        {/* ── Section: Requisitos de viaje ─────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-[#0EA5A0]" />
            <h2 className="text-sm font-bold text-gray-900">Requisitos de viaje</h2>
          </div>

          {/* Importe mínimo */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              Importe mínimo de viaje a aceptar
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="number"
                min={0}
                step={100}
                value={config.minFare}
                onChange={(e) => update('minFare', Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 h-11 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] focus:bg-white"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              No recibirás ofertas de viajes con tarifa menor a este monto.
            </p>
          </div>

          {/* $/km mínimo */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              Valor mínimo por kilómetro
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$/km</span>
              <input
                type="number"
                min={0}
                step={10}
                value={config.minPerKm}
                onChange={(e) => update('minPerKm', Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 h-11 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] focus:bg-white"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Filtra viajes que paguen poco por kilómetro recorrido.
            </p>
          </div>

          {/* Máx km pickup */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              Máx km para ir a buscar al pasajero: <strong className="text-[#0EA5A0]">{config.maxPickupKm} km</strong>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={config.maxPickupKm}
              onChange={(e) => update('maxPickupKm', parseFloat(e.target.value))}
              className="w-full accent-[#0EA5A0]"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>1 km</span>
              <span>50 km</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Distancia máxima que estás dispuesto a recorrer para llegar al punto de pickup.
            </p>
          </div>

          {/* Calificación mínima del pasajero */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              Calificación mínima del pasajero: <strong className="text-[#0EA5A0]">{config.minPassengerRating > 0 ? config.minPassengerRating.toFixed(1) : 'Sin filtro'}</strong>
            </label>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={config.minPassengerRating}
              onChange={(e) => update('minPassengerRating', parseFloat(e.target.value))}
              className="w-full accent-[#0EA5A0]"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>Sin filtro</span>
              <span>5.0</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              No recibirás viajes de pasajeros con un promedio menor al valor seleccionado. Ej: 4.10, 3.70, etc.
            </p>
          </div>
        </section>

        {/* ── Section: Modo Destino (Sin límites de uso) ──────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[#0C8CE9]" />
              <div>
                <h2 className="text-sm font-bold text-gray-900">Modo Destino</h2>
                <p className="text-[10px] text-[#0EA5A0] font-semibold">Sin límites de uso</p>
              </div>
            </div>
            <button
              onClick={() => update('destinationModeEnabled', !config.destinationModeEnabled)}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${config.destinationModeEnabled ? 'bg-[#0EA5A0]' : 'bg-gray-200'}`}
              aria-label="Toggle modo destino"
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${config.destinationModeEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Activá esta opción para recibir únicamente viajes cuyo destino final esté cerca de un lugar al que vos te dirigís. A diferencia de otras apps, en TEYEVO <strong>no tiene límite de uso diario</strong>.
          </p>

          {config.destinationModeEnabled && (
            <div className="space-y-3">
              {/* Address search */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  ¿Hacia dónde te dirigís?
                </label>
                <div className="relative">
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-11 focus-within:border-[#0EA5A0] focus-within:bg-white">
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder="Ej: Belgrano, Palermo, San Isidro…"
                      className="flex-1 bg-transparent text-sm outline-none"
                    />
                    {searching && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                    {searchQuery && !searching && (
                      <button
                        onClick={clearDestination}
                        className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-300"
                        aria-label="Borrar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {showResults && searchResults.length > 0 && (
                    <div className="absolute top-12 left-0 right-0 z-20 bg-white rounded-xl shadow-lg border border-gray-100 max-h-64 overflow-y-auto">
                      {searchResults.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => pickSearchResult(r)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 flex items-start gap-2"
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#0EA5A0] mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-700 line-clamp-2">{r.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showResults && searchResults.length === 0 && !searching && searchQuery.trim().length >= 3 && (
                    <div className="absolute top-12 left-0 right-0 z-20 bg-white rounded-xl shadow-lg border border-gray-100 p-3">
                      <p className="text-xs text-gray-500 text-center">No se encontraron direcciones. Probá con un nombre más específico.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Saved destination */}
              {config.destinationAddress && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <Navigation className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-emerald-700 font-semibold uppercase">Destino guardado</p>
                    <p className="text-xs text-emerald-900 mt-0.5 break-words">{config.destinationAddress}</p>
                  </div>
                  <button
                    onClick={clearDestination}
                    className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 hover:bg-emerald-200 flex-shrink-0"
                    aria-label="Borrar destino"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Radius slider */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  Radio de coincidencia: <strong className="text-[#0EA5A0]">{config.destinationRadiusKm} km</strong>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={config.destinationRadiusKm}
                  onChange={(e) => update('destinationRadiusKm', parseFloat(e.target.value))}
                  className="w-full accent-[#0EA5A0]"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>1 km</span>
                  <span>10 km</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Solo recibirás viajes cuyo destino esté dentro de este radio desde tu destino.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── Section: Métodos de pago aceptados ───────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-bold text-gray-900">Métodos de pago aceptados</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Seleccioná qué formas de pago estás dispuesto a aceptar. Si no marcás ninguna, se asume que aceptás todas.
          </p>
          <div className="space-y-2">
            {PAYMENT_METHODS.map((pm) => {
              const Icon = pm.icon;
              const active = config.acceptedPaymentMethods.includes(pm.id);
              return (
                <button
                  key={pm.id}
                  onClick={() => togglePaymentMethod(pm.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    active
                      ? 'border-[#0EA5A0] bg-[#0EA5A0]/5'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg ${pm.bg} flex items-center justify-center flex-shrink-0 ${pm.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`flex-1 text-left text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-600'}`}>
                    {pm.label}
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${active ? 'bg-[#0EA5A0] border-[#0EA5A0]' : 'border-gray-300'}`}>
                    {active && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Section: Auto-accept ─────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-gray-900">Modo automático</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Aceptar viajes automáticamente</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Si está activo, aceptamos viajes que cumplan tus requisitos sin pedirme confirmación.
              </p>
            </div>
            <button
              onClick={() => update('autoAccept', !config.autoAccept)}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${config.autoAccept ? 'bg-[#0EA5A0]' : 'bg-gray-200'}`}
              aria-label="Toggle auto-accept"
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${config.autoAccept ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </section>

        {/* ── Section: Datos para depósitos (CBU/CVU) ─────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900">Datos para depósitos</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Tus ganancias se depositan semanalmente en esta cuenta. Los datos quedan guardados de forma segura y solo se usan para pagar tus viajes como conductor.
          </p>
          <div className="space-y-3">
            {/* Titular de la cuenta */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Titular de la cuenta
              </label>
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={config.cbuHolderName}
                  onChange={(e) => update('cbuHolderName', e.target.value)}
                  placeholder="Nombre y apellido del titular"
                  className="flex-1 h-11 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] focus:bg-white"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Si la cuenta es tuya, repetí tu nombre. Si es de un tercero (por ejemplo, un familiar), cargá el nombre del titular real.
              </p>
            </div>
            {/* CBU / CVU */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                CBU / CVU (22 dígitos)
              </label>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={config.cbuNumber}
                  onChange={(e) => {
                    // Solo dígitos, máx 22
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 22);
                    update('cbuNumber', digits);
                  }}
                  placeholder="0000000000000000000000"
                  className="flex-1 h-11 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm font-mono outline-none focus:border-[#0EA5A0] focus:bg-white"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {config.cbuNumber.length === 0 ? (
                  'Encontrá tu CBU/CVU en la app de tu banco o en el comprobante de tu cuenta.'
                ) : config.cbuNumber.length === 22 ? (
                  <span className="text-emerald-600 font-medium">CBU válido (22 dígitos) · Últimos 4: {config.cbuNumber.slice(-4)}</span>
                ) : (
                  <span className="text-amber-600 font-medium">Faltan {22 - config.cbuNumber.length} dígitos para completar el CBU.</span>
                )}
              </p>
            </div>
            {/* Alias (opcional) */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Alias <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={config.cbuAlias}
                  onChange={(e) => update('cbuAlias', e.target.value.toLowerCase().replace(/\s/g, '.'))}
                  placeholder="alias.tu.cuenta"
                  className="flex-1 h-11 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm font-mono outline-none focus:border-[#0EA5A0] focus:bg-white"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                El alias es una alternativa al CBU. Lo configurás desde tu banco.
              </p>
            </div>
          </div>
        </section>

        {/* ── Section: Schedule ────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-500" />
              <h2 className="text-sm font-bold text-gray-900">Horarios de disponibilidad</h2>
            </div>
            <button
              onClick={addScheduleEntry}
              className="text-xs font-semibold text-[#0EA5A0] flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>
          {config.schedule.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              Sin horarios definidos. Estás disponible todos los días, 24 hs.
            </p>
          ) : (
            <div className="space-y-2">
              {config.schedule.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                  <select
                    value={entry.day}
                    onChange={(e) => updateScheduleEntry(i, { day: parseInt(e.target.value) })}
                    className="flex-1 h-9 rounded-lg bg-white border border-gray-200 px-2 text-xs outline-none focus:border-[#0EA5A0]"
                  >
                    {DAYS.map((d, idx) => (
                      <option key={idx} value={idx}>{d}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={entry.from}
                    onChange={(e) => updateScheduleEntry(i, { from: e.target.value })}
                    className="w-20 h-9 rounded-lg bg-white border border-gray-200 px-2 text-xs outline-none focus:border-[#0EA5A0]"
                  />
                  <span className="text-xs text-gray-400">→</span>
                  <input
                    type="time"
                    value={entry.to}
                    onChange={(e) => updateScheduleEntry(i, { to: e.target.value })}
                    className="w-20 h-9 rounded-lg bg-white border border-gray-200 px-2 text-xs outline-none focus:border-[#0EA5A0]"
                  />
                  <button
                    onClick={() => removeScheduleEntry(i)}
                    className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                    aria-label="Eliminar horario"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-2">
            Si no agregás horarios, se asume que estás disponible siempre.
          </p>
        </section>

        {/* ── Section: Preferencias del vehículo ────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wind className="w-4 h-4 text-[#0EA5A0]" />
            <h2 className="text-sm font-bold text-gray-900">Preferencias del vehículo</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Informá a los pasajeros qué servicios tiene tu vehículo. Estas preferencias se muestran al solicitar un viaje.
          </p>
          <div className="space-y-2">
            {TRIP_PREFS.map((tp) => {
              const Icon = tp.icon;
              const active = config.tripPreferences.includes(tp.id);
              return (
                <button
                  key={tp.id}
                  onClick={() => {
                    const has = config.tripPreferences.includes(tp.id);
                    const next = has
                      ? config.tripPreferences.filter((p) => p !== tp.id)
                      : [...config.tripPreferences, tp.id];
                    update('tripPreferences', next);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    active
                      ? 'border-[#0EA5A0] bg-[#0EA5A0]/5'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    active ? 'bg-[#0EA5A0]/15 text-[#0EA5A0]' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className={`text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-600'}`}>
                      {tp.label}
                    </span>
                    <p className={`text-[10px] mt-0.5 ${active ? 'text-gray-500' : 'text-gray-400'}`}>
                      {tp.desc}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${active ? 'bg-[#0EA5A0] border-[#0EA5A0]' : 'border-gray-300'}`}>
                    {active && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Section: Preferencia de género (pasajero) ─────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCircle className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-bold text-gray-900">Preferencia de género</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Cuando viajás como pasajero, elegí tu preferencia de género del conductor. Esto solo aplica cuando sos pasajero.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {GENDER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = config.genderPreference === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => update('genderPreference', opt.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    active
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    active ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-medium ${active ? 'text-violet-700' : 'text-gray-500'}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Section: Tu género (para que los pasajeros te filtren) ────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserIcon className="w-4 h-4 text-sky-500" />
            <h2 className="text-sm font-bold text-gray-900">Tu género</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Los pasajeros pueden filtrar por género del conductor. Esto es opcional y solo se usa para el emparejamiento.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['male', 'female', ''] as const).map((g) => {
              const labels: Record<string, string> = { male: 'Hombre', female: 'Mujer', '': 'No especificar' };
              const active = config.driverGender === g;
              return (
                <button
                  key={g || 'none'}
                  onClick={() => update('driverGender', g)}
                  className={`flex items-center justify-center p-3 rounded-xl border transition-all ${
                    active
                      ? 'border-sky-400 bg-sky-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <span className={`text-sm font-medium ${active ? 'text-sky-700' : 'text-gray-500'}`}>
                    {labels[g]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Section: Calificación mínima del conductor (modo pasajero) ── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <ShieldBan className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold text-gray-900">Filtro como pasajero</h2>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              Calificación mínima del conductor: <strong className="text-[#0EA5A0]">{config.minDriverRating > 0 ? config.minDriverRating.toFixed(1) : 'Sin filtro'}</strong>
            </label>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={config.minDriverRating}
              onChange={(e) => update('minDriverRating', parseFloat(e.target.value))}
              className="w-full accent-[#0EA5A0]"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>Sin filtro</span>
              <span>5.0</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Cuando viajes como pasajero, no recibirás conductores con un promedio menor al valor seleccionado.
            </p>
          </div>
        </section>

        {/* ── Section: Preferencia de comunicación ─────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <PhoneCall className="w-4 h-4 text-[#0EA5A0]" />
            <h2 className="text-sm font-bold text-gray-900">Preferencia de comunicación</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Elegí cómo preferís que los pasajeros te contacten durante un viaje. Esto se les muestra al aceptar el viaje para que respeten tu preferencia.
          </p>
          <div className="space-y-2">
            {([
              { id: 'both' as const, label: 'Llamadas y mensajes', desc: 'Aceptás ambos métodos de comunicación', icon: PhoneCall, color: 'text-[#0EA5A0]', bg: 'bg-[#0EA5A0]/15' },
              { id: 'calls' as const, label: 'Solo llamadas', desc: 'Preferís llamadas por seguridad al conducir', icon: Phone, color: 'text-sky-600', bg: 'bg-sky-50' },
              { id: 'messages' as const, label: 'Solo mensajes', desc: 'Solo aceptás mensajes por chat del viaje', icon: MessageSquare, color: 'text-violet-600', bg: 'bg-violet-50' },
            ]).map((opt) => {
              const Icon = opt.icon;
              const active = config.communicationPreference === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => update('communicationPreference', opt.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    active
                      ? 'border-[#0EA5A0] bg-[#0EA5A0]/5'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    active ? `${opt.bg} ${opt.color}` : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className={`text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-600'}`}>
                      {opt.label}
                    </span>
                    <p className={`text-[10px] mt-0.5 ${active ? 'text-gray-500' : 'text-gray-400'}`}>
                      {opt.desc}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${active ? 'bg-[#0EA5A0] border-[#0EA5A0]' : 'border-gray-300'}`}>
                    {active && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
          {config.communicationPreference === 'calls' && (
            <div className="mt-3 p-2.5 rounded-xl bg-sky-50 border border-sky-200">
              <p className="text-[11px] text-sky-700 leading-relaxed">
                <strong>Safety tip:</strong> Al elegir "Solo llamadas", los pasajeros verán un aviso explicando que por tu seguridad no leés mensajes mientras conducís. Esto mejora la experiencia para ambos.
              </p>
            </div>
          )}
        </section>

        {/* ── Section: Radares ─────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Radar className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-gray-900">Alertas de radares</h2>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Activar alertas de radares</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Te avisamos cuando te acercás a un radar o fotomulta.
              </p>
            </div>
            <button
              onClick={() => update('radarAlertsEnabled', !config.radarAlertsEnabled)}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${config.radarAlertsEnabled ? 'bg-[#0EA5A0]' : 'bg-gray-200'}`}
              aria-label="Toggle radar alerts"
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${config.radarAlertsEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {config.radarAlertsEnabled && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Radio de alerta: <strong className="text-[#0EA5A0]">{config.radarAlertRadius} m</strong>
              </label>
              <input
                type="range"
                min={100}
                max={2000}
                step={100}
                value={config.radarAlertRadius}
                onChange={(e) => update('radarAlertRadius', parseInt(e.target.value))}
                className="w-full accent-[#0EA5A0]"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>100 m</span>
                <span>2 km</span>
              </div>
            </div>
          )}
        </section>

        {/* ── Save button (sticky bottom) ──────────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto bg-white border-t border-gray-100 p-4 z-20">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-[#0EA5A0] text-white font-bold shadow-lg shadow-[#0EA5A0]/25 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : savedAt ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? 'Guardando…' : savedAt ? 'Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
