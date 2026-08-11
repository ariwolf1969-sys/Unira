'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Camera,
  Mic,
  MapPin,
  Bell,
  Shield,
  CheckCircle,
  Loader2,
  ChevronRight,
  AlertCircle,
  Lock,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

interface PermissionStep {
  id: 'location' | 'camera' | 'microphone' | 'notifications';
  icon: React.ReactNode;
  title: string;
  description: string;
  required: boolean; // location is required for ride hailing
  color: string;
  bg: string;
  requestAction: () => Promise<PermissionState>;
}

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

// ─── Component ───────────────────────────────────────────────────────────────

export function PermissionsOnboardingScreen() {
  const store = useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [states, setStates] = useState<Record<string, PermissionState>>({
    location: 'prompt',
    camera: 'prompt',
    microphone: 'prompt',
    notifications: 'prompt',
  });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Permission request helpers ────────────────────────────────────────

  const requestLocation = useCallback(async (): Promise<PermissionState> => {
    if (!('permissions' in navigator)) return 'unsupported';
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (result.state === 'prompt') {
        // Actually trigger the prompt by requesting position
        return await new Promise<PermissionState>((resolve) => {
          if (!navigator.geolocation) return resolve('unsupported');
          navigator.geolocation.getCurrentPosition(
            () => resolve('granted'),
            () => resolve('denied'),
            { timeout: 5000 }
          );
        });
      }
      return result.state as PermissionState;
    } catch {
      return 'unsupported';
    }
  }, []);

  const requestCamera = useCallback(async (): Promise<PermissionState> => {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      return 'granted';
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
      return 'unsupported';
    }
  }, []);

  const requestMicrophone = useCallback(async (): Promise<PermissionState> => {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return 'granted';
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
      return 'unsupported';
    }
  }, []);

  const requestNotifications = useCallback(async (): Promise<PermissionState> => {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission();
    return result as PermissionState;
  }, []);

  // ─── Steps config ──────────────────────────────────────────────────────

  const steps: PermissionStep[] = [
    {
      id: 'location',
      icon: <MapPin className="w-7 h-7" />,
      title: 'Ubicación (GPS)',
      description:
        'Necesaria para mostrar tu ubicación en el mapa, buscar conductores cercanos y calcular la ruta del viaje. Es obligatoria para usar Unira.',
      required: true,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      requestAction: requestLocation,
    },
    {
      id: 'camera',
      icon: <Camera className="w-7 h-7" />,
      title: 'Cámara',
      description:
        'Se usa para verificar tu identidad con una selfie al registrarte, y opcionalmente para grabar video durante los viajes (con tu consentimiento explícito cada vez).',
      required: false,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      requestAction: requestCamera,
    },
    {
      id: 'microphone',
      icon: <Mic className="w-7 h-7" />,
      title: 'Micrófono',
      description:
        'Se usa para grabar audio durante los viajes cuando lo activás explícitamente. La grabación es opcional y queda visible para ambas partes con un indicador "Grabando".',
      required: false,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      requestAction: requestMicrophone,
    },
    {
      id: 'notifications',
      icon: <Bell className="w-7 h-7" />,
      title: 'Notificaciones',
      description:
        'Te avisamos cuando el conductor llegó, cuando hay promociones, y cuando recibís respuestas a tus consultas en el centro de ayuda.',
      required: false,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      requestAction: requestNotifications,
    },
  ];

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleRequest = useCallback(async () => {
    const step = steps[currentIndex];
    if (!step) return;
    setBusy(true);
    const result = await step.requestAction();
    setStates((prev) => ({ ...prev, [step.id]: result }));
    setBusy(false);
  }, [currentIndex, steps]);

  const handleSkip = useCallback(() => {
    const step = steps[currentIndex];
    if (step && !step.required) {
      setStates((prev) => ({ ...prev, [step.id]: 'denied' }));
    }
  }, [currentIndex, steps]);

  const handleNext = useCallback(() => {
    if (currentIndex < steps.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, steps.length]);

  const handleFinish = useCallback(async () => {
    if (!store.user) {
      // Local-only mode (demo) — just navigate
      store.setCurrentScreen('home');
      return;
    }
    setSaving(true);
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: store.user.uid,
          cameraConsent: states.camera === 'granted',
          microphoneConsent: states.microphone === 'granted',
          notificationsConsent: states.notifications === 'granted',
          locationConsent: states.location === 'granted',
          permissionsOnboardedAt: 'now',
        }),
      });
      // Update local user state too
      store.setUser({
        ...store.user,
        cameraConsent: states.camera === 'granted',
        microphoneConsent: states.microphone === 'granted',
        notificationsConsent: states.notifications === 'granted',
        locationConsent: states.location === 'granted',
        permissionsOnboardedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[permissions] save failed', err);
    } finally {
      setSaving(false);
      store.setCurrentScreen('home');
      store.showToast('Permisos configurados. ¡Listo para viajar!', 'success');
    }
  }, [store, states]);

  // ─── Render ─────────────────────────────────────────────────────────────

  const step = steps[currentIndex];
  const state = states[step.id];
  const isLast = currentIndex === steps.length - 1;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#0EA5A0] to-[#0C8F8A] flex flex-col">
      {/* Top: Logo + progress */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-lg">
            <Shield className="w-7 h-7 text-[#0EA5A0]" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white text-center">
          Configurá tus permisos
        </h1>
        <p className="text-sm text-white/80 text-center mt-2 px-4">
          Unira necesita algunos permisos para funcionar correctamente. Podés aceptarlos ahora o configurarlos después.
        </p>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${
                i === currentIndex
                  ? 'w-8 bg-white'
                  : i < currentIndex
                  ? 'w-4 bg-white/80'
                  : 'w-4 bg-white/30'
              }`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-white/70 mt-2">
          Paso {currentIndex + 1} de {steps.length}
        </p>
      </div>

      {/* Card */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6 flex flex-col">
        {/* Permission icon + info */}
        <div className="flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-3xl ${step.bg} ${step.color} flex items-center justify-center mb-4`}>
            {step.icon}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
          {step.required && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" />
              Obligatorio
            </span>
          )}
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Status indicator */}
        <div className="mt-6">
          {state === 'granted' && (
            <div className="bg-emerald-50 rounded-2xl p-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <p className="text-sm font-semibold text-emerald-700">Permiso concedido</p>
            </div>
          )}
          {state === 'denied' && (
            <div className="bg-amber-50 rounded-2xl p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700">Permiso denegado</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Podés habilitarlo más tarde desde la configuración del navegador o los ajustes del sistema.
                </p>
              </div>
            </div>
          )}
          {state === 'unsupported' && (
            <div className="bg-gray-50 rounded-2xl p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-600">No disponible en este dispositivo</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Esta función no es compatible con tu navegador. Probá desde un dispositivo móvil.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Spacer pushes actions to bottom */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="space-y-2 pt-4">
          {state !== 'granted' && state !== 'unsupported' && (
            <button
              onClick={handleRequest}
              disabled={busy}
              className="w-full py-3 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm hover:bg-[#0C8F8A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Solicitando...
                </>
              ) : (
                <>Permitir {step.title.toLowerCase()}</>
              )}
            </button>
          )}

          {!step.required && state !== 'granted' && (
            <button
              onClick={() => {
                handleSkip();
                if (isLast) {
                  setTimeout(handleFinish, 100);
                } else {
                  handleNext();
                }
              }}
              disabled={busy}
              className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors"
            >
              Saltar por ahora
            </button>
          )}

          {state === 'granted' && !isLast && (
            <button
              onClick={handleNext}
              className="w-full py-3 rounded-2xl bg-[#0EA5A0] text-white font-semibold text-sm hover:bg-[#0C8F8A] transition-colors flex items-center justify-center gap-2"
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {state === 'unsupported' && !isLast && (
            <button
              onClick={handleNext}
              className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {isLast && (
            <button
              onClick={handleFinish}
              disabled={saving || (step.required && state !== 'granted' && state !== 'unsupported')}
              className="w-full py-3 rounded-2xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Finalizar configuración
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
