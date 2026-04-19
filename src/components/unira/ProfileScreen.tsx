'use client';

import { useMemo, useCallback, useState } from 'react';
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

// ─── Component ───────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const store = useAppStore();
  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState(store.user?.name || '');
  const [formPhone, setFormPhone] = useState(store.user?.phone || '');
  const [formEmail, setFormEmail] = useState(store.user?.email || '');
  const [formDni, setFormDni] = useState('');

  // Stats from trip history
  const completedTrips = useMemo(() => {
    return store.tripHistory.filter((t) => t.status === 'completed' && t.type === 'ride').length;
  }, [store.tripHistory]);

  // User initial
  const userInitial = useMemo(() => {
    if (!store.user) return 'U';
    return store.user.name.charAt(0).toUpperCase();
  }, [store.user]);

  // Handle menu item click
  const handleMenuClick = useCallback(
    (item: MenuItemDef) => {
      if (item.action === 'personal') {
        setFormName(store.user?.name || '');
        setFormPhone(store.user?.phone || '');
        setFormEmail(store.user?.email || '');
        setFormDni(store.user?.dni || '');
        setEditing(true);
        return;
      }
      const messages: Record<string, string> = {
        payment: 'Métodos de pago próximamente',
        favorites: 'Direcciones favoritas próximamente',
        settings: 'Configuración próximamente',
        help: 'Centro de ayuda próximamente',
        terms: 'Términos y condiciones próximamente',
      };
      store.showToast(messages[item.action] || 'Próximamente', 'info');
    },
    [store]
  );

  // Handle logout
  const handleLogout = useCallback(() => {
    store.setUser(null);
    store.setCurrentScreen('splash');
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
              <button
                onClick={() => store.showToast('Perfil completo próximamente', 'info')}
                className="mt-1.5 text-xs font-semibold text-white/90 flex items-center gap-1 hover:text-white transition-colors"
              >
                Ver perfil
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex justify-around">
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#0EA5A0]" />
              </div>
              <span className="text-lg font-bold text-gray-900">{completedTrips}</span>
              <span className="text-[10px] text-gray-500 font-medium">Viajes</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <span className="text-lg font-bold text-gray-900">4.8</span>
              <span className="text-[10px] text-gray-500 font-medium">Calificación</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-sky-500" />
              </div>
              <span className="text-lg font-bold text-gray-900">2026</span>
              <span className="text-[10px] text-gray-500 font-medium">Miembro</span>
            </div>
          </div>
        </div>
      </div>

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
        <p className="text-xs text-gray-400">Unira v1.0.0 — Prototipo</p>
      </div>
    </div>
      {editing && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-sm bg-[#F5F7FA] rounded-t-3xl p-5 pb-6">
            <div className="flex justify-center mb-2"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
            <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">Datos personales</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Nombre completo</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Telefono</label>
                <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">DNI</label>
                <input type="text" value={formDni} onChange={e => setFormDni(e.target.value)} placeholder="Opcional" className="w-full h-11 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:border-[#0EA5A0] placeholder:text-gray-300" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditing(false)} className="flex-1 h-11 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-all">Cancelar</button>
              <button onClick={() => { if(store.user && formName.trim()){store.setUser({...store.user, name: formName.trim(), phone: formPhone.trim(), email: formEmail.trim(), dni: formDni.trim()}); setEditing(false); store.showToast('Datos guardados','success');}else{store.showToast('Nombre obligatorio','error');} }} className="flex-1 h-11 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm shadow-lg shadow-[#0EA5A0]/25 active:scale-95 transition-all">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
