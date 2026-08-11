'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/* ============================================================
   Types
   ============================================================ */

interface UserRecord {
  id: string; name: string; phone: string; email?: string; dni?: string;
  role: string; isDriver: boolean; isDriverApproved: boolean; isSocio: boolean;
  isAdmin: boolean; verificationStatus: string; walletBalance: number;
  tripCountAsPassenger: number; tripCountAsDriver: number; totalSpent: number;
  totalEarned: number; averageRating: number; rewardPoints: number; rewardLevel: string;
  dniFront?: string; dniBack?: string; facePhoto?: string; selfieWithDni?: string;
  licenseFront?: string; licenseBack?: string; vehicleType?: string; vehiclePlate?: string;
  vehicleBrand?: string; vehicleModel?: string; vehicleYear?: number; vehicleColor?: string;
  cedulaVerdeAzul?: string; cedulaVerdeAzulBack?: string; seguroVehiculo?: string;
  licenseExpiryDate?: string; seguroExpiryDate?: string; cedulaExpiryDate?: string;
  createdAt: string; source: 'app';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SocioRecord { [key: string]: any; }

interface TripRecord {
  id: string; passengerId: string; driverId?: string; origin?: string;
  destination?: string; fareAmount?: number; status: string; vehicleType?: string; createdAt: string;
}

interface PendingChangeRecord {
  id: string; userId: string; userName?: string; userPhone?: string;
  field: string; oldValue: string; newValue: string; reason: string;
  status: string; reviewedBy?: string; reviewedAt?: string; createdAt: string;
}

/* ============================================================
   Helpers
   ============================================================ */

const formatDate = (d: string) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
};
const formatMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

const FIELD_LABELS: Record<string, string> = {
  phone: 'Teléfono', email: 'Email', vehicleType: 'Tipo de vehículo', vehiclePlate: 'Patente',
  vehicleBrand: 'Marca', vehicleModel: 'Modelo', vehicleYear: 'Año', vehicleColor: 'Color',
  cbuNumber: 'CBU/CVU', cbuAlias: 'Alias CBU', cbuHolderName: 'Titular bancario',
};

