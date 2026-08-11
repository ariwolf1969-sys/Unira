'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore, type User } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { compressImage } from '@/lib/image';
import {
  ArrowRight, ArrowLeft, Sparkles, User as UserIcon, Phone,
  IdCard, Camera, MapPin, Car, CheckCircle2, Upload, AlertCircle,
  ScanFace, FileText, Loader2, ShieldCheck, Mail, Cake,
  Truck, Bus, Bike, Crown, Ship, PawPrint, Accessibility,
  IdCard as PlateIcon,
} from 'lucide-react';
import { vehicleTypes, type VehicleType } from '@/lib/places';

// ─── Step definitions ──────────────────────────────────────────────────────

type StepId =
  | 'intro'
  | 'basic'
  | 'dni'
  | 'dni-front'
  | 'dni-back'
  | 'face'
  | 'selfie-with-dni'
  | 'driver'
  | 'license-front'
  | 'license-back'
  // Driver vehicle info (Session 17)
  | 'vehicle-type'
  | 'vehicle-info'
  | 'vehicle-cedula'
  | 'vehicle-cedula-back'
  | 'vehicle-seguro'
  | 'address'
  | 'review'
  | 'done';

const STEP_ORDER: StepId[] = [
  'intro', 'basic', 'dni', 'dni-front', 'dni-back', 'face', 'selfie-with-dni',
  'driver', 'license-front', 'license-back',
  'vehicle-type', 'vehicle-info', 'vehicle-cedula', 'vehicle-cedula-back', 'vehicle-seguro',
  'address', 'review', 'done',
];

// Lucide icon lookup for vehicle categories.
// Keyed by the `icon` string in places.ts (e.g. 'Bike', 'Car', 'Truck').
// Multiple vehicle types may share the same icon (e.g. auto_2_puertas and
// auto_4_puertas both use 'Car'), so we only list each icon once.
const VEHICLE_ICONS_WIZARD: Record<string, React.ElementType> = {
  Bike,
  Car,
  Crown,
  Bus,
  Truck,
  PawPrint,
  Accessibility,
  Ship,
};

interface RegData {
  name: string;
  phone: string;
  email: string;
  birthday: string;  // YYYY-MM-DD
  dni: string;
  dniFront: string;
  dniBack: string;
  facePhoto: string;
  selfieWithDni: string;
  isDriver: boolean | null;
  licenseFront: string;
  licenseBack: string;
  // Driver vehicle info (Session 17)
  vehicleType: string;        // id from VehicleType
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;        // string for input, parsed to number on submit
  vehicleColor: string;
  cedulaVerdeAzul: string;    // base64 photo FRENTE
  cedulaVerdeAzulBack: string; // base64 photo DORSO
  seguroVehiculo: string;     // base64 photo
  address: string;
  addressLat?: number;
  addressLng?: number;
  // El usuario siempre es socio de la cooperativa (5% comisión) por defecto.
  // El flag lo setea el backend al registrar; este campo se incluye para que
  // el tipo del response coincida con lo que devuelve /api/auth/register.
  isSocio?: boolean;
}

const EMPTY_DATA: RegData = {
  name: '', phone: '', email: '', birthday: '',
  dni: '', dniFront: '', dniBack: '',
  facePhoto: '', selfieWithDni: '', isDriver: null, licenseFront: '', licenseBack: '',
  vehicleType: '', vehiclePlate: '', vehicleBrand: '', vehicleModel: '',
  vehicleYear: '', vehicleColor: '', cedulaVerdeAzul: '', cedulaVerdeAzulBack: '', seguroVehiculo: '',
  address: '',
};

// ─── Main component ────────────────────────────────────────────────────────

