'use client';

import { useState, useEffect } from 'react';
import { X, Cookie, Shield } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'teyevo_cookie_consent';

export function CookiesBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if no consent decision stored
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on load
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = (analytics: boolean) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      accepted: true,
      analytics,
      date: new Date().toISOString(),
    }));
    setVisible(false);
    if (analytics) {
      // Enable analytics tracking
      window.__teyevoAnalytics = true;
    }
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      accepted: false,
      analytics: false,
      date: new Date().toISOString(),
    }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] animate-[slideInUp_0.4s_ease-out] p-3 sm:p-4">
      <div className="max-w-2xl mx-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Cookie className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-900">Tu privacidad importa</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              Usamos cookies esenciales para el funcionamiento de la app. Podemos usar cookies de analisis anonimas para mejorar tu experiencia. No compartimos datos con terceros.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAccept(true)}
                className="px-4 py-2 bg-[#0EA5A0] text-white text-xs font-semibold rounded-xl hover:bg-[#0C8F8A] active:scale-95 transition-all"
              >
                Aceptar todas
              </button>
              <button
                onClick={() => handleAccept(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
              >
                Solo esenciales
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-gray-400 text-xs font-semibold hover:text-gray-600 transition-colors"
              >
                Rechazar
              </button>
            </div>
          </div>
          <button
            onClick={handleReject}
            className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
