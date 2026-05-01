'use client';

import { useState } from 'react';
import { useAppStore, type User } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Sparkles, User as UserIcon, Phone, LogIn } from 'lucide-react';

export function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Quick register fields
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');

  const { setUser, setAuthToken, loadFromServer, showToast } = useAppStore();

  const handleQuickRegister = async () => {
    setError('');
    if (!regName.trim()) {
      setError('Ingresá tu nombre.');
      return;
    }
    if (!regPhone.trim() || regPhone.trim().length < 6) {
      setError('Ingresá tu teléfono.');
      return;
    }

    setLoading(true);

    // Try API register first
    let apiUser: User | null = null;
    let apiToken: string | null = null;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName.trim(), phone: regPhone.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        apiUser = data.user;
        apiToken = data.token;
      }
    } catch {
      // API failed - fall back to local registration
    }

    // Use API user if available, otherwise create local user
    const finalUser: User = apiUser || {
      uid: 'user-' + Date.now(),
      email: '',
      name: regName.trim(),
      phone: regPhone.trim(),
      dni: '',
      avatar: '',
      role: 'passenger',
      isDriverApproved: false,
    };

    setUser(finalUser);
    if (apiToken) setAuthToken(apiToken);

    showToast(`¡Bienvenido/a, ${regName.trim()}!`, 'success');

    // Load previous data from server
    if (finalUser.uid) {
      loadFromServer(finalUser.uid);
    }

    setLoading(false);
  };

  const handleDemo = async () => {
    // Try API register first
    let apiUser: User | null = null;
    let apiToken: string | null = null;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Usuario Demo', phone: '+54 11 5555-0000' }),
      });
      if (res.ok) {
        const data = await res.json();
        apiUser = data.user;
        apiToken = data.token;
      }
    } catch {
      // API failed - fall back to local
    }

    const demoUser: User = apiUser || {
      uid: 'demo',
      email: 'demo@unira.app',
      name: 'Usuario Demo',
      phone: '+54 11 5555-0000',
      dni: '',
      avatar: '',
      role: 'passenger',
      isDriverApproved: true,
    };

    setUser(demoUser);
    if (apiToken) setAuthToken(apiToken);
    showToast('Modo demo activado', 'info');

    // Load previous data from server
    if (demoUser.uid) {
      loadFromServer(demoUser.uid);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0F14] px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Unira</h1>
        <p className="text-[#8B9DAF] text-sm leading-relaxed">
          Tu app de viajes, delivery y pagos en Argentina
        </p>
      </div>

      {/* ── Quick Register ─────────────────────────────────────── */}
      <div className="space-y-4 mb-6">
        <div className="space-y-2">
          <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">Nombre</Label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3D5068]" />
            <Input
              type="text"
              placeholder="Tu nombre completo"
              value={regName}
              onChange={(e) => { setRegName(e.target.value); setError(''); }}
              className="pl-11 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleQuickRegister()}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">Teléfono</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3D5068]" />
            <Input
              type="tel"
              placeholder="+54 11 1234-5678"
              value={regPhone}
              onChange={(e) => { setRegPhone(e.target.value); setError(''); }}
              className="pl-11 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base"
              onKeyDown={(e) => e.key === 'Enter' && handleQuickRegister()}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <Button
          onClick={handleQuickRegister}
          disabled={loading}
          className="w-full h-13 rounded-xl text-white font-semibold text-base transition-all mt-2"
          style={{ background: loading ? undefined : 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              Ingresar a Unira
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>

      {/* ── Divider ───────────────────────────────────────────── */}
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#1E2A38]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#0A0F14] px-3 text-[#3D5068] text-xs">o</span>
        </div>
      </div>

      {/* ── Demo Mode ─────────────────────────────────────────── */}
      <button
        onClick={handleDemo}
        className="w-full p-5 rounded-2xl text-left transition-all active:scale-[0.98] mt-2"
        style={{ background: 'linear-gradient(135deg, rgba(14,165,160,0.12), rgba(12,140,233,0.12))', border: '1.5px solid rgba(14,165,160,0.3)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Modo demo</h2>
            <p className="text-[#8B9DAF] text-xs mt-0.5">
              Explorá la app con datos de ejemplo
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-[#0EA5A0]" />
        </div>
      </button>

      {/* Info */}
      <div className="mt-auto pt-8 text-center">
        <p className="text-[#2A3544] text-xs">Tus datos se guardan localmente en tu dispositivo</p>
        <p className="text-[#2A3544] text-xs mt-1">Unira v2.0 — Cooperativa</p>
      </div>
    </div>
  );
}
