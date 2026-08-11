'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  ArrowLeft, Bell, Globe, Moon, Eye, Trash2,
  Shield, LogOut, ChevronRight, Check, Smartphone,
  Volume2, Vibrate, MapPin, Info, Loader2,
  User, Lock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingsState {
  pushNotifications: boolean;
  smsNotifications: boolean;
  emailNotifications: boolean;
  rideAlerts: boolean;
  promoAlerts: boolean;
  soundEffects: boolean;
  vibration: boolean;
  language: string;
  darkMode: boolean;
  showOnlineStatus: boolean;
  shareLiveLocation: boolean;
  highAccuracyGPS: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  pushNotifications: true,
  smsNotifications: true,
  emailNotifications: true,
  rideAlerts: true,
  promoAlerts: false,
  soundEffects: true,
  vibration: true,
  language: 'es',
  darkMode: false,
  showOnlineStatus: true,
  shareLiveLocation: false,
  highAccuracyGPS: true,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const store = useAppStore();
  const { user } = store;

  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>('notifications');

  // ── Load settings from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('unira_settings');
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch { /* use defaults */ }
    setLoading(false);
  }, []);

  // ── Save settings to localStorage ──
  const saveSettings = useCallback((newSettings: SettingsState) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('unira_settings', JSON.stringify(newSettings));
    } catch { /* ignore */ }
  }, []);

  const toggleSetting = useCallback((key: keyof SettingsState) => {
    saveSettings({ ...settings, [key]: !settings[key] });
  }, [settings, saveSettings]);

  const setLanguage = useCallback((lang: string) => {
    saveSettings({ ...settings, language: lang });
  }, [settings, saveSettings]);

  // ── Logout handler ──
  const handleLogout = useCallback(() => {
    store.logout();
    store.showToast('Sesión cerrada correctamente', 'info');
  }, [store]);

  // ── Delete account handler ──
  const handleDeleteAccount = useCallback(async () => {
    setShowConfirmDelete(false);
    store.showToast('Función de baja temporalmente deshabilitada. Contactá soporte.', 'info');
  }, [store]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#0EA5A0]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* ── Header ── */}
      <div className="bg-white sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => store.navigateTo('profile')} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Configuración</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ═══════════════════════════════════════════════════════════════
            PERSONAL DATA SECTION
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => store.setCurrentScreen('profile')}
            className="w-full px-4 py-3 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center">
              <User className="w-5 h-5 text-[#0EA5A0]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900">Datos personales</p>
              <p className="text-xs text-gray-500">Telefono, email, vehiculo, cuenta bancaria</p>
            </div>
            <div className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-500" />
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            NOTIFICATIONS SECTION
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setActiveSection(activeSection === 'notifications' ? null : 'notifications')}
            className="w-full px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[#0EA5A0]" />
              <span className="text-sm font-semibold text-gray-900">Notificaciones</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${activeSection === 'notifications' ? 'rotate-90' : ''}`} />
          </button>

          {activeSection === 'notifications' && (
            <div className="border-t border-gray-50 animate-[fadeIn_0.2s_ease-out]">
              <SettingToggle
                icon={<Smartphone className="w-4 h-4 text-gray-500" />}
                label="Notificaciones push"
                description="Alertas en tu celular"
                value={settings.pushNotifications}
                onToggle={() => toggleSetting('pushNotifications')}
              />
              <SettingToggle
                icon={<Volume2 className="w-4 h-4 text-gray-500" />}
                label="SMS"
                description="Recibir notificaciones por mensaje"
                value={settings.smsNotifications}
                onToggle={() => toggleSetting('smsNotifications')}
              />
              <SettingToggle
                icon={<Info className="w-4 h-4 text-gray-500" />}
                label="Email"
                description="Novedades y resúmenes por email"
                value={settings.emailNotifications}
                onToggle={() => toggleSetting('emailNotifications')}
              />
              <SettingToggle
                icon={<MapPin className="w-4 h-4 text-gray-500" />}
                label="Alertas de viaje"
                description="Cuando un conductor acepta o llega"
                value={settings.rideAlerts}
                onToggle={() => toggleSetting('rideAlerts')}
              />
              <SettingToggle
                icon={<Info className="w-4 h-4 text-gray-500" />}
                label="Promociones"
                description="Descuentos y novedades"
                value={settings.promoAlerts}
                onToggle={() => toggleSetting('promoAlerts')}
              />
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            APP PREFERENCES SECTION
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setActiveSection(activeSection === 'preferences' ? null : 'preferences')}
            className="w-full px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-[#0EA5A0]" />
              <span className="text-sm font-semibold text-gray-900">Preferencias</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${activeSection === 'preferences' ? 'rotate-90' : ''}`} />
          </button>

          {activeSection === 'preferences' && (
            <div className="border-t border-gray-50 animate-[fadeIn_0.2s_ease-out]">
              {/* Language */}
              <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Idioma</p>
                    <p className="text-xs text-gray-500">Idioma de la aplicación</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {['es', 'en'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        settings.language === lang
                          ? 'bg-[#0EA5A0] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {lang === 'es' ? 'Español' : 'English'}
                    </button>
                  ))}
                </div>
              </div>

              <SettingToggle
                icon={<Volume2 className="w-4 h-4 text-gray-500" />}
                label="Efectos de sonido"
                description="Sonidos al recibir solicitudes"
                value={settings.soundEffects}
                onToggle={() => toggleSetting('soundEffects')}
              />
              <SettingToggle
                icon={<Vibrate className="w-4 h-4 text-gray-500" />}
                label="Vibración"
                description="Vibrar al recibir alertas"
                value={settings.vibration}
                onToggle={() => toggleSetting('vibration')}
              />
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            PRIVACY SECTION
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setActiveSection(activeSection === 'privacy' ? null : 'privacy')}
            className="w-full px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-[#0EA5A0]" />
              <span className="text-sm font-semibold text-gray-900">Privacidad</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${activeSection === 'privacy' ? 'rotate-90' : ''}`} />
          </button>

          {activeSection === 'privacy' && (
            <div className="border-t border-gray-50 animate-[fadeIn_0.2s_ease-out]">
              <SettingToggle
                icon={<Eye className="w-4 h-4 text-gray-500" />}
                label="Mostrar estado en línea"
                description="Otros usuarios pueden ver si estás conectado"
                value={settings.showOnlineStatus}
                onToggle={() => toggleSetting('showOnlineStatus')}
              />
              <SettingToggle
                icon={<MapPin className="w-4 h-4 text-gray-500" />}
                label="Compartir ubicación en vivo"
                description="Durante un viaje, compartir ubicación con contactos"
                value={settings.shareLiveLocation}
                onToggle={() => toggleSetting('shareLiveLocation')}
              />
              <SettingToggle
                icon={<MapPin className="w-4 h-4 text-gray-500" />}
                label="GPS de alta precisión"
                description="Mejor ubicación, usa más batería"
                value={settings.highAccuracyGPS}
                onToggle={() => toggleSetting('highAccuracyGPS')}
              />
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            ACCOUNT SECTION
        ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setActiveSection(activeSection === 'account' ? null : 'account')}
            className="w-full px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#0EA5A0]" />
              <span className="text-sm font-semibold text-gray-900">Cuenta</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${activeSection === 'account' ? 'rotate-90' : ''}`} />
          </button>

          {activeSection === 'account' && (
            <div className="border-t border-gray-50 animate-[fadeIn_0.2s_ease-out]">
              {/* Logout */}
              <button
                onClick={() => setShowConfirmLogout(true)}
                className="w-full px-4 py-3.5 flex items-center gap-3 border-b border-gray-50"
              >
                <LogOut className="w-4 h-4 text-gray-500" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">Cerrar sesión</p>
                  <p className="text-xs text-gray-500">Salir de tu cuenta</p>
                </div>
              </button>

              {/* Delete Account */}
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="w-full px-4 py-3.5 flex items-center gap-3"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-red-600">Eliminar cuenta</p>
                  <p className="text-xs text-gray-500">Borrar todos tus datos permanentemente</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* ── App Info ── */}
        <div className="text-center py-4 space-y-1">
          <p className="text-xs text-gray-400">Unira v1.0.0</p>
          <p className="text-xs text-gray-400">Hecho con ❤️ en Argentina</p>
        </div>
      </div>

      {/* ── Confirm Logout Modal ── */}
      {showConfirmLogout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowConfirmLogout(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 animate-[slideUp_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Cerrar sesión</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              ¿Seguro que querés cerrar sesión? Vas a tener que volver a ingresar tu teléfono.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmLogout(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Account Modal ── */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowConfirmDelete(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 animate-[slideUp_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-red-600 text-center mb-2">Eliminar cuenta</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              Esta acción es irreversible. Se borrarán todos tus datos, historial de viajes y configuraciones.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable Toggle Component ──────────────────────────────────────────────

interface SettingToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}

function SettingToggle({ icon, label, description, value, onToggle }: SettingToggleProps) {
  return (
    <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
          <p className="text-xs text-gray-500 truncate">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
          value ? 'bg-[#0EA5A0]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