const statusBadge = (s: string) => {
  const c: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', verified: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800' };
  const l: Record<string, string> = { pending: 'Pendiente', verified: 'Verificado', rejected: 'Rechazado' };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${c[s] || 'bg-gray-100 text-gray-800'}`}>{l[s] || s}</span>;
};

/* ============================================================
   Image Lightbox with Zoom + Pan + Navigation
   ============================================================ */

function ImageLightbox({ images, startIndex, onClose }: {
  images: { src: string; label: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [rotation, setRotation] = useState(0);
  const go = (i: number) => { setIdx(i); setScale(1); setPos({ x: 0, y: 0 }); setRotation(0); };
  const prev = () => go(idx > 0 ? idx - 1 : images.length - 1);
  const next = () => go(idx < images.length - 1 ? idx + 1 : 0);
  const rotateLeft = () => setRotation((r) => r - 90);
  const rotateRight = () => setRotation((r) => r + 90);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(Math.max(s + (e.deltaY > 0 ? -0.15 : 0.15), 0.3), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setDragging(false);

  // Touch support
  const lastTouch = useRef({ x: 0, y: 0, dist: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouch.current.dist = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1 && scale > 1) {
      setDragging(true);
      setDragStart({ x: e.touches[0].clientX - pos.x, y: e.touches[0].clientY - pos.y });
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = (dist - lastTouch.current.dist) * 0.01;
      setScale((s) => Math.min(Math.max(s + delta, 0.3), 5));
      lastTouch.current.dist = dist;
    } else if (dragging && e.touches.length === 1) {
      setPos({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
    }
  };
  const handleTouchEnd = () => setDragging(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(s + 0.2, 5));
      if (e.key === '-') setScale((s) => Math.max(s - 0.2, 0.3));
      if (e.key === '0') { setScale(1); setPos({ x: 0, y: 0 }); setRotation(0); }
      if (e.key === 'r' || e.key === 'R') setRotation((r) => r + 90);
      if (e.key === 'e' || e.key === 'E') setRotation((r) => r - 90);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  if (images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" ref={containerRef}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="text-white text-sm">
          <span className="text-gray-400">{idx + 1} / {images.length}</span>
          <span className="ml-3">{images[idx].label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); setRotation(0); }} className="text-gray-400 hover:text-white text-xs border border-gray-600 px-2 py-1 rounded">Reset</button>
          <button onClick={rotateLeft} className="text-gray-400 hover:text-white text-sm border border-gray-600 px-2 py-1 rounded" title="Girar izquierda (E)">&#8634;</button>
          <button onClick={rotateRight} className="text-gray-400 hover:text-white text-sm border border-gray-600 px-2 py-1 rounded" title="Girar derecha (R)">&#8635;</button>
          <button onClick={() => setScale((s) => Math.min(s + 0.3, 5))} className="text-gray-400 hover:text-white text-lg w-8 h-8 border border-gray-600 rounded" title="Zoom +">+</button>
          <button onClick={() => setScale((s) => Math.max(s - 0.3, 0.3))} className="text-gray-400 hover:text-white text-lg w-8 h-8 border border-gray-600 rounded" title="Zoom -">-</button>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl ml-2">&times;</button>
        </div>
      </div>

      {/* Main image area */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // If single click and not dragging, close
          if (!dragging && scale <= 1) onClose();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[idx].src}
          alt={images[idx].label}
          draggable={false}
          className="select-none"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: dragging ? 'none' : 'transform 0.15s ease-out',
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl bg-black/30 hover:bg-black/50 w-12 h-12 rounded-full flex items-center justify-center transition-colors">&lsaquo;</button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl bg-black/30 hover:bg-black/50 w-12 h-12 rounded-full flex items-center justify-center transition-colors">&rsaquo;</button>
        </>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto shrink-0 bg-black/50 justify-center">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); go(i); }}
              className={`shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${i === idx ? 'border-blue-400 ring-2 ring-blue-400/50' : 'border-gray-600 opacity-60 hover:opacity-100'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.label} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="text-center text-gray-500 text-[10px] pb-2 shrink-0">
        Rueda mouse / pellizco para zoom &middot; Arrastrar para mover &middot; Flechas para navegar &middot; R / E para girar &middot; Esc para cerrar
      </div>
    </div>
  );
}

/* ============================================================
   Thumbnail Gallery (inline, no window.open)
   ============================================================ */

