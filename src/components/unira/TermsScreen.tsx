'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Camera,
  Mic,
  MapPin,
  Bell,
  Video,
  Lock,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

const TERMS_VERSION = '1.0';
const TERMS_DATE = '27 de julio de 2026';

// ─── Component ───────────────────────────────────────────────────────────────

export function TermsScreen() {
  const store = useAppStore();
  const [expandedSection, setExpandedSection] = useState<string | null>('intro');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptRecording, setAcceptRecording] = useState(false);
  const [acceptPermissions, setAcceptPermissions] = useState(false);
  const [saving, setSaving] = useState(false);

  const allAccepted = acceptTerms && acceptPrivacy && acceptPermissions;
  // Recording consent is OPTIONAL — user can decline and still use the app,
  // they just won't be able to start trip recordings.
  const recordingOptional = true;

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  const handleAccept = async () => {
    if (!allAccepted || !store.user) return;
    setSaving(true);
    // Patch the user locally + (best-effort) on the server
    const now = new Date().toISOString();
    const updatedUser = {
      ...store.user,
      termsAcceptedAt: now,
      termsVersion: TERMS_VERSION,
      recordingConsentGlobal: acceptRecording,
    };
    store.setUser(updatedUser);
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termsAcceptedAt: now,
          termsVersion: TERMS_VERSION,
          recordingConsentGlobal: acceptRecording,
        }),
      });
    } catch (err) {
      console.warn('[terms] sync failed (non-blocking):', err);
    } finally {
      setSaving(false);
      store.showToast('Términos aceptados. ¡Listo para usar TEYEVO!', 'success');
      store.setCurrentScreen('role');
    }
  };

  const sections = useMemo(
    () => [
      {
        id: 'intro',
        icon: FileText,
        title: '1. Introducción y aceptación',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              Bienvenido/a a <strong>TEYEVO</strong> (en adelante &laquo;la App&raquo;), operada por la <strong>Cooperativa UNIRA</strong> (en adelante &laquo;la Cooperativa&raquo;), con domicilio en CABA, Argentina.
            </p>
            <p>
              Al registrarse y utilizar la App, el usuario (en adelante &laquo;el Usuario&raquo; o &laquo;vos&raquo;) acepta de forma libre, expresa e informada los presentes Términos y Condiciones (TyC), la Política de Privacidad y, de manera opcional, el consentimiento para grabaciones de viajes.
            </p>
            <p>
              Si no estás de acuerdo con alguno de los términos, no debes continuar con el registro ni utilizar la App. El uso continuado después de cambios notificados constituye aceptación de la versión vigente.
            </p>
            <p>
              <strong>Versión:</strong> {TERMS_VERSION} — <strong>Fecha:</strong> {TERMS_DATE}.
            </p>
          </div>
        ),
      },
      {
        id: 'service',
        icon: Shield,
        title: '2. Descripción del servicio',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              TEYEVO es una plataforma de movilidad y envíos que conecta a usuarios pasajeros con conductores de la cooperativa, y permite solicitar servicios de transporte de personas, delivery de alimentos, envíos de paquetes y servicios de transporte especial (mascotas, mudanzas, etc.).
            </p>
            <p>
              La App no es un servicio de transporte público regulado; los conductores son socios cooperativistas que prestan el servicio bajo su propia responsabilidad profesional. La Cooperativa actúa como intermediaria tecnológica y administrativa.
            </p>
            <p>
              El Usuario reconoce que la disponibilidad del servicio puede variar según zona, horario y cantidad de conductores conectados, y que la Cooperativa no garantiza la asignación inmediata de un conductor.
            </p>
          </div>
        ),
      },
      {
        id: 'registration',
        icon: FileText,
        title: '3. Registro y verificación de identidad',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              Para usar la App debés registrarte con nombre y apellido válido, DNI argentino, fecha de nacimiento, correo electrónico y teléfono. La información debe ser veraz y actualizada.
            </p>
            <p>
              Para conductores, se requiere además licencia de conducir vigente, cédula del vehículo (verde o azul), seguro vehicular vigente y datos del vehículo (patente, marca, modelo, año, color). El alta como conductor está sujeta a aprobación por parte de la Cooperativa.
            </p>
            <p>
              La verificación de identidad se realiza mediante selfie y fotos de la documentación. La Cooperativa puede rechazar solicitudes de registro o suspender cuentas en caso de información falsa o documentación adulterada, sin perjuicio de las acciones legales correspondientes (Ley 25.326 de Protección de Datos Personales).
            </p>
          </div>
        ),
      },
      {
        id: 'permissions',
        icon: Camera,
        title: '4. Permisos de la App (cámara, micrófono, ubicación, notificaciones)',
        body: (
          <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
            <p>
              La App solicita los siguientes permisos del dispositivo. Cada uno puede ser revocado desde la configuración del sistema operativo en cualquier momento:
            </p>
            <div className="space-y-2 pl-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#0EA5A0] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Ubicación (GPS):</p>
                  <p>Necesaria para geolocalizar al Usuario, calcular tarifas según distancia y mostrar tu posición al conductor. Se recopila en segundo plano durante un viaje activo y se detiene al finalizarlo.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Camera className="w-3.5 h-3.5 text-[#0EA5A0] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Cámara:</p>
                  <p>Usada para verificar identidad (selfie de registro), fotografiar documentación (DNI, licencia, cédula, seguro) y opcionalmente grabar video durante viajes (con consentimiento explícito cada vez).</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mic className="w-3.5 h-3.5 text-[#0EA5A0] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Micrófono:</p>
                  <p>Usado únicamente para grabar audio durante un viaje cuando lo activás explícitamente. No se graba audio en segundo plano.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Bell className="w-3.5 h-3.5 text-[#0EA5A0] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Notificaciones:</p>
                  <p>Para avisarte sobre el estado de tus viajes, mensajes del conductor/a, novedades de la cooperativa y alertas de seguridad.</p>
                </div>
              </div>
            </div>
            <p>
              Los permisos se solicitan en el onboarding inicial y podés revocarlos cuando quieras. Algunos servicios (como pedir viajes) dejan de funcionar si revocás el permiso de ubicación.
            </p>
          </div>
        ),
      },
      {
        id: 'recording',
        icon: Video,
        title: '5. Grabación de viajes (audio/video) — CONSENTIMIENTO OPCIONAL',
        body: (
          <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 mb-1">Marco legal — Ley 25.326 (Datos Personales) y arts. 75/77 del Código Penal</p>
                <p className="text-amber-800">
                  La grabación de audio/video de otra persona sin su consentimiento puede constituir un delito en Argentina. Por eso TEYEVO implementó un sistema de consentimiento mutuo: ninguna grabación comienza sin que ambas partes estén notificadas y el iniciador dé su consentimiento explícito.
                </p>
              </div>
            </div>
            <p>
              La grabación de viajes es <strong>opcional, voluntaria y por viaje</strong>. No es obligatoria para usar la App. Se ofrece como herramienta de respaldo ante eventuales disputas por calificaciones o incidentes durante el viaje.
            </p>
            <p>
              <strong>Cómo funciona:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cualquiera de las dos partes (pasajero/a o conductor/a) puede iniciar la grabación desde la pantalla del viaje activo.</li>
              <li>Antes de iniciar, se muestra un modal de consentimiento que explica el propósito, la duración del almacenamiento (30 días) y el acceso restringido.</li>
              <li>Apenas comienza la grabación, la App muestra un indicador visual permanente <strong>&laquo;Grabando»</strong> visible para ambas partes en sus respectivos dispositivos.</li>
              <li>La otra parte recibe una notificación push informando que se inició la grabación.</li>
              <li>La grabación se almacena cifrada y solo puede ser accedida por la Cooperativa ante un reclamo formal.</li>
            </ul>
            <p>
              <strong>Retención:</strong> 30 días desde la finalización del viaje. Vencido ese plazo, se elimina automáticamente. Si hay un reclamo abierto, la retención se extiende hasta la resolución del caso.
            </p>
            <p>
              <strong>Acceso:</strong> Solo personal autorizado de la Cooperativa, ante presentación de un reclamo formal con identificación del viaje. La grabación nunca se publica, no se comparte con terceros ni se usa para publicidad.
            </p>
            <p>
              <strong>Tus derechos:</strong> Podés solicitar acceso, rectificación o supresión anticipada de la grabación escribiendo a <a className="text-[#0EA5A0] underline" href="mailto:admin@unira.com.ar">admin@unira.com.ar</a>. La supresión anticipada puede demorar hasta 72 hs hábiles.
            </p>
            <p>
              Al marcar el consentimiento global de grabación abajo, manifestás tu disposición a participar del sistema. <strong>De todas formas, cada grabación requerirá tu consentimiento explícito en el momento.</strong>
            </p>
          </div>
        ),
      },
      {
        id: 'privacy',
        icon: Lock,
        title: '6. Política de privacidad y datos personales',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              La Cooperativa es responsable del tratamiento de los datos personales recopilados, en cumplimiento de la Ley 25.326 de Protección de Datos Personales y su reglamentación (Decreto 1558/2001) y la Disposición 11/2006 de la AAIP.
            </p>
            <p>
              <strong>Datos recopilados:</strong> identidad (nombre, DNI, fecha de nacimiento), contacto (email, teléfono), ubicación, fotos de documentación, información de viajes (origen, destino, horarios, tarifa), grabaciones opcionales y datos técnicos del dispositivo.
            </p>
            <p>
              <strong>Finalidad:</strong> prestación del servicio de movilidad, verificación de identidad, prevención de fraude, resolución de disputas, cumplimiento de obligaciones legales (facturación, AFIP) y mejoras en la calidad del servicio.
            </p>
            <p>
              <strong>Base legal del tratamiento:</strong> consentimiento del titular (art. 5 Ley 25.326) y cumplimiento de obligaciones contractuales.
            </p>
            <p>
              <strong>Transferencia a terceros:</strong> tus datos no se venden ni se comparten con fines comerciales. Pueden compartirse con autoridades judiciales o de seguridad en caso de requerimiento legal, y con proveedores de servicios (pagos, SMS, mapas) bajo contratos de confidencialidad.
            </p>
            <p>
              <strong>Conservación:</strong> los datos se conservan mientras la cuenta esté activa y hasta 10 años después para cumplimiento de obligaciones fiscales (RG AFIP). Las grabaciones de viajes se eliminan a los 30 días salvo reclamo abierto.
            </p>
            <p>
              <strong>Derechos ARCO-P:</strong> acceso, rectificación, cancelación, oposición y portabilidad. Podés ejercerlos escribiendo a <a className="text-[#0EA5A0] underline" href="mailto:admin@unira.com.ar">admin@unira.com.ar</a>. La respuesta se brinda dentro de los 10 días hábiles (art. 16 Ley 25.326).
            </p>
          </div>
        ),
      },
      {
        id: 'safety',
        icon: Shield,
        title: '7. Seguridad y botón de pánico (SOS)',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              La App incluye un botón de pánico (SOS) visible durante los viajes activos. Al pulsarlo:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Se realiza una llamada telefónica al 911 (emergencias).</li>
              <li>Se notifica al panel de la Cooperativa con tu ubicación en tiempo real.</li>
              <li>Se genera un enlace de seguimiento en vivo accesible para los contactos que decidas.</li>
            </ul>
            <p>
              <strong>Zonas con advertencia de seguridad:</strong> la App marca en el mapa barrios con antecedentes documentados de inseguridad. La advertencia es informativa y no bloquea viajes; el Usuario decide si continúa.
            </p>
            <p>
              La Cooperativa no se responsabiliza por la respuesta de las fuerzas de seguridad ni por demoras en la atención del 911. La función SOS depende de la disponibilidad de señal celular y de la cooperación de las autoridades.
            </p>
          </div>
        ),
      },
      {
        id: 'ratings',
        icon: FileText,
        title: '8. Calificaciones y anti-represalia',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              Al finalizar cada viaje, ambas partes pueden calificarse mutuamente con 1 a 5 estrellas, dejando un motivo y un comentario opcional.
            </p>
            <p>
              <strong>Privacidad absoluta:</strong> las calificaciones son <strong>completamente anónimas y permanentes</strong>. Ninguna de las dos partes podrá saber en ningún momento quién le puso qué estrellas ni qué comentario escribió. Esta regla no tiene excepciones. El anonimato protege tanto al pasajero como al conductor de represalias, presiones o conflictos.
            </p>
            <p>
              Si no calificás al otro usuario dentro de los 7 días posteriores al viaje, tu reseña no se computará (la de la otra parte sí se incluirá en el promedio si ya la envió). Pasado ese plazo, la oportunidad de calificar expira.
            </p>
            <p>
              En caso de calificación injusta o sospecha de abuso, podés respaldar tu descargo con la grabación del viaje (si la hubiere) enviando un reclamo a la Cooperativa. La Cooperativa revisará el caso de forma confidencial y, de comprobarse la falsedad, retirará la calificación del promedio. La otra parte nunca sabrá quién inició el reclamo.
            </p>
            <p>
              El abuso del sistema de calificaciones (calificaciones coordinadas, falsas o extorsivas) es motivo de suspensión de cuenta.
            </p>
          </div>
        ),
      },
      {
        id: 'payments',
        icon: FileText,
        title: '9. Tarifas, comisiones y pagos',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              La tarifa de cada viaje se calcula según el tipo de vehículo, distancia recorrida, tiempo estimado y demanda. El monto se muestra al pasajero antes de confirmar el viaje.
            </p>
            <p>
              <strong>Comisión de la Cooperativa:</strong> se retiene un porcentaje de la tarifa para el sostenimiento de la plataforma, atención al usuario y trámites administrativos. La comisión es del <strong>5% para socios de la Cooperativa</strong> y <strong>8% para no socios</strong>. El conductor ve el desglose (tarifa, comisión, neto) antes de aceptar cada viaje.
            </p>
            <p>
              <strong>Métodos de pago:</strong> efectivo, tarjeta de crédito y tarjeta de débito (según disponibilidad por zona). El conductor puede configurar qué métodos acepta desde su perfil.
            </p>
            <p>
              Los pagos con tarjeta se procesan a través de procesadores certificados PCI-DSS. La Cooperativa no almacena datos completos de tarjetas en sus servidores.
            </p>
          </div>
        ),
      },
      {
        id: 'obligations',
        icon: FileText,
        title: '10. Obligaciones del Usuario y del conductor',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              <strong>Obligaciones del pasajero:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Brindar información de ubicación y destino precisa.</li>
              <li>Esperar al conductor en el punto acordado (tolerancia 5 minutos).</li>
              <li>Tratar al conductor con respeto; el maltrato verbal o físico es causal de suspensión.</li>
              <li>Abonar la tarifa según el método acordado.</li>
              <li>No consumir alimentos ni fumar dentro del vehículo sin autorización.</li>
            </ul>
            <p>
              <strong>Obligaciones del conductor:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Mantener el vehículo en condiciones de seguridad e higiene.</li>
              <li>Cumplir con las normas de tránsito (Ley 24.449 y modificatorias).</li>
              <li>Respetar la tarifa calculada por la App; no se permiten cobros adicionales fuera del sistema.</li>
              <li>Tratar al pasajero con respeto; el maltrato es causal de suspensión.</li>
              <li>Aceptar o rechazar viajes dentro de los 45 segundos de la oferta.</li>
            </ul>
          </div>
        ),
      },
      {
        id: 'liability',
        icon: Shield,
        title: '11. Limitación de responsabilidad',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              La Cooperativa actúa como intermediario tecnológico entre el Usuario y el conductor. No es propietaria de los vehículos ni empleadora de los conductores, quienes son socios cooperativistas independientes.
            </p>
            <p>
              La Cooperativa no se responsabiliza por:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Daños, accidentes o lesiones ocurridos durante el viaje (cubiertos por el seguro del conductor).</li>
              <li>Robos, hurtos u objetos perdidos (la App ofrece un canal de objetos perdidos pero no garantiza recuperación).</li>
              <li>Demoras o cancelaciones por tráfico, clima o indisponibilidad de conductores.</li>
              <li>Conducta dolosa o negligente del conductor o pasajero.</li>
            </ul>
            <p>
              El Usuario acepta utilizar el servicio bajo su propia responsabilidad y mantener libre de responsabilidad a la Cooperativa por cualquier daño derivado del uso de la App o del servicio de transporte.
            </p>
            <p>
              La responsabilidad de la Cooperativa, en cualquier caso, se limita al monto de la tarifa del viaje en cuestión.
            </p>
          </div>
        ),
      },
      {
        id: 'termination',
        icon: FileText,
        title: '12. Suspensión y baja de cuenta',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              La Cooperativa puede suspender o dar de baja una cuenta cuando:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>El Usuario proporcione información falsa en el registro.</li>
              <li>Se detecten usos fraudulentos del sistema de pagos o de calificaciones.</li>
              <li>Se verifique maltrato verbal o físico entre las partes.</li>
              <li>El conductor conduzca bajo efectos de alcohol o sustancias (Ley 24.449).</li>
              <li>El Usuario incumpla reiteradamente los TyC.</li>
            </ul>
            <p>
              El Usuario puede darse de baja en cualquier momento desde la configuración de su cuenta. La baja no afecta los datos conservados por obligaciones legales (fiscales, disputas en curso).
            </p>
          </div>
        ),
      },
      {
        id: 'changes',
        icon: FileText,
        title: '13. Modificaciones a los TyC',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              La Cooperativa puede modificar los TyC en cualquier momento. Los cambios se notificarán mediante la App y por correo electrónico con al menos 15 días de anticipación a su entrada en vigencia.
            </p>
            <p>
              Si el Usuario no acepta los cambios, podrá dar de baja su cuenta sin penalidad. El uso continuado después de la fecha de vigencia constituye aceptación de la nueva versión.
            </p>
            <p>
              La versión vigente está siempre disponible dentro de la App, en &laquo;Cuenta → Términos y condiciones&raquo;.
            </p>
          </div>
        ),
      },
      {
        id: 'law',
        icon: FileText,
        title: '14. Ley aplicable y jurisdicción',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              Estos TyC se rigen por las leyes de la República Argentina, con especial referencia a la Ley 25.326 (Datos Personales), Ley 24.240 (Defensa del Consumidor), Ley 24.449 (Tránsito), Ley 20.337 (Cooperativas) y el Código Civil y Comercial de la Nación.
            </p>
            <p>
              Para cualquier controversia, las partes se someten a la jurisdicción de los tribunales ordinarios en lo comercial con asiento en la Ciudad Autónoma de Buenos Aires, renunciando a cualquier otro fuero o jurisdicción.
            </p>
            <p>
              Antes de iniciar acciones judiciales, las partes se comprometen a agotar un proceso de mediación previa conforme a la Ley 26.589.
            </p>
            <p>
              Para reclamos relacionados con datos personales, podés contactar también a la Agencia de Acceso a la Información Pública (AAIP): <a className="text-[#0EA5A0] underline" href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noopener noreferrer">argentina.gob.ar/aaip <ExternalLink className="w-3 h-3 inline" /></a>.
            </p>
          </div>
        ),
      },
      {
        id: 'contact',
        icon: FileText,
        title: '15. Contacto',
        body: (
          <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
            <p>
              <strong>Cooperativa UNIRA — marca TEYEVO</strong>
            </p>
            <p>
              Domicilio: CABA, Argentina.<br/>
              Email general: <a className="text-[#0EA5A0] underline" href="mailto:info@unira.com.ar">info@unira.com.ar</a><br/>
              Encargado de datos personales: <a className="text-[#0EA5A0] underline" href="mailto:admin@unira.com.ar">admin@unira.com.ar</a><br/>
              Reclamos de viajes: <a className="text-[#0EA5A0] underline" href="mailto:contacto@unira.com.ar">contacto@unira.com.ar</a>
            </p>
          </div>
        ),
      },
    ],
    []
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 bg-white sticky top-0 z-10 shadow-sm">
        <button
          onClick={() => store.setCurrentScreen('role')}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#0EA5A0]/10 flex items-center justify-center text-[#0EA5A0]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Términos y Condiciones</h1>
            <p className="text-[11px] text-gray-500 leading-tight">
              Versión {TERMS_VERSION} · {TERMS_DATE}
            </p>
          </div>
        </div>
      </div>

      {/* Intro banner */}
      <div className="px-4 mt-3">
        <div className="bg-[#0EA5A0]/5 border border-[#0EA5A0]/20 rounded-2xl p-4">
          <div className="flex items-start gap-2 mb-2">
            <Shield className="w-5 h-5 text-[#0EA5A0] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700 leading-relaxed">
              Para usar TEYEVO debés leer y aceptar los siguientes términos. Revisá especialmente las secciones sobre <strong>permisos</strong>, <strong>grabación de viajes</strong> y <strong>privacidad</strong>. La aceptación es libre, expresa e informada.
            </p>
          </div>
        </div>
      </div>

      {/* Sections (accordion) */}
      <div className="px-4 mt-3 space-y-2">
        {sections.map((sec) => {
          const Icon = sec.icon;
          const isExpanded = expandedSection === sec.id;
          return (
            <div key={sec.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection(sec.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-[#0EA5A0]/10 flex items-center justify-center flex-shrink-0 text-[#0EA5A0]">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="flex-1 text-sm font-semibold text-gray-900">{sec.title}</span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-50">
                  {sec.body}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Consent checkboxes */}
      <div className="px-4 mt-4 space-y-3">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Consentimientos</h3>

          {/* Mandatory: TyC */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded accent-[#0EA5A0] flex-shrink-0"
            />
            <span className="text-xs text-gray-700 leading-relaxed">
              Acepto los <strong>Términos y Condiciones</strong> (secciones 1 a 15) y la Política de Privacidad. Mi aceptación es libre, expresa e informada.
            </span>
          </label>

          {/* Mandatory: Privacy */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded accent-[#0EA5A0] flex-shrink-0"
            />
            <span className="text-xs text-gray-700 leading-relaxed">
              Acepto el tratamiento de mis datos personales conforme a la <strong>Política de Privacidad</strong> y la Ley 25.326, con las finalidades allí descriptas.
            </span>
          </label>

          {/* Mandatory: Permissions */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptPermissions}
              onChange={(e) => setAcceptPermissions(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded accent-[#0EA5A0] flex-shrink-0"
            />
            <span className="text-xs text-gray-700 leading-relaxed">
              Autorizo a TEYEVO a solicitar los <strong>permisos del dispositivo</strong> (ubicación, cámara, micrófono, notificaciones) según la sección 4. Entiendo que puedo revocarlos cuando quiera desde la configuración del sistema.
            </span>
          </label>

          {/* Optional: Recording */}
          <div className="pt-2 mt-2 border-t border-gray-100">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptRecording}
                onChange={(e) => setAcceptRecording(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded accent-violet-600 flex-shrink-0"
              />
              <span className="text-xs text-gray-700 leading-relaxed">
                <strong>(Opcional)</strong> Manifiesto mi disposición a participar del sistema de <strong>grabación de viajes</strong> (sección 5). Entiendo que cada grabación requerirá mi consentimiento explícito en el momento y que puedo rechazar cualquier grabación sin penalidad.
              </span>
            </label>
            <p className="text-[10px] text-gray-400 mt-1.5 pl-7">
              {recordingOptional
                ? 'Este consentimiento es opcional. Si lo rechazás, podés seguir usando la App normalmente pero no podrás iniciar grabaciones de viajes.'
                : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Sticky accept button */}
      <div className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto bg-white border-t border-gray-100 p-4 z-20">
        <button
          onClick={() => void handleAccept()}
          disabled={!allAccepted || saving}
          className="w-full py-3.5 rounded-2xl bg-[#0EA5A0] text-white font-bold shadow-lg shadow-[#0EA5A0]/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : allAccepted ? (
            <CheckCircle className="w-5 h-5" />
          ) : null}
          {saving
            ? 'Guardando…'
            : allAccepted
              ? 'Aceptar y continuar'
              : 'Marcá los consentimientos obligatorios'}
        </button>
        {!allAccepted && (
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Faltan consentimientos obligatorios (TyC, Privacidad y Permisos)
          </p>
        )}
      </div>
    </div>
  );
}
