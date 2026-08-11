'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import {
  ArrowLeft, ShieldCheck, CheckCircle2, XCircle, Clock,
  Phone, Mail, MapPin, IdCard, Car, Cake, Loader2, Users, RefreshCw, AlertCircle,
  Siren, Navigation, ExternalLink, FileText, CreditCard, Eye, X, Star, Wallet, ChevronRight,
  Search, CheckSquare, Square, Table2, LayoutGrid, ZoomIn, ZoomOut, RotateCw,
  Download, Calendar, AlertTriangle, ChevronDown, ChevronUp, Maximize2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  dni: string;
  birthday: string;
  address: string;
  role: string;
  isDriver: boolean;
  isDriverApproved: boolean;
  isAdmin: boolean;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

interface AdminStats {
  pending: number;
  verified: number;
  rejected: number;
  drivers: number;
  total: number;
}

type Tab = 'all' | 'pending' | 'verified' | 'rejected' | 'sos' | 'changes';
type ViewMode = 'cards' | 'table';

// ─── Full user detail type (fetched from /api/admin/users/[id]) ────────

interface AdminUserDetail extends AdminUser {
  facePhoto: string;
  dniFront: string;
  dniBack: string;
  selfieWithDni: string;
  // Driver docs
  licenseFront: string;
  licenseBack: string;
  vehicleType: string;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number | null;
  vehicleColor: string;
  cedulaVerdeAzul: string;
  cedulaVerdeAzulBack: string;
  seguroVehiculo: string;
  // Expiration dates
  licenseExpiryDate: string;
  seguroExpiryDate: string;
  cedulaExpiryDate: string;
  // Driver config
  driverConfig: {
    maxPickupKm: number;
    minFare: number;
    minPerKm: number;
    autoAccept: boolean;
    genderPreference: string;
    driverGender: string;
    tripPreferences: string;
    smokingAllowed: boolean;
    petsAllowed: boolean;
    musicAllowed: boolean;
    prefersSilence: boolean;
    hasAC: boolean;
    cbuNumber: string;
    cbuAlias: string;
    cbuHolderName: string;
  } | null;
  // Stats
  tripCountAsPassenger: number;
  tripCountAsDriver: number;
  totalSpent: number;
  totalEarned: number;
  averageRating: number;
  ratingCount: number;
  walletBalance: number;
  isSocio: boolean;
}

// ─── Helper: days until a date string (YYYY-MM-DD) ─────────────────────

function daysUntil(dateStr: string): number | null {
  if (!dateStr || dateStr.length < 4) return null;
  const target = new Date(dateStr + 'T23:59:59');
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function expiryBadge(dateStr: string, label: string) {
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) {
    return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{label}: Vencida</span>;
  }
  if (days <= 30) {
    return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{label}: {days}d</span>;
  }
  return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">{label}: OK ({days}d)</span>;
}

// ─── Component ──────────────────────────────────────────────────────────────

// ─── Pending data change request ──────────────────────────────────────
interface PendingChangeItem {
  id: string;
  userId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user?: { name: string; phone: string } | null;
}

const CHANGE_FIELD_LABELS: Record<string, string> = {
  phone: 'Telefono',
  email: 'Correo electronico',
  vehicleType: 'Tipo de vehiculo',
  vehiclePlate: 'Patente',
  vehicleBrand: 'Marca',
  vehicleModel: 'Modelo',
  vehicleYear: 'Ano',
  vehicleColor: 'Color',
  cbuNumber: 'CBU/CVU',
  cbuAlias: 'Alias CBU',
  cbuHolderName: 'Titular bancario',
};

interface SosAlertItem {
  id: string;
  userId: string;
  tripId: string | null;
  shareToken: string | null;
  lat: number | null;
  lng: number | null;
  status: 'active' | 'resolved' | 'false_alarm';
  resolutionNote: string;
  createdAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    name: string;
    phone: string;
    email: string;
    isDriver: boolean;
  } | null;
}

