'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Fingerprint, Delete, Lock, ShieldCheck, AlertCircle, LogOut } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function isWebAuthnAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function registerBiometric(): Promise<Uint8Array | null> {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'TEYEVO',
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: 'teyevo-user',
          displayName: 'TEYEVO User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      },
    } as PublicKeyCredentialCreationOptions);

    // ⚠️ CRITICAL FIX: use `rawId` (ArrayBuffer) — NOT `id` (base64url string).
    // Previous code did `new Uint8Array(credential.id)` which treated the
    // base64url string char codes as bytes, producing a wrong credential ID
    // that the browser could never match on verification. This was the root
    // cause of "fingerprint never works".
    if (credential && (credential as PublicKeyCredential).rawId) {
      const rawId = (credential as PublicKeyCredential).rawId;
      return new Uint8Array(rawId);
    }
    return null;
  } catch (err) {
    console.warn('[TEYEVO] registerBiometric failed:', (err as { name?: string })?.name, err);
    return null;
  }
}

async function verifyBiometric(credentialIdBase64: string): Promise<boolean> {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credentialId = base64ToArrayBuffer(credentialIdBase64);

    await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: credentialId,
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    } as PublicKeyCredentialRequestOptions);

    return true;
  } catch (err) {
    // Distinguish NotAllowedError (user cancelled / no user activation) from
    // other failures so we can give better feedback in the UI.
    const name = (err as { name?: string })?.name ?? '';
    console.warn('[TEYEVO] verifyBiometric failed:', name, err);
    return false;
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 5;
const PIN_LENGTH = 6;
const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];

// ─── Component ───────────────────────────────────────────────────────────────

type LockMode = 'setup_create' | 'setup_confirm' | 'verify' | 'locked';

