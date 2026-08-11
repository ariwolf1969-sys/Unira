'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Phone, Mail, CheckCircle2, Loader2, AlertCircle,
  RefreshCw, ArrowLeft, ShieldCheck, Send, MessageSquare,
} from 'lucide-react';

const OTP_LENGTH = 6;

export function VerifyScreen() {
  const store = useAppStore();
  const user = store.user;
  const { setUser, showToast, setCurrentScreen } = store;

  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [devEmailUrl, setDevEmailUrl] = useState<string | null>(null);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [otpChannel, setOtpChannel] = useState<'telegram' | 'sms' | 'dev' | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  // ── On mount: pull any pending dev OTP / email URL from the global store ──
  // These are populated by AuthScreen when the user just registered and the
  // API responded with dev-mode values (no Twilio/Resend configured). Without
  // this, the user would have to tap "Reenviar código" just to see the OTP
  // that was already generated at registration time.
  useEffect(() => {
    const s = useAppStore.getState();
    if (s.pendingDevOtp) {
      setDevOtp(s.pendingDevOtp);
      // Clear from store so it doesn't show again on next mount
      s.setPendingDevOtp(null);
    }
    if (s.pendingDevEmailUrl) {
      setDevEmailUrl(s.pendingDevEmailUrl);
      s.setPendingDevEmailUrl(null);
    }
    if (s.pendingTelegramLink) {
      setTelegramLink(s.pendingTelegramLink);
      s.setPendingTelegramLink(null);
    }
  }, []);

  const phoneVerified = !!user?.phoneVerifiedAt;
  const emailVerified = !!user?.emailVerifiedAt;
  const hasEmail = !!user?.email;

  // If phone is already verified, skip straight to home (or stay if email pending)
  useEffect(() => {
    if (phoneVerified && emailVerified) {
      const t = setTimeout(() => setCurrentScreen('home'), 1500);
      return () => clearTimeout(t);
    }
  }, [phoneVerified, emailVerified, setCurrentScreen]);

  // ── OTP input handlers ────────────────────────────────────────────────
  const handleOtpChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = otp.split('');
    next[idx] = digit;
    const newOtp = next.join('');
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (digit && idx < OTP_LENGTH - 1) {
      otpInputs.current[idx + 1]?.focus();
    }

    // Auto-submit when complete
    if (newOtp.length === OTP_LENGTH) {
      void submitOtp(newOtp);
    }
  };

  const handleOtpKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpInputs.current[idx - 1]?.focus();
    }
  };

  const submitOtp = async (code: string) => {
    if (!user?.phone) return;
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: user.phone, code }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Update local user
        setUser({
          ...user,
          phoneVerifiedAt: new Date().toISOString(),
        });
        showToast('¡Teléfono verificado!', 'success');
        setOtp('');
      } else {
        setError(json.error || 'No se pudo verificar el código.');
        setOtp('');
        otpInputs.current[0]?.focus();
      }
    } catch {
      setError('Error de conexión. Reintentá.');
      setOtp('');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async (forceChannel?: 'telegram' | 'sms') => {
    if (!user?.phone) return;
    setResendingOtp(true);
    setError('');
    setDevOtp(null);
    setOtpError(null);
    setTelegramLink(null);
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: user.phone, channel: forceChannel }),
      });
      const json = await res.json();
      if (res.ok && json.success !== false) {
        // Successful delivery (or dev mode)
        if (json.otp?.channel) setOtpChannel(json.otp.channel);
        if (json.otp?.needsTelegramLink && json.otp?.telegramBotLink) {
          setTelegramLink(json.otp.telegramBotLink);
          showToast('Te enviamos el código por SMS. Vinculá Telegram para próximas veces.', 'info');
        } else if (json.otp?.channel === 'telegram') {
          showToast('Te enviamos el código por Telegram.', 'info');
        } else if (json.otp?.channel === 'sms') {
          showToast('Te enviamos el código por SMS.', 'info');
        } else if (json.dev?.phoneOtp) {
          showToast('SMS no configurado — mirá el código abajo.', 'info');
        } else {
          showToast('Te enviamos un nuevo código.', 'info');
        }
        if (json.dev?.phoneOtp) setDevOtp(json.dev.phoneOtp);
      } else {
        const msg = json.error || json.otp?.error || 'No se pudo reenviar el código.';
        setError(msg);
        setOtpError(msg);
        if (json.otp?.needsTelegramLink && json.otp?.telegramBotLink) {
          setTelegramLink(json.otp.telegramBotLink);
        }
      }
    } catch {
      setError('Error de conexión. Reintentá en unos segundos.');
      setOtpError('Error de conexión.');
    } finally {
      setResendingOtp(false);
    }
  };

  const handleResendEmail = async () => {
    if (!user?.phone) return;
    setResendingEmail(true);
    setError('');
    setDevEmailUrl(null);
    try {
      const res = await fetch('/api/auth/resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: user.phone }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Te enviamos un nuevo correo de verificación.', 'info');
        if (json.dev?.emailVerifyUrl) setDevEmailUrl(json.dev.emailVerifyUrl);
      } else {
        // Even on 200 the API can return success:false with a friendly error
        const msg = json.error || 'No se pudo reenviar el correo. Reintentá más tarde.';
        setError(msg);
      }
    } catch {
      setError('Error de conexión. Reintentá en unos segundos.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSkipEmail = () => {
    showToast('Podés verificar tu email más tarde desde el perfil.', 'info');
    setCurrentScreen('home');
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0F14] px-6 pt-10 pb-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{
            background: phoneVerified && emailVerified
              ? 'linear-gradient(135deg, #10B981, #0EA5A0)'
              : 'linear-gradient(135deg, rgba(14,165,160,0.15), rgba(12,140,233,0.15))',
            border: phoneVerified && emailVerified ? 'none' : '1.5px solid rgba(14,165,160,0.3)',
          }}
        >
          {phoneVerified && emailVerified ? (
            <CheckCircle2 className="w-10 h-10 text-white" />
          ) : (
            <ShieldCheck className="w-10 h-10 text-[#0EA5A0]" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {phoneVerified && emailVerified ? '¡Todo verificado!' : 'Verificá tu cuenta'}
        </h1>
        <p className="text-[#8B9DAF] text-sm leading-relaxed">
          {phoneVerified && emailVerified
            ? 'Ya podés empezar a usar TEYEVO.'
            : 'Necesitamos confirmar tu teléfono y email para garantizar la seguridad.'}
        </p>
      </div>

      {/* ── Phone verification ─────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 mb-4 ${
        phoneVerified
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-[#141B24] border-[#1E2A38]'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            phoneVerified ? 'bg-emerald-500/20' : 'bg-[#0EA5A0]/15'
          }`}>
            {phoneVerified ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Phone className="w-5 h-5 text-[#0EA5A0]" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold">Teléfono</p>
            <p className="text-[#8B9DAF] text-xs">{user?.phone}</p>
          </div>
          {phoneVerified && (
            <span className="text-emerald-400 text-xs font-medium">Verificado</span>
          )}
        </div>

        {!phoneVerified && (
          <>
            <p className="text-[#8B9DAF] text-xs mb-3">
              Ingresá el código de 6 dígitos que te enviamos{otpChannel === 'telegram' ? ' por Telegram:' : otpChannel === 'sms' ? ' por SMS:' : ':'}
            </p>

            {/* OTP inputs */}
            <div className="flex justify-between gap-2 mb-4">
              {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => { otpInputs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[i] || ''}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
                  disabled={verifying}
                  className="w-12 h-14 rounded-xl bg-[#0A0F14] border-2 border-[#1E2A38] text-white text-center text-2xl font-bold focus:border-[#0EA5A0] focus:outline-none transition-colors"
                />
              ))}
            </div>

            {/* Telegram link banner — user needs to open the bot first */}
            {telegramLink && (
              <div className="mb-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30">
                <div className="flex items-start gap-2">
                  <Send className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sky-300 text-xs font-semibold mb-1">Vinculá Telegram para próximas veces</p>
                    <p className="text-sky-200/80 text-xs leading-relaxed mb-2">
                      Te enviamos el código por SMS esta vez. Si vinculás Telegram, los próximos códigos llegarán ahí (gratis y al instante).
                    </p>
                    <a
                      href={telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500/20 text-sky-200 text-xs font-semibold hover:bg-sky-500/30 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Abrir bot de Telegram
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Dev mode OTP hint — shown when neither Telegram nor Twilio is configured */}
            {devOtp && (
              <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-300 text-xs font-medium">Ni Telegram ni SMS están configurados todavía</p>
                  <p className="text-amber-200/80 text-xs mt-0.5">
                    Tu código es: <span className="font-mono font-bold text-base tracking-wider">{devOtp}</span>
                  </p>
                  <p className="text-amber-200/60 text-[10px] mt-1">
                    En producción, este código llegará por Telegram (preferido) o SMS automáticamente.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs flex-1">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleResendOtp()}
                  disabled={resendingOtp}
                  className="text-[#0EA5A0] text-xs font-medium flex items-center gap-1.5 hover:text-[#12BEB8] transition-colors disabled:opacity-50"
                >
                  {resendingOtp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Reenviar código
                </button>
                {verifying && (
                  <span className="text-[#6B7F95] text-xs flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Verificando…
                  </span>
                )}
              </div>

              {/* Channel options */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#1E2A38]/50">
                <span className="text-[10px] text-[#6B7F95] uppercase tracking-wide">Recibir por:</span>
                <button
                  onClick={() => handleResendOtp('telegram')}
                  disabled={resendingOtp}
                  className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-50 flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  Telegram
                </button>
                <span className="text-[#3D5068]">·</span>
                <button
                  onClick={() => handleResendOtp('sms')}
                  disabled={resendingOtp}
                  className="text-[10px] font-semibold text-[#0EA5A0] hover:text-[#12BEB8] disabled:opacity-50 flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3" />
                  SMS
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Email verification ─────────────────────────────────────────── */}
      {hasEmail && (
        <div className={`rounded-2xl border p-5 mb-4 ${
          emailVerified
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-[#141B24] border-[#1E2A38]'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              emailVerified ? 'bg-emerald-500/20' : 'bg-[#0C8CE9]/15'
            }`}>
              {emailVerified ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Mail className="w-5 h-5 text-[#0C8CE9]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">Email</p>
              <p className="text-[#8B9DAF] text-xs truncate">{user?.email}</p>
            </div>
            {emailVerified ? (
              <span className="text-emerald-400 text-xs font-medium">Verificado</span>
            ) : (
              <span className="text-amber-400 text-xs font-medium">Pendiente</span>
            )}
          </div>

          {!emailVerified && (
            <>
              <p className="text-[#8B9DAF] text-xs mb-3">
                Te enviamos un correo con un enlace de verificación. Tocá el enlace para confirmar tu email.
              </p>

              {/* Dev mode email URL — verify inline instead of opening new tab */}
              {devEmailUrl && (
                <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-amber-300 text-xs font-medium mb-1">Email no configurado todavía</p>
                  <p className="text-amber-200/80 text-xs mb-2">
                    Cuando se configure Resend, el link llegará por email. Por ahora, tocá el botón:
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        // Extract token from the dev URL and verify it via fetch (same tab)
                        const url = new URL(devEmailUrl);
                        const token = url.searchParams.get('token');
                        if (!token) { store.showToast('Token no encontrado en el enlace', 'error'); return; }
                        const res = await fetch('/api/auth/verify-email?token=' + token);
                        if (res.ok) {
                          store.setUser({ ...user!, emailVerifiedAt: new Date().toISOString() });
                          store.showToast('¡Email verificado correctamente!', 'success');
                          setDevEmailUrl(null);
                        } else {
                          const json = await res.json().catch(() => ({}));
                          store.showToast(json.error || 'Error al verificar email', 'error');
                        }
                      } catch { store.showToast('Error de conexión', 'error'); }
                    }}
                    className="inline-block px-3 py-2 rounded-lg bg-amber-500/20 text-amber-200 text-xs font-medium hover:bg-amber-500/30 transition-colors"
                  >
                    Verificar email ahora
                  </button>
                </div>
              )}

              <button
                onClick={handleResendEmail}
                disabled={resendingEmail}
                className="text-[#0C8CE9] text-xs font-medium flex items-center gap-1.5 hover:text-[#3BA8FF] transition-colors disabled:opacity-50"
              >
                {resendingEmail ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Reenviar correo
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Continue button ────────────────────────────────────────────── */}
      <div className="mt-auto pt-6">
        {phoneVerified ? (
          <Button
            onClick={() => setCurrentScreen('home')}
            className="w-full h-13 rounded-xl font-semibold text-base transition-all"
            style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)', color: 'white' }}
          >
            {emailVerified ? 'Continuar a la app' : 'Continuar (email más tarde)'}
            <ArrowRight className="w-5 h-5" />
          </Button>
        ) : (
          !hasEmail && (
            <Button
              onClick={() => setCurrentScreen('home')}
              className="w-full h-13 rounded-xl font-semibold text-base transition-all bg-[#1E2A38] text-[#8B9DAF] hover:bg-[#2A3A4E] hover:text-white"
            >
              Saltar por ahora
              <ArrowRight className="w-5 h-5" />
            </Button>
          )
        )}

        {!phoneVerified && hasEmail && (
          <button
            onClick={handleSkipEmail}
            className="w-full text-center text-[#3D5068] text-xs font-medium mt-4 hover:text-[#6B7F95] transition-colors"
          >
            Verificar después y continuar
          </button>
        )}
      </div>
    </div>
  );
}
