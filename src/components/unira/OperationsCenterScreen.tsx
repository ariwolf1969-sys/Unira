'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import {
  ArrowLeft, Users, Car, Navigation, MapPin, Clock, Phone,
  ChevronRight, Search, RefreshCw,
  Eye, EyeOff, List, Radio, Flag, AlertTriangle,
  X, Star, DollarSign, TrendingUp, Zap,
  Plane, Building2, Play,
  // New icons for the 3 features
  ShieldAlert, ExternalLink, MapPinned, FileText, Award, Gift,
  UserCheck, UserMinus, ChevronUp, ChevronDown, Trophy, Gem,
  MessageSquare, Route, Shield, CreditCard, Crown, CircleDot,
} from 'lucide-react';

// ─── Leaflet imports (dynamic to avoid SSR issues) ────────────────────────
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
  useMap,
} from 'react-leaflet';

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Constants ─────────────────────────────────────────────────────────────

const BA_CENTER: [number, number] = [-34.6037, -58.3816];
const BA_ZOOM = 12;
const REFRESH_INTERVAL = 5000; // 5 seconds

// ─── Types ─────────────────────────────────────────────────────────────────

interface DriverPosition {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  averageRating: number;
  ratingCount: number;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationUpdatedAt: string | null;
  currentTripId: string;
  status: 'available' | 'in-trip' | 'idle';
  currentTrip: {
    id: string;
    status: string;
    originName: string;
    destName: string;
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    fare: number;
  } | null;
}

interface TripHistoryItem {
  id: string;
  status: string;
  originName: string;
  originAddress: string;
  originLat: number;
  originLng: number;
  destName: string;
  destAddress: string;
  destLat: number;
  destLng: number;
  fare: number;
  distance: number | null;
  duration: number | null;
  routePoints: [number, number][];
  isFlagged: boolean;
  expectedDurationMin: number;
  driverId: string | null;
  driverName: string | null;
  userId: string;
  vehicleType: string | null;
  paymentMethod: string;
  acceptedAt: string | null;
  createdAt: string;
}

interface OpsStats {
  onlineDrivers: number;
  activeTrips: number;
  pendingRequests: number;
  avgWaitSeconds: number;
  avgFare: number;
  totalRevenue: number;
  completedTrips24h: number;
  queueStatus: Array<{ id: string; name: string; count: number }>;
  heatData: Array<{ lat: number; lng: number; intensity: number }>;
  pendingTrips: Array<{
    id: string;
    originName: string;
    destName: string;
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    requestedVehicleType: string;
    createdAt: string;
    userId: string;
    fare: number;
  }>;
  activeSosCount: number;
  sosAlerts: SosAlertItem[];
}

interface SosAlertItem {
  id: string;
  userId: string;
  tripId: string | null;
  shareToken: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  user: { name: string; phone: string; isDriver: boolean } | null;
}

interface QueueDriver {
  id: string;
  driverId: string;
  driverName: string;
  position: number;
  joinedAt: string;
  estimatedWaitMinutes: number;
}

interface QueueData {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  maxQueueSize: number;
  drivers: QueueDriver[];
}

interface DriverDetail {
  driver: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    dni: string | null;
    avatar: string | null;
    isDriver: boolean;
    isDriverApproved: boolean;
    isOnline: boolean;
    verificationStatus: string;
    vehicleType: string | null;
    vehiclePlate: string | null;
    vehicleBrand: string | null;
    vehicleModel: string | null;
    vehicleYear: number | null;
    vehicleColor: string | null;
    averageRating: number;
    ratingCount: number;
    tripCountAsDriver: number;
    tripCountAsPassenger: number;
    totalEarned: number;
    totalSpent: number;
    walletBalance: number;
    lastLat: number | null;
    lastLng: number | null;
    lastLocationUpdatedAt: string | null;
    currentTripId: string | null;
    licenseExpiryDate: Date | null;
    seguroExpiryDate: Date | null;
    cedulaExpiryDate: Date | null;
    rewardPoints: number;
    rewardLevel: string;
    createdAt: string;
  };
  tripsAsDriver: TripHistoryItem[];
  ratingsReceived: Array<{
    id: string;
    stars: number;
    reason: string;
    comment: string;
    fromRole: string;
    createdAt: string;
    tripId: string;
  }>;
  activeTrip: {
    id: string;
    status: string;
    originName: string;
    destName: string;
    fare: number;
  } | null;
}

interface PassengerItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  dni: string | null;
  avatar: string | null;
  role: string;
  isDriver: boolean;
  tripCountAsPassenger: number;
  tripCountAsDriver: number;
  totalSpent: number;
  totalEarned: number;
  averageRating: number;
  ratingCount: number;
  walletBalance: number;
  rewardPoints: number;
  rewardLevel: string;
  rewardLevelUpdatedAt: string | null;
  isSocio: boolean;
  createdAt: string;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationUpdatedAt: string | null;
}

interface PassengerDetail {
  user: PassengerItem & { address: string | null };
  tripsAsPassenger: Array<{
    id: string;
    status: string;
    originName: string;
    destName: string;
    fare: number;
    distance: number | null;
    duration: number | null;
    paymentMethod: string;
    driverId: string | null;
    driverName: string | null;
    rating: number | null;
    createdAt: string;
  }>;
  rewardLogs: Array<{
    id: string;
    points: number;
    reason: string;
    referenceId: string;
    createdAt: string;
  }>;
  discounts: Array<{
    id: string;
    code: string;
    title: string;
    description: string;
    amount: number;
    type: string;
    validUntil: string;
  }>;
  tiers: Array<{
    id: string;
    level: string;
    minPoints: number;
    benefits: string;
    discountPercent: number;
    freeTripsPerMonth: number;
  }>;
}

interface RewardTier {
  id: string;
  level: string;
  minPoints: number;
  benefits: string;
  discountPercent: number;
  freeTripsPerMonth: number;
}

// ─── Custom car marker icon factory ───────────────────────────────────────

function createCarIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-car-marker',
    html: `<div style="
      width: 32px; height: 32px; border-radius: 50%;
      background: ${color}; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4); border: 2px solid rgba(255,255,255,0.8);
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
        <circle cx="7" cy="17" r="2"/>
        <path d="M9 17h6"/>
        <circle cx="17" cy="17" r="2"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

const iconAvailable = createCarIcon('#10B981');   // green
const iconInTrip = createCarIcon('#3B82F6');     // blue
const iconIdle = createCarIcon('#F59E0B');       // yellow
const iconStale = createCarIcon('#9CA3AF');       // gray (GPS stale)

function isGpsStale(lastLocationUpdatedAt: string | null): boolean {
  if (!lastLocationUpdatedAt) return true;
  const diffSec = (Date.now() - new Date(lastLocationUpdatedAt).getTime()) / 1000;
  return diffSec > 90; // more than 90 seconds = stale
}

function gpsAgeLabel(lastLocationUpdatedAt: string | null): string {
  if (!lastLocationUpdatedAt) return 'Sin GPS';
  const diffSec = Math.floor((Date.now() - new Date(lastLocationUpdatedAt).getTime()) / 1000);
  if (diffSec < 10) return 'GPS: ahora';
  if (diffSec < 60) return `GPS: ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `GPS: hace ${diffMin}min`;
  return `GPS: hace ${Math.floor(diffMin / 60)}h`;
}

