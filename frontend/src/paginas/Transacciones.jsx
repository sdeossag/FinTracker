import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { ensureArray } from '../api'

const formatCOP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)

const getMeses = () => {
  const hoy = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    return {
      valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      etiqueta: d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
      corto: d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
    }
  })
}

const labelFecha = (fecha) => {
  const hoy = new Date()
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  const hoyStr = hoy.toISOString().split('T')[0]
  const ayerStr = ayer.toISOString().split('T')[0]
  if (fecha === hoyStr) return 'Hoy'
  if (fecha === ayerStr) return 'Ayer'
  const d = new Date(fecha + 'T00:00:00')
  const txt = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

/* ── Panel de filtros (bottom sheet) ─────────────────── */
function FiltrosPanel({ open, onClose, filtroTipo, setFiltroTipo, filtroMes, setFiltroMes, meses }) {
  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.5)' }}
        />
      )}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', zIndex: 111,
        width: '100%', maxWidth: 430,
        background: 'var(--fondo)',
        border: '0.5px solid var(--borde)',
        borderRadius: '24px 24px 0 0',
        padding: '8px 20px 40px',
        transform: open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(110%)',
        transition: 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'var(--borde)', borderRadius: 2, margin: '12px auto 20px' }} />

        {/* Tipo */}
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto-terciario)', marginBottom: 10, letterSpacing: 0.6 }}>
          TIPO
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {TIPOS.map(f => (
            <button key={f.valor} onClick={() => setFiltroTipo(f.valor)} style={{
              background: filtroTipo === f.valor ? 'var(--acento)' : 'var(--card)',
              color: filtroTipo === f.valor ? '#fff' : 'var(--texto-secundario)',
              border: '0.5px solid var(--borde)', borderRadius: 20,
              padding: '9px 20px', fontSize: 14, fontWeight: filtroTipo === f.valor ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {f.etiqueta}
            </button>
          ))}
        </div>

        {/* Período */}
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto-terciario)', marginBottom: 10, letterSpacing: 0.6 }}>
          PERÍODO
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[{ valor: '', etiqueta: 'Todos los meses' }, ...meses].map(m => (
            <button key={m.valor || 'todos'} onClick={() => { setFiltroMes(m.valor); onClose() }} style={{
              width: '100%', textAlign: 'left', padding: '11px 14px',
              background: filtroMes === m.valor ? 'rgba(10,132,255,0.1)' : 'transparent',
              color: filtroMes === m.valor ? 'var(--acento)' : 'var(--texto-secundario)',
              border: 'none', borderRadius: 12, cursor: 'pointer',
              fontSize: 14, fontWeight: filtroMes === m.valor ? 600 : 400,
              transition: 'background 0.15s',
            }}>
              {m.etiqueta || 'Todos los meses'}
            </button>
          ))}
        </div>

        <button onClick={onClose} className="btn-primario" style={{ width: '100%', marginTop: 18, padding: 14, fontSize: 15 }}>
          Listo
        </button>
      </div>
    </>
  )
}

const TIPOS = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'ingreso', etiqueta: 'Ingresos' },
  { valor: 'gasto', etiqueta: 'Gastos' },
  { valor: 'ahorro', etiqueta: 'Ahorros' },
]

const TIPO_COLOR = { gasto: 'var(--gasto)', ingreso: 'var(--ingreso)', ahorro: 'var(--ahorro)' }
const TIPO_SIGNO = { gasto: '-', ingreso: '+', ahorro: '→' }

