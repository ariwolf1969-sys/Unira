'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, type Place, type Trip } from '@/lib/store';
import { vehicleTypes, places, localPlaces } from '@/lib/places';
import { smartSearch, smartReverseGeocode, parseNominatimToPlace, getDetectedArea, resetDetectedArea } from '@/lib/geocoding';
import { formatCurrency, haversineDistance, calculateFare, generateId } from '@/lib/utils';
import { generateRoute, generateRoutePolyline, interpolateAlongRoute, type LatLng, type RouteResult } from '@/lib/route';
import { calculateDynamicFare, getSurgeDescription, getCurrentPeakMultiplier, type DynamicPricingOutput } from '@/lib/dynamicPricing';
import { adjustDurationWithTraffic, getCurrentTrafficInfo, type CongestionLevel } from '@/lib/traffic';
import {
  fetchNavigationSteps,
  speakInstruction,
  stopSpeaking,
  preloadVoices,
  findCurrentStep,
  distanceToNextStep,
  shouldAnnounce,
  type NavigationStep,
} from '@/lib/navigation';
import {
  useTripRecording,
  RecordingConsentModal,
  RecordingIndicator,
  RecordingSummary,
} from './TripRecording';
import dynamic from 'next/dynamic';
const MapView = dynamic(() => import('./MapView'), { ssr: false });
const TripLiveMap = dynamic(() => import('./TripLiveMap'), { ssr: false });
import { RadarAlertOverlay } from './RadarAlertOverlay';
import { TripChat } from './TripChat';
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
  Video,
  Mic,
  Loader2,
  AlertCircle,
  AlertTriangle,
  // Session 17: new vehicle type icons
  Truck,
  Bus,
  PawPrint,
  Accessibility,
  Ship,
  Camera,
  Upload,
  UserCircle,
} from 'lucide-react';

import { compressImage } from '@/lib/image';

// ─── Types ───────────────────────────────────────────────────────────────────

type RideStep = 'input' | 'searching' | 'driver_found' | 'in_trip' | 'rate' | 'receipt';

// ── Grupo K: 1-min wait timer + wait fee ──
// When driver arrives at pickup, passenger has 60s of free wait.
// After that, a per-minute fee is added to the fare.
const WAIT_FREE_SECONDS = 60;
const WAIT_FEE_PER_MIN = 200; // ARS per minute after the free minute

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
}

