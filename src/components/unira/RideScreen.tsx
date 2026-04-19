'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, type Place, type Trip } from '@/lib/store';
import { vehicleTypes, places } from '@/lib/places';
import { formatCurrency, haversineDistance, calculateFare, generateId } from '@/lib/utils';
import MapView from './MapView';
import MapView from './MapView';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Car,
  Bike,
  Crown,
  CarFront,
  Phone,
  MessageSquare,
  Star,
  Wallet,
  Banknote,
  CreditCard,
  ChevronRight,
  X,
  CheckCircle,
  Clock,
  Route,
  CircleDot,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type RideStep = 'input' | 'searching' | 'driver_found' | 'in_trip' | 'rate' | 'receipt';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface DriverData {
  name: string;
  rating: number;
  vehicle: string;
  plate: string;
  photo: string;
  color: string;
}

interface FareBreakdown {
  base: number;
  distance: number;
  time: number;
  tip: number;
  total: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SAMPLE_DRIVERS: DriverData[] = [
  { name: 'Marcelo Gómez', rating: 4.9, vehicle: 'Toyota Corolla', plate: 'AB 123 CD', photo: '', color: 'Negro' },
  { name: 'Lucía Pérez', rating: 4.8, vehicle: 'Volkswagen Gol', plate: 'EF 456 GH', photo: '', color: 'Blanco' },
  { name: 'Juan Martínez', rating: 4.7, vehicle: 'Chevrolet Onix', plate: 'IJ 789 KL', photo: '', color: 'Gris' },
  { name: 'Sofía Rodríguez', rating: 4.9, vehicle: 'Fiat Cronos', plate: 'MN 012 OP', photo: '', color: 'Rojo' },
  { name: 'Pedro Sánchez', rating: 4.6, vehicle: 'Renault Kwid', plate: 'QR 345 ST', photo: '', color: 'Azul' },
  { name: 'Ana Torres', rating: 4.8, vehicle: 'Peugeot 208', plate: 'UV 678 WX', photo: '', color: 'Verde' },
];

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Efectivo', icon: Banknote },
  { id: 'wallet', name: 'Billetera', icon: Wallet },
  { id: 'card', name: 'Tarjeta', icon: CreditCard },
];

const VEHICLE_ICONS: Record<string, React.ElementType> = {
  Bike,
  Car,
  Crown,
  CarFront,
};

