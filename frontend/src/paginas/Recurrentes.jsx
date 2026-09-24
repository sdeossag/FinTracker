import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import api, { ensureArray } from '../api'
import Pagina from '../componentes/Pagina'
import Icono, { TipoIcono } from '../componentes/Icono'
import Sheet, { ConfirmarSheet } from '../componentes/Sheet'
import { AvisoError, CampoMonto, EstadoVacio, Interruptor, Segmentado } from '../componentes/Controles'
import { TIPOS_TRANSACCION, usaDestino, usaDosCuentas, usaOrigen } from '../utils/transaccion'
import { fechaLocalISO, formatCOP, vibrar } from '../utils/formato'

const FRECUENCIAS = [
  { valor: 'diaria',    etiqueta: 'Diaria' },
  { valor: 'semanal',   etiqueta: 'Semanal' },
  { valor: 'quincenal', etiqueta: 'Quincenal' },
  { valor: 'mensual',   etiqueta: 'Mensual' },
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

const TIPOS_COLOR = { gasto: 'var(--gasto)', ingreso: 'var(--ingreso)', ahorro: 'var(--ahorro)', transferencia: 'var(--texto-primario)' }
const TIPOS_SIGNO = { gasto: '−', ingreso: '+', ahorro: '', transferencia: '' }

const formVacio = {
  nombre: '', monto: '', tipo: 'gasto', frecuencia: 'mensual',
  dia_ejecucion: null, cuenta_origen: '', cuenta_destino: '', categoria: '',
}

function descripcionProgramacion(rec) {
  const frec = FRECUENCIAS.find(f => f.valor === rec.frecuencia)?.etiqueta
  if (!rec.dia_ejecucion) return rec.frecuencia === 'diaria' ? 'Todos los días' : `${frec} · manual`
  if (rec.frecuencia === 'semanal') return `Cada ${DIAS_SEMANA.find(d => d.valor === rec.dia_ejecucion)?.etiqueta.toLowerCase()}`
  if (rec.frecuencia === 'mensual') return `El ${rec.dia_ejecucion} de cada mes`
  if (rec.frecuencia === 'quincenal') return `Los días ${rec.dia_ejecucion} y ${rec.dia_ejecucion + 15}`
  return frec
}

/* ── Selector de día (cuadrícula en línea, sin popover) ── */
function SelectorDia({ valor, onChange, max }) {
  return (
    <div role="radiogroup" aria-label="Día del mes" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(d => {
        const sel = valor === d
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(sel ? null : d)}
            className="cifra"
            style={{
              height: 38, borderRadius: 10, fontSize: 15,
              background: sel ? 'var(--acento)' : 'transparent',
              color: sel ? '#fff' : 'var(--texto-primario)',
              fontWeight: sel ? 600 : 400,
              transition: 'background-color 150ms ease, color 150ms ease',
            }}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}

export default function Recurrentes() {
  const [recurrentes, setRecurrentes] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(formVacio)
  const [errorForm, setErrorForm] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [registrandoId, setRegistrandoId] = useState(null)
  const [confirmAbierto, setConfirmAbierto] = useState(false)
  const [feedbackId, setFeedbackId] = useState(null)

  const cargar = async () => {
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

  useEffect(() => { cargar() }, [])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const abrirModal = () => { setForm(formVacio); setEditandoId(null); setErrorForm(''); setModal(true) }
  const cerrarModal = () => { setModal(false); setErrorForm('') }

  const abrirEditar = (rec) => {
    setForm({
      nombre: rec.nombre,
      monto: String(rec.monto),
      tipo: rec.tipo,
      frecuencia: rec.frecuencia,
      dia_ejecucion: rec.dia_ejecucion ?? null,
      cuenta_origen: rec.cuenta_origen ? String(rec.cuenta_origen) : '',
      cuenta_destino: rec.cuenta_destino ? String(rec.cuenta_destino) : '',
      categoria: rec.categoria ? String(rec.categoria) : '',
    })
    setEditandoId(rec.id)
    setErrorForm('')
    setModal(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { setErrorForm('El nombre es obligatorio.'); return }
    if (!(parseInt(form.monto) > 0)) { setErrorForm('El monto debe ser mayor a 0.'); return }
    if (usaOrigen(form.tipo) && !form.cuenta_origen) { setErrorForm('Selecciona de qué cuenta sale.'); return }
    if (usaDestino(form.tipo) && !form.cuenta_destino) { setErrorForm('Selecciona a qué cuenta entra.'); return }
    if (usaDosCuentas(form.tipo) && form.cuenta_origen === form.cuenta_destino) {
      setErrorForm('La cuenta de origen y la de destino deben ser distintas.'); return
    }
    setErrorForm('')
    setGuardando(true)
    const payload = {
      nombre: form.nombre.trim(),
      monto: parseInt(form.monto),
      tipo: form.tipo,
      frecuencia: form.frecuencia,
      dia_ejecucion: form.frecuencia === 'diaria' ? null : (form.dia_ejecucion || null),
      cuenta_origen: form.cuenta_origen || null,
      cuenta_destino: form.cuenta_destino || null,
      categoria: form.categoria || null,
    }
    try {
      if (editandoId) {
        await api.patch(`/recurrentes/${editandoId}/`, payload)
      } else {
        await api.post('/recurrentes/', payload)
      }
      cerrarModal()
      await cargar()
      toast.success(editandoId ? 'Plantilla actualizada' : 'Plantilla creada', { description: payload.nombre })
    } catch (err) {
      const d = err.response?.data
      setErrorForm(d?.non_field_errors?.[0] || d?.detail || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  // Optimista: el switch responde al instante y se revierte si falla
  const toggleActiva = async (rec) => {
    setRecurrentes(prev => prev.map(r => r.id === rec.id ? { ...r, activa: !rec.activa } : r))
    try {
      const res = await api.patch(`/recurrentes/${rec.id}/`, { activa: !rec.activa })
      setRecurrentes(prev => prev.map(r => r.id === rec.id ? res.data : r))
    } catch {
      setRecurrentes(prev => prev.map(r => r.id === rec.id ? { ...r, activa: rec.activa } : r))
      toast.error('No se pudo cambiar el estado')
    }
  }

  const eliminar = async () => {
    if (!editandoId) return
    try {
      await api.delete(`/recurrentes/${editandoId}/`)
      setRecurrentes(prev => prev.filter(r => r.id !== editandoId))
      setConfirmAbierto(false)
      cerrarModal()
      toast.success('Plantilla eliminada')
    } catch {
      toast.error('No se pudo eliminar la plantilla')
    }
  }

  const registrarAhora = async (rec) => {
    setRegistrandoId(rec.id)
    try {
      await api.post('/transacciones/', {
        nombre: rec.nombre,
        monto: rec.monto,
        tipo: rec.tipo,
        fecha: fechaLocalISO(),
        cuenta_origen: rec.cuenta_origen || null,
        cuenta_destino: rec.cuenta_destino || null,
        categorias_ids: rec.categoria ? [rec.categoria] : [],
        notas: `Desde recurrente: ${rec.nombre}`,
      })
      vibrar()
      setFeedbackId(rec.id)
      setTimeout(() => setFeedbackId(id => (id === rec.id ? null : id)), 2000)
    } catch (err) {
      console.error('Error registrando recurrente:', err)
      toast.error('No se pudo registrar', { description: rec.nombre })
    } finally {
      setRegistrandoId(null)
    }
  }

  const categoriasFiltradas = categorias.filter(c => c.tipo === form.tipo)
  const necesitaDia = form.frecuencia !== 'diaria'

  const textoProgramacion = !form.dia_ejecucion
    ? 'Sin día fijo: solo se registra cuando toques "Registrar ahora".'
    : form.frecuencia === 'semanal'
      ? `Se registrará automáticamente cada ${DIAS_SEMANA.find(d => d.valor === form.dia_ejecucion)?.etiqueta.toLowerCase()}.`
      : form.frecuencia === 'quincenal'
        ? `Se registrará los días ${form.dia_ejecucion} y ${form.dia_ejecucion + 15} de cada mes.`
        : `Se registrará el día ${form.dia_ejecucion} de cada mes.`

  return (
    <Pagina
      titulo="Recurrentes"
      atras={{ etiqueta: 'Historial', a: '/transacciones' }}
      acciones={
        <button onClick={abrirModal} className="btn-icono acento" aria-label="Nueva plantilla">
          <Icono nombre="plus" size={20} grosor={2.2} />
        </button>
      }
    >
      <p className="texto-nota" style={{ margin: '-8px 0 22px', paddingRight: 8 }}>
        Plantillas para movimientos que se repiten. Con un día configurado se registran solas; si no, usa "Registrar ahora".
      </p>

      {cargando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-busy="true">
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 150, borderRadius: 20 }} />)}
        </div>
      ) : recurrentes.length === 0 ? (
        <EstadoVacio
          icono="repetir"
          titulo="Sin plantillas aún"
          texto="Crea una para el arriendo, Netflix, tu sueldo o cualquier movimiento que se repita."
          accion={<button onClick={abrirModal} className="btn-primario"><Icono nombre="plus" size={18} grosor={2.4} />Crear plantilla</button>}
        />
      ) : (
        <div className="aparecer" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {recurrentes.map(rec => {
            const enFeedback = feedbackId === rec.id
            const enRegistro = registrandoId === rec.id
            const cuentasTexto = [rec.cuenta_origen_nombre, rec.cuenta_destino_nombre].filter(Boolean).join(' → ')

            return (
              <article key={rec.id} className="card" style={{ padding: 16 }} aria-label={rec.nombre}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', opacity: rec.activa ? 1 : 0.5, transition: 'opacity 200ms ease' }}>
                  <TipoIcono tipo={rec.tipo} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="fila-titulo" style={{ fontWeight: 600 }}>{rec.nombre}</p>
                    <p className="fila-sub" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {rec.dia_ejecucion || rec.frecuencia === 'diaria'
                        ? <Icono nombre="reloj" size={13} style={{ color: 'var(--acento)', flexShrink: 0 }} />
                        : null}
                      {descripcionProgramacion(rec)}
                    </p>
                  </div>
                  <Interruptor
                    activo={rec.activa}
                    onChange={() => toggleActiva(rec)}
                    etiqueta={rec.activa ? `Pausar ${rec.nombre}` : `Activar ${rec.nombre}`}
                  />
                </div>

                <p className="cifra" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: TIPOS_COLOR[rec.tipo], margin: '14px 0 4px', opacity: rec.activa ? 1 : 0.5 }}>
                  {TIPOS_SIGNO[rec.tipo]}{formatCOP(rec.monto)}
                </p>

                {(cuentasTexto || rec.categoria_nombre || rec.ultima_ejecucion) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {cuentasTexto && <span className="etiqueta" style={{ background: 'var(--card-hover)', color: 'var(--texto-secundario)' }}>{cuentasTexto}</span>}
                    {rec.categoria_nombre && (
                      <span className="etiqueta" style={{ background: rec.categoria_color + '22', color: 'var(--texto-secundario)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: rec.categoria_color }} />
                        {rec.categoria_nombre}
                      </span>
                    )}
                    {rec.ultima_ejecucion && (
                      <span className="etiqueta" style={{ background: 'var(--card-hover)', color: 'var(--texto-terciario)' }}>
                        Última: {new Date(rec.ultima_ejecucion + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => registrarAhora(rec)}
                    disabled={!rec.activa || enRegistro}
                    className={enFeedback ? 'btn-primario' : 'btn-tinte'}
                    style={{ flex: 1, minHeight: 44, fontSize: 15, background: enFeedback ? 'var(--ingreso)' : undefined }}
                    aria-live="polite"
                  >
                    {enFeedback
                      ? <><Icono nombre="check" size={17} grosor={2.6} />Registrada</>
                      : enRegistro ? 'Registrando…' : 'Registrar ahora'}
                  </button>
                  <button onClick={() => abrirEditar(rec)} className="btn-secundario" aria-label={`Editar ${rec.nombre}`}
                    style={{ width: 44, minHeight: 44, padding: 0, flexShrink: 0 }}>
                    <Icono nombre="lapiz" size={17} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Crear / editar */}
      <Sheet
        abierto={modal}
        onCerrar={cerrarModal}
        titulo={editandoId ? 'Editar plantilla' : 'Nueva plantilla'}
        pie={
          <>
            <button onClick={guardar} disabled={guardando} className="btn-primario">
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear plantilla'}
            </button>
            {editandoId && (
              <button className="btn-texto peligro" onClick={() => setConfirmAbierto(true)}>Eliminar plantilla</button>
            )}
          </>
        }
      >
        <div className="campo">
          <Segmentado
            etiqueta="Tipo"
            opciones={TIPOS_TRANSACCION}
            valor={form.tipo}
            onChange={t => setForm(f => ({ ...f, tipo: t, cuenta_origen: '', cuenta_destino: '', categoria: '' }))}
          />
        </div>

        <div className="campo">
          <label className="label" htmlFor="rec-nombre">Nombre</label>
          <input id="rec-nombre" className="input" placeholder="Ej: Netflix, arriendo, sueldo…" value={form.nombre}
            onChange={set('nombre')} autoCapitalize="sentences" enterKeyHint="next" />
        </div>

        <div className="campo">
          <label className="label" htmlFor="rec-monto">Monto</label>
          <CampoMonto id="rec-monto" valor={form.monto} onChange={monto => setForm(f => ({ ...f, monto }))} />
        </div>

        <div className="campo">
          <p className="label">Frecuencia</p>
          <Segmentado
            etiqueta="Frecuencia"
            opciones={FRECUENCIAS}
            valor={form.frecuencia}
            onChange={frecuencia => setForm(f => ({ ...f, frecuencia, dia_ejecucion: null }))}
          />
        </div>

        {necesitaDia && (
          <div className="campo">
            <p className="label">
              {form.frecuencia === 'semanal' ? 'Día de la semana'
                : form.frecuencia === 'quincenal' ? 'Día base (ese día y 15 días después)'
                : 'Día del mes'}
              <span style={{ color: 'var(--texto-terciario)' }}> · opcional</span>
            </p>
            <div className="card" style={{ padding: 8, background: 'var(--card-hover)', borderRadius: 14 }}>
              {form.frecuencia === 'semanal' ? (
                <div role="radiogroup" aria-label="Día de la semana" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {DIAS_SEMANA.map(d => {
                    const sel = form.dia_ejecucion === d.valor
                    return (
                      <button key={d.valor} type="button" role="radio" aria-checked={sel} aria-label={d.etiqueta}
                        onClick={() => setForm(f => ({ ...f, dia_ejecucion: sel ? null : d.valor }))}
                        style={{
                          height: 38, borderRadius: 10, fontSize: 14,
                          background: sel ? 'var(--acento)' : 'transparent',
                          color: sel ? '#fff' : 'var(--texto-primario)',
                          fontWeight: sel ? 600 : 400,
                          transition: 'background-color 150ms ease, color 150ms ease',
                        }}>
                        {d.etiqueta.slice(0, 2)}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <SelectorDia
                  valor={form.dia_ejecucion}
                  onChange={d => setForm(f => ({ ...f, dia_ejecucion: d }))}
                  max={form.frecuencia === 'quincenal' ? 14 : 28}
                />
              )}
            </div>
            <p className="campo-ayuda" style={{ color: form.dia_ejecucion ? 'var(--acento)' : undefined }}>{textoProgramacion}</p>
          </div>
        )}

        {usaOrigen(form.tipo) && (
          <div className="campo">
            <label className="label" htmlFor="rec-origen">{usaDosCuentas(form.tipo) ? 'Sale de' : 'Cuenta'}</label>
            <select id="rec-origen" className="input" value={form.cuenta_origen} onChange={set('cuenta_origen')}>
              <option value="">Seleccionar cuenta…</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        )}
        {usaDestino(form.tipo) && (
          <div className="campo">
            <label className="label" htmlFor="rec-destino">{usaDosCuentas(form.tipo) ? 'Entra a' : 'Cuenta'}</label>
            <select id="rec-destino" className="input" value={form.cuenta_destino} onChange={set('cuenta_destino')}>
              <option value="">Seleccionar cuenta…</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        )}

        {categoriasFiltradas.length > 0 && (
          <div className="campo">
            <label className="label" htmlFor="rec-cat">Categoría <span style={{ color: 'var(--texto-terciario)' }}>· opcional</span></label>
            <select id="rec-cat" className="input" value={form.categoria} onChange={set('categoria')}>
              <option value="">Sin categoría</option>
              {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        )}

        <AvisoError>{errorForm}</AvisoError>
      </Sheet>

      <ConfirmarSheet
        abierto={confirmAbierto}
        onCerrar={() => setConfirmAbierto(false)}
        titulo="¿Eliminar plantilla?"
        mensaje={`"${form.nombre || 'Esta plantilla'}" dejará de registrarse. Las transacciones que ya creó se conservan.`}
        textoConfirmar="Eliminar plantilla"
        onConfirmar={eliminar}
      />
    </Pagina>
  )
}
