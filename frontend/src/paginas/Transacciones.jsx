import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { ensureArray } from '../api'
import Pagina from '../componentes/Pagina'
import Icono, { TipoIcono } from '../componentes/Icono'
import Sheet from '../componentes/Sheet'
import { EstadoVacio, Segmentado } from '../componentes/Controles'
import { capitalizar, fechaLocalISO, formatCOP } from '../utils/formato'

const getMeses = () => {
  const hoy = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    return {
      valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      etiqueta: capitalizar(d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })),
      corto: d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
    }
  })
}

const labelFecha = (fecha) => {
  const hoy = new Date()
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  if (fecha === fechaLocalISO(hoy)) return 'Hoy'
  if (fecha === fechaLocalISO(ayer)) return 'Ayer'
  const d = new Date(fecha + 'T00:00:00')
  return capitalizar(d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }))
}

const TIPOS = [
  { valor: 'todos',   etiqueta: 'Todos' },
  { valor: 'gasto',   etiqueta: 'Gastos' },
  { valor: 'ingreso', etiqueta: 'Ingresos' },
  { valor: 'ahorro',  etiqueta: 'Ahorros' },
]

const POR_PAGINA = 60

const TIPO_COLOR = { gasto: 'var(--gasto)', ingreso: 'var(--ingreso)', ahorro: 'var(--ahorro)', transferencia: 'var(--texto-primario)' }
const TIPO_SIGNO = { gasto: '−', ingreso: '+', ahorro: '', transferencia: '' }

// Subtítulo cuando no hay categorías: de dónde a dónde, o el tipo
const detalleSinCategoria = (t) => {
  if (t.tipo === 'transferencia') {
    const ruta = [t.cuenta_origen_nombre, t.cuenta_destino_nombre].filter(Boolean).join(' → ')
    const esPago = t.cuenta_destino_tipo === 'credito' || t.cuenta_destino_tipo === 'pasivo'
    return [esPago ? 'Pago de deuda' : 'Transferencia', ruta].filter(Boolean).join(' · ')
  }
  return capitalizar(t.tipo)
}

