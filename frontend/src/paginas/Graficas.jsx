import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const formatCOP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)

const formatCorto = (n) => {
  if (!n || n === 0) return '$0'
  if (n >= 1000000) return `$${parseFloat((n / 1000000).toFixed(1)).toString()}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

const labelCorto = (str, n = 11) => str.length > n ? str.slice(0, n - 1) + '…' : str

const PERIODOS = [
  { valor: 'mes',    etiqueta: 'Este mes' },
  { valor: '3meses', etiqueta: '3 meses' },
  { valor: '6meses', etiqueta: '6 meses' },
  { valor: 'anio',   etiqueta: 'Este año' },
]

/* ─── MetricCard ──────────────────────────────────────── */
function calcVariacion(actual, anterior) {
  if (!anterior || anterior === 0) return null
  return Math.round((actual - anterior) / anterior * 100)
}

function MetricCard({ label, valor, color, signo, anterior, invertir = false }) {
  const pct = calcVariacion(valor, anterior)
  // Para gastos, subir es malo (invertir=true)
  const positivo = invertir ? pct < 0 : pct > 0
  const colorVar = pct === 0 ? 'var(--texto-terciario)'
    : positivo ? 'var(--ingreso)' : 'var(--gasto)'
  const flecha = pct > 0 ? '↑' : pct < 0 ? '↓' : '→'

  return (
    <div style={{ background: 'var(--card-hover)', borderRadius: 14, padding: '14px 16px' }}>
      <p style={{
        fontSize: 10, color: 'var(--texto-terciario)', marginBottom: 7,
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
      }}>
        {label}
      </p>
      <p style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.2, marginBottom: pct !== null ? 5 : 0 }}>
        {signo}{formatCOP(valor || 0)}
      </p>
      {pct !== null && (
        <p style={{ fontSize: 11, color: colorVar, fontWeight: 500 }}>
          {flecha} {Math.abs(pct)}% vs per. ant.
        </p>
      )}
    </div>
  )
}

/* ─── BarChart ────────────────────────────────────────── */
const W = 320, H = 170
const PAD_L = 44, PAD_R = 8, PAD_T = 10, PAD_B = 24
const CHART_W = W - PAD_L - PAD_R
const CHART_H = H - PAD_T - PAD_B
const BASELINE = PAD_T + CHART_H
const Y_TICKS = [0.25, 0.5, 0.75, 1.0]

function BarChart({ data }) {
  const [tooltip, setTooltip] = useState(null)

  if (!data || data.length <= 1) return null

  const maxVal = Math.max(...data.flatMap(d => [d.ingresos, d.gastos]), 1)
  const N = data.length
  const groupW = CHART_W / N
  const barW = Math.max(4, Math.min(13, groupW * 0.27))
  const barGap = Math.max(2, barW * 0.35)

  const scaleY = (val) => PAD_T + CHART_H - (val / maxVal) * CHART_H

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', display: 'block' }}
      onClick={() => setTooltip(null)}
    >
      {/* Grid lines */}
      {Y_TICKS.map(t => {
        const y = scaleY(maxVal * t)
        return (
          <g key={t}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
            <text x={PAD_L - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="rgba(255,255,255,0.2)">
              {formatCorto(maxVal * t)}
            </text>
          </g>
        )
      })}
      <line x1={PAD_L} y1={BASELINE} x2={W - PAD_R} y2={BASELINE}
        stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />

      {/* Bars */}
      {data.map((d, i) => {
        const cx = PAD_L + i * groupW + groupW / 2
        const ingX = cx - barGap / 2 - barW
        const gasX = cx + barGap / 2
        const ingH = (d.ingresos / maxVal) * CHART_H
        const gasH = (d.gastos / maxVal) * CHART_H
        const isIng = tooltip?.key === `ing-${i}`
        const isGas = tooltip?.key === `gas-${i}`
        const rx = Math.min(3, barW / 2)

        return (
          <g key={i}>
            {d.ingresos > 0 && (
              <rect x={ingX} y={BASELINE - ingH} width={barW} height={Math.max(ingH, 2)}
                rx={rx} fill="#30D158" opacity={isIng ? 1 : 0.75}
                style={{ cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation()
                  setTooltip(isIng ? null : { key: `ing-${i}`, x: cx, y: BASELINE - ingH - 8, valor: d.ingresos, color: '#30D158' })
                }}
              />
            )}
            {d.gastos > 0 && (
              <rect x={gasX} y={BASELINE - gasH} width={barW} height={Math.max(gasH, 2)}
                rx={rx} fill="#FF453A" opacity={isGas ? 1 : 0.75}
                style={{ cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation()
                  setTooltip(isGas ? null : { key: `gas-${i}`, x: cx, y: BASELINE - gasH - 8, valor: d.gastos, color: '#FF453A' })
                }}
              />
            )}
            <text x={cx} y={H - 5} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)">
              {d.mes_corto}
            </text>
          </g>
        )
      })}

      {/* Tooltip bubble */}
      {tooltip && (() => {
        const tx = Math.min(Math.max(tooltip.x, 54), W - 54)
        const ty = Math.max(tooltip.y - 14, PAD_T)
        return (
          <g>
            <rect x={tx - 30} y={ty} width={60} height={18} rx={5}
              fill="#1c2840" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
            <text x={tx} y={ty + 12} textAnchor="middle" fontSize={9.5}
              fill={tooltip.color} fontWeight="700">
              {formatCorto(tooltip.valor)}
            </text>
          </g>
        )
      })()}
    </svg>
  )
}

/* ─── DonutChart ──────────────────────────────────────── */
const DR = 58, DSW = 16, DCX = 85, DCY = 85
const CIRCUM = 2 * Math.PI * DR

function DonutChart({ categorias }) {
  const [activo, setActivo] = useState(null)

  const total = categorias.reduce((s, c) => s + c.monto, 0)
  if (total === 0) return null

  let acc = 0
  const segs = categorias.map((cat, i) => {
    const frac = cat.monto / total
    const dash = frac * CIRCUM
    const offset = CIRCUM * (0.25 - acc)
    acc += frac
    return { ...cat, dash, offset, i }
  })

  const activoCat = activo !== null ? categorias[activo] : null
  const centroLabel = activoCat ? labelCorto(activoCat.nombre) : 'Total gastos'
  const centroValor = activoCat ? `${activoCat.porcentaje}%` : formatCorto(total)
  const centroColor = activoCat ? activoCat.color : 'rgba(255,255,255,0.9)'

  return (
    <div>
      {/* Ring + leyenda */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <svg width={170} height={170} viewBox="0 0 170 170" style={{ flexShrink: 0 }}>
          <circle cx={DCX} cy={DCY} r={DR} fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth={DSW} />
          {segs.map((seg, i) => (
            <circle key={i}
              cx={DCX} cy={DCY} r={DR}
              fill="none"
              stroke={seg.color}
              strokeWidth={activo === i ? DSW + 5 : DSW}
              strokeDasharray={`${seg.dash} ${CIRCUM - seg.dash}`}
              strokeDashoffset={seg.offset}
              style={{ cursor: 'pointer', transition: 'stroke-width 0.18s' }}
              onClick={() => setActivo(activo === i ? null : i)}
            />
          ))}
          <text x={DCX} y={DCY - 9} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.3)">
            {centroLabel}
          </text>
          <text x={DCX} y={DCY + 9} textAnchor="middle" fontSize={14} fontWeight="700" fill={centroColor}>
            {centroValor}
          </text>
        </svg>

        {/* Leyenda */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categorias.slice(0, 5).map((cat, i) => (
            <button key={i} onClick={() => setActivo(activo === i ? null : i)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
              opacity: activo === null || activo === i ? 1 : 0.3,
              transition: 'opacity 0.18s',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--texto-secundario)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cat.nombre}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: cat.color, flexShrink: 0 }}>
                {cat.porcentaje}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Barras ranking */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {categorias.map((cat, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                {cat.nombre}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto-primario)' }}>
                {formatCOP(cat.monto)}
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
              <div style={{
                height: '100%', width: `${cat.porcentaje}%`,
                background: cat.color, borderRadius: 3,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Página principal ────────────────────────────────── */
export default function Graficas() {
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState('mes')
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      try {
        const res = await api.get('/transacciones/analytics/', { params: { periodo } })
        setDatos(res.data)
      } catch (err) {
        console.error('Error cargando analytics:', err)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [periodo])

  const { resumen, resumen_anterior, mensual, por_categoria } = datos || {}
  const balance    = resumen          ? resumen.ingresos          - resumen.gastos          : 0
  const balanceAnt = resumen_anterior ? resumen_anterior.ingresos - resumen_anterior.gastos : 0

  return (
    <div className="pagina">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="titulo-seccion" style={{ margin: 0 }}>Gráficas</h1>
        <button onClick={() => navigate('/presupuesto')} style={{
          background: 'var(--card)', border: '0.5px solid var(--borde)',
          borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 500,
          color: 'var(--texto-secundario)', cursor: 'pointer',
        }}>
          🎯 Presupuesto
        </button>
      </div>

      {/* Selector de período */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {PERIODOS.map(p => (
          <button key={p.valor} onClick={() => setPeriodo(p.valor)} style={{
            flex: 1,
            background: periodo === p.valor ? 'var(--acento)' : 'var(--card)',
            color: periodo === p.valor ? '#fff' : 'var(--texto-secundario)',
            border: '0.5px solid var(--borde)', borderRadius: 20,
            padding: '9px 4px', fontSize: 12, fontWeight: periodo === p.valor ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {p.etiqueta}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {cargando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[110, 220, 270].map((h, i) => (
            <div key={i} style={{ height: h, background: 'var(--card)', borderRadius: 22, opacity: 0.4 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Resumen del período */}
          <div className="card">
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--texto-terciario)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
              Resumen del período
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MetricCard label="Ingresos" valor={resumen?.ingresos} color="var(--ingreso)" signo="+"
                anterior={resumen_anterior?.ingresos} />
              <MetricCard label="Gastos"   valor={resumen?.gastos}   color="var(--gasto)"   signo="-"
                anterior={resumen_anterior?.gastos} invertir />
              <MetricCard label="Ahorros"  valor={resumen?.ahorros}  color="var(--ahorro)"  signo="→"
                anterior={resumen_anterior?.ahorros} />
              <MetricCard
                label="Balance"
                valor={Math.abs(balance)}
                color={balance >= 0 ? 'var(--ingreso)' : 'var(--gasto)'}
                signo={balance >= 0 ? '+' : '-'}
                anterior={Math.abs(balanceAnt)}
              />
            </div>
          </div>

          {/* Evolución mensual (solo si hay > 1 mes) */}
          {mensual && mensual.length > 1 && (
            <div className="card">
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--texto-terciario)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Evolución mensual
              </p>
              <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                {[['#30D158', 'Ingresos'], ['#FF453A', 'Gastos']].map(([color, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: 11, color: 'var(--texto-terciario)' }}>{label}</span>
                  </div>
                ))}
              </div>
              <BarChart data={mensual} />
            </div>
          )}

          {/* Gastos por categoría */}
          <div className="card">
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--texto-terciario)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
              Gastos por categoría
            </p>
            {por_categoria && por_categoria.length > 0 ? (
              <DonutChart categorias={por_categoria} />
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontSize: 36, marginBottom: 8 }}>📊</p>
                <p style={{ color: 'var(--texto-terciario)', fontSize: 14 }}>
                  Sin gastos con categoría en este período
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
