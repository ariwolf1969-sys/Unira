'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  ArrowLeft,
  User,
  CreditCard,
  MapPin,
  Settings,
  HelpCircle,
  FileText,
  RefreshCw,
  LogOut,
  Star,
  Calendar,
  ChevronRight,
  Shield,
  Fingerprint,
  Lock,
  Download,
  AlertCircle,
  Loader2,
  Car,
  Package,
  Sliders,
  Radio,
  Phone,
  Mail,
  Building2,
  Clock,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

interface MenuItemDef {
  icon: React.ReactNode;
  label: string;
  action: string;
  color: string;
  bg: string;
}

const MENU_ITEMS: MenuItemDef[] = [
  {
    icon: <User className="w-5 h-5" />,
    label: 'Datos personales',
    action: 'personal',
    color: 'text-[#0EA5A0]',
    bg: 'bg-[#0EA5A0]/10',
  },
  {
    icon: <Star className="w-5 h-5" />,
    label: 'Mis reseñas',
    action: 'my-reviews',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    icon: <Radio className="w-5 h-5" />,
    label: 'Simulador de conductor',
    action: 'driver-simulator',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: <CreditCard className="w-5 h-5" />,
    label: 'Métodos de pago',
    action: 'payment',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    icon: <MapPin className="w-5 h-5" />,
    label: 'Direcciones favoritas',
    action: 'favorites',
    color: 'text-[#FF8C42]',
    bg: 'bg-[#FF8C42]/10',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    label: 'Seguridad',
    action: 'security',
    color: 'text-[#0EA5A0]',
    bg: 'bg-[#0EA5A0]/10',
  },
  {
    icon: <Package className="w-5 h-5" />,
    label: 'Objetos perdidos',
    action: 'lost-items',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    icon: <Settings className="w-5 h-5" />,
    label: 'Configuración',
    action: 'settings',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
  {
    icon: <HelpCircle className="w-5 h-5" />,
    label: 'Centro de ayuda',
    action: 'help',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
  },
  {
    icon: <FileText className="w-5 h-5" />,
    label: 'Términos y condiciones',
    action: 'terms',
    color: 'text-gray-500',
    bg: 'bg-gray-100',
  },
];

const FIELD_LABELS: Record<string, string> = {
  phone: 'Telefono',
  email: 'Correo electronico',
  vehicleType: 'Tipo de vehiculo',
  vehiclePlate: 'Patente',
  vehicleBrand: 'Marca',
  vehicleModel: 'Modelo',
  vehicleYear: 'Ano',
  vehicleColor: 'Color',
  cbuNumber: 'CBU/CVU',
  cbuAlias: 'Alias',
  cbuHolderName: 'Titular bancario',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const store = useAppStore();
  const [editing, setEditing] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [formName, setFormName] = useState(store.user?.name || '');
  const [formPhone, setFormPhone] = useState(store.user?.phone || '');
  const [formEmail, setFormEmail] = useState(store.user?.email || '');
  const [formDni, setFormDni] = useState('');
  const [formBirthday, setFormBirthday] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'vehicle' | 'bank'>('personal');
  // Change request states
  const [changeRequesting, setChangeRequesting] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{ id: string; field: string; newValue: string; status: string; createdAt: string }[]>([]);
  // Vehicle form (driver only)
  const [formVehicleType, setFormVehicleType] = useState(store.user?.vehicleType || '');
  const [formVehiclePlate, setFormVehiclePlate] = useState(store.user?.vehiclePlate || '');
  const [formVehicleBrand, setFormVehicleBrand] = useState(store.user?.vehicleBrand || '');
  const [formVehicleModel, setFormVehicleModel] = useState(store.user?.vehicleModel || '');
  const [formVehicleYear, setFormVehicleYear] = useState(store.user?.vehicleYear?.toString() || '');
  const [formVehicleColor, setFormVehicleColor] = useState(store.user?.vehicleColor || '');
  // Bank form (driver only)
  const [formCbuAlias, setFormCbuAlias] = useState('');
  const [formCbuNumber, setFormCbuNumber] = useState('');
  const [formCbuHolder, setFormCbuHolder] = useState('');

  // Check if PWA install is available
  useEffect(() => {
    const check = () => setCanInstall(!!window.__uniraInstallPrompt);
    // Defer to next tick to avoid synchronous setState in effect body
    const id = setTimeout(check, 0);
    const checkInterval = setInterval(check, 1000);
    return () => {
      clearTimeout(id);
      clearInterval(checkInterval);
    };
  }, []);

  // Load profile from server on mount (Grupo B)
  useEffect(() => {
    if (store.user?.uid && store.user.uid !== 'demo') {
      void store.syncProfileFromServer(store.user.uid);
    }
  }, [store.user?.uid]);

  const handleInstallApp = useCallback(async () => {
    const promptEvent = window.__uniraInstallPrompt;
    if (!promptEvent) {
      store.showToast('Para instalar: tocá el menú del navegador y elegí "Agregar a pantalla de inicio"', 'info');
      return;
    }
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      store.showToast('¡App instalada! Buscala en tu pantalla de inicio', 'success');
    }
    window.__uniraInstallPrompt = undefined;
    setCanInstall(false);
  }, [store]);

  // Stats: prefer server-synced userStats (Grupo B), fallback to local count
  const stats = store.userStats;
  const completedTrips = stats?.tripsAsPassenger ?? store.tripHistory.filter((t) => t.status === 'completed' && t.type === 'ride').length;
  const totalSpent = stats?.totalSpent ?? 0;
  const averageRating = stats?.averageRating ?? 0;
  const ratingCount = stats?.ratingCount ?? 0;
  const daysUntilBirthday = stats?.daysUntilBirthday ?? null;
  const isBirthdayToday = daysUntilBirthday === 0;
  const isBirthdaySoon = daysUntilBirthday !== null && daysUntilBirthday > 0 && daysUntilBirthday <= 7;

  // Member since (from user.createdAt if present, else fallback)
  const memberYear = store.user?.uid ? new Date().getFullYear() : new Date().getFullYear();

  // User initial
  const userInitial = useMemo(() => {
    if (!store.user) return 'U';
    return store.user.name.charAt(0).toUpperCase();
  }, [store.user]);

  // Request a data change that requires admin approval
  const requestChange = useCallback(async (field: string, newValue: string, reason?: string) => {
    if (!store.user?.uid || store.user.uid === 'demo') {
      store.showToast('No disponible en modo demo', 'info');
      return;
    }
    setChangeRequesting(true);
    try {
      const res = await fetch('/api/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: store.user.uid, field, newValue, reason }),
      });
      const data = await res.json();
      if (data.ok) {
        store.showToast(data.message || 'Solicitud enviada a la empresa', 'success');
        const changesRes = await fetch(`/api/changes?userId=${store.user.uid}`);
        const changesData = await changesRes.json();
        setPendingChanges(changesData.changes || []);
      } else {
        store.showToast(data.error || 'No se pudo enviar la solicitud', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setChangeRequesting(false);
    }
  }, [store]);

  // Handle menu item click
  const handleMenuClick = useCallback(
    (item: MenuItemDef) => {
      if (item.action === 'personal') {
        setFormName(store.user?.name || '');
        setFormPhone(store.user?.phone || '');
        setFormEmail(store.user?.email || '');
        setFormDni(store.user?.dni || '');
        setFormBirthday(store.user?.birthday || '');
        setFormAddress(store.user?.address || '');
        // Load vehicle data
        setFormVehicleType(store.user?.vehicleType || '');
        setFormVehiclePlate(store.user?.vehiclePlate || '');
        setFormVehicleBrand(store.user?.vehicleBrand || '');
        setFormVehicleModel(store.user?.vehicleModel || '');
        setFormVehicleYear(store.user?.vehicleYear?.toString() || '');
        setFormVehicleColor(store.user?.vehicleColor || '');
        // Load pending changes
        if (store.user?.uid && store.user.uid !== 'demo') {
          fetch(`/api/changes?userId=${store.user.uid}`).then(r => r.json()).then(d => {
            setPendingChanges(d.changes || []);
          }).catch(() => {});
        }
        setActiveTab('personal');
        setEditing(true);
        return;
      }
      if (item.action === 'security') {
        setShowSecurity(true);
        return;
      }
      if (item.action === 'lost-items') {
        store.setCurrentScreen('lost-items');
        return;
      }
      if (item.action === 'help') {
        store.setCurrentScreen('help');
        return;
      }
      if (item.action === 'my-reviews') {
        store.setCurrentScreen('my-reviews');
        return;
      }
      if (item.action === 'driver-simulator') {
        store.setCurrentScreen('driver-simulator');
        return;
      }
      if (item.action === 'driver-config') {
        store.setCurrentScreen('driver-config');
        return;
      }
      if (item.action === 'terms') {
        store.setCurrentScreen('terms');
        return;
      }
      if (item.action === 'payment') {
        store.setCurrentScreen('payment-methods');
        return;
      }
      if (item.action === 'settings') {
        store.setCurrentScreen('settings');
        return;
      }
      const messages: Record<string, string> = {
        favorites: 'Direcciones favoritas próximamente',
      };
      store.showToast(messages[item.action] || 'Próximamente', 'info');
    },
    [store]
  );

  // Save profile changes (uses PATCH /api/users/me for persistence)
  const handleSaveProfile = useCallback(async () => {
    if (!store.user) return;
    if (!formName.trim()) {
      store.showToast('El nombre es obligatorio', 'error');
      return;
    }
    setSavingProfile(true);
    // Update local state immediately for snappy UI
    store.setUser({
      ...store.user,
      name: formName.trim(),
      dni: formDni.trim(),
      birthday: formBirthday.trim(),
      address: formAddress.trim(),
    });
    setEditing(false);
    store.showToast('Guardando...', 'info');
    // Persist to server (fire-and-forget; on success it refreshes stats)
    const ok = await store.updateProfileOnServer({
      name: formName.trim(),
      address: formAddress.trim(),
      birthday: formBirthday.trim(),
    });
    setSavingProfile(false);
    if (ok) {
      store.showToast('Datos guardados', 'success');
    } else {
      store.showToast('No se pudo sincronizar con el servidor. Quedó guardado localmente.', 'info');
    }
  }, [store, formName, formEmail, formDni, formBirthday, formAddress]);

  // Handle logout
  const handleLogout = useCallback(() => {
    store.logout();
    store.showToast('Sesión cerrada', 'info');
  }, [store]);

  // Handle change role
  const handleChangeRole = useCallback(() => {
    store.navigateTo('role');
  }, [store]);

  return (
    <>
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
        <h1 className="text-xl font-bold text-gray-900">Mi cuenta</h1>
      </div>

      {/* Profile Header Card */}
      <div className="px-4 mt-3">
        <div className="bg-gradient-to-br from-[#0EA5A0] to-[#0B8A86] rounded-3xl p-6 shadow-lg shadow-[#0EA5A0]/20">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-2xl font-bold text-[#0EA5A0]">{userInitial}</span>
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">
                {store.user?.name || 'Usuario Demo'}
              </h2>
              <p className="text-white/70 text-sm truncate mt-0.5">
                {store.user?.email || 'demo@unira.app'}
              </p>
              {/* Verification badge */}
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                {store.user?.verificationStatus === 'verified' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold">
                    <Shield className="w-2.5 h-2.5" />
                    Verificado
                  </span>
                ) : store.user?.verificationStatus === 'rejected' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/40 backdrop-blur-sm text-white text-[10px] font-semibold">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Verificación rechazada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/30 backdrop-blur-sm text-white text-[10px] font-semibold">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    En revisión
                  </span>
                )}
                {store.user?.isDriver && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-[10px] font-semibold">
                    <Car className="w-2.5 h-2.5" />
                    {store.user.isDriverApproved ? 'Conductor' : 'Conductor pendiente'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <button onClick={() => store.navigateTo('referral')} className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center"><span className="text-lg">🔗</span></div>
            <div className="flex-1"><p className="font-medium text-gray-800">Invitar amigos</p><p className="text-xs text-gray-500">Gana premios por cada invitacion</p></div>
            <span className="text-gray-400">{'>'}</span>
          </button>
      </div>

      {/* Birthday card (Grupo B) */}
      {(isBirthdayToday || isBirthdaySoon) && (
        <div className="px-4 mt-3">
          <div className={`rounded-2xl p-4 shadow-sm border ${isBirthdayToday ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-transparent' : 'bg-white border-amber-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isBirthdayToday ? 'bg-white/20' : 'bg-amber-100'}`}>
                <Calendar className={`w-5 h-5 ${isBirthdayToday ? 'text-white' : 'text-amber-600'}`} />
              </div>
              <div className="flex-1">
                {isBirthdayToday ? (
                  <>
                    <p className="text-sm font-bold text-white">¡Feliz cumpleaños!</p>
                    <p className="text-xs text-white/80 mt-0.5">Te regalamos $1.000 en tu billetera</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-gray-900">Tu cumpleaños está cerca</p>
                    <p className="text-xs text-gray-500 mt-0.5">Faltan {daysUntilBirthday} días</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#0EA5A0]" />
              </div>
              <span className="text-lg font-bold text-gray-900">{completedTrips}</span>
              <span className="text-[10px] text-gray-500 font-medium text-center">Viajes</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <span className="text-lg font-bold text-gray-900">{averageRating > 0 ? averageRating.toFixed(1) : '—'}</span>
              <span className="text-[10px] text-gray-500 font-medium text-center">{ratingCount > 0 ? `${ratingCount} reseñas` : 'Sin reseñas'}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-sky-500" />
              </div>
              <span className="text-lg font-bold text-gray-900">{memberYear}</span>
              <span className="text-[10px] text-gray-500 font-medium text-center">Miembro</span>
            </div>
          </div>
          {totalSpent > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Total gastado</span>
              <span className="text-sm font-bold text-gray-900">${totalSpent.toLocaleString('es-AR')}</span>
            </div>
          )}
          {store.user?.isDriver && stats?.tripsAsDriver !== undefined && stats.tripsAsDriver > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Viajes como conductor</span>
              <span className="text-sm font-bold text-gray-900">{stats.tripsAsDriver}</span>
            </div>
          )}
          {store.user?.isDriver && stats?.totalEarned !== undefined && stats.totalEarned > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Total ganado</span>
              <span className="text-sm font-bold text-[#0EA5A0]">${stats.totalEarned.toLocaleString('es-AR')}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Driver-only section (Grupo H) ── */}
      {/* Visible siempre que el usuario esté en modo conductor (role === 'driver'),
          sin importar si todavía no fue aprobado como conductor — la configuración
          puede armarse antes de la primera aprobación. */}
      {store.user?.role === 'driver' && (
        <div className="px-4 mt-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2 px-1">Modo conductor</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
            <button
              onClick={() => store.setCurrentScreen('driver-config')}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center flex-shrink-0 text-[#0EA5A0]">
                <Sliders className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">Configuración de conductor</p>
                <p className="text-xs text-gray-500">Modo destino, requisitos, métodos de pago, horarios</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.action}
              onClick={() => handleMenuClick(item)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0 ${item.color}`}>
                {item.icon}
              </div>
              <span className="flex-1 text-sm font-medium text-gray-800">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="px-4 mt-4">
        <div className="border-t border-gray-200" />
      </div>

      {/* Danger Zone */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          {/* Install App (PWA) - shown only if available */}
          {canInstall && (
            <button
              onClick={() => void handleInstallApp()}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center flex-shrink-0 text-[#0EA5A0]">
                <Download className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">Instalar app</p>
                <p className="text-xs text-gray-500">Agregá Unira a tu pantalla de inicio</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          )}

          {/* Change Role */}
          <button
            onClick={handleChangeRole}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 text-violet-600">
              <RefreshCw className="w-5 h-5" />
            </div>
            <span className="flex-1 text-sm font-medium text-gray-800">Cambiar rol</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 active:bg-red-100 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 text-red-500">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="flex-1 text-sm font-medium text-red-500">Cerrar sesión</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      {/* App Version */}
      <div className="px-4 mt-6 text-center">
        <p className="text-xs text-gray-400">TEYEVO v3.0.0 · Diseñada por IA y Ariel Wolf - 11-5597-6414</p>
      </div>
    </div>
      {editing && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-sm bg-[#F5F7FA] rounded-t-3xl p-5 pb-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-center mb-2"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
            <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">Editar datos</h2>
            <p className="text-[10px] text-gray-500 text-center mb-3">Los cambios sensibles requieren aprobacion de la empresa</p>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-200 rounded-xl p-1 mb-4">
              {([
                { id: 'personal' as const, label: 'Personal', icon: <User className="w-3.5 h-3.5" /> },
                ...(store.user?.isDriver ? [
                  { id: 'vehicle' as const, label: 'Vehiculo', icon: <Car className="w-3.5 h-3.5" /> },
                  { id: 'bank' as const, label: 'Banco', icon: <Building2 className="w-3.5 h-3.5" /> },
                ] : []),
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id ? 'bg-white text-[#0EA5A0] shadow-sm' : 'text-gray-500'}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* PERSONAL TAB */}
            {activeTab === 'personal' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Nombre completo</label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Telefono <Lock className="w-3 h-3 text-amber-500" /></label>
                  <div className="flex gap-2">
                    <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="Nuevo telefono" className="flex-1 h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                    <button onClick={() => requestChange('phone', formPhone, 'Cambio de telefono')} disabled={changeRequesting || formPhone === (store.user?.phone || '')} className="h-11 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold active:scale-95 transition-all disabled:opacity-40">
                      {changeRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Solicitar'}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Requiere aprobacion. Actual: {store.user?.phone || '—'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Email <Lock className="w-3 h-3 text-amber-500" /></label>
                  <div className="flex gap-2">
                    <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Nuevo email" className="flex-1 h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                    <button onClick={() => requestChange('email', formEmail, 'Cambio de email')} disabled={changeRequesting || !formEmail.trim() || formEmail === (store.user?.email || '')} className="h-11 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold active:scale-95 transition-all disabled:opacity-40">
                      {changeRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Solicitar'}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Requiere aprobacion. Actual: {store.user?.email || '—'}</p>
                  {store.user?.email && store.user.emailVerifiedAt === null && <p className="text-[10px] text-amber-600 mt-1">Email sin verificar</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">DNI</label>
                  <input type="text" value={formDni} onChange={e => setFormDni(e.target.value)} placeholder="Opcional" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Cumpleanos</label>
                  <input type="date" value={formBirthday} onChange={e => setFormBirthday(e.target.value)} className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0]" />
                  {formBirthday && <p className="text-[10px] text-[#0EA5A0] mt-1">Te regalamos $1.000 en tu cumpleanos</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Direccion</label>
                  <input type="text" value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Calle, numero, ciudad" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                </div>
              </div>
            )}

            {/* VEHICLE TAB (Driver only) */}
            {activeTab === 'vehicle' && (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 leading-relaxed">Los cambios de datos del vehiculo requieren aprobacion de la empresa.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Tipo de vehiculo</label>
                  <input type="text" value={formVehicleType} onChange={e => setFormVehicleType(e.target.value)} placeholder="auto_4_puertas, moto, etc." className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Patente</label>
                  <input type="text" value={formVehiclePlate} onChange={e => setFormVehiclePlate(e.target.value)} placeholder="ABC 123" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Marca</label>
                    <input type="text" value={formVehicleBrand} onChange={e => setFormVehicleBrand(e.target.value)} placeholder="Toyota" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Modelo</label>
                    <input type="text" value={formVehicleModel} onChange={e => setFormVehicleModel(e.target.value)} placeholder="Corolla" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Ano</label>
                    <input type="text" value={formVehicleYear} onChange={e => setFormVehicleYear(e.target.value)} placeholder="2024" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Color</label>
                    <input type="text" value={formVehicleColor} onChange={e => setFormVehicleColor(e.target.value)} placeholder="Blanco" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                  </div>
                </div>
                <button onClick={() => {
                  const fields = [
                    { f: 'vehicleType', v: formVehicleType },
                    { f: 'vehiclePlate', v: formVehiclePlate },
                    { f: 'vehicleBrand', v: formVehicleBrand },
                    { f: 'vehicleModel', v: formVehicleModel },
                    { f: 'vehicleYear', v: formVehicleYear },
                    { f: 'vehicleColor', v: formVehicleColor },
                  ].filter(f => f.v && f.v !== (store.user as Record<string, unknown>)[f.f]);
                  if (fields.length === 0) { store.showToast('No hay cambios', 'info'); return; }
                  Promise.all(fields.map(f => requestChange(f.f, f.v, 'Actualizacion de vehiculo')));
                }} disabled={changeRequesting} className="w-full h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {changeRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" /> Solicitar cambios de vehiculo</>}
                </button>
              </div>
            )}

            {/* BANK TAB (Driver only) */}
            {activeTab === 'bank' && (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 leading-relaxed">Los cambios en datos bancarios requieren aprobacion de la empresa.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Titular de la cuenta</label>
                  <input type="text" value={formCbuHolder} onChange={e => setFormCbuHolder(e.target.value)} placeholder="Nombre del titular" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Alias CBU/CVU</label>
                  <input type="text" value={formCbuAlias} onChange={e => setFormCbuAlias(e.target.value)} placeholder="mi.alias.mp" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">CBU/CVU (22 digitos)</label>
                  <input type="text" value={formCbuNumber} onChange={e => setFormCbuNumber(e.target.value.replace(/\D/g, '').slice(0, 22))} placeholder="0000000000000000000000" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300 tabular-nums" />
                </div>
                <button onClick={() => {
                  const fields = [
                    { f: 'cbuHolderName', v: formCbuHolder },
                    { f: 'cbuAlias', v: formCbuAlias },
                    { f: 'cbuNumber', v: formCbuNumber },
                  ].filter(f => f.v.trim());
                  if (fields.length === 0) { store.showToast('Completa al menos un campo', 'info'); return; }
                  Promise.all(fields.map(f => requestChange(f.f, f.v, 'Actualizacion bancaria')));
                }} disabled={changeRequesting} className="w-full h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {changeRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" /> Solicitar cambios bancarios</>}
                </button>
              </div>
            )}

            {/* Pending changes list */}
            {pendingChanges.length > 0 && (
              <div className="mt-4 bg-sky-50 border border-sky-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-sky-700 mb-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Cambios pendientes</p>
                <div className="space-y-1.5">
                  {pendingChanges.filter(c => c.status === 'pending').map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-gray-900 truncate">{FIELD_LABELS[c.field] || c.field}</p>
                        <p className="text-[10px] text-gray-500 truncate">Nuevo: {c.newValue}</p>
                      </div>
                      <span className="text-[9px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">Pendiente</span>
                    </div>
                  ))}
                  {pendingChanges.filter(c => c.status === 'approved').map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-gray-900 truncate">{FIELD_LABELS[c.field] || c.field}</p>
                        <p className="text-[10px] text-gray-500 truncate">{c.newValue}</p>
                      </div>
                      <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">Aprobado</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditing(false)} disabled={savingProfile} className="flex-1 h-11 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-all disabled:opacity-50">Cerrar</button>
              {activeTab === 'personal' && (
                <button onClick={() => void handleSaveProfile()} disabled={savingProfile} className="flex-1 h-11 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm shadow-lg shadow-[#0EA5A0]/25 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                  {savingProfile ? 'Guardando...' : 'Guardar datos'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {showSecurity && (
        <SecuritySettingsSheet onClose={() => setShowSecurity(false)} />
      )}
    </>
  );
}

// ─── Security Settings Sheet ─────────────────────────────────────────────────

function SecuritySettingsSheet({ onClose }: { onClose: () => void }) {
  const store = useAppStore();
  const [phase, setPhase] = useState<'menu' | 'change_pin_create' | 'change_pin_confirm' | 'verify_for_change' | 'disable_pin_verify'>('menu');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [hasBiometric, setHasBiometric] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setHasBiometric(false);
      return;
    }
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(setHasBiometric).catch(() => setHasBiometric(false));
  }, []);

  const hashPinLocal = async (p: string) => {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(p));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handlePinKey = (key: string) => {
    if (key === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 6) {
      void onPinComplete(next);
    }
  };

  const onPinComplete = async (entered: string) => {
    setError('');
    if (phase === 'verify_for_change') {
      const h = await hashPinLocal(entered);
      if (h === store.pinHash) {
        setPin('');
        setPhase('change_pin_create');
      } else {
        setError('PIN actual incorrecto');
        setTimeout(() => { setPin(''); setError(''); }, 800);
      }
    } else if (phase === 'disable_pin_verify') {
      const h = await hashPinLocal(entered);
      if (h === store.pinHash) {
        // Disable PIN + biometric
        store.setPinHash(null);
        store.setBiometricEnabled(false);
        store.setBiometricCredentialId(null);
        store.setIsLocked(false);
        store.showToast('Bloqueo desactivado', 'info');
        onClose();
      } else {
        setError('PIN incorrecto');
        setTimeout(() => { setPin(''); setError(''); }, 800);
      }
    } else if (phase === 'change_pin_create') {
      setNewPin(entered);
      setPin('');
      setPhase('change_pin_confirm');
    } else if (phase === 'change_pin_confirm') {
      if (entered === newPin) {
        const hash = await hashPinLocal(entered);
        store.setPinHash(hash);
        setPin('');
        setNewPin('');
        store.showToast('PIN cambiado correctamente', 'success');
        onClose();
      } else {
        setError('Los PINs no coinciden');
        setTimeout(() => { setPin(''); setNewPin(''); setPhase('change_pin_create'); setError(''); }, 1000);
      }
    }
  };

  const toggleBiometric = async () => {
    if (!hasBiometric) {
      store.showToast('Tu dispositivo no soporta biometría web', 'error');
      return;
    }
    if (store.biometricEnabled) {
      // Disable
      store.setBiometricEnabled(false);
      store.setBiometricCredentialId(null);
      store.showToast('Huella desactivada', 'info');
      return;
    }
    // Enable: register a new platform authenticator
    setBioBusy(true);
    try {
      const challenge = new Uint8Array(32); crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16); crypto.getRandomValues(userId);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Unira', id: window.location.hostname },
          user: { id: userId, name: 'unira-user', displayName: 'Unira User' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
          attestation: 'none',
        },
      } as PublicKeyCredentialCreationOptions);
      if (cred && cred.id) {
        const bytes = new Uint8Array((cred as PublicKeyCredential).rawId);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const b64 = btoa(bin);
        store.setBiometricCredentialId(b64);
        store.setBiometricEnabled(true);
        store.showToast('Huella activada', 'success');
      }
    } catch {
      store.showToast('No se pudo activar la huella', 'error');
    } finally {
      setBioBusy(false);
    }
  };

  const triggerLockNow = () => {
    store.setIsLocked(true);
    onClose();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (phase !== 'menu') {
    // PIN entry view
    const titles: Record<string, { t: string; s: string }> = {
      verify_for_change: { t: 'Ingresá tu PIN actual', s: 'Para continuar, verificá tu identidad' },
      change_pin_create: { t: 'Nuevo PIN', s: 'Elegí un PIN de 6 dígitos' },
      change_pin_confirm: { t: 'Confirmá el nuevo PIN', s: 'Repetí el PIN de 6 dígitos' },
      disable_pin_verify: { t: 'Verificá tu PIN', s: 'Para desactivar el bloqueo' },
    };
    const meta = titles[phase];
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];
    return (
      <div className="fixed inset-0 z-[999] bg-[#0A0F14] flex flex-col px-6 pt-10 pb-6 select-none">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { setPhase('menu'); setPin(''); setError(''); setNewPin(''); }} className="w-10 h-10 rounded-full bg-[#141B24] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(14,165,160,0.15), rgba(12,140,233,0.15))', border: '1.5px solid rgba(14,165,160,0.3)' }}>
            <Lock className="w-8 h-8 text-[#0EA5A0]" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">{meta.t}</h1>
          <p className="text-[#8B9DAF] text-sm">{meta.s}</p>
        </div>
        <div className="flex items-center justify-center gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-full transition-all"
              style={{ backgroundColor: i < pin.length ? '#0EA5A0' : '#1E2A38', border: `2px solid ${i < pin.length ? '#0EA5A0' : '#2A3544'}` }} />
          ))}
        </div>
        <div className="text-center h-6 mb-2">
          {error && <p className="text-red-400 text-xs font-medium">{error}</p>}
        </div>
        <div className="flex-1 flex items-center">
          <div className="grid grid-cols-3 gap-3 max-w-[300px] mx-auto w-full">
            {keys.map((k, i) => {
              if (k === '') return <div key={`e-${i}`} />;
              const isBack = k === 'back';
              return (
                <button key={k} onClick={() => handlePinKey(k)}
                  className={`h-16 rounded-2xl text-white text-xl font-medium flex items-center justify-center bg-[#141B24] border border-[#1E2A38] active:bg-[#0EA5A0]/20 active:scale-95 transition-all`}>
                  {isBack ? <span className="text-[#8B9DAF] text-xs">←</span> : k}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── Menu view ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-end justify-center">
      <div className="w-full max-w-sm bg-[#F5F7FA] rounded-t-3xl p-5 pb-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center mb-2"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Seguridad</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-90 transition-all">
            <span className="text-gray-500 text-lg">×</span>
          </button>
        </div>

        {/* Status card */}
        <div className="bg-gradient-to-br from-[#0EA5A0] to-[#0B8A86] rounded-2xl p-4 mb-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Protección activa</p>
              <p className="text-white/80 text-xs mt-0.5">
                {store.pinHash ? 'PIN configurado' : 'Sin PIN'} {store.biometricEnabled ? '· Huella activa' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* PIN options */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden mb-4">
          <button onClick={() => { setPin(''); setError(''); setPhase('verify_for_change'); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left">
            <div className="w-9 h-9 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center text-[#0EA5A0]">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Cambiar PIN</p>
              <p className="text-xs text-gray-500">Elegí un nuevo PIN de 6 dígitos</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>

          <button onClick={triggerLockNow}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Bloquear ahora</p>
              <p className="text-xs text-gray-500">Re-bloquea la app inmediatamente</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Biometric */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center text-[#0EA5A0] flex-shrink-0">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">Huella digital / Face ID</p>
              <p className="text-xs text-gray-500">
                {!hasBiometric ? 'No soportado en este dispositivo' : store.biometricEnabled ? 'Activado' : 'Desactivado'}
              </p>
            </div>
            <button
              onClick={() => void toggleBiometric()}
              disabled={!hasBiometric || bioBusy}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 ${store.biometricEnabled ? 'bg-[#0EA5A0]' : 'bg-gray-200'}`}
              aria-label="Toggle biometric"
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${store.biometricEnabled ? 'translate-x-5' : ''}`} />
              {bioBusy && <span className="absolute inset-0 flex items-center justify-center"><span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" /></span>}
            </button>
          </div>
        </div>

        {/* Disable PIN (danger) */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button onClick={() => { setPin(''); setError(''); setPhase('disable_pin_verify'); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 active:bg-red-100 transition-colors text-left">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-500">Desactivar bloqueo</p>
              <p className="text-xs text-gray-500">Quita PIN y huella (no recomendado)</p>
            </div>
            <ChevronRight className="w-4 h-4 text-red-300" />
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4 px-4">
          Unira se bloquea automáticamente al pasar a segundo plano para proteger tu cuenta.
        </p>
      </div>
    </div>
  );
}
