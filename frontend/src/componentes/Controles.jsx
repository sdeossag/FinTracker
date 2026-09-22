// Controles nativos de iOS reutilizables: segmented control, switch,
// campo de monto con formato COP, selector de color y estado vacío.
import { useRef } from 'react'
import Icono from './Icono'
import { formatMiles, limpiarMonto } from '../utils/formato'

/* ── Segmented control con indicador deslizante ─────── */
export function Segmentado({ opciones, valor, onChange, etiqueta, grande = false }) {
  const refs = useRef([])
  const n = opciones.length
  const idx = Math.max(0, opciones.findIndex(o => o.valor === valor))
  const activa = opciones[idx]

  const mover = (i) => {
    const j = (i + n) % n
    onChange(opciones[j].valor)
    refs.current[j]?.focus()
  }

  return (
    <div className={`segmented${grande ? ' lg' : ''}`} role="radiogroup" aria-label={etiqueta}>
      <span
        className="segmented-thumb"
        aria-hidden="true"
        style={{
          width: `calc((100% - 4px) / ${n})`,
          transform: `translateX(${idx * 100}%)`,
          background: activa?.color,
        }}
      />
      {opciones.map((o, i) => {
        const sel = i === idx
        return (
          <button
            key={o.valor}
            ref={el => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel ? 0 : -1}
            className="segmented-item"
            style={sel && o.colorTexto ? { color: o.colorTexto } : undefined}
            onClick={() => onChange(o.valor)}
            onKeyDown={e => {
              if (e.key === 'ArrowRight') { e.preventDefault(); mover(i + 1) }
              if (e.key === 'ArrowLeft')  { e.preventDefault(); mover(i - 1) }
            }}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

/* ── Switch ─────────────────────────────────────────── */
export function Interruptor({ activo, onChange, disabled, etiqueta }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!activo}
      aria-label={etiqueta}
      disabled={disabled}
      className="switch"
      onClick={() => onChange(!activo)}
    >
      <span className="switch-thumb" />
    </button>
  )
}

/* ── Campo de monto: teclado numérico y miles en vivo ── */
export function CampoMonto({
  valor, onChange, grande = false, color, permitirNegativo = false, invalido, ...resto
}) {
  const texto = String(valor ?? '')
  const negativo = texto.startsWith('-')
  const digitos = texto.replace(/\D/g, '')
  const mostrado = digitos
    ? `${negativo ? '-' : ''}$ ${formatMiles(digitos)}`
    : (negativo ? '-' : '')

  const input = (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="done"
      placeholder="$ 0"
      value={mostrado}
      onChange={e => onChange(limpiarMonto(e.target.value, permitirNegativo))}
      className={grande ? 'monto-grande' : 'input cifra'}
      style={{
        ...(color ? { color } : null),
        ...(permitirNegativo ? { paddingRight: 56 } : null),
      }}
      aria-invalid={invalido || undefined}
      {...resto}
    />
  )

  if (!permitirNegativo) return input

  // El teclado numérico de iOS no tiene signo "-": se ofrece un botón ±
  return (
    <div style={{ position: 'relative' }}>
      {input}
      <button
        type="button"
        className="btn-texto"
        aria-label={negativo ? 'Hacer positivo' : 'Hacer negativo'}
        onClick={() => onChange(negativo ? digitos : `-${digitos}`)}
        style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}
      >
        ±
      </button>
    </div>
  )
}

/* ── Selector de color ──────────────────────────────── */
const luminancia = (hex) => {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function SelectorColor({ colores, valor, onChange }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Color">
      {colores.map(c => {
        const sel = valor?.toLowerCase() === c.toLowerCase()
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={`Color ${c}`}
            className="swatch"
            style={{ background: c, color: c }}
            onClick={() => onChange(c)}
          >
            {sel && (
              <Icono nombre="check" size={16} grosor={3}
                style={{ color: luminancia(c) > 0.6 ? '#000' : '#fff' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ── Estado vacío ───────────────────────────────────── */
export function EstadoVacio({ icono, titulo, texto, accion }) {
  return (
    <div className="empty-state aparecer">
      <span className="mosaico lg" style={{ background: 'var(--card)', color: 'var(--texto-secundario)' }}>
        <Icono nombre={icono} size={26} />
      </span>
      <h2>{titulo}</h2>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  )
}

/* ── Mensaje de error de formulario ─────────────────── */
export function AvisoError({ children }) {
  if (!children) return null
  return (
    <div className="aviso-error" role="alert">
      <Icono nombre="alerta" size={16} />
      <span>{children}</span>
    </div>
  )
}
