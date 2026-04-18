'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, type Place, type Trip } from '@/lib/store';
import { places } from '@/lib/places';
import { formatCurrency, haversineDistance, generateId } from '@/lib/utils';
import {
  ArrowLeft,
  Package,
  Box,
  Mail,
  AlertCircle,
  MapPin,
  Navigation,
  ChevronRight,
  Clock,
  Route,
  CheckCircle,
  Truck,
  ArrowRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type SendStep = 'package' | 'addresses' | 'quote' | 'tracking';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface PackageSize {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  pricePerKm: number;
  basePrice: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PACKAGE_SIZES: PackageSize[] = [
  { id: 'sobre', name: 'Sobre', description: 'pequeño', icon: Mail, pricePerKm: 60, basePrice: 300 },
  { id: 'caja_chica', name: 'Caja chica', description: 'mediano', icon: Package, pricePerKm: 90, basePrice: 500 },
  { id: 'caja_grande', name: 'Caja grande', description: 'grande', icon: Box, pricePerKm: 130, basePrice: 800 },
  { id: 'especial', name: 'Especial', description: 'frágil/especial', icon: AlertCircle, pricePerKm: 180, basePrice: 1200 },
];

const TRACKING_STEPS = [
  { id: 'recogido', label: 'Recogido', icon: Package },
  { id: 'en_camino', label: 'En camino', icon: Truck },
  { id: 'cercano', label: 'Cercano', icon: Navigation },
  { id: 'entregado', label: 'Entregado', icon: CheckCircle },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function SendScreen() {
  const store = useAppStore();

  // Step management
  const [step, setStep] = useState<SendStep>('package');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Package info
  const [selectedSize, setSelectedSize] = useState<string>('caja_chica');
  const [weight, setWeight] = useState<string>('');
  const [description, setDescription] = useState('');

  // Addresses
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState<NominatimResult[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<NominatimResult[]>([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [localOrigin, setLocalOrigin] = useState<Place | null>(null);
  const [localDest, setLocalDest] = useState<Place | null>(null);

  // Quote
  const [sendDistance, setSendDistance] = useState(0);
  const [sendFare, setSendFare] = useState(0);
  const [sendDuration, setSendDuration] = useState(0);

  // Tracking
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [trackingEta, setTrackingEta] = useState(0);
  const [isDelivered, setIsDelivered] = useState(false);

  const originTimerRef = useRef<NodeJS.Timeout | null>(null);
  const destTimerRef = useRef<NodeJS.Timeout | null>(null);
  const trackingRef = useRef<NodeJS.Timeout | null>(null);

  // Transition helper
  const transitionTo = useCallback((nextStep: SendStep) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(nextStep);
      setIsTransitioning(false);
    }, 200);
  }, []);

  // Reset on mount
  useEffect(() => {
    setSelectedSize('caja_chica');
    setWeight('');
    setDescription('');
    setOriginText('');
    setDestText('');
    setLocalOrigin(null);
    setLocalDest(null);
    setTrackingProgress(0);
    setTrackingEta(0);
    setIsDelivered(false);
  }, []);

  // ─── Autocomplete with debounce (same pattern as RideScreen) ─────────────

  const searchNominatim = useCallback(async (query: string): Promise<NominatimResult[]> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ar&limit=5`,
        { headers: { 'Accept-Language': 'es' } }
      );
      if (!res.ok) throw new Error('Nominatim error');
      const data = await res.json();
      return data.length > 0 ? data : [];
    } catch {
      const q = query.toLowerCase();
      return places
        .filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q))
        .map((p, i) => ({
          place_id: i + 1000,
          display_name: `${p.name} - ${p.address}`,
          lat: p.lat.toString(),
          lon: p.lng.toString(),
        }));
    }
  }, []);

  const handleOriginChange = useCallback(
    (value: string) => {
      setOriginText(value);
      setLocalOrigin(null);
      if (originTimerRef.current) clearTimeout(originTimerRef.current);
      if (value.length < 3) {
        setOriginSuggestions([]);
        setShowOriginSuggestions(false);
        return;
      }
      originTimerRef.current = setTimeout(async () => {
        const results = await searchNominatim(value);
        setOriginSuggestions(results);
        setShowOriginSuggestions(results.length > 0);
      }, 400);
    },
    [searchNominatim]
  );

  const handleDestChange = useCallback(
    (value: string) => {
      setDestText(value);
      setLocalDest(null);
      if (destTimerRef.current) clearTimeout(destTimerRef.current);
      if (value.length < 3) {
        setDestSuggestions([]);
        setShowDestSuggestions(false);
        return;
      }
      destTimerRef.current = setTimeout(async () => {
        const results = await searchNominatim(value);
        setDestSuggestions(results);
        setShowDestSuggestions(results.length > 0);
      }, 400);
    },
    [searchNominatim]
  );

  const selectPlace = useCallback(
    (result: NominatimResult, type: 'origin' | 'dest') => {
      const parts = result.display_name.split(' - ');
      const place: Place = {
        name: parts[0].split(',')[0].trim(),
        address: parts[1]?.trim() || result.display_name.split(',').slice(1, 3).join(',').trim(),
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      };
      if (type === 'origin') {
        setLocalOrigin(place);
        setOriginText(place.name);
        setShowOriginSuggestions(false);
        store.setOrigin(place);
      } else {
        setLocalDest(place);
        setDestText(place.name);
        setShowDestSuggestions(false);
        store.setDestination(place);
      }
    },
    [store]
  );

  const applyCurrentLocation = useCallback(() => {
    const current: Place = {
      name: 'Mi ubicación',
      address: 'Buenos Aires, CABA',
      lat: -34.6037,
      lng: -58.3816,
    };
    setLocalOrigin(current);
    setOriginText('Mi ubicación');
    store.setOrigin(current);
  }, [store]);

  // ─── Calculate quote ──────────────────────────────────────────────────

  const calculateQuote = useCallback(() => {
    if (!localOrigin || !localDest) return;
    const dist = haversineDistance(localOrigin.lat, localOrigin.lng, localDest.lat, localDest.lng);
    const dur = Math.round((dist / 25) * 60);
    const pkgSize = PACKAGE_SIZES.find((s) => s.id === selectedSize);
    if (!pkgSize) return;

    const weightKg = parseFloat(weight) || 1;
    const weightSurcharge = weightKg > 5 ? (weightKg - 5) * 100 : 0;
    const fare = Math.round(pkgSize.basePrice + dist * pkgSize.pricePerKm + weightSurcharge);

    setSendDistance(Math.round(dist * 10) / 10);
    setSendDuration(dur);
    setSendFare(fare);
  }, [localOrigin, localDest, selectedSize, weight]);

  // ─── Start tracking simulation ────────────────────────────────────────

  useEffect(() => {
    if (step === 'tracking') {
      const totalDuration = 20000; // 20 seconds
      const etaMinutes = sendDuration || 15;
      setTrackingProgress(0);
      setTrackingEta(etaMinutes);
      setIsDelivered(false);

      trackingRef.current = setInterval(() => {
        setTrackingProgress((prev) => {
          const next = prev + (500 / totalDuration) * 100;
          if (next >= 100) {
            if (trackingRef.current) clearInterval(trackingRef.current);
            setIsDelivered(true);
            return 100;
          }
          return next;
        });
        setTrackingEta((prev) => Math.max(0, prev - (500 / totalDuration) * etaMinutes));
      }, 500);

      return () => {
        if (trackingRef.current) clearInterval(trackingRef.current);
      };
    }
  }, [step, sendDuration]);

  // ─── Save trip to history on delivery ─────────────────────────────────

  useEffect(() => {
    if (isDelivered && localOrigin && localDest) {
      const trip: Trip = {
        id: generateId(),
        type: 'send',
        status: 'completed',
        origin: localOrigin,
        destination: localDest,
        fare: sendFare,
        vehicleType: 'moto',
        distance: sendDistance,
        duration: sendDuration,
        createdAt: new Date(),
      };
      store.addToHistory(trip);

      // Wallet deduction
      store.addMovement({
        id: generateId(),
        type: 'send',
        amount: -sendFare,
        description: `Envío ${PACKAGE_SIZES.find((s) => s.id === selectedSize)?.name || ''} - ${localOrigin.name} → ${localDest.name}`,
        date: new Date(),
        balance: store.walletBalance - sendFare,
      });
    }
  }, [isDelivered]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handlePackageContinue = useCallback(() => {
    transitionTo('addresses');
  }, [transitionTo]);

  const handleQuote = useCallback(() => {
    if (!localOrigin || !localDest) return;
    calculateQuote();
    transitionTo('quote');
  }, [localOrigin, localDest, calculateQuote, transitionTo]);

  const handleConfirmSend = useCallback(() => {
    transitionTo('tracking');
  }, [transitionTo]);

  const goHome = useCallback(() => {
    if (trackingRef.current) clearInterval(trackingRef.current);
    if (originTimerRef.current) clearTimeout(originTimerRef.current);
    if (destTimerRef.current) clearTimeout(destTimerRef.current);
    store.setOrigin(null);
    store.setDestination(null);
    store.setCurrentScreen('home');
  }, [store]);

  const handleBack = useCallback(() => {
    if (step === 'addresses') {
      transitionTo('package');
    } else if (step === 'quote') {
      transitionTo('addresses');
    } else {
      goHome();
    }
  }, [step, transitionTo, goHome]);

  // ─── Current tracking step index ──────────────────────────────────────

  const currentStepIndex = isDelivered
    ? TRACKING_STEPS.length - 1
    : Math.min(Math.floor((trackingProgress / 100) * TRACKING_STEPS.length), TRACKING_STEPS.length - 2);

  const pkgSize = PACKAGE_SIZES.find((s) => s.id === selectedSize);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-[100dvh] bg-[#F5F7FA] pb-24 overflow-hidden">
      {/* ═══ Step 1: Package Info ═══ */}
      {step === 'package' && (
        <div
          className={`transition-all duration-200 ${
            isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <button
              onClick={goHome}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex items-center gap-2">
              <Package className="w-6 h-6 text-[#3B82F6]" />
              <h1 className="text-xl font-bold text-gray-900">UniraEnvíos</h1>
            </div>
          </div>

          <div className="px-4 mt-4">
            {/* Size selector */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Tamaño del paquete</h3>
              <div className="grid grid-cols-2 gap-2">
                {PACKAGE_SIZES.map((size) => {
                  const Icon = size.icon;
                  const isSelected = selectedSize === size.id;
                  return (
                    <button
                      key={size.id}
                      onClick={() => setSelectedSize(size.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border-2 ${
                        isSelected
                          ? 'bg-[#3B82F6]/5 border-[#3B82F6] shadow-sm shadow-[#3B82F6]/15'
                          : 'bg-gray-50 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-[#3B82F6]/15' : 'bg-gray-200/60'
                        }`}
                      >
                        <Icon
                          className={`w-6 h-6 ${
                            isSelected ? 'text-[#3B82F6]' : 'text-gray-400'
                          }`}
                        />
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-sm font-semibold ${
                            isSelected ? 'text-[#3B82F6]' : 'text-gray-700'
                          }`}
                        >
                          {size.name}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{size.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weight input */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mt-3">
              <label htmlFor="weight" className="text-sm font-bold text-gray-900 block mb-2">
                Peso (kg)
              </label>
              <input
                id="weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Ej: 2.5"
                min="0.1"
                step="0.1"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#3B82F6]/30 placeholder:text-gray-400 text-gray-800"
              />
            </div>

            {/* Description textarea */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mt-3">
              <label htmlFor="pkg-desc" className="text-sm font-bold text-gray-900 block mb-2">
                Descripción <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                id="pkg-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Documentos, frágil, no doblar..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#3B82F6]/30 placeholder:text-gray-400 text-gray-800 resize-none"
              />
            </div>

            {/* Continue button */}
            <button
              onClick={handlePackageContinue}
              className="w-full mt-5 py-4 rounded-2xl bg-[#3B82F6] text-white font-bold text-base shadow-lg shadow-[#3B82F6]/25 hover:bg-[#2563EB] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              Continuar
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ Step 2: Addresses ═══ */}
      {step === 'addresses' && (
        <div
          className={`transition-all duration-200 ${
            isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Direcciones</h1>
          </div>

          <div className="mx-4 mt-2 bg-white rounded-3xl shadow-lg overflow-hidden sheet-slide-up">
            {/* Grab handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="px-4 pt-2 pb-3">
              {/* Origin */}
              <div className="relative">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1 py-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" />
                    <div className="w-0.5 h-8 bg-gray-200" />
                  </div>
                  <input
                    type="text"
                    value={originText}
                    onChange={(e) => handleOriginChange(e.target.value)}
                    onFocus={() => originSuggestions.length > 0 && setShowOriginSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowOriginSuggestions(false), 200)}
                    placeholder="Punto de retiro"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#3B82F6]/30 placeholder:text-gray-400 text-gray-800"
                    aria-label="Punto de retiro"
                  />
                  <button
                    onClick={applyCurrentLocation}
                    className="w-9 h-9 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center hover:bg-[#3B82F6]/20 active:scale-95 transition-all flex-shrink-0"
                    aria-label="Usar ubicación actual"
                  >
                    <Navigation className="w-4 h-4 text-[#3B82F6]" />
                  </button>
                </div>
                {showOriginSuggestions && originSuggestions.length > 0 && (
                  <div className="absolute top-full left-14 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-48 overflow-y-auto hide-scrollbar">
                    {originSuggestions.map((s) => (
                      <button
                        key={s.place_id}
                        onMouseDown={() => selectPlace(s, 'origin')}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-2 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <MapPin className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-gray-700 leading-snug line-clamp-2">
                          {s.display_name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Destination */}
              <div className="relative mt-1">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1 py-1">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/30" />
                  </div>
                  <input
                    type="text"
                    value={destText}
                    onChange={(e) => handleDestChange(e.target.value)}
                    onFocus={() => destSuggestions.length > 0 && setShowDestSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowDestSuggestions(false), 200)}
                    placeholder="¿A dónde lo enviamos?"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#3B82F6]/30 placeholder:text-gray-400 text-gray-800"
                    aria-label="Destino del envío"
                  />
                </div>
                {showDestSuggestions && destSuggestions.length > 0 && (
                  <div className="absolute top-full left-14 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-48 overflow-y-auto hide-scrollbar">
                    {destSuggestions.map((s) => (
                      <button
                        key={s.place_id}
                        onMouseDown={() => selectPlace(s, 'dest')}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-2 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-gray-700 leading-snug line-clamp-2">
                          {s.display_name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quote button */}
            <div className="px-4 pb-5">
              <button
                onClick={handleQuote}
                disabled={!localOrigin || !localDest}
                className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                  localOrigin && localDest
                    ? 'bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/25 hover:bg-[#2563EB] active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Cotizar envío
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Step 3: Quote ═══ */}
      {step === 'quote' && localOrigin && localDest && pkgSize && (
        <div
          className={`transition-all duration-200 ${
            isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Resumen del envío</h1>
          </div>

          <div className="px-4 mt-2 space-y-3">
            {/* Package summary */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Paquete
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
                  <pkgSize.icon className="w-6 h-6 text-[#3B82F6]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{pkgSize.name}</p>
                  <p className="text-xs text-gray-500">
                    {weight ? `${weight} kg` : 'Sin peso especificado'}
                    {description ? ` · ${description}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Route summary */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Ruta
              </h3>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center mt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div className="w-0.5 h-10 bg-gray-200 my-0.5" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{localOrigin.name}</p>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{localOrigin.address}</p>
                  <div className="my-2">
                    <ArrowRight className="w-4 h-4 text-[#3B82F6]" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{localDest.name}</p>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{localDest.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-600">{sendDistance} km</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-600">~{sendDuration} min</span>
                </div>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Precio
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Tarifa base ({pkgSize.name})</span>
                  <span className="text-sm font-medium text-gray-700">
                    {formatCurrency(pkgSize.basePrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Distancia ({sendDistance} km)</span>
                  <span className="text-sm font-medium text-gray-700">
                    {formatCurrency(Math.round(sendDistance * pkgSize.pricePerKm))}
                  </span>
                </div>
                {parseFloat(weight || '0') > 5 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Exceso de peso</span>
                    <span className="text-sm font-medium text-gray-700">
                      {formatCurrency(Math.round((parseFloat(weight) - 5) * 100))}
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-[#3B82F6]">
                      {formatCurrency(sendFare)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirmSend}
              className="w-full py-4 rounded-2xl bg-[#3B82F6] text-white font-bold text-base shadow-lg shadow-[#3B82F6]/25 hover:bg-[#2563EB] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
            >
              Confirmar envío
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ Step 4: Tracking ═══ */}
      {step === 'tracking' && (
        <div
          className={`min-h-[100dvh] flex flex-col px-4 pt-4 transition-all duration-200 ${
            isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 pb-4">
            <button
              onClick={goHome}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Seguimiento</h1>
          </div>

          {isDelivered ? (
            /* Delivered state */
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                <CheckCircle className="w-12 h-12 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Entregado!</h2>
              <p className="text-sm text-gray-500 text-center mb-2">
                Tu paquete fue entregado exitosamente
              </p>
              {localDest && (
                <p className="text-xs text-gray-400 text-center mb-8">
                  {localDest.name}
                </p>
              )}
              <button
                onClick={goHome}
                className="px-8 py-3.5 rounded-2xl bg-[#3B82F6] text-white font-bold text-base shadow-lg shadow-[#3B82F6]/25 hover:bg-[#2563EB] active:scale-95 transition-all"
              >
                Volver
              </button>
            </div>
          ) : (
            /* Tracking in progress */
            <div className="flex-1 flex flex-col">
              {/* Progress circle */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-36 h-36 mb-4">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 52}`}
                      strokeDashoffset={`${2 * Math.PI * 52 * (1 - trackingProgress / 100)}`}
                      className="transition-all duration-500 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Truck className="w-7 h-7 text-[#3B82F6] mb-1" />
                    <span className="text-2xl font-bold text-gray-900">
                      {Math.ceil(trackingEta)}
                    </span>
                    <span className="text-[10px] text-gray-500">min restantes</span>
                  </div>
                </div>
              </div>

              {/* Progress steps */}
              <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
                <div className="space-y-0">
                  {TRACKING_STEPS.map((trackStep, index) => {
                    const Icon = trackStep.icon;
                    const isActive = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                      <div key={trackStep.id} className="flex items-start gap-3">
                        {/* Step indicator */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
                              isCurrent
                                ? 'bg-[#3B82F6] shadow-md shadow-[#3B82F6]/30 scale-110'
                                : isActive
                                  ? 'bg-[#3B82F6]/15'
                                  : 'bg-gray-100'
                            }`}
                          >
                            <Icon
                              className={`w-5 h-5 ${
                                isCurrent
                                  ? 'text-white'
                                  : isActive
                                    ? 'text-[#3B82F6]'
                                    : 'text-gray-300'
                              }`}
                            />
                          </div>
                          {/* Connector line */}
                          {index < TRACKING_STEPS.length - 1 && (
                            <div
                              className={`w-0.5 h-8 transition-all duration-500 ${
                                index < currentStepIndex ? 'bg-[#3B82F6]' : 'bg-gray-200'
                              }`}
                            />
                          )}
                        </div>

                        {/* Label */}
                        <div className="pt-2">
                          <p
                            className={`text-sm font-semibold transition-colors duration-500 ${
                              isCurrent
                                ? 'text-[#3B82F6]'
                                : isActive
                                  ? 'text-gray-700'
                                  : 'text-gray-300'
                            }`}
                          >
                            {trackStep.label}
                          </p>
                          {isCurrent && !isDelivered && (
                            <p className="text-[10px] text-gray-400 mt-0.5">En progreso...</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Route summary */}
              {localOrigin && localDest && (
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div className="w-0.5 h-6 bg-gray-200 my-0.5" />
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 truncate">{localOrigin.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-5">{localDest.name}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
