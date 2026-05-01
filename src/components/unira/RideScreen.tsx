'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, type Place, type Trip } from '@/lib/store';
import { vehicleTypes, places } from '@/lib/places';
import { formatCurrency, haversineDistance, calculateFare, generateId } from '@/lib/utils';
import dynamic from 'next/dynamic';
const MapView = dynamic(() => import('./MapView'), { ssr: false });
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
  Users,
  Share2,
  Plus,
  Crosshair,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Parse Nominatim display_name into a proper Place
// Nominatim format: "2535, Avenida 23, Miramar, Partido de General Alvarado, Buenos Aires, Argentina"
// We want: name = "Avenida 23 2535", address = "Miramar, Buenos Aires"
function parseNominatimToPlace(displayName: string, lat: string, lon: string): Place {
  const parts = displayName.split(' - ');
  let rawName: string;
  let rawAddress: string;

  if (parts.length > 1) {
    // Already formatted by our fallback parser
    rawName = parts[0].trim();
    rawAddress = parts.slice(1).join(' - ').trim();
  } else {
    // Nominatim format: comma-separated
    const commaParts = displayName.split(',').map(s => s.trim());
    // First part is usually house number or POI name
    // Second part is usually the street name
    if (commaParts.length >= 2) {
      // If first part is just a number, combine with street name
      const firstPart = commaParts[0];
      const secondPart = commaParts[1];
      if (/^\d+$/.test(firstPart)) {
        // "2535" + "Avenida 23" → "Avenida 23 2535"
        rawName = `${secondPart} ${firstPart}`;
      } else {
        // First part is a street or place name, keep it
        rawName = firstPart;
      }
      // Address: skip the first two parts (used in name), take next 2-3 meaningful parts
      rawAddress = commaParts.slice(2, 5).join(', ');
    } else {
      rawName = commaParts[0];
      rawAddress = '';
    }
  }

  return {
    name: rawName,
    address: rawAddress || displayName.split(',').slice(1, 4).join(', ').trim(),
    lat: parseFloat(lat),
    lng: parseFloat(lon),
  };
}

function getRandomDriver(): DriverData {
  return SAMPLE_DRIVERS[Math.floor(Math.random() * SAMPLE_DRIVERS.length)];
}

function getVehicleIcon(vehicleId: string): React.ElementType {
  const vt = vehicleTypes.find(v => v.id === vehicleId);
  if (!vt) return Car;
  return VEHICLE_ICONS[vt.icon] || Car;
}