function getStatusIcon(status: 'available' | 'in-trip' | 'idle', stale?: boolean): L.DivIcon {
  if (stale) return iconStale;
  switch (status) {
    case 'available': return iconAvailable;
    case 'in-trip': return iconInTrip;
    case 'idle': return iconIdle;
  }
}

// ─── FlyTo component ──────────────────────────────────────────────────────

function FlyToTarget({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 15, { duration: 1 });
    }
  }, [target, map]);
  return null;
}

// ─── Level badge helper ───────────────────────────────────────────────────

function LevelBadge({ level }: { level: string }) {
  const config: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
    platinum: { emoji: '💎', label: 'Platinum', bg: 'bg-purple-900/50', text: 'text-purple-300' },
    gold: { emoji: '🥇', label: 'Gold', bg: 'bg-yellow-900/50', text: 'text-yellow-300' },
    silver: { emoji: '🥈', label: 'Silver', bg: 'bg-gray-700/50', text: 'text-gray-300' },
    bronze: { emoji: '🥉', label: 'Bronze', bg: 'bg-orange-900/50', text: 'text-orange-300' },
  };
  const c = config[level] || config.bronze;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
      {c.emoji} {c.label}
    </span>
  );
}

// ─── Time ago helper ────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `ahora`;
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)}h`;
  return `hace ${Math.floor(diffSec / 86400)}d`;
}

// ─── Document expiry badge ─────────────────────────────────────────────────

function DocExpiryBadge({ label, date }: { label: string; date: Date | string | null }) {
  if (!date) {
    return (
      <span className="flex items-center gap-1.5 text-xs">
        <CircleDot className="w-3 h-3 text-gray-600" />
        <span className="text-gray-500">{label}: Sin datos</span>
      </span>
    );
  }
  const d = new Date(date);
  const now = new Date();
  const daysLeft = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  let color = 'bg-emerald-900/40 text-emerald-400';
  let dotColor = 'bg-emerald-500';
  let statusText = 'Vigente';
  if (daysLeft < 0) {
    color = 'bg-red-900/40 text-red-400';
    dotColor = 'bg-red-500';
    statusText = 'Vencido';
  } else if (daysLeft < 30) {
    color = 'bg-amber-900/40 text-amber-400';
    dotColor = 'bg-amber-500';
    statusText = `${daysLeft}d`;
  } else {
    statusText = `OK (${daysLeft}d)`;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium ${color}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      {label}: {statusText}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

type SidebarTab = 'drivers' | 'requests' | 'queue' | 'history' | 'passengers';

export function OperationsCenterScreen() {
  const store = useAppStore();

  // Data state
  const [drivers, setDrivers] = useState<DriverPosition[]>([]);
  const [tripHistory, setTripHistory] = useState<TripHistoryItem[]>([]);
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [queues, setQueues] = useState<QueueData[]>([]);

  // SOS state
  const [sosDropdownOpen, setSosDropdownOpen] = useState(false);

  // Driver detail panel state
  const [driverDetail, setDriverDetail] = useState<DriverDetail | null>(null);
  const [driverDetailLoading, setDriverDetailLoading] = useState(false);

  // Passenger state
  const [passengers, setPassengers] = useState<PassengerItem[]>([]);
  const [passengerTiers, setPassengerTiers] = useState<RewardTier[]>([]);
  const [passengerSearch, setPassengerSearch] = useState('');
  const [passengerSort, setPassengerSort] = useState<'name' | 'tripCountAsPassenger' | 'totalSpent' | 'rewardPoints'>('tripCountAsPassenger');
  const [passengerSortDir, setPassengerSortDir] = useState<'asc' | 'desc'>('desc');
  const [passengersLoading, setPassengersLoading] = useState(false);

  // Passenger detail panel state
  const [passengerDetail, setPassengerDetail] = useState<PassengerDetail | null>(null);
  const [passengerDetailLoading, setPassengerDetailLoading] = useState(false);

  // Admin action modals
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardAction, setAwardAction] = useState<'award_points' | 'remove_points' | 'set_level'>('award_points');
  const [awardPoints, setAwardPoints] = useState('');
  const [awardLevel, setAwardLevel] = useState('');
  const [awardReason, setAwardReason] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('drivers');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<DriverPosition | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripHistoryItem | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [driverSortField, setDriverSortField] = useState<'name' | 'status' | 'vehicleColor'>('status');
  const [driverSortDir, setDriverSortDir] = useState<'asc' | 'desc'>('asc');

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch functions ─────────────────────────────────────────────────

  const adminUserId = store.user?.uid;

  const fetchDriverPositions = useCallback(async () => {
    if (!adminUserId) return;
    try {
      const res = await fetch(`/api/admin/ops/drivers-positions?adminUserId=${adminUserId}`);
      if (res.ok) {
        const json = await res.json();
        setDrivers(json.drivers || []);
      }
    } catch (e) {
      console.error('Failed to fetch drivers:', e);
    }
  }, [adminUserId]);

  const fetchStats = useCallback(async () => {
    if (!adminUserId) return;
    try {
      const res = await fetch(`/api/admin/ops/stats?adminUserId=${adminUserId}`);
      if (res.ok) {
        const json = await res.json();
        setStats(json);
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }, [adminUserId]);

  const fetchTripHistory = useCallback(async () => {
    if (!adminUserId) return;
    try {
      const res = await fetch(`/api/admin/ops/trip-history?adminUserId=${adminUserId}`);
      if (res.ok) {
        const json = await res.json();
        setTripHistory(json.trips || []);
      }
    } catch (e) {
      console.error('Failed to fetch trip history:', e);
    }
  }, [adminUserId]);

  const fetchQueueStatus = useCallback(async () => {
    if (!adminUserId) return;
    try {
      const res = await fetch(`/api/admin/ops/queue/status?adminUserId=${adminUserId}`);
      if (res.ok) {
        const json = await res.json();
        setQueues(json.queues || []);
      }
    } catch (e) {
      console.error('Failed to fetch queues:', e);
    }
  }, [adminUserId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        fetchDriverPositions(),
        fetchStats(),
        fetchTripHistory(),
        fetchQueueStatus(),
      ]);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [fetchDriverPositions, fetchStats, fetchTripHistory, fetchQueueStatus]);

  // ── Fetch driver detail ────────────────────────────────────────────

  const fetchDriverDetail = useCallback(async (driverId: string) => {
    if (!adminUserId) return;
    setDriverDetailLoading(true);
    setDriverDetail(null);
    try {
      const res = await fetch(`/api/admin/ops/driver/${driverId}?adminUserId=${adminUserId}`);
      if (res.ok) {
        const json = await res.json();
        setDriverDetail(json);
      } else {
        store.showToast('Error al cargar detalle del chofer', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setDriverDetailLoading(false);
    }
  }, [adminUserId, store]);

  // ── Fetch passengers ────────────────────────────────────────────────

  const fetchPassengers = useCallback(async () => {
    if (!adminUserId) return;
    setPassengersLoading(true);
    try {
      const params = new URLSearchParams({
        adminUserId,
        query: passengerSearch,
        sort: passengerSort,
        dir: passengerSortDir,
        limit: '50',
        page: '1',
      });
      const res = await fetch(`/api/admin/ops/passengers?${params}`);
      if (res.ok) {
        const json = await res.json();
        setPassengers(json.passengers || []);
        setPassengerTiers(json.tiers || []);
      }
    } catch (e) {
      console.error('Failed to fetch passengers:', e);
    } finally {
      setPassengersLoading(false);
    }
  }, [adminUserId, passengerSearch, passengerSort, passengerSortDir]);

  // ── Fetch passenger detail ─────────────────────────────────────────

  const fetchPassengerDetail = useCallback(async (passengerId: string) => {
    if (!adminUserId) return;
    setPassengerDetailLoading(true);
    setPassengerDetail(null);
    try {
      const res = await fetch(`/api/admin/ops/passenger/${passengerId}?adminUserId=${adminUserId}`);
      if (res.ok) {
        const json = await res.json();
        setPassengerDetail(json);
      } else {
        store.showToast('Error al cargar detalle del pasajero', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setPassengerDetailLoading(false);
    }
  }, [adminUserId, store]);

  // ── SOS resolve ────────────────────────────────────────────────────

  const resolveSos = useCallback(async (sosId: string, status: 'resolved' | 'false_alarm') => {
    if (!adminUserId) return;
    try {
      const res = await fetch(`/api/sos/${sosId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolvedBy: adminUserId }),
      });
      if (res.ok) {
        store.showToast(status === 'resolved' ? 'SOS resuelto' : 'SOS marcado como falsa alarma', 'success');
        await fetchStats(); // refresh SOS count
      } else {
        store.showToast('Error al resolver SOS', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    }
  }, [adminUserId, fetchStats, store]);

  // ── Passenger admin action ──────────────────────────────────────────

  const handlePassengerAction = useCallback(async (passengerId: string) => {
    if (!adminUserId) return;
    try {
      const body: Record<string, unknown> = { action: awardAction };
      if (awardAction === 'award_points' || awardAction === 'remove_points') {
        body.points = parseInt(awardPoints) || 0;
      }
      if (awardAction === 'set_level') {
        body.level = awardLevel;
      }
      body.reason = awardReason || '';
      const res = await fetch(`/api/admin/ops/passenger/${passengerId}?adminUserId=${adminUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const label = awardAction === 'award_points' ? 'Puntos otorgados' :
          awardAction === 'remove_points' ? 'Puntos removidos' : 'Nivel actualizado';
        store.showToast(label, 'success');
        setShowAwardModal(false);
        setAwardPoints('');
        setAwardLevel('');
        setAwardReason('');
        // Refresh detail
        await fetchPassengerDetail(passengerId);
        await fetchPassengers();
      } else {
        const json = await res.json();
        store.showToast(json.error || 'Error en la acción', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    }
  }, [adminUserId, awardAction, awardPoints, awardLevel, awardReason, fetchPassengerDetail, fetchPassengers, store]);

  // ── Initial load + auto refresh ─────────────────────────────────────

  useEffect(() => {
    void fetchAll();
    refreshTimerRef.current = setInterval(() => {
      void fetchDriverPositions();
      void fetchStats();
    }, REFRESH_INTERVAL);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchAll, fetchDriverPositions, fetchStats]);

  // Fetch passengers when tab switches to passengers
  useEffect(() => {
    if (sidebarTab === 'passengers') {
      void fetchPassengers();
    }
  }, [sidebarTab, fetchPassengers]);

  // ── Queue actions ────────────────────────────────────────────────────

  const handleAssignNext = async (locationId: string, locationName: string) => {
    if (!adminUserId) return;
    const pendingTrip = stats?.pendingTrips?.[0];
    const tripId = pendingTrip?.id || null;
    try {
      const res = await fetch('/api/admin/ops/queue/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId,
          locationId,
          tripId,
        }),
      });
      if (res.ok) {
        store.showToast(`${locationName}: siguiente asignado${tripId ? ' a viaje' : ''}`, 'success');
        await fetchQueueStatus();
        await fetchStats();
      } else {
        const json = await res.json();
        store.showToast(json.error || 'Error al asignar', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    }
  };

  const handleRemoveFromQueue = async (entryId: string) => {
    if (!adminUserId) return;
    try {
      const res = await fetch('/api/admin/ops/queue/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId, entryId }),
      });
      if (res.ok) {
        store.showToast('Chofer removido de la fila', 'success');
        await fetchQueueStatus();
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    }
  };

  // ── Filtered/sorted drivers ──────────────────────────────────────────

  const filteredDrivers = useMemo(() => {
    let result = drivers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.vehiclePlate.toLowerCase().includes(q) ||
          d.phone.includes(q),
      );
    }
    return result.sort((a, b) => {
      let valA: string, valB: string;
      if (driverSortField === 'name') {
        valA = a.name.toLowerCase(); valB = b.name.toLowerCase();
      } else if (driverSortField === 'vehicleColor') {
        valA = a.vehicleColor.toLowerCase(); valB = b.vehicleColor.toLowerCase();
      } else {
        valA = a.status; valB = b.status;
      }
      if (valA < valB) return driverSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return driverSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [drivers, searchQuery, driverSortField, driverSortDir]);

  // ── Heatmap circles ─────────────────────────────────────────────────

  const heatPoints = useMemo(() => {
    if (!showHeatmap || !stats?.heatData) return [];
    return stats.heatData.filter((p) => p.lat !== 0 && p.lng !== 0);
  }, [showHeatmap, stats]);

  // ── Selected trip route polyline ──────────────────────────────────────

  const selectedTripRoute = useMemo(() => {
    if (!selectedTrip || selectedTrip.routePoints.length < 2) return null;
    return selectedTrip.routePoints;
  }, [selectedTrip]);

  // ── Admin check ──────────────────────────────────────────────────────

  if (!store.user?.isAdmin) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Acceso denegado</h1>
        <p className="text-gray-400 text-sm max-w-[280px] mb-6">Necesitás permisos de administrador para el Centro de Operaciones.</p>
        <button onClick={() => store.setCurrentScreen('admin')} className="px-5 py-2.5 rounded-xl bg-[#0EA5A0] text-white text-sm font-semibold">Volver al panel</button>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* ─── SOS Pulse Animation ─────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes sosPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes sosHeartbeat {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.15); }
          30% { transform: scale(1); }
          45% { transform: scale(1.1); }
        }
        .sos-pulse {
          animation: sosPulse 1.5s infinite, sosHeartbeat 1.5s infinite;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4B5563; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #374151 transparent; }
        .ops-popup .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important;
          padding: 2px !important;
        }
        .ops-popup .leaflet-popup-content {
          margin: 8px 10px !important;
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .slide-in-right {
          animation: slideInRight 0.3s ease-out;
        }
      `}</style>

      {/* ─── Top Bar ─────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-2 flex items-center gap-3 z-20">
        <button onClick={() => store.setCurrentScreen('admin')} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors" aria-label="Volver">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium hidden lg:inline">Volver</span>
        </button>

        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-[#0EA5A0]" />
          <h1 className="text-lg font-bold">Centro de Operaciones</h1>
        </div>

        {/* Real-time stats */}
        <div className="flex-1 flex items-center justify-center gap-4 text-xs">
          <StatBadge icon={<Users className="w-3.5 h-3.5" />} label="Online" value={stats?.onlineDrivers ?? '-'} color="emerald" />
          <StatBadge icon={<Navigation className="w-3.5 h-3.5" />} label="Viajes" value={stats?.activeTrips ?? '-'} color="blue" />
          <StatBadge icon={<Clock className="w-3.5 h-3.5" />} label="Pendientes" value={stats?.pendingRequests ?? '-'} color="amber" />
          <StatBadge icon={<Zap className="w-3.5 h-3.5" />} label="Espera prom." value={stats ? `${Math.round(stats.avgWaitSeconds / 60)}m` : '-'} color="purple" />
          <StatBadge icon={<DollarSign className="w-3.5 h-3.5" />} label="Recaudación 24h" value={stats ? `$${(stats.totalRevenue / 1000).toFixed(0)}k` : '-'} color="teal" />

          {/* ─── SOS Badge ────────────────────────────────────────── */}
          {stats && stats.activeSosCount > 0 && (
            <div className="relative">
              <button
                onClick={() => setSosDropdownOpen(!sosDropdownOpen)}
                className={`flex items-center gap-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-lg px-2.5 py-1 font-bold transition-colors sos-pulse`}
                aria-label="Alertas SOS"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>SOS</span>
                <span className="bg-white text-red-600 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {stats.activeSosCount}
                </span>
              </button>

              {/* SOS Dropdown */}
              {sosDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[2000]" onClick={() => setSosDropdownOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 w-[380px] max-h-[60vh] bg-gray-900/95 backdrop-blur border border-red-800/50 rounded-xl shadow-2xl z-[2001] overflow-hidden flex flex-col">
                    <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-red-800/30 bg-red-950/30">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-bold text-red-300">
                          Alertas SOS Activas ({stats.activeSosCount})
                        </span>
                      </div>
                      <button onClick={() => setSosDropdownOpen(false)} className="text-gray-500 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                      {(stats.sosAlerts || []).map((sos) => (
                        <div key={sos.id} className="bg-gray-800/80 border border-red-700/30 rounded-xl p-3 space-y-2">
                          {/* User info */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center">
                                <ShieldAlert className="w-4 h-4 text-red-400" />
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-gray-200">
                                  {sos.user?.name || 'Desconocido'}
                                </span>
                                <div className="text-[10px] text-gray-500">
                                  {sos.user?.phone || '—'}
                                  {sos.user?.isDriver && <span className="ml-1 text-blue-400">🚗 Chofer</span>}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-red-400 font-medium">{timeAgo(sos.createdAt)}</span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {sos.lat && sos.lng && (
                              <>
                                <a
                                  href={`https://www.google.com/maps?q=${sos.lat},${sos.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 text-blue-300 text-[10px] font-medium hover:bg-blue-600/30 transition-colors"
                                >
                                  <MapPinned className="w-3 h-3" /> Ubicación
                                </a>
                                <a
                                  href={`/viaje/${sos.shareToken}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-600/20 text-teal-300 text-[10px] font-medium hover:bg-teal-600/30 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" /> Rastrear
                                </a>
                              </>
                            )}
                            <div className="flex-1" />
                            <button
                              onClick={() => resolveSos(sos.id, 'false_alarm')}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600/20 text-amber-300 text-[10px] font-medium hover:bg-amber-600/30 transition-colors"
                            >
                              <AlertTriangle className="w-3 h-3" /> Falsa alarma
                            </button>
                            <button
                              onClick={() => resolveSos(sos.id, 'resolved')}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 text-[10px] font-medium hover:bg-emerald-600/30 transition-colors"
                            >
                              <Shield className="w-3 h-3" /> Resuelto
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Queue status bar */}
        <div className="hidden xl:flex items-center gap-3 text-xs">
          {(stats?.queueStatus || []).map((q) => (
            <div key={q.id} className="flex items-center gap-1.5 bg-gray-800/80 rounded-lg px-2.5 py-1">
              {q.name.includes('Aeroparque') ? <Plane className="w-3 h-3 text-sky-400" /> : <Building2 className="w-3 h-3 text-orange-400" />}
              <span className="text-gray-300">{q.name}:</span>
              <span className="font-bold text-white">{q.count}</span>
              <span className="text-gray-500">en fila</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => void fetchAll()}
          disabled={loading}
          className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
          aria-label="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 text-gray-300 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* ─── Main Content ───────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Left: Map ───────────────────────────────────────────── */}
        <main className="flex-1 relative">
          {/* Map controls overlay */}
          <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all shadow-lg ${
                showHeatmap
                  ? 'bg-[#0EA5A0] text-white'
                  : 'bg-gray-900/90 text-gray-300 hover:bg-gray-800'
              }`}
              aria-label="Toggle heatmap"
            >
              {showHeatmap ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              Mapa de calor
            </button>
            {selectedTripRoute && (
              <button
                onClick={() => { setSelectedTrip(null); setFlyTo(null); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-red-600/90 text-white shadow-lg hover:bg-red-500 transition-colors"
                aria-label="Clear route"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar ruta
              </button>
            )}
          </div>

          {/* Legend overlay */}
          <div className="absolute bottom-4 left-3 z-[1000] bg-gray-900/90 backdrop-blur rounded-lg p-2 shadow-lg">
            <div className="flex items-center gap-3 text-[10px] text-gray-300">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Disponible</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> En viaje</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Inactivo</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> SOS</span>
            </div>
          </div>

          {/* Leaflet Map */}
          <MapContainer
            center={BA_CENTER}
            zoom={BA_ZOOM}
            className="h-full w-full"
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />
            <FlyToTarget target={flyTo} />

            {/* Driver markers */}
            {drivers.map((driver) => {
              if (!driver.lastLat || !driver.lastLng) return null;
              if (driver.lastLat === 0 && driver.lastLng === 0) return null;
              const stale = isGpsStale(driver.lastLocationUpdatedAt);
              return (
                <Marker
                  key={driver.id}
                  position={[driver.lastLat, driver.lastLng]}
                  icon={getStatusIcon(driver.status, stale)}
                >
                  <Popup className="ops-popup">
                    <div className="text-gray-900 text-xs min-w-[180px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">{driver.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          stale ? 'bg-gray-200 text-gray-500' :
                          driver.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                          driver.status === 'in-trip' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {stale ? 'GPS inactivo' : driver.status === 'available' ? 'Disponible' : driver.status === 'in-trip' ? 'En viaje' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="space-y-0.5 text-gray-600">
                        <div className={`flex items-center gap-1 text-[10px] ${stale ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          <Clock className="w-3 h-3" /> {gpsAgeLabel(driver.lastLocationUpdatedAt)}
                        </div>
                        <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {driver.phone}</div>
                        <div className="flex items-center gap-1"><Car className="w-3 h-3" /> {driver.vehicleBrand} {driver.vehicleModel} ({driver.vehicleColor})</div>
                        <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {driver.vehiclePlate}</div>
                        <div className="flex items-center gap-1"><Star className="w-3 h-3" /> {driver.averageRating.toFixed(1)} ({driver.ratingCount})</div>
                        {driver.currentTrip && (
                          <>
                            <hr className="my-1 border-gray-200" />
                            <div className="font-semibold text-gray-700">Viaje actual</div>
                            <div>→ {driver.currentTrip.destName}</div>
                            <div>${driver.currentTrip.fare.toLocaleString()}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* SOS markers on map */}
            {(stats?.sosAlerts || []).map((sos) => {
              if (!sos.lat || !sos.lng) return null;
              return (
                <CircleMarker
                  key={`sos-${sos.id}`}
                  center={[sos.lat, sos.lng]}
                  radius={12}
                  pathOptions={{
                    fillColor: '#EF4444',
                    fillOpacity: 0.8,
                    color: '#FFFFFF',
                    weight: 3,
                    opacity: 1,
                  }}
                >
                  <Popup className="ops-popup">
                    <div className="text-gray-900 text-xs min-w-[150px]">
                      <div className="font-bold text-red-600 text-sm flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> SOS ACTIVO
                      </div>
                      <div className="mt-1 text-gray-600">
                        <div>{sos.user?.name || 'Desconocido'}</div>
                        <div>{sos.user?.phone || ''}</div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Heatmap circles */}
            {heatPoints.map((point, i) => (
              <CircleMarker
                key={`heat-${i}`}
                center={[point.lat, point.lng]}
                radius={15}
                pathOptions={{
                  fillColor: '#FF4500',
                  fillOpacity: 0.3,
                  color: '#FF6347',
                  weight: 1,
                  opacity: 0.5,
                }}
              />
            ))}

            {/* Selected trip route */}
            {selectedTripRoute && (
              <Polyline
                positions={selectedTripRoute}
                pathOptions={{
                  color: '#0EA5A0',
                  weight: 4,
                  opacity: 0.9,
                }}
              />
            )}

            {/* Selected trip origin/destination markers */}
            {selectedTrip && (
              <>
                <CircleMarker
                  center={[selectedTrip.originLat, selectedTrip.originLng]}
                  radius={8}
                  pathOptions={{ fillColor: '#10B981', fillOpacity: 1, color: 'white', weight: 2 }}
                />
                <CircleMarker
                  center={[selectedTrip.destLat, selectedTrip.destLng]}
                  radius={8}
                  pathOptions={{ fillColor: '#EF4444', fillOpacity: 1, color: 'white', weight: 2 }}
                />
              </>
            )}
          </MapContainer>
        </main>

        {/* ─── Right Sidebar ─────────────────────────────────────────── */}
        <aside className="flex-shrink-0 w-[380px] bg-gray-900/95 backdrop-blur border-l border-gray-800 flex flex-col overflow-hidden">
          {/* Sidebar tabs */}
          <div className="flex-shrink-0 flex border-b border-gray-800">
            {([
              { id: 'drivers', label: 'Choferes', icon: <Car className="w-3.5 h-3.5" /> },
              { id: 'requests', label: 'Pedidos', icon: <Navigation className="w-3.5 h-3.5" /> },
              { id: 'queue', label: 'Filas', icon: <List className="w-3.5 h-3.5" /> },
              { id: 'history', label: 'Historial', icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { id: 'passengers', label: 'Pasajeros', icon: <Users className="w-3.5 h-3.5" /> },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                  sidebarTab === tab.id
                    ? 'text-[#0EA5A0] border-b-2 border-[#0EA5A0]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                aria-label={tab.label}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* ── Drivers Tab ─────────────────────────────────────── */}
            {sidebarTab === 'drivers' && (
              <div className="p-3 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar chofer..."
                    className="w-full bg-gray-800/80 text-sm text-gray-200 pl-9 pr-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-[#0EA5A0] placeholder-gray-500"
                  />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between text-[10px] text-gray-500 px-1">
                  <span>{filteredDrivers.length} choferes en línea</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setDriverSortField('status'); setDriverSortDir(d => d === 'asc' ? 'desc' : 'asc'); }} className="hover:text-gray-300">Estado</button>
                    <button onClick={() => { setDriverSortField('name'); setDriverSortDir(d => d === 'asc' ? 'desc' : 'asc'); }} className="hover:text-gray-300">Nombre</button>
                  </div>
                </div>

                {/* Driver list */}
                <div className="space-y-1.5">
                  {filteredDrivers.map((driver) => (
                    <button
                      key={driver.id}
                      onClick={() => {
                        if (driver.lastLat && driver.lastLng) {
                          setFlyTo([driver.lastLat, driver.lastLng]);
                          setSelectedDriver(d => d?.id === driver.id ? null : driver);
                          // Open driver detail panel
                          if (selectedDriver?.id !== driver.id) {
                            void fetchDriverDetail(driver.id);
                          } else {
                            setDriverDetail(null);
                          }
                        }
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        selectedDriver?.id === driver.id
                          ? 'bg-[#0EA5A0]/15 border border-[#0EA5A0]/30'
                          : 'bg-gray-800/60 border border-gray-700/50 hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            isGpsStale(driver.lastLocationUpdatedAt) ? 'bg-gray-500' :
                            driver.status === 'available' ? 'bg-emerald-500' :
                            driver.status === 'in-trip' ? 'bg-blue-500' : 'bg-amber-500'
                          }`} />
                          <span className="text-sm font-semibold text-gray-200">{driver.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          <span className={isGpsStale(driver.lastLocationUpdatedAt) ? 'text-red-400' : ''}>{gpsAgeLabel(driver.lastLocationUpdatedAt)}</span>
                          <Star className="w-3 h-3 text-amber-400" />
                          {driver.averageRating.toFixed(1)}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                        <span>{driver.vehicleBrand} {driver.vehicleModel}</span>
                        <span className="text-gray-700">•</span>
                        <span>{driver.vehiclePlate}</span>
                        <span className="text-gray-700">•</span>
                        <span className={`font-medium ${
                          isGpsStale(driver.lastLocationUpdatedAt) ? 'text-gray-500' :
                          driver.status === 'available' ? 'text-emerald-400' :
                          driver.status === 'in-trip' ? 'text-blue-400' : 'text-amber-400'
                        }`}>
                          {isGpsStale(driver.lastLocationUpdatedAt) ? 'Sin GPS' : driver.status === 'available' ? 'Disponible' : driver.status === 'in-trip' ? 'En viaje' : 'Inactivo'}
                        </span>
                      </div>
                      {driver.currentTrip && (
                        <div className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          <span className="truncate">{driver.currentTrip.originName} → {driver.currentTrip.destName}</span>
                          <span className="text-gray-600 ml-auto">${driver.currentTrip.fare.toLocaleString()}</span>
                        </div>
                      )}
                    </button>
                  ))}
                  {filteredDrivers.length === 0 && !loading && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <Car className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No hay choferes en línea
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Requests Tab ─────────────────────────────────────── */}
            {sidebarTab === 'requests' && (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-gray-400">Pedidos de viaje en tiempo real</span>
                  <span className="text-xs font-bold text-amber-400">{stats?.pendingRequests ?? 0}</span>
                </div>

                {(stats?.pendingTrips || []).length === 0 && !loading && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <Navigation className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay pedidos pendientes
                  </div>
                )}

                {(stats?.pendingTrips || []).map((trip) => (
                  <div
                    key={trip.id}
                    className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 space-y-1.5 hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">
                        {new Date(trip.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">Buscando</span>
                    </div>
                    <div className="text-sm text-gray-200">
                      <div className="flex items-start gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                        <span className="truncate">{trip.originName}</span>
                      </div>
                      <div className="flex items-start gap-1.5 mt-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                        <span className="truncate">{trip.destName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span>${trip.fare.toLocaleString()}</span>
                      {trip.requestedVehicleType && (
                        <>
                          <span className="text-gray-700">•</span>
                          <span>{trip.requestedVehicleType}</span>
                        </>
                      )}
                      <button
                        onClick={() => setFlyTo([trip.originLat, trip.originLng])}
                        className="ml-auto text-[10px] text-[#0EA5A0] hover:underline flex items-center gap-0.5"
                      >
                        <MapPin className="w-3 h-3" /> Ver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Queue Tab ─────────────────────────────────────────── */}
            {sidebarTab === 'queue' && (
              <div className="p-3 space-y-4">
                {queues.length === 0 && !loading && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <List className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay filas activas
                  </div>
                )}

                {queues.map((queue) => (
                  <div key={queue.id} className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
                    {/* Queue header */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
                      <div className="flex items-center gap-2">
                        {queue.name.includes('Aeroparque') ? (
                          <Plane className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Building2 className="w-4 h-4 text-orange-400" />
                        )}
                        <div>
                          <span className="text-sm font-semibold text-gray-200">{queue.name}</span>
                          <p className="text-[10px] text-gray-500">{queue.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white bg-gray-700/80 rounded-lg px-2 py-1">
                          {queue.drivers.length}/{queue.maxQueueSize}
                        </span>
                        <button
                          onClick={() => handleAssignNext(queue.id, queue.name)}
                          disabled={queue.drivers.length === 0}
                          className="px-2.5 py-1 rounded-lg bg-[#0EA5A0] text-white text-[11px] font-semibold hover:bg-[#0C8C9A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          Asignar
                        </button>
                      </div>
                    </div>

                    {/* Queue drivers */}
                    {queue.drivers.length === 0 ? (
                      <div className="p-4 text-center text-gray-600 text-xs">Fila vacía</div>
                    ) : (
                      <div className="divide-y divide-gray-700/30">
                        {queue.drivers.map((entry, idx) => (
                          <div key={entry.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-700/30 transition-colors">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              idx === 0 ? 'bg-[#0EA5A0] text-white' : 'bg-gray-700 text-gray-300'
                            }`}>
                              {entry.position}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-200 truncate block">{entry.driverName}</span>
                              <span className="text-[10px] text-gray-500">
                                ~{entry.estimatedWaitMinutes} min espera • {new Date(entry.joinedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveFromQueue(entry.id)}
                              className="text-gray-600 hover:text-red-400 transition-colors p-1"
                              aria-label="Remover"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── History Tab ─────────────────────────────────────── */}
            {sidebarTab === 'history' && (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-gray-400">Viajes completados (24h)</span>
                  <span className="text-xs font-bold text-gray-300">{stats?.completedTrips24h ?? 0}</span>
                </div>

                {tripHistory.length === 0 && !loading && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No hay viajes en las últimas 24h
                  </div>
                )}

                {tripHistory.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => {
                      setSelectedTrip(t => t?.id === trip.id ? null : trip);
                      if (selectedTrip?.id !== trip.id) {
                        setFlyTo([trip.originLat, trip.originLng]);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      selectedTrip?.id === trip.id
                        ? 'bg-[#0EA5A0]/15 border border-[#0EA5A0]/30'
                        : 'bg-gray-800/60 border border-gray-700/50 hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-500">
                        {new Date(trip.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {trip.isFlagged && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold">
                            <Flag className="w-2.5 h-2.5" /> Alerta
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          trip.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          trip.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {trip.status === 'completed' ? 'Completado' : trip.status === 'cancelled' ? 'Cancelado' : 'Activo'}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-200 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="truncate">{trip.originName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="truncate">{trip.destName}</span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
                      <span className="font-medium text-gray-300">${trip.fare.toLocaleString()}</span>
                      {trip.distance && <span>{(trip.distance / 1000).toFixed(1)} km</span>}
                      {trip.duration && <span>{Math.round(trip.duration / 60)} min</span>}
                      {trip.driverName && <span className="truncate text-gray-600">• {trip.driverName}</span>}
                    </div>
                    {trip.isFlagged && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        Duración {(trip.duration ? Math.round(trip.duration / 60) : 0)} min vs esperado ~{trip.expectedDurationMin} min
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* ── Passengers Tab ────────────────────────────────────── */}
            {sidebarTab === 'passengers' && (
              <div className="p-3 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={passengerSearch}
                    onChange={(e) => setPassengerSearch(e.target.value)}
                    placeholder="Buscar pasajero (nombre, teléfono, DNI)..."
                    className="w-full bg-gray-800/80 text-sm text-gray-200 pl-9 pr-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-[#0EA5A0] placeholder-gray-500"
                  />
                </div>

                {/* Sort options */}
                <div className="flex items-center gap-2 flex-wrap">
                  {([
                    { field: 'name' as const, label: 'Nombre' },
                    { field: 'tripCountAsPassenger' as const, label: 'Viajes' },
                    { field: 'totalSpent' as const, label: 'Gasto' },
                    { field: 'rewardPoints' as const, label: 'Puntos' },
                  ]).map((s) => (
                    <button
                      key={s.field}
                      onClick={() => {
                        if (passengerSort === s.field) {
                          setPassengerSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        } else {
                          setPassengerSort(s.field);
                          setPassengerSortDir('desc');
                        }
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                        passengerSort === s.field
                          ? 'bg-[#0EA5A0]/20 text-[#0EA5A0] border border-[#0EA5A0]/30'
                          : 'bg-gray-800/60 text-gray-400 border border-gray-700/50 hover:text-gray-300'
                      }`}
                    >
                      {s.label}
                      {passengerSort === s.field && (passengerSortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline ml-0.5" /> : <ChevronUp className="w-3 h-3 inline ml-0.5" />)}
                    </button>
                  ))}
                </div>

                {/* Loading */}
                {passengersLoading && (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />
                  </div>
                )}

                {/* Passenger list */}
                {!passengersLoading && (
                  <div className="space-y-1.5">
                    {passengers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => void fetchPassengerDetail(p.id)}
                        className="w-full text-left p-3 rounded-xl bg-gray-800/60 border border-gray-700/50 hover:bg-gray-800 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-gray-200">{p.name}</span>
                              <div className="text-[10px] text-gray-500">{p.phone}</div>
                            </div>
                          </div>
                          <LevelBadge level={p.rewardLevel} />
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
                          <span className="flex items-center gap-0.5"><Navigation className="w-3 h-3" /> {p.tripCountAsPassenger} viajes</span>
                          <span className="flex items-center gap-0.5"><DollarSign className="w-3 h-3" /> ${(p.totalSpent || 0).toLocaleString()}</span>
                          <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400" /> {p.averageRating > 0 ? p.averageRating.toFixed(1) : '—'}</span>
                          <span className="ml-auto flex items-center gap-0.5 text-[#0EA5A0]"><Gem className="w-3 h-3" /> {p.rewardPoints} pts</span>
                        </div>
                      </button>
                    ))}
                    {passengers.length === 0 && !passengersLoading && (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No se encontraron pasajeros
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ─── Driver Detail Slide-Over Panel ──────────────────────────────── */}
      {driverDetail && (
        <div className="fixed inset-0 z-[1500]">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => { setDriverDetail(null); setSelectedDriver(null); }} />

          {/* Panel */}
          <div className="absolute top-0 right-0 h-full w-[420px] bg-gray-900/98 backdrop-blur-xl border-l border-gray-800 shadow-2xl slide-in-right flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-[#0EA5A0]" />
                <span className="text-sm font-bold text-gray-200">Detalle del Chofer</span>
              </div>
              <button onClick={() => { setDriverDetail(null); setSelectedDriver(null); }} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {/* Driver info header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-300">
                  {driverDetail.driver.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white">{driverDetail.driver.name}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <Phone className="w-3 h-3" /> {driverDetail.driver.phone}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      driverDetail.driver.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {driverDetail.driver.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vehicle info */}
              <div className="bg-gray-800/60 rounded-xl p-3 space-y-1.5">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Vehículo</div>
                <div className="text-sm text-gray-200">
                  {driverDetail.driver.vehicleBrand} {driverDetail.driver.vehicleModel} ({driverDetail.driver.vehicleYear || '—'})
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span>Patente: <span className="text-gray-300">{driverDetail.driver.vehiclePlate || '—'}</span></span>
                  <span>Color: <span className="text-gray-300">{driverDetail.driver.vehicleColor || '—'}</span></span>
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="Viajes" value={String(driverDetail.driver.tripCountAsDriver)} icon={<Navigation className="w-3.5 h-3.5" />} />
                <StatCard label="Ganancia" value={`$${(driverDetail.driver.totalEarned || 0).toLocaleString()}`} icon={<DollarSign className="w-3.5 h-3.5" />} />
                <StatCard label="Rating" value={`${driverDetail.driver.averageRating > 0 ? driverDetail.driver.averageRating.toFixed(1) : '—'}`} icon={<Star className="w-3.5 h-3.5" />} />
              </div>

              {/* Active trip */}
              {driverDetail.activeTrip && (
                <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-3 space-y-1.5">
                  <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide flex items-center gap-1">
                    <Navigation className="w-3 h-3" /> Viaje Activo
                  </div>
                  <div className="text-sm text-gray-200">
                    {driverDetail.activeTrip.originName} → {driverDetail.activeTrip.destName}
                  </div>
                  <div className="text-[11px] text-gray-500">${driverDetail.activeTrip.fare.toLocaleString()}</div>
                </div>
              )}

              {/* Document expiry */}
              <div className="space-y-2">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Documentación</div>
                <div className="flex flex-wrap gap-2">
                  <DocExpiryBadge label="Licencia" date={driverDetail.driver.licenseExpiryDate} />
                  <DocExpiryBadge label="Seguro" date={driverDetail.driver.seguroExpiryDate} />
                  <DocExpiryBadge label="Cédula" date={driverDetail.driver.cedulaExpiryDate} />
                </div>
              </div>

              {/* Trip history */}
              <div className="space-y-2">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                  Historial de Viajes ({driverDetail.tripsAsDriver.length})
                </div>
                <div className="space-y-1.5">
                  {driverDetail.tripsAsDriver.slice(0, 20).map((trip) => (
                    <button
                      key={trip.id}
                      onClick={() => {
                        setSelectedTrip(trip);
                        setFlyTo([trip.originLat, trip.originLng]);
                      }}
                      className="w-full text-left p-2.5 rounded-lg bg-gray-800/60 border border-gray-700/30 hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-gray-500">
                          {new Date(trip.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <div className="flex items-center gap-1">
                          {trip.isFlagged && (
                            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-900/40 text-red-400 text-[10px]">
                              <AlertTriangle className="w-2.5 h-2.5" /> Ruta
                            </span>
                          )}
                          <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                            trip.status === 'completed' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                          }`}>
                            {trip.status === 'completed' ? 'OK' : 'Cancelado'}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-300 truncate">
                        {trip.originName} → {trip.destName}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                        <span className="font-medium text-gray-300">${trip.fare.toLocaleString()}</span>
                        {trip.distance && <span>{(trip.distance / 1000).toFixed(1)}km</span>}
                        {trip.duration && <span>{Math.round(trip.duration / 60)}min</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ratings received */}
              {driverDetail.ratingsReceived.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                    Calificaciones Recibidas ({driverDetail.ratingsReceived.length})
                  </div>
                  <div className="space-y-1.5">
                    {driverDetail.ratingsReceived.slice(0, 10).map((r) => (
                      <div key={r.id} className="bg-gray-800/60 border border-gray-700/30 rounded-lg p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < r.stars ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
                            ))}
                          </div>
                          <span className="text-[10px] text-gray-600">{timeAgo(r.createdAt)}</span>
                        </div>
                        {r.comment && <p className="text-xs text-gray-400 mt-1">{r.comment}</p>}
                        <span className="text-[10px] text-gray-600">via {r.fromRole}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Driver detail loading overlay */}
      {driverDetailLoading && (
        <div className="fixed top-0 right-0 h-full w-[420px] bg-gray-900/80 z-[1499] flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}

      {/* ─── Passenger Detail Slide-Over Panel ─────────────────────────────── */}
      {passengerDetail && (
        <div className="fixed inset-0 z-[1500]">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setPassengerDetail(null)} />

          {/* Panel */}
          <div className="absolute top-0 right-0 h-full w-[460px] bg-gray-900/98 backdrop-blur-xl border-l border-gray-800 shadow-2xl slide-in-right flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0EA5A0]" />
                <span className="text-sm font-bold text-gray-200">Detalle del Pasajero</span>
              </div>
              <button onClick={() => setPassengerDetail(null)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {/* Passenger info header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-300">
                  {passengerDetail.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white">{passengerDetail.user.name}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <Phone className="w-3 h-3" /> {passengerDetail.user.phone}
                  </div>
                  {passengerDetail.user.email && (
                    <div className="text-[10px] text-gray-500 mt-0.5">{passengerDetail.user.email}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <LevelBadge level={passengerDetail.user.rewardLevel} />
                  {passengerDetail.user.isSocio && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#0EA5A0]/20 text-[#0EA5A0] text-[10px] font-bold">
                      <Crown className="w-2.5 h-2.5" /> Socio
                    </span>
                  )}
                </div>
              </div>

              {/* DNI & Address */}
              <div className="bg-gray-800/60 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-4 text-[11px] text-gray-400">
                  {passengerDetail.user.dni && (
                    <span>DNI: <span className="text-gray-200">{passengerDetail.user.dni}</span></span>
                  )}
                  <span>Miembro desde: <span className="text-gray-200">{new Date(passengerDetail.user.createdAt).toLocaleDateString('es-AR')}</span></span>
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-4 gap-2">
                <StatCard label="Viajes" value={String(passengerDetail.user.tripCountAsPassenger)} icon={<Navigation className="w-3 h-3" />} />
                <StatCard label="Gastado" value={`$${(passengerDetail.user.totalSpent || 0).toLocaleString()}`} icon={<DollarSign className="w-3 h-3" />} />
                <StatCard label="Rating" value={passengerDetail.user.averageRating > 0 ? passengerDetail.user.averageRating.toFixed(1) : '—'} icon={<Star className="w-3 h-3" />} />
                <StatCard label="Billetera" value={`$${(passengerDetail.user.walletBalance || 0).toLocaleString()}`} icon={<CreditCard className="w-3 h-3" />} />
              </div>

              {/* ── Reward Section ─────────────────────────────────────── */}
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 space-y-3">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-400" /> Programa de Recompensas
                </div>

                {/* Points & Level */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-[#0EA5A0]">{passengerDetail.user.rewardPoints}</span>
                    <span className="text-xs text-gray-500 ml-1">puntos</span>
                  </div>
                  <LevelBadge level={passengerDetail.user.rewardLevel} />
                </div>

                {/* Progress bar to next tier */}
                {(() => {
                  const sortedTiers = [...(passengerDetail.tiers || [])].sort((a, b) => a.minPoints - b.minPoints);
                  const currentTierIdx = sortedTiers.findIndex(t => t.level === passengerDetail.user.rewardLevel);
                  const currentTier = sortedTiers[currentTierIdx];
                  const nextTier = sortedTiers[currentTierIdx + 1];
                  if (!currentTier || !nextTier) return null;

                  const currentPts = passengerDetail.user.rewardPoints;
                  const range = nextTier.minPoints - currentTier.minPoints;
                  const progress = Math.min(100, Math.max(0, ((currentPts - currentTier.minPoints) / range) * 100));

                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span>{currentTier.level}</span>
                        <span>{nextTier.level}: {nextTier.minPoints} pts</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#0EA5A0] to-teal-400 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500">
                        Faltan {Math.max(0, nextTier.minPoints - currentPts)} puntos para {nextTier.level}
                      </span>
                    </div>
                  );
                })()}

                {/* Tier thresholds */}
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-600 font-semibold">Niveles</div>
                  {[...(passengerDetail.tiers || [])]
                    .sort((a, b) => a.minPoints - b.minPoints)
                    .map((tier) => {
                      const isActive = tier.level === passengerDetail.user.rewardLevel;
                      return (
                        <div key={tier.id} className={`flex items-center justify-between text-[10px] px-2 py-1 rounded-lg ${
                          isActive ? 'bg-[#0EA5A0]/15 border border-[#0EA5A0]/30 text-[#0EA5A0]' : 'text-gray-500'
                        }`}>
                          <span className="flex items-center gap-1">
                            <LevelBadge level={tier.level} />
                          </span>
                          <span className="font-medium">{tier.minPoints} pts</span>
                        </div>
                      );
                    })}
                </div>

                {/* Current tier benefits */}
                {(() => {
                  const currentTier = passengerDetail.tiers?.find(t => t.level === passengerDetail.user.rewardLevel);
                  if (!currentTier) return null;
                  return (
                    <div className="bg-gray-900/50 rounded-lg p-2.5 space-y-1">
                      <div className="text-[10px] text-gray-400 font-semibold">Beneficios actuales</div>
                      <p className="text-xs text-gray-300">{currentTier.benefits}</p>
                      <div className="flex gap-3 text-[10px] text-gray-500">
                        {currentTier.discountPercent > 0 && <span>Descuento: <span className="text-emerald-400">{currentTier.discountPercent}%</span></span>}
                        {currentTier.freeTripsPerMonth > 0 && <span>Viajes gratis: <span className="text-emerald-400">{currentTier.freeTripsPerMonth}/mes</span></span>}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Admin Actions ─────────────────────────────────────── */}
              <div className="space-y-2">
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Acciones de Administrador</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAwardAction('award_points'); setShowAwardModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/20 text-emerald-300 text-xs font-medium hover:bg-emerald-600/30 transition-colors flex-1"
                  >
                    <Gift className="w-3.5 h-3.5" /> Otorgar puntos
                  </button>
                  <button
                    onClick={() => { setAwardAction('remove_points'); setShowAwardModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/20 text-red-300 text-xs font-medium hover:bg-red-600/30 transition-colors flex-1"
                  >
                    <UserMinus className="w-3.5 h-3.5" /> Quitar puntos
                  </button>
                  <button
                    onClick={() => { setAwardAction('set_level'); setShowAwardModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600/20 text-purple-300 text-xs font-medium hover:bg-purple-600/30 transition-colors flex-1"
                  >
                    <Crown className="w-3.5 h-3.5" /> Fijar nivel
                  </button>
                </div>
              </div>

              {/* Award Points Modal */}
              {showAwardModal && (
                <div className="bg-gray-800/90 border border-gray-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-200">
                      {awardAction === 'award_points' ? 'Otorgar Puntos' :
                        awardAction === 'remove_points' ? 'Quitar Puntos' : 'Fijar Nivel'}
                    </span>
                    <button onClick={() => setShowAwardModal(false)} className="text-gray-500 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {awardAction === 'set_level' ? (
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500">Nivel</label>
                      <select
                        value={awardLevel}
                        onChange={(e) => setAwardLevel(e.target.value)}
                        className="w-full bg-gray-900 text-sm text-gray-200 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-[#0EA5A0]"
                      >
                        <option value="">Seleccionar nivel</option>
                        <option value="bronze">🥉 Bronze</option>
                        <option value="silver">🥈 Silver</option>
                        <option value="gold">🥇 Gold</option>
                        <option value="platinum">💎 Platinum</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500">
                        {awardAction === 'award_points' ? 'Puntos a otorgar' : 'Puntos a quitar'}
                      </label>
                      <input
                        type="number"
                        value={awardPoints}
                        onChange={(e) => setAwardPoints(e.target.value)}
                        placeholder="Ej: 100"
                        className="w-full bg-gray-900 text-sm text-gray-200 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-[#0EA5A0] placeholder-gray-600"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500">Razón (opcional)</label>
                    <input
                      type="text"
                      value={awardReason}
                      onChange={(e) => setAwardReason(e.target.value)}
                      placeholder="Motivo de la acción..."
                      className="w-full bg-gray-900 text-sm text-gray-200 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-[#0EA5A0] placeholder-gray-600"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAwardModal(false)}
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handlePassengerAction(passengerDetail.user.id)}
                      disabled={
                        awardAction === 'set_level' ? !awardLevel : !awardPoints || parseInt(awardPoints) <= 0
                      }
                      className="flex-1 px-3 py-2 rounded-lg bg-[#0EA5A0] text-white text-sm font-medium hover:bg-[#0C8C9A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}

              {/* ── Trip History ────────────────────────────────────────── */}
              {passengerDetail.tripsAsPassenger.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                    Viajes como Pasajero ({passengerDetail.tripsAsPassenger.length})
                  </div>
                  <div className="space-y-1.5">
                    {passengerDetail.tripsAsPassenger.slice(0, 20).map((trip) => (
                      <div key={trip.id} className="bg-gray-800/60 border border-gray-700/30 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-gray-500">
                            {new Date(trip.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                            trip.status === 'completed' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                          }`}>
                            {trip.status === 'completed' ? 'Completado' : 'Cancelado'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-300 truncate">
                          {trip.originName} → {trip.destName}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                          <span className="font-medium text-gray-300">${trip.fare.toLocaleString()}</span>
                          {trip.distance && <span>{(trip.distance / 1000).toFixed(1)}km</span>}
                          {trip.duration && <span>{Math.round(trip.duration / 60)}min</span>}
                          {trip.driverName && <span>• {trip.driverName}</span>}
                          {trip.rating && (
                            <span className="flex items-center gap-0.5 ml-auto">
                              <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" /> {trip.rating}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Reward Log ─────────────────────────────────────────── */}
              {passengerDetail.rewardLogs.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                    Historial de Puntos ({passengerDetail.rewardLogs.length})
                  </div>
                  <div className="space-y-1">
                    {passengerDetail.rewardLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-800/40">
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] text-gray-300 truncate block">{log.reason}</span>
                          <span className="text-[10px] text-gray-600">{timeAgo(log.createdAt)}</span>
                        </div>
                        <span className={`text-xs font-bold ${log.points > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {log.points > 0 ? '+' : ''}{log.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Passenger detail loading overlay */}
      {passengerDetailLoading && (
        <div className="fixed top-0 right-0 h-full w-[460px] bg-gray-900/80 z-[1499] flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function StatBadge({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorClasses: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
    teal: 'text-teal-400',
  };
  return (
    <div className="flex items-center gap-1.5 bg-gray-800/60 rounded-lg px-2.5 py-1">
      <span className={colorClasses[color] || 'text-gray-400'}>{icon}</span>
      <span className="text-gray-500 hidden lg:inline">{label}:</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/30 rounded-xl p-2.5 text-center space-y-1">
      <div className="flex items-center justify-center text-gray-500">{icon}</div>
      <div className="text-xs font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
