'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';

export function SplashScreen() {
  const [dotIndex, setDotIndex] = useState(0);
  const { navigateTo, isFirebaseReady, user } = useAppStore();

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
      } else if (!isFirebaseReady && !localStorage.getItem('unira_firebase_config')) {
        navigateTo('setup');
      } else {
        navigateTo('auth');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [user, isFirebaseReady, navigateTo]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-[#0A0F14] px-6">
      {/* Logo */}
      <div className="mb-6 relative">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L8 16V32L24 44L40 32V16L24 4Z" fill="white" fillOpacity="0.9" />
            <path d="M24 14L14 20V28L24 34L34 28V20L24 14Z" fill="white" fillOpacity="0.3" />
            <circle cx="24" cy="24" r="5" fill="white" />
          </svg>
        </div>
      </div>

      {/* App name with gradient */}
      <h1 className="text-4xl font-extrabold mb-3 bg-clip-text text-transparent"
        style={{ backgroundImage: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
        Unira
      </h1>

      {/* Subtitle */}
      <p className="text-[#8B9DAF] text-base font-medium tracking-wide mb-10">
        Viajes y más por Argentina
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
