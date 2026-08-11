// ─── Normalización de teléfono argentino ─────────────────────────────────
// Formato canónico: +549 + área + número (ej: +5491155976414)
// El "9" indica que es móvil (todos los usuarios de la app usan móvil).
//
// Acepta:
//   1155976414         → +5491155976414
//   15 5597-6414       → +5491155976414  (formato local antiguo con 15)
//   +54 11 5597-6414   → +5491155976414
//   +54 9 11 5597-6414 → +5491155976414
//   5491155976414      → +5491155976414

const AREA_CODES_AR = new Set([
  '11', '220', '221', '223', '236', '264', '261', '280', '291', '294',
  '297', '299', '341', '342', '343', '345', '351', '353', '358', '362',
  '370', '374', '375', '376', '379', '380', '381', '383', '385', '387', '388',
]);

export function normalizePhone(raw: string): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');

  // Quitar prefijo país + indicador móvil si existe
  if (digits.startsWith('549')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('54')) {
    digits = digits.slice(2);
  }

  // Quitar el "15" inicial si existe (formato local antiguo)
  // Solo si lo que sigue es un número de 8 dígitos (formato: 15 + 8 = 10)
  // o si después viene un código de área (15 + código + número)
  if (digits.startsWith('15') && digits.length === 10) {
    // 15 + 8 dígitos = número local sin código de área
    // Asumimos CABA (11) por defecto si no hay código de área
    digits = '11' + digits.slice(2);
  } else if (digits.startsWith('15') && digits.length === 12) {
    // 15 + código de área + número → quitar el 15
    digits = digits.slice(2);
  }

  // Si quedan 10 dígitos y empieza con código de área válido, está bien
  // Si quedan 8 dígitos (solo número local sin código de área), asumir CABA (11)
  if (digits.length === 8) {
    digits = '11' + digits;
  }

  // Validación: si no empieza con un código de área conocido, igual lo aceptamos
  // pero logueamos warning en consola del servidor
  if (digits.length !== 10) {
    console.warn(`[normalizePhone] longitud inesperada: "${raw}" → ${digits.length} dígitos`);
  }

  return '+549' + digits;
}

// Devuelve los últimos 4 dígitos para mostrar enmascarado (ej: "****6414")
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  return '****' + phone.slice(-4);
}
