// Iconografía de línea única (trazo 1.8, extremos redondeados) para toda la app.
// Reemplaza los emojis: mismo peso visual, heredan color con currentColor.

const P = {
  'chevron-left':  <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  'chevron-down':  <path d="m6 9 6 6 6-6" />,
  plus:   <path d="M12 5v14M5 12h14" />,
  x:      <path d="M18 6 6 18M6 6l12 12" />,
  check:  <path d="M20 6 9 17l-5-5" />,
  search: <><circle cx="11" cy="11" r="7.5" /><path d="m20.5 20.5-4.2-4.2" /></>,
  filtro: <path d="M4 6h16M7 12h10M10 18h4" />,
  repetir: <><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>,
  objetivo: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.5" /><circle cx="12" cy="12" r="2" /></>,
  lapiz: <><path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" /><path d="m15 5 4 4" /></>,
  basura: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  gasto:   <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  ingreso: <><path d="M17 7 7 17" /><path d="M16 17H7V8" /></>,
  ahorro:  <><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" /><path d="M2 9v1c0 1.1.9 2 2 2h1" /><path d="M16 11h.01" /></>,
  mensaje: <path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 9.1 9.1 0 0 1-3.9-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5z" />,
  copiar: <><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  transferencia: <><path d="M4 8h15" /><path d="m15 4 4 4-4 4" /><path d="M20 16H5" /><path d="m9 20-4-4 4-4" /></>,
  campana: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  'campana-off': <><path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" /><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><path d="m2 2 20 20" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  candado: <><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  calendario: <><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></>,
  salir: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  tarjeta: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /><path d="M6 15h4" /></>,
  banco: <><path d="M3 21h18" /><path d="M6 17v-6M10 17v-6M14 17v-6M18 17v-6" /><path d="m12 3 8.5 5h-17z" /></>,
  etiqueta: <><path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  grafica: <path d="M3 19 8.5 12.5l4 4L17 9l4 3" />,
  llave: <><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" /></>,
  info: <><circle cx="12" cy="12" r="9.5" /><path d="M12 16.5v-5M12 8h.01" /></>,
  alerta: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>,
  'check-circulo': <><circle cx="12" cy="12" r="9.5" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  bandeja: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
  mapa: <><path d="M14.11 5.55a2 2 0 0 0 1.78 0l3.66-1.83A1 1 0 0 1 21 4.62v12.76a1 1 0 0 1-.55.9l-4.56 2.27a2 2 0 0 1-1.78 0l-4.22-2.1a2 2 0 0 0-1.78 0l-3.66 1.83A1 1 0 0 1 3 19.38V6.62a1 1 0 0 1 .55-.9l4.56-2.27a2 2 0 0 1 1.78 0z" /><path d="M15 5.76v15M9 3.24v15" /></>,
  cohete: <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>,
  reloj: <><circle cx="12" cy="12" r="9.5" /><path d="M12 7v5l3 2" /></>,
  usuario: <><circle cx="12" cy="8" r="4.5" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  lista: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  inicio: <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
}

// Face ID lleva partes rellenas, por eso va aparte
const FaceID = () => (
  <>
    <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    <path d="M9 9v1.5M15 9v1.5M12 9v4.2h-1M9.2 16.2c1.6 1.2 4 1.2 5.6 0" />
  </>
)

export default function Icono({ nombre, size = 20, grosor = 1.8, style, className }) {
  const contenido = nombre === 'face-id' ? <FaceID /> : P[nombre]
  if (!contenido) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
      className={className}
    >
      {contenido}
    </svg>
  )
}

// Mosaico con el icono del tipo de transacción
const TIPO = {
  ingreso: { icono: 'ingreso', color: 'var(--ingreso)', fondo: 'var(--ingreso-suave)' },
  gasto:   { icono: 'gasto',   color: 'var(--gasto)',   fondo: 'var(--gasto-suave)' },
  ahorro:  { icono: 'ahorro',  color: 'var(--ahorro)',  fondo: 'var(--ahorro-suave)' },
  transferencia: { icono: 'transferencia', color: 'var(--acento)', fondo: 'var(--acento-suave)' },
}

export function TipoIcono({ tipo, size = 'md' }) {
  const t = TIPO[tipo] || TIPO.gasto
  const clase = size === 'lg' ? 'mosaico lg' : size === 'sm' ? 'mosaico sm' : 'mosaico'
  const px = size === 'lg' ? 26 : size === 'sm' ? 16 : 19
  return (
    <span className={clase} style={{ background: t.fondo, color: t.color, borderRadius: size === 'lg' ? 16 : '50%' }}>
      <Icono nombre={t.icono} size={px} grosor={2} />
    </span>
  )
}
