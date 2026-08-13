import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { ensureArray } from '../api'

const formatCOP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)

const FRECUENCIAS = [
  { valor: 'diaria',    etiqueta: 'Diaria',     icono: '📅' },
  { valor: 'semanal',   etiqueta: 'Semanal',    icono: '📆' },
  { valor: 'quincenal', etiqueta: 'Quincenal',  icono: '🗓️' },
  { valor: 'mensual',   etiqueta: 'Mensual',    icono: '📊' },
]

const DIAS_SEMANA = [
  { valor: 1, etiqueta: 'Lunes' },
  { valor: 2, etiqueta: 'Martes' },
  { valor: 3, etiqueta: 'Miércoles' },
  { valor: 4, etiqueta: 'Jueves' },
  { valor: 5, etiqueta: 'Viernes' },
  { valor: 6, etiqueta: 'Sábado' },
  { valor: 7, etiqueta: 'Domingo' },
]

const TIPOS_COLOR = { gasto: 'var(--gasto)', ingreso: 'var(--ingreso)', ahorro: 'var(--ahorro)' }
const TIPOS_SUAVE = { gasto: 'var(--gasto-suave)', ingreso: 'var(--ingreso-suave)', ahorro: 'var(--ahorro-suave)' }
const TIPOS_SIGNO = { gasto: '-', ingreso: '+', ahorro: '→' }

const formVacio = {
  nombre: '', monto: '', tipo: 'gasto', frecuencia: 'mensual',
  dia_ejecucion: null, cuenta_origen: '', cuenta_destino: '', categoria: '',
}