interface DriverData {
  name: string;
  rating: number;
  vehicle: string;
  plate: string;
  photo: string;
  color: string;
  phone?: string;
  communicationPreference?: 'both' | 'calls' | 'messages';
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
  Truck,
  Bus,
  PawPrint,
  Accessibility,
  Ship,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRandomDriver(): DriverData {
  return SAMPLE_DRIVERS[Math.floor(Math.random() * SAMPLE_DRIVERS.length)];
}

// ── Grupo J: compute bearing (heading in degrees 0-359) from point A to B ──
// Used by the in_trip broadcast to include a heading value with each GPS ping.
function computeBearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
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
  const [driverId, setDriverId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [realTripId, setRealTripId] = useState<string | null>(null);
  const [searchExpired, setSearchExpired] = useState(false);
  const [searchPollRef, setSearchPollRef] = useState<NodeJS.Timeout | null>(null);
  const [searchRetryCount, setSearchRetryCount] = useState(0);
  const [searchStatus, setSearchStatus] = useState('Buscando conductor...');
  const [notifiedCount, setNotifiedCount] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripDuration, setTripDuration] = useState(0);
  const [tripFare, setTripFare] = useState(0);
  const [dynamicPricing, setDynamicPricing] = useState<DynamicPricingOutput | null>(null);
  const [surgeLabel, setSurgeLabel] = useState('Tarifa normal');
  // ── Turn-by-turn navigation state ──
  const [navSteps, setNavSteps] = useState<NavigationStep[]>([]);
  const [navCurrentInstruction, setNavCurrentInstruction] = useState<string | null>(null);
  const [navNextInstruction, setNavNextInstruction] = useState<string | null>(null);
  const [navDistToManeuver, setNavDistToManeuver] = useState<number | undefined>(undefined);
  const [navVoiceEnabled, setNavVoiceEnabled] = useState(true);
  const navStepsRef = useRef<NavigationStep[]>([]);
  const [tripProgress, setTripProgress] = useState(0);
  const [tripEta, setTripEta] = useState(0);
  const [driverLivePosition, setDriverLivePosition] = useState<{ lat: number; lng: number } | null>(null);
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);
  const [fareBreakdown, setFareBreakdown] = useState<FareBreakdown>({ base: 0, distance: 0, time: 0, tip: 0, total: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [thirdName, setThirdName] = useState('');
  const [thirdPhone, setThirdPhone] = useState('');
  const [thirdPhoto, setThirdPhoto] = useState('');

  // Geolocation
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsAddress, setGpsAddress] = useState<string>('');
  const watchIdRef = useRef<number | null>(null);
  const gpsTraceTimerRef = useRef<number | null>(null);
  // Ref to keep userLocation accessible without triggering re-renders of search handlers
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  // Best GPS position seen so far (for accuracy-based filtering)
  const bestGpsPositionRef = useRef<{ lat: number; lng: number; acc: number } | null>(null);

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

  // ── Grupo K: wait timer state ──
  // Shown when driver arrives at pickup. Countdown from 60s (free wait).
  // After that, wait fee accrues at WAIT_FEE_PER_MIN.
  const [showWaitTimer, setShowWaitTimer] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [waitFeeAccrued, setWaitFeeAccrued] = useState(0);
  const waitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active trip ID — generated when entering 'in_trip' step so we can create
  // a share link before the trip is finalized. Reused at 'receipt' step.
  const activeTripIdRef = useRef<string | null>(null);
  // ── Grupo J: live driver tracking ──
  // liveRouteRef caches the route polyline as soon as it's fetched at in_trip
  // start, so we can broadcast interpolated positions along it every 3s.
  // The receipt step reuses this cache instead of re-fetching.
  const liveRouteRef = useRef<RouteResult | null>(null);
  // broadcastRef holds the 3s interval that POSTs the simulated driver
  // position to /api/trips/[id]/location. Cleared on unmount or step change.
  const broadcastRef = useRef<NodeJS.Timeout | null>(null);
  // prevBroadcastPosRef tracks the previous broadcasted position so we can
  // compute heading (bearing) and instantaneous speed between pings.
  const prevBroadcastPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  // ── Grupo J: live tracking UI state ──
  // True once the route polyline has been fetched and the broadcaster
  // interval is running. Drives the "EN VIVO" pill in the in_trip UI.
  const [liveTrackingActive, setLiveTrackingActive] = useState(false);
  // ── Grupo G: share link ──
  const [shareLoading, setShareLoading] = useState(false);
  // ── Grupo I: rating reason ──
  const [ratingReason, setRatingReason] = useState('');
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // ─── Get real geolocation with watchPosition ──────────────────────

  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const defLoc = { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng };
      setUserLocation(defLoc);
      userLocationRef.current = defLoc;
      setGpsAddress('GPS no disponible - usando Buenos Aires');
      return;
    }
    setIsLocating(true);

    // Clear previous watch if any
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    // Accuracy filter: only accept positions with accuracy < 200m
    // GPS in urban areas typically gives 5-30m. Cell tower gives 100-3000m.
    // We want to wait for a real GPS fix, not a rough cell tower estimate.
    const ACCURACY_THRESHOLD = 200; // meters

    const onPosition = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;

      // Skip very inaccurate fixes (cell tower / IP-based)
      if (accuracy > ACCURACY_THRESHOLD) {
        console.log(`[GPS] Skipping low-accuracy fix: ${Math.round(accuracy)}m (threshold: ${ACCURACY_THRESHOLD}m)`);
        // Keep the best position we've seen so far as fallback
        if (!bestGpsPositionRef.current || accuracy < bestGpsPositionRef.current.acc) {
          bestGpsPositionRef.current = { lat: latitude, lng: longitude, acc: accuracy };
        }
        // If we've been waiting and only have inaccurate fixes, use the best one
        if (bestGpsPositionRef.current && bestGpsPositionRef.current.acc < 1000) {
          const best = bestGpsPositionRef.current;
          console.log(`[GPS] Using best available: ${Math.round(best.acc)}m`);
          const loc = { lat: best.lat, lng: best.lng };
          setUserLocation(loc);
          userLocationRef.current = loc;
          setIsLocating(false);
          reverseGeocode(best.lat, best.lng).then(addr => {
            setGpsAddress(addr + ` (~${Math.round(best.acc)}m)`);
          });
          getDetectedArea(best.lat, best.lng);
        }
        return; // Don't update map with inaccurate position
      }

      const loc = { lat: latitude, lng: longitude };
      setUserLocation(loc);
      userLocationRef.current = loc;
      setIsLocating(false);
      bestGpsPositionRef.current = { lat: latitude, lng: longitude, acc: accuracy };
      // Reset detected area when we get a significantly different position
      resetDetectedArea();
      // Reverse geocode to show address
      reverseGeocode(latitude, longitude).then(addr => {
        const accStr = accuracy ? ` (~${Math.round(accuracy)}m)` : '';
        setGpsAddress(addr + accStr);
      });
      // Also pre-detect the area for smart geocoding
      getDetectedArea(latitude, longitude);
      // ── Phase 2: GPS trace collection (throttled to every 10s) ──
      const now = Date.now();
      if (gpsTraceTimerRef.current === null ||
          now - gpsTraceTimerRef.current > 10000) {
        gpsTraceTimerRef.current = now;
        const uid = useAppStore.getState().user?.uid;
        if (uid && uid !== 'demo') {
          void fetch('/api/tracking/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: uid, lat: latitude, lng: longitude,
              speed: speed || 0, heading: heading || 0,
              accuracy: accuracy || 0, altitude: altitude || 0,
            }),
          }).catch(() => {});
        }
      }
    };

    const onError = (error: GeolocationPositionError) => {
      console.warn('Geolocation error:', error.message);
      // Fallback 1: try with low accuracy and longer timeout
      navigator.geolocation.getCurrentPosition(
        onPosition,
        () => {
          // Fallback 2: try with maximum cache age (might use cell tower / IP)
          navigator.geolocation.getCurrentPosition(
            onPosition,
            () => {
              const defLoc = { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng };
              setUserLocation(defLoc);
              userLocationRef.current = defLoc;
              setGpsAddress('No se pudo obtener ubicación — usá el mapa para seleccionar');
              setIsLocating(false);
            },
            { enableHighAccuracy: false, timeout: 30000, maximumAge: 600000 }
          );
        },
        { enableHighAccuracy: false, timeout: 30000, maximumAge: 300000 }
      );
    };

    // Use strict settings: require fresh GPS fix (max 5s old)
    // and wait up to 30s for first fix
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      onError,
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
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

  // ─── Autocomplete with smart geocoding ────────────────────────────────

  // All local places (Miramar + BA) for fallback
  const allLocalPlaces = [...localPlaces, ...places];

  const searchNominatim = useCallback(async (query: string): Promise<NominatimResult[]> => {
    // Use ref instead of state to avoid recreating this callback on every GPS update
    const uLoc = userLocationRef.current || undefined;
    return smartSearch(
      query,
      uLoc?.lat,
      uLoc?.lng,
      allLocalPlaces
    );
  }, [allLocalPlaces]); // NOTE: intentionally NOT depending on userLocation

  const handleOriginChange = useCallback((value: string) => {
    setOriginText(value);
    setLocalOrigin(null);
    if (originTimerRef.current) clearTimeout(originTimerRef.current);
    if (value.length < 2) {
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      return;
    }
    originTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchNominatim(value);
        setOriginSuggestions(results);
        setShowOriginSuggestions(results.length > 0);
      } catch (err) {
        console.warn('Origin search error:', err);
        setOriginSuggestions([]);
      }
    }, 350);
  }, [searchNominatim]);

  const handleDestChange = useCallback((value: string) => {
    setDestText(value);
    setLocalDest(null);
    if (destTimerRef.current) clearTimeout(destTimerRef.current);
    if (value.length < 2) {
      setDestSuggestions([]);
      setShowDestSuggestions(false);
      return;
    }
    destTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchNominatim(value);
        setDestSuggestions(results);
        setShowDestSuggestions(results.length > 0);
      } catch (err) {
        console.warn('Dest search error:', err);
        setDestSuggestions([]);
      }
    }, 350);
  }, [searchNominatim]);

  const selectOrigin = useCallback((result: NominatimResult) => {
    try {
      const place = parseNominatimToPlace(result.display_name, result.lat, result.lon);
      if (!isFinite(place.lat) || !isFinite(place.lng)) {
        console.warn('selectOrigin: invalid coordinates from Nominatim');
        return;
      }
      setLocalOrigin(place);
      setOriginText(place.name);
      setShowOriginSuggestions(false);
      setSelectMode(null);
      store.setOrigin(place);
    } catch (err) {
      console.error('selectOrigin error:', err);
    }
  }, [store]);

  const selectDest = useCallback((result: NominatimResult) => {
    try {
      const place = parseNominatimToPlace(result.display_name, result.lat, result.lon);
      if (!isFinite(place.lat) || !isFinite(place.lng)) {
        console.warn('selectDest: invalid coordinates from Nominatim');
        return;
      }
      setLocalDest(place);
      setDestText(place.name);
      setShowDestSuggestions(false);
      setSelectMode(null);
      store.setDestination(place);
    } catch (err) {
      console.error('selectDest error:', err);
    }
  }, [store]);

  // ─── Reverse geocode (lat/lng → address name) ───────────────────────

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    return smartReverseGeocode(lat, lng);
  }, []);

  // ─── Map click handler ───────────────────────────────────────────────

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!isFinite(lat) || !isFinite(lng)) return;
    try {
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
    } catch (err) {
      console.error('handleMapClick error:', err);
    }
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
    if (value.length < 2) {
      setNewWaypointSuggestions([]);
      setShowNewWaypointSuggestions(false);
      return;
    }
    waypointTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchNominatim(value);
        setNewWaypointSuggestions(results);
        setShowNewWaypointSuggestions(results.length > 0);
      } catch (err) {
        console.warn('Waypoint search error:', err);
        setNewWaypointSuggestions([]);
      }
    }, 350);
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

  // ─── Fare estimation: use OSRM for real duration + dynamic pricing ──
  useEffect(() => {
    if (!localOrigin || !localDest) return;

    // Guard: skip if coordinates are invalid
    if (!isFinite(localOrigin.lat) || !isFinite(localOrigin.lng) ||
        !isFinite(localDest.lat) || !isFinite(localDest.lng)) {
      console.warn('RideScreen: invalid coordinates, skipping fare calc');
      return;
    }

    try {
      // Quick haversine estimate first (immediate UI feedback)
      let totalDist = 0;
      let prevPoint = localOrigin;
      for (const wp of waypoints) {
        totalDist += haversineDistance(prevPoint.lat, prevPoint.lng, wp.lat, wp.lng);
        prevPoint = wp;
      }
      totalDist += haversineDistance(prevPoint.lat, prevPoint.lng, localDest.lat, localDest.lng);
      const haversineDur = Math.round((totalDist / 25) * 60);
      const flatFare = calculateFare(totalDist, haversineDur, localVehicle);
      const vt = vehicleTypes.find(v => v.id === localVehicle);
      const baseAmt = vt?.basePrice || 0;
      const distAmt = Math.round(totalDist * (vt?.perKm || 0));
      const timeAmt = Math.round(haversineDur * (vt?.perMin || 0));

      setTripDistance(Math.round(totalDist * 10) / 10);
      setTripDuration(haversineDur);
      setTripFare(flatFare);
      setFareBreakdown({ base: baseAmt, distance: distAmt, time: timeAmt, tip: 0, total: flatFare });

      // ── Dynamic pricing with current conditions ──
      try {
        getCurrentPeakMultiplier(); // warm peak cache
        const dynamic = calculateDynamicFare({
          distanceKm: totalDist,
          durationMin: haversineDur,
          vehicleTypeId: localVehicle,
          demandSupplyRatio: 0.5, // TODO: fetch from API
        });
        setDynamicPricing(dynamic);
        setSurgeLabel(getSurgeDescription(dynamic));
        if (dynamic.surgeMultiplier > 1.05) {
          setTripFare(dynamic.finalFare);
          setFareBreakdown({
            base: baseAmt,
            distance: distAmt,
            time: timeAmt,
            tip: 0,
            total: dynamic.finalFare,
          });
        }
      } catch (dynErr) {
        console.warn('Dynamic pricing error, using flat fare:', dynErr);
      }

      // ── Override with OSRM real duration when available ──
      generateRoute(localOrigin, localDest, waypoints)
        .then((result) => {
          if (result.durationMin > 0) {
            // Apply traffic adjustment for AMBA
            const trafficAdj = adjustDurationWithTraffic(result.durationMin);
            const finalDuration = Math.max(result.durationMin, trafficAdj);
            setTripDuration(finalDuration);
            if (result.distanceKm > 0) {
              setTripDistance(Math.round(result.distanceKm * 10) / 10);
            }
            // Recalculate fare with traffic-adjusted duration
            const osrmDist = result.distanceKm || totalDist;
            const osrmFare = calculateFare(osrmDist, finalDuration, localVehicle);
            const osrmVt = vehicleTypes.find(v => v.id === localVehicle);
            const osrmBase = osrmVt?.basePrice || 0;
            const osrmDistAmt = Math.round(osrmDist * (osrmVt?.perKm || 0));
            const osrmTimeAmt = Math.round(finalDuration * (osrmVt?.perMin || 0));
            // Re-apply dynamic pricing with traffic-adjusted duration
            try {
              const osrmDynamic = calculateDynamicFare({
                distanceKm: osrmDist,
                durationMin: finalDuration,
                vehicleTypeId: localVehicle,
                demandSupplyRatio: 0.5,
              });
              const finalFare = osrmDynamic.surgeMultiplier > 1.05 ? osrmDynamic.finalFare : osrmFare;
              setTripFare(finalFare);
              setFareBreakdown({ base: osrmBase, distance: osrmDistAmt, time: osrmTimeAmt, tip: 0, total: finalFare });
              setDynamicPricing(osrmDynamic);
              setSurgeLabel(getSurgeDescription(osrmDynamic));
            } catch (osrmDynErr) {
              console.warn('OSRM dynamic pricing error:', osrmDynErr);
              setTripFare(osrmFare);
              setFareBreakdown({ base: osrmBase, distance: osrmDistAmt, time: osrmTimeAmt, tip: 0, total: osrmFare });
            }
          }
        })
        .catch(() => {
          // Keep haversine estimates — already set above
        });
    } catch (err) {
      console.error('RideScreen fare calculation error:', err);
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

  const handleRequestRide = useCallback(async () => {
    if (!localOrigin || !localDest) return;
    store.setSelectedVehicle(localVehicle);
    setSearchExpired(false);
    transitionTo('searching');

    // Try real matching via API
    const user = store.user;
    if (user && user.uid && user.uid !== 'demo') {
      try {
        const res = await fetch('/api/trips/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            origin: { name: localOrigin.name, address: localOrigin.address, lat: localOrigin.lat, lng: localOrigin.lng },
            destination: { name: localDest.name, address: localDest.address, lat: localDest.lat, lng: localDest.lng },
            waypoints: waypoints.length > 0 ? waypoints : undefined,
            fare: tripFare,
            distance: tripDistance,
            duration: tripDuration,
            vehicleType: localVehicle,
            paymentMethod,
            thirdParty: thirdName || undefined,
            thirdPartyPhoto: thirdPhoto || undefined,
          }),
        });
        const data = await res.json();
        if (data.trip?.id) {
          const tid = data.trip.id;
          setRealTripId(tid);
          setVerificationCode(data.trip.verificationCode);
          store.setTripVerificationCode(data.trip.verificationCode);
          return; // Polling will handle the rest
        }
      } catch (err) {
        console.warn('[ride] Real matching failed, using simulation:', err);
      }
    }

    // Fallback: simulation
    setDriver(getRandomDriver());
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setVerificationCode(code);
    store.setTripVerificationCode(code);
  }, [localOrigin, localDest, localVehicle, store, transitionTo, waypoints, tripFare, tripDistance, tripDuration, paymentMethod]);

  // ─── Searching → poll for driver acceptance or use fallback ──────────

  useEffect(() => {
    if (step === 'searching') {
      // Reset retry state when entering search
      setSearchRetryCount(0);
      setSearchExpired(false);
      setSearchStatus('Buscando conductor...');
      setNotifiedCount(0);

      // If we have a real trip ID, poll for status
      if (realTripId) {
        const poll = setInterval(async () => {
          try {
            const res = await fetch(`/api/trips/${realTripId}/status?role=passenger`);
            const data = await res.json();
            if (data.status === 'accepted' && data.driver) {
              clearInterval(poll);
              setDriverId(data.driver.id || null);
              setDriver({
                name: data.driver.name || 'Conductor',
                rating: data.driver.rating || 4.5,
                vehicle: data.driver.vehicle || '',
                plate: data.driver.plate || '',
                photo: data.driver.photo || '',
                color: '',
                phone: data.driver.phone || '',
                communicationPreference: data.driver.communicationPreference || 'both',
              });
              setSearchPollRef(null);
              transitionTo('driver_found');
            } else if (data.status === 'expired') {
              clearInterval(poll);
              // Auto-retry with expanded radius (up to 2 retries)
              if (searchRetryCount < 2) {
                const mult = searchRetryCount === 0 ? 2 : 3;
                setSearchStatus(`Reintentando... radio ${mult}x`);
                try {
                  const retryRes = await fetch(`/api/trips/${realTripId}/retry-search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ expandRadiusMultiplier: mult }),
                  });
                  const retryData = await retryRes.json();
                  if (retryData.success) {
                    setSearchRetryCount(prev => prev + 1);
                    setNotifiedCount(retryData.totalNotified || 0);
                    setSearchStatus(`Buscando conductor... ${retryData.totalNotified} notificados`);
                    // Continue polling - the trip is re-activated with new expiry
                  } else {
                    setSearchExpired(true);
                    setRealTripId(null);
                    setSearchPollRef(null);
                  }
                } catch {
                  setSearchExpired(true);
                  setRealTripId(null);
                  setSearchPollRef(null);
                }
              } else {
                setSearchExpired(true);
                setRealTripId(null);
                setSearchPollRef(null);
              }
            }
          } catch { /* ignore poll errors */ }
        }, 2000);
        setSearchPollRef(poll);

        // Timeout after 3 minutes total for all retries
        const timeout = setTimeout(() => {
          clearInterval(poll);
          if (store.user?.uid && store.user.uid !== 'demo') {
            setSearchExpired(true);
            setRealTripId(null);
          } else {
            // Fallback simulation for demo user
            transitionTo('driver_found');
          }
          setSearchPollRef(null);
        }, 180000);

        return () => { clearInterval(poll); clearTimeout(timeout); };
      } else {
        // Fallback simulation (no real trip ID = demo mode)
        const timer = setTimeout(() => {
          transitionTo('driver_found');
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [step, realTripId, transitionTo, store]);

  // ─── Driver found → show wait timer (Grupo K) → in trip ──────────
  // When the driver arrives at the pickup point, we show a 60-second
  // countdown timer. The passenger has 1 minute of free wait; after that,
  // a per-minute wait fee accrues. After 90s (60s free + 30s fee), the
  // trip starts automatically (passenger should already be in the car).
  useEffect(() => {
    if (step === 'driver_found') {
      // After a 2s "driver is on the way" preview, show the wait timer
      // (simulating that the driver has arrived at the pickup).
      const arrivalTimer = setTimeout(() => {
        setShowWaitTimer(true);
        setWaitSeconds(0);
        setWaitFeeAccrued(0);

        // Start countdown
        waitTimerRef.current = setInterval(() => {
          setWaitSeconds((prev) => {
            const next = prev + 1;
            // After free wait, accrue fee every 60s
            if (next > WAIT_FREE_SECONDS && (next - WAIT_FREE_SECONDS) % 60 === 0) {
              setWaitFeeAccrued((fee) => fee + WAIT_FEE_PER_MIN);
            }
            return next;
          });
        }, 1000);

        // Auto-start trip after 90s total (60s free + 30s into fee window)
        // — in real life, the driver would tap "Start trip" on their app.
        setTimeout(() => {
          if (waitTimerRef.current) {
            clearInterval(waitTimerRef.current);
            waitTimerRef.current = null;
          }
          setShowWaitTimer(false);
          transitionTo('in_trip');
        }, 90000);
      }, 2000);

      return () => {
        clearTimeout(arrivalTimer);
        if (waitTimerRef.current) {
          clearInterval(waitTimerRef.current);
          waitTimerRef.current = null;
        }
      };
    }
  }, [step, transitionTo]);

  // Allow passenger to manually start the trip ("Ya subí" button)
  const handlePassengerBoarded = () => {
    if (waitTimerRef.current) {
      clearInterval(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    setShowWaitTimer(false);
    transitionTo('in_trip');
  };

  // ─── Trip recording (Grupo F) ────────────────────────────────────────
  const [showRecordingConsent, setShowRecordingConsent] = useState(false);
  const [stoppedRecordingSummary, setStoppedRecordingSummary] = useState<{
    type: 'audio' | 'video';
    durationSec: number;
    blobUrl?: string;
  } | null>(null);
  const {
    recording: activeRecording,
    elapsedSec: recordingElapsed,
    error: recordingError,
    startRecording,
    stopRecording: stopRecordingHook,
    discardRecording,
  } = useTripRecording();

  // Show consent modal automatically when trip enters "in_trip" step
  useEffect(() => {
    if (step === 'in_trip') {
      setShowRecordingConsent(true);
    }
    return () => {
      // Stop any active recording when leaving in_trip step
      if (activeRecording) {
        try {
          if (activeRecording.mediaRecorder.state !== 'inactive') {
            activeRecording.mediaRecorder.stop();
          }
          activeRecording.stream.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }
      }
    };
  }, [step]);

  const handleAcceptRecording = useCallback(
    async (type: 'audio' | 'video') => {
      setShowRecordingConsent(false);
      const ok = await startRecording(type);
      if (!ok) {
        store.showToast('No se pudo iniciar la grabación. Revisá los permisos.', 'error');
      }
    },
    [startRecording, store]
  );

  const handleStopRecording = useCallback(() => {
    if (!activeRecording) return;
    const type = activeRecording.type;
    const durationSec = recordingElapsed;
    // The hook's stopRecording will call onstop asynchronously and set blobUrl
    // We capture the summary now and update the blobUrl when ready
    setStoppedRecordingSummary({ type, durationSec, blobUrl: undefined });
    stopRecordingHook();
    // After a tick, refresh the summary with the actual blob URL
    setTimeout(() => {
      // activeRecording is now null after stopRecording, but the hook captures blobUrl
      // We can't access it directly — re-derive from the hook state via a custom trick:
      // just leave blobUrl undefined; the download link will appear when activeRecording.blobUrl is set
    }, 200);
  }, [activeRecording, recordingElapsed, stopRecordingHook]);

  const handleDiscardStopped = useCallback(() => {
    setStoppedRecordingSummary(null);
    discardRecording();
  }, [discardRecording]);

  // ── Grupo J: keep tripProgressRef in sync so the broadcast closure ──
  // can read the latest progress value without re-creating the interval.
  // Declared BEFORE the in_trip effect that uses it.
  const tripProgressRef = useRef(0);
  useEffect(() => {
    tripProgressRef.current = tripProgress;
  }, [tripProgress]);

  // ─── In trip progress simulation + Grupo J live broadcast ────────────────
  // ── CRITICAL FIX: Poll server for trip status during in_trip ──
  // The passenger must wait for the DRIVER to complete the trip on the server,
  // not auto-complete via a local timer. We poll /api/trips/[id]/status every 3s
  // and transition to 'rate' when the server says status='completed'.
  // We also consume GET /api/trips/[id]/location for live driver position.

  useEffect(() => {
    if (step !== 'in_trip') {
      setLiveTrackingActive(false);
      return;
    }
    setLiveTrackingActive(false);

    // ── Notify server that passenger considers trip started ──
    // This helps sync server state when passenger taps "Ya subí"
    if (realTripId && store.user?.uid && store.user.uid !== 'demo') {
      void fetch(`/api/trips/${realTripId}/status?role=passenger&action=passenger_boarded`, {
        method: 'GET',
      }).catch(() => {});
    }

    // Generate tripId early so we can create a share link before the
    // trip is finalized. We persist the trip with status='in_progress'
    // so the share page can render the route and progress.
    if (!activeTripIdRef.current && localOrigin && localDest && driver) {
      // Use realTripId if we have one (from real matching), otherwise generate
      const earlyTripId = realTripId || generateId();
      activeTripIdRef.current = earlyTripId;
      const earlyTrip: Trip = {
        id: earlyTripId,
        type: 'ride',
        status: 'in_progress',
        origin: localOrigin,
        destination: localDest,
        fare: fareBreakdown.total,
        vehicleType: localVehicle,
        driverId: driverId || 'drv-' + Math.floor(Math.random() * 500),
        driverName: driver.name,
        driverPhoto: driver.photo,
        driverVehicle: `${driver.vehicle} - ${driver.color}`,
        distance: tripDistance,
        duration: tripDuration,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        createdAt: new Date().toISOString(),
      };
      // Persist locally + to server (fire-and-forget)
      store.addToHistory(earlyTrip);
      store.setCurrentTrip(earlyTrip);

      // ── Grupo J: fetch the route polyline immediately so we can ──
      if (localOrigin && localDest) {
        generateRoute(localOrigin, localDest, waypoints)
          .then((result) => {
            if (result.polyline.length === 0) return;
            liveRouteRef.current = result;
            setLiveTrackingActive(true);
            // Patch local trip in history with the route
            const state = useAppStore.getState();
            const updated = state.tripHistory.map((t) =>
              t.id === earlyTripId ? { ...t, route: result.polyline } : t
            );
            useAppStore.setState({ tripHistory: updated });
            // Re-sync to server so /api/share/[token] can read the route
            const patched: Trip = { ...earlyTrip, route: result.polyline };
            void state.syncTripToServer(patched);
          })
          .catch((err) => console.warn('[ride/J] route fetch failed:', err));

        // ── Fetch turn-by-turn navigation steps ──
        fetchNavigationSteps(localOrigin, localDest, waypoints)
          .then((steps) => {
            if (steps.length === 0) return;
            setNavSteps(steps);
            navStepsRef.current = steps;
            // Set initial instruction (depart)
            const depart = steps[0];
            setNavCurrentInstruction(depart.instructionEs);
            if (steps.length > 1) {
              setNavNextInstruction(steps[1].instructionEs);
            }
            // Speak the first instruction
            if (navVoiceEnabled) {
              setTimeout(() => speakInstruction(depart.instructionEs), 1500);
            }
          })
          .catch((err) => console.warn('[ride/nav] Navigation steps failed:', err));
      }
    }

    // Use real trip duration (OSRM minutes → ms). Minimum 30s for very short trips.
    const totalDuration = Math.max((tripDuration || 15) * 60 * 1000, 30_000);
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

    // ── Grupo J: broadcast simulated driver position every 3s ──
    // The passenger app currently simulates the driver's movement along the
    // route. We broadcast that simulated position to the server so the
    // public share page (/viaje/[token]) and any future passenger polling
    // can render the driver's "live" position. When a real driver app
    // exists (Grupo L), it will replace this broadcaster and the consumer
    // side stays unchanged.
    const BROADCAST_INTERVAL_MS = 3000;
    const broadcast = () => {
      const tripId = activeTripIdRef.current;
      const user = store.user;
      const routeResult = liveRouteRef.current;
      const route = routeResult?.polyline;
      if (!tripId || !user || !route || route.length < 2) return;

      // Current progress 0..1 from tripProgress state (0..100)
      const progressVal = Math.min(1, Math.max(0, tripProgressRef.current / 100));
      const pos = interpolateAlongRoute(route, progressVal);
      if (!pos) return;

      const now = Date.now();
      const prev = prevBroadcastPosRef.current;
      let heading: number | undefined;
      let speed: number | undefined;
      if (prev) {
        const dtSec = Math.max(0.1, (now - prev.t) / 1000);
        const distKm = haversineDistance(prev.lat, prev.lng, pos.lat, pos.lng);
        speed = distKm > 0.001 ? distKm / (dtSec / 3600) : 0; // km/h
        heading = computeBearingDeg(prev.lat, prev.lng, pos.lat, pos.lng);
      }
      prevBroadcastPosRef.current = { lat: pos.lat, lng: pos.lng, t: now };

      // Fire-and-forget POST
      void fetch(`/api/trips/${tripId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          lat: pos.lat,
          lng: pos.lng,
          heading,
          speed,
        }),
      }).catch((err) => console.warn('[ride/J] broadcast failed:', err));
    };

    // Initial broadcast after a short delay (let route fetch complete)
    const initialBroadcastTimer = setTimeout(broadcast, 1500);
    broadcastRef.current = setInterval(broadcast, BROADCAST_INTERVAL_MS);

    // ── CRITICAL: Server-side trip completion polling ──
    // Instead of auto-completing via local timer, poll the server every 3s
    // to check if the DRIVER has completed the trip. When the server returns
    // status='completed', transition passenger to 'rate' screen.
    const isRealTrip = realTripId && store.user?.uid && store.user.uid !== 'demo';
    let serverCompleted = false;

    const statusPollRef = isRealTrip ? setInterval(async () => {
      try {
        const res = await fetch(`/api/trips/${realTripId}/status?role=passenger`);
        const data = await res.json();
        if (data.status === 'completed' && !serverCompleted) {
          serverCompleted = true;
          if (statusPollRef) clearInterval(statusPollRef);
          if (progressRef.current) clearInterval(progressRef.current);
          setTripProgress(100);
          setTripEta(0);
          store.showToast('El conductor completó el viaje', 'success');
          transitionTo('rate');
        }
        // Consume live driver position from server
        if (data.currentLat && data.currentLng) {
          setDriverLivePosition({ lat: data.currentLat, lng: data.currentLng });
        }
      } catch { /* ignore poll errors */ }
    }, 3000) : null;

    // Fallback: for demo mode (no real trip), use local timer as before
    const completeTimer = !isRealTrip ? setTimeout(() => {
      if (progressRef.current) clearInterval(progressRef.current);
      // Final broadcast at 100% so the share page snaps to destination
      const tripId = activeTripIdRef.current;
      const user = store.user;
      const routeResult = liveRouteRef.current;
      const route = routeResult?.polyline;
      if (tripId && user && route && route.length >= 2) {
        const last = route[route.length - 1];
        void fetch(`/api/trips/${tripId}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            lat: last[0],
            lng: last[1],
            heading: 0,
            speed: 0,
          }),
        }).catch(() => {});
      }
      transitionTo('rate');
    }, totalDuration + 2000) : null;

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (broadcastRef.current) clearInterval(broadcastRef.current);
      if (statusPollRef) clearInterval(statusPollRef);
      clearTimeout(initialBroadcastTimer);
      if (completeTimer) clearTimeout(completeTimer);
      stopSpeaking(); // Stop any ongoing TTS
    };
  }, [step, tripDuration, transitionTo, store, localOrigin, localDest, driver, localVehicle, fareBreakdown.total, tripDistance, waypoints, realTripId, driverId]);

  // ─── Turn-by-turn navigation tracking ──────────────────────────────
  useEffect(() => {
    if (step !== 'in_trip' || navSteps.length === 0 || !liveRouteRef.current) return;

    const routeResult = liveRouteRef.current;
    const route = routeResult.polyline;
    if (route.length < 2) return;

    // Calculate approximate distance traveled based on progress
    // Use the OSRM distance if available, otherwise compute from polyline
    const totalDistMeters = routeResult.distanceKm * 1000 || 0;
    const progressFraction = tripProgress / 100;
    const distTraveledMeters = totalDistMeters * progressFraction;

    // Find current step
    const currentIdx = findCurrentStep(navSteps, distTraveledMeters);
    const currentStep = navSteps[currentIdx];
    const nextStep = navSteps[currentIdx + 1];

    if (!currentStep) return;

    // Update instruction
    if (currentStep.type !== 'depart') {
      setNavCurrentInstruction(currentStep.instructionEs);
    }
    if (nextStep) {
      setNavNextInstruction(nextStep.instructionEs);
    } else {
      setNavNextInstruction(null);
    }

    // Update distance to next maneuver
    const dist = distanceToNextStep(navSteps, currentIdx, distTraveledMeters);
    setNavDistToManeuver(dist);

    // Check if we should announce
    if (navVoiceEnabled) {
      const { shouldSpeak, text, isFinal } = shouldAnnounce(navSteps, currentIdx, distTraveledMeters);
      if (shouldSpeak && text) {
        speakInstruction(text, isFinal ? 0.9 : 1.0);
        // Mark step as announced
        const updatedSteps = [...navSteps];
        updatedSteps[currentIdx] = { ...updatedSteps[currentIdx], announced: true };
        navStepsRef.current = updatedSteps;
        setNavSteps(updatedSteps);
      }
    }
  }, [step, tripProgress, navSteps, navVoiceEnabled]);

  // ─── Preload TTS voices on mount ───────────────────────────────────
  useEffect(() => {
    preloadVoices().catch(() => {});
  }, []);

  // ─── Grupo G: share trip link ──────────────────────────────────────
  // Generates (or reuses) a share token and opens the native share sheet.
  // Falls back to clipboard copy on desktop browsers.
  const handleShareTrip = useCallback(async () => {
    if (!store.user) return;
    const tripId = activeTripIdRef.current;
    if (!tripId) {
      store.showToast('El viaje todavía no está disponible para compartir', 'info');
      return;
    }
    setShareLoading(true);
    try {
      // Get share token from server (reuses active link if exists)
      const shareRes = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, userId: store.user.uid }),
      });
      if (!shareRes.ok) {
        store.showToast('No se pudo generar el enlace de seguimiento', 'error');
        return;
      }
      const { token } = (await shareRes.json()) as { token: string };
      const shareUrl = `${window.location.origin}/viaje/${token}`;
      const driverName = driver?.name?.split(' ')[0] ?? 'el conductor';
      const text = `Seguí mi viaje en Unira de ${localOrigin?.name ?? 'origen'} a ${localDest?.name ?? 'destino'} con ${driverName}. En vivo: ${shareUrl}`;
      // Web Share API (mobile + supported desktop)
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Seguimiento de viaje Unira',
            text,
            url: shareUrl,
          });
        } catch {
          // user dismissed share sheet — no-op
        }
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        store.showToast('Enlace copiado al portapapeles', 'success');
      }
    } catch (err) {
      console.warn('[share] error:', err);
      store.showToast('Error al compartir el viaje', 'error');
    } finally {
      setShareLoading(false);
    }
  }, [store, driver, localOrigin, localDest]);

  // ─── Confirm rating (Grupo I: includes reason + persist to server) ───

  const handleConfirmRating = useCallback(async () => {
    if (!localOrigin || !localDest || !driver) return;
    // Validate reason for 1 or 5 stars (Grupo I — I2)
    if ((rating === 1 || rating === 5) && !ratingReason.trim()) {
      store.showToast('Por favor contanos el motivo de tu calificación', 'error');
      return;
    }
    setSubmittingRating(true);

    const finalBreakdown = {
      base: fareBreakdown.base,
      distance: fareBreakdown.distance,
      time: fareBreakdown.time,
      tip,
      total: fareBreakdown.total + tip,
    };
    setFareBreakdown(finalBreakdown);

    // ── Persist rating to server (Grupo I) ──
    // Only if we have an active trip ID and a real user
    const tripId = activeTripIdRef.current;
    if (tripId && store.user && store.user.uid !== 'demo') {
      try {
        await fetch('/api/ratings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId,
            fromUserId: store.user.uid,
            fromRole: 'passenger',
            toRole: 'driver',
            stars: rating,
            reason: ratingReason.trim(),
            comment: ratingComment.trim(),
          }),
        });
      } catch (err) {
        console.warn('[rating] failed to persist:', err);
        // Continue — local UX still works
      }
    }

    setSubmittingRating(false);
    transitionTo('receipt');
  }, [localOrigin, localDest, driver, fareBreakdown, tip, rating, ratingReason, ratingComment, store, transitionTo]);

  // ─── Complete trip (save to history + wallet) — with dedup guard ─────

  useEffect(() => {
    if (step !== 'receipt') return;
    if (tripCompletedRef.current) return;
    if (!localOrigin || !localDest || !driver) return;

    tripCompletedRef.current = true;

    // Use the tripId generated at the start of 'in_trip' step if available.
    // If not (e.g. edge case), generate a new one as fallback.
    const tripId = activeTripIdRef.current ?? generateId();
    activeTripIdRef.current = tripId;

    // Build trip object immediately (saved without route first, then route added async)
    const buildTrip = (route?: [number, number][]): Trip => ({
      id: tripId,
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
      thirdPartyPhoto: thirdPhoto || undefined,
      distance: tripDistance,
      duration: tripDuration,
      waypoints: waypoints.length > 0 ? waypoints : undefined,
      route,
      createdAt: new Date().toISOString(),
    });

    // Save trip immediately without route so user sees it in history.
    // If the trip was already saved at 'in_trip' step (status='in_progress'),
    // replace it with the completed version.
    const initialTrip = buildTrip(undefined);
    const existingState = useAppStore.getState();
    const alreadyInHistory = existingState.tripHistory.some((t) => t.id === tripId);
    if (alreadyInHistory) {
      useAppStore.setState({
        tripHistory: existingState.tripHistory.map((t) =>
          t.id === tripId ? initialTrip : t
        ),
      });
    } else {
      store.addToHistory(initialTrip);
    }

    if (paymentMethod === 'wallet') {
      store.addMovement({
        id: generateId(),
        type: 'ride',
        amount: -fareBreakdown.total,
        description: `Viaje ${vehicleTypes.find(v => v.id === localVehicle)?.name || 'Unira'} - ${localOrigin.name} → ${localDest.name}${waypoints.length > 0 ? ` (+${waypoints.length} paradas)` : ''}`,
        date: new Date().toISOString(),
        balance: store.walletBalance - fareBreakdown.total,
      });
    }

    if (tip > 0) {
      store.addMovement({
        id: generateId(),
        type: 'tip',
        amount: -tip,
        description: `Propina para ${driver.name}`,
        date: new Date().toISOString(),
        balance: store.walletBalance - fareBreakdown.total - tip,
      });
    }

    // ── Complete real trip via API if we have one ──
    if (realTripId && driver) {
      void fetch(`/api/trips/${realTripId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driverId || undefined,
          actualDistance: tripDistance,
          actualDuration: tripDuration,
        }),
      }).catch((err) => console.warn('[ride] Complete trip API failed:', err));
    }

    // Fetch real route polyline async, then patch the trip in history.
    // If OSRM is down, generateRoute falls back to linear interpolation.
    let cancelled = false;
    generateRoute(localOrigin, localDest, waypoints)
      .then((result) => {
        if (cancelled || result.polyline.length === 0) return;
        // Patch the trip in history with the resolved route
        const state = useAppStore.getState();
        const updated = state.tripHistory.map((t) =>
          t.id === initialTrip.id ? { ...t, route: result.polyline } : t
        );
        useAppStore.setState({ tripHistory: updated });
        // Re-sync to server so the route is persisted
        state.syncTripToServer({ ...initialTrip, route: result.polyline });
      })
      .catch((err) => console.warn('[ride] route generation failed:', err));

    return () => {
      cancelled = true;
    };
  }, [step, realTripId, localOrigin, localDest, driver, fareBreakdown, tip, paymentMethod, localVehicle, waypoints, tripDistance, tripDuration]);

  // ─── Go back / reset ─────────────────────────────────────────────────

  const goBackHome = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current);
    if (broadcastRef.current) clearInterval(broadcastRef.current);
    if (originTimerRef.current) clearTimeout(originTimerRef.current);
    if (destTimerRef.current) clearTimeout(destTimerRef.current);
    if (waypointTimerRef.current) clearTimeout(waypointTimerRef.current);
    tripCompletedRef.current = false;
    activeTripIdRef.current = null;
    // ── Grupo J: reset live tracking refs ──
    liveRouteRef.current = null;
    prevBroadcastPosRef.current = null;
    tripProgressRef.current = 0;
    setRatingReason('');
    setRatingComment('');
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
    // Cancel real trip if we have one
    if (realTripId) {
      void fetch(`/api/trips/${realTripId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelledBy: 'passenger' }),
      }).catch(() => {});
      setRealTripId(null);
    }
    if (searchPollRef) {
      clearInterval(searchPollRef);
      setSearchPollRef(null);
    }
    setSearchExpired(false);
    goBackHome();
  }, [goBackHome, realTripId, searchPollRef]);

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
          <div className="mx-4 mt-2 bg-white rounded-3xl shadow-lg sheet-slide-up overflow-visible">
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
                    onFocus={() => { if (originSuggestions.length > 0) setShowOriginSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowOriginSuggestions(false), 300)}
                    placeholder="Punto de partida"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
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
                        onTouchStart={(e) => { e.preventDefault(); selectOrigin(s); }}
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
                    onFocus={() => { if (destSuggestions.length > 0) setShowDestSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowDestSuggestions(false), 300)}
                    placeholder="¿A dónde vas?"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
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
                        onTouchStart={(e) => { e.preventDefault(); selectDest(s); }}
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
                      onFocus={() => { if (newWaypointSuggestions.length > 0) setShowNewWaypointSuggestions(true); }}
                      onBlur={() => setTimeout(() => setShowNewWaypointSuggestions(false), 300)}
                      placeholder="Parada intermedia..."
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
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
                          onTouchStart={(e) => { e.preventDefault(); selectNewWaypoint(s); }}
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
                    <div className="flex items-center gap-2">
                      {dynamicPricing && dynamicPricing.surgeMultiplier > 1.05 && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span className="text-[10px] font-bold text-amber-700">{surgeLabel} ×{dynamicPricing.surgeMultiplier.toFixed(1)}</span>
                        </span>
                      )}
                      {tripDistance > 0 && (
                        <span className="text-xs text-gray-400">{tripDistance} km · {tripDuration} min{waypoints.length > 0 ? ` · ${waypoints.length + 1} paradas` : ''}</span>
                      )}
                    </div>
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
                {thirdName && (<>
                  <div className="px-0 pb-2"><input type="tel" value={thirdPhone} onChange={e => setThirdPhone(e.target.value)} placeholder="Telefono de quien viaja (opcional)" className="w-full h-10 rounded-xl bg-gray-50 border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-400" /></div>
                  <div className="px-0 pb-2">
                    <p className="text-xs text-gray-500 mb-1.5">Foto del pasajero (obligatorio para viajes a terceros)</p>
                    {thirdPhoto ? (
                      <div className="relative rounded-xl overflow-hidden border border-gray-200">
                        <img src={thirdPhoto} alt="Foto del pasajero" className="w-full h-28 object-cover" />
                        <button onClick={() => setThirdPhoto('')} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input type="file" accept="image/*" capture="user" className="hidden" id="third-cam" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const { dataUrl } = await compressImage(f, 800, 0.7); setThirdPhoto(dataUrl); } }} />
                        <input type="file" accept="image/*" className="hidden" id="third-upload" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const { dataUrl } = await compressImage(f, 800, 0.7); setThirdPhoto(dataUrl); } }} />
                        <button onClick={() => document.getElementById('third-cam')?.click()} className="flex-1 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center gap-1.5 text-sm text-gray-600 hover:bg-gray-100"><Camera className="w-4 h-4" /> Camara</button>
                        <button onClick={() => document.getElementById('third-upload')?.click()} className="flex-1 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center gap-1.5 text-sm text-gray-600 hover:bg-gray-100"><Upload className="w-4 h-4" /> Subir</button>
                      </div>
                    )}
                  </div>
                </>)}

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
      {step === 'searching' && !searchExpired && (
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">{searchStatus}</h2>
          <p className="text-sm text-gray-500 mb-8">
            {notifiedCount > 0
              ? `${notifiedCount} conductores notificados`
              : 'Conectando con socios cercanos'}
          </p>
          <div className="flex items-center gap-1.5 mb-12">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#0EA5A0] animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
          <button onClick={cancelSearch} className="px-8 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all">Cancelar</button>
        </div>
      )}

      {/* ─── Search expired (no drivers found) ─── */}
      {step === 'searching' && searchExpired && (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No se encontró conductor</h2>
          <p className="text-sm text-gray-500 mb-8 text-center">No hay conductores disponibles en este momento. Intentá de nuevo en unos minutos.</p>
          <div className="flex gap-3">
            <button onClick={cancelSearch} className="px-6 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all">Volver</button>
            <button onClick={handleRequestRide} className="px-6 py-3 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm shadow-sm shadow-[#0EA5A0]/25 hover:bg-[#0C8F8A] active:scale-95 transition-all">Reintentar</button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Driver Found ──────────────────────────────────── */}
      {step === 'driver_found' && driver && (
        <div className={`min-h-[100dvh] flex flex-col items-center justify-center px-6 transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-3xl shadow-xl p-6 text-center sheet-slide-up">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white shadow-lg overflow-hidden" style={{ background: driver.photo ? 'transparent' : 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
                {driver.photo ? (
                  <img src={driver.photo} alt={driver.name} className="w-full h-full object-cover" />
                ) : (
                  driver.name.split(' ').map(n => n[0]).join('')
                )}
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
                <button
                  onClick={() => {
                    if (driver?.phone) {
                      window.open(`tel:${driver.phone}`, '_self');
                    } else {
                      store.showToast('El conductor no compartió su teléfono', 'error');
                    }
                  }}
                  disabled={driver?.communicationPreference === 'messages'}
                  className={`flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    driver?.communicationPreference === 'messages'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-[#0EA5A0] text-white shadow-sm shadow-[#0EA5A0]/25 hover:bg-[#0C8F8A] active:scale-95'
                  }`}
                >
                  <Phone className="w-4 h-4" /> {driver?.communicationPreference === 'messages' ? 'No disponible' : 'Llamar'}
                </button>
                <button
                  onClick={() => {
                    // Open TripChat by triggering the floating button
                    const chatBtn = document.querySelector('[data-trip-chat-fab]') as HTMLElement;
                    if (chatBtn) chatBtn.click();
                    else store.showToast('Usá el botón de chat flotante', 'info');
                  }}
                  disabled={driver?.communicationPreference === 'calls'}
                  className={`flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    driver?.communicationPreference === 'calls'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" /> {driver?.communicationPreference === 'calls' ? 'No disponible' : 'Mensaje'}
                </button>
              </div>
              {/* Communication preference notice */}
              {driver?.communicationPreference && driver.communicationPreference !== 'both' && (
                <div className={`mt-3 p-2.5 rounded-xl flex items-start gap-2 ${
                  driver.communicationPreference === 'calls'
                    ? 'bg-sky-50 border border-sky-200'
                    : 'bg-violet-50 border border-violet-200'
                }`}>
                  <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                    driver.communicationPreference === 'calls' ? 'text-sky-500' : 'text-violet-500'
                  }`} />
                  <p className={`text-[11px] leading-relaxed ${
                    driver.communicationPreference === 'calls' ? 'text-sky-700' : 'text-violet-700'
                  }`}>
                    {driver.communicationPreference === 'calls'
                      ? 'Por seguridad, este conductor solo acepta llamadas telefónicas. No le envíes mensajes mientras conduce — prefiere que lo llames.'
                      : 'Este conductor prefiere comunicarse solo por mensajes de chat. Evitá llamarlo por teléfono.'
                    }
                  </p>
                </div>
              )}
            </div>
            {thirdName && (<div className="bg-[#0EA5A0]/5 border border-[#0EA5A0]/20 rounded-2xl p-3 mb-3 flex items-center gap-2">
              {thirdPhoto ? (
                <img src={thirdPhoto} alt="Pasajero" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <Users className="w-4 h-4 text-[#0EA5A0]" />
              )}
              <div><p className="text-xs text-gray-500">Viaje para</p><p className="text-sm font-semibold text-gray-900">{thirdName}</p></div>
              <button onClick={() => {navigator.clipboard.writeText(verificationCode);store.showToast("Codigo copiado","success")}} className="ml-auto w-8 h-8 rounded-full bg-[#0EA5A0] flex items-center justify-center"><Share2 className="w-4 h-4 text-white" /></button>
            </div>)}
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

          {/* ── Grupo K: Wait timer overlay ── */}
          {showWaitTimer && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center px-4 pb-6">
              <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 sheet-slide-up">
                {/* Header */}
                <div className="text-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3 relative">
                    <Clock className="w-7 h-7 text-amber-500" />
                    {waitSeconds > WAIT_FREE_SECONDS && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Tu conductor te está esperando</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {driver.name} llegó a tu punto de partida
                  </p>
                </div>

                {/* Timer display */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 mb-4">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Tiempo de espera</p>
                    <p className={`text-4xl font-extrabold tabular-nums ${waitSeconds > WAIT_FREE_SECONDS ? 'text-red-500' : 'text-gray-900'}`}>
                      {Math.floor(waitSeconds / 60).toString().padStart(2, '0')}:
                      {(waitSeconds % 60).toString().padStart(2, '0')}
                    </p>
                    {waitSeconds <= WAIT_FREE_SECONDS ? (
                      <p className="text-xs text-emerald-600 font-medium mt-1">
                        Minuto gratis · {WAIT_FREE_SECONDS - waitSeconds}s restantes
                      </p>
                    ) : (
                      <p className="text-xs text-red-500 font-medium mt-1">
                        Tarifa de espera activa · ${WAIT_FEE_PER_MIN}/min
                      </p>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${waitSeconds > WAIT_FREE_SECONDS ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (waitSeconds / WAIT_FREE_SECONDS) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Wait fee (if accruing) */}
                {waitFeeAccrued > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center justify-between">
                    <span className="text-xs text-red-700 font-medium">Espera adicional</span>
                    <span className="text-sm font-bold text-red-600">+${waitFeeAccrued}</span>
                  </div>
                )}

                {/* CTA: passenger boarded */}
                <button
                  onClick={handlePassengerBoarded}
                  className="w-full h-12 rounded-2xl bg-[#0EA5A0] text-white font-bold text-sm active:scale-95 transition-all"
                >
                  Ya subí — iniciar viaje
                </button>
                <p className="text-center text-[10px] text-gray-400 mt-2">
                  Si no confirmás, el viaje inicia automáticamente en 90s
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Step 4: In Trip ──────────────────────────────────────── */}
      {step === 'in_trip' && (
        <div className={`h-[100dvh] flex flex-col transition-all duration-200 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          {/* Recording indicator (floating) */}
          {activeRecording && (
            <RecordingIndicator
              type={activeRecording.type}
              elapsedSec={recordingElapsed}
              onStop={handleStopRecording}
            />
          )}

          {/* ── Full-screen live map with car icon ── */}
          <div className="flex-1 relative">
            <TripLiveMap
              route={liveRouteRef.current?.polyline ?? null}
              progress={tripProgress}
              origin={localOrigin}
              destination={localDest}
              waypoints={waypoints}
              eta={tripEta}
              distanceKm={tripDistance}
              isLive={liveTrackingActive}
              navigationInstruction={navCurrentInstruction}
              nextInstruction={navNextInstruction}
              distanceToManeuver={navDistToManeuver}
            />
          </div>

          {/* ── Bottom panel: driver info + controls ── */}
          <div className="bg-white rounded-t-3xl -mt-4 relative z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-4 pt-4 pb-6">
            {/* Recording error */}
            {recordingError && (
              <p className="text-xs text-red-500 mb-2">{recordingError}</p>
            )}

            {/* Stopped recording summary */}
            {stoppedRecordingSummary && (
              <div className="mb-2">
                <RecordingSummary
                  type={stoppedRecordingSummary.type}
                  durationSec={stoppedRecordingSummary.durationSec}
                  blobUrl={stoppedRecordingSummary.blobUrl}
                  onDiscard={handleDiscardStopped}
                />
              </div>
            )}

            {driver && (
              <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
                  {driver.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{driver.name}</p>
                  <p className="text-xs text-gray-500">{driver.vehicle} · {driver.plate}</p>
                </div>
                <button
                  onClick={() => {
                    if (driver?.phone) {
                      window.open(`tel:${driver.phone}`, '_self');
                    } else {
                      store.showToast('El conductor no compartió su teléfono', 'error');
                    }
                  }}
                  disabled={driver?.communicationPreference === 'messages'}
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    driver?.communicationPreference === 'messages'
                      ? 'bg-gray-100 cursor-not-allowed opacity-40'
                      : 'bg-[#0EA5A0]/10 active:scale-90'
                  }`}
                  aria-label="Llamar conductor"
                >
                  <Phone className={`w-4 h-4 ${driver?.communicationPreference === 'messages' ? 'text-gray-400' : 'text-[#0EA5A0]'}`} />
                </button>
                <button
                  onClick={() => {
                    const chatBtn = document.querySelector('[data-trip-chat-fab]') as HTMLElement;
                    if (chatBtn) chatBtn.click();
                    else store.showToast('Usá el botón de chat flotante', 'info');
                  }}
                  disabled={driver?.communicationPreference === 'calls'}
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    driver?.communicationPreference === 'calls'
                      ? 'bg-gray-100 cursor-not-allowed opacity-40'
                      : 'bg-[#0EA5A0]/10 active:scale-90'
                  }`}
                  aria-label="Chat conductor"
                >
                  <MessageSquare className={`w-4 h-4 ${driver?.communicationPreference === 'calls' ? 'text-gray-400' : 'text-[#0EA5A0]'}`} />
                </button>
              </div>
            )}
            {/* Communication preference notice during trip */}
            {driver?.communicationPreference && driver.communicationPreference !== 'both' && (
              <div className={`ml-1 mt-1 px-2 py-1 rounded-lg text-[10px] leading-relaxed ${
                driver.communicationPreference === 'calls'
                  ? 'bg-sky-50 text-sky-600'
                  : 'bg-violet-50 text-violet-600'
              }`}>
                {driver.communicationPreference === 'calls'
                  ? 'Este conductor solo acepta llamadas (seguridad al volante)'
                  : 'Este conductor prefiere mensajes de chat'
                }
              </div>
            )}

            {/* Surge / pricing info bar */}
            {dynamicPricing && dynamicPricing.surgeMultiplier > 1.05 && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  <span className="text-[10px] font-bold text-amber-700">{surgeLabel}</span>
                  <span className="text-[10px] font-semibold text-amber-800">×{dynamicPricing.surgeMultiplier.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-[10px] text-gray-500">~${dynamicPricing.estimatedHourlyRate.toLocaleString('es-AR')}/hr</span>
                </div>
              </div>
            )}

            {/* Action buttons row */}
            <div className="flex gap-2">
              {/* Share trip */}
              <button
                onClick={() => void handleShareTrip()}
                disabled={shareLoading}
                className="flex-1 py-3 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
              >
                {shareLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                {shareLoading ? 'Generando…' : 'Compartir viaje'}
              </button>

              {/* Recording button */}
              {!activeRecording && !stoppedRecordingSummary && !showRecordingConsent && (
                <button
                  onClick={() => setShowRecordingConsent(true)}
                  className="w-12 py-3 rounded-2xl bg-violet-50 border-2 border-violet-200 text-violet-700 flex items-center justify-center active:scale-[0.98] transition-all"
                  aria-label="Grabar viaje"
                >
                  <Video className="w-4 h-4" />
                </button>
              )}
            </div>

            {!activeRecording && !stoppedRecordingSummary && !showRecordingConsent && (
              <p className="text-[9px] text-gray-400 mt-1.5 text-center leading-relaxed">
                Grabación opcional y voluntaria para respaldar calificaciones.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recording consent modal */}
      <RecordingConsentModal
        open={showRecordingConsent}
        onClose={() => setShowRecordingConsent(false)}
        onAccept={handleAcceptRecording}
        tripDriverName={driver?.name}
      />

      {/* ── Grupo M: Radar alerts during in_trip ──
          Mounted globally during the in_trip step so it watches geolocation
          and pops up a visual + audible alert when near a speed camera.
          Respects the driver's settings (radarAlertsEnabled, radarAlertRadius). */}
      {step === 'in_trip' && (
        <RadarAlertOverlay
          enabled={true}
          alertRadiusM={300}
        />
      )}

      {/* ─── Step 5: Rate (Grupo I — reason required for 1★ or 5★) ── */}
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
                {/* Reason selector (mandatory for 1★ or 5★ — Grupo I2) */}
                {(rating === 1 || rating === 5) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3 text-left">
                    <p className="text-xs font-bold text-amber-700 uppercase mb-2">
                      Motivo {rating === 1 ? '(obligatorio)' : '(obligatorio)'}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(rating === 1
                        ? ['Conductor impuntual', 'Conducción peligrosa', 'Vehículo en mal estado', 'Mala educación', 'Otro']
                        : ['Excelente servicio', 'Conducción impecable', 'Muy amable', 'Llegó rápido', 'Otro']
                      ).map((r) => (
                        <button
                          key={r}
                          onClick={() => setRatingReason(r === 'Otro' ? '' : r)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            ratingReason === r
                              ? 'bg-[#0EA5A0] text-white border-[#0EA5A0]'
                              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={ratingReason}
                      onChange={(e) => setRatingReason(e.target.value)}
                      placeholder={rating === 1 ? 'Contanos qué pasó…' : '¿Qué te hizo dar 5 estrellas?'}
                      rows={3}
                      className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Tu calificación es <strong>privada</strong> durante 7 días. El conductor no la verá hasta entonces (anti-represalia).
                    </p>
                  </div>
                )}

                {/* Optional comment */}
                <div className="bg-gray-50 rounded-2xl p-3 mb-3 text-left">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Comentario (opcional)</p>
                  <textarea
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="¿Querés agregar algo más?"
                    rows={2}
                    className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300"
                  />
                </div>

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
                <button onClick={() => void handleConfirmRating()} disabled={submittingRating} className="w-full py-4 rounded-2xl bg-[#0EA5A0] text-white font-bold shadow-lg shadow-[#0EA5A0]/25 hover:bg-[#0C8F8A] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submittingRating && <Loader2 className="w-5 h-5 animate-spin" />}
                  {submittingRating ? 'Enviando…' : 'Confirmar'}
                </button>
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

          {/* ── Grupo G: Share completed trip ── */}
          <button
            onClick={() => void handleShareTrip()}
            disabled={shareLoading}
            className="mt-2 w-full py-3 rounded-2xl bg-white border-2 border-[#0EA5A0]/30 text-[#0EA5A0] font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {shareLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            {shareLoading ? 'Generando enlace…' : 'Compartir comprobante del viaje'}
          </button>
        </div>
      )}

      {/* Trip chat — visible during in_trip and driver_found */}
      {(step === 'in_trip' || step === 'driver_found') && (
        <TripChat
          tripId={realTripId}
          otherUserId={driverId}
          otherUserName={driver?.name || 'Chofer'}
          visible={true}
        />
      )}
    </div>
  );
}