export function LockScreen() {
  const {
    pinHash,
    setPinHash,
    biometricEnabled,
    setBiometricEnabled,
    biometricCredentialId,
    setBiometricCredentialId,
    setIsLocked,
  } = useAppStore();

  const isFirstTime = !pinHash;
  const [mode, setMode] = useState<LockMode>(isFirstTime ? 'setup_create' : 'verify');
  const [pin, setPin] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [dotsError, setDotsError] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState(false);
  const [biometricFailCount, setBiometricFailCount] = useState(0);
  const [showReconfigureSheet, setShowReconfigureSheet] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [showForgotSheet, setShowForgotSheet] = useState(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref to handleBiometric (kept for potential future use; the previous
  // auto-trigger useEffect was removed because WebAuthn requires user
  // activation — see comment below).
  const handleBiometricRef = useRef<() => void>(() => {});
  const { logout, showToast } = useAppStore();

  // Check WebAuthn availability
  useEffect(() => {
    isWebAuthnAvailable().then(setHasBiometric);
  }, []);

  // ── AUTO-TRIGGER DISABLED ────────────────────────────────────────────────
  // WebAuthn REQUIRES a user activation gesture (click, tap, keypress) for
  // `navigator.credentials.get()`. Calling it from a setTimeout in useEffect
  // is treated by browsers as a "no user activation" context and is rejected
  // with NotAllowedError — silently failing every single time the lock screen
  // mounts. The user sees "Huella no reconocida" and thinks fingerprint is
  // broken, when in fact it never had a chance to run.
  //
  // Instead, when biometric is enabled, we show a prominent full-width
  // "Ingresar con huella" button as the primary CTA at the top of the screen,
  // and the PIN pad becomes the secondary fallback.
  //
  // (Original auto-trigger useEffect removed — see git history if needed.)


  // Lockout timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          setMode('verify');
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  // Cleanup shake timer
  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  const triggerShake = () => {
    setShaking(true);
    setDotsError(true);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => {
      setShaking(false);
      setDotsError(false);
      setPin('');
    }, 1000);
  };

  const handleBiometric = async () => {
    if (!biometricCredentialId) {
      showToast('No hay huella registrada. Configurala desde tu perfil después de desbloquear.', 'info');
      return;
    }
    setBiometricLoading(true);
    setBiometricError(false);
    const success = await verifyBiometric(biometricCredentialId);
    setBiometricLoading(false);
    if (success) {
      setIsLocked(false);
      setBiometricFailCount(0);
    } else {
      setBiometricError(true);
      const newFailCount = biometricFailCount + 1;
      setBiometricFailCount(newFailCount);
      if (newFailCount >= 2) {
        showToast('La huella no se reconoce. Si cambiaste de dispositivo, reconfigurala con tu PIN.', 'error');
      } else {
        showToast('No se pudo verificar la huella. Intentá de nuevo o usá tu PIN.', 'error');
      }
    }
  };

  // Keep the ref in sync via effect (can't update ref during render)
  useEffect(() => {
    handleBiometricRef.current = handleBiometric;
  });

  // Re-register biometric (used when stored credentialId is stale, e.g. user
  // cleared browser data or switched devices). Requires PIN entry first as a
  // security check — implemented via a sheet that asks for PIN.
  const handleReconfigureBiometric = async () => {
    setBiometricLoading(true);
    const credId = await registerBiometric();
    setBiometricLoading(false);
    if (credId) {
      const base64Id = arrayBufferToBase64(credId.buffer);
      setBiometricCredentialId(base64Id);
      setBiometricEnabled(true);
      setBiometricError(false);
      setBiometricFailCount(0);
      showToast('Huella reconfigurada. Probá de nuevo.', 'success');
      setShowReconfigureSheet(false);
      // Auto-trigger verify with new credential
      setTimeout(() => { void handleBiometric(); }, 400);
    } else {
      showToast('No se pudo registrar la huella. Verificá que tu dispositivo soporte WebAuthn.', 'error');
    }
  };

  const handleBiometricSetup = async () => {
    if (!hasBiometric) return;
    setBiometricLoading(true);
    const credId = await registerBiometric();
    setBiometricLoading(false);
    if (credId) {
      const base64Id = arrayBufferToBase64(credId.buffer);
      setBiometricCredentialId(base64Id);
      setBiometricEnabled(true);
    }
  };

  const handlePinInput = async (key: string) => {
    if (key === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }

    if (!key || pin.length >= PIN_LENGTH) return;

    const newPin = pin + key;
    setPin(newPin);

    // Auto-verify when 6 digits entered
    if (newPin.length === PIN_LENGTH) {
      if (mode === 'setup_create') {
        setSetupPin(newPin);
        setTimeout(() => {
          setPin('');
          setMode('setup_confirm');
          setSetupStep(2);
        }, 300);
      } else if (mode === 'setup_confirm') {
        if (newPin === setupPin) {
          const hash = await hashPin(newPin);
          setPinHash(hash);
          setPin('');
          setSetupPin('');

          if (hasBiometric) {
            const credId = await registerBiometric();
            if (credId) {
              const base64Id = arrayBufferToBase64(credId.buffer);
              setBiometricCredentialId(base64Id);
              setBiometricEnabled(true);
            }
          }

          setIsLocked(false);
        } else {
          setError('Los PINs no coinciden. Intentá de nuevo.');
          setSetupPin('');
          setTimeout(() => {
            setPin('');
            setMode('setup_create');
            setSetupStep(1);
            setError('');
          }, 1500);
        }
      } else if (mode === 'verify') {
        const hash = await hashPin(newPin);
        if (hash === pinHash) {
          setIsLocked(false);
        } else {
          const newFailed = failedAttempts + 1;
          setFailedAttempts(newFailed);
          triggerShake();

          if (newFailed >= MAX_ATTEMPTS) {
            setTimeout(() => {
              setMode('locked');
              setLockoutRemaining(LOCKOUT_SECONDS);
              setError('');
            }, 1100);
          } else {
            setError(`PIN incorrecto. ${MAX_ATTEMPTS - newFailed} intent${MAX_ATTEMPTS - newFailed === 1 ? 'o' : 'os'} restantes.`);
          }
        }
      }
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'setup_create':
        return 'Creá tu PIN';
      case 'setup_confirm':
        return 'Confirmá tu PIN';
      case 'verify':
        return 'Desbloquear TEYEVO';
      case 'locked':
        return 'Demasiados intentos';
      default:
        return '';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'setup_create':
        return 'Elegí un PIN de 6 dígitos para proteger tu cuenta';
      case 'setup_confirm':
        return 'Ingresá el PIN nuevamente para confirmar';
      case 'verify':
        return 'Ingresá tu PIN de 6 dígitos';
      case 'locked':
        return `Esperá ${lockoutRemaining}s antes de intentar de nuevo`;
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0F14] px-6 pt-12 pb-6 select-none">
      {/* Header */}
      <div className="text-center mb-8">
        {/* Lock Icon */}
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, rgba(14,165,160,0.15), rgba(12,140,233,0.15))', border: '1.5px solid rgba(14,165,160,0.3)' }}>
          {mode === 'locked' ? (
            <Lock className="w-10 h-10 text-[#0EA5A0]" />
          ) : mode === 'setup_create' ? (
            <ShieldCheck className="w-10 h-10 text-[#0EA5A0]" />
          ) : (
            <Fingerprint className="w-10 h-10 text-[#0EA5A0]" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">{getTitle()}</h1>
        <p className="text-[#8B9DAF] text-sm leading-relaxed">{getSubtitle()}</p>
      </div>

      {/* Setup step indicator */}
      {isFirstTime && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`h-1 rounded-full transition-all duration-300 ${setupStep >= 1 ? 'w-10 bg-[#0EA5A0]' : 'w-10 bg-[#1E2A38]'}`} />
          <div className={`h-1 rounded-full transition-all duration-300 ${setupStep >= 2 ? 'w-10 bg-[#0EA5A0]' : 'w-10 bg-[#1E2A38]'}`} />
        </div>
      )}

      {/* ── PRIMARY BIOMETRIC CTA (verify mode only) ──────────────────────────
          When fingerprint is enabled, this is the FIRST thing the user sees.
          WebAuthn requires a user activation gesture, so we cannot auto-trigger
          on mount — the user MUST tap this button. We make it big and obvious. */}
      {hasBiometric && !isFirstTime && mode === 'verify' && biometricEnabled && (
        <div className="mb-6">
          <button
            onClick={() => { void handleBiometric(); }}
            disabled={biometricLoading || mode === 'locked'}
            className={`w-full p-5 rounded-2xl flex flex-col items-center justify-center gap-2
              transition-all active:scale-[0.98] disabled:opacity-40
              ${biometricError
                ? 'bg-red-500/15 border-2 border-red-500/40'
                : 'border-2 border-[#0EA5A0]/40'
              }`}
            style={!biometricError ? { background: 'linear-gradient(135deg, rgba(14,165,160,0.18), rgba(12,140,233,0.18))' } : undefined}
          >
            {biometricLoading ? (
              <div className="w-9 h-9 border-[3px] border-[#0EA5A0]/30 border-t-[#0EA5A0] rounded-full animate-spin" />
            ) : biometricError ? (
              <AlertCircle className="w-9 h-9 text-red-400" />
            ) : (
              <Fingerprint className="w-9 h-9 text-[#0EA5A0]" />
            )}
            <span className={`text-base font-semibold ${biometricError ? 'text-red-400' : 'text-[#0EA5A0]'}`}>
              {biometricLoading ? 'Verificando…' : biometricError ? 'Huella no reconocida — reintentar' : 'Ingresar con huella'}
            </span>
            <span className="text-[#6B7F95] text-xs font-normal">
              Tocá para desbloquear con tu huella
            </span>
          </button>
          {biometricError && (
            <p className="text-center text-[#6B7F95] text-xs mt-2 px-6">
              Si la huella sigue sin funcionar, usá tu PIN de 6 dígitos abajo.
            </p>
          )}
        </div>
      )}

      {/* Divider between biometric and PIN (only when biometric is enabled) */}
      {hasBiometric && !isFirstTime && mode === 'verify' && biometricEnabled && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[#1E2A38]" />
          <span className="text-[#3D5068] text-xs font-medium">O INGRESÁ TU PIN</span>
          <div className="flex-1 h-px bg-[#1E2A38]" />
        </div>
      )}

      {/* PIN Dots */}
      <div className={`flex items-center justify-center gap-3 mb-2 transition-transform ${shaking ? 'animate-[lockShake_0.5s_ease-in-out]' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const isFilled = i < pin.length;
          return (
            <div
              key={i}
              className="w-4 h-4 rounded-full transition-all duration-200"
              style={{
                backgroundColor: dotsError
                  ? '#EF4444'
                  : isFilled
                    ? '#0EA5A0'
                    : '#1E2A38',
                border: dotsError
                  ? '2px solid #EF4444'
                  : isFilled
                    ? '2px solid #0EA5A0'
                    : '2px solid #2A3544',
                transform: isFilled ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          );
        })}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-center mb-4 h-6">
          <p className="text-red-400 text-xs font-medium animate-[fadeIn_0.2s_ease-out]">
            {error}
          </p>
        </div>
      )}

      {/* Number Pad */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-3 gap-3 max-w-[300px] mx-auto w-full">
          {NUMPAD_KEYS.map((key) => {
            if (key === '') {
              return <div key="empty" />;
            }

            const isBackspace = key === 'backspace';

            return (
              <button
                key={key}
                onClick={() => { void handlePinInput(key); }}
                disabled={mode === 'locked' || biometricLoading}
                className={`
                  h-16 rounded-2xl text-white text-xl font-medium
                  flex items-center justify-center
                  transition-all duration-150 active:scale-95
                  disabled:opacity-30 disabled:active:scale-100
                  ${isBackspace
                    ? 'bg-[#141B24] border border-[#1E2A38]'
                    : 'bg-[#141B24] border border-[#1E2A38] active:bg-[#0EA5A0]/20'
                  }
                `}
              >
                {isBackspace ? (
                  <Delete className="w-6 h-6 text-[#8B9DAF]" />
                ) : (
                  key
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary biometric button (only shown when biometric is available
          but NOT yet enabled — i.e. user has a fingerprint scanner but
          hasn't set it up yet. When biometric IS enabled, the primary CTA
          above the PIN pad is used instead.) */}
      {hasBiometric && !isFirstTime && mode === 'verify' && !biometricEnabled && (
        <button
          onClick={() => { void handleBiometric(); }}
          disabled={biometricLoading || mode === 'locked' || !biometricCredentialId}
          className={`w-full mt-6 p-4 rounded-2xl flex items-center justify-center gap-3
            transition-all active:scale-[0.98] disabled:opacity-30
            ${biometricError
              ? 'bg-red-500/10 border border-red-500/30'
              : 'bg-[#141B24] border border-[#1E2A38]'}`}
        >
          {biometricLoading ? (
            <div className="w-5 h-5 border-2 border-[#0EA5A0]/30 border-t-[#0EA5A0] rounded-full animate-spin" />
          ) : biometricError ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : (
            <Fingerprint className="w-5 h-5 text-[#0EA5A0]" />
          )}
          <span className={`text-sm font-medium ${biometricError ? 'text-red-400' : 'text-[#8B9DAF]'}`}>
            {biometricLoading ? 'Verificando...' : biometricError ? 'Huella no reconocida' : 'Ingresar con huella'}
          </span>
        </button>
      )}

      {/* Reconfigure biometric option — shown whenever biometric is enabled
          (in verify mode) so users can recover from a stale credential.
          IMPORTANT: a previous version of the app stored a malformed
          credential ID (used credential.id string bytes instead of rawId).
          Users who registered fingerprint before the fix will NEVER be able
          to verify — they MUST reconfigure. We make this button visible
          from the first failure, not the second. */}
      {hasBiometric && !isFirstTime && mode === 'verify' && biometricEnabled && (biometricError || biometricFailCount >= 1) && (
        <button
          onClick={() => setShowReconfigureSheet(true)}
          disabled={biometricLoading}
          className="w-full mt-3 p-3 rounded-xl flex items-center justify-center gap-2
            bg-amber-500/10 border border-amber-500/30 transition-all active:scale-[0.98]
            disabled:opacity-30"
        >
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 text-xs font-medium">
            Reconfigurar huella (necesario si registraste la huella antes de esta actualización)
          </span>
        </button>
      )}

      {/* Forgot PIN / Logout escape hatch */}
      {!isFirstTime && (
        <button
          onClick={() => setShowForgotSheet(true)}
          className="w-full text-center text-[#3D5068] text-xs font-medium mt-4 hover:text-[#6B7F95] transition-colors"
        >
          ¿Olvidaste tu PIN o querés registrar otra cuenta?
        </button>
      )}

      {/* Biometric setup option (only in first setup step) */}
      {hasBiometric && isFirstTime && mode === 'setup_create' && !biometricEnabled && (
        <button
          onClick={() => { void handleBiometricSetup(); }}
          disabled={biometricLoading}
          className="w-full mt-6 p-4 rounded-2xl flex items-center justify-center gap-3
            bg-[#141B24] border border-[#1E2A38] transition-all active:scale-[0.98]
            disabled:opacity-30"
        >
          {biometricLoading ? (
            <div className="w-5 h-5 border-2 border-[#0EA5A0]/30 border-t-[#0EA5A0] rounded-full animate-spin" />
          ) : (
            <Fingerprint className="w-5 h-5 text-[#0EA5A0]" />
          )}
          <span className="text-[#8B9DAF] text-sm font-medium">
            {biometricLoading ? 'Configurando...' : 'Activar huella digital'}
          </span>
        </button>
      )}

      {/* Biometric enabled indicator */}
      {hasBiometric && isFirstTime && biometricEnabled && (
        <div className="w-full mt-6 p-4 rounded-2xl flex items-center justify-center gap-3
          bg-[#0EA5A0]/10 border border-[#0EA5A0]/20">
          <ShieldCheck className="w-5 h-5 text-[#0EA5A0]" />
          <span className="text-[#0EA5A0] text-sm font-medium">
            Huella digital activada
          </span>
        </div>
      )}

      {/* Lockout overlay */}
      {mode === 'locked' && (
        <div className="absolute inset-0 bg-[#0A0F14]/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <Lock className="w-12 h-12 text-[#3D5068] mx-auto mb-4" />
            <p className="text-[#8B9DAF] text-lg font-semibold mb-2">Bloqueado</p>
            <p className="text-[#3D5068] text-base">
              Intentá de nuevo en <span className="text-white font-bold">{lockoutRemaining}s</span>
            </p>
          </div>
        </div>
      )}

      {/* Forgot PIN / Logout sheet */}
      {showForgotSheet && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-sm bg-[#0F1620] rounded-t-3xl p-5 pb-8 border-t border-[#1E2A38]">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-[#1E2A38]" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white text-base font-bold">¿Olvidaste tu PIN?</h3>
                <p className="text-[#8B9DAF] text-xs mt-0.5">Vas a perder acceso a esta cuenta en este dispositivo.</p>
              </div>
            </div>
            <div className="space-y-2 mb-5 text-[#8B9DAF] text-xs leading-relaxed">
              <p>• Si ya tenés una cuenta verificada en el servidor, vas a poder volver a ingresar con tu teléfono y volver a registrar tu PIN.</p>
              <p>• Si estabas probando con datos de prueba, esto limpia todo y te lleva al registro nuevo.</p>
              <p>• Tu historial de viajes y movimientos de billetera guardados en la nube no se pierden.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForgotSheet(false)}
                className="flex-1 h-12 rounded-xl border border-[#1E2A38] text-[#C8D6E5] font-semibold text-sm active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  logout();
                  setShowForgotSheet(false);
                  showToast('Sesión cerrada. Podés registrar una cuenta nueva.', 'info');
                }}
                className="flex-1 h-12 rounded-xl bg-red-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Salir y registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconfigure biometric sheet */}
      {showReconfigureSheet && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-sm bg-[#0F1620] rounded-t-3xl p-5 pb-8 border-t border-[#1E2A38]">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-[#1E2A38]" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#0EA5A0]/15 flex items-center justify-center">
                <Fingerprint className="w-5 h-5 text-[#0EA5A0]" />
              </div>
              <div className="flex-1">
                <h3 className="text-white text-base font-bold">Reconfigurar huella</h3>
                <p className="text-[#8B9DAF] text-xs mt-0.5">Reemplazá la huella registrada por una nueva.</p>
              </div>
            </div>
            <div className="space-y-2 mb-5 text-[#8B9DAF] text-xs leading-relaxed">
              <p>• Si registraste la huella en una versión anterior de la app, ese registro quedó corrupto y necesita ser recreado.</p>
              <p>• También si cambiaste de dispositivo, reinstalaste el navegador, o la huella actual no se reconoce.</p>
              <p>• Se te pedirá la huella nueva dos veces (una para registrarla, otra para verificarla).</p>
              <p>• Tu PIN sigue siendo válido — la huella es solo un atajo para desbloquear más rápido.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReconfigureSheet(false)}
                disabled={biometricLoading}
                className="flex-1 h-12 rounded-xl border border-[#1E2A38] text-[#C8D6E5] font-semibold text-sm active:scale-95 transition-all disabled:opacity-30"
              >
                Cancelar
              </button>
              <button
                onClick={() => { void handleReconfigureBiometric(); }}
                disabled={biometricLoading}
                className="flex-1 h-12 rounded-xl bg-[#0EA5A0] text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {biometricLoading ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Fingerprint className="w-4 h-4" />
                )}
                {biometricLoading ? 'Registrando...' : 'Registrar huella nueva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
