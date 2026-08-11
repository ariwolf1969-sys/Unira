'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';

export function SplashScreen() {
  const [dotIndex, setDotIndex] = useState(0);
  const { navigateTo, user } = useAppStore();

  // 3-dot loading animation
  useEffect(() => {
    const interval = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % 3);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Auto-transition after 2.5s
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user) {
        navigateTo('home');
      } else {
        navigateTo('auth');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [user, navigateTo]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-[#0A0F14] px-6">
      {/* Logo TEYEVO — T como mástil + bandera argentina flameando */}
      <div className="mb-6 relative">
        <div className="w-28 h-28 rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl shadow-teal-500/20">
          <img
            src={`/icon-512.png?v=20260728`}
            alt="TEYEVO"
            width={112}
            height={112}
            className="rounded-2xl"
          />
        </div>
      </div>

      {/* App name with gradient */}
      <h1 className="text-4xl font-extrabold mb-2 bg-clip-text text-transparent tracking-wide"
        style={{ backgroundImage: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
        TEYEVO
      </h1>

      {/* Slogan */}
      <p className="text-white/90 text-sm font-medium italic mb-1 text-center max-w-[280px]">
        Te llevamos lo que desees...
      </p>
      <p className="text-white/90 text-sm font-medium italic mb-3 text-center max-w-[280px]">
        ...donde lo desees
      </p>

      {/* Subtitle */}
      <p className="text-[#8B9DAF] text-xs font-medium tracking-wide mb-10 text-center">
        Tu App de VIAJES, DELIVERY, SERVICIOS y PAGOS en ARGENTINA
      </p>

      {/* Loading dots */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i === dotIndex ? '#0EA5A0' : '#2A3544',
              transform: i === dotIndex ? 'scale(1.3)' : 'scale(1)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
