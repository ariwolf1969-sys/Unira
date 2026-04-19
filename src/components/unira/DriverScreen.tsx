'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import {
  Power, PowerOff, MapPin, Star, Clock, DollarSign,
  TrendingUp, Car, ChevronRight, Navigation, Bell,
  ArrowLeft, CheckCircle, AlertCircle, Route, Wallet,
  Calendar,
} from 'lucide-react';

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

// ─── Sample Data ─────────────────────────────────────────────────────────────

const sampleEarnings = {
  today: 12500,
  week: 78500,
  trips: 14,
  rating: 4.9,
};

const recentDriverTrips = [
  { id: 'dt-1', from: 'Obelisco', to: 'Puerto Madero', fare: 1850, time: 'Hace 30 min', status: 'completed' },
  { id: 'dt-2', from: 'Palermo Soho', to: 'Recoleta Cemetery', fare: 1200, time: 'Hace 1h', status: 'completed' },
  { id: 'dt-3', from: 'Caminito', to: 'San Telmo Market', fare: 950, time: 'Hace 2h', status: 'completed' },
  { id: 'dt-4', from: 'Teatro Colón', to: 'Abasto Shopping', fare: 1650, time: 'Hace 3h', status: 'completed' },
  { id: 'dt-5', from: 'Estación Retiro', to: 'Dot Baires Shopping', fare: 2100, time: 'Hace 4h', status: 'completed' },
];

const pendingRequests = [
  { id: 'pr-1', passenger: 'María López', from: 'Av. Corrientes 1200', to: 'Av. Santa Fe 3500', fare: 1400, distance: '3.2 km', eta: '8 min' },
  { id: 'pr-2', passenger: 'Carlos Ruiz', from: 'Av. 9 de Julio 800', to: 'Puerto Madero', fare: 1800, distance: '4.1 km', eta: '12 min' },
];

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const weeklyEarnings = [9500, 12000, 8800, 14200, 11000, 15500, 7500];

// ─── Component ───────────────────────────────────────────────────────────────

