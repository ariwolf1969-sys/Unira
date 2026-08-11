'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Mic,
  Video,
  Square,
  AlertCircle,
  X,
  CheckCircle,
  Loader2,
  Circle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RecordingType = 'audio' | 'video' | null;

interface ActiveRecording {
  type: 'audio' | 'video';
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  startedAt: number;
  blobUrl?: string;
}

// ─── Hook: useTripRecording ──────────────────────────────────────────────────
// Manages the lifecycle of an in-trip recording. Returns the active recording
// state, plus functions to start, stop, and discard.

export function useTripRecording() {
  const [recording, setRecording] = useState<ActiveRecording | null>(null);
  const [error, setError] = useState<string>('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const store = useAppStore();

  // Tick elapsed seconds while recording (no setState in effect body —
  // start/stop handlers reset elapsedSec explicitly to avoid cascading renders)
  useEffect(() => {
    if (!recording) return;
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - recording.startedAt) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const startRecording = useCallback(
    async (type: 'audio' | 'video'): Promise<boolean> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Tu navegador no soporta grabación.');
        return false;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          type === 'audio' ? { audio: true } : { audio: true, video: true }
        );

        const chunks: Blob[] = [];
        const mimeOptions = type === 'audio'
          ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
          : ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'];
        const mimeType = mimeOptions.find((m) => MediaRecorder.isTypeSupported(m)) || '';

        const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType || (type === 'audio' ? 'audio/webm' : 'video/webm') });
          const url = URL.createObjectURL(blob);
          setRecording((prev) => (prev ? { ...prev, blobUrl: url } : null));
          stream.getTracks().forEach((t) => t.stop());
        };
        mediaRecorder.start(1000); // 1s chunks

        // Reset elapsed counter at start (not in effect body — avoids cascading renders)
        setElapsedSec(0);
        setRecording({
          type,
          mediaRecorder,
          stream,
          chunks,
          startedAt: Date.now(),
        });
        setError('');
        return true;
      } catch (err: unknown) {
        const name = (err as { name?: string })?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError('Permiso denegado. Habilitá el acceso desde la configuración del navegador.');
        } else {
          setError('No se pudo iniciar la grabación.');
        }
        return false;
      }
    },
    []
  );

  const stopRecording = useCallback(() => {
    if (!recording) return;
    if (recording.mediaRecorder.state !== 'inactive') {
      recording.mediaRecorder.stop();
    }
    // Stream is stopped in onstop handler
    setRecording(null);
    setElapsedSec(0);
    store.showToast('Grabación finalizada y guardada localmente', 'success');
  }, [recording, store]);

  const discardRecording = useCallback(() => {
    if (!recording) return;
    if (recording.mediaRecorder.state !== 'inactive') {
      recording.mediaRecorder.stop();
    }
    recording.stream.getTracks().forEach((t) => t.stop());
    if (recording.blobUrl) URL.revokeObjectURL(recording.blobUrl);
    setRecording(null);
    setElapsedSec(0);
  }, [recording]);

  return {
    recording,
    elapsedSec,
    error,
    startRecording,
    stopRecording,
    discardRecording,
  };
}

// ─── Recording Consent Modal ─────────────────────────────────────────────────

interface ConsentModalProps {
  open: boolean;
  onClose: () => void;
  onAccept: (type: 'audio' | 'video') => void;
  tripDriverName?: string;
}

/**
 * Modal that appears at the start of a trip asking the user whether
 * they want to enable audio/video recording. Explains consent, retention,
 * and that both parties see the indicator.
 */
export function RecordingConsentModal({ open, onClose, onAccept, tripDriverName }: ConsentModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 max-h-[90dvh] overflow-y-auto hide-scrollbar">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-900">¿Grabar este viaje?</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Por tu seguridad y la del conductor
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="bg-violet-50 rounded-2xl p-3 mb-4">
          <p className="text-xs text-violet-900 leading-relaxed">
            La grabación queda almacenada <strong>30 días</strong> y solo TEYEVO puede accederla, exclusivamente ante un reclamo formal. Ambas partes verán un indicador <strong>«Grabando»</strong> visible durante todo el viaje.
            {tripDriverName && <> El conductor ({tripDriverName}) será notificado al iniciar.</>}
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => onAccept('video')}
            className="w-full p-3 rounded-2xl bg-violet-50 hover:bg-violet-100 transition-colors flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Video className="w-4 h-4 text-violet-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Grabar con video</p>
              <p className="text-[11px] text-gray-500">Cámara frontal + audio</p>
            </div>
          </button>

          <button
            onClick={() => onAccept('audio')}
            className="w-full p-3 rounded-2xl bg-sky-50 hover:bg-sky-100 transition-colors flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
              <Mic className="w-4 h-4 text-sky-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Solo audio</p>
              <p className="text-[11px] text-gray-500">Menos espacio, mismo nivel de respaldo</p>
            </div>
          </button>

          <button
            onClick={onClose}
            className="w-full p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
              <X className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-700">No grabar</p>
              <p className="text-[11px] text-gray-500">El viaje continúa normalmente</p>
            </div>
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mt-4 text-center leading-relaxed">
          Al grabar, aceptás la política de retención de 30 días y el acceso exclusivo por reclamo formal.
        </p>
      </div>
    </div>
  );
}

// ─── Recording Active Indicator (Floating Badge) ─────────────────────────────

interface RecordingIndicatorProps {
  type: 'audio' | 'video';
  elapsedSec: number;
  onStop: () => void;
}

export function RecordingIndicator({ type, elapsedSec, onStop }: RecordingIndicatorProps) {
  const Icon = type === 'video' ? Video : Mic;
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 bg-red-500 text-white rounded-full shadow-lg flex items-center gap-2 px-3 py-1.5 animate-pulse-soft">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
        <Circle className="relative inline-flex rounded-full h-2.5 w-2.5 text-white fill-white" />
      </span>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-bold">{mm}:{ss}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide">Grabando</span>
      <button
        onClick={onStop}
        className="ml-1 w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
        aria-label="Detener grabación"
      >
        <Square className="w-2.5 h-2.5 fill-white" />
      </button>
      <style>{`
        @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
        .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// ─── Recording Stopped Toast Card ────────────────────────────────────────────

interface RecordingSummaryProps {
  type: 'audio' | 'video';
  durationSec: number;
  blobUrl?: string;
  onDiscard: () => void;
}

export function RecordingSummary({ type, durationSec, blobUrl, onDiscard }: RecordingSummaryProps) {
  const Icon = type === 'video' ? Video : Mic;
  const mm = String(Math.floor(durationSec / 60)).padStart(2, '0');
  const ss = String(durationSec % 60).padStart(2, '0');
  return (
    <div className="bg-violet-50 rounded-2xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-violet-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-violet-900">
          Grabación guardada ({mm}:{ss})
        </p>
        <p className="text-[10px] text-violet-700">Se eliminará en 30 días automáticamente</p>
      </div>
      {blobUrl && (
        <a
          href={blobUrl}
          download={`unira-${type}-${Date.now()}.webm`}
          className="px-2 py-1 rounded-lg bg-violet-600 text-white text-[10px] font-semibold hover:bg-violet-700 transition-colors"
        >
          Descargar
        </a>
      )}
      <button
        onClick={onDiscard}
        className="px-2 py-1 rounded-lg bg-white text-violet-700 text-[10px] font-semibold hover:bg-violet-100 transition-colors"
      >
        Descartar
      </button>
    </div>
  );
}