function ThumbGallery({ docs, onOpen }: { docs: { label: string; url?: string }[]; onOpen: (i: number) => void }) {
  const validDocs = docs.filter((d) => d.url && d.url.length > 5);
  if (validDocs.length === 0) return <span className="text-gray-300 text-xs">Sin docs</span>;
  return (
    <div className="flex gap-1 flex-wrap">
      {validDocs.map((d, i) => {
        // Find the real index in the full docs array
        const realIdx = docs.findIndex((dd) => dd.label === d.label);
        return (
          <button
            key={d.label}
            onClick={(e) => { e.stopPropagation(); onOpen(realIdx); }}
            className="relative group w-8 h-8 rounded border border-gray-200 overflow-hidden bg-gray-50 hover:border-blue-400 hover:ring-2 hover:ring-blue-200 transition-all shrink-0"
            title={d.label}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.url} alt={d.label} className="w-full h-full object-cover" />
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   User Detail Panel
   ============================================================ */

function UserDetail({ user, onClose }: { user: UserRecord; onClose: () => void }) {
  const [lightboxIdx, setLightboxIdx] = useState(-1);

  const allDocs: { label: string; url?: string }[] = [
    { label: 'DNI Frente', url: user.dniFront },
    { label: 'DNI Dorso', url: user.dniBack },
    { label: 'Selfie con DNI', url: user.selfieWithDni },
    { label: 'Foto de rostro', url: user.facePhoto },
    { label: 'Licencia Frente', url: user.licenseFront },
    { label: 'Licencia Dorso', url: user.licenseBack },
    { label: 'Cedula Verde/Azul Frente', url: user.cedulaVerdeAzul },
    { label: 'Cedula Verde/Azul Dorso', url: user.cedulaVerdeAzulBack },
    { label: 'Seguro del vehiculo', url: user.seguroVehiculo },
  ];
  const validDocs = allDocs.filter(d => d.url && d.url.length > 5);

  return (
    <>
      <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
        <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
            <h2 className="text-lg font-bold text-gray-900">{user.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
          </div>
          <div className="p-5 space-y-5">
            <Section title="Datos personales">
              <Row l="Telefono" v={user.phone} />
              <Row l="Email" v={user.email || '-'} />
              <Row l="DNI" v={user.dni || '-'} />
              <Row l="Rol" v={user.isDriver ? 'Conductor' : 'Pasajero'} />
              <Row l="Estado" v={user.verificationStatus} />
              <Row l="Socio cooperativa" v={user.isSocio ? 'Si (5% comision)' : 'No (8% comision)'} />
              <Row l="Registro" v={formatDate(user.createdAt)} />
            </Section>
            {user.isDriver && (
              <Section title="Vehiculo">
                <Row l="Tipo" v={user.vehicleType || '-'} />
                <Row l="Marca" v={user.vehicleBrand || '-'} />
                <Row l="Modelo" v={user.vehicleModel || '-'} />
                <Row l="Anio" v={user.vehicleYear ? String(user.vehicleYear) : '-'} />
                <Row l="Color" v={user.vehicleColor || '-'} />
                <Row l="Patente" v={user.vehiclePlate || '-'} />
                <Row l="Aprobado como conductor" v={user.isDriverApproved ? 'Si' : 'No'} />
              </Section>
            )}
            {user.isDriver && (
              <Section title="Vencimientos">
                <Row l="Licencia" v={user.licenseExpiryDate || 'No cargado'} />
                <Row l="Seguro" v={user.seguroExpiryDate || 'No cargado'} />
                <Row l="Cedula verde/azul" v={user.cedulaExpiryDate || 'No cargado'} />
              </Section>
            )}
            <Section title="Documentacion (click para ampliar con zoom)">
              {validDocs.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {allDocs.filter(d => d.url && d.url.length > 5).map((d, i) => (
                    <button
                      key={d.label}
                      onClick={() => setLightboxIdx(i)}
                      className="border border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 hover:ring-2 hover:ring-blue-200 transition-all group relative"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.url} alt={d.label} className="w-full h-28 object-cover" />
                      <p className="text-[10px] text-gray-500 p-1.5 text-center group-hover:text-blue-600">{d.label}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-4">No hay documentacion cargada</p>
              )}
            </Section>
            <Section title="Estadisticas">
              <Row l="Billetera" v={formatMoney(user.walletBalance)} />
              <Row l="Viajes como pasajero" v={String(user.tripCountAsPassenger)} />
              <Row l="Viajes como conductor" v={String(user.tripCountAsDriver)} />
              <Row l="Total gastado" v={formatMoney(user.totalSpent)} />
              <Row l="Total ganado" v={formatMoney(user.totalEarned)} />
              <Row l="Calificacion promedio" v={user.averageRating > 0 ? `${user.averageRating.toFixed(1)}/5` : '-'} />
              <Row l="Puntos reward" v={String(user.rewardPoints)} />
              <Row l="Nivel reward" v={user.rewardLevel || '-'} />
            </Section>
          </div>
        </div>
      </div>
      {lightboxIdx >= 0 && (
        <ImageLightbox
          images={validDocs.map(d => ({ src: d.url!, label: d.label }))}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(-1)}
        />
      )}
    </>
  );
}

/* ============================================================
   Socio Detail Panel (ALL form fields)
   ============================================================ */

function SocioDetail({ socio, onClose }: { socio: SocioRecord; onClose: () => void }) {
  const [lightboxIdx, setLightboxIdx] = useState(-1);

  const dniImages: { src: string; label: string }[] = [];
  if (socio.dni_frente_url) dniImages.push({ src: socio.dni_frente_url, label: 'DNI Frente' });
  if (socio.dni_dorso_url) dniImages.push({ src: socio.dni_dorso_url, label: 'DNI Dorso' });

  // All form fields with readable labels
  const fields: [string, string][] = [
    ['nombre', 'Nombre completo'],
    ['telefono', 'Telefono'],
    ['email', 'Email'],
    ['ciudad', 'Ciudad'],
    ['provincia', 'Provincia'],
    ['nacionalidad', 'Nacionalidad'],
    ['vehiculo', 'Vehiculo/s'],
    ['marca_modelo', 'Marca y modelo'],
    ['mas_vehiculos', 'Mas vehiculos (detalle)'],
    ['apps_actuales', 'Apps actuales'],
    ['nivel_estudios', 'Nivel de estudios'],
    ['profesion', 'Profesion'],
    ['idiomas', 'Idiomas'],
    ['horas_dia', 'Horas por dia'],
    ['dias_semana', 'Dias por semana'],
    ['ingreso_mensual', 'Ingreso mensual'],
    ['vivienda', 'Vivienda'],
    ['llega_comodo', 'Llega comodo a destino?'],
    ['problema_principal', 'Problema principal'],
    ['otro_problema', 'Otro problema'],
    ['seguridad_uber', 'Seguridad Uber (1-10)'],
    ['seguridad_didi', 'Seguridad Didi (1-10)'],
    ['seguridad_cabify', 'Seguridad Cabify (1-10)'],
    ['seguridad_indrive', 'Seguridad InDrive (1-10)'],
    ['situaciones_inseguridad', 'Situaciones inseguras'],
    ['tiempo_perdido', 'Tiempo perdido por dia'],
    ['solucion_tiempo', 'Solucion para el tiempo perdido'],
    ['distancia_busqueda', 'Distancia de busqueda'],
    ['distancia_maxima', 'Distancia maxima'],
    ['funciones_app', 'Funciones deseadas en app'],
    ['mejora_clave', 'Mejora clave'],
    ['prioridades', 'Prioridades'],
    ['votar_decisiones', 'Votar decisiones?'],
    ['interes_5', 'Interes 5% comision'],
    ['aporte_mensual', 'Aporte mensual'],
    ['socio_fundador', 'Socio fundador'],
    ['cuando_comenzar', 'Cuando comenzaria'],
    ['dudas', 'Dudas / comentarios'],
  ];

  return (
    <>
      <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
        <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
            <h2 className="text-lg font-bold text-gray-900">{socio.nombre || 'Socio Potencial'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
          </div>
          <div className="p-5 space-y-5">
            <Section title="Datos del formulario de inscripcion">
              {fields.map(([key, label]) => {
                const val = socio[key];
                if (val === undefined || val === null || val === '') return null;
                return <Row key={key} l={label} v={String(val)} />;
              })}
              <Row l="Verificado" v={socio.verificado ? 'Si' : 'No'} />
              <Row l="Fecha de registro" v={formatDate(socio.created_at)} />
            </Section>
            {dniImages.length > 0 && (
              <Section title="Documentacion DNI (click para zoom)">
                <div className="grid grid-cols-2 gap-3">
                  {dniImages.map((img, i) => (
                    <button
                      key={img.label}
                      onClick={() => setLightboxIdx(i)}
                      className="border border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 hover:ring-2 hover:ring-blue-200 transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt={img.label} className="w-full h-40 object-cover" />
                      <p className="text-xs text-gray-500 p-2 text-center">{img.label}</p>
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
      {lightboxIdx >= 0 && (
        <ImageLightbox images={dniImages} startIndex={lightboxIdx} onClose={() => setLightboxIdx(-1)} />
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3><div className="space-y-1">{children}</div></div>;
}
function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-50 gap-2">
      <span className="text-sm text-gray-500 shrink-0">{l}</span>
      <span className="text-sm font-medium text-gray-900 text-right break-all">{v}</span>
    </div>
  );
}

/* ============================================================
   Main Dashboard Page
   ============================================================ */

export default function DashboardPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sociosError, setSociosError] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'socios' | 'trips' | 'changes'>('users');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [socios, setSocios] = useState<SocioRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChangeRecord[]>([]);
  const [processingChange, setProcessingChange] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [selectedSocio, setSelectedSocio] = useState<SocioRecord | null>(null);
  const [lightboxImages, setLightboxImages] = useState<{ src: string; label: string }[]>([]);
  const [lightboxStart, setLightboxStart] = useState(0);

  // ── Mobile sidebar state ──
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchData = useCallback(async (tab: string) => {
    setLoading(true);
    setError(''); setSociosError('');
    try {
      const res = await fetch(`/api/dashboard?password=${encodeURIComponent(password)}&section=${tab}`);
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error de servidor'); }
      const data = await res.json();
      if (tab === 'users' || tab === 'all') { setUsers(data.users || []); setUserStats(data.userStats || {}); if (data.usersError) setError(data.usersError); }
      if (tab === 'socios' || tab === 'all') { setSocios(data.socios || []); if (data.sociosError) setSociosError(data.sociosError); }
      if (tab === 'trips' || tab === 'all') { setTrips(data.trips || []); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Error desconocido'); }
    finally { setLoading(false); }
  }, [password]);

  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); setAuthenticated(true); fetchData('all'); };
  const handleTabChange = (tab: 'users' | 'socios' | 'trips' | 'changes') => { setActiveTab(tab); fetchData(tab); setSidebarOpen(false); };

  const fetchPendingChanges = useCallback(async () => {
    try {
      const res = await fetch('/api/changes?all=true');
      if (res.ok) {
        const data = await res.json();
        setPendingChanges(data.changes || []);
      }
    } catch { /* silent */ }
  }, []);

  const handleReviewChange = async (id: string, action: 'approved' | 'rejected') => {
    setProcessingChange(id);
    try {
      const res = await fetch('/api/changes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: action }),
      });
      if (res.ok) {
        setPendingChanges(prev => prev.map(c => c.id === id ? { ...c, status: action, reviewedAt: new Date().toISOString() } : c));
      } else {
        alert('Error al procesar la solicitud');
      }
    } catch { alert('Error de conexión'); }
    finally { setProcessingChange(null); }
  };

  useEffect(() => {
    if (authenticated) { fetchPendingChanges(); }
  }, [authenticated, fetchPendingChanges]);

  const filterBySearch = <T extends Record<string, unknown>>(records: T[]): T[] => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)));
  };

  const openUserLightbox = (user: UserRecord, startLabel: string) => {
    const docs = [
      { label: 'DNI Frente', url: user.dniFront }, { label: 'DNI Dorso', url: user.dniBack },
      { label: 'Selfie DNI', url: user.selfieWithDni }, { label: 'Foto rostro', url: user.facePhoto },
      { label: 'Licencia Frente', url: user.licenseFront }, { label: 'Licencia Dorso', url: user.licenseBack },
      { label: 'Cedula Frente', url: user.cedulaVerdeAzul }, { label: 'Cedula Dorso', url: user.cedulaVerdeAzulBack },
      { label: 'Seguro', url: user.seguroVehiculo },
    ].filter(d => d.url && d.url.length > 5);
    const idx = docs.findIndex(d => d.label === startLabel);
    setLightboxImages(docs.map(d => ({ src: d.url!, label: d.label })));
    setLightboxStart(idx >= 0 ? idx : 0);
  };

  /* ---- LOGIN ---- */
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D1B2A] to-[#1B3A4B] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-512.png" alt="TEYEVO" className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow-lg" />
            <h1 className="text-2xl font-bold text-[#0D1B2A]">TEYEVO Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Panel de Registros y Documentacion</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D1B2A] outline-none" required />
            <button type="submit" className="w-full bg-[#0D1B2A] text-white py-3 rounded-xl font-medium hover:bg-[#1B3A4B] transition-colors">Ingresar</button>
          </form>
        </div>
      </div>
    );
  }

  const filteredUsers = filterBySearch(users);
  const filteredSocios = filterBySearch(socios);
  const filteredTrips = filterBySearch(trips);

  /* ---- DASHBOARD ---- */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0D1B2A] text-white px-4 py-3 sticky top-0 z-20 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Hamburger menu (mobile) */}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Menu">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-512.png" alt="TEYEVO" className="w-8 h-8 rounded-lg hidden sm:block" />
            <div>
              <h1 className="text-lg font-bold leading-tight">TEYEVO Admin</h1>
              <p className="text-gray-300 text-[10px] leading-tight hidden sm:block">Registros y Documentacion</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="px-3 py-1.5 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 outline-none w-32 sm:w-48" />
            <button onClick={() => { setAuthenticated(false); setPassword(''); }} className="text-xs text-gray-300 hover:text-white border border-white/20 px-3 py-1.5 rounded-lg whitespace-nowrap">Salir</button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Mobile sidebar drawer */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-white z-30 shadow-2xl transform transition-transform duration-300 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="bg-[#0D1B2A] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-512.png" alt="TEYEVO" className="w-8 h-8 rounded-lg" />
            <span className="text-white font-bold">Menu</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d='M6 18L18 6M6 6l12 12' /></svg>
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {(['users', 'socios', 'trips', 'changes'] as const).map((tab) => (
            <button key={tab} onClick={() => handleTabChange(tab)} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${activeTab === tab ? 'bg-[#0D1B2A] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              <span>{tab === 'users' ? 'Usuarios' : tab === 'socios' ? 'Socios' : tab === 'trips' ? 'Viajes' : 'Cambios'}</span>
              {tab === 'changes' && pendingChanges.filter(c => c.status === 'pending').length > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{pendingChanges.filter(c => c.status === 'pending').length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
 <button onClick={() => { setAuthenticated(false); setPassword(''); }} className="w-full text-center text-sm text-red-500 hover:text-red-700 font-medium py-2">Cerrar sesion</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {[
            { l: 'Total App', v: userStats.total || 0, c: 'text-[#0D1B2A]' },
            { l: 'Pendientes', v: userStats.pending || 0, c: 'text-yellow-600' },
            { l: 'Verificados', v: userStats.verified || 0, c: 'text-green-600' },
            { l: 'Conductores', v: userStats.drivers || 0, c: 'text-blue-600' },
            { l: 'Cond. Aprob.', v: userStats.approvedDrivers || 0, c: 'text-emerald-600' },
            { l: 'Socios Web', v: socios.length, c: 'text-purple-600' },
          ].map((s) => (
            <div key={s.l} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
              <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
              <p className="text-[10px] text-gray-500">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Tabs — hidden on mobile (sidebar handles nav) */}
        <div className="hidden lg:flex gap-1 bg-gray-200 rounded-xl p-1 mb-4">
          {(['users', 'socios', 'trips', 'changes'] as const).map((tab) => (
            <button key={tab} onClick={() => handleTabChange(tab)} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors relative ${activeTab === tab ? 'bg-white shadow-sm text-[#0D1B2A]' : 'text-gray-500'}`}>
              {tab === 'users' ? `Usuarios (${users.length})` : tab === 'socios' ? `Socios (${socios.length})` : tab === 'trips' ? `Viajes (${trips.length})` : `Cambios`}
              {tab === 'changes' && pendingChanges.filter(c => c.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{pendingChanges.filter(c => c.status === 'pending').length}</span>
              )}
            </button>
          ))}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
        {sociosError && <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-xl mb-4 text-sm">{sociosError}</div>}
        {loading && <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0D1B2A]" /><span className="ml-3 text-gray-500">Cargando...</span></div>}

        {/* ============= USERS TABLE ============= */}
        {!loading && activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Nombre</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Telefono</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">DNI</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500 text-[10px]">Estado</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500 text-[10px]">Conductor</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 text-[10px]">Billetera</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500 text-[10px]">Viajes</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500 text-[10px]">Documentos</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => setSelectedUser(u)}>
                      <td className="px-3 py-2 font-medium text-gray-900 max-w-[120px] truncate">{u.name}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">{u.phone}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{u.dni || '-'}</td>
                      <td className="px-3 py-2 text-center">{statusBadge(u.verificationStatus)}</td>
                      <td className="px-3 py-2 text-center">
                        {u.isDriver ? <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${u.isDriverApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{u.isDriverApproved ? 'OK' : 'Pend.'}</span> : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px]">{formatMoney(u.walletBalance)}</td>
                      <td className="px-3 py-2 text-center text-[10px] text-gray-500">{u.tripCountAsPassenger}p / {u.tripCountAsDriver}c</td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <ThumbGallery docs={[
                          { label: 'DNI F', url: u.dniFront }, { label: 'DNI D', url: u.dniBack },
                          { label: 'Selfie', url: u.selfieWithDni }, { label: 'Foto', url: u.facePhoto },
                          { label: 'Lic F', url: u.licenseFront }, { label: 'Lic D', url: u.licenseBack },
                          { label: 'Ced A', url: u.cedulaVerdeAzul }, { label: 'Ced D', url: u.cedulaVerdeAzulBack },
                          { label: 'Seguro', url: u.seguroVehiculo },
                        ]} onOpen={(i) => openUserLightbox(u, '')} />
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-[10px] whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">No hay usuarios</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400">Click en cualquier fila para ver todos los datos y documentos. Click en miniaturas para zoom.</div>
          </div>
        )}

        {/* ============= SOCIOS TABLE ============= */}
        {!loading && activeTab === 'socios' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Nombre</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Telefono</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Ciudad</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Vehiculo</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Apps actuales</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Problema principal</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500 text-[10px]">DNI</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSocios.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => setSelectedSocio(s)}>
                      <td className="px-3 py-2 font-medium text-gray-900 max-w-[120px] truncate">{s.nombre || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">{s.telefono || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate text-xs">{s.email || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{s.ciudad || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs max-w-[80px] truncate">{s.vehiculo || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs max-w-[80px] truncate">{s.apps_actuales || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs max-w-[100px] truncate">{s.problema_principal || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        {s.dni_frente_url ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const imgs: { src: string; label: string }[] = [];
                              if (s.dni_frente_url) imgs.push({ src: s.dni_frente_url, label: 'DNI Frente' });
                              if (s.dni_dorso_url) imgs.push({ src: s.dni_dorso_url, label: 'DNI Dorso' });
                              setLightboxImages(imgs); setLightboxStart(0);
                            }}
                            className="text-blue-500 hover:text-blue-700 text-xs underline"
                          >Ver DNI</button>
                        ) : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-[10px] whitespace-nowrap">{formatDate(s.created_at)}</td>
                    </tr>
                  ))}
                  {filteredSocios.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">No hay socios potenciales</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400">Click en cualquier fila para ver TODAS las preguntas y respuestas del formulario.</div>
          </div>
        )}

        {/* ============= TRIPS TABLE ============= */}
        {!loading && activeTab === 'trips' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">ID</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Pasajero</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Origen</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Destino</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 text-[10px]">Tarifa</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-500 text-[10px]">Estado</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 text-[10px]">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrips.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-blue-50/30">
                      <td className="px-3 py-2 text-gray-400 font-mono text-[10px]">{t.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">{t.passengerId?.slice(0, 8) || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[100px] truncate text-xs">{t.origin || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[100px] truncate text-xs">{t.destination || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px]">{formatMoney(t.fareAmount || 0)}</td>
                      <td className="px-3 py-2 text-center"><span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-100 text-blue-800">{t.status}</span></td>
                      <td className="px-3 py-2 text-gray-400 text-[10px] whitespace-nowrap">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                  {filteredTrips.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No hay viajes</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============= CHANGES TABLE ============= */}
        {activeTab === 'changes' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Solicitudes de cambio de datos</h2>
                <button onClick={fetchPendingChanges} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Actualizar</button>
              </div>
              {pendingChanges.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">No hay solicitudes de cambio</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {pendingChanges.map((c) => (
                    <div key={c.id} className={`px-4 py-3 ${c.status === 'pending' ? 'bg-amber-50/30' : c.status === 'approved' ? 'bg-green-50/30' : 'bg-red-50/30'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">{c.userName || 'Usuario'}</span>
                            <span className="text-xs text-gray-400">{c.userPhone || ''}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${c.status === 'pending' ? 'bg-amber-100 text-amber-700' : c.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {c.status === 'pending' ? 'Pendiente' : c.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">{FIELD_LABELS[c.field] || c.field}</span>
                            {c.oldValue && <span className="text-gray-400"> — Anterior: <span className="line-through">{c.field === 'cbuNumber' ? c.oldValue.slice(-4).padStart(c.oldValue.length, '•') : c.oldValue}</span></span>}
                            {c.newValue && <span className="text-green-700 font-medium"> — Nuevo: {c.field === 'cbuNumber' ? c.newValue.slice(-4).padStart(c.newValue.length, '•') : c.newValue}</span>}
                          </p>
                          {c.reason && <p className="text-[10px] text-gray-400 mt-0.5">Motivo: {c.reason}</p>}
                          <p className="text-[10px] text-gray-300 mt-1">{formatDate(c.createdAt)}</p>
                        </div>
                        {c.status === 'pending' && (
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => handleReviewChange(c.id, 'approved')}
                              disabled={processingChange === c.id}
                              className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1"
                            >
                              {processingChange === c.id ? <span className="animate-spin">⏳</span> : '✓'} Aprobar
                            </button>
                            <button
                              onClick={() => handleReviewChange(c.id, 'rejected')}
                              disabled={processingChange === c.id}
                              className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1"
                            >
                              {processingChange === c.id ? <span className="animate-spin">⏳</span> : '✗'} Rechazar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom tab bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 safe-bottom">
        <div className="flex">
          {(['users', 'socios', 'trips', 'changes'] as const).map((tab) => (
            <button key={tab} onClick={() => handleTabChange(tab)} className={`flex-1 py-2.5 text-center text-[10px] font-medium transition-colors relative ${activeTab === tab ? 'text-[#0D1B2A]' : 'text-gray-400'}`}>
              <span>{tab === 'users' ? 'Usuarios' : tab === 'socios' ? 'Socios' : tab === 'trips' ? 'Viajes' : 'Cambios'}</span>
              {tab === 'changes' && pendingChanges.filter(c => c.status === 'pending').length > 0 && (
                <span className="absolute top-1 right-1/4 w-2 h-2 rounded-full bg-red-500" />
              )}
              {activeTab === tab && <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-[#0D1B2A] rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* Detail panels */}
      {selectedUser && <UserDetail user={selectedUser} onClose={() => setSelectedUser(null)} />}
      {selectedSocio && <SocioDetail socio={selectedSocio} onClose={() => setSelectedSocio(null)} />}

      {/* Global lightbox for inline thumbnails */}
      {lightboxImages.length > 0 && (
        <ImageLightbox images={lightboxImages} startIndex={lightboxStart} onClose={() => setLightboxImages([])} />
      )}
    </div>
  );
}
