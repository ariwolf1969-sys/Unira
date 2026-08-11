'use client';

import { useEffect, useRef, useState } from 'react';
import { useRadarAlerts, type RadarAlert } from '@/lib/useRadarAlerts';
import { AlertTriangle, Volume2, VolumeX, X } from 'lucide-react';

interface RadarAlertOverlayProps {
  enabled: boolean;
  alertRadiusM?: number;
}

/**
 * RadarAlertOverlay — Grupo M
 *
 * Mounts invisible (only listens to geolocation + radar data).
 * When a radar is within range, shows a bottom-of-screen alert card with:
 *   - Distance to radar (m)
 *   - Speed limit (if known)
 *   - Radar type icon (fixed/mobile)
 *   - Subtle "beep" sound (Web Audio API, no external assets)
 *
 * The user can mute the sound for the session — the visual alert still shows.
 */
export function RadarAlertOverlay({ enabled, alertRadiusM = 300 }: RadarAlertOverlayProps) {
  const [muted, setMuted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef(0);

  const handleAlert = (alert: RadarAlert) => {
    if (muted) return;
    // Throttle: beep at most once every 5s per new radar approach
    const now = Date.now();
    if (now - lastBeepTimeRef.current < 5000) return;
    lastBeepTimeRef.current = now;
    void playBeep(audioCtxRef);
  };

  const { activeAlert, loading, source } = useRadarAlerts({
    enabled,
    alertRadiusM,
    onAlert: handleAlert,
  });

  // Lazy-init audio context on first user interaction (browser autoplay policy)
  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      if (!audioCtxRef.current) {
        try {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (err) {
          console.warn('AudioContext not supported:', err);
        }
      }
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
    };
    window.addEventListener('click', handler);
    window.addEventListener('touchstart', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
    };
  }, [enabled]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  if (!enabled || loading) return null;

  // Dismissed overlay — show small icon to re-enable
  if (dismissed) {
    return (
      <button
        onClick={() => setDismissed(false)}
        className="fixed top-20 right-4 z-30 w-9 h-9 rounded-full bg-amber-500/20 backdrop-blur-md flex items-center justify-center active:scale-95"
        aria-label="Reactivar alertas de radar"
      >
        <AlertTriangle className="w-4 h-4 text-amber-500" />
      </button>
    );
  }

  if (!activeAlert) {
    // Passive state: show small "radar alerts on" indicator
    return (
      <div className="fixed top-20 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/80 backdrop-blur-md shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="text-[10px] font-semibold text-gray-600">Radares ON</span>
        <button
          onClick={() => setMuted((m) => !m)}
          className="ml-1"
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        >
          {muted ? <VolumeX className="w-3 h-3 text-gray-400" /> : <Volume2 className="w-3 h-3 text-gray-600" />}
        </button>
      </div>
    );
  }

  // Active alert — big card at the bottom
  const { radar, distanceM } = activeAlert;
  return (
    <div className="fixed bottom-24 left-4 right-4 z-40 max-w-md mx-auto">
      <div className="bg-gradient-to-r from-amber-500 to-red-500 rounded-2xl shadow-xl shadow-amber-500/30 p-4 animate-[slideInUp_0.3s_ease-out]">
        <div className="flex items-center gap-3">
          {/* Big icon */}
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 relative">
            <AlertTriangle className="w-7 h-7 text-white" />
            <span className="absolute inset-0 rounded-xl bg-amber-400 animate-ping opacity-30" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-bold text-sm">
                Radar a {Math.round(distanceM)}m
              </p>
              {radar.type === 'mobile' && (
                <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[9px] font-bold">
                  MÓVIL
                </span>
              )}
            </div>
            {radar.street && (
              <p className="text-white/90 text-xs truncate">{radar.street}</p>
            )}
            {radar.maxspeed && (
              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white">
                <span className="text-red-600 font-bold text-xs">MÁX {radar.maxspeed}</span>
              </div>
            )}
          </div>

          {/* Mute + dismiss */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setMuted((m) => !m)}
              className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center"
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            >
              {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Progress bar showing proximity */}
        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-500"
            style={{ width: `${Math.max(10, 100 - (distanceM / alertRadiusM) * 100)}%` }}
          />
        </div>
        {source === 'static' && (
          <p className="text-white/70 text-[10px] mt-2">
            ⚠️ Usando lista estática de radares — Overpass no disponible
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Audio: short double-beep ──────────────────────────────────────────────

async function playBeep(ctxRef: React.MutableRefObject<AudioContext | null>) {
  const ctx = ctxRef.current;
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { return; }
  }

  const now = ctx.currentTime;
  // Two short beeps at 880 Hz, 100ms each, 50ms gap
  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now + i * 0.15);
    gain.gain.setValueAtTime(0, now + i * 0.15);
    gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 0.1);
  }
}
