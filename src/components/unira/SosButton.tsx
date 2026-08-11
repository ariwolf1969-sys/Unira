'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Phone, X, AlertTriangle } from 'lucide-react';

interface SosButtonProps {
  /**
   * If a trip is currently in_progress, pass its id + the driver's last known
   * location. We prefer the driver's location (more accurate for the
   * "conductor se pasó de la raya" use case) and fall back to the passenger's
   * device geolocation.
   */
  activeTripId?: string | null;
  activeTripToken?: string | null;
}

/**
 * SOS button — small red circle with "SOS" white text.
 * Tap → 3-second countdown modal → fires tel:911 + POST /api/sos.
 * The countdown prevents accidental triggers (pocket, stumble).
 */
export function SosButton({ activeTripId, activeTripToken }: SosButtonProps) {
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [firing, setFiring] = useState(false);
  const { user, showToast } = useAppStore();
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref to fireSos so the countdown effect doesn't need it as a dependency.
  // Declared early so it's accessible from the countdown effect.
  const fireSosRef = useRef<() => void>(() => {});

  // Cleanup
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // Countdown logic
  useEffect(() => {
    if (!showCountdown) return;

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          // Use a ref to avoid re-running this effect when fireSos changes
          queueMicrotask(() => { void fireSosRef.current(); });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [showCountdown]);

  const getPassengerLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
      );
    });
  };

  const fireSos = async () => {
    if (firing) return;
    setFiring(true);
    setShowCountdown(false);

    // 1. Get location (passenger device — driver's location would be ideal
    //    but requires fetching from /api/trips/[id]/location which adds latency
    //    we don't want in an emergency).
    const location = await getPassengerLocation();

    // 2. Fire POST /api/sos in background (don't await — tel: must fire ASAP)
    if (user) {
      fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          tripId: activeTripId || null,
          shareToken: activeTripToken || null,
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
        }),
      }).catch(() => {
        // Silent — emergency call already fired
      });
    }

    // 3. Trigger phone dialer to 911
    showToast('Llamando al 911... Mantente en línea.', 'error');

    // Use a short delay so the toast is visible before the OS dialer takes over
    setTimeout(() => {
      window.location.href = 'tel:911';
    }, 600);

    setTimeout(() => setFiring(false), 2000);
  };

  // Keep fireSosRef in sync via effect (can't update ref during render)
  useEffect(() => {
    fireSosRef.current = fireSos;
  });

  const handleTap = () => {
    if (firing) return;
    setCountdown(3);  // reset before opening
    setShowCountdown(true);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setShowCountdown(false);
    setCountdown(3);
    showToast('Alerta SOS cancelada.', 'info');
  };

  return (
    <>
      {/* SOS button — same size as old emergency button (56px), red circle with "SOS" */}
      <div className="fixed bottom-20 right-4 z-40 max-w-[430px]">
        <button
          onClick={handleTap}
          disabled={firing}
          aria-label="Botón SOS — Llamar al 911"
          className="relative w-14 h-14 rounded-full bg-red-500 shadow-lg shadow-red-500/40
                     flex items-center justify-center hover:bg-red-600 active:scale-95
                     transition-all disabled:opacity-50"
        >
          {/* Subtle pulse ring */}
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />

          <span className="relative text-white font-extrabold text-xs tracking-wider">
            SOS
          </span>
        </button>
      </div>

      {/* Countdown modal */}
      {showCountdown && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="bg-[#0F1620] border border-red-500/30 rounded-3xl p-8 max-w-sm w-full text-center">
            {/* Pulsing red icon */}
            <div className="mx-auto w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mb-5 relative">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
              <AlertTriangle className="w-10 h-10 text-red-400 relative" />
            </div>

            <h2 className="text-white text-xl font-bold mb-2">
              Llamando al 911 en...
            </h2>
            <p className="text-[#8B9DAF] text-sm mb-6">
              Se notificará también a la Cooperativa Unira con tu ubicación.
            </p>

            {/* Big countdown number */}
            <div className="text-7xl font-extrabold text-red-400 mb-6 tabular-nums">
              {countdown}
            </div>

            {/* Cancel button — big and obvious */}
            <button
              onClick={cancelCountdown}
              className="w-full h-14 rounded-2xl bg-white text-gray-900 font-bold text-base
                         flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
              Cancelar
            </button>

            <p className="text-[#6B7F95] text-xs mt-4">
              Si es una emergencia real, esperá que se complete la llamada.
            </p>
          </div>
        </div>
      )}

      {/* Firing state — brief overlay while tel: is being triggered */}
      {firing && !showCountdown && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="bg-[#0F1620] border border-red-500/30 rounded-3xl p-8 max-w-sm w-full text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mb-4">
              <Phone className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-white text-xl font-bold mb-2">Conectando con 911...</h2>
            <p className="text-[#8B9DAF] text-sm">
              Si el marcador no se abre automáticamente, llamá al <span className="text-white font-bold">911</span> manualmente.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
