'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, Users, Car, DollarSign, CheckCircle, XCircle, Camera } from 'lucide-react';

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface Driver {
  id: string;
  name: string;
  dni: string;
  vehicleType: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  status: 'pending' | 'approved' | 'rejected';
  photoColors: string[];
  initials: string;
}

type TabKey = 'pending' | 'approved' | 'rejected';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const initialDrivers: Driver[] = [
  {
    id: 'drv-p1',
    name: 'Gonzalo Andrés Ruiz',
    dni: '34.567.890',
    vehicleType: 'Auto',
    vehicleBrand: 'Volkswagen',
    vehicleModel: 'Gol Trend',
    vehiclePlate: 'AB 123 CD',
    status: 'pending',
    photoColors: ['bg-sky-200', 'bg-sky-300', 'bg-sky-200', 'bg-sky-300'],
    initials: 'GR',
  },
  {
    id: 'drv-p2',
    name: 'Natalia Soledad Fernández',
    dni: '28.456.789',
    vehicleType: 'Moto',
    vehicleBrand: 'Honda',
    vehicleModel: 'CB 250',
    vehiclePlate: 'EF 456 GH',
    status: 'pending',
    photoColors: ['bg-rose-200', 'bg-rose-300', 'bg-rose-200', 'bg-rose-300'],
    initials: 'NF',
  },
  {
    id: 'drv-p3',
    name: 'Martín Ezequiel Torres',
    dni: '40.123.456',
    vehicleType: 'Auto Premium',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Corolla XLi',
    vehiclePlate: 'IJ 789 KL',
    status: 'pending',
    photoColors: ['bg-emerald-200', 'bg-emerald-300', 'bg-emerald-200', 'bg-emerald-300'],
    initials: 'MT',
  },
  {
    id: 'drv-p4',
    name: 'Valentina Belén Gutiérrez',
    dni: '35.678.901',
    vehicleType: 'Moto',
    vehicleBrand: 'Yamaha',
    vehicleModel: 'Factor 150',
    vehiclePlate: 'MN 012 OP',
    status: 'pending',
    photoColors: ['bg-amber-200', 'bg-amber-300', 'bg-amber-200', 'bg-amber-300'],
    initials: 'VG',
  },
  {
    id: 'drv-p5',
    name: 'Facundo Raúl Medina',
    dni: '31.234.567',
    vehicleType: 'Auto',
    vehicleBrand: 'Chevrolet',
    vehicleModel: 'Cruze LTZ',
    vehiclePlate: 'QR 345 ST',
    status: 'pending',
    photoColors: ['bg-violet-200', 'bg-violet-300', 'bg-violet-200', 'bg-violet-300'],
    initials: 'FM',
  },
  {
    id: 'drv-a1',
    name: 'Marcelo Alejandro Gómez',
    dni: '29.876.543',
    vehicleType: 'Auto',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Corolla 1.8',
    vehiclePlate: 'AA 111 BB',
    status: 'approved',
    photoColors: ['bg-teal-200', 'bg-teal-300', 'bg-teal-200', 'bg-teal-300'],
    initials: 'MG',
  },
  {
    id: 'drv-a2',
    name: 'Lucía Mónica Pérez',
    dni: '33.456.123',
    vehicleType: 'Moto',
    vehicleBrand: 'Honda',
    vehicleModel: 'Wave 110',
    vehiclePlate: 'CC 222 DD',
    status: 'approved',
    photoColors: ['bg-pink-200', 'bg-pink-300', 'bg-pink-200', 'bg-pink-300'],
    initials: 'LP',
  },
  {
    id: 'drv-a3',
    name: 'Juan Pablo Martínez',
    dni: '37.654.321',
    vehicleType: 'Auto Premium',
    vehicleBrand: 'BMW',
    vehicleModel: '320i',
    vehiclePlate: 'EE 333 FF',
    status: 'approved',
    photoColors: ['bg-indigo-200', 'bg-indigo-300', 'bg-indigo-200', 'bg-indigo-300'],
    initials: 'JM',
  },
  {
    id: 'drv-r1',
    name: 'Roberto Carlos Sánchez',
    dni: '26.111.222',
    vehicleType: 'Moto',
    vehicleBrand: 'Suzuki',
    vehicleModel: 'GN 125',
    vehiclePlate: 'GG 444 HH',
    status: 'rejected',
    photoColors: ['bg-gray-200', 'bg-gray-300', 'bg-gray-200', 'bg-gray-300'],
    initials: 'RS',
  },
  {
    id: 'drv-r2',
    name: 'Ana Cecilia Torres',
    dni: '30.333.444',
    vehicleType: 'Auto',
    vehicleBrand: 'Renault',
    vehicleModel: 'Kangoo',
    vehiclePlate: 'II 555 JJ',
    status: 'rejected',
    photoColors: ['bg-orange-200', 'bg-orange-300', 'bg-orange-200', 'bg-orange-300'],
    initials: 'AT',
  },
];

