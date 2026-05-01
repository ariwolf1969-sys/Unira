'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Fingerprint, Delete, Lock, ShieldCheck } from 'lucide-react';

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
          name: 'Unira',
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: 'unira-user',
          displayName: 'Unira User',
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

    if (credential && credential.id) {
      return new Uint8Array(credential.id);
    }
    return null;
  } catch {
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
  } catch {
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
  const [setupStep, setSetupStep] = useState(1);
  const hasAutoTriedBiometric = useRef(false);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check WebAuthn availability
  useEffect(() => {
    isWebAuthnAvailable().then(setHasBiometric);
  }, []);

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

  // Biometric verification function stored in ref for use in effect
  const doBiometricVerify = async () => {
    if (!biometricCredentialId) return;
    setBiometricLoading(true);
    const success = await verifyBiometric(biometricCredentialId);
    setBiometricLoading(false);
    if (success) {
      setIsLocked(false);
    }
  };

  // Auto-try biometric on mount when verifying
  useEffect(() => {
    if (
      mode === 'verify' &&
      biometricEnabled &&
      biometricCredentialId &&
      !hasAutoTriedBiometric.current &&
      hasBiometric
    ) {
      hasAutoTriedBiometric.current = true;
      doBiometricVerify();
    }
  }, [mode, biometricEnabled, biometricCredentialId, hasBiometric]);

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
    if (!biometricCredentialId) return;
    setBiometricLoading(true);
    const success = await verifyBiometric(biometricCredentialId);
    setBiometricLoading(false);
    if (success) {
      setIsLocked(false);
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
        return 'Desbloquear Unira';
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

      {/* Biometric Button */}
      {hasBiometric && !isFirstTime && mode === 'verify' && (
        <button
          onClick={() => { void handleBiometric(); }}
          disabled={biometricLoading || mode === 'locked'}
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
            {biometricLoading ? 'Verificando...' : 'Ingresar con huella'}
          </span>
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
    </div>
  );
}