export function AuthScreen() {
  const [step, setStep] = useState<StepId>('intro');
  const [data, setData] = useState<RegData>(EMPTY_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [loginPhone, setLoginPhone] = useState('');
  const { setUser, setAuthToken, loadFromServer, showToast } = useAppStore();

  const set = <K extends keyof RegData>(key: K, value: RegData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setError('');
  };

  const goNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step);
    // Skip all driver-only steps if user is not a driver
    const DRIVER_ONLY_STEPS: StepId[] = ['license-front', 'license-back', 'vehicle-type', 'vehicle-info', 'vehicle-cedula', 'vehicle-cedula-back', 'vehicle-seguro'];
    if (step === 'driver' && data.isDriver === false) {
      setStep('address');
      return;
    }
    // Skip subsequent driver-only steps if user is not a driver
    if (DRIVER_ONLY_STEPS.includes(step) && data.isDriver === false) {
      setStep('address');
      return;
    }
    if (idx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[idx + 1]);
    }
  }, [step, data.isDriver]);

  const goBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step);
    // Skip all driver-only steps when going back if user is not a driver
    const DRIVER_ONLY_STEPS: StepId[] = ['license-front', 'license-back', 'vehicle-type', 'vehicle-info', 'vehicle-cedula', 'vehicle-cedula-back', 'vehicle-seguro'];
    if (step === 'address' && data.isDriver === false) {
      setStep('driver');
      return;
    }
    if (DRIVER_ONLY_STEPS.includes(step) && data.isDriver === false) {
      setStep('driver');
      return;
    }
    if (idx > 0) {
      setStep(STEP_ORDER[idx - 1]);
    } else {
      setStep('intro');
    }
  }, [step, data.isDriver]);

  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [devEmailUrl, setDevEmailUrl] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(),
          phone: data.phone.trim(),
          email: data.email.trim(),
          birthday: data.birthday,
          dni: data.dni.trim(),
          dniFront: data.dniFront,
          dniBack: data.dniBack,
          facePhoto: data.facePhoto,
          selfieWithDni: data.selfieWithDni,
          licenseFront: data.licenseFront,
          licenseBack: data.licenseBack,
          // Driver vehicle info (Session 17)
          vehicleType: data.vehicleType,
          vehiclePlate: data.vehiclePlate.trim(),
          vehicleBrand: data.vehicleBrand.trim(),
          vehicleModel: data.vehicleModel.trim(),
          vehicleYear: data.vehicleYear ? parseInt(data.vehicleYear, 10) : undefined,
          vehicleColor: data.vehicleColor.trim(),
          cedulaVerdeAzul: data.cedulaVerdeAzul,
          cedulaVerdeAzulBack: data.cedulaVerdeAzulBack,
          seguroVehiculo: data.seguroVehiculo,
          address: data.address,
          addressLat: data.addressLat,
          addressLng: data.addressLng,
          isDriver: data.isDriver === true,
        }),
      });

      let apiUser: User | null = null;
      let apiToken: string | null = null;
      let devData: { phoneOtp?: string; emailVerifyUrl?: string } | null = null;
      let otpInfo: { channel?: string; needsTelegramLink?: boolean; telegramBotLink?: string; error?: string } | null = null;

      if (res.ok) {
        const json = await res.json();
        apiUser = json.user as User;
        apiToken = json.token as string;
        devData = json.dev;
        otpInfo = json.otp;
        // Persist dev OTP / email URL into the global store so VerifyScreen
        // can display them after navigation. (Previously these were captured
        // into local component state, which was destroyed on unmount when
        // AuthScreen navigated to VerifyScreen — so the user never saw them.)
        if (devData?.phoneOtp) {
          setDevOtp(devData.phoneOtp);
          useAppStore.getState().setPendingDevOtp(devData.phoneOtp);
        }
        if (devData?.emailVerifyUrl) {
          setDevEmailUrl(devData.emailVerifyUrl);
          useAppStore.getState().setPendingDevEmailUrl(devData.emailVerifyUrl);
        }
        // Persist Telegram link info so VerifyScreen can prompt the user
        if (otpInfo?.needsTelegramLink && otpInfo?.telegramBotLink) {
          useAppStore.getState().setPendingTelegramLink(otpInfo.telegramBotLink);
        }
      } else {
        console.warn('Register API failed, falling back to local user');
      }

      const finalUser: User = apiUser || {
        uid: 'user-' + Date.now(),
        email: data.email.trim(),
        name: data.name.trim(),
        phone: data.phone.trim(),
        dni: data.dni.trim(),
        dniFront: data.dniFront,
        dniBack: data.dniBack,
        facePhoto: data.facePhoto,
        selfieWithDni: data.selfieWithDni,
        licenseFront: data.licenseFront,
        licenseBack: data.licenseBack,
        // Driver vehicle info (Session 17)
        vehicleType: data.vehicleType,
        vehiclePlate: data.vehiclePlate.trim(),
        vehicleBrand: data.vehicleBrand.trim(),
        vehicleModel: data.vehicleModel.trim(),
        vehicleYear: data.vehicleYear ? parseInt(data.vehicleYear, 10) : undefined,
        vehicleColor: data.vehicleColor.trim(),
        cedulaVerdeAzul: data.cedulaVerdeAzul,
        cedulaVerdeAzulBack: data.cedulaVerdeAzulBack,
        seguroVehiculo: data.seguroVehiculo,
        address: data.address,
        addressLat: data.addressLat,
        addressLng: data.addressLng,
        avatar: '',
        birthday: data.birthday,
        role: 'passenger',
        isDriver: data.isDriver === true,
        isDriverApproved: false,
        isAdmin: false,
        isSocio: data.isSocio === true,  // socio de la cooperativa = 5% comisión
        verificationStatus: 'pending',
        phoneVerifiedAt: null,
        emailVerifiedAt: null,
      };

      setUser(finalUser);
      if (apiToken) setAuthToken(apiToken);

      showToast(
        `¡Bienvenido/a, ${data.name.trim()}! Verificá tu teléfono para continuar.`,
        'success'
      );

      if (finalUser.uid && finalUser.uid !== 'demo') {
        loadFromServer(finalUser.uid);
      }

      setStep('done');
    } catch (e) {
      console.error(e);
      setError('No se pudo conectar con el servidor. Reintentá en un momento.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Login handler (for existing users) ──
  const handleLogin = async () => {
    if (!loginPhone.trim()) {
      setError('Ingresá tu número de teléfono');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'No se pudo encontrar tu cuenta. Registráte.');
        setSubmitting(false);
        return;
      }
      const apiUser = json.user as User;
      const apiToken = json.token as string;
      if (apiUser && apiToken) {
        setUser(apiUser);
        setAuthToken(apiToken);
        // After login, if phone not verified → verify screen, else → auto-route from page.tsx
        if (!apiUser.phoneVerifiedAt) {
          useAppStore.getState().setCurrentScreen('verify');
        }
        // Else page.tsx auto-navigate handles routing (terms, permissions, home)
        showToast('¡Bienvenido/a de vuelta!', 'success');
      }
    } catch {
      setError('Error de conexión. Reintentá en un momento.');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-advance to verify screen after successful registration
  useEffect(() => {
    if (step === 'done') {
      const t = setTimeout(() => {
        // Route to verify screen instead of home — phone verification required
        useAppStore.getState().setCurrentScreen('verify');
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [step]);

  // ─── Render ────────────────────────────────────────────────────────────
  const stepIdx = STEP_ORDER.indexOf(step);
  // Don't count 'intro' or 'done' in the progress bar
  // Also skip all driver-only steps if user is not a driver
  const DRIVER_ONLY_STEPS_RENDER: StepId[] = ['license-front', 'license-back', 'vehicle-type', 'vehicle-info', 'vehicle-cedula', 'vehicle-cedula-back', 'vehicle-seguro'];
  const progressSteps = STEP_ORDER.filter((s) =>
    s !== 'intro' &&
    s !== 'done' &&
    !(DRIVER_ONLY_STEPS_RENDER.includes(s) && data.isDriver !== true)
  );
  const progressIdx = progressSteps.indexOf(step);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0F14]">
      {/* Progress bar (hidden on intro/done) */}
      {step !== 'intro' && step !== 'done' && (
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-full bg-[#141B24] flex items-center justify-center text-[#8B9DAF] hover:text-white transition-colors"
              aria-label="Volver"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-[#6B7F95] text-xs font-medium">
              Paso {Math.max(1, progressIdx + 1)} de {progressSteps.length}
            </span>
            <div className="w-9" />
          </div>
          <div className="h-1 bg-[#141B24] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${((progressIdx + 1) / progressSteps.length) * 100}%`,
                background: 'linear-gradient(90deg, #0EA5A0, #0C8CE9)',
              }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 px-6 py-4">
        {step === 'intro' && <IntroStep onStart={() => setStep('basic')} mode={mode} onToggleMode={() => setMode(mode === 'register' ? 'login' : 'register')} loginPhone={loginPhone} onLoginPhone={setLoginPhone} onLogin={() => void handleLogin()} loginSubmitting={submitting} loginError={error} />}
        {step === 'basic' && (
          <BasicStep
            name={data.name}
            phone={data.phone}
            email={data.email}
            birthday={data.birthday}
            error={error}
            onName={(v) => set('name', v)}
            onPhone={(v) => set('phone', v)}
            onEmail={(v) => set('email', v)}
            onBirthday={(v) => set('birthday', v)}
            onNext={goNext}
          />
        )}
        {step === 'dni' && (
          <DniStep
            dni={data.dni}
            error={error}
            onDni={(v) => set('dni', v)}
            onNext={goNext}
          />
        )}
        {step === 'dni-front' && (
          <PhotoStep
            title="Foto del DNI (frente)"
            subtitle="Asegurate de que se vea nítido el nombre, foto y número de documento."
            icon={<IdCard className="w-7 h-7 text-white" />}
            accent="#0EA5A0"
            value={data.dniFront}
            onChange={(v) => set('dniFront', v)}
            onNext={goNext}
          />
        )}
        {step === 'dni-back' && (
          <PhotoStep
            title="Foto del DNI (dorso)"
            subtitle="Mostrá la parte trasera del documento donde figura el domicilio."
            icon={<FileText className="w-7 h-7 text-white" />}
            accent="#0C8CE9"
            value={data.dniBack}
            onChange={(v) => set('dniBack', v)}
            onNext={goNext}
          />
        )}
        {step === 'face' && (
          <PhotoStep
            title="Verificación de rostro"
            subtitle="Sacate una selfie con buena luz, mirando al frente, sin lentes ni gorra."
            icon={<ScanFace className="w-7 h-7 text-white" />}
            accent="#8B5CF6"
            value={data.facePhoto}
            onChange={(v) => set('facePhoto', v)}
            onNext={goNext}
            useFrontCamera
          />
        )}
        {step === 'selfie-with-dni' && (
          <PhotoStep
            title="Selfie con tu DNI"
            subtitle="Sacate una selfie sosteniendo tu DNI al lado de tu rostro. Tiene que verse claramente tu cara y el número de documento. Esto es obligatorio para la seguridad de toda la comunidad."
            icon={<ShieldCheck className="w-7 h-7 text-white" />}
            accent="#EF4444"
            value={data.selfieWithDni}
            onChange={(v) => set('selfieWithDni', v)}
            onNext={goNext}
            useFrontCamera
          />
        )}
        {step === 'driver' && (
          <DriverStep
            value={data.isDriver}
            onChange={(v) => set('isDriver', v)}
            onNext={goNext}
          />
        )}
        {step === 'license-front' && (
          <PhotoStep
            title="Registro de conducir (frente)"
            subtitle="Subí una foto clara del frente del registro, donde se vea tu nombre, categoría y vencimiento."
            icon={<Car className="w-7 h-7 text-white" />}
            accent="#F59E0B"
            value={data.licenseFront}
            onChange={(v) => set('licenseFront', v)}
            onNext={goNext}
          />
        )}
        {step === 'license-back' && (
          <PhotoStep
            title="Registro de conducir (dorso)"
            subtitle="Subí una foto del dorso del registro, donde figuran las observaciones y restricciones."
            icon={<FileText className="w-7 h-7 text-white" />}
            accent="#F59E0B"
            value={data.licenseBack}
            onChange={(v) => set('licenseBack', v)}
            onNext={goNext}
          />
        )}
        {step === 'vehicle-type' && (
          <VehicleTypeStep
            value={data.vehicleType}
            onChange={(v) => set('vehicleType', v)}
            onNext={goNext}
          />
        )}
        {step === 'vehicle-info' && (
          <VehicleInfoStep
            plate={data.vehiclePlate}
            brand={data.vehicleBrand}
            model={data.vehicleModel}
            year={data.vehicleYear}
            color={data.vehicleColor}
            onPlate={(v) => set('vehiclePlate', v)}
            onBrand={(v) => set('vehicleBrand', v)}
            onModel={(v) => set('vehicleModel', v)}
            onYear={(v) => set('vehicleYear', v)}
            onColor={(v) => set('vehicleColor', v)}
            onNext={goNext}
          />
        )}
        {step === 'vehicle-cedula' && (
          <PhotoStep
            title="Cédula del vehículo — frente"
            subtitle="Sacá una foto nítida del FRENTE de la cédula verde o azul. Se debe ver la patente, titular y número de cédula."
            icon={<IdCard className="w-7 h-7 text-white" />}
            accent="#3B82F6"
            value={data.cedulaVerdeAzul}
            onChange={(v) => set('cedulaVerdeAzul', v)}
            onNext={goNext}
          />
        )}
        {step === 'vehicle-cedula-back' && (
          <PhotoStep
            title="Cédula del vehículo — dorso"
            subtitle="Sacá una foto del DORSO de la cédula verde o azul, donde figuran los datos técnicos y observaciones."
            icon={<FileText className="w-7 h-7 text-white" />}
            accent="#3B82F6"
            value={data.cedulaVerdeAzulBack}
            onChange={(v) => set('cedulaVerdeAzulBack', v)}
            onNext={goNext}
          />
        )}
        {step === 'vehicle-seguro' && (
          <PhotoStep
            title="Seguro del vehículo"
            subtitle="Subí una foto de la póliza de seguro vigente o carátula. Debe incluir patente, vigencia y cobertura."
            icon={<ShieldCheck className="w-7 h-7 text-white" />}
            accent="#10B981"
            value={data.seguroVehiculo}
            onChange={(v) => set('seguroVehiculo', v)}
            onNext={goNext}
          />
        )}
        {step === 'address' && (
          <AddressStep
            value={data.address}
            lat={data.addressLat}
            lng={data.addressLng}
            onChange={(addr, lat, lng) => {
              setData((d) => ({ ...d, address: addr, addressLat: lat, addressLng: lng }));
              setError('');
            }}
            error={error}
            onNext={goNext}
          />
        )}
        {step === 'review' && (
          <ReviewStep
            data={data}
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
            onEdit={(s) => setStep(s)}
          />
        )}
        {step === 'done' && (
          <DoneStep name={data.name} isDriver={data.isDriver === true} />
        )}
      </div>
    </div>
  );
}

// ─── Step components ───────────────────────────────────────────────────────

function IntroStep({ onStart, mode, onToggleMode, loginPhone, onLoginPhone, onLogin, loginSubmitting, loginError }: {
  onStart: () => void;
  mode: 'register' | 'login';
  onToggleMode: () => void;
  loginPhone: string;
  onLoginPhone: (v: string) => void;
  onLogin: () => void;
  loginSubmitting: boolean;
  loginError: string;
}) {
  const { showToast } = useAppStore();

  return (
    <div className="flex flex-col min-h-[100dvh] -mx-6 -my-4 px-6 py-8">
      <div className="mb-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 overflow-hidden"
        >
          <img src="/icon-512.png?v=20260728" alt="TEYEVO" className="w-full h-full rounded-2xl object-cover" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 tracking-wide">TEYEVO</h1>
        <p className="text-[#8B9DAF] text-sm leading-relaxed">
          Tu App de VIAJES, DELIVERY, SERVICIOS y PAGOS en ARGENTINA.
        </p>
      </div>

      {/* Tab switcher: Register / Login */}
      <div className="flex rounded-xl bg-[#141B24] p-1 mb-5">
        <button
          onClick={() => { if (mode === 'login') onToggleMode(); }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${mode === 'register' ? 'bg-[#0EA5A0] text-white' : 'text-[#8B9DAF] hover:text-white'}`}
        >
          Registrarme
        </button>
        <button
          onClick={() => { if (mode === 'register') onToggleMode(); }}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${mode === 'login' ? 'bg-[#0EA5A0] text-white' : 'text-[#8B9DAF] hover:text-white'}`}
        >
          Ya tengo cuenta
        </button>
      </div>

      {mode === 'register' ? (
        <>
          {/* What you'll need card */}
          <div className="rounded-2xl border border-[#1E2A38] bg-[#141B24] p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-[#0EA5A0]" />
              <h2 className="text-white text-sm font-semibold">Verificación obligatoria</h2>
            </div>
            <p className="text-[#8B9DAF] text-xs leading-relaxed mb-4">
              Para garantizar la seguridad de toda la comunidad Unira, necesitamos verificar tu identidad antes de pedir o dar viajes.
            </p>
            <ul className="space-y-2.5 text-[#C8D6E5] text-xs">
              <li className="flex items-start gap-2">
                <span className="text-[#0EA5A0] mt-0.5">·</span>
                <span>Tu número de DNI y foto del documento (frente y dorso)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0EA5A0] mt-0.5">·</span>
                <span>Una selfie para confirmar que sos vos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0EA5A0] mt-0.5">·</span>
                <span>Tu domicilio</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0EA5A0] mt-0.5">·</span>
                <span>Si vas a ser conductor: registro de conducir, datos del vehículo (tipo, patente, marca, modelo), cédula verde/azul y seguro</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={onStart}
            className="w-full h-13 rounded-xl text-white font-semibold text-base transition-all"
            style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}
          >
            Comenzar registro
            <ArrowRight className="w-5 h-5" />
          </Button>
        </>
      ) : (
        <>
          {/* Login card */}
          <div className="rounded-2xl border border-[#1E2A38] bg-[#141B24] p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="w-4 h-4 text-[#0EA5A0]" />
              <h2 className="text-white text-sm font-semibold">Ingresar con tu teléfono</h2>
            </div>
            <Input
              type="tel"
              placeholder="+54 11 1234-5678"
              value={loginPhone}
              onChange={(e) => onLoginPhone(e.target.value)}
              className="w-full h-12 rounded-xl bg-[#0A0F14] border border-[#1E2A38] text-white placeholder-[#4A5568] text-sm focus:border-[#0EA5A0] focus:ring-1 focus:ring-[#0EA5A0]/30"
            />
            {loginError && (
              <p className="text-red-400 text-xs mt-2">{loginError}</p>
            )}
            <Button
              onClick={onLogin}
              disabled={loginSubmitting || loginPhone.trim().length < 6}
              className="w-full h-12 rounded-xl text-white font-semibold text-sm transition-all mt-3 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}
            >
              {loginSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {loginSubmitting ? 'Ingresando...' : 'Ingresar'}
            </Button>
            <p className="text-[#4A5568] text-[10px] text-center mt-3">
              Te enviaremos un código SMS/Telegram para verificar
            </p>
          </div>
        </>
      )}

      <button
        onClick={async () => {
          const demoUser: User = {
            uid: 'demo',
            email: 'demo@unira.app',
            name: 'Usuario Demo',
            phone: '+54 11 5555-0000',
            dni: '',
            dniFront: '',
            dniBack: '',
            facePhoto: '',
            selfieWithDni: '',
            licenseFront: '',
            licenseBack: '',
            vehicleType: '',
            vehiclePlate: '',
            vehicleBrand: '',
            vehicleModel: '',
            vehicleColor: '',
            cedulaVerdeAzul: '',
            cedulaVerdeAzulBack: '',
            seguroVehiculo: '',
            address: '',
            avatar: '',
            birthday: '',
            role: 'passenger',
            isDriver: false,
            isDriverApproved: false,
            isAdmin: false,
            isSocio: true,  // demo user tratado como socio
            verificationStatus: 'verified',
            phoneVerifiedAt: new Date().toISOString(),
            emailVerifiedAt: new Date().toISOString(),
          };
          useAppStore.getState().setUser(demoUser);
          showToast('Modo demo activado', 'info');
        }}
        className="w-full text-center text-[#6B7F95] text-xs font-medium flex items-center justify-center gap-1.5 hover:text-[#0EA5A0] transition-colors py-3 mt-2"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Probar modo demo
      </button>

      <div className="mt-auto pt-8 text-center">
        <p className="text-[#2A3544] text-xs">TEYEVO v3.0.0 · Diseñada por IA y Ariel Wolf - 11-5597-6414</p>
      </div>
    </div>
  );
}

function BasicStep({
  name, phone, email, birthday, error, onName, onPhone, onEmail, onBirthday, onNext,
}: {
  name: string; phone: string; email: string; birthday: string; error: string;
  onName: (v: string) => void; onPhone: (v: string) => void;
  onEmail: (v: string) => void; onBirthday: (v: string) => void;
  onNext: () => void;
}) {
  // Basic email regex — not RFC-perfect but enough to catch typos
  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  // 13+ years old (we'll do a stricter check at server later if needed)
  const birthdayValid = !birthday || (() => {
    const d = new Date(birthday);
    if (isNaN(d.getTime())) return false;
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 13 && age < 120;
  })();
  const valid = name.trim().length >= 2 && phone.trim().length >= 6 && emailValid && birthdayValid;
  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={<UserIcon className="w-6 h-6 text-white" />}
        accent="#0EA5A0"
        title="Empecemos por lo básico"
        subtitle="Necesitamos tus datos de contacto. Vamos a enviarte un código por SMS y un correo para verificarlos."
      />
      <div className="space-y-4 mt-6">
        <div className="space-y-2">
          <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
            Nombre completo
          </Label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3D5068]" />
            <Input
              type="text"
              placeholder="Ej: Juan Pérez"
              value={name}
              onChange={(e) => onName(e.target.value)}
              className="pl-11 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && valid && onNext()}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
            Teléfono
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3D5068]" />
            <Input
              type="tel"
              placeholder="Ej: +54 11 1234-5678"
              value={phone}
              onChange={(e) => onPhone(e.target.value)}
              className="pl-11 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base"
              onKeyDown={(e) => e.key === 'Enter' && valid && onNext()}
            />
          </div>
          <p className="text-[#6B7F95] text-xs">
            Te enviaremos un código por SMS para verificar este número.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
            Correo electrónico
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3D5068]" />
            <Input
              type="email"
              inputMode="email"
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              className={`pl-11 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base ${
                email && !emailValid ? 'border-red-500/50' : ''
              }`}
              onKeyDown={(e) => e.key === 'Enter' && valid && onNext()}
            />
          </div>
          {email && !emailValid && (
            <p className="text-red-400 text-xs">El email no parece válido.</p>
          )}
          {email && emailValid && (
            <p className="text-[#6B7F95] text-xs">
              Te enviaremos un enlace a este correo para verificarlo.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
            Fecha de nacimiento
          </Label>
          <div className="relative">
            <Cake className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3D5068]" />
            <Input
              type="date"
              value={birthday}
              onChange={(e) => onBirthday(e.target.value)}
              className="pl-11 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base"
            />
          </div>
          {birthday && !birthdayValid && (
            <p className="text-red-400 text-xs">Tenés que tener al menos 13 años.</p>
          )}
          {birthday && birthdayValid && (
            <p className="text-[#6B7F95] text-xs">
              La usamos para verificar tu edad y enviarte novedades.
            </p>
          )}
        </div>
        {error && <ErrorBanner text={error} />}
      </div>
      <div className="mt-auto pt-6">
        <Button
          onClick={onNext}
          disabled={!valid}
          className="w-full h-13 rounded-xl font-semibold text-base transition-all"
          style={valid ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)', color: 'white' } : undefined}
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

function DniStep({
  dni, error, onDni, onNext,
}: {
  dni: string; error: string; onDni: (v: string) => void; onNext: () => void;
}) {
  // Argentine DNI is 7 or 8 digits (no dots, no spaces)
  const cleaned = dni.replace(/\D/g, '');
  const valid = cleaned.length === 7 || cleaned.length === 8;
  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={<IdCard className="w-6 h-6 text-white" />}
        accent="#0EA5A0"
        title="Número de DNI"
        subtitle="Ingresá tu número de documento sin puntos ni espacios."
      />
      <div className="space-y-4 mt-6">
        <div className="space-y-2">
          <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
            DNI
          </Label>
          <Input
            type="tel"
            inputMode="numeric"
            placeholder="12345678"
            value={dni}
            onChange={(e) => onDni(e.target.value)}
            className="bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base tracking-widest font-mono"
            autoFocus
            maxLength={8}
            onKeyDown={(e) => e.key === 'Enter' && valid && onNext()}
          />
          <p className="text-[#6B7F95] text-xs">
            {cleaned.length === 0
              ? '7 u 8 dígitos, sin puntos.'
              : `${cleaned.length} dígitos ingresados`}
          </p>
        </div>
        {error && <ErrorBanner text={error} />}
      </div>
      <div className="mt-auto pt-6">
        <Button
          onClick={onNext}
          disabled={!valid}
          className="w-full h-13 rounded-xl font-semibold text-base transition-all"
          style={valid ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)', color: 'white' } : undefined}
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

function PhotoStep({
  title, subtitle, icon, accent, value, onChange, onNext, useFrontCamera,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  useFrontCamera?: boolean;
}) {
  const fileCamRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [sizeKb, setSizeKb] = useState(0);

  // Compute size from existing value
  useEffect(() => {
    if (value && value.startsWith('data:')) {
      const b64 = value.split(',')[1] ?? '';
      setSizeKb(Math.round((b64.length * 3) / 4 / 1024));
    } else {
      setSizeKb(0);
    }
  }, [value]);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const { dataUrl, sizeKb: kb } = await compressImage(file, 1280, 0.7);
      onChange(dataUrl);
      setSizeKb(kb);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={icon}
        accent={accent}
        title={title}
        subtitle={subtitle}
      />

      {/* Preview / capture area */}
      <div className="mt-6 flex-1 flex flex-col">
        {value ? (
          <div className="relative rounded-2xl overflow-hidden border border-[#1E2A38] bg-[#141B24]">
            {/* Use object-contain to preserve aspect ratio without cropping */}
            <img
              src={value}
              alt={title}
              className="w-full max-h-[50vh] object-contain bg-black"
            />
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white text-xs font-medium">{sizeKb} KB</span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileCamRef.current?.click()}
            disabled={busy}
            className="flex-1 min-h-[280px] rounded-2xl border-2 border-dashed border-[#1E2A38] bg-[#141B24]/60 flex flex-col items-center justify-center gap-3 hover:border-[#0EA5A0] transition-colors"
          >
            {busy ? (
              <>
                <Loader2 className="w-8 h-8 text-[#0EA5A0] animate-spin" />
                <p className="text-[#8B9DAF] text-sm">Procesando…</p>
              </>
            ) : (
              <>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
                >
                  <Camera className="w-7 h-7 text-white" />
                </div>
                <p className="text-[#C8D6E5] text-sm font-medium">Tocá para abrir la cámara</p>
                <p className="text-[#6B7F95] text-xs text-center max-w-[260px]">
                  {useFrontCamera
                    ? 'Se va a usar la cámara frontal para la selfie'
                    : 'Se va a usar la cámara trasera del documento'}
                </p>
              </>
            )}
          </button>
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileCamRef}
          type="file"
          accept="image/*"
          capture={useFrontCamera ? 'user' : 'environment'}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <input
          ref={fileUploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />

        {/* Action buttons */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {value ? (
            <>
              <Button
                onClick={() => fileCamRef.current?.click()}
                disabled={busy}
                variant="outline"
                className="h-11 rounded-xl border-[#1E2A38] bg-[#141B24] text-[#C8D6E5] hover:bg-[#1A2330] hover:text-white"
              >
                <Camera className="w-4 h-4" />
                Retomar
              </Button>
              <Button
                onClick={() => fileUploadRef.current?.click()}
                disabled={busy}
                variant="outline"
                className="h-11 rounded-xl border-[#1E2A38] bg-[#141B24] text-[#C8D6E5] hover:bg-[#1A2330] hover:text-white"
              >
                <Upload className="w-4 h-4" />
                Subir otra
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => fileCamRef.current?.click()}
                disabled={busy}
                variant="outline"
                className="h-11 rounded-xl border-[#1E2A38] bg-[#141B24] text-[#C8D6E5] hover:bg-[#1A2330] hover:text-white"
              >
                <Camera className="w-4 h-4" />
                Subir foto
              </Button>
              <Button
                onClick={() => fileUploadRef.current?.click()}
                disabled={busy}
                variant="outline"
                className="h-11 rounded-xl border-[#1E2A38] bg-[#141B24] text-[#C8D6E5] hover:bg-[#1A2330] hover:text-white"
              >
                <Upload className="w-4 h-4" />
                Elegir del archivo
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="pt-6">
        <Button
          onClick={onNext}
          disabled={!value || busy}
          className="w-full h-13 rounded-xl font-semibold text-base transition-all"
          style={value && !busy ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)', color: 'white' } : undefined}
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

function DriverStep({
  value, onChange, onNext,
}: {
  value: boolean | null; onChange: (v: boolean) => void; onNext: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={<Car className="w-6 h-6 text-white" />}
        accent="#F59E0B"
        title="¿Querés ser conductor?"
        subtitle="Podés usar Unira como pasajero ahora y sumarte como chofer más adelante. Si activás el modo conductor ahora, vamos a pedir tu registro de conducir."
      />

      <div className="mt-6 space-y-3">
        <button
          onClick={() => onChange(true)}
          className={`w-full p-4 rounded-2xl border text-left transition-all ${
            value === true
              ? 'border-[#0EA5A0] bg-[#0EA5A0]/10'
              : 'border-[#1E2A38] bg-[#141B24] hover:border-[#2A3A4E]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                value === true ? 'bg-[#0EA5A0]' : 'bg-[#1E2A38]'
              }`}
            >
              <Car className={`w-5 h-5 ${value === true ? 'text-white' : 'text-[#6B7F95]'}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-white text-sm font-semibold">Sí, quiero ser conductor</h3>
              <p className="text-[#6B7F95] text-xs mt-0.5">Vamos a pedir el registro de conducir</p>
            </div>
            {value === true && (
              <CheckCircle2 className="w-5 h-5 text-[#0EA5A0]" />
            )}
          </div>
        </button>

        <button
          onClick={() => onChange(false)}
          className={`w-full p-4 rounded-2xl border text-left transition-all ${
            value === false
              ? 'border-[#0EA5A0] bg-[#0EA5A0]/10'
              : 'border-[#1E2A38] bg-[#141B24] hover:border-[#2A3A4E]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                value === false ? 'bg-[#0EA5A0]' : 'bg-[#1E2A38]'
              }`}
            >
              <UserIcon className={`w-5 h-5 ${value === false ? 'text-white' : 'text-[#6B7F95]'}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-white text-sm font-semibold">No, solo pasajero</h3>
              <p className="text-[#6B7F95] text-xs mt-0.5">Podés activarlo más adelante desde el perfil</p>
            </div>
            {value === false && (
              <CheckCircle2 className="w-5 h-5 text-[#0EA5A0]" />
            )}
          </div>
        </button>
      </div>

      <div className="mt-auto pt-6">
        <Button
          onClick={onNext}
          disabled={value === null}
          className="w-full h-13 rounded-xl font-semibold text-base transition-all"
          style={value !== null ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)', color: 'white' } : undefined}
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Vehicle type selection (Session 17) ──────────────────────────────────

function VehicleTypeStep({
  value, onChange, onNext,
}: {
  value: string; onChange: (v: string) => void; onNext: () => void;
}) {
  const categories: Array<{ label: string; items: VehicleType[] }> = [
    { label: 'Pasajeros', items: vehicleTypes.filter(v => v.category === 'Pasajeros') },
    { label: 'Carga', items: vehicleTypes.filter(v => v.category === 'Carga') },
    { label: 'Especial', items: vehicleTypes.filter(v => v.category === 'Especial') },
  ];
  const selected = vehicleTypes.find(v => v.id === value);
  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={<Car className="w-6 h-6 text-white" />}
        accent="#0EA5A0"
        title="¿Qué tipo de vehículo tenés?"
        subtitle="Tu categoría determina qué viajes recibís y la tarifa que cobrás. Las categorías se validan con la cédula y el seguro."
      />
      <div className="mt-6 space-y-5 flex-1 overflow-y-auto hide-scrollbar -mx-1 px-1">
        {categories.map((cat) => (
          <div key={cat.label}>
            <p className="text-[#6B7F95] text-xs font-semibold uppercase tracking-wider mb-2">
              {cat.label}
            </p>
            <div className="space-y-2">
              {cat.items.map((v) => {
                const Icon = VEHICLE_ICONS_WIZARD[v.icon] || Car;
                const isSelected = value === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => onChange(v.id)}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'border-[#0EA5A0] bg-[#0EA5A0]/10'
                        : 'border-[#1E2A38] bg-[#141B24] hover:border-[#2A3A4E]'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-[#0EA5A0]' : 'bg-[#1E2A38]'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-[#6B7F95]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white text-sm font-semibold truncate">{v.name}</h3>
                        {v.capacity > 1 && (
                          <span className="text-[10px] font-bold bg-[#1E2A38] text-[#0EA5A0] px-1.5 py-0.5 rounded-md">
                            hasta {v.capacity} dest.
                          </span>
                        )}
                      </div>
                      <p className="text-[#6B7F95] text-xs mt-0.5 truncate">{v.description}</p>
                      <p className="text-[#3D5068] text-[10px] mt-0.5">
                        Tarifa: ${v.basePrice} base + ${v.perKm}/km + ${v.perMin}/min
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-[#0EA5A0] flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-6">
        <Button
          onClick={onNext}
          disabled={!value}
          className="w-full h-13 rounded-xl font-semibold text-base transition-all"
          style={value ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)', color: 'white' } : undefined}
        >
          {selected ? `Continuar con ${selected.name}` : 'Elegí una categoría'}
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Vehicle info: patente, marca, modelo, año, color (Session 17) ────────

function VehicleInfoStep({
  plate, brand, model, year, color,
  onPlate, onBrand, onModel, onYear, onColor, onNext,
}: {
  plate: string; brand: string; model: string; year: string; color: string;
  onPlate: (v: string) => void; onBrand: (v: string) => void;
  onModel: (v: string) => void; onYear: (v: string) => void;
  onColor: (v: string) => void;
  onNext: () => void;
}) {
  // Argentine plate formats: AB 123 CD (new) or ABC 123 (old) — at least 6 chars alnum
  const plateValid = plate.replace(/[^A-Za-z0-9]/g, '').length >= 6;
  const brandValid = brand.trim().length >= 2;
  const modelValid = model.trim().length >= 1;
  const yearNum = parseInt(year, 10);
  const yearValid = !year || (yearNum >= 1950 && yearNum <= new Date().getFullYear() + 1);
  const colorValid = color.trim().length >= 2;
  const valid = plateValid && brandValid && modelValid && yearValid && colorValid;

  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={<IdCard className="w-6 h-6 text-white" />}
        accent="#3B82F6"
        title="Datos del vehículo"
        subtitle="Necesitamos los datos del vehículo que vas a usar para dar viajes. Van a aparecer en la app del pasajero cuando aceptes un viaje."
      />
      <div className="space-y-4 mt-6 flex-1 overflow-y-auto hide-scrollbar -mx-1 px-1">
        <div className="space-y-2">
          <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
            Patente
          </Label>
          <Input
            type="text"
            placeholder="Ej: AB 123 CD o ABC123"
            value={plate}
            onChange={(e) => onPlate(e.target.value.toUpperCase())}
            className={`bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base font-mono tracking-widest uppercase ${
              plate && !plateValid ? 'border-red-500/50' : ''
            }`}
            autoFocus
            maxLength={10}
          />
          <p className="text-[#6B7F95] text-xs">
            Formato argentino: AB 123 CD (nuevo) o ABC 123 (viejo)
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
              Marca
            </Label>
            <Input
              type="text"
              placeholder="Ej: Toyota"
              value={brand}
              onChange={(e) => onBrand(e.target.value)}
              className="bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
              Modelo
            </Label>
            <Input
              type="text"
              placeholder="Ej: Corolla"
              value={model}
              onChange={(e) => onModel(e.target.value)}
              className="bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
              Año
            </Label>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="Ej: 2020"
              value={year}
              onChange={(e) => onYear(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={4}
              className={`bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base ${
                year && !yearValid ? 'border-red-500/50' : ''
              }`}
            />
            {year && !yearValid && (
              <p className="text-red-400 text-xs">Año inválido (1950 - {new Date().getFullYear() + 1})</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
              Color
            </Label>
            <Input
              type="text"
              placeholder="Ej: Gris"
              value={color}
              onChange={(e) => onColor(e.target.value)}
              className="bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base"
            />
          </div>
        </div>
      </div>
      <div className="pt-6">
        <Button
          onClick={onNext}
          disabled={!valid}
          className="w-full h-13 rounded-xl font-semibold text-base transition-all"
          style={valid ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)', color: 'white' } : undefined}
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

interface AddressOption {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

function AddressStep({
  value, lat, lng, onChange, error, onNext,
}: {
  value: string; lat?: number; lng?: number;
  onChange: (addr: string, lat?: number, lng?: number) => void;
  error: string; onNext: () => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AddressOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [useCurrent, setUseCurrent] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync prop -> local state when value changes externally (back button)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced Nominatim search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 4) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&countrycodes=ar&limit=5`,
          { headers: { 'Accept-Language': 'es' } }
        );
        if (res.ok) {
          const json = (await res.json()) as Array<{
            display_name: string;
            lat: string;
            lon: string;
            name?: string;
          }>;
          setResults(
            json.map((r) => ({
              name: r.name || r.display_name.split(',')[0],
              address: r.display_name,
              lat: parseFloat(r.lat),
              lng: parseFloat(r.lon),
            }))
          );
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleUseCurrent = () => {
    if (!navigator.geolocation) {
      return;
    }
    setUseCurrent(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // Reverse geocode
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          if (res.ok) {
            const json = await res.json();
            const addr = json.display_name || 'Ubicación actual';
            setQuery(addr);
            onChange(addr, pos.coords.latitude, pos.coords.longitude);
          }
        } catch {
          // Fall back to coords only
          const addr = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          setQuery(addr);
          onChange(addr, pos.coords.latitude, pos.coords.longitude);
        } finally {
          setUseCurrent(false);
        }
      },
      () => setUseCurrent(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const valid = value.trim().length > 5 && lat != null && lng != null;

  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={<MapPin className="w-6 h-6 text-white" />}
        accent="#10B981"
        title="Tu domicilio"
        subtitle="Lo usamos para sugerirlo como punto de partida cuando pidas un viaje."
      />

      <div className="mt-6 space-y-3">
        <div className="space-y-2">
          <Label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
            Dirección
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3D5068]" />
            <Input
              type="text"
              placeholder="Ej: Av. Corrientes 1234, CABA"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // Reset coords if user edits text manually
                if (value && e.target.value !== value) {
                  onChange(e.target.value, undefined, undefined);
                }
              }}
              className="pl-11 bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] h-13 rounded-xl text-base"
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0EA5A0] animate-spin" />
            )}
          </div>
        </div>

        {/* Use current location */}
        <button
          onClick={handleUseCurrent}
          disabled={useCurrent}
          className="w-full p-3 rounded-xl border border-[#1E2A38] bg-[#141B24] flex items-center gap-3 hover:border-[#0EA5A0] transition-colors disabled:opacity-50"
        >
          {useCurrent ? (
            <Loader2 className="w-4 h-4 text-[#0EA5A0] animate-spin" />
          ) : (
            <MapPin className="w-4 h-4 text-[#0EA5A0]" />
          )}
          <span className="text-[#C8D6E5] text-sm font-medium">
            Usar ubicación actual
          </span>
        </button>

        {/* Search results */}
        {results.length > 0 && (
          <div className="rounded-xl border border-[#1E2A38] bg-[#141B24] overflow-hidden">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(r.address);
                  onChange(r.address, r.lat, r.lng);
                  setResults([]);
                }}
                className={`w-full p-3 text-left hover:bg-[#1A2330] transition-colors flex items-start gap-2 ${
                  i < results.length - 1 ? 'border-b border-[#1E2A38]' : ''
                }`}
              >
                <MapPin className="w-4 h-4 text-[#0EA5A0] mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{r.name}</p>
                  <p className="text-[#6B7F95] text-xs truncate">{r.address}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {error && <ErrorBanner text={error} />}

        {valid && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-300 text-xs">
              Coordenadas: {lat?.toFixed(4)}, {lng?.toFixed(4)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto pt-6">
        <Button
          onClick={onNext}
          disabled={!valid}
          className="w-full h-13 rounded-xl font-semibold text-base transition-all"
          style={valid ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)', color: 'white' } : undefined}
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

function ReviewStep({
  data, submitting, error, onSubmit, onEdit,
}: {
  data: RegData;
  submitting: boolean;
  error: string;
  onSubmit: () => void;
  onEdit: (step: StepId) => void;
}) {
  const rows: Array<{ label: string; value: string; step: StepId; photo?: string }> = [
    { label: 'Nombre', value: data.name, step: 'basic' },
    { label: 'Teléfono', value: data.phone, step: 'basic' },
    ...(data.email ? [{ label: 'Email', value: data.email, step: 'basic' as StepId }] : []),
    ...(data.birthday ? [{ label: 'Cumpleaños', value: new Date(data.birthday + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }), step: 'basic' as StepId }] : []),
    { label: 'DNI', value: data.dni, step: 'dni' },
    { label: 'DNI frente', value: data.dniFront ? '✓ Cargada' : '—', step: 'dni-front', photo: data.dniFront },
    { label: 'DNI dorso', value: data.dniBack ? '✓ Cargada' : '—', step: 'dni-back', photo: data.dniBack },
    { label: 'Selfie', value: data.facePhoto ? '✓ Cargada' : '—', step: 'face', photo: data.facePhoto },
    { label: 'Selfie con DNI', value: data.selfieWithDni ? '✓ Cargada' : '—', step: 'selfie-with-dni', photo: data.selfieWithDni },
    {
      label: 'Conductor',
      value: data.isDriver === true ? 'Sí — pide licencia' : 'Solo pasajero',
      step: 'driver',
    },
  ];
  if (data.isDriver === true) {
    rows.push({
      label: 'Licencia (frente)',
      value: data.licenseFront ? '✓ Cargada' : '—',
      step: 'license-front',
      photo: data.licenseFront,
    });
    rows.push({
      label: 'Licencia (dorso)',
      value: data.licenseBack ? '✓ Cargada' : '—',
      step: 'license-back',
      photo: data.licenseBack,
    });
    // Driver vehicle info (Session 17)
    const selectedVt = vehicleTypes.find(v => v.id === data.vehicleType);
    rows.push({
      label: 'Tipo de vehículo',
      value: selectedVt ? `${selectedVt.name} (cap. ${selectedVt.capacity})` : '—',
      step: 'vehicle-type',
    });
    if (data.vehiclePlate) {
      rows.push({
        label: 'Patente / Vehículo',
        value: `${data.vehiclePlate} · ${data.vehicleBrand} ${data.vehicleModel} ${data.vehicleYear || ''} · ${data.vehicleColor}`.replace(/\s+/g, ' ').trim(),
        step: 'vehicle-info',
      });
    }
    rows.push({
      label: 'Cédula verde/azul (frente)',
      value: data.cedulaVerdeAzul ? '✓ Cargada' : '—',
      step: 'vehicle-cedula',
      photo: data.cedulaVerdeAzul,
    });
    rows.push({
      label: 'Cédula verde/azul (dorso)',
      value: data.cedulaVerdeAzulBack ? '✓ Cargada' : '—',
      step: 'vehicle-cedula-back',
      photo: data.cedulaVerdeAzulBack,
    });
    rows.push({
      label: 'Seguro del vehículo',
      value: data.seguroVehiculo ? '✓ Cargado' : '—',
      step: 'vehicle-seguro',
      photo: data.seguroVehiculo,
    });
  }
  rows.push({ label: 'Domicilio', value: data.address || '—', step: 'address' });

  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={<ShieldCheck className="w-6 h-6 text-white" />}
        accent="#0EA5A0"
        title="Revisá tus datos"
        subtitle="Una vez enviado, tu cuenta queda en revisión. Si algo está mal, podés editar tocando el ítem."
      />

      <div className="mt-6 rounded-2xl border border-[#1E2A38] bg-[#141B24] overflow-hidden">
        {rows.map((row, i) => (
          <button
            key={row.label}
            onClick={() => onEdit(row.step)}
            className={`w-full p-3.5 text-left hover:bg-[#1A2330] transition-colors flex items-center gap-3 ${
              i < rows.length - 1 ? 'border-b border-[#1E2A38]' : ''
            }`}
          >
            {row.photo ? (
              <img
                src={row.photo}
                alt={row.label}
                className="w-10 h-10 rounded-lg object-cover bg-black flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[#1E2A38] flex items-center justify-center flex-shrink-0">
                <span className="text-[#6B7F95] text-xs font-medium">
                  {row.label.charAt(0)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[#6B7F95] text-xs">{row.label}</p>
              <p className="text-white text-sm font-medium truncate">{row.value}</p>
            </div>
            <ArrowLeft className="w-4 h-4 text-[#3D5068] rotate-180" />
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner text={error} />
        </div>
      )}

      <div className="mt-auto pt-6">
        <Button
          onClick={onSubmit}
          disabled={submitting}
          className="w-full h-13 rounded-xl font-semibold text-base transition-all"
          style={!submitting ? { background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)', color: 'white' } : undefined}
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Crear cuenta
            </>
          )}
        </Button>
        <p className="text-[#3D5068] text-xs text-center mt-3">
          Al continuar aceptás los términos de la cooperativa Unira
        </p>
      </div>
    </div>
  );
}

function DoneStep({ name, isDriver }: { name: string; isDriver: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}
      >
        <CheckCircle2 className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">
        ¡Listo, {name.split(' ')[0]}!
      </h1>
      <p className="text-[#8B9DAF] text-sm leading-relaxed max-w-[300px]">
        Tu cuenta fue creada. Ahora necesitamos verificar tu teléfono y correo electrónico para continuar.
        {isDriver ? ' Después de verificar, un admin va a revisar tu solicitud de conductor.' : ''}
      </p>
      <div className="mt-6 flex items-center gap-2 text-[#6B7F95] text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0EA5A0]" />
        Continuando a verificación…
      </div>
    </div>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────────────

function StepHeader({
  icon, accent, title, subtitle,
}: {
  icon: React.ReactNode;
  accent: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
        <p className="text-[#8B9DAF] text-xs leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-red-400 text-xs">{text}</p>
    </div>
  );
}