/* ── Panel de filtros ─────────────────────────────────── */
function FiltrosPanel({ open, onClose, filtroTipo, setFiltroTipo, filtroMes, setFiltroMes, meses }) {
  const hayFiltros = filtroTipo !== 'todos' || !!filtroMes
  return (
    <Sheet
      abierto={open}
      onCerrar={onClose}
      titulo="Filtrar"
      pie={
        <>
          <button className="btn-primario" onClick={onClose}>Listo</button>
          {hayFiltros && (
            <button className="btn-texto" onClick={() => { setFiltroTipo('todos'); setFiltroMes('') }}>
              Quitar filtros
            </button>
          )}
        </>
      }
    >
      <p className="seccion-label" style={{ paddingLeft: 4 }}>Tipo</p>
      <div style={{ marginBottom: 24 }}>
        <Segmentado etiqueta="Tipo" opciones={TIPOS} valor={filtroTipo} onChange={setFiltroTipo} />
      </div>

      <p className="seccion-label" style={{ paddingLeft: 4 }}>Período</p>
      <div className="lista-grupo" role="radiogroup" aria-label="Período" style={{ background: 'var(--card)' }}>
        {[{ valor: '', etiqueta: 'Todos los meses' }, ...meses].map(m => {
          const sel = filtroMes === m.valor
          return (
            <button
              key={m.valor || 'todos'}
              type="button"
              role="radio"
              aria-checked={sel}
              className="fila"
              style={{ minHeight: 48 }}
              onClick={() => setFiltroMes(m.valor)}
            >
              <span className="fila-cuerpo texto-cuerpo">{m.etiqueta}</span>
              {sel && <Icono nombre="check" size={20} grosor={2.4} style={{ color: 'var(--acento)' }} />}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

/* ── Página ───────────────────────────────────────────── */
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

  // La búsqueda va al servidor (cubre todo el historial, no solo lo cargado)
  const [consulta, setConsulta] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setConsulta(busqueda.trim()), 250)
    return () => clearTimeout(t)
  }, [busqueda])

  // Historial por páginas: primero lo reciente, el resto al acercarse al final
  const [siguiente, setSiguiente] = useState(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const peticion = useRef(0)
  const centinela = useRef(null)

  const pedirPagina = useCallback((antes) => {
    const params = { limite: POR_PAGINA }
    if (filtroTipo !== 'todos') params.tipo = filtroTipo
    if (filtroMes) params.mes = filtroMes
    if (consulta) params.q = consulta
    if (antes) params.antes = antes
    return api.get('/transacciones/', { params })
  }, [filtroTipo, filtroMes, consulta])

  useEffect(() => {
    const id = ++peticion.current
    const cargar = async () => {
      setActualizando(true)
      try {
        const res = await pedirPagina()
        if (id !== peticion.current) return          // llegó tarde: ya hay otra búsqueda
        setTransacciones(ensureArray(res.data?.resultados))
        setSiguiente(res.data?.siguiente || null)
      } catch (err) {
        console.error('Error cargando transacciones:', err)
      } finally {
        if (id === peticion.current) { setCargando(false); setActualizando(false) }
      }
    }
    cargar()
  }, [pedirPagina])

  const cargarMas = useCallback(async () => {
    if (!siguiente || cargandoMas) return
    const id = peticion.current
    setCargandoMas(true)
    try {
      const res = await pedirPagina(siguiente)
      if (id !== peticion.current) return
      setTransacciones(prev => [...prev, ...ensureArray(res.data?.resultados)])
      setSiguiente(res.data?.siguiente || null)
    } catch (err) {
      console.error('Error cargando más transacciones:', err)
    } finally {
      setCargandoMas(false)
    }
  }, [siguiente, cargandoMas, pedirPagina])

  useEffect(() => {
    const el = centinela.current
    if (!el || !siguiente) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) cargarMas() }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [siguiente, cargarMas])

  const transaccionesFiltradas = transacciones

  const grupos = useMemo(() => {
    const map = {}
    transaccionesFiltradas.forEach(t => {
      if (!map[t.fecha]) map[t.fecha] = []
      map[t.fecha].push(t)
    })
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fecha, items]) => ({
        fecha,
        label: labelFecha(fecha),
        items,
        neto: items.reduce((s, t) => t.tipo === 'ingreso' ? s + t.monto : t.tipo === 'gasto' ? s - t.monto : s, 0),
      }))
  }, [transaccionesFiltradas])

  return (
    <Pagina
      titulo="Historial"
      acciones={
        <button className="btn-icono" onClick={() => navigate('/recurrentes')} aria-label="Transacciones recurrentes">
          <Icono nombre="repetir" size={18} />
        </button>
      }
    >
      {/* Buscador + filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: hayFiltros ? 12 : 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-terciario)', display: 'flex', pointerEvents: 'none' }}>
            <Icono nombre="search" size={18} />
          </span>
          <input
            type="search"
            className="input"
            placeholder="Buscar movimiento o categoría"
            aria-label="Buscar"
            enterKeyHint="search"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ paddingLeft: 40, paddingRight: busqueda ? 44 : 14, minHeight: 44, borderRadius: 12 }}
          />
          {busqueda && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => setBusqueda('')}
              style={{
                position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--texto-terciario)',
              }}
            >
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--texto-terciario)', color: 'var(--card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icono nombre="x" size={11} grosor={3} />
              </span>
            </button>
          )}
        </div>

        <button
          onClick={() => setFiltrosOpen(true)}
          className={`btn-icono${hayFiltros ? ' acento' : ''}`}
          aria-label={hayFiltros ? 'Filtros (activos)' : 'Filtros'}
          style={{ width: 44, height: 44, borderRadius: 12 }}
        >
          <Icono nombre="filtro" size={18} grosor={2} />
          {hayFiltros && (
            <span style={{
              position: 'absolute', top: 8, right: 8, width: 7, height: 7,
              borderRadius: '50%', background: 'var(--acento)', border: '1.5px solid var(--fondo)',
            }} />
          )}
        </button>
      </div>

      {/* Filtros activos */}
      {hayFiltros && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {filtroTipo !== 'todos' && (
            <button className="chip" onClick={() => setFiltroTipo('todos')} aria-label={`Quitar filtro ${TIPOS.find(t => t.valor === filtroTipo)?.etiqueta}`}
              style={{ background: 'var(--acento-suave)', color: 'var(--acento)', borderColor: 'transparent', minHeight: 32, paddingRight: 10 }}>
              {TIPOS.find(t => t.valor === filtroTipo)?.etiqueta}
              <Icono nombre="x" size={13} grosor={2.4} />
            </button>
          )}
          {filtroMes && (
            <button className="chip" onClick={() => setFiltroMes('')} aria-label="Quitar filtro de mes"
              style={{ background: 'var(--acento-suave)', color: 'var(--acento)', borderColor: 'transparent', minHeight: 32, paddingRight: 10 }}>
              {capitalizar(meses.find(m => m.valor === filtroMes)?.corto || '')}
              <Icono nombre="x" size={13} grosor={2.4} />
            </button>
          )}
        </div>
      )}

      {/* Contenido */}
      {cargando ? (
        <div className="lista-grupo" aria-busy="true">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="fila" style={{ '--sangria': '64px' }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
              <div className="fila-cuerpo">
                <div className="skeleton" style={{ height: 13, width: '55%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 10, width: '30%' }} />
              </div>
              <div className="skeleton" style={{ height: 13, width: 72 }} />
            </div>
          ))}
        </div>
      ) : grupos.length === 0 ? (
        busqueda ? (
          <EstadoVacio icono="search" titulo="Sin resultados" texto={`No hay movimientos que coincidan con "${busqueda}".`} />
        ) : (
          <EstadoVacio
            icono="bandeja"
            titulo={hayFiltros ? 'Nada con estos filtros' : 'Aún no hay movimientos'}
            texto={hayFiltros ? 'Prueba con otro tipo o período.' : 'Registra tu primer gasto o ingreso para verlo aquí.'}
            accion={!hayFiltros && <button className="btn-primario" onClick={() => navigate('/nueva')}><Icono nombre="plus" size={18} grosor={2.4} />Nueva transacción</button>}
          />
        )
      ) : (
        <div
          className="aparecer"
          aria-busy={actualizando}
          style={{ display: 'flex', flexDirection: 'column', gap: 22, opacity: actualizando ? 0.6 : 1, transition: 'opacity 160ms var(--ease-out)' }}
        >
          {busqueda && (
            <p className="texto-nota" style={{ marginBottom: -10, paddingLeft: 4 }}>
              {transaccionesFiltradas.length}{siguiente ? '+' : ''} resultado{transaccionesFiltradas.length !== 1 ? 's' : ''}
            </p>
          )}

          {grupos.map(({ fecha, label, items, neto }) => (
            <section key={fecha} aria-label={label}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 8px' }}>
                <h2 className="seccion-label" style={{ margin: 0, padding: 0 }}>{label}</h2>
                {neto !== 0 && (
                  <span className="texto-mini cifra" style={{ color: 'var(--texto-secundario)' }}>
                    {neto > 0 ? '+' : '−'}{formatCOP(Math.abs(neto))}
                  </span>
                )}
              </div>

              <div className="lista-grupo">
                {items.map(t => {
                  const cats = t.categorias || []
                  return (
                    <button
                      key={t.id}
                      className="fila"
                      style={{ '--sangria': '64px' }}
                      onClick={() => navigate(`/editar/${t.id}`)}
                      aria-label={`${t.nombre}, ${TIPO_SIGNO[t.tipo]}${formatCOP(t.monto)}. Editar`}
                    >
                      <TipoIcono tipo={t.tipo} />
                      <div className="fila-cuerpo">
                        <p className="fila-titulo" style={{ fontSize: 16, fontWeight: 500 }}>
                          {busqueda ? <Resaltar texto={t.nombre} busqueda={busqueda} /> : t.nombre}
                        </p>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, overflow: 'hidden' }}>
                          {cats.slice(0, 2).map(cat => (
                            <span key={cat.id} className="etiqueta" style={{ background: cat.color_hex + '22', color: 'var(--texto-secundario)' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color_hex }} />
                              {busqueda ? <Resaltar texto={cat.nombre} busqueda={busqueda} /> : cat.nombre}
                            </span>
                          ))}
                          {cats.length > 2 && <span className="texto-mini">+{cats.length - 2}</span>}
                          {cats.length === 0 && (
                            <span className="texto-mini" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {detalleSinCategoria(t)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="cifra" style={{ fontSize: 16, fontWeight: 600, color: TIPO_COLOR[t.tipo], flexShrink: 0 }}>
                        {TIPO_SIGNO[t.tipo]}{formatCOP(t.monto)}
                      </span>
                      <span className="fila-chevron"><Icono nombre="chevron-right" size={16} grosor={2.2} /></span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}

          {siguiente && (
            <div ref={centinela} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px' }}>
              <button className="btn-texto" onClick={cargarMas} disabled={cargandoMas} style={{ fontSize: 15 }}>
                {cargandoMas ? 'Cargando…' : 'Ver más movimientos'}
              </button>
            </div>
          )}
        </div>
      )}

      <FiltrosPanel
        open={filtrosOpen}
        onClose={() => setFiltrosOpen(false)}
        filtroTipo={filtroTipo}
        setFiltroTipo={setFiltroTipo}
        filtroMes={filtroMes}
        setFiltroMes={setFiltroMes}
        meses={meses}
      />
    </Pagina>
  )
}

function Resaltar({ texto, busqueda }) {
  const q = busqueda.trim().toLowerCase()
  const idx = texto.toLowerCase().indexOf(q)
  if (idx === -1 || !q) return texto
  return (
    <>
      {texto.slice(0, idx)}
      <mark style={{ background: 'rgba(10,132,255,0.3)', color: 'inherit', borderRadius: 3, padding: '0 1px' }}>
        {texto.slice(idx, idx + q.length)}
      </mark>
      {texto.slice(idx + q.length)}
    </>
  )
}
