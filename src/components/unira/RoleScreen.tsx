'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { User, IdCard, ArrowRight, Zap } from 'lucide-react';

export function RoleScreen() {
  const [selected, setSelected] = useState<'passenger' | 'driver' | null>(null);
  const { navigateTo, user, setUser, showToast } = useAppStore();

  const handleContinue = () => {
    if (!selected || !user) return;

    const updatedUser = { ...user, role: selected };
    setUser(updatedUser);
    showToast(
      selected === 'passenger' ? '¡Listo para viajar!' : 'Modo conductor activado',
      'success'
    );
    navigateTo('home');
  };

  const passengerFeatures = [
    { icon: '📍', text: 'Pedí viajes en minutos' },
    { icon: '🛵', text: 'Delivery y envíos' },
    { icon: '💳', text: 'Billetera digital' },
  ];

  const driverFeatures = [
    { icon: '🚗', text: 'Aceptá viajes cercanos' },
    { icon: '📍', text: 'Navegación en tiempo real' },
    { icon: '💰', text: 'Ganancias semanales' },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0F14] px-6 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L8 16V32L24 44L40 32V16L24 4Z" fill="white" fillOpacity="0.9" />
            <path d="M24 14L14 20V28L24 34L34 28V20L24 14Z" fill="white" fillOpacity="0.3" />
            <circle cx="24" cy="24" r="5" fill="white" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          ¿Cómo querés usar Unira?
        </h1>
        <p className="text-[#8B9DAF] text-sm max-w-[280px] mx-auto">
          Elegí tu rol principal. Podés cambiarlo después en ajustes.
        </p>
      </div>

      {/* Role cards */}
      <div className="flex-1 space-y-4">
        {/* Passenger card */}
        <button
          onClick={() => setSelected('passenger')}
          className={`w-full p-5 rounded-2xl border text-left transition-all duration-200 ${
            selected === 'passenger'
              ? 'border-transparent shadow-lg'
              : 'border-[#1E2A38] hover:border-[#2A3A4E]'
          }`}
          style={
            selected === 'passenger'
              ? { background: 'linear-gradient(135deg, rgba(14,165,160,0.15), rgba(12,140,233,0.15))', borderColor: '#0EA5A0' }
              : { background: '#141B24' }
          }
        >
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
              selected === 'passenger'
                ? 'bg-[#0EA5A0]'
                : 'bg-[#1E2A38]'
            }`}>
              <User className={`w-7 h-7 transition-colors ${
                selected === 'passenger' ? 'text-white' : 'text-[#6B7F95]'
              }`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Pasajero</h2>
              <p className="text-[#6B7F95] text-xs">Pedí viajes y delivery</p>
            </div>
            {selected === 'passenger' && (
              <div className="ml-auto w-6 h-6 rounded-full bg-[#0EA5A0] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            {passengerFeatures.map((feat, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-sm">{feat.icon}</span>
                <span className="text-[#6B7F95] text-xs">{feat.text}</span>
              </div>
            ))}
          </div>
        </button>

        {/* Driver card */}
        <button
          onClick={() => setSelected('driver')}
          className={`w-full p-5 rounded-2xl border text-left transition-all duration-200 ${
            selected === 'driver'
              ? 'border-transparent shadow-lg'
              : 'border-[#1E2A38] hover:border-[#2A3A4E]'
          }`}
          style={
            selected === 'driver'
              ? { background: 'linear-gradient(135deg, rgba(14,165,160,0.15), rgba(12,140,233,0.15))', borderColor: '#0EA5A0' }
              : { background: '#141B24' }
          }
        >
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
              selected === 'driver'
                ? 'bg-[#0EA5A0]'
                : 'bg-[#1E2A38]'
            }`}>
              <IdCard className={`w-7 h-7 transition-colors ${
                selected === 'driver' ? 'text-white' : 'text-[#6B7F95]'
              }`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Chofer</h2>
              <p className="text-[#6B7F95] text-xs">Conducí y ganá dinero</p>
            </div>
            {selected === 'driver' && (
              <div className="ml-auto w-6 h-6 rounded-full bg-[#0EA5A0] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            {driverFeatures.map((feat, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-sm">{feat.icon}</span>
                <span className="text-[#6B7F95] text-xs">{feat.text}</span>
              </div>
            ))}
          </div>
        </button>
      </div>

      {/* Continue button */}
      <div className="mt-6 space-y-4">
        <Button
          onClick={handleContinue}
          disabled={!selected}
          className={`w-full h-12 rounded-xl font-semibold text-sm transition-all ${
            selected
              ? 'text-white'
              : 'bg-[#1E2A38] text-[#3D5068] cursor-not-allowed'
          }`}
          style={selected ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' } : undefined}
        >
          Continuar
          <ArrowRight className="w-4 h-4" />
        </Button>

        {/* Demo quick access */}
        <button
          onClick={() => {
            if (!user) return;
            setUser({ ...user, role: 'passenger' });
            showToast('¡Bienvenido a Unira!', 'success');
            navigateTo('home');
          }}
          className="w-full text-center text-[#6B7F95] text-sm font-medium flex items-center justify-center gap-1.5 hover:text-[#0EA5A0] transition-colors py-2"
        >
          <Zap className="w-3.5 h-3.5" />
          Probar modo demo rápido
        </button>
      </div>
    </div>
  );
}
