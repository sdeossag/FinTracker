import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import Pagina from '../componentes/Pagina'
import Icono from '../componentes/Icono'
import { EstadoVacio, Segmentado } from '../componentes/Controles'
import { formatCOP, formatCorto } from '../utils/formato'
import './Graficas.css'

const PERIODOS = [
  { valor: 'mes',    etiqueta: 'Mes' },
  { valor: '3meses', etiqueta: '3 meses' },
  { valor: '6meses', etiqueta: '6 meses' },
  { valor: 'anio',   etiqueta: 'Año' },
]

const C_INGRESO = '#30D158'
const C_GASTO   = '#FF453A'

/* ─── Stat tile ───────────────────────────────────────── */
function calcVariacion(actual, anterior) {
  if (!anterior || anterior === 0) return null
  return Math.round((actual - anterior) / anterior * 100)
}

function MetricCard({ label, valor, color, signo = '', anterior, invertir = false }) {
  const pct = calcVariacion(valor, anterior)
  // Para gastos, subir es malo (invertir=true)
  const positivo = invertir ? pct < 0 : pct > 0
  const colorVar = pct === 0 ? 'var(--texto-terciario)' : positivo ? 'var(--ingreso)' : 'var(--gasto)'
  const flecha = pct > 0 ? '↑' : pct < 0 ? '↓' : '→'

  return (
    <div style={{ background: 'var(--card-hover)', borderRadius: 14, padding: '12px 14px', minWidth: 0 }}>
      <p style={{ fontSize: 12, color: 'var(--texto-secundario)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {label}
      </p>
      <p className="cifra" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {signo}{formatCOP(valor || 0)}
      </p>
      {pct !== null && (
        <p style={{ fontSize: 12, color: colorVar, fontWeight: 500, marginTop: 4 }}>
          {flecha} {Math.abs(pct)}% <span style={{ color: 'var(--texto-terciario)', fontWeight: 400 }}>vs. anterior</span>
        </p>
      )}
    </div>
  )
}

/* ─── BarChart ────────────────────────────────────────── */
const W = 320, H = 180
const PAD_L = 40, PAD_R = 4, PAD_T = 8, PAD_B = 22
const CHART_W = W - PAD_L - PAD_R
const CHART_H = H - PAD_T - PAD_B
const BASELINE = PAD_T + CHART_H

// Escala "bonita": ticks redondos (0, 500K, 1M…) en lugar de fracciones del máximo
function escalaBonita(max, n = 4) {
  if (max <= 0) return { tope: 1, paso: 0.25 }
  const bruto = max / n
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const f = bruto / mag
  const paso = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag
  return { tope: paso * n, paso }
}

// Rect con extremo de datos redondeado (4px) y base recta
function barPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

function BarChart({ data }) {
  const [activo, setActivo] = useState(null)

  if (!data || data.length <= 1) return null

  const maxVal = Math.max(...data.flatMap(d => [d.ingresos, d.gastos]), 1)
  const { tope, paso } = escalaBonita(maxVal)
  const ticks = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso)
  const N = data.length
  const groupW = CHART_W / N
  const barW = Math.max(4, Math.min(14, groupW * 0.28))
  const gap = 2
  const scaleY = (v) => BASELINE - (v / tope) * CHART_H
  const sel = activo !== null ? data[activo] : null

  return (
    <div style={{ position: 'relative' }} onPointerLeave={e => { if (e.pointerType === 'mouse') setActivo(null) }}>
      {/* Fila de lectura: la leyenda, o el detalle del mes tocado (sin tapar el gráfico) */}
      <div className="grafica-lectura" aria-live="polite">
        {sel ? (
          <>
            <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--texto-primario)' }}>{sel.mes_corto}</span>
            {[['Ingresos', sel.ingresos, C_INGRESO], ['Gastos', sel.gastos, C_GASTO]].map(([l, v, c]) => (
              <span key={l} className="cifra" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} aria-hidden="true" />
                <span className="sr-only">{l}</span>
                <span style={{ color: 'var(--texto-primario)', fontWeight: 600 }}>{formatCOP(v)}</span>
              </span>
            ))}
          </>
        ) : (
          [[C_INGRESO, 'Ingresos'], [C_GASTO, 'Gastos']].map(([color, label]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              {label}
            </span>
          ))
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', overflow: 'visible' }} role="img"
        aria-label="Ingresos y gastos por mes">
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD_L} y1={scaleY(t)} x2={W - PAD_R} y2={scaleY(t)}
              stroke={t === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={PAD_L - 6} y={scaleY(t) + 3.5} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.4)" className="cifra">
              {formatCorto(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = PAD_L + i * groupW + groupW / 2
          const ingH = (d.ingresos / tope) * CHART_H
          const gasH = (d.gastos / tope) * CHART_H
          const atenuado = activo !== null && activo !== i
          return (
            <g key={i} style={{ opacity: atenuado ? 0.35 : 1, transition: 'opacity 150ms ease' }}>
              {d.ingresos > 0 && (
                <path className="barra-dato" style={{ animationDelay: `${i * 40}ms` }}
                  d={barPath(cx - gap / 2 - barW, BASELINE - Math.max(ingH, 2), barW, Math.max(ingH, 2))} fill={C_INGRESO} />
              )}
              {d.gastos > 0 && (
                <path className="barra-dato" style={{ animationDelay: `${i * 40 + 20}ms` }}
                  d={barPath(cx + gap / 2, BASELINE - Math.max(gasH, 2), barW, Math.max(gasH, 2))} fill={C_GASTO} />
              )}
              <text x={cx} y={H - 5} textAnchor="middle" fontSize={10}
                fill={activo === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}>
                {d.mes_corto}
              </text>
              {/* Área táctil: toda la columna, más grande que las barras */}
              <rect x={PAD_L + i * groupW} y={PAD_T} width={groupW} height={CHART_H + PAD_B} fill="transparent"
                style={{ cursor: 'pointer' }}
                onPointerEnter={e => { if (e.pointerType === 'mouse') setActivo(i) }}
                onClick={() => setActivo(activo === i ? null : i)} />
            </g>
          )
        })}
      </svg>

      {/* Vista de tabla para lectores de pantalla */}
      <table className="sr-only">
        <caption>Ingresos y gastos por mes</caption>
        <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th></tr></thead>
        <tbody>{data.map((d, i) => <tr key={i}><td>{d.mes_corto}</td><td>{formatCOP(d.ingresos)}</td><td>{formatCOP(d.gastos)}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

/* ─── DonutChart ──────────────────────────────────────── */
const DR = 62, DSW = 16, DC = 84
const CIRCUM = 2 * Math.PI * DR
const GAP_DONUT = 2   // separación de superficie entre segmentos

// Donut centrado + ranking debajo que hace de leyenda (color, nombre, %, monto).
// Sin columna lateral: nada puede salirse de la tarjeta, ni con nombres largos
// ni en pantallas de 320px.
function DonutChart({ categorias }) {
  const [activo, setActivo] = useState(null)

  const total = categorias.reduce((s, c) => s + c.monto, 0)
  if (total === 0) return null

  const multiples = categorias.length > 1
  const segs = []
  let acc = 0
  for (const cat of categorias) {
    const frac = cat.monto / total
    const dash = Math.max(frac * CIRCUM - (multiples ? GAP_DONUT : 0), 0.5)
    segs.push({ ...cat, dash, offset: CIRCUM * (0.25 - acc) })
    acc += frac
  }

  const activoCat = activo !== null ? categorias[activo] : null
  const alternar = (i) => setActivo(activo === i ? null : i)
  const atenuar = (i) => activo !== null && activo !== i

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <svg width={DC * 2} height={DC * 2} viewBox={`0 0 ${DC * 2} ${DC * 2}`} style={{ maxWidth: '100%', height: 'auto' }}
          role="img" aria-label="Distribución de gastos por categoría">
          <circle cx={DC} cy={DC} r={DR} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={DSW} />
          {segs.map((seg, i) => (
            <circle key={i}
              cx={DC} cy={DC} r={DR}
              fill="none"
              stroke={seg.color}
              strokeWidth={activo === i ? DSW + 5 : DSW}
              strokeDasharray={`${seg.dash} ${CIRCUM - seg.dash}`}
              strokeDashoffset={seg.offset}
              style={{
                cursor: 'pointer',
                opacity: atenuar(i) ? 0.3 : 1,
                transition: 'stroke-width 180ms var(--ease-out), opacity 150ms ease',
              }}
              onClick={() => alternar(i)}
            />
          ))}
          <text x={DC} y={DC - 8} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.55)">
            {activoCat ? `${activoCat.porcentaje}% del total` : 'Total'}
          </text>
          <text x={DC} y={DC + 14} textAnchor="middle" fontSize={20} fontWeight="700" fill="#fff">
            {formatCorto(activoCat ? activoCat.monto : total)}
          </text>
        </svg>
      </div>

      {/* Ranking = leyenda: tocar una fila resalta su segmento */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {categorias.map((cat, i) => (
          <button
            key={i}
            type="button"
            onClick={() => alternar(i)}
            aria-pressed={activo === i}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 0',
              opacity: atenuar(i) ? 0.4 : 1, transition: 'opacity 150ms ease',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--texto-primario)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cat.nombre}
              </span>
              <span className="cifra" style={{ fontSize: 13, color: 'var(--texto-secundario)', flexShrink: 0 }}>{cat.porcentaje}%</span>
              <span className="cifra" style={{ fontSize: 14, fontWeight: 600, flexShrink: 0, minWidth: 0 }}>{formatCOP(cat.monto)}</span>
            </span>
            <span className="progress-track" style={{ display: 'block' }}>
              <span className="progress-fill barra-ranking" style={{ display: 'block', transform: `scaleX(${cat.porcentaje / 100})`, background: cat.color, animationDelay: `${i * 40}ms` }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Página ──────────────────────────────────────────── */
export default function Graficas() {
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState('mes')
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      setError(false)
      try {
        const res = await api.get('/transacciones/analytics/', { params: { periodo } })
        setDatos(res.data)
      } catch (err) {
        console.error('Error cargando analytics:', err)
        setError(true)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [periodo, intento])

  const { resumen, resumen_anterior, mensual, por_categoria } = datos || {}
  const balance    = resumen          ? resumen.ingresos          - resumen.gastos          : 0
  const balanceAnt = resumen_anterior ? resumen_anterior.ingresos - resumen_anterior.gastos : 0

  return (
    <Pagina
      titulo="Gráficas"
      acciones={
        <button onClick={() => navigate('/presupuesto')} className="btn-icono" aria-label="Presupuesto">
          <Icono nombre="objetivo" size={18} />
        </button>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <Segmentado etiqueta="Período" opciones={PERIODOS} valor={periodo} onChange={setPeriodo} />
      </div>

      {cargando && !datos ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} aria-busy="true">
          {[190, 250, 290].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 20 }} />)}
        </div>
      ) : error && !datos ? (
        <EstadoVacio icono="alerta" titulo="No se pudieron cargar tus datos" texto="Revisa tu conexión e intenta de nuevo."
          accion={<button className="btn-primario" onClick={() => setIntento(n => n + 1)}>Reintentar</button>} />
      ) : (
        <div key={periodo} className="aparecer" style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: cargando ? 0.6 : 1, transition: 'opacity 150ms ease' }}>

          <section className="card" style={{ padding: 16 }}>
            <h2 className="texto-nota" style={{ fontWeight: 500, marginBottom: 12, paddingLeft: 2 }}>Resumen del período</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <MetricCard label="Ingresos" valor={resumen?.ingresos} color={C_INGRESO} anterior={resumen_anterior?.ingresos} />
              <MetricCard label="Gastos"   valor={resumen?.gastos}   color={C_GASTO}   anterior={resumen_anterior?.gastos} invertir />
              <MetricCard label="Ahorros"  valor={resumen?.ahorros}  color="var(--ahorro)" anterior={resumen_anterior?.ahorros} />
              <MetricCard
                label="Balance"
                valor={Math.abs(balance)}
                color={balance >= 0 ? C_INGRESO : C_GASTO}
                signo={balance >= 0 ? '+' : '−'}
                anterior={Math.abs(balanceAnt)}
              />
            </div>
          </section>

          {mensual && mensual.length > 1 && (
            <section className="card" style={{ padding: 16 }}>
              <h2 className="texto-nota" style={{ fontWeight: 500, marginBottom: 6, paddingLeft: 2 }}>Evolución mensual</h2>
              <BarChart data={mensual} />
              <p className="texto-mini" style={{ marginTop: 10, textAlign: 'center' }}>Toca un mes para ver el detalle</p>
            </section>
          )}

          <section className="card" style={{ padding: 16 }}>
            <h2 className="texto-nota" style={{ fontWeight: 500, marginBottom: 14, paddingLeft: 2 }}>Gastos por categoría</h2>
            {por_categoria && por_categoria.length > 0 ? (
              <DonutChart categorias={por_categoria} />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
                <span className="mosaico lg" style={{ background: 'var(--card-hover)', color: 'var(--texto-terciario)', margin: '0 auto 12px' }}>
                  <Icono nombre="grafica" size={24} />
                </span>
                <p className="texto-nota">Sin gastos con categoría en este período</p>
              </div>
            )}
          </section>
        </div>
      )}
    </Pagina>
  )
}