// ─── Tab Config ──────────────────────────────────────────────────────────────

interface TabConfig {
  key: TabKey;
  label: string;
  count: number;
}

// ─── Stats Cards ─────────────────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

const mockStats: StatCard[] = [
  { label: 'Choferes registrados', value: '12', icon: Users, gradient: 'from-[#0EA5A0] to-[#0B8A86]' },
  { label: 'Viajes hoy', value: '47', icon: Car, gradient: 'from-orange-400 to-orange-500' },
  { label: 'Ingresos hoy', value: '$285.400', icon: DollarSign, gradient: 'from-emerald-400 to-emerald-500' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminScreen() {
  const { goBack, showToast } = useAppStore();
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');

  const tabs: TabConfig[] = useMemo(
    () => [
      { key: 'pending', label: 'Pendientes', count: drivers.filter((d) => d.status === 'pending').length },
      { key: 'approved', label: 'Aprobados', count: drivers.filter((d) => d.status === 'approved').length },
      { key: 'rejected', label: 'Rechazados', count: drivers.filter((d) => d.status === 'rejected').length },
    ],
    [drivers]
  );

  const filteredDrivers = useMemo(
    () => drivers.filter((d) => d.status === activeTab),
    [drivers, activeTab]
  );

  const handleApprove = (driverId: string) => {
    setDrivers((prev) => prev.filter((d) => d.id !== driverId));
    const driver = drivers.find((d) => d.id === driverId);
    showToast(`${driver?.name} aprobado correctamente`, 'success');
  };

  const handleReject = (driverId: string) => {
    setDrivers((prev) => prev.filter((d) => d.id !== driverId));
    const driver = drivers.find((d) => d.id === driverId);
    showToast(`${driver?.name} rechazado`, 'error');
  };

  const statusBadge = (status: Driver['status']) => {
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">
          <CheckCircle className="w-3 h-3" />
          Aprobado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-500 text-xs font-semibold">
        <XCircle className="w-3 h-3" />
        Rechazado
      </span>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-24">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white px-4 pt-12 pb-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Panel de Administración</h1>
            <p className="text-xs text-gray-500 mt-0.5">Gestión de choferes</p>
          </div>
        </div>
      </motion.div>

      {/* ── Stats Cards ───────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
        className="px-4 mt-4"
      >
        <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-1">
          {mockStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="min-w-[150px] flex-shrink-0 rounded-2xl p-4 shadow-sm overflow-hidden relative"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5`} />
                <div className="relative">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3`}>
                    <Icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <p className="text-lg font-bold text-gray-900 leading-tight">{stat.value}</p>
                  <p className="text-[11px] text-gray-500 mt-1 leading-tight">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Tab Bar ───────────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={2}
        className="bg-white mt-4 px-4 py-3 mx-4 rounded-2xl shadow-sm"
      >
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                activeTab === tab.key
                  ? 'bg-[#0EA5A0] text-white shadow-sm shadow-[#0EA5A0]/20'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              <span
                className={`min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-bold px-1.5 ${
                  activeTab === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Driver List ───────────────────────────────────────────────────── */}
      <div className="px-4 mt-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredDrivers.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Sin choferes {activeTab === 'pending' ? 'pendientes' : activeTab === 'approved' ? 'aprobados' : 'rechazados'}
              </h3>
              <p className="text-sm text-gray-500 max-w-[220px]">
                No hay registros para mostrar en esta categoría
              </p>
            </motion.div>
          ) : (
            filteredDrivers.map((driver, idx) => (
              <motion.div
                key={driver.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="bg-white rounded-2xl p-4 shadow-sm"
              >
                {/* Top section: avatar + info */}
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0EA5A0] to-[#0B8A86] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{driver.initials}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 truncate">
                          {driver.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">DNI: {driver.dni}</p>
                      </div>
                      {activeTab !== 'pending' && statusBadge(driver.status)}
                    </div>

                    {/* Vehicle info */}
                    <div className="flex items-center gap-1.5 mt-2 bg-gray-50 rounded-lg px-3 py-2">
                      <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-[11px] text-gray-600 font-medium">
                        {driver.vehicleType} · {driver.vehicleBrand} {driver.vehicleModel}
                      </span>
                      <span className="text-gray-300 text-[11px]">·</span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {driver.vehiclePlate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Photo thumbnails grid */}
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {driver.photoColors.map((color, photoIdx) => (
                    <div
                      key={photoIdx}
                      className={`aspect-square rounded-xl ${color} flex items-center justify-center`}
                    >
                      <Camera className="w-4 h-4 text-white/60" />
                    </div>
                  ))}
                </div>

                {/* Action buttons (pending only) */}
                {activeTab === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApprove(driver.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0EA5A0] text-white text-xs font-semibold hover:bg-[#0D9490] active:scale-[0.98] transition-all shadow-sm shadow-[#0EA5A0]/20"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleReject(driver.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border-2 border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 active:scale-[0.98] transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Rechazar
                    </button>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