export function AdminScreen() {
  const store = useAppStore();
  const [tab, setTab] = useState<Tab>('pending');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  // Detail modal state
  const [detailUser, setDetailUser] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // SOS alerts state (only loaded when SOS tab is active)
  const [sosAlerts, setSosAlerts] = useState<SosAlertItem[]>([]);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosActionLoading, setSosActionLoading] = useState<string | null>(null);

  // Pending changes state (admin approval)
  const [pendingChanges, setPendingChanges] = useState<PendingChangeItem[]>([]);
  const [changesLoading, setChangesLoading] = useState(false);
  const [changeActionLoading, setChangeActionLoading] = useState<string | null>(null);

  // Table sort state
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchUsers = useCallback(async () => {
    if (!store.user?.uid) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        userId: store.user.uid,
        status: tab,
      });
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.status === 403) {
        setError('No tenés permisos de administrador.');
        setUsers([]);
        setStats(null);
        return;
      }
      if (!res.ok) {
        setError('Error al cargar usuarios.');
        return;
      }
      const json = await res.json();
      setUsers(json.users as AdminUser[]);
      setStats(json.stats as AdminStats);
    } catch {
      setError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, [store.user?.uid, tab, searchQuery]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Debounced search: refetch when searchQuery changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      void fetchUsers();
      return;
    }
    const timer = setTimeout(() => {
      void fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchUsers]);

  // Fetch SOS alerts when SOS tab is selected
  const fetchSosAlerts = useCallback(async () => {
    setSosLoading(true);
    try {
      const res = await fetch('/api/sos?status=active&limit=50');
      if (!res.ok) {
        store.showToast('Error al cargar alertas SOS', 'error');
        return;
      }
      const json = await res.json();
      setSosAlerts(json.alerts as SosAlertItem[]);
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setSosLoading(false);
    }
  }, [store]);

  // Fetch pending data changes when Changes tab is selected
  const fetchPendingChanges = useCallback(async () => {
    setChangesLoading(true);
    try {
      // Fetch all statuses to show history too
      const [resPending, resApproved, resRejected] = await Promise.all([
        fetch('/api/changes?all=true&status=pending'),
        fetch('/api/changes?all=true&status=approved'),
        fetch('/api/changes?all=true&status=rejected'),
      ]);
      const [jsonP, jsonA, jsonR] = await Promise.all([
        resPending.ok ? resPending.json() : { changes: [] },
        resApproved.ok ? resApproved.json() : { changes: [] },
        resRejected.ok ? resRejected.json() : { changes: [] },
      ]);
      const all = [...(jsonP.changes || []), ...(jsonA.changes || []), ...(jsonR.changes || [])];
      all.sort((a: PendingChangeItem, b: PendingChangeItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPendingChanges(all.slice(0, 50));
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setChangesLoading(false);
    }
  }, [store]);

  // Review a pending change (approve/reject)
  const handleReviewChange = useCallback(async (changeId: string, status: 'approved' | 'rejected') => {
    setChangeActionLoading(changeId);
    try {
      const res = await fetch('/api/changes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId, status, reviewedBy: store.user?.uid || 'admin' }),
      });
      const json = await res.json();
      if (json.ok) {
        store.showToast(status === 'approved' ? 'Cambio aprobado' : 'Cambio rechazado', 'success');
        // Refresh the list
        await fetchPendingChanges();
      } else {
        store.showToast(json.error || 'Error al procesar', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setChangeActionLoading(null);
    }
  }, [store, fetchPendingChanges]);

  useEffect(() => {
    if (tab === 'sos') void fetchSosAlerts();
    if (tab === 'changes') void fetchPendingChanges();
  }, [tab, fetchSosAlerts, fetchPendingChanges]);

  // Auto-refresh SOS alerts every 10s
  useEffect(() => {
    if (tab !== 'sos') return;
    const interval = setInterval(() => {
      void fetchSosAlerts();
    }, 10000);
    return () => clearInterval(interval);
  }, [tab, fetchSosAlerts]);

  const handleResolveSos = async (alertId: string, status: 'resolved' | 'false_alarm', note: string = '') => {
    setSosActionLoading(alertId);
    try {
      const res = await fetch(`/api/sos/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note, resolvedBy: store.user?.uid }),
      });
      if (res.ok) {
        store.showToast(status === 'resolved' ? 'Alerta marcada como resuelta' : 'Marcada como falsa alarma', 'success');
        await fetchSosAlerts();
      } else {
        store.showToast('Error al resolver alerta', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setSosActionLoading(null);
    }
  };

  const fetchUserDetail = async (userId: string) => {
    if (!store.user?.uid) return;
    setDetailLoading(true);
    setDetailUser(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}?adminUserId=${store.user.uid}`);
      if (!res.ok) {
        store.showToast('Error al cargar documentos', 'error');
        return;
      }
      const json = await res.json();
      setDetailUser(json.user as AdminUserDetail);
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (userId: string, userName: string, isDriver: boolean) => {
    if (!store.user?.uid) return;
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: store.user.uid, targetUserId: userId, approveDriver: isDriver }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        store.showToast(json.message, 'success');
        await fetchUsers();
      } else {
        store.showToast(json.error || 'Error al aprobar', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string, userName: string) => {
    if (!store.user?.uid) return;
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: store.user.uid, targetUserId: userId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        store.showToast(json.message, 'info');
        await fetchUsers();
      } else {
        store.showToast(json.error || 'Error al rechazar', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (!store.user?.uid || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: store.user.uid, action, userIds: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        store.showToast(`${action === 'approve' ? 'Aprobados' : 'Rechazados'}: ${action === 'approve' ? json.approved : json.rejected} usuarios`, 'success');
        setSelectedIds(new Set());
        setBulkMode(false);
        await fetchUsers();
      } else {
        store.showToast(json.error || 'Error en operación masiva', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map(u => u.id)));
    }
  };

  // Export users to CSV
  const handleExportCSV = () => {
    const headers = ['Nombre', 'DNI', 'Teléfono', 'Email', 'Rol', 'Estado', 'Conductor', 'Registrado', 'Domicilio', 'Cumpleaños'];
    const rows = users.map(u => [
      u.name, u.dni || '', u.phone, u.email || '', u.role,
      u.verificationStatus, u.isDriver ? 'Sí' : 'No',
      new Date(u.createdAt).toLocaleString('es-AR'),
      u.address || '', u.birthday || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unira_usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Access check ──────────────────────────────────────────────────────
  if (!store.user) return null;
  if (!store.user.isAdmin) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Acceso denegado</h1>
        <p className="text-gray-500 text-sm max-w-[280px] mb-6">Necesitás permisos de administrador para acceder a esta sección.</p>
        <button onClick={() => store.setCurrentScreen('home')} className="px-5 py-2.5 rounded-xl bg-[#0EA5A0] text-white text-sm font-semibold">Volver al inicio</button>
      </div>
    );
  }

  // ─── Sort users for table view ──
  const sortedUsers = [...users].sort((a, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let valA = (a as any)[sortField];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let valB = (b as any)[sortField];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA == null) return 1;
    if (valB == null) return -1;
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // ─── Render ────────────────────────────────────────────────────────────
  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'all', label: 'Todos', count: stats?.total ?? 0 },
    { id: 'pending', label: 'Pendientes', count: stats?.pending ?? 0 },
    { id: 'verified', label: 'Aprobados', count: stats?.verified ?? 0 },
    { id: 'rejected', label: 'Rechazados', count: stats?.rejected ?? 0 },
    { id: 'sos', label: 'SOS', count: sosAlerts.length },
    { id: 'changes', label: 'Cambios', count: pendingChanges.filter(c => c.status === 'pending').length },
  ];

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-20" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={() => store.setCurrentScreen('home')} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all" aria-label="Volver">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Panel de admin</h1>
        <button onClick={() => void fetchUsers()} disabled={loading} className="ml-auto w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50" aria-label="Actualizar">
          <RefreshCw className={`w-5 h-5 text-gray-700 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="px-4 mt-3">
          <div className="grid grid-cols-4 gap-2">
            <StatCard label="Total" value={stats.total} icon={<Users className="w-4 h-4" />} color="#0EA5A0" />
            <StatCard label="Choferes" value={stats.drivers} icon={<Car className="w-4 h-4" />} color="#F59E0B" />
            <StatCard label="Pendientes" value={stats.pending} icon={<Clock className="w-4 h-4" />} color="#EF4444" />
            <StatCard label="Aprobados" value={stats.verified} icon={<CheckCircle2 className="w-4 h-4" />} color="#10B981" />
          </div>
        </div>
      )}

      {/* Operations Center shortcut */}
      <div className="px-4 mt-3">
        <button
          onClick={() => store.setCurrentScreen('operations-center')}
          className="w-full bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-[0.98] shadow-sm"
        >
          <div className="w-11 h-11 rounded-xl bg-[#0EA5A0]/20 flex items-center justify-center">
            <Siren className="w-5 h-5 text-[#0EA5A0]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-white">Centro de Operaciones</p>
            <p className="text-[11px] text-gray-400">Mapa en vivo, filas, despacho de viajes</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm p-1 flex overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 min-w-fit py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 px-3 ${
                tab === t.id ? 'bg-[#0EA5A0] text-white' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar + controls */}
      {tab !== 'sos' && (
        <div className="px-4 mt-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por DNI, nombre, teléfono..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white shadow-sm border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0EA5A0] focus:ring-1 focus:ring-[#0EA5A0]/30" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View mode toggle */}
            <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <button onClick={() => setViewMode('table')} className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 ${viewMode === 'table' ? 'bg-[#0EA5A0] text-white' : 'text-gray-500'}`}>
                <Table2 className="w-3.5 h-3.5" /> Tabla
              </button>
              <button onClick={() => setViewMode('cards')} className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 ${viewMode === 'cards' ? 'bg-[#0EA5A0] text-white' : 'text-gray-500'}`}>
                <LayoutGrid className="w-3.5 h-3.5" /> Tarjetas
              </button>
            </div>

            {/* Export CSV */}
            <button onClick={handleExportCSV} className="px-2.5 py-1.5 rounded-lg bg-white shadow-sm border border-gray-200 text-xs font-medium text-gray-600 flex items-center gap-1 hover:bg-gray-50">
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>

            {/* Bulk selection */}
            <button onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${bulkMode ? 'bg-[#0EA5A0] text-white' : 'bg-white shadow-sm border border-gray-200 text-gray-700'}`}>
              <CheckSquare className="w-3.5 h-3.5" /> Seleccionar
            </button>

            {bulkMode && selectedIds.size > 0 && (
              <div className="flex gap-2 ml-auto">
                <button onClick={() => void handleBulkAction('approve')} disabled={bulkLoading}
                  className="flex-1 py-1.5 rounded-lg bg-[#0EA5A0] text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]">
                  {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Aprobar ({selectedIds.size})
                </button>
                <button onClick={() => void handleBulkAction('reject')} disabled={bulkLoading}
                  className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]">
                  {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} Rechazar ({selectedIds.size})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="px-4 mt-8 flex flex-col items-center text-center">
          <Loader2 className="w-8 h-8 text-[#0EA5A0] animate-spin mb-3" />
          <p className="text-gray-500 text-sm">Cargando usuarios...</p>
        </div>
      )}

      {/* SOS alerts list */}
      {/* ── CHANGES TAB (admin approval of data change requests) ── */}
      {tab === 'changes' && (
        <div className="px-4 mt-4 space-y-3">
          {changesLoading && pendingChanges.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12">
              <Loader2 className="w-8 h-8 text-[#0EA5A0] animate-spin mb-3" />
              <p className="text-gray-500 text-sm">Cargando solicitudes de cambio...</p>
            </div>
          ) : pendingChanges.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm font-medium">No hay solicitudes de cambio</p>
              <p className="text-gray-400 text-xs mt-1">Cuando un usuario solicite modificar datos sensibles, aparecera aqui.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">Solicitudes de cambio de datos</p>
                <button onClick={() => void fetchPendingChanges()} disabled={changesLoading} className="text-xs text-[#0EA5A0] font-medium flex items-center gap-1 disabled:opacity-50">
                  <RefreshCw className={`w-3 h-3 ${changesLoading ? 'animate-spin' : ''}`} /> Actualizar
                </button>
              </div>
              {pendingChanges.map((change) => (
                <div key={change.id} className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-[#0EA5A0]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{change.user?.name || 'Usuario'}</p>
                        <p className="text-[11px] text-gray-500">{change.user?.phone || change.userId.slice(0, 8)}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      change.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      change.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {change.status === 'pending' ? 'Pendiente' : change.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Campo</span>
                      <span className="text-xs font-semibold text-gray-900">{CHANGE_FIELD_LABELS[change.field] || change.field}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-500 line-through">{change.oldValue || '(vacio)'}</span>
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                      <span className="text-emerald-600 font-medium">{change.newValue}</span>
                    </div>
                    {change.reason && (
                      <p className="text-[10px] text-gray-500 mt-1 italic">"{change.reason}"</p>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mb-2">{new Date(change.createdAt).toLocaleString('es-AR')}</p>
                  {change.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleReviewChange(change.id, 'approved')}
                        disabled={changeActionLoading === change.id}
                        className="flex-1 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {changeActionLoading === change.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5" /> Aprobar</>}
                      </button>
                      <button
                        onClick={() => void handleReviewChange(change.id, 'rejected')}
                        disabled={changeActionLoading === change.id}
                        className="flex-1 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {changeActionLoading === change.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><XCircle className="w-3.5 h-3.5" /> Rechazar</>}
                      </button>
                    </div>
                  )}
                  {change.status !== 'pending' && change.reviewedAt && (
                    <p className="text-[10px] text-gray-400">
                      {change.status === 'approved' ? 'Aprobado' : 'Rechazado'} el {new Date(change.reviewedAt).toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'sos' && (
        <div className="px-4 mt-4 space-y-3">
          {sosLoading && sosAlerts.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
              <p className="text-gray-500 text-sm">Cargando alertas SOS...</p>
            </div>
          ) : sosAlerts.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12">
              <Siren className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm font-medium">No hay alertas SOS activivas</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-xs text-red-500 font-medium mb-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />EN VIVO — actualización cada 10s
              </div>
              {sosAlerts.map((alert) => (
                <SosAlertCard key={alert.id} alert={alert}
                  onResolve={(note) => void handleResolveSos(alert.id, 'resolved', note)}
                  onFalseAlarm={() => void handleResolveSos(alert.id, 'false_alarm', 'Falsa alarma')}
                  actionLoading={sosActionLoading === alert.id} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── TABLE VIEW (spreadsheet-style) ── */}
      {tab !== 'sos' && tab !== 'changes' && viewMode === 'table' && !loading && !error && (
        <div className="px-4 mt-4">
          {users.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm font-medium">No hay usuarios en esta categoría</p>
              <p className="text-gray-400 text-xs mt-1">{searchQuery ? 'No se encontraron resultados para la búsqueda.' : 'Cuando alguien se registre, va a aparecer acá.'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {bulkMode && <th className="px-2 py-2 w-8"></th>}
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-1">Nombre <SortIcon field="name" /></div>
                      </th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('dni')}>
                        <div className="flex items-center gap-1">DNI <SortIcon field="dni" /></div>
                      </th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('phone')}>
                        <div className="flex items-center gap-1">Teléfono <SortIcon field="phone" /></div>
                      </th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600">Email</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('verificationStatus')}>
                        <div className="flex items-center gap-1">Estado <SortIcon field="verificationStatus" /></div>
                      </th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600">Chofer</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600">Verif.</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('createdAt')}>
                        <div className="flex items-center gap-1">Registro <SortIcon field="createdAt" /></div>
                      </th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                        {bulkMode && (
                          <td className="px-2 py-2">
                            <button onClick={() => toggleSelectUser(u.id)}>
                              {selectedIds.has(u.id) ? <CheckSquare className="w-4 h-4 text-[#0EA5A0]" /> : <Square className="w-4 h-4 text-gray-300" />}
                            </button>
                          </td>
                        )}
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                              u.isDriver ? 'bg-amber-100 text-amber-600' : 'bg-[#0EA5A0]/10 text-[#0EA5A0]'
                            }`}>{u.name.charAt(0).toUpperCase()}</div>
                            <span className="font-medium text-gray-900 truncate max-w-[120px]">{u.name}</span>
                            {u.isDriver && <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold">CH</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2 font-mono text-gray-700 font-medium">{u.dni || '—'}</td>
                        <td className="px-2 py-2 font-mono text-gray-600">{u.phone}</td>
                        <td className="px-2 py-2 text-gray-500 truncate max-w-[100px]">{u.email || '—'}</td>
                        <td className="px-2 py-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                            u.verificationStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>{u.verificationStatus === 'verified' ? 'Aprobado' : u.verificationStatus === 'rejected' ? 'Rechazado' : 'Pendiente'}</span>
                        </td>
                        <td className="px-2 py-2">
                          {u.isDriver ? (
                            u.isDriverApproved ? <span className="text-emerald-600 font-bold">Sí</span> : <span className="text-amber-600">No aprob.</span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-0.5">
                            {u.phoneVerifiedAt ? <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Tel</span> : <span className="text-gray-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Tel</span>}
                            {u.email && u.emailVerifiedAt ? <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Email</span> : <span className="text-gray-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Email</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={() => void fetchUserDetail(u.id)} title="Ver documentos" className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors">
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                            {tab === 'pending' && (
                              <>
                                <button onClick={() => void handleApprove(u.id, u.name, u.isDriver)} disabled={actionLoading === u.id} title="Aprobar" className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center hover:bg-emerald-100 transition-colors disabled:opacity-50">
                                  {actionLoading === u.id ? <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                                </button>
                                <button onClick={() => void handleReject(u.id, u.name)} disabled={actionLoading === u.id} title="Rechazar" className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors disabled:opacity-50">
                                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              </>
                            )}
                            {tab === 'rejected' && (
                              <button onClick={() => void handleApprove(u.id, u.name, u.isDriver)} disabled={actionLoading === u.id} title="Reactivar" className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center hover:bg-emerald-100 transition-colors disabled:opacity-50">
                                {actionLoading === u.id ? <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400">
                {users.length} usuario{users.length !== 1 ? 's' : ''} {searchQuery ? `encontrados para "${searchQuery}"` : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CARD VIEW ── */}
      {tab !== 'sos' && tab !== 'changes' && viewMode === 'cards' && !loading && !error && (
        <div className="px-4 mt-4 space-y-3">
          {users.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm font-medium">No hay usuarios en esta categoría</p>
              <p className="text-gray-400 text-xs mt-1">{searchQuery ? 'No se encontraron resultados para la búsqueda.' : 'Cuando alguien se registre, va a aparecer acá.'}</p>
            </div>
          ) : sortedUsers.map((u) => (
            <UserCard key={u.id} user={u} expanded={expandedUserId === u.id}
              onToggle={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
              onApprove={() => void handleApprove(u.id, u.name, u.isDriver)}
              onReject={() => void handleReject(u.id, u.name)}
              actionLoading={actionLoading === u.id} tab={tab}
              onViewDocs={() => void fetchUserDetail(u.id)}
              bulkMode={bulkMode} isSelected={selectedIds.has(u.id)}
              onToggleSelect={() => toggleSelectUser(u.id)} />
          ))}
        </div>
      )}

      {/* ── User Detail Modal ── */}
      {(detailLoading || detailUser) && (
        <UserDetailModal user={detailUser} loading={detailLoading}
          onClose={() => { setDetailUser(null); setDetailLoading(false); }}
          onApprove={detailUser ? () => { void handleApprove(detailUser.id, detailUser.name, detailUser.isDriver); setDetailUser(null); } : undefined}
          onReject={detailUser ? () => { void handleReject(detailUser.id, detailUser.name); setDetailUser(null); } : undefined}
          tab={tab} onLightbox={(img) => setLightboxImg(img)} />
      )}

      {/* ── Zoom Lightbox for document photos ── */}
      {lightboxImg && (
        <ZoomLightbox src={lightboxImg} onClose={() => setLightboxImg(null)} />
      )}
    </div>
  );
}

// ─── Zoom Lightbox Component (pinch-to-zoom + double-tap + scroll zoom) ──

function ZoomLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastTouchRef = useRef<{ x: number; y: number; scale: number } | null>(null);
  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null);

  const resetView = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.min(5, Math.max(0.5, prev - e.deltaY * 0.002)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Touch handlers for pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartRef.current = { dist: Math.sqrt(dx * dx + dy * dy), scale };
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, scale };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const newScale = Math.min(5, Math.max(0.5, pinchStartRef.current.scale * (dist / pinchStartRef.current.dist)));
      setScale(newScale);
    } else if (e.touches.length === 1 && isDragging && lastTouchRef.current) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, scale };
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    pinchStartRef.current = null;
    lastTouchRef.current = null;
  };

  // Double-tap to zoom
  const lastTapRef = useRef(0);
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setScale(prev => prev > 1 ? 1 : 3);
      setPosition({ x: 0, y: 0 });
    }
    lastTapRef.current = now;
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/95 flex flex-col items-center" style={{ touchAction: 'none' }}>
      {/* Top bar */}
      <div className="w-full flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-white/60 text-xs">Documento</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.min(5, s + 0.5))} className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white active:bg-white/25"><ZoomIn className="w-5 h-5" /></button>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.5))} className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white active:bg-white/25"><ZoomOut className="w-5 h-5" /></button>
          <button onClick={resetView} className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white active:bg-white/25"><RotateCw className="w-5 h-5" /></button>
          <span className="text-white/50 text-xs font-mono">{Math.round(scale * 100)}%</span>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-white active:bg-white/25"><X className="w-7 h-7" /></button>
        </div>
      </div>
      {/* Image container */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center w-full overflow-hidden select-none"
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onClick={handleTap}>
        <img ref={imgRef} src={src} alt="Documento" draggable={false}
          className="max-w-full max-h-full object-contain transition-transform"
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }} />
      </div>
      <p className="text-white/30 text-[10px] pb-4 flex-shrink-0">Scroll para zoom · Doble tap para agrandar · Pinch para zoom en móvil · ESC para cerrar</p>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 flex flex-col items-center">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1" style={{ backgroundColor: `${color}15`, color }}>{icon}</div>
      <span className="text-lg font-bold text-gray-900">{value}</span>
      <span className="text-[10px] text-gray-500 font-medium">{label}</span>
    </div>
  );
}

function UserCard({
  user, expanded, onToggle, onApprove, onReject, actionLoading, tab, onViewDocs,
  bulkMode, isSelected, onToggleSelect,
}: {
  user: AdminUser; expanded: boolean; onToggle: () => void; onApprove: () => void; onReject: () => void;
  actionLoading: boolean; tab: Tab; onViewDocs: () => void;
  bulkMode?: boolean; isSelected?: boolean; onToggleSelect?: () => void;
}) {
  const initial = user.name.charAt(0).toUpperCase();
  const registeredDate = new Date(user.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors">
        {bulkMode && (
          <button onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
            className="mr-1 flex-shrink-0">{isSelected ? <CheckSquare className="w-5 h-5 text-[#0EA5A0]" /> : <Square className="w-5 h-5 text-gray-300" />}</button>
        )}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${user.isDriver ? 'bg-amber-100 text-amber-600' : 'bg-[#0EA5A0]/10 text-[#0EA5A0]'}`}>
          <span className="text-base font-bold">{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
            {user.isDriver && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">Conductor</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" />{user.phone}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {user.phoneVerifiedAt ? <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Tel</span> : <span className="text-[10px] text-gray-400 font-medium flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Tel</span>}
            {user.emailVerifiedAt && <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Email</span>}
          </div>
        </div>
        {tab === 'verified' && <div className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>}
        {tab === 'rejected' && <div className="flex items-center gap-1 text-red-500"><XCircle className="w-5 h-5" /></div>}
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {user.email && <DetailItem icon={<Mail className="w-3 h-3" />} label="Email" value={user.email} />}
            {user.dni && <DetailItem icon={<IdCard className="w-3 h-3" />} label="DNI" value={user.dni} />}
            {user.birthday && <DetailItem icon={<Cake className="w-3 h-3" />} label="Nacimiento" value={new Date(user.birthday + 'T12:00:00').toLocaleDateString('es-AR')} />}
            {user.address && <DetailItem icon={<MapPin className="w-3 h-3" />} label="Domicilio" value={user.address} />}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Registrado: {registeredDate}</p>
          <button onClick={(e) => { e.stopPropagation(); onViewDocs(); }}
            className="w-full mt-2 h-9 rounded-xl bg-[#0C8CE9]/10 border border-[#0C8CE9]/25 text-[#0C8CE9] text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:bg-[#0C8CE9]/20">
            <Eye className="w-3.5 h-3.5" />Ver documentos completos<ChevronRight className="w-3 h-3" />
          </button>
          {tab === 'pending' && (
            <div className="flex gap-2 mt-3">
              <button onClick={onApprove} disabled={actionLoading} className="flex-1 h-10 rounded-xl bg-[#0EA5A0] text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" />{user.isDriver ? 'Aprobar conductor' : 'Aprobar'}</>}
              </button>
              <button onClick={onReject} disabled={actionLoading} className="flex-1 h-10 rounded-xl border border-red-200 bg-white text-red-500 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50">
                <XCircle className="w-4 h-4" />Rechazar
              </button>
            </div>
          )}
          {tab === 'rejected' && (
            <div className="flex gap-2 mt-3">
              <button onClick={onApprove} disabled={actionLoading} className="flex-1 h-10 rounded-xl bg-[#0EA5A0] text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" />Reactivar</>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-gray-700 text-xs truncate">{value}</p>
      </div>
    </div>
  );
}

function SosAlertCard({ alert, onResolve, onFalseAlarm, actionLoading }: {
  alert: SosAlertItem; onResolve: (note: string) => void; onFalseAlarm: () => void; actionLoading: boolean;
}) {
  const [showResolveSheet, setShowResolveSheet] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const handleResolveClick = () => { onResolve(resolutionNote); setShowResolveSheet(false); setResolutionNote(''); };
  const timeAgo = (() => {
    const diff = Date.now() - new Date(alert.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Hace menos de 1 min';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    return `Hace ${hours}h ${mins % 60}m`;
  })();
  const mapsUrl = alert.lat && alert.lng ? `https://www.google.com/maps?q=${alert.lat},${alert.lng}` : null;
  const tripShareUrl = alert.shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/viaje/${alert.shareToken}` : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-2 border-red-200">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0 relative">
            <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-20" />
            <Siren className="w-6 h-6 text-red-500 relative" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-bold text-gray-900 truncate">{alert.user?.name || 'Usuario desconocido'}</p>
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">ACTIVA</span>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{alert.user?.phone || '—'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Ubicación</p>
            {mapsUrl ? (
              <a href={mapsUrl!} target="_blank" rel="noopener noreferrer" className="text-[#0EA5A0] font-medium flex items-center gap-1 hover:underline">
                <MapPin className="w-3 h-3" />{alert.lat!.toFixed(4)}, {alert.lng!.toFixed(4)}<ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : <p className="text-gray-400">No disponible</p>}
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Viaje</p>
            {alert.tripId ? <p className="text-gray-700 font-mono text-[10px] truncate">ID: {alert.tripId.slice(-8)}</p> : <p className="text-gray-400">Sin viaje activo</p>}
          </div>
        </div>
        {tripShareUrl && (
          <a href={tripShareUrl} target="_blank" rel="noopener noreferrer"
            className="w-full mb-3 h-10 rounded-xl bg-[#0EA5A0] text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
            <Navigation className="w-4 h-4" />Ver ubicación del vehículo en vivo<ExternalLink className="w-3 h-3" />
          </a>
        )}
        <div className="flex gap-2">
          <button onClick={() => setShowResolveSheet(true)} disabled={actionLoading}
            className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" />Resuelto</>}
          </button>
          <button onClick={onFalseAlarm} disabled={actionLoading}
            className="flex-1 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50">
            <XCircle className="w-4 h-4" />Falsa alarma
          </button>
        </div>
      </div>
      {showResolveSheet && (
        <div className="border-t border-gray-100 p-3 bg-gray-50">
          <p className="text-xs text-gray-600 mb-2 font-medium">Notas de resolución:</p>
          <textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} rows={2} className="w-full p-2 rounded-lg border border-gray-200 text-xs text-gray-700 resize-none focus:outline-none focus:border-[#0EA5A0]" />
          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowResolveSheet(false)} className="flex-1 h-9 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-semibold active:scale-95 transition-all">Cancelar</button>
            <button onClick={handleResolveClick} disabled={actionLoading} className="flex-1 h-9 rounded-lg bg-emerald-500 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-50">{actionLoading ? 'Guardando...' : 'Confirmar'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── User Trip History Component ───────────────────────────────────────────

interface UserTrip {
  id: string;
  type: string;
  status: string;
  originName: string;
  destName: string;
  fare: number;
  vehicleType: string | null;
  distance: number | null;
  duration: number | null;
  paymentMethod: string;
  createdAt: string;
  user?: { id: string; name: string; phone: string } | null;
  driverName?: string | null;
  driverPhoto?: string | null;
  driverVehicle?: string | null;
}

function UserTripHistory({ userId, role, adminUserId }: { userId: string; role: 'driver' | 'passenger'; adminUserId: string }) {
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? 50 : 10;

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ adminUserId, role, limit: String(limit), offset: '0' });
      const res = await fetch(`/api/admin/users/${userId}/trips?${params}`);
      if (res.ok) {
        const json = await res.json();
        setTrips(json.trips);
        setTotal(json.total);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [userId, role, adminUserId, limit]);

  useEffect(() => { void fetchTrips(); }, [fetchTrips]);

  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    in_progress: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-500',
  };

  const statusLabels: Record<string, string> = {
    completed: 'Completado',
    in_progress: 'En curso',
    cancelled: 'Cancelado',
    expired: 'Expirado',
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
        <Navigation className="w-4 h-4 text-[#0EA5A0]" />
        Viajes como {role === 'driver' ? 'conductor' : 'pasajero'} ({total})
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-[#0EA5A0] animate-spin" />
        </div>
      ) : trips.length === 0 ? (
        <p className="text-gray-400 text-xs text-center py-4">Sin viajes registrados</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {trips.map((trip) => (
            <div key={trip.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusColors[trip.status] || 'bg-gray-100 text-gray-500'}`}>
                    {statusLabels[trip.status] || trip.status}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(trip.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-gray-700 font-medium truncate">
                  {trip.originName} → {trip.destName}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                  {role === 'driver' && trip.user && (
                    <span className="truncate">Pasajero: {trip.user.name}</span>
                  )}
                  {role === 'passenger' && trip.driverName && (
                    <span className="truncate">Chofer: {trip.driverName}</span>
                  )}
                  {trip.distance != null && (
                    <span>{trip.distance.toFixed(1)} km</span>
                  )}
                  {trip.duration != null && trip.duration > 0 && (
                    <span>{Math.round(trip.duration / 60)} min</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-gray-900">${trip.fare.toLocaleString('es-AR')}</p>
                {trip.paymentMethod && (
                  <p className="text-[9px] text-gray-400 capitalize">{trip.paymentMethod === 'cash' ? 'Efectivo' : trip.paymentMethod === 'wallet' ? 'Billetera' : trip.paymentMethod}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!showAll && total > 10 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-2 text-center text-xs font-semibold text-[#0EA5A0] hover:underline"
        >
          Ver todos ({total} viajes)
        </button>
      )}
    </div>
  );
}

// ─── User Detail Modal (full-screen document viewer) ─────────────────────────

function UserDetailModal({
  user, loading, onClose, onApprove, onReject, tab, onLightbox,
}: {
  user: AdminUserDetail | null; loading: boolean; onClose: () => void;
  onApprove?: () => void; onReject?: () => void; tab: Tab; onLightbox: (imgSrc: string) => void;
}) {
  const store = useAppStore();
  if (loading) {
    return (
      <div className="fixed inset-0 z-[900] bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-[#0EA5A0] animate-spin" />
          <p className="text-gray-600 text-sm">Cargando documentos...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  const isDriver = user.isDriver;
  const hasDriverDocs = isDriver && (user.licenseFront || user.licenseBack || user.cedulaVerdeAzul || user.cedulaVerdeAzulBack || user.seguroVehiculo);

  return (
    <div className="fixed inset-0 z-[900] bg-black/50 flex items-end sm:items-center justify-center">
      <div className="bg-[#F5F7FA] w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#F5F7FA] z-10 px-5 pt-4 pb-3 border-b border-gray-200/80 flex items-center gap-3">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 active:scale-95 transition-all"><X className="w-5 h-5 text-gray-700" /></button>
          <h2 className="text-lg font-bold text-gray-900 flex-1">Documentos del usuario</h2>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ── User info summary ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              {user.facePhoto ? (
                <img src={user.facePhoto} alt="Foto" className="w-14 h-14 rounded-xl object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onLightbox(user.facePhoto)} />
              ) : (
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold ${isDriver ? 'bg-amber-100 text-amber-600' : 'bg-[#0EA5A0]/10 text-[#0EA5A0]'}`}>{user.name.charAt(0).toUpperCase()}</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-bold text-gray-900 truncate">{user.name}</p>
                  {isDriver && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">Conductor</span>}
                  {user.isSocio && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">Socio</span>}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{user.phone}</p>
                {user.email && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{user.email}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {user.dni && (
                <div className="flex items-center gap-1.5">
                  <IdCard className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-500">DNI:</span><span className="text-gray-900 font-medium">{user.dni}</span>
                </div>
              )}
              {user.birthday && (
                <div className="flex items-center gap-1.5">
                  <Cake className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-900 font-medium">{new Date(user.birthday + 'T12:00:00').toLocaleDateString('es-AR')}</span>
                </div>
              )}
              {user.address && (
                <div className="flex items-center gap-1.5 col-span-2">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-900 font-medium">{user.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Identity Documents (DNI + Face + Selfie) ── */}
          <DocSection title="Documentos de identidad">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <DocPhotoSlot label="Foto cara" src={user.facePhoto} onLightbox={onLightbox} />
              <DocPhotoSlot label="Selfie con DNI" src={user.selfieWithDni} onLightbox={onLightbox} />
              <DocPhotoSlot label="DNI frente" src={user.dniFront} onLightbox={onLightbox} />
              <DocPhotoSlot label="DNI dorso" src={user.dniBack} onLightbox={onLightbox} />
            </div>
          </DocSection>

          {/* ── Expiration date alerts ── */}
          {isDriver && (user.licenseExpiryDate || user.seguroExpiryDate || user.cedulaExpiryDate) && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-red-500" />
                Fechas de vencimiento
              </h3>
              <div className="flex flex-wrap gap-2">
                {expiryBadge(user.licenseExpiryDate, 'Licencia')}
                {expiryBadge(user.seguroExpiryDate, 'Seguro')}
                {expiryBadge(user.cedulaExpiryDate, 'Cédula')}
              </div>
            </div>
          )}

          {/* ── Driver Documents ── */}
          {isDriver && (
            <>
              {/* Vehicle info */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Car className="w-4 h-4 text-amber-500" />Datos del vehículo
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {user.vehicleType && <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Tipo</span><p className="text-gray-900 font-medium">{user.vehicleType}</p></div>}
                  {user.vehicleBrand && <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Marca</span><p className="text-gray-900 font-medium">{user.vehicleBrand}</p></div>}
                  {user.vehicleModel && <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Modelo</span><p className="text-gray-900 font-medium">{user.vehicleModel}</p></div>}
                  {user.vehicleYear && <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Año</span><p className="text-gray-900 font-medium">{user.vehicleYear}</p></div>}
                  {user.vehicleColor && <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Color</span><p className="text-gray-900 font-medium">{user.vehicleColor}</p></div>}
                  {user.vehiclePlate && <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Patente</span><p className="text-gray-900 font-mono font-bold text-sm">{user.vehiclePlate}</p></div>}
                </div>
              </div>

              {/* Driver document photos */}
              <DocSection title="Documentos del conductor">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <DocPhotoSlot label="Licencia frente" src={user.licenseFront} onLightbox={onLightbox} />
                  <DocPhotoSlot label="Licencia dorso" src={user.licenseBack} onLightbox={onLightbox} />
                  <DocPhotoSlot label="Cédula frente" src={user.cedulaVerdeAzul} onLightbox={onLightbox} />
                  <DocPhotoSlot label="Cédula dorso" src={user.cedulaVerdeAzulBack} onLightbox={onLightbox} />
                  <DocPhotoSlot label="Seguro" src={user.seguroVehiculo} onLightbox={onLightbox} />
                </div>
              </DocSection>

              {/* Driver stats */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />Estadísticas
                </h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <StatBlock value={user.averageRating > 0 ? user.averageRating.toFixed(1) : '—'} label="Rating" sub={`${user.ratingCount} reseñas`} />
                  <StatBlock value={String(user.tripCountAsDriver)} label="Viajes chofer" />
                  <StatBlock value={`$${user.totalEarned.toLocaleString('es-AR')}`} label="Ganancia total" />
                </div>
              </div>

              {/* Trip history as driver */}
              <UserTripHistory userId={user.id} role="driver" adminUserId={store.user?.uid || ''} />
            </>
          )}

          {/* Trip history as passenger (for all users) */}
          {!isDriver && user.tripCountAsPassenger > 0 && (
            <UserTripHistory userId={user.id} role="passenger" adminUserId={store.user?.uid || ''} />
          )}

          {/* CBU info */}
          {(user.driverConfig?.cbuNumber || user.driverConfig?.cbuAlias) && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-500" />Datos bancarios
              </h3>
              <div className="space-y-1.5 text-xs">
                {user.driverConfig.cbuHolderName && <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Titular</span><p className="text-gray-900 font-medium">{user.driverConfig.cbuHolderName}</p></div>}
                {user.driverConfig.cbuNumber && <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">CBU/CVU</span><p className="text-gray-900 font-mono">****{user.driverConfig.cbuNumber.slice(-8)}</p></div>}
                {user.driverConfig.cbuAlias && <div><span className="text-gray-400 text-[10px] uppercase tracking-wider">Alias</span><p className="text-gray-900 font-medium">{user.driverConfig.cbuAlias}</p></div>}
              </div>
            </div>
          )}

          {/* ── Missing documents warning ── */}
          {!user.facePhoto && !user.dniFront && !user.dniBack && !hasDriverDocs && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-800 text-sm font-semibold">Sin documentos cargados</p>
                <p className="text-amber-700 text-xs mt-0.5">Este usuario aún no subió ningún documento.</p>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          {(onApprove || onReject) && (
            <div className="flex gap-3 pt-2 pb-4">
              {onReject && tab !== 'verified' && (
                <button onClick={onReject} className="flex-1 h-12 rounded-xl border-2 border-red-200 bg-white text-red-500 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                  <XCircle className="w-5 h-5" />Rechazar
                </button>
              )}
              {onApprove && (
                <button onClick={onApprove} className="flex-1 h-12 rounded-xl bg-[#0EA5A0] text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-[#0EA5A0]/25">
                  <CheckCircle2 className="w-5 h-5" />{isDriver ? 'Aprobar conductor' : 'Aprobar usuario'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Document section wrapper ─────────────────────────────────────────────

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-[#0C8CE9]" />{title}
      </h3>
      {children}
    </div>
  );
}

// ─── Document photo slot (larger, with zoom prompt) ───────────────────────

function DocPhotoSlot({ label, src, onLightbox }: { label: string; src: string; onLightbox: (imgSrc: string) => void }) {
  if (!src) {
    return (
      <div className="aspect-[3/4] rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1">
        <CreditCard className="w-6 h-6 text-gray-300" />
        <p className="text-[10px] text-gray-400 text-center px-1">{label}</p>
        <p className="text-[9px] text-gray-300">Pendiente</p>
      </div>
    );
  }

  return (
    <button onClick={() => onLightbox(src)}
      className="aspect-[3/4] rounded-xl overflow-hidden border-2 border-gray-200 hover:border-[#0EA5A0] transition-colors relative group">
      <img src={src} alt={label} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-0 inset-x-0 p-1.5 text-center">
        <p className="text-[9px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity">{label}</p>
      </div>
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Maximize2 className="w-3.5 h-3.5 text-white drop-shadow-lg" />
      </div>
    </button>
  );
}

// ─── Mini stat block ───────────────────────────────────────────────────────

function StatBlock({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-500 font-medium">{label}</p>
      {sub && <p className="text-[9px] text-gray-400">{sub}</p>}
    </div>
  );
}