function DayPickerDropdown({ value, onChange, maxDia = 28 }) {
  const [open, setOpen] = useState(false)
  const dias = Array.from({ length: maxDia }, (_, i) => i + 1)

  const seleccionar = (d) => {
    onChange(value === d ? null : d)
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--card-hover)', border: open ? '1.5px solid var(--acento)' : '0.5px solid var(--borde)',
          borderRadius: 12, padding: '12px 16px', cursor: 'pointer', transition: 'border 0.15s',
        }}
      >
        <span style={{
          fontSize: 15,
          color: value ? 'var(--texto-primario)' : 'var(--texto-terciario)',
          fontWeight: value ? 600 : 400,
        }}>
          {value ? `Día ${value}` : 'Seleccionar día...'}
        </span>
        <span style={{
          color: 'var(--texto-terciario)', fontSize: 12,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
          display: 'inline-block',
        }}>▾</span>
      </button>

      {open && (
        <>
          {/* Backdrop para cerrar */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />

          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: 'var(--card-elevated, #1c2840)', borderRadius: 16,
            border: '0.5px solid var(--borde)', padding: '12px 10px',
            zIndex: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {/* Limpiar selección */}
            {value && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false) }}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  color: 'var(--texto-terciario)', fontSize: 12, cursor: 'pointer',
                  padding: '4px 0 10px', textAlign: 'center',
                }}
              >
                ✕ Quitar selección
              </button>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {dias.map(d => {
                const sel = value === d
                return (
                  <button key={d} type="button" onClick={() => seleccionar(d)} style={{
                    height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: sel ? 'var(--acento)' : 'transparent',
                    color: sel ? '#fff' : 'var(--texto-secundario)',
                    fontWeight: sel ? 700 : 400, fontSize: 13,
                    transition: 'all 0.12s',
                  }}>
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function labelDia(rec) {
  if (!rec.dia_ejecucion) return null
  if (rec.frecuencia === 'semanal') {
    return DIAS_SEMANA.find(d => d.valor === rec.dia_ejecucion)?.etiqueta
  }
  if (rec.frecuencia === 'mensual') return `Día ${rec.dia_ejecucion} de cada mes`
  if (rec.frecuencia === 'quincenal') return `Día ${rec.dia_ejecucion} y ${rec.dia_ejecucion + 15} de cada mes`
  return null
}

export default function Recurrentes() {
  const navigate = useNavigate()
  const [recurrentes, setRecurrentes] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(formVacio)
  const [errorForm, setErrorForm] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [registrandoId, setRegistrandoId] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [feedbackId, setFeedbackId] = useState(null)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setCargando(true)
    try {
      const [resR, resC, resCat] = await Promise.all([
        api.get('/recurrentes/'),
        api.get('/cuentas/'),
        api.get('/categorias/'),
      ])
      setRecurrentes(ensureArray(resR.data))
      setCuentas(ensureArray(resC.data))
      setCategorias(ensureArray(resCat.data))
    } catch (err) {
      console.error('Error cargando recurrentes:', err)
    } finally {
      setCargando(false)
    }
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const abrirModal = () => { setForm(formVacio); setErrorForm(''); setModal(true) }
  const cerrarModal = () => { setModal(false); setErrorForm('') }

  const guardar = async () => {
    if (!form.nombre.trim()) { setErrorForm('El nombre es obligatorio.'); return }
    if (!form.monto || parseInt(form.monto) <= 0) { setErrorForm('El monto debe ser mayor a 0.'); return }
    if (form.tipo === 'gasto' && !form.cuenta_origen) { setErrorForm('Selecciona la cuenta de origen.'); return }
    if (form.tipo === 'ingreso' && !form.cuenta_destino) { setErrorForm('Selecciona la cuenta de destino.'); return }
    if (form.tipo === 'ahorro' && (!form.cuenta_origen || !form.cuenta_destino)) {
      setErrorForm('Para ahorros necesitas cuenta origen y destino.'); return
    }
    setErrorForm('')
    setGuardando(true)
    try {
      await api.post('/recurrentes/', {
        nombre: form.nombre,
        monto: parseInt(form.monto),
        tipo: form.tipo,
        frecuencia: form.frecuencia,
        dia_ejecucion: form.dia_ejecucion ?? null,
        cuenta_origen: form.cuenta_origen || null,
        cuenta_destino: form.cuenta_destino || null,
        categoria: form.categoria || null,
      })
      cerrarModal()
      await cargar()
    } catch (err) {
      const d = err.response?.data
      setErrorForm(d?.non_field_errors?.[0] || d?.detail || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const toggleActiva = async (rec) => {
    try {
      const res = await api.patch(`/recurrentes/${rec.id}/`, { activa: !rec.activa })
      setRecurrentes(prev => prev.map(r => r.id === rec.id ? res.data : r))
    } catch { /* silencioso */ }
  }

  const eliminar = async (id) => {
    try {
      await api.delete(`/recurrentes/${id}/`)
      setRecurrentes(prev => prev.filter(r => r.id !== id))
      setConfirmEliminar(null)
    } catch { /* silencioso */ }
  }

  const registrarAhora = async (rec) => {
    setRegistrandoId(rec.id)
    try {
      await api.post('/transacciones/', {
        nombre: rec.nombre,
        monto: rec.monto,
        tipo: rec.tipo,
        fecha: new Date().toISOString().split('T')[0],
        cuenta_origen: rec.cuenta_origen || null,
        cuenta_destino: rec.cuenta_destino || null,
        categorias_ids: rec.categoria ? [rec.categoria] : [],
        notas: `Desde recurrente: ${rec.nombre}`,
      })
      setFeedbackId(rec.id)
      setTimeout(() => setFeedbackId(null), 2000)
    } catch (err) {
      console.error('Error registrando recurrente:', err)
    } finally {
      setRegistrandoId(null)
    }
  }

  const categoriasFiltradas = categorias.filter(c => c.tipo === form.tipo)
  const necesitaDia = form.frecuencia !== 'diaria'

  return (
    <div className="pagina" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        {/* Volver */}
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', padding: 0,
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--acento)', cursor: 'pointer', fontSize: 14,
          fontWeight: 500, marginBottom: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Historial
        </button>

        {/* Título + botón nueva en la misma fila pero título dominante */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Recurrentes</h1>
          <button
            onClick={abrirModal}
            onMouseEnter={e => { e.currentTarget.style.background = '#0A84FF'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#0A84FF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,132,255,0.12)'; e.currentTarget.style.color = 'var(--acento)'; e.currentTarget.style.borderColor = 'rgba(10,132,255,0.35)' }}
            style={{
              background: 'rgba(10,132,255,0.12)', border: '0.5px solid rgba(10,132,255,0.35)',
              borderRadius: 20, padding: '8px 16px', fontSize: 14, fontWeight: 600,
              color: 'var(--acento)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              transition: 'background 0.18s, color 0.18s, border-color 0.18s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 22 22" fill="none">
              <path d="M11 4V18M4 11H18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
            </svg>
            Nueva
          </button>
        </div>
      </div>

      {/* Descripción */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>🔁</span>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 13, lineHeight: '1.6' }}>
          Plantillas para movimientos que se repiten. Si configuras un día, la app las registra automáticamente. Si no, usa <strong>Registrar ahora</strong> cuando quieras.
        </p>
      </div>

      {/* Lista */}
      {cargando ? (
        <p style={{ color: 'var(--texto-secundario)', fontSize: 14 }}>Cargando...</p>
      ) : recurrentes.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🔁</p>
          <p style={{ color: 'var(--texto-secundario)', fontSize: 15, fontWeight: 500 }}>Sin plantillas aún</p>
          <p style={{ color: 'var(--texto-terciario)', fontSize: 13, marginTop: 4, marginBottom: 24 }}>
            Crea una para movimientos que se repiten
          </p>
          <button onClick={abrirModal} className="btn-primario" style={{ padding: '12px 28px' }}>
            Crear primera plantilla
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {recurrentes.map(rec => {
            const frec = FRECUENCIAS.find(f => f.valor === rec.frecuencia)
            const enFeedback = feedbackId === rec.id
            const enRegistro = registrandoId === rec.id
            const diaLabel = labelDia(rec)

            return (
              <div key={rec.id} className="card" style={{
                padding: '20px',
                opacity: rec.activa ? 1 : 0.55,
                transition: 'opacity 0.2s',
                border: enFeedback ? '1.5px solid var(--ingreso)' : '0.5px solid var(--borde)',
              }}>

                {/* — Fila superior: icono + info + estado — */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                  {/* Icono tipo */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: TIPOS_SUAVE[rec.tipo],
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}>
                    {rec.tipo === 'ingreso' ? '💰' : rec.tipo === 'ahorro' ? '🏦' : '💸'}
                  </div>

                  {/* Nombre y monto */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badges */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        background: TIPOS_SUAVE[rec.tipo], color: TIPOS_COLOR[rec.tipo],
                        textTransform: 'uppercase', letterSpacing: 0.4,
                      }}>{rec.tipo}</span>
                      <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 20,
                        background: 'var(--card-hover)', color: 'var(--texto-terciario)',
                      }}>
                        {frec?.icono} {frec?.etiqueta}
                      </span>
                      {diaLabel && (
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 20,
                          background: 'var(--acento-suave)', color: 'var(--acento)',
                        }}>
                          🤖 {diaLabel}
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontWeight: 600, fontSize: 16, marginBottom: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {rec.nombre}
                    </p>
                    <p style={{ fontWeight: 800, fontSize: 20, color: TIPOS_COLOR[rec.tipo] }}>
                      {TIPOS_SIGNO[rec.tipo]}{formatCOP(rec.monto)}
                    </p>
                  </div>

                  {/* Toggle activa */}
                  <button onClick={() => toggleActiva(rec)} style={{
                    background: rec.activa ? 'var(--ingreso-suave)' : 'var(--card-hover)',
                    border: 'none', borderRadius: 20, padding: '6px 12px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                    color: rec.activa ? 'var(--ingreso)' : 'var(--texto-terciario)',
                    whiteSpace: 'nowrap',
                  }}>
                    {rec.activa ? '● Activa' : '○ Pausada'}
                  </button>
                </div>

                {/* — Info secundaria — */}
                {(rec.cuenta_origen_nombre || rec.cuenta_destino_nombre || rec.categoria_nombre || rec.ultima_ejecucion) && (
                  <div style={{
                    display: 'flex', gap: 6, flexWrap: 'wrap',
                    padding: '12px 0',
                    borderTop: '0.5px solid var(--separador)',
                    borderBottom: '0.5px solid var(--separador)',
                    marginBottom: 16,
                  }}>
                    {rec.cuenta_origen_nombre && (
                      <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 10, background: 'var(--card-hover)', color: 'var(--texto-secundario)' }}>
                        ↑ {rec.cuenta_origen_nombre}
                      </span>
                    )}
                    {rec.cuenta_destino_nombre && (
                      <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 10, background: 'var(--card-hover)', color: 'var(--texto-secundario)' }}>
                        ↓ {rec.cuenta_destino_nombre}
                      </span>
                    )}
                    {rec.categoria_nombre && (
                      <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 10, background: rec.categoria_color + '22', color: rec.categoria_color }}>
                        {rec.categoria_nombre}
                      </span>
                    )}
                    {rec.ultima_ejecucion && (
                      <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 10, background: 'var(--card-hover)', color: 'var(--texto-terciario)' }}>
                        Última: {new Date(rec.ultima_ejecucion + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                )}

                {/* — Acciones — */}
                {confirmEliminar === rec.id ? (
                  <div style={{
                    background: 'var(--gasto-suave)', borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <p style={{ fontSize: 13, color: 'var(--texto-primario)', flex: 1 }}>
                      ¿Eliminar esta plantilla?
                    </p>
                    <button onClick={() => eliminar(rec.id)} style={{
                      background: 'var(--gasto)', color: '#fff', border: 'none',
                      borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>Sí, eliminar</button>
                    <button onClick={() => setConfirmEliminar(null)} style={{
                      background: 'var(--card)', color: 'var(--texto-secundario)', border: 'none',
                      borderRadius: 10, padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                    }}>Cancelar</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => registrarAhora(rec)}
                      disabled={!rec.activa || enRegistro}
                      className="btn-primario"
                      style={{
                        flex: 1, padding: '11px', fontSize: 14,
                        background: enFeedback ? 'var(--ingreso)' : undefined,
                      }}
                    >
                      {enFeedback ? '✓ Registrada' : enRegistro ? 'Registrando...' : 'Registrar ahora'}
                    </button>
                    <button onClick={() => setConfirmEliminar(rec.id)} style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: 'var(--card-hover)', color: 'var(--texto-terciario)',
                      border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 400,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      🗑
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear — se eleva SOBRE el navbar */}
      {modal && (
        <div onClick={cerrarModal} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)', zIndex: 200,
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card)', borderRadius: '24px 24px 0 0',
            padding: '24px 20px',
            paddingBottom: 'calc(var(--nav-height) + 20px)',
            width: '100%', maxWidth: 430, margin: '0 auto',
            maxHeight: '92vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Nueva plantilla recurrente</h2>
              <button onClick={cerrarModal} style={{
                background: 'var(--card-hover)', border: 'none', borderRadius: '50%',
                width: 32, height: 32, cursor: 'pointer', color: 'var(--texto-secundario)', fontSize: 18,
              }}>×</button>
            </div>

            {/* Tipo */}
            <label className="label" style={{ marginBottom: 8, display: 'block' }}>Tipo</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['gasto', 'ingreso', 'ahorro'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t, cuenta_origen: '', cuenta_destino: '', categoria: '' }))} style={{
                  flex: 1, padding: '10px 4px', borderRadius: 12, cursor: 'pointer',
                  background: form.tipo === t ? TIPOS_COLOR[t] : 'var(--card-hover)',
                  color: form.tipo === t ? '#fff' : 'var(--texto-secundario)',
                  border: 'none', fontWeight: 600, fontSize: 13, textTransform: 'capitalize',
                }}>{t}</button>
              ))}
            </div>

            <label className="label" style={{ marginBottom: 6, display: 'block' }}>Nombre</label>
            <input className="input" placeholder="Ej: Netflix, Arriendo, Sueldo..." value={form.nombre} onChange={set('nombre')} style={{ marginBottom: 14 }} />

            <label className="label" style={{ marginBottom: 6, display: 'block' }}>Monto (COP)</label>
            <input className="input" type="number" placeholder="0" value={form.monto} onChange={set('monto')} style={{ marginBottom: 14 }} />

            {/* Frecuencia */}
            <label className="label" style={{ marginBottom: 8, display: 'block' }}>Frecuencia</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {FRECUENCIAS.map(f => (
                <button key={f.valor} onClick={() => setForm(fm => ({ ...fm, frecuencia: f.valor, dia_ejecucion: '' }))} style={{
                  padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  background: form.frecuencia === f.valor ? 'var(--acento-suave)' : 'var(--card-hover)',
                  color: form.frecuencia === f.valor ? 'var(--acento)' : 'var(--texto-secundario)',
                  border: form.frecuencia === f.valor ? '1.5px solid var(--acento)' : '0.5px solid var(--borde)',
                }}>
                  {f.icono} {f.etiqueta}
                </button>
              ))}
            </div>

            {/* Día de ejecución — contextual según frecuencia */}
            {necesitaDia && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label className="label" style={{ margin: 0 }}>
                    {form.frecuencia === 'semanal' ? '¿Qué día de la semana?' :
                     form.frecuencia === 'quincenal' ? '¿Día base? (ese día y +15)' :
                     '¿Qué día del mes?'}
                  </label>
                  {form.dia_ejecucion && (
                    <span style={{ fontSize: 11, color: 'var(--acento)', background: 'var(--acento-suave)', padding: '3px 8px', borderRadius: 20 }}>
                      🤖 auto-registra
                    </span>
                  )}
                </div>

                {form.frecuencia === 'semanal' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
                    {DIAS_SEMANA.map(d => {
                      const sel = form.dia_ejecucion === d.valor
                      return (
                        <button key={d.valor} type="button"
                          onClick={() => setForm(f => ({ ...f, dia_ejecucion: sel ? null : d.valor }))} style={{
                          padding: '10px 2px', borderRadius: 10, cursor: 'pointer', border: 'none',
                          background: sel ? 'var(--acento)' : 'var(--card-hover)',
                          color: sel ? '#fff' : 'var(--texto-secundario)',
                          fontWeight: sel ? 700 : 400, fontSize: 12, transition: 'all 0.15s',
                        }}>
                          {d.etiqueta.slice(0, 2)}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <DayPickerDropdown
                    value={form.dia_ejecucion}
                    onChange={(d) => setForm(f => ({ ...f, dia_ejecucion: d }))}
                    maxDia={form.frecuencia === 'quincenal' ? 14 : 28}
                  />
                )}

                {form.dia_ejecucion ? (
                  <p style={{ fontSize: 12, color: 'var(--acento)', marginTop: 8, textAlign: 'center' }}>
                    {form.frecuencia === 'semanal' && `Se registrará cada ${DIAS_SEMANA.find(d => d.valor === form.dia_ejecucion)?.etiqueta}`}
                    {form.frecuencia === 'quincenal' && `Se registrará el día ${form.dia_ejecucion} y el ${form.dia_ejecucion + 15} de cada mes`}
                    {form.frecuencia === 'mensual' && `Se registrará el día ${form.dia_ejecucion} de cada mes`}
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--texto-terciario)', marginTop: 8, textAlign: 'center' }}>
                    Sin día → solo se registra con "Registrar ahora"
                  </p>
                )}
              </div>
            )}

            {/* Cuentas */}
            {(form.tipo === 'gasto' || form.tipo === 'ahorro') && (
              <>
                <label className="label" style={{ marginBottom: 6, display: 'block' }}>
                  {form.tipo === 'ahorro' ? 'Cuenta origen' : 'Cuenta'}
                </label>
                <select className="input" value={form.cuenta_origen} onChange={set('cuenta_origen')} style={{ marginBottom: 14 }}>
                  <option value="">Seleccionar cuenta...</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </>
            )}
            {(form.tipo === 'ingreso' || form.tipo === 'ahorro') && (
              <>
                <label className="label" style={{ marginBottom: 6, display: 'block' }}>
                  {form.tipo === 'ahorro' ? 'Cuenta destino' : 'Cuenta'}
                </label>
                <select className="input" value={form.cuenta_destino} onChange={set('cuenta_destino')} style={{ marginBottom: 14 }}>
                  <option value="">Seleccionar cuenta...</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </>
            )}

            {/* Categoría */}
            {categoriasFiltradas.length > 0 && (
              <>
                <label className="label" style={{ marginBottom: 6, display: 'block' }}>Categoría (opcional)</label>
                <select className="input" value={form.categoria} onChange={set('categoria')} style={{ marginBottom: 14 }}>
                  <option value="">Sin categoría</option>
                  {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </>
            )}

            {errorForm && (
              <p style={{ color: 'var(--gasto)', fontSize: 13, background: 'var(--gasto-suave)', padding: '10px 14px', borderRadius: 10, marginBottom: 14 }}>
                {errorForm}
              </p>
            )}

            <button onClick={guardar} disabled={guardando} className="btn-primario" style={{ width: '100%', padding: 14, fontSize: 15 }}>
              {guardando ? 'Guardando...' : 'Crear plantilla'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
