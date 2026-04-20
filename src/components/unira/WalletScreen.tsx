'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAppStore, type WalletMovement } from '@/lib/store';
import { formatCurrency, timeAgo, generateId } from '@/lib/utils';
import {
  ArrowLeft,
  Wallet,
  Send,
  Download,
  CreditCard,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  Utensils,
  Truck,
  Gift,
  Car,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const FILTER_TABS = ['Todos', 'Cargas', 'Viajes', 'Comidas', 'Envíos'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

const QUICK_AMOUNTS = [5000, 10000, 20000];

const MOVEMENT_ICONS: Record<WalletMovement['type'], { icon: React.ReactNode; color: string; bg: string }> = {
  topup: {
    icon: <ArrowUpCircle className="w-5 h-5" />,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  ride: {
    icon: <Car className="w-5 h-5" />,
    color: 'text-[#0EA5A0]',
    bg: 'bg-[#0EA5A0]/10',
  },
  food: {
    icon: <Utensils className="w-5 h-5" />,
    color: 'text-[#FF8C42]',
    bg: 'bg-[#FF8C42]/10',
  },
  send: {
    icon: <Truck className="w-5 h-5" />,
    color: 'text-[#3B82F6]',
    bg: 'bg-[#3B82F6]/10',
  },
  tip: {
    icon: <Gift className="w-5 h-5" />,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  cashback: {
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
};

// ─── Date Grouping Helper ────────────────────────────────────────────────────

function getDateGroup(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDate.getTime() === today.getTime()) return 'Hoy';
  if (itemDate.getTime() === yesterday.getTime()) return 'Ayer';
  return 'Esta semana';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WalletScreen() {
  const store = useAppStore();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('Todos');
  const [showRecargarModal, setShowRecargarModal] = useState(false);
  const [recargaAmount, setRecargaAmount] = useState('');

  // Filter movements
  const filteredMovements = useMemo(() => {
    const typeMap: Record<FilterTab, WalletMovement['type'] | null> = {
      Todos: null,
      Cargas: 'topup',
      Viajes: 'ride',
      Comidas: 'food',
      Envíos: 'send',
    };
    const typeFilter = typeMap[activeFilter];
    if (!typeFilter) return store.walletMovements;
    return store.walletMovements.filter((m) => m.type === typeFilter);
  }, [store.walletMovements, activeFilter]);

  // Group movements by date
  const groupedMovements = useMemo(() => {
    const groups: { label: string; items: WalletMovement[] }[] = [];
    let currentGroup = '';

    filteredMovements.forEach((m) => {
      const group = getDateGroup(m.date);
      if (group !== currentGroup) {
        currentGroup = group;
        groups.push({ label: group, items: [m] });
      } else {
        groups[groups.length - 1].items.push(m);
      }
    });

    return groups;
  }, [filteredMovements]);

  // Handle quick amount select
  const handleQuickAmount = useCallback((amount: number) => {
    setRecargaAmount(amount.toString());
  }, []);

  // Handle confirm recharge
  const handleConfirmRecarga = useCallback(() => {
    const amount = parseInt(recargaAmount, 10);
    if (isNaN(amount) || amount <= 0) return;

    const newBalance = store.walletBalance + amount;
    store.addMovement({
      id: generateId(),
      type: 'topup',
      amount,
      description: `Recarga con tarjeta Visa ****${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date(),
      balance: newBalance,
    });

    store.showToast(`¡Recarga exitosa! +${formatCurrency(amount)}`, 'success');
    setShowRecargarModal(false);
    setRecargaAmount('');
  }, [recargaAmount, store]);

  return (
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
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6 text-[#0EA5A0]" />
          <h1 className="text-xl font-bold text-gray-900">UniraPay</h1>
        </div>
      </div>

      {/* Balance Card */}
      <div className="px-4 mt-3">
        <div className="bg-gradient-to-br from-[#0EA5A0] to-[#0B8A86] rounded-3xl p-6 shadow-lg shadow-[#0EA5A0]/20">
          <p className="text-white/70 text-sm font-medium">Tu saldo</p>
          <p className="text-white text-3xl font-bold mt-1">
            {formatCurrency(store.walletBalance)}
          </p>
          <button
            onClick={() => setShowRecargarModal(true)}
            className="mt-4 px-5 py-2.5 rounded-xl border-2 border-white/40 text-white text-sm font-semibold hover:bg-white/10 active:scale-95 transition-all"
          >
            Recargar
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-5">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex justify-around">
            <button
              onClick={() => store.showToast('Función de enviar dinero próximamente', 'info')}
              className="flex flex-col items-center gap-2 hover:opacity-80 active:scale-95 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0EA5A0]/10 flex items-center justify-center">
                <Send className="w-5 h-5 text-[#0EA5A0]" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Enviar</span>
            </button>
            <button
              onClick={() => store.showToast('Función de recibir dinero próximamente', 'info')}
              className="flex flex-col items-center gap-2 hover:opacity-80 active:scale-95 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <Download className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Recibir</span>
            </button>
            <button
              onClick={() => store.showToast('Función de pagar próximamente', 'info')}
              className="flex flex-col items-center gap-2 hover:opacity-80 active:scale-95 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Pagar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Movimientos Section */}
      <div className="px-4 mt-5">
        <h2 className="text-base font-bold text-gray-900 mb-3">Movimientos</h2>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeFilter === tab
                  ? 'bg-[#0EA5A0] text-white shadow-sm shadow-[#0EA5A0]/25'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Movement List */}
        {groupedMovements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <TrendingDown className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Sin movimientos</p>
            <p className="text-xs text-gray-400 mt-1">No hay movimientos para este filtro</p>
          </div>
        ) : (
          <div className="space-y-4 mt-2 pb-4">
            {groupedMovements.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {group.label}
                </p>
                <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
                  {group.items.map((movement) => {
                    const config = MOVEMENT_ICONS[movement.type] || MOVEMENT_ICONS.ride;
                    const isPositive = movement.amount > 0;

                    return (
                      <div
                        key={movement.id}
                        className="flex items-center gap-3 p-3.5"
                      >
                        <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0 ${config.color}`}>
                          {config.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {movement.description}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {timeAgo(movement.date)}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-bold flex-shrink-0 ${
                            isPositive ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          {isPositive ? '+' : ''}{formatCurrency(movement.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recargar Modal */}
      {showRecargarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowRecargarModal(false);
              setRecargaAmount('');
            }}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-[430px] p-6 animate-[slideUp_0.3s_ease-out]">
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Recargar saldo</h2>
              <button
                onClick={() => {
                  setShowRecargarModal(false);
                  setRecargaAmount('');
                }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 active:scale-90 transition-all"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Monto a recargar
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-semibold">
                  $
                </span>
                <input
                  type="number"
                  value={recargaAmount}
                  onChange={(e) => setRecargaAmount(e.target.value)}
                  placeholder="0"
                  className="w-full pl-9 pr-4 py-3.5 bg-gray-50 rounded-2xl text-xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#0EA5A0]/30 placeholder:text-gray-300"
                  aria-label="Monto a recargar"
                />
              </div>
            </div>

            {/* Quick Select */}
            <div className="flex gap-2 mb-6">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleQuickAmount(amount)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    recargaAmount === amount.toString()
                      ? 'bg-[#0EA5A0] text-white shadow-sm shadow-[#0EA5A0]/25'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirmRecarga}
              disabled={!recargaAmount || parseInt(recargaAmount, 10) <= 0}
              className="w-full py-4 rounded-2xl bg-[#0EA5A0] text-white font-bold text-base shadow-lg shadow-[#0EA5A0]/25 hover:bg-[#0B8A86] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Confirmar recarga
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