export function DriverScreen() {
  const { user, setCurrentScreen, showToast, isOnline, setIsOnline, tripVerificationCode, setTripVerificationCode } = useAppStore();
  const [acceptingTrip, setAcceptingTrip] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<typeof pendingRequests[0] | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'trips' | 'earnings'>('overview');

  const userName = user?.name || 'Conductor';

  const handleAcceptTrip = async (tripId: string) => {
    setAcceptingTrip(tripId);
    const code = String(Math.floor(1000 + Math.random() * 9000));
    await new Promise((r) => setTimeout(r, 1000));
    setAcceptingTrip(null);
    const trip = pendingRequests.find(t => t.id === tripId);
    if (trip) {
      setActiveTrip(trip);
      setTripVerificationCode(code);
    }
    showToast('Viaje aceptado! Ingresa el codigo del pasajero', 'success');
  };

  const handleVerifyCode = () => {
    if (codeInput.length === 4 && codeInput === tripVerificationCode) {
      setCodeVerified(true);
      showToast('Codigo verificado! Viaje iniciado', 'success');
    } else if (codeInput.length === 4) {
      setCodeError(true);
      setCodeInput('');
      const inp = document.querySelectorAll('.drv-code');
      if (inp[0]) inp[0].focus();
      setTimeout(() => setCodeError(false), 2000);
    }
  };

  const handleCancelTrip = () => {
    setActiveTrip(null);
    setCodeInput('');
    setCodeVerified(false);
    setTripVerificationCode(null);
    showToast('Viaje cancelado', 'info');
  };

  const handleRejectTrip = (tripId: string) => {
    showToast('Solicitud rechazada', 'info');
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-24">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-b-3xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 pt-12 pb-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentScreen('role')}
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Modo Conductor</h1>
              <p className="text-gray-500 text-xs">{userName}</p>
            </div>
          </div>

          {/* Online/Offline Toggle */}
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all active:scale-95 ${
              isOnline
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isOnline ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
            {isOnline ? 'En línea' : 'Desconectado'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: `$${sampleEarnings.today.toLocaleString('es-AR')}`, label: 'Hoy', icon: DollarSign, color: '#0EA5A0' },
            { value: sampleEarnings.trips.toString(), label: 'Viajes', icon: Car, color: '#F97316' },
            { value: sampleEarnings.rating.toString(), label: 'Rating', icon: Star, color: '#EAB308' },
            { value: `$${sampleEarnings.week.toLocaleString('es-AR')}`, label: 'Semana', icon: TrendingUp, color: '#8B5CF6' },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={idx}
              className="bg-[#F5F7FA] rounded-xl p-3 text-center"
            >
              <stat.icon className="w-4 h-4 mx-auto mb-1" style={{ color: stat.color }} />
              <p className="text-sm font-bold text-gray-900">{stat.value}</p>
              <p className="text-[10px] text-gray-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5">
        <div className="flex bg-white rounded-xl p-1 shadow-sm">
          {(['overview', 'trips', 'earnings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`flex-1 h-10 rounded-lg text-xs font-semibold transition-all ${
                selectedTab === tab
                  ? 'text-white shadow-lg'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              style={selectedTab === tab ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' } : undefined}
            >
              {tab === 'overview' ? 'Inicio' : tab === 'trips' ? 'Viajes' : 'Ganancias'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 space-y-5">
        {selectedTab === 'overview' && (
          <>
            {/* Pending Requests */}
            {isOnline && (
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
                <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#0EA5A0]" />
                  Solicitudes pendientes
                </h2>
                <div className="space-y-3">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="bg-white rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#0EA5A0]/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-[#0EA5A0]">{req.passenger[0]}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{req.passenger}</p>
                            <p className="text-xs text-gray-500">Hace 1 min</p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-[#0EA5A0]">${req.fare}</span>
                      </div>

                      <div className="flex items-start gap-2 mb-3 ml-10">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#0EA5A0]" />
                          <div className="w-0.5 h-6 bg-gray-200" />
                          <div className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div>
                            <p className="text-xs font-medium text-gray-700">{req.from}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-700">{req.to}</p>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-xs text-gray-500">{req.distance}</p>
                          <p className="text-xs text-gray-500">{req.eta}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-10">
                        <button
                          onClick={() => handleRejectTrip(req.id)}
                          className="flex-1 h-10 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all"
                        >
                          Rechazar
                        </button>
                        <button
                          onClick={() => handleAcceptTrip(req.id)}
                          disabled={acceptingTrip === req.id}
                          className="flex-1 h-10 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}
                        >
                          {acceptingTrip === req.id ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                          ) : (
                            'Aceptar'
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Recent Trips */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
              <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Route className="w-4 h-4 text-[#F97316]" />
                Viajes recientes
              </h2>
              <div className="space-y-2.5">
                {recentDriverTrips.slice(0, 3).map((trip) => (
                  <div key={trip.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-[#0EA5A0]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {trip.from} → {trip.to}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{trip.time}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-base font-bold text-gray-900">${trip.fare}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
              <h2 className="text-base font-bold text-gray-900 mb-3">Acciones rápidas</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Navigation, label: 'Navegar', desc: 'GPS en tiempo real', color: '#0EA5A0' },
                  { icon: Wallet, label: 'Ganancias', desc: 'Ver resumen semanal', color: '#22C55E', action: () => setSelectedTab('earnings') },
                  { icon: Star, label: 'Calificaciones', desc: 'Tu rating y reviews', color: '#EAB308' },
                  { icon: Calendar, label: 'Horarios', desc: 'Gestionar disponibilidad', color: '#8B5CF6' },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => action.action?.()}
                    className="bg-white rounded-2xl p-4 shadow-sm text-left hover:shadow-md active:scale-[0.98] transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                      style={{ backgroundColor: action.color + '15' }}>
                      <action.icon className="w-5 h-5" style={{ color: action.color }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}

        {selectedTab === 'trips' && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            <h2 className="text-base font-bold text-gray-900 mb-3">Historial de viajes</h2>
            <div className="space-y-2.5">
              {recentDriverTrips.map((trip) => (
                <div key={trip.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-[#0EA5A0] flex-shrink-0" />
                        <p className="text-sm font-medium text-gray-900 truncate">{trip.from}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#F97316] flex-shrink-0" />
                        <p className="text-sm font-medium text-gray-700 truncate">{trip.to}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{trip.time}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-base font-bold text-[#0EA5A0]">${trip.fare}</p>
                      <div className="flex items-center gap-0.5 justify-end mt-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium text-gray-600">5.0</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {selectedTab === 'earnings' && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="space-y-5">
            {/* Weekly Earnings Chart */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#8B5CF6]" />
                Ganancias semanales
              </h2>
              <div className="flex items-end justify-between h-40 gap-2">
                {weeklyEarnings.map((amount, idx) => {
                  const maxEarning = Math.max(...weeklyEarnings);
                  const height = (amount / maxEarning) * 100;
                  const isToday = idx === new Date().getDay() - 1;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-gray-500">
                        ${(amount / 1000).toFixed(0)}k
                      </span>
                      <div className="w-full rounded-lg transition-all" style={{
                        height: `${height}%`,
                        minHeight: '8px',
                        background: isToday
                          ? 'linear-gradient(180deg, #0EA5A0, #0C8CE9)'
                          : 'linear-gradient(180deg, #E5E7EB, #D1D5DB)',
                      }} />
                      <span className={`text-[10px] font-medium ${isToday ? 'text-[#0EA5A0] font-bold' : 'text-gray-400'}`}>
                        {weekDays[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-[#22C55E]" />
                  <span className="text-xs font-medium text-gray-500">Total semana</span>
                </div>
                <p className="text-xl font-bold text-gray-900">${sampleEarnings.week.toLocaleString('es-AR')}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-xs font-medium text-gray-500">Promedio/día</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  ${(sampleEarnings.week / 7).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Car className="w-4 h-4 text-[#F97316]" />
                  <span className="text-xs font-medium text-gray-500">Viajes semana</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{sampleEarnings.trips}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-[#EAB308]" />
                  <span className="text-xs font-medium text-gray-500">Rating semanal</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{sampleEarnings.rating}</p>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Próximo deposito</p>
                  <p className="text-xs text-gray-500 mt-0.5">Se acredita el lunes</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#0EA5A0]">$78.500</p>
                  <p className="text-xs text-gray-400">CBU •••• 4521</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      {/* Active Trip Verification */}
      {activeTrip && !codeVerified && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-[430px] bg-[#F5F7FA] rounded-t-3xl p-4 pb-6">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-gray-300 mb-1" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-0.5 text-center">Verificar codigo</h2>
            <p className="text-[11px] text-gray-500 text-center mb-3">Pedi el codigo al pasajero</p>
            <div className="bg-white rounded-2xl p-3 mb-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#0EA5A0]/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#0EA5A0]">{activeTrip.passenger[0]}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{activeTrip.passenger}</p>
                  <p className="text-xs text-gray-500">{activeTrip.distance} . {activeTrip.eta}</p>
                </div>
                <span className="text-lg font-bold text-[#0EA5A0]">${activeTrip.fare}</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#0EA5A0]" />
                  <div className="w-0.5 h-4 bg-gray-200" />
                  <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-gray-700">{activeTrip.from}</p>
                  <p className="text-xs text-gray-700">{activeTrip.to}</p>
                </div>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-2 text-center">Ingresa el codigo de 4 digitos</p>
            <div className="flex justify-center gap-2 mb-2 relative">
              {codeError && (
                <p className="absolute -top-6 left-0 right-0 text-center text-xs font-semibold text-red-500 animate-pulse">Codigo incorrecto</p>
              )}
              {[0,1,2,3].map((i) => (
                <input key={i} type="text" inputMode="numeric" maxLength={1} value={codeInput[i] || ''} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v) { const c = codeInput.split(''); c[i] = v[0]; const nc = c.join(''); setCodeInput(nc); const inp = document.querySelectorAll('.drv-code'); if (i < 3 && inp[i+1]) inp[i+1].focus(); } }} onKeyDown={(e) => { if (e.key === 'Backspace') { if (!codeInput[i] && i > 0) { setCodeInput(codeInput.slice(0, i)); const inp = document.querySelectorAll('.drv-code'); if (inp[i-1]) inp[i-1].focus(); } else { const c = codeInput.split(''); c[i] = ''; setCodeInput(c.join('')); } } }} className="drv-code w-12 h-12 rounded-xl text-center text-xl font-bold bg-white border-2 border-gray-200 outline-none focus:border-[#0EA5A0] transition-all" />
              ))}
            </div>
            <p className="text-[10px] text-gray-400 text-center mb-5">Demo: el codigo es {tripVerificationCode || '----'}</p>
            <div className="flex gap-2">
              <button onClick={handleCancelTrip} className="flex-1 h-11 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all">Cancelar</button>
              <button onClick={handleVerifyCode} disabled={codeInput.length < 4} className="flex-1 h-12 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm shadow-lg shadow-[#0EA5A0]/25 active:scale-95 transition-all disabled:opacity-50">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Verified */}
      {activeTrip && codeVerified && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center shadow-xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Viaje iniciado!</h2>
            <p className="text-sm text-gray-500 mb-4">Conduci con seguridad hacia {activeTrip.to}</p>
            <button onClick={() => { setActiveTrip(null); setCodeInput(''); setCodeVerified(false); }} className="w-full h-12 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm shadow-lg shadow-[#0EA5A0]/25 active:scale-95 transition-all">Completar viaje</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