export default function Transacciones() {
  const navigate = useNavigate()
  const [transacciones, setTransacciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroMes, setFiltroMes] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtrosOpen, setFiltrosOpen] = useState(false)

  const meses = useMemo(() => getMeses(), [])
  const hayFiltros = filtroTipo !== 'todos' || !!filtroMes

  useEffect(() => {
    const cargar = async () => {
      setCargando(true)
      try {
        const params = {}
        if (filtroTipo !== 'todos') params.tipo = filtroTipo
        if (filtroMes) params.mes = filtroMes
        const res = await api.get('/transacciones/', { params })
        setTransacciones(ensureArray(res.data))
      } catch (err) {
        console.error('Error cargando transacciones:', err)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [filtroTipo, filtroMes])

  const transaccionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return transacciones
    return transacciones.filter(t =>
      t.nombre.toLowerCase().includes(q) ||
      (t.categorias || []).some(c => c.nombre.toLowerCase().includes(q))
    )
  }, [transacciones, busqueda])

  // Agrupar por fecha
  const grupos = useMemo(() => {
    const map = {}
    transaccionesFiltradas.forEach(t => {
      if (!map[t.fecha]) map[t.fecha] = []
      map[t.fecha].push(t)
    })
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fecha, items]) => ({ fecha, label: labelFecha(fecha), items }))
  }, [transaccionesFiltradas])

  return (
    <div className="pagina">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="titulo-seccion" style={{ margin: 0 }}>Historial</h1>
        <button onClick={() => navigate('/recurrentes')} style={{
          background: 'var(--card)', border: '0.5px solid var(--borde)',
          borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 500,
          color: 'var(--texto-secundario)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        }}>
          🔁 Recurrentes
        </button>
      </div>

      {/* Buscador + botón filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--texto-terciario)', fontSize: 15, pointerEvents: 'none',
          }}>🔍</span>
          <input
            className="input"
            placeholder="Buscar transacción o categoría..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ paddingLeft: 40, paddingRight: busqueda ? 36 : 14 }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--texto-terciario)',
              cursor: 'pointer', fontSize: 15, padding: 0,
            }}>✕</button>
          )}
        </div>

        {/* Botón filtros */}
        <button
          onClick={() => setFiltrosOpen(true)}
          style={{
            flexShrink: 0, width: 44, height: 44,
            background: hayFiltros ? 'rgba(10,132,255,0.12)' : 'var(--card)',
            border: hayFiltros ? '1px solid rgba(10,132,255,0.35)' : '0.5px solid var(--borde)',
            borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: hayFiltros ? 'var(--acento)' : 'var(--texto-secundario)',
            position: 'relative', transition: 'all 0.15s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {hayFiltros && (
            <span style={{
              position: 'absolute', top: 6, right: 6, width: 7, height: 7,
              borderRadius: '50%', background: 'var(--acento)',
              border: '1.5px solid var(--fondo)',
            }} />
          )}
        </button>
      </div>

      {/* Chips de filtros activos */}
      {hayFiltros && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {filtroTipo !== 'todos' && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(10,132,255,0.1)', color: 'var(--acento)',
              border: '0.5px solid rgba(10,132,255,0.25)',
              borderRadius: 20, padding: '4px 10px 4px 12px', fontSize: 12, fontWeight: 600,
            }}>
              {TIPOS.find(t => t.valor === filtroTipo)?.etiqueta}
              <button onClick={() => setFiltroTipo('todos')} style={{
                background: 'none', border: 'none', color: 'var(--acento)',
                cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1,
              }}>×</button>
            </span>
          )}
          {filtroMes && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(10,132,255,0.1)', color: 'var(--acento)',
              border: '0.5px solid rgba(10,132,255,0.25)',
              borderRadius: 20, padding: '4px 10px 4px 12px', fontSize: 12, fontWeight: 600,
            }}>
              {meses.find(m => m.valor === filtroMes)?.corto}
              <button onClick={() => setFiltroMes('')} style={{
                background: 'none', border: 'none', color: 'var(--acento)',
                cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1,
              }}>×</button>
            </span>
          )}
        </div>
      )}

      {/* Contenido */}
      {cargando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 68, background: 'var(--card)', borderRadius: 16, opacity: 0.4 }} />
          ))}
        </div>
      ) : grupos.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <p style={{ fontSize: 44, marginBottom: 12 }}>{busqueda ? '🔎' : '📭'}</p>
          <p style={{ color: 'var(--texto-secundario)', fontSize: 16, fontWeight: 500 }}>
            {busqueda ? `Sin resultados para "${busqueda}"` : 'Sin transacciones'}
          </p>
          {!busqueda && (
            <p style={{ color: 'var(--texto-terciario)', fontSize: 13, marginTop: 6 }}>
              Toca + para registrar la primera
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {busqueda && (
            <p style={{ fontSize: 13, color: 'var(--texto-terciario)', marginBottom: -12 }}>
              {transaccionesFiltradas.length} resultado{transaccionesFiltradas.length !== 1 ? 's' : ''}
            </p>
          )}

          {grupos.map(({ fecha, label, items }) => (
            <div key={fecha}>
              {/* Cabecera de fecha */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              }}>
                <p style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--texto-terciario)',
                  letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                  {label}
                </p>
                <div style={{ flex: 1, height: '0.5px', background: 'var(--separador)' }} />
                <p style={{ fontSize: 12, color: 'var(--texto-terciario)', whiteSpace: 'nowrap' }}>
                  {formatCOP(items.reduce((s, t) => {
                    if (t.tipo === 'ingreso') return s + t.monto
                    if (t.tipo === 'gasto') return s - t.monto
                    return s
                  }, 0))}
                </p>
              </div>

              {/* Cards del día */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(t => (
                  <div key={t.id} className="card" style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  }}>
                    {/* Indicador de tipo */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: TIPO_COLOR[t.tipo] + '18',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      {t.tipo === 'ingreso' ? '💰' : t.tipo === 'ahorro' ? '🏦' : '💸'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontWeight: 500, fontSize: 15,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: 3,
                      }}>
                        {busqueda ? <Highlight texto={t.nombre} busqueda={busqueda} /> : t.nombre}
                      </p>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {(t.categorias || []).slice(0, 2).map(cat => (
                          <span key={cat.id} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 8,
                            background: cat.color_hex + '22', color: cat.color_hex,
                            fontWeight: 500,
                          }}>
                            {busqueda ? <Highlight texto={cat.nombre} busqueda={busqueda} /> : cat.nombre}
                          </span>
                        ))}
                        {(t.categorias || []).length === 0 && (
                          <span style={{ fontSize: 11, color: 'var(--texto-terciario)', textTransform: 'capitalize' }}>
                            {t.tipo}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Monto + editar */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <p style={{
                        fontSize: 16, fontWeight: 700,
                        color: TIPO_COLOR[t.tipo],
                      }}>
                        {TIPO_SIGNO[t.tipo]}{formatCOP(t.monto)}
                      </p>
                      <button onClick={() => navigate(`/editar/${t.id}`)} style={{
                        background: 'none', border: 'none', padding: 0,
                        cursor: 'pointer', fontSize: 12, color: 'var(--texto-terciario)',
                        fontWeight: 500,
                      }}>
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panel de filtros */}
      <FiltrosPanel
        open={filtrosOpen}
        onClose={() => setFiltrosOpen(false)}
        filtroTipo={filtroTipo}
        setFiltroTipo={setFiltroTipo}
        filtroMes={filtroMes}
        setFiltroMes={setFiltroMes}
        meses={meses}
      />
    </div>
  )
}

function Highlight({ texto, busqueda }) {
  const q = busqueda.trim().toLowerCase()
  const idx = texto.toLowerCase().indexOf(q)
  if (idx === -1) return texto
  return (
    <>
      {texto.slice(0, idx)}
      <mark style={{ background: 'var(--acento)', color: '#fff', borderRadius: 3, padding: '0 2px' }}>
        {texto.slice(idx, idx + q.length)}
      </mark>
      {texto.slice(idx + q.length)}
    </>
  )
}