const TIP_OPTIONS = [
  { value: 0, label: 'Sin propina' },
  { value: 500, label: '$500' },
  { value: 1000, label: '$1.000' },
  { value: 2000, label: '$2.000' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRandomDriver(): DriverData {
  return SAMPLE_DRIVERS[Math.floor(Math.random() * SAMPLE_DRIVERS.length)];
}

function getVehicleIcon(vehicleId: string): React.ElementType {
  const vt = vehicleTypes.find(v => v.id === vehicleId);
  if (!vt) return Car;
  return VEHICLE_ICONS[vt.icon] || Car;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RideScreen() {
  const store = useAppStore();

  // Local state for step management
  const [step, setStep] = useState<RideStep>('input');
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState<NominatimResult[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<NominatimResult[]>([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [localOrigin, setLocalOrigin] = useState<Place | null>(store.origin);
  const [localDest, setLocalDest] = useState<Place | null>(store.destination);
  const [localVehicle, setLocalVehicle] = useState(store.selectedVehicle);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripDuration, setTripDuration] = useState(0);
  const [tripFare, setTripFare] = useState(0);
  const [tripProgress, setTripProgress] = useState(0);
  const [tripEta, setTripEta] = useState(0);
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);
  const [fareBreakdown, setFareBreakdown] = useState<FareBreakdown>({ base: 0, distance: 0, time: 0, tip: 0, total: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const originTimerRef = useRef<NodeJS.Timeout | null>(null);
  const destTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);

  // Sync store origin/destination on mount
  useEffect(() => {
    if (store.origin) {
      setLocalOrigin(store.origin);
      setOriginText(store.origin.name);
    }
    if (store.destination) {
      setLocalDest(store.destination);
      setDestText(store.destination.name);
    }
  }, []);

  // ─── Autocomplete with debounce ──────────────────────────────────────

  const searchNominatim = useCallback(async (query: string): Promise<NominatimResult[]> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ar&limit=5`,
        { headers: { 'Accept-Language': 'es',
              'User-Agent': 'UniraApp/1.0 (demo cooperativa)' } }
      );
      if (!res.ok) throw new Error('Nominatim error');
      const data = await res.json();
      return data.length > 0 ? data : [];
    } catch {
      // Fallback to local places
      const q = query.toLowerCase();
      return places
        .filter(p => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q))
        .map((p, i) => ({
          place_id: i + 1000,
          display_name: `${p.name} - ${p.address}`,
          lat: p.lat.toString(),
          lon: p.lng.toString(),
        }));
    }
  }, []);

  const handleOriginChange = useCallback((value: string) => {
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
  }, [searchNominatim]);

  const handleDestChange = useCallback((value: string) => {
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
  }, [searchNominatim]);

  const selectOrigin = useCallback((result: NominatimResult) => {
    const parts = result.display_name.split(' - ');
    const place: Place = {
      name: parts[0].split(',')[0].trim(),
      address: parts[1]?.trim() || result.display_name.split(',').slice(1, 3).join(',').trim(),
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };
    setLocalOrigin(place);
    setOriginText(place.name);
    setShowOriginSuggestions(false);
    store.setOrigin(place);
  }, [store]);

  const selectDest = useCallback((result: NominatimResult) => {
    const parts = result.display_name.split(' - ');
    const place: Place = {
      name: parts[0].split(',')[0].trim(),
      address: parts[1]?.trim() || result.display_name.split(',').slice(1, 3).join(',').trim(),
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };
    setLocalDest(place);
    setDestText(place.name);
    setShowDestSuggestions(false);
    store.setDestination(place);
  }, [store]);

  // ─── Use current location as origin ──────────────────────────────────

  const currentLocation: Place = {
    name: 'Mi ubicación',
    address: 'Buenos Aires, CABA',
    lat: -34.6037,
    lng: -58.3816,
  };

  const applyCurrentLocation = useCallback(() => {
    setLocalOrigin(currentLocation);
    setOriginText('Mi ubicación');
    store.setOrigin(currentLocation);
  }, [store, currentLocation]);

  // ─── Calculate fare and trip details ─────────────────────────────────

  useEffect(() => {
    if (localOrigin && localDest) {
      const dist = haversineDistance(localOrigin.lat, localOrigin.lng, localDest.lat, localDest.lng);
      const dur = Math.round((dist / 25) * 60); // ~25km/h avg speed
      const fare = calculateFare(dist, dur, localVehicle);
      const vt = vehicleTypes.find(v => v.id === localVehicle);
      const baseAmt = vt?.basePrice || 0;
      const distAmt = Math.round(dist * (vt?.perKm || 0));
      const timeAmt = Math.round(dur * (vt?.perMin || 0));

      setTripDistance(Math.round(dist * 10) / 10);
      setTripDuration(dur);
      setTripFare(fare);
      setFareBreakdown({ base: baseAmt, distance: distAmt, time: timeAmt, tip: 0, total: fare });
    }
  }, [localOrigin, localDest, localVehicle]);

  // ─── Transition helper ───────────────────────────────────────────────

  const transitionTo = useCallback((nextStep: RideStep) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(nextStep);
      setIsTransitioning(false);
    }, 200);
  }, []);

  // ─── Request ride ────────────────────────────────────────────────────

  const handleRequestRide = useCallback(() => {
    if (!localOrigin || !localDest) return;
    store.setSelectedVehicle(localVehicle);
    setDriver(getRandomDriver());
    transitionTo('searching');
  }, [localOrigin, localDest, localVehicle, store, transitionTo]);

  // ─── Searching → auto-transition to driver found ────────────────────

  useEffect(() => {
    if (step === 'searching') {
      const timer = setTimeout(() => {
        transitionTo('driver_found');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [step, transitionTo]);

  // ─── Driver found → auto-transition to in trip ──────────────────────

  useEffect(() => {
    if (step === 'driver_found') {
      const timer = setTimeout(() => {
        transitionTo('in_trip');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step, transitionTo]);

  // ─── In trip progress simulation ─────────────────────────────────────

  useEffect(() => {
    if (step === 'in_trip') {
      const totalDuration = 15000; // 15 seconds in ms
      const etaMinutes = tripDuration;
      setTripProgress(0);
      setTripEta(etaMinutes);

      progressRef.current = setInterval(() => {
        setTripProgress(prev => {
          const next = prev + (500 / totalDuration) * 100;
          if (next >= 100) {
            if (progressRef.current) clearInterval(progressRef.current);
            return 100;
          }
          return next;
        });
        setTripEta(prev => Math.max(0, prev - (500 / totalDuration) * etaMinutes));
      }, 500);

      // Auto-complete trip after totalDuration + buffer
      const completeTimer = setTimeout(() => {
        if (progressRef.current) clearInterval(progressRef.current);
        transitionTo('rate');
      }, totalDuration + 2000);

      return () => {
        if (progressRef.current) clearInterval(progressRef.current);
        clearTimeout(completeTimer);
      };
    }
  }, [step, tripDuration, transitionTo]);

  // ─── Confirm rating ──────────────────────────────────────────────────

  const handleConfirmRating = useCallback(() => {
    if (!localOrigin || !localDest || !driver) return;
    const finalBreakdown = {
      base: fareBreakdown.base,
      distance: fareBreakdown.distance,
      time: fareBreakdown.time,
      tip,
      total: fareBreakdown.total + tip,
    };
    setFareBreakdown(finalBreakdown);
    transitionTo('receipt');
  }, [localOrigin, localDest, driver, fareBreakdown, tip, transitionTo]);

  // ─── Complete trip (save to history + wallet) ────────────────────────

  useEffect(() => {
    if (step === 'receipt') {
      if (!localOrigin || !localDest || !driver) return;

      const trip: Trip = {
        id: generateId(),
        type: 'ride',
        status: 'completed',
        origin: localOrigin,
        destination: localDest,
        fare: fareBreakdown.total,
        vehicleType: localVehicle,
        driverId: 'drv-' + Math.floor(Math.random() * 500),
        driverName: driver.name,
        driverPhoto: driver.photo,
        driverVehicle: `${driver.vehicle} - ${driver.color}`,
        rating: rating || undefined,
        distance: tripDistance,
        duration: tripDuration,
        createdAt: new Date(),
      };

      store.addToHistory(trip);

      if (paymentMethod === 'wallet') {
        store.addMovement({
          id: generateId(),
          type: 'ride',
          amount: -fareBreakdown.total,
          description: `Viaje ${vehicleTypes.find(v => v.id === localVehicle)?.name || 'Unira'} - ${localOrigin.name} → ${localDest.name}`,
          date: new Date(),
          balance: store.walletBalance - fareBreakdown.total,
        });
      }

      if (tip > 0) {
        store.addMovement({
          id: generateId(),
          type: 'tip',
          amount: -tip,
          description: `Propina para ${driver.name}`,
          date: new Date(),
          balance: store.walletBalance - fareBreakdown.total - tip,
        });
      }
    }
  }, [step]);

  // ─── Go back / reset ─────────────────────────────────────────────────

  const goBackHome = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current);
    if (originTimerRef.current) clearTimeout(originTimerRef.current);
    if (destTimerRef.current) clearTimeout(destTimerRef.current);
    setStep('input');
    setRating(0);
    setTip(0);
    setTripProgress(0);
    setTripEta(0);
    setDriver(null);
    store.setOrigin(null);
    store.setDestination(null);
    store.setCurrentTrip(null);
    store.setCurrentScreen('home');
  }, [store]);

  const cancelSearch = useCallback(() => {
    goBackHome();
  }, [goBackHome]);

  // ─── Fare calculation helpers for vehicle card ───────────────────────

  const getVehicleFare = useCallback((vehicleId: string) => {
    if (!localOrigin || !localDest) return 0;
    const dist = haversineDistance(localOrigin.lat, localOrigin.lng, localDest.lat, localDest.lng);
    const dur = Math.round((dist / 25) * 60);
    return calculateFare(dist, dur, vehicleId);
  }, [localOrigin, localDest]);

  const getVehicleEta = useCallback((vehicleId: string) => {
    if (!localOrigin || !localDest) return 0;
    const dist = haversineDistance(localOrigin.lat, localOrigin.lng, localDest.lat, localDest.lng);
    const vt = vehicleTypes.find(v => v.id === vehicleId);
    if (!vt) return 0;
    // Speed estimate: moto ~35km/h, auto ~25km/h, premium ~25km/h, taxi ~28km/h
    const speedMap: Record<string, number> = { moto: 35, auto: 25, auto_premium: 25, taxi: 28 };
    const speed = speedMap[vehicleId] || 25;
    return Math.round((dist / speed) * 60);
  }, [localOrigin, localDest]);

  // ─── Render ───────────────────────────────────────────────────────────

  const vt = vehicleTypes.find(v => v.id === localVehicle);

  return (
    <div className="relative min-h-[100dvh] bg-[#F5F7FA] pb-24 overflow-hidden">
      {/* ─── Step 1: Input ────────────────────────────────────────── */}
      {step === 'input' && (
        <div className={`transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <button
              onClick={goBackHome}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">¿A dónde vas?</h1>
          </div>

          {/* Input Card (Bottom Sheet Style) */}
          <div className="mx-4 mt-2 bg-white rounded-3xl shadow-lg sheet-slide-up">
            {/* Grab handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Origin / Destination inputs */}
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
                    placeholder="Punto de partida"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0EA5A0]/30 placeholder:text-gray-400 text-gray-800"
                    aria-label="Punto de partida"
                  />
                  <button
                    onClick={applyCurrentLocation}
                    className="w-9 h-9 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center hover:bg-[#0EA5A0]/20 active:scale-95 transition-all flex-shrink-0"
                    aria-label="Usar ubicación actual"
                  >
                    <Navigation className="w-4 h-4 text-[#0EA5A0]" />
                  </button>
                </div>
                {/* Origin suggestions */}
                {showOriginSuggestions && originSuggestions.length > 0 && (
                  <div className="absolute top-full left-14 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-48 overflow-y-auto hide-scrollbar">
                    {originSuggestions.map((s) => (
                      <button
                        key={s.place_id}
                        onMouseDown={() => selectOrigin(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-2 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <MapPin className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-gray-700 leading-snug line-clamp-2">{s.display_name}</span>
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
                    placeholder="¿A dónde vas?"
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#0EA5A0]/30 placeholder:text-gray-400 text-gray-800"
                    aria-label="Destino"
                  />
                </div>
                {/* Dest suggestions */}
                {showDestSuggestions && destSuggestions.length > 0 && (
                  <div className="absolute top-full left-14 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-48 overflow-y-auto hide-scrollbar">
                    {destSuggestions.map((s) => (
                      <button
                        key={s.place_id}
                        onMouseDown={() => selectDest(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-2 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-gray-700 leading-snug line-clamp-2">{s.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle selection (shown when both origin and destination are set) */}
            {localOrigin && localDest && (
              <div className="border-t border-gray-100">
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Elegí tu viaje</span>
                    {tripDistance > 0 && (
                      <span className="text-xs text-gray-400">{tripDistance} km · {tripDuration} min</span>
                    )}
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto hide-scrollbar">
                    {vehicleTypes.map((v) => {
                      const VIcon = VEHICLE_ICONS[v.icon] || Car;
                      const fare = getVehicleFare(v.id);
                      const eta = getVehicleEta(v.id);
                      const isSelected = localVehicle === v.id;
                      const isMoto = v.id === 'moto';

                      return (
                        <button
                          key={v.id}
                          onClick={() => setLocalVehicle(v.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 ${
                            isSelected
                              ? isMoto
                                ? 'bg-[#FF8C42]/10 border-2 border-[#FF8C42]'
                                : 'bg-[#0EA5A0]/5 border-2 border-[#0EA5A0]'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isMoto ? 'bg-[#FF8C42]/15' : isSelected ? 'bg-[#0EA5A0]/15' : 'bg-gray-200/60'
                          }`}>
                            <VIcon className={`w-5 h-5 ${isMoto ? 'text-[#FF8C42]' : isSelected ? 'text-[#0EA5A0]' : 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-gray-900">{v.name}</span>
                              {isMoto && (
                                <span className="text-[10px] font-bold bg-[#FF8C42] text-white px-1.5 py-0.5 rounded-md">POPULAR</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{v.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-gray-900">{formatCurrency(fare)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{eta} min</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Payment method */}
                <div className="px-4 pb-3">
                  <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                    {PAYMENT_METHODS.map((pm) => {
                      const PmIcon = pm.icon;
                      const isSelected = paymentMethod === pm.id;
                      return (
                        <button
                          key={pm.id}
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-[#0EA5A0] text-white shadow-sm shadow-[#0EA5A0]/25'
                              : 'bg-white text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <PmIcon className="w-4 h-4" />
                          {pm.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Request button */}
                <div className="px-4 pb-5">
                  <button
                    onClick={handleRequestRide}
                    className="w-full py-4 rounded-2xl bg-[#0EA5A0] text-white font-bold text-base shadow-lg shadow-[#0EA5A0]/25 hover:bg-[#0C8F8A] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <span>Pedir {vt?.name || 'Unira'}</span>
                    <ChevronRight className="w-5 h-5" />
                    <span className="ml-auto text-lg font-bold">{formatCurrency(tripFare)}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick destinations when no origin set */}
          {!localOrigin && (
            <div className="px-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Destinos frecuentes</h3>
              <div className="grid grid-cols-2 gap-2">
                {places.slice(0, 6).map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setDestText(p.name);
                      setLocalDest(p);
                      store.setDestination(p);
                      if (!localOrigin) {
                        applyCurrentLocation();
                      }
                    }}
                    className="bg-white rounded-2xl p-3 text-left hover:shadow-md active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-[#0EA5A0] mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{p.address}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          <div className="mx-4 mt-4 rounded-2xl overflow-hidden relative" style={{ height: 'calc(100dvh - 420px)', minHeight: '200px', maxHeight: '300px' }}>
            <MapView origin={localOrigin} destination={localDest} />
          </div>        </div>
      )}

      {/* ─── Step 2: Searching ─────────────────────────────────────── */}
      {step === 'searching' && (
        <div className={`min-h-[100dvh] flex flex-col items-center justify-center px-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          {/* Pulsing circles */}
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute w-32 h-32 rounded-full bg-[#0EA5A0]/10 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute w-24 h-24 rounded-full bg-[#0EA5A0]/15 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
            <div className="absolute w-16 h-16 rounded-full bg-[#0EA5A0]/20 animate-ping" style={{ animationDuration: '1s', animationDelay: '0.6s' }} />
            <div className="w-14 h-14 rounded-full bg-[#0EA5A0] flex items-center justify-center shadow-lg shadow-[#0EA5A0]/30 relative z-10">
              {(() => {
                const VIcon = getVehicleIcon(localVehicle);
                return <VIcon className="w-7 h-7 text-white" />;
              })()}
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">Buscando conductor...</h2>
          <p className="text-sm text-gray-500 mb-8">Conectando con socios cercanos</p>

          {/* Animated dots */}
          <div className="flex items-center gap-1.5 mb-12">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-[#0EA5A0] animate-pulse"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>

          <button
            onClick={cancelSearch}
            className="px-8 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ─── Step 3: Driver Found ──────────────────────────────────── */}
      {step === 'driver_found' && driver && (
        <div className={`min-h-[100dvh] flex flex-col items-center justify-center px-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="w-full max-w-sm">
            {/* Driver card */}
            <div className="bg-white rounded-3xl shadow-xl p-6 text-center sheet-slide-up">
              {/* Driver avatar */}
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)',
                }}
              >
                {driver.name.split(' ').map(n => n[0]).join('')}
              </div>

              <h3 className="text-lg font-bold text-gray-900">{driver.name}</h3>

              {/* Rating */}
              <div className="flex items-center justify-center gap-1 mt-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-sm font-semibold text-gray-700">{driver.rating}</span>
              </div>

              {/* Vehicle info */}
              <div className="bg-gray-50 rounded-2xl p-3 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const VIcon = getVehicleIcon(localVehicle);
                      return <VIcon className="w-5 h-5 text-[#0EA5A0]" />;
                    })()}
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{driver.vehicle}</p>
                      <p className="text-xs text-gray-500">{driver.color} · {driver.plate}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trip info */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-start gap-2 text-left">
                  <div className="flex flex-col items-center mt-1">
                    <CircleDot className="w-3 h-3 text-emerald-500" />
                    <div className="w-0.5 h-6 bg-gray-200 my-0.5" />
                    <MapPin className="w-3 h-3 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 truncate">{localOrigin?.name}</p>
                    <p className="text-xs text-gray-500 truncate mt-5">{localDest?.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{tripDistance} km</p>
                    <p className="text-xs text-gray-400 mt-5">{tripDuration} min</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(tripFare)}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{vt?.name}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-5">
                <button className="flex-1 py-3 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm shadow-[#0EA5A0]/25 hover:bg-[#0C8F8A] active:scale-95 transition-all">
                  <Phone className="w-4 h-4" />
                  Llamar
                </button>
                <button className="flex-1 py-3 rounded-2xl bg-white border-2 border-gray-200 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all">
                  <MessageSquare className="w-4 h-4" />
                  Mensaje
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">El conductor llega a tu punto de partida...</p>
          </div>
        </div>
      )}

      {/* ─── Step 4: In Trip ──────────────────────────────────────── */}
      {step === 'in_trip' && (
        <div className={`min-h-[100dvh] flex flex-col items-center justify-center px-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="w-full max-w-sm text-center">
            {/* Status */}
            <div className="mb-6">
              <div className="w-16 h-16 rounded-full bg-[#0EA5A0]/10 flex items-center justify-center mx-auto mb-3">
                <Car className="w-8 h-8 text-[#0EA5A0]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {tripProgress > 90 ? 'Llegando' : 'Viajando'}
              </h2>
            </div>

            {/* Circular progress */}
            <div className="relative w-40 h-40 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none" stroke="#0EA5A0" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - tripProgress / 100)}`}
                  className="transition-all duration-500 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-900">{Math.ceil(tripEta)}</span>
                <span className="text-xs text-gray-500 mt-1">min restantes</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0EA5A0] to-[#0C8CE9] transition-all duration-500 ease-linear"
                style={{ width: `${Math.min(tripProgress, 100)}%` }}
              />
            </div>

            {/* Destination */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-red-500" />
              <span className="font-medium truncate max-w-[240px]">{localDest?.name}</span>
            </div>

            {/* Driver info mini */}
            {driver && (
              <div className="mt-6 bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}
                >
                  {driver.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{driver.name}</p>
                  <p className="text-xs text-gray-500">{driver.vehicle} · {driver.plate}</p>
                </div>
                <button className="w-9 h-9 rounded-full bg-[#0EA5A0]/10 flex items-center justify-center flex-shrink-0" aria-label="Llamar conductor">
                  <Phone className="w-4 h-4 text-[#0EA5A0]" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Step 5: Rate ─────────────────────────────────────────── */}
      {step === 'rate' && driver && (
        <div className={`min-h-[100dvh] flex flex-col items-center justify-center px-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="w-full max-w-sm sheet-slide-up">
            <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
              {/* Completed icon */}
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-1">¿Cómo fue tu viaje?</h2>
              <p className="text-sm text-gray-500 mb-5">Calificá a {driver.name}</p>

              {/* Driver avatar */}
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-lg font-bold text-white shadow-md"
                style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}
              >
                {driver.name.split(' ').map(n => n[0]).join('')}
              </div>

              {/* Star rating */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90"
                    style={{
                      background: star <= rating ? '#FEF3C7' : '#F3F4F6',
                    }}
                    aria-label={`${star} estrellas`}
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Tip section */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Propina</p>
                <div className="flex gap-2">
                  {TIP_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTip(t.value)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        tip === t.value
                          ? 'bg-[#0EA5A0] text-white shadow-sm shadow-[#0EA5A0]/25'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confirm button */}
              <button
                onClick={handleConfirmRating}
                disabled={rating === 0}
                className="w-full py-4 rounded-2xl bg-[#0EA5A0] text-white font-bold text-base shadow-lg shadow-[#0EA5A0]/25 hover:bg-[#0C8F8A] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Step 6: Receipt ──────────────────────────────────────── */}
      {step === 'receipt' && (
        <div className={`min-h-[100dvh] flex flex-col items-center justify-center px-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="w-full max-w-sm sheet-slide-up">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#0EA5A0] to-[#0C8CE9] px-6 py-5 text-center">
                <CheckCircle className="w-12 h-12 text-white mx-auto mb-2" />
                <h2 className="text-lg font-bold text-white">Viaje completado</h2>
              </div>

              {/* Trip summary */}
              <div className="p-6">
                {/* Route */}
                <div className="flex items-start gap-3 mb-5">
                  <div className="flex flex-col items-center mt-1">
                    <CircleDot className="w-3 h-3 text-emerald-500" />
                    <div className="w-0.5 h-8 bg-gray-200 my-0.5" />
                    <MapPin className="w-3 h-3 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{localOrigin?.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{localOrigin?.address}</p>
                    <div className="h-3" />
                    <p className="text-sm font-medium text-gray-900 truncate">{localDest?.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{localDest?.address}</p>
                  </div>
                </div>

                {/* Trip stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <Route className="w-4 h-4 text-[#0EA5A0] mx-auto mb-1" />
                    <p className="text-sm font-bold text-gray-900">{tripDistance} km</p>
                    <p className="text-[10px] text-gray-400">Distancia</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <Clock className="w-4 h-4 text-[#0EA5A0] mx-auto mb-1" />
                    <p className="text-sm font-bold text-gray-900">{tripDuration} min</p>
                    <p className="text-[10px] text-gray-400">Duración</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <Car className="w-4 h-4 text-[#0EA5A0] mx-auto mb-1" />
                    <p className="text-sm font-bold text-gray-900">{vt?.name || ''}</p>
                    <p className="text-[10px] text-gray-400">Vehículo</p>
                  </div>
                </div>

                {/* Price breakdown */}
                <div className="border-t border-gray-100 pt-4 mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Detalle del precio</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Tarifa base</span>
                      <span className="text-gray-700 font-medium">{formatCurrency(fareBreakdown.base)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Por distancia</span>
                      <span className="text-gray-700 font-medium">{formatCurrency(fareBreakdown.distance)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Por tiempo</span>
                      <span className="text-gray-700 font-medium">{formatCurrency(fareBreakdown.time)}</span>
                    </div>
                    {fareBreakdown.tip > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Propina</span>
                        <span className="text-amber-600 font-medium">{formatCurrency(fareBreakdown.tip)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100">
                      <span className="text-gray-900">Total</span>
                      <span className="text-[#0EA5A0]">{formatCurrency(fareBreakdown.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment method */}
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-5">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const pm = PAYMENT_METHODS.find(p => p.id === paymentMethod);
                      const PmIcon = pm?.icon || Banknote;
                      return <PmIcon className="w-4 h-4 text-gray-600" />;
                    })()}
                    <span className="text-sm text-gray-700 font-medium">
                      {PAYMENT_METHODS.find(p => p.id === paymentMethod)?.name || 'Efectivo'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{formatCurrency(fareBreakdown.total)}</span>
                </div>

                {/* Back button */}
                <button
                  onClick={goBackHome}
                  className="w-full py-4 rounded-2xl bg-[#0EA5A0] text-white font-bold text-base shadow-lg shadow-[#0EA5A0]/25 hover:bg-[#0C8F8A] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Volver al inicio
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
