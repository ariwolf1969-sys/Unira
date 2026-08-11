'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft, CreditCard, Banknote, Wallet, Plus, Trash2,
  ChevronRight, Shield, Info, CheckCircle, Loader2,
  Building2, QrCode, Smartphone, Copy, ExternalLink,
  Receipt, Clock, ArrowRight,
} from 'lucide-react';

// ─── Cooperative bank data (configure your real CBU/CVU here) ──────────────────
// These are the cooperative's bank details where users send transfers.
// TODO: Replace with real cooperative bank data.
const COOP_BANK = {
  bankName: 'Banco Nación',
  cbu: '0000000000000000000000',         // 22 digits
  cvu: '0000000000000000000000',         // 22 digits
  alias: 'unira.cooperativa.mp',
  holderName: 'Cooperativa UNIRA Ltda.',
  cuit: '00-00000000-0',
  accountType: 'Cuenta corriente',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function PaymentMethodsScreen() {
  const store = useAppStore();
  const { user } = store;

  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpStep, setTopUpStep] = useState<'amount' | 'transfer' | 'confirm'>('amount');
  const [submittingTopUp, setSubmittingTopUp] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [walletBalance, setWalletBalance] = useState(user?.walletBalance ?? 0);
  const [movements, setMovements] = useState<{ type: string; amount: number; description: string; date: string; balance: number }[]>([]);

  // ── Load wallet data ──
  useEffect(() => {
    if (!user?.uid || user.uid === 'demo') {
      setLoading(false);
      return;
    }
    void loadWalletData();
  }, [user?.uid]);

  const loadWalletData = async () => {
    try {
      const res = await fetch(`/api/users/me?userId=${user?.uid}`);
      const data = await res.json();
      if (data.user) {
        setWalletBalance(data.user.walletBalance ?? 0);
      }
      if (data.wallet?.lastMovements) {
        setMovements(data.wallet.lastMovements.map((m: any) => ({
          type: m.type,
          amount: m.amount,
          description: m.description,
          date: m.createdAt,
          balance: m.balance,
        })));
      }
    } catch {
      setWalletBalance(user?.walletBalance ?? 0);
    } finally {
      setLoading(false);
    }
  };

  // ── Copy to clipboard ──
  const copyField = useCallback((label: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(label);
      store.showToast(`${label} copiado`, 'success');
      setTimeout(() => setCopiedField(''), 2000);
    }).catch(() => {
      store.showToast('No se pudo copiar', 'error');
    });
  }, [store]);

  // ── Submit top-up request (creates pending movement) ──
  const handleSubmitTopUp = useCallback(async () => {
    const amount = parseInt(topUpAmount);
    if (!amount || amount < 100) {
      store.showToast('El monto mínimo es $100', 'error');
      return;
    }
    if (amount > 500000) {
      store.showToast('El monto máximo es $500.000', 'error');
      return;
    }

    setSubmittingTopUp(true);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          amount,
          description: `Recarga pendiente - Transferencia de ${formatCurrency(amount)}`,
        }),
      });
      const data = await res.json();
      if (data.balance !== undefined) {
        setWalletBalance(data.balance);
        setTopUpAmount('');
        setTopUpStep('confirm');
        store.showToast('Recarga registrada correctamente', 'success');
        void loadWalletData();
      } else {
        store.showToast(data.error || 'Error en la recarga', 'error');
      }
    } catch {
      store.showToast('Error de conexión', 'error');
    } finally {
      setSubmittingTopUp(false);
    }
  }, [topUpAmount, user?.uid, store, loadWalletData]);

  // ── Reset top-up flow ──
  const resetTopUp = useCallback(() => {
    setShowTopUp(false);
    setTopUpStep('amount');
    setTopUpAmount('');
  }, []);

  // ── Quick amounts ──
  const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

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
        <button
          onClick={() => {
            if (showTopUp) { resetTopUp(); return; }
            store.navigateTo('profile');
          }}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">
          {showTopUp ? 'Recargar billetera' : 'Métodos de pago'}
        </h1>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TOP-UP FLOW (Transferencia bancaria)
      ═══════════════════════════════════════════════════════════════ */}
      {showTopUp && (
        <div className="px-4 pt-4 space-y-4 animate-[fadeIn_0.2s_ease-out]">
          {/* Step 1: Amount */}
          {topUpStep === 'amount' && (
            <>
              <div className="bg-[#0EA5A0]/5 border border-[#0EA5A0]/20 rounded-2xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-[#0EA5A0] mt-0.5 shrink-0" />
                <p className="text-sm text-[#0EA5A0]/80">
                  Las transferencias bancarias en Argentina son <strong>100% gratuitas</strong>.
                  Elegí el monto y te mostramos los datos para transferir.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">¿Cuánto querés recargar?</h3>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setTopUpAmount(String(amt))}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        topUpAmount === String(amt)
                          ? 'bg-[#0EA5A0] text-white shadow-sm'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {formatCurrency(amt)}
                    </button>
                  ))}
                </div>
                <div className="relative mb-3">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                  <input
                    type="number"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="Otro monto"
                    className="w-full pl-8 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-[#0EA5A0]/30 focus:border-[#0EA5A0]"
                  />
                </div>
                <button
                  onClick={() => {
                    if (topUpAmount && parseInt(topUpAmount) >= 100) setTopUpStep('transfer');
                  }}
                  disabled={!topUpAmount || parseInt(topUpAmount) < 100}
                  className="w-full py-3 bg-[#0EA5A0] text-white font-semibold rounded-xl hover:bg-[#0B8A86] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* Step 2: Transfer data */}
          {topUpStep === 'transfer' && (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-[#0EA5A0]/5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-[#0EA5A0]">
                    Transferí {formatCurrency(parseInt(topUpAmount) || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Desde tu home banking, app del banco o billetera virtual
                  </p>
                </div>

                <div className="p-4 space-y-3">
                  <CopyableField
                    label="Alias"
                    value={COOP_BANK.alias}
                    hint="MP: alias@alias"
                    onCopy={copyField}
                    copied={copiedField === 'Alias'}
                  />
                  <CopyableField
                    label="CVU"
                    value={COOP_BANK.cvu}
                    hint="22 dígitos"
                    onCopy={copyField}
                    copied={copiedField === 'CVU'}
                  />
                  <CopyableField
                    label="CBU"
                    value={COOP_BANK.cbu}
                    hint="22 dígitos"
                    onCopy={copyField}
                    copied={copiedField === 'CBU'}
                  />

                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Banco</span>
                      <span className="text-xs text-gray-900 font-medium">{COOP_BANK.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Titular</span>
                      <span className="text-xs text-gray-900 font-medium">{COOP_BANK.holderName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">CUIT</span>
                      <span className="text-xs text-gray-900 font-medium">{COOP_BANK.cuit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Tipo</span>
                      <span className="text-xs text-gray-900 font-medium">{COOP_BANK.accountType}</span>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      En el concepto/motivo de la transferencia poné tu <strong>número de teléfono</strong> para que podamos identificar tu recarga.
                    </p>
                  </div>

                  <button
                    onClick={() => handleSubmitTopUp()}
                    disabled={submittingTopUp}
                    className="w-full py-3 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submittingTopUp ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Ya transferí, confirmar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Confirmation */}
          {topUpStep === 'confirm' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Recarga registrada!</h3>
              <p className="text-sm text-gray-500 mb-1">
                Tu transferencia de <strong>{formatCurrency(parseInt(topUpAmount) || 0)}</strong> fue registrada.
              </p>
              <p className="text-xs text-gray-400 mb-6">
                El saldo se acreditará una vez confirmada la transferencia por un administrador.
              </p>

              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Las transferencias bancarias se acreditan en minutos durante horario bancario</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Podés seguir el estado desde la sección "Actividad"</span>
                </div>
              </div>

              <button
                onClick={resetTopUp}
                className="w-full py-3 bg-[#0EA5A0] text-white font-semibold rounded-xl hover:bg-[#0B8A86] transition-colors"
              >
                Volver a métodos de pago
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MAIN PAYMENT VIEW
      ═══════════════════════════════════════════════════════════════ */}
      {!showTopUp && (
        <div className="px-4 pt-4 space-y-4">

          {/* ── Wallet Card ── */}
          <div className="bg-gradient-to-br from-[#0EA5A0] to-[#0B8A86] rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                <span className="text-sm font-medium opacity-90">Billetera Unira</span>
              </div>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Saldo disponible</span>
            </div>
            <p className="text-3xl font-bold mb-4">{formatCurrency(walletBalance)}</p>
            <button
              onClick={() => { setShowTopUp(true); setTopUpStep('amount'); }}
              className="w-full bg-white text-[#0EA5A0] font-semibold py-2.5 rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Recargar con transferencia
            </button>
          </div>

          {/* ── Payment Methods ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Formas de pago para viajes</h3>
            </div>

            {/* Cash */}
            <div className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-50">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Banknote className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Efectivo</p>
                <p className="text-xs text-gray-500">Pagás al conductor al finalizar el viaje</p>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>

            {/* Wallet */}
            <div className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-50">
              <div className="w-10 h-10 bg-[#0EA5A0]/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#0EA5A0]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Billetera Unira</p>
                <p className="text-xs text-gray-500">Saldo: {formatCurrency(walletBalance)}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>

            {/* Bank Transfer (for direct trip payment, future) */}
            <div className="px-4 py-3.5 flex items-center gap-3 opacity-60">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Transferencia bancaria</p>
                <p className="text-xs text-gray-400">Próximamente como pago directo de viajes</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pronto</span>
            </div>
          </div>

          {/* ── Recent Movements ── */}
          {movements.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => store.setCurrentScreen('wallet')}
                className="w-full px-4 py-3 flex items-center justify-between border-b border-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Últimos movimientos</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              {movements.slice(0, 3).map((m, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm text-gray-900">{m.description}</p>
                    <p className="text-xs text-gray-400">{new Date(m.date).toLocaleDateString('es-AR')}</p>
                  </div>
                  <span className={`text-sm font-semibold ${
                    (m.type === 'topup' || m.type === 'cashback') ? 'text-emerald-600' : 'text-gray-900'
                  }`}>
                    {(m.type === 'topup' || m.type === 'cashback') ? '+' : '-'}{formatCurrency(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Driver: CBU deposit for earnings ── */}
          {user?.isDriver && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Ganancias de conductor</h3>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-[#0EA5A0] mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Tu CBU / CVU para cobrar</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Configurá tu cuenta bancaria en <button onClick={() => store.navigateTo('driver-config')} className="text-[#0EA5A0] font-medium hover:underline">Configuración del conductor</button> para recibir el depósito de tus ganancias.
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700">
                    Las transferencias de ganancias a tu cuenta bancaria son <strong>gratuitas</strong> y se procesan dentro de las 24hs hábiles.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Security Info ── */}
          <div className="flex items-start gap-2 px-1">
            <Shield className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-400 leading-relaxed">
              Unira utiliza transferencias bancarias gratuitas (red CLAP/ATM). Sin comisiones de MercadoPago ni pasarelas de pago externas. Tu dinero va directo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable Copyable Field ────────────────────────────────────────────────

function CopyableField({ label, value, hint, onCopy, copied }: {
  label: string;
  value: string;
  hint: string;
  onCopy: (label: string, value: string) => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label} {hint && <span className="text-gray-400">· {hint}</span>}</p>
        <p className="text-sm text-gray-900 font-mono font-medium truncate">{value}</p>
      </div>
      <button
        onClick={() => onCopy(label, value)}
        className={`p-2 rounded-lg transition-colors shrink-0 ${
          copied ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