// Default location fallback (Buenos Aires)
const DEFAULT_LOCATION: Place = {
  name: 'Mi ubicación',
  address: 'Buenos Aires, CABA',
  lat: -34.6037,
  lng: -58.3816,
};

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
  const [verificationCode, setVerificationCode] = useState('');
  const [tripDistance, setTripDistance] = useState(0);
  const [tripDuration, setTripDuration] = useState(0);
  const [tripFare, setTripFare] = useState(0);
  const [tripProgress, setTripProgress] = useState(0);
  const [tripEta, setTripEta] = useState(0);
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);
  const [fareBreakdown, setFareBreakdown] = useState<FareBreakdown>({ base: 0, distance: 0, time: 0, tip: 0, total: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [thirdName, setThirdName] = useState('');
  const [thirdPhone, setThirdPhone] = useState('');

  // Geolocation
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsAddress, setGpsAddress] = useState<string>('');
  const watchIdRef = useRef<number | null>(null);

  // Map selection mode
  const [selectMode, setSelectMode] = useState<'origin' | 'destination' | null>(null);

  // Multiple waypoints
  const [waypoints, setWaypoints] = useState<Place[]>([]);
  const [isAddingWaypoint, setIsAddingWaypoint] = useState(false);
  const [newWaypointText, setNewWaypointText] = useState('');
  const [newWaypointSuggestions, setNewWaypointSuggestions] = useState<NominatimResult[]>([]);
  const [showNewWaypointSuggestions, setShowNewWaypointSuggestions] = useState(false);

  const originTimerRef = useRef<NodeJS.Timeout | null>(null);
  const destTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waypointTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const tripCompletedRef = useRef(false);

  // ─── Get real geolocation with watchPosition ──────────────────────

  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setUserLocation({ lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng });
      setGpsAddress('GPS no disponible - usando Buenos Aires');
      return;
    }
    setIsLocating(true);

    // Clear previous watch if any
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsLocating(false);
        // Reverse geocode to show address
        reverseGeocode(latitude, longitude).then(addr => {
          setGpsAddress(addr + (accuracy ? ` (~${Math.round(accuracy)}m)` : ''));
        });
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        setIsLocating(false);
        // Fallback: try getCurrentPosition with lower accuracy
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            reverseGeocode(latitude, longitude).then(addr => setGpsAddress(addr + ' (aproximado)'));
          },
          () => {
            setUserLocation({ lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng });
            setGpsAddress('No se pudo obtener ubicación');
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  }, []); // reverseGeocode is stable, no need to re-create

  // Get location on mount, cleanup on unmount
  useEffect(() => {
    getUserLocation();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [getUserLocation]);

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
        { headers: { 'Accept-Language': 'es', 'User-Agent': 'UniraApp/1.0 (demo cooperativa)' } }
      );
      if (!res.ok) throw new Error('Nominatim error');
      const data = await res.json();
      return data.length > 0 ? data : [];
    } catch {
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
    const place = parseNominatimToPlace(result.display_name, result.lat, result.lon);
    setLocalOrigin(place);
    setOriginText(place.name);
    setShowOriginSuggestions(false);
    setSelectMode(null);
    store.setOrigin(place);
  }, [store]);

  const selectDest = useCallback((result: NominatimResult) => {
    const place = parseNominatimToPlace(result.display_name, result.lat, result.lon);
    setLocalDest(place);
    setDestText(place.name);
    setShowDestSuggestions(false);
    setSelectMode(null);
    store.setDestination(place);
  }, [store]);

  // ─── Reverse geocode (lat/lng → address name) ───────────────────────

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'es', 'User-Agent': 'UniraApp/1.0 (demo cooperativa)' } }
      );
      if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const data = await res.json();
      return data.display_name?.split(',').slice(0, 2).join(',').trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, []);

  // ─── Map click handler ───────────────────────────────────────────────

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    const address = await reverseGeocode(lat, lng);
    const place: Place = {
      name: address.split(',')[0].trim(),
      address: address,
      lat,
      lng,
    };

    if (selectMode === 'origin') {
      setLocalOrigin(place);
      setOriginText(place.name);
      store.setOrigin(place);
    } else if (selectMode === 'destination') {
      setLocalDest(place);
      setDestText(place.name);
      store.setDestination(place);
    }
    setSelectMode(null);
  }, [selectMode, reverseGeocode, store]);

  // ─── Use current location as origin ──────────────────────────────────

  const applyCurrentLocation = useCallback(() => {
    const loc = userLocation || DEFAULT_LOCATION;
    const place: Place = {
      name: 'Mi ubicación',
      address: gpsAddress || (userLocation ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : 'Buenos Aires, CABA'),
      lat: loc.lat,
      lng: loc.lng,
    };
    setLocalOrigin(place);
    setOriginText('Mi ubicación');
    store.setOrigin(place);
    // Show toast with detected address
    if (gpsAddress) {
      store.showToast(`Ubicación: ${gpsAddress.split(',')[0]}`, 'success');
    } else if (isLocating) {
      store.showToast('Detectando ubicación...', 'info');
    } else if (!userLocation) {
      store.showToast('No se pudo detectar tu ubicación', 'error');
    }
  }, [userLocation, gpsAddress, isLocating, store]);

  // ─── Add waypoint (multiple destinations) ────────────────────────────
  // Keeps final destination intact, adds new intermediate stop input

  const addWaypoint = useCallback(() => {
    if (waypoints.length >= 4) return;
    setIsAddingWaypoint(true);
    setNewWaypointText('');
    setNewWaypointSuggestions([]);
  }, [waypoints.length]);

  const handleNewWaypointChange = useCallback((value: string) => {
    setNewWaypointText(value);
    if (waypointTimerRef.current) clearTimeout(waypointTimerRef.current);
    if (value.length < 3) {
      setNewWaypointSuggestions([]);
      setShowNewWaypointSuggestions(false);
      return;
    }
    waypointTimerRef.current = setTimeout(async () => {
      const results = await searchNominatim(value);
      setNewWaypointSuggestions(results);
      setShowNewWaypointSuggestions(results.length > 0);
    }, 400);
  }, [searchNominatim]);

  const selectNewWaypoint = useCallback((result: NominatimResult) => {
    const place = parseNominatimToPlace(result.display_name, result.lat, result.lon);
    setWaypoints(prev => [...prev, place]);
    setIsAddingWaypoint(false);
    setNewWaypointText('');
    setNewWaypointSuggestions([]);
    setShowNewWaypointSuggestions(false);
    store.showToast(`Parada agregada: ${place.name}`, 'success');
  }, [store]);

  const cancelAddWaypoint = useCallback(() => {
    setIsAddingWaypoint(false);
    setNewWaypointText('');
    setNewWaypointSuggestions([]);
    setShowNewWaypointSuggestions(false);
  }, []);

  const removeWaypoint = useCallback((index: number) => {
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Calculate fare and trip details (with waypoints) ────────────────
  // Route: origin → waypoint1 → waypoint2 → ... → destination

  useEffect(() => {
    if (localOrigin && localDest) {
      let totalDist = 0;
      let prevPoint = localOrigin;

      // Distance through waypoints in order
      for (const wp of waypoints) {
        totalDist += haversineDistance(prevPoint.lat, prevPoint.lng, wp.lat, wp.lng);
        prevPoint = wp;
      }
      // Final leg to destination
      totalDist += haversineDistance(prevPoint.lat, prevPoint.lng, localDest.lat, localDest.lng);

      const dur = Math.round((totalDist / 25) * 60);
      const fare = calculateFare(totalDist, dur, localVehicle);
      const vt = vehicleTypes.find(v => v.id === localVehicle);
      const baseAmt = vt?.basePrice || 0;
      const distAmt = Math.round(totalDist * (vt?.perKm || 0));
      const timeAmt = Math.round(dur * (vt?.perMin || 0));

      setTripDistance(Math.round(totalDist * 10) / 10);
      setTripDuration(dur);
      setTripFare(fare);
      setFareBreakdown({ base: baseAmt, distance: distAmt, time: timeAmt, tip: 0, total: fare });
    }
  }, [localOrigin, localDest, localVehicle, waypoints]);

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
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setVerificationCode(code);
    store.setTripVerificationCode(code);
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
      const totalDuration = 15000;
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

  // ─── Complete trip (save to history + wallet) — with dedup guard ─────

  useEffect(() => {
    if (step === 'receipt') {
      if (tripCompletedRef.current) return;
      tripCompletedRef.current = true;

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
        thirdParty: thirdName || undefined,
        thirdPhone: thirdPhone || undefined,
        distance: tripDistance,
        duration: tripDuration,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        createdAt: new Date(),
      };

      store.addToHistory(trip);

      if (paymentMethod === 'wallet') {
        store.addMovement({
          id: generateId(),
          type: 'ride',
          amount: -fareBreakdown.total,
          description: `Viaje ${vehicleTypes.find(v => v.id === localVehicle)?.name || 'Unira'} - ${localOrigin.name} → ${localDest.name}${waypoints.length > 0 ? ` (+${waypoints.length} paradas)` : ''}`,
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
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Go back / reset ─────────────────────────────────────────────────

  const goBackHome = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current);
    if (originTimerRef.current) clearTimeout(originTimerRef.current);
    if (destTimerRef.current) clearTimeout(destTimerRef.current);
    if (waypointTimerRef.current) clearTimeout(waypointTimerRef.current);
    tripCompletedRef.current = false;
    setStep('input');
    setRating(0);
    setTip(0);
    setTripProgress(0);
    setTripEta(0);
    setDriver(null);
    setVerificationCode('');
    setThirdName('');
    setThirdPhone('');
    setWaypoints([]);
    setSelectMode(null);
    setIsAddingWaypoint(false);
    setNewWaypointText('');
    store.setTripVerificationCode(null);
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
    let dist = 0;
    let prevPoint = localOrigin;
    for (const wp of waypoints) {
      dist += haversineDistance(prevPoint.lat, prevPoint.lng, wp.lat, wp.lng);
      prevPoint = wp;
    }
    dist += haversineDistance(prevPoint.lat, prevPoint.lng, localDest.lat, localDest.lng);
    const dur = Math.round((dist / 25) * 60);
    return calculateFare(dist, dur, vehicleId);
  }, [localOrigin, localDest, waypoints]);

  const getVehicleEta = useCallback((vehicleId: string) => {
    if (!localOrigin || !localDest) return 0;
    let dist = 0;
    let prevPoint = localOrigin;
    for (const wp of waypoints) {
      dist += haversineDistance(prevPoint.lat, prevPoint.lng, wp.lat, wp.lng);
      prevPoint = wp;
    }
    dist += haversineDistance(prevPoint.lat, prevPoint.lng, localDest.lat, localDest.lng);
    const vt = vehicleTypes.find(v => v.id === vehicleId);
    if (!vt) return 0;
    const speedMap: Record<string, number> = { moto: 35, auto: 25, auto_premium: 25, taxi: 28 };
    const speed = speedMap[vehicleId] || 25;
    return Math.round((dist / speed) * 60);
  }, [localOrigin, localDest, waypoints]);

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
                    title="Mi ubicación"
                  >
                    {isLocating ? (
                      <div className="w-4 h-4 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Crosshair className="w-4 h-4 text-[#0EA5A0]" />
                    )}
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

              {/* Waypoints */}
              {waypoints.map((wp, idx) => (
                <div key={idx} className="relative mt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1 py-1">
                      <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30" />
                      <div className="w-0.5 h-8 bg-gray-200" />
                    </div>
                    <div className="flex-1 text-sm bg-amber-50 rounded-xl px-4 py-3 text-gray-800 flex items-center justify-between">
                      <span className="truncate">{wp.name}</span>
                      <button
                        onClick={() => removeWaypoint(idx)}
                        className="ml-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        aria-label="Quitar parada"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

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
                  {/* Map select buttons */}
                  <button
                    onClick={() => setSelectMode('origin')}
                    className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center hover:bg-emerald-100 active:scale-95 transition-all flex-shrink-0"
                    aria-label="Seleccionar origen en mapa"
                    title="Origen en mapa"
                  >
                    <CircleDot className="w-4 h-4 text-emerald-600" />
                  </button>
                  <button
                    onClick={() => setSelectMode('destination')}
                    className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all flex-shrink-0"
                    aria-label="Seleccionar destino en mapa"
                    title="Destino en mapa"
                  >
                    <MapPin className="w-4 h-4 text-red-500" />
                  </button>
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

              {/* New waypoint input (appears when adding intermediate stop) */}
              {isAddingWaypoint && (
                <div className="relative mt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1 py-1">
                      <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30 animate-pulse" />
                      <div className="w-0.5 h-8 bg-gray-200" />
                    </div>
                    <input
                      type="text"
                      value={newWaypointText}
                      onChange={(e) => handleNewWaypointChange(e.target.value)}
                      onFocus={() => newWaypointSuggestions.length > 0 && setShowNewWaypointSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowNewWaypointSuggestions(false), 200)}
                      placeholder="Parada intermedia..."
                      className="flex-1 text-sm bg-amber-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400/30 placeholder:text-gray-400 text-gray-800"
                      autoFocus
                      aria-label="Parada intermedia"
                    />
                    <button
                      onClick={cancelAddWaypoint}
                      className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all flex-shrink-0"
                      aria-label="Cancelar parada"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  {/* Waypoint suggestions */}
                  {showNewWaypointSuggestions && newWaypointSuggestions.length > 0 && (
                    <div className="absolute top-full left-14 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-30 max-h-48 overflow-y-auto hide-scrollbar">
                      {newWaypointSuggestions.map((s) => (
                        <button
                          key={s.place_id}
                          onMouseDown={() => selectNewWaypoint(s)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-2 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <MapPin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-700 leading-snug line-clamp-2">{s.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Add destination button */}
              {localDest && waypoints.length < 4 && !isAddingWaypoint && (
                <button
                  onClick={addWaypoint}
                  className="w-full mt-2 flex items-center gap-2 text-xs font-semibold text-[#0EA5A0] hover:text-[#0C8F8A] transition-colors py-1 px-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar parada intermedia
                </button>
              )}
            </div>

            {/* Vehicle selection (shown when both origin and destination are set) */}
            {localOrigin && localDest && (
              <div className="border-t border-gray-100">
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Elegí tu viaje</span>
                    {tripDistance > 0 && (
                      <span className="text-xs text-gray-400">{tripDistance} km · {tripDuration} min{waypoints.length > 0 ? ` · ${waypoints.length + 1} paradas` : ''}</span>
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

                <div className="px-0 pb-2"><input type="text" value={thirdName} onChange={e => setThirdName(e.target.value)} placeholder="Viaje para otra persona (opcional)" className="w-full h-10 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-400" /></div>
                {thirdName && (<div className="px-0 pb-2"><input type="tel" value={thirdPhone} onChange={e => setThirdPhone(e.target.value)} placeholder="Telefono de quien viaja (opcional)" className="w-full h-10 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-400" /></div>)}

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
            <MapView
              origin={localOrigin}
              destination={localDest}
              waypoints={waypoints.length > 0 ? waypoints : null}
              userLocation={userLocation}
              selectMode={selectMode}
              onMapClick={handleMapClick}
            />
          </div>
        </div>
      )}

      {/* ─── Step 2: Searching ─────────────────────────────────────── */}
      {step === 'searching' && (
        <div className={`min-h-[100dvh] flex flex-col items-center justify-center px-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
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
          <div className="flex items-center gap-1.5 mb-12">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#0EA5A0] animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
          <button onClick={cancelSearch} className="px-8 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all">Cancelar</button>
        </div>
      )}

      {/* ─── Step 3: Driver Found ──────────────────────────────────── */}
      {step === 'driver_found' && driver && (
        <div className={`min-h-[100dvh] flex flex-col items-center justify-center px-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-3xl shadow-xl p-6 text-center sheet-slide-up">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
                {driver.name.split(' ').map(n => n[0]).join('')}
              </div>
              <h3 className="text-lg font-bold text-gray-900">{driver.name}</h3>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-sm font-semibold text-gray-700">{driver.rating}</span>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 mt-4">
                <div className="flex items-center gap-2">
                  {(() => { const VIcon = getVehicleIcon(localVehicle); return <VIcon className="w-5 h-5 text-[#0EA5A0]" />; })()}
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">{driver.vehicle}</p>
                    <p className="text-xs text-gray-500">{driver.color} · {driver.plate}</p>
                  </div>
                </div>
              </div>
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
              <div className="flex gap-3 mt-5">
                <button className="flex-1 py-3 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm shadow-[#0EA5A0]/25 hover:bg-[#0C8F8A] active:scale-95 transition-all">
                  <Phone className="w-4 h-4" /> Llamar
                </button>
                <button className="flex-1 py-3 rounded-2xl bg-white border-2 border-gray-200 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all">
                  <MessageSquare className="w-4 h-4" /> Mensaje
                </button>
              </div>
            </div>
            {thirdName && (<div className="bg-[#0EA5A0]/5 border border-[#0EA5A0]/20 rounded-2xl p-3 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-[#0EA5A0]" /><div><p className="text-xs text-gray-500">Viaje para</p><p className="text-sm font-semibold text-gray-900">{thirdName}</p></div><button onClick={() => {navigator.clipboard.writeText(verificationCode);store.showToast("Codigo copiado","success")}} className="ml-auto w-8 h-8 rounded-full bg-[#0EA5A0] flex items-center justify-center"><Share2 className="w-4 h-4 text-white" /></button></div>)}
            {verificationCode && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-500 mb-2">Codigo de verificacion</p>
                <div className="flex justify-center gap-2">
                  {verificationCode.split('').map((d, i) => (
                    <div key={i} className="w-10 h-12 rounded-xl bg-[#0EA5A0]/10 border-2 border-[#0EA5A0]/30 flex items-center justify-center">
                      <span className="text-xl font-bold text-[#0EA5A0]">{d}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Mostra este codigo al conductor</p>
              </div>
            )}
            <p className="text-center text-xs text-gray-400 mt-4">El conductor llega a tu punto de partida...</p>
          </div>
        </div>
      )}

      {/* ─── Step 4: In Trip ──────────────────────────────────────── */}
      {step === 'in_trip' && (
        <div className={`min-h-[100dvh] flex flex-col items-center justify-center px-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="w-full max-w-sm text-center">
            <div className="mb-6">
              <div className="w-16 h-16 rounded-full bg-[#0EA5A0]/10 flex items-center justify-center mx-auto mb-3">
                <Car className="w-8 h-8 text-[#0EA5A0]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{tripProgress > 90 ? 'Llegando' : 'Viajando'}</h2>
            </div>
            <div className="relative w-40 h-40 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="#0EA5A0" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={`${2 * Math.PI * 52 * (1 - tripProgress / 100)}`} className="transition-all duration-500 ease-linear" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gray-900">{Math.ceil(tripEta)}</span>
                <span className="text-xs text-gray-500 mt-1">min restantes</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#0EA5A0] to-[#0C8CE9] transition-all duration-500 ease-linear" style={{ width: `${Math.min(tripProgress, 100)}%` }} />
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-red-500" />
              <span className="font-medium truncate max-w-[240px]">{localDest?.name}</span>
            </div>
            {waypoints.length > 0 && (
              <p className="text-xs text-amber-600 mt-1 font-medium">+{waypoints.length} parada{waypoints.length > 1 ? 's' : ''} intermedia{waypoints.length > 1 ? 's' : ''}</p>
            )}
            {driver && (
              <div className="mt-6 bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
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

      {/* ─── Step 5: Rate ────────────────────────────────────────── */}
      {step === 'rate' && (
        <div className={`min-h-[100dvh] flex flex-col items-center justify-center px-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="w-full max-w-sm text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">¡Viaje completado!</h2>
            <p className="text-sm text-gray-500 mb-6">¿Cómo estuvo tu experiencia?</p>
            <div className="flex justify-center gap-3 mb-6">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)} className="transition-transform active:scale-90">
                  <Star className={`w-10 h-10 ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <>
                <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Propina (opcional)</p>
                  <div className="flex gap-2 justify-center">
                    {[0, 500, 1000, 2000].map((t) => (
                      <button key={t} onClick={() => setTip(t)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tip === t ? 'bg-[#0EA5A0] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                        {t === 0 ? 'Sin' : `$${t}`}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleConfirmRating} className="w-full py-4 rounded-2xl bg-[#0EA5A0] text-white font-bold shadow-lg shadow-[#0EA5A0]/25 hover:bg-[#0C8F8A] active:scale-[0.98] transition-all">Confirmar</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Step 6: Receipt ─────────────────────────────────────── */}
      {step === 'receipt' && driver && localOrigin && localDest && (
        <div className={`min-h-[100dvh] flex flex-col px-4 pt-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
              {driver.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{driver.name}</p>
              <p className="text-xs text-gray-500">{driver.vehicle} · {driver.plate}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Ruta</h3>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-0.5">
                <CircleDot className="w-3 h-3 text-emerald-500" />
                <div className="w-0.5 h-5 bg-gray-200" />
                {waypoints.map((wp, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <div className="w-0.5 h-5 bg-gray-200" />
                  </div>
                ))}
                <MapPin className="w-3 h-3 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{localOrigin.name}</p>
                {waypoints.map((wp, i) => (
                  <p key={i} className="text-xs text-gray-500 truncate mt-2">{wp.name}</p>
                ))}
                <p className="text-sm font-semibold text-gray-900 truncate mt-2">{localDest.name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400">{tripDistance} km</p>
                <p className="text-xs text-gray-400 mt-2">{tripDuration} min</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Detalle del pago</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm text-gray-500">Base</span><span className="text-sm font-medium">{formatCurrency(fareBreakdown.base)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">Distancia</span><span className="text-sm font-medium">{formatCurrency(fareBreakdown.distance)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">Tiempo</span><span className="text-sm font-medium">{formatCurrency(fareBreakdown.time)}</span></div>
              {tip > 0 && <div className="flex justify-between"><span className="text-sm text-gray-500">Propina</span><span className="text-sm font-medium text-amber-600">+{formatCurrency(tip)}</span></div>}
              <div className="border-t border-gray-100 pt-2 mt-2">
                <div className="flex justify-between"><span className="text-base font-bold">Total</span><span className="text-lg font-bold text-[#0EA5A0]">{formatCurrency(fareBreakdown.total)}</span></div>
              </div>
            </div>
          </div>

          <button onClick={goBackHome} className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold shadow-lg active:scale-[0.98] transition-all mt-auto">
            Volver al inicio
          </button>
        </div>
      )}
    </div>
  );
}
