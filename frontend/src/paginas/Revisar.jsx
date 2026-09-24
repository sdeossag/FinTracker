// SMS del banco que no se pudieron registrar solos, y lo que sí se registró
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api, { ensureArray } from '../api'
import Pagina from '../componentes/Pagina'
import Icono from '../componentes/Icono'
import { AvisoError, EstadoVacio } from '../componentes/Controles'
import { capitalizar, formatCOP, vibrar } from '../utils/formato'

const TIPO_POR_CLASE = { compra: 'gasto', recibida: 'ingreso', enviada: 'gasto' }

// "Jue 24 sept · 9:06 a. m."
const cuando = (iso) => {
  const f = new Date(iso)
  const dia = f.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '').replace(/ de /g, ' ')
  return `${capitalizar(dia)} · ${f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`
}

const titulo = (d) => d.comercio || (d.contraparte ? `De ${d.contraparte}` : d.clase === 'enviada' ? 'Transferencia enviada' : 'Movimiento')

export default function Revisar() {
  const navigate = useNavigate()
  const [mensajes, setMensajes] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    Promise.all([api.get('/mensajes/'), api.get('/cuentas/')])
      .then(([m, c]) => {
        if (!vivo) return
        setMensajes(ensureArray(m.data))
        setCuentas(ensureArray(c.data))
        setError('')
      })
      .catch(() => { if (vivo) setError('No se pudieron cargar los mensajes.') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [intento])

  const recargar = () => setIntento(n => n + 1)
  const pendientes = mensajes.filter(m => m.estado === 'pendiente')
  const registrados = mensajes.filter(m => m.estado === 'registrado').slice(0, 15)

  const descartar = async (msg) => {
    // Optimista: desaparece al instante; si falla, vuelve
    setMensajes(ms => ms.map(m => m.id === msg.id ? { ...m, estado: 'descartado' } : m))
    try {
      await api.post(`/mensajes/${msg.id}/descartar/`)
      toast('SMS descartado')
    } catch {
      setMensajes(ms => ms.map(m => m.id === msg.id ? msg : m))
      toast.error('No se pudo descartar')
    }
  }

  const registrarAMano = (msg) => {
    const d = msg.datos || {}
    const p = new URLSearchParams({ mensaje: String(msg.id) })
    if (d.monto) p.set('monto', String(d.monto))
    if (TIPO_POR_CLASE[d.clase]) p.set('tipo', TIPO_POR_CLASE[d.clase])
    const nombre = d.comercio || (d.contraparte ? `Transferencia de ${d.contraparte}` : '')
    if (nombre) p.set('nombre', nombre)
    navigate(`/nueva?${p}`)
  }

  return (
    <Pagina titulo="Por revisar" atras={{ etiqueta: 'Atrás', a: '/' }}>
      {error && (
        <div style={{ marginBottom: 16 }}>
          <AvisoError>{error}</AvisoError>
          <button className="btn-texto" onClick={recargar}>Reintentar</button>
        </div>
      )}

      {cargando ? (
        <div aria-busy="true">
          <div className="skeleton" style={{ height: 150, borderRadius: 20, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 150, borderRadius: 20 }} />
        </div>
      ) : (
        <div className="aparecer">
          {pendientes.length === 0 ? (
            <EstadoVacio
              icono="check-circulo"
              titulo="Todo al día"
              texto={mensajes.length
                ? 'Todos los SMS que llegaron quedaron registrados.'
                : 'Cuando conectes el atajo, aquí verás los SMS que necesiten un dato tuyo.'}
            />
          ) : (
            <section aria-label="SMS por revisar" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
              {pendientes.map(msg => (
                <Pendiente
                  key={msg.id}
                  msg={msg}
                  cuentas={cuentas}
                  onAsignado={recargar}
                  onRegistrar={() => registrarAMano(msg)}
                  onDescartar={() => descartar(msg)}
                />
              ))}
            </section>
          )}

          {registrados.length > 0 && (
            <section aria-label="Registrados automáticamente">
              <h2 className="seccion-label">Registrados automáticamente</h2>
              <div className="lista-grupo">
                {registrados.map(msg => (
                  <button
                    key={msg.id}
                    className="fila"
                    style={{ '--sangria': '58px' }}
                    onClick={() => msg.transaccion && navigate(`/editar/${msg.transaccion}`)}
                    disabled={!msg.transaccion}
                  >
                    <span className="mosaico sm" style={{ background: 'var(--ingreso-suave)', color: 'var(--ingreso)' }}>
                      <Icono nombre="check" size={15} grosor={2.6} />
                    </span>
                    <div className="fila-cuerpo">
                      <p className="fila-titulo" style={{ fontSize: 16 }}>{msg.transaccion_nombre || titulo(msg.datos || {})}</p>
                      <p className="fila-sub">{cuando(msg.recibido_en)}{msg.metodo === 'ia' ? ' · leído con IA' : ''}</p>
                    </div>
                    {msg.datos?.monto && <span className="cifra" style={{ fontWeight: 600, flexShrink: 0 }}>{formatCOP(msg.datos.monto)}</span>}
                    <span className="fila-chevron"><Icono nombre="chevron-right" size={16} grosor={2.2} /></span>
                  </button>
                ))}
              </div>
              <p className="seccion-pie">Toca uno para cambiar su categoría o corregirlo.</p>
            </section>
          )}
        </div>
      )}
    </Pagina>
  )
}

function Pendiente({ msg, cuentas, onAsignado, onRegistrar, onDescartar }) {
  const d = msg.datos || {}
  const [cuenta, setCuenta] = useState('')
  const [asignando, setAsignando] = useState(false)
  // Solo se puede asignar si se entendió el monto y el SMS dice de qué cuenta es
  const puedeAsignar = !!(d.monto && msg.identificador)
  const ident = /^\d+$/.test(msg.identificador || '') ? `*${msg.identificador}` : capitalizar(msg.identificador || '')

  const asignar = async () => {
    if (!cuenta) return
    setAsignando(true)
    try {
      const r = await api.post(`/mensajes/${msg.id}/asignar-cuenta/`, { cuenta: Number(cuenta) })
      vibrar()
      const n = r.data.registrados
      toast.success(`${ident} es ${r.data.cuenta}`, {
        description: n > 1 ? `${n} movimientos registrados.` : 'Movimiento registrado. Los próximos SMS entrarán solos.',
      })
      onAsignado()
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo asignar la cuenta')
      setAsignando(false)
    }
  }

  return (
    <article className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <p className="fila-titulo" style={{ fontWeight: 600, minWidth: 0 }}>{d.monto ? titulo(d) : 'SMS sin reconocer'}</p>
        {d.monto && <span className="cifra" style={{ fontWeight: 700, fontSize: 17, flexShrink: 0 }}>{formatCOP(d.monto)}</span>}
      </div>
      <p className="texto-mini" style={{ marginBottom: 10 }}>{cuando(msg.recibido_en)}</p>
      <p className="sms-texto" style={{ marginBottom: 12 }}>{msg.texto}</p>
      {msg.motivo && (
        <p className="texto-nota" style={{ color: 'var(--ahorro)', display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 14 }}>
          <Icono nombre="info" size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          {msg.motivo}
        </p>
      )}

      {puedeAsignar && cuentas.length > 0 && (
        <div className="campo" style={{ marginBottom: 12 }}>
          <label className="label" htmlFor={`cuenta-${msg.id}`}>¿De qué cuenta es {ident}?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select id={`cuenta-${msg.id}`} className="input" value={cuenta} onChange={e => setCuenta(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
              <option value="">Elegir cuenta…</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <button className="btn-primario" onClick={asignar} disabled={!cuenta || asignando} style={{ width: 'auto', minHeight: 'auto', padding: '0 16px' }}>
              {asignando ? '…' : 'Listo'}
            </button>
          </div>
          <p className="campo-ayuda">La recordaré para los próximos SMS de {ident}.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-secundario" onClick={onRegistrar} style={{ minHeight: 44, fontSize: 15 }}>Registrar a mano</button>
        <button className="btn-secundario" onClick={onDescartar} style={{ minHeight: 44, fontSize: 15, color: 'var(--texto-secundario)' }}>Descartar</button>
      </div>
    </article>
  )
}
