'use client';

import { useState } from 'react';
import { useAppStore, type User } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, User as UserIcon, ArrowRight, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAuthForms, setShowAuthForms] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const { navigateTo, setUser, showToast, isFirebaseReady } = useAppStore();

  const handleLogin = async () => {
    setError('');
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Completá todos los campos.');
      return;
    }
    if (!isFirebaseReady) {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 800));
      const demoUser: User = {
        uid: 'demo',
        email: loginEmail.trim(),
        name: loginEmail.split('@')[0],
        phone: '',
        avatar: '',
        role: 'passenger',
        isDriverApproved: false,
      };
      setUser(demoUser);
      showToast('Sesión iniciada (demo)', 'success');
      navigateTo('role');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      const cred = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      const fbUser = cred.user;
      const newUser: User = {
        uid: fbUser.uid,
        email: fbUser.email || loginEmail.trim(),
        name: fbUser.displayName || loginEmail.split('@')[0],
        phone: fbUser.phoneNumber || '',
        avatar: fbUser.photoURL || '',
        role: 'passenger',
        isDriverApproved: false,
      };
      setUser(newUser);
      showToast('¡Bienvenido de vuelta!', 'success');
      navigateTo('role');
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === 'auth/user-not-found') {
        setError('No se encontró una cuenta con ese email.');
      } else if (firebaseError.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta.');
      } else if (firebaseError.code === 'auth/invalid-email') {
        setError('Email inválido.');
      } else if (firebaseError.code === 'auth/invalid-credential') {
        setError('Credenciales inválidas.');
      } else {
        setError('Error al iniciar sesión. Verificá tus datos.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setError('Completá todos los campos.');
      return;
    }
    if (regPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!isFirebaseReady) {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 800));
      const demoUser: User = {
        uid: 'demo-' + Date.now(),
        email: regEmail.trim(),
        name: regName.trim(),
        phone: '',
        avatar: '',
        role: 'passenger',
        isDriverApproved: false,
      };
      setUser(demoUser);
      showToast('¡Cuenta creada! (demo)', 'success');
      navigateTo('role');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      const cred = await createUserWithEmailAndPassword(auth, regEmail.trim(), regPassword);
      if (cred.user) {
        await updateProfile(cred.user, { displayName: regName.trim() });
      }
      const newUser: User = {
        uid: cred.user.uid,
        email: cred.user.email || regEmail.trim(),
        name: regName.trim(),
        phone: '',
        avatar: '',
        role: 'passenger',
        isDriverApproved: false,
      };
      setUser(newUser);
      showToast('¡Cuenta creada exitosamente!', 'success');
      navigateTo('role');
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === 'auth/email-already-in-use') {
        setError('Ese email ya está registrado.');
      } else if (firebaseError.code === 'auth/weak-password') {
        setError('La contraseña es muy débil (mínimo 6 caracteres).');
      } else if (firebaseError.code === 'auth/invalid-email') {
        setError('Email inválido.');
      } else {
        setError('Error al crear la cuenta. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    const demoUser: User = {
      uid: 'demo',
      email: 'demo@unira.app',
      name: 'Usuario Demo',
      phone: '+54 11 5555-0000',
      avatar: '',
      role: 'passenger',
      isDriverApproved: false,
    };
    setUser(demoUser);
    showToast('Modo demo activado', 'info');
    navigateTo('role');
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0F14] px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Unira</h1>
        <p className="text-[#8B9DAF] text-sm">
          Tu app de viajes, delivery y pagos en Argentina
        </p>
      </div>

      {/* ── PRIMARY: Demo Mode Button ─────────────────────────────── */}
      <div className="mb-6">
        <button
          onClick={handleDemo}
          className="w-full p-6 rounded-2xl text-left transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, rgba(14,165,160,0.15), rgba(12,140,233,0.15))', border: '1.5px solid #0EA5A0' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">Explorar Unira</h2>
              <p className="text-[#8B9DAF] text-sm mt-0.5">
                Ingresá al modo demo y probá todos los servicios
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-[#0EA5A0]" />
          </div>
        </button>
      </div>

      {/* ── Divider with "o" ─────────────────────────────────────── */}
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#1E2A38]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#0A0F14] px-3 text-[#3D5068] text-xs">o usá tu cuenta</span>
        </div>
      </div>

      {/* ── Collapsible Auth Forms ───────────────────────────────── */}
      <button
        onClick={() => setShowAuthForms(!showAuthForms)}
        className="w-full flex items-center justify-between py-3 text-[#8B9DAF] text-sm font-medium hover:text-white transition-colors"
      >
        <span>{showAuthForms ? 'Ocultar formulario' : 'Iniciar sesión / Registrarse'}</span>
        {showAuthForms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showAuthForms && (
        <div className="mt-2 space-y-4 animate-[fadeIn_0.2s_ease-out]">
          {/* Tab toggle */}
          <div className="flex bg-[#141B24] rounded-xl p-1">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-all ${
                mode === 'login' ? 'text-white shadow-lg' : 'text-[#6B7F95] hover:text-[#8B9DAF]'
              }`}
              style={mode === 'login' ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' } : undefined}
            >
              Ingresar
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-all ${
                mode === 'register' ? 'text-white shadow-lg' : 'text-[#6B7F95] hover:text-[#8B9DAF]'
              }`}
              style={mode === 'register' ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' } : undefined}
            >
              Registrarse
            </button>
          </div>

          {mode === 'login' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3D5068]" />
                  <Input type="email" placeholder="tu@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-10 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-12 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3D5068]" />
                  <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-10 pr-10 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-12 rounded-xl" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3D5068] hover:text-[#8B9DAF] transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">Nombre completo</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3D5068]" />
                  <Input type="text" placeholder="Tu nombre" value={regName} onChange={(e) => setRegName(e.target.value)}
                    className="pl-10 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-12 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3D5068]" />
                  <Input type="email" placeholder="tu@email.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                    className="pl-10 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-12 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3D5068]" />
                  <Input type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                    className="pl-10 pr-10 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-12 rounded-xl" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3D5068] hover:text-[#8B9DAF] transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <Button
            onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            className="w-full h-12 rounded-xl text-white font-semibold text-sm transition-all"
            style={{ background: loading ? undefined : 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      )}

      {/* Version badge */}
      <div className="mt-auto pt-6 text-center">
        <p className="text-[#2A3544] text-xs">Unira v1.0.0 — Prototipo Demo</p>
      </div>
    </div>
  );
}
