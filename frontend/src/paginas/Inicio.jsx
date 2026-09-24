import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api, { ensureArray, ensureObject, recurrentesApi } from '../api'
import {
  estadoPermiso, pedirPermiso, activarNotif,
  desactivarNotif, notifHabilitadas,
} from '../utils/notificaciones'
import Pagina from '../componentes/Pagina'
import Icono from '../componentes/Icono'
import { EstadoVacio } from '../componentes/Controles'
import Marca from '../componentes/Marca'
import { capitalizar, formatCOP } from '../utils/formato'
import {
  COLOR_TONO, esDeuda, fechaCorta, patrimonio, plazo, resumenTarjeta, rutaPagarTarjeta, tarjetasPorPagar,
} from '../utils/cuentas'

export default function Inicio() {
  const navigate = useNavigate()
  const [cuentas, setCuentas] = useState([])
  const [resumen, setResumen] = useState({ ingresos: 0, gastos: 0, ahorros: 0 })
  const [username, setUsername] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [intento, setIntento] = useState(0)
  const [porRevisar, setPorRevisar] = useState(0)
  const [notifEstado, setNotifEstado] = useState(() => estadoPermiso())
  const [notifActivas, setNotifActivas] = useState(() => notifHabilitadas())

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // allSettled: si el perfil o el resumen fallan, las cuentas igual se muestran
        const [resCuentas, resResumen, resPerfil, resMensajes] = await Promise.allSettled([
          api.get('/cuentas/'),
          api.get('/transacciones/resumen-mes/'),
          api.get('/perfil/'),
          api.get('/mensajes/', { params: { estado: 'pendiente' } }),
        ])
        if (resCuentas.status === 'rejected') { setErrorCarga(true); return }
        const ctas = ensureArray(resCuentas.value.data)
        setCuentas(ctas)
        if (resResumen.status === 'fulfilled') setResumen(ensureObject(resResumen.value.data))
        if (resPerfil.status === 'fulfilled') setUsername(resPerfil.value.data?.username || '')
        if (resMensajes.status === 'fulfilled') setPorRevisar(ensureArray(resMensajes.value.data).length)

        const obKey = 'ft_ob_done'
        if (ctas.length === 0 && !localStorage.getItem(obKey)) {
          navigate('/onboarding', { replace: true })
          return
        }

        try {
          const resEjec = await recurrentesApi.ejecutar()
          const creadas = resEjec.data?.creadas || 0
          if (creadas > 0) {
            const plural = creadas > 1
            toast.success(
              `${creadas} recurrente${plural ? 's' : ''} registrada${plural ? 's' : ''} hoy`,
              { id: 'recurrentes-hoy', description: 'Tus movimientos programados ya están en el historial.', duration: 6000 },
            )
            const { mostrarNotif } = await import('../utils/notificaciones')
            mostrarNotif(
              'FinTracker',
              `${creadas} transacción${plural ? 'es' : ''} recurrente${plural ? 's' : ''} registrada${plural ? 's' : ''} automáticamente hoy`,
            )
          }
        } catch { /* silencioso */ }
      } catch (err) {
        console.error('Error cargando inicio:', err)
      } finally {
        setCargando(false)
      }
    }
    cargarDatos()
  }, [intento])

  async function toggleNotificaciones() {
    if (notifEstado === 'unsupported') return
    if (notifEstado === 'denied') {
      toast('Notificaciones bloqueadas', { description: 'Actívalas desde los ajustes del navegador.' })
      return
    }
    if (notifActivas) {
      desactivarNotif()
      setNotifActivas(false)
      toast('Notificaciones desactivadas')
    } else {
      const permiso = await pedirPermiso()
      setNotifEstado(estadoPermiso())
      if (permiso === 'granted') {
        activarNotif()
        setNotifActivas(true)
        toast.success('Notificaciones activadas')
      }
    }
  }

  const balanceTotal = patrimonio(cuentas)
  const porPagar = tarjetasPorPagar(cuentas)

  const mesActual = capitalizar(new Date().toLocaleString('es-CO', { month: 'long' }))
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = username ? capitalizar(username) : 'Bienvenido'

  const notifBloqueada = notifEstado === 'denied' || notifEstado === 'unsupported'

  const barraIzquierda = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8 }}>
      <Marca size={30} />
      <span className="titulo-3">FinTracker</span>
    </span>
  )

  const acciones = (
    <>
      {notifEstado !== 'unsupported' && (
        <button
          onClick={toggleNotificaciones}
          className={`btn-icono${notifActivas ? ' acento' : ''}`}
          aria-label={notifBloqueada ? 'Notificaciones bloqueadas' : notifActivas ? 'Desactivar notificaciones' : 'Activar notificaciones'}
          aria-pressed={notifActivas}
          style={notifBloqueada ? { opacity: 0.5 } : undefined}
        >
          <Icono nombre={notifBloqueada || !notifActivas ? 'campana-off' : 'campana'} size={18} />
        </button>
      )}
      <button onClick={() => navigate('/configuracion')} className="btn-icono" aria-label="Configuración">
        <Icono nombre="ajustes" size={18} />
      </button>
    </>
  )

  if (cargando) return (
    <Pagina
      izquierda={barraIzquierda}
      acciones={acciones}
      sobreTitulo={saludo}
      tituloCompacto={false}
      titulo={<span className="skeleton" style={{ display: 'inline-block', width: 170, height: 32, verticalAlign: 'middle' }} />}
    >
      <div aria-busy="true">
        <div className="skeleton" style={{ height: 180, borderRadius: 28, marginBottom: 28 }} />
        <div className="skeleton" style={{ height: 12, width: 110, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 170, borderRadius: 20 }} />
      </div>
    </Pagina>
  )

  return (
    <Pagina
      izquierda={barraIzquierda}
      acciones={acciones}
      sobreTitulo={saludo}
      titulo={nombre}
      tituloCompacto={false}
    >
      {errorCarga ? (
        <EstadoVacio
          icono="alerta"
          titulo="No pudimos cargar tus datos"
          texto="Revisa tu conexión e intenta de nuevo."
          accion={<button className="btn-primario" onClick={() => { setErrorCarga(false); setCargando(true); setIntento(n => n + 1) }}>Reintentar</button>}
        />
      ) : cuentas.length === 0 ? (
        <EstadoVacio
          icono="tarjeta"
          titulo="Agrega tu primera cuenta"
          texto="Nequi, efectivo, tu banco o una tarjeta de crédito. Con una cuenta ya puedes registrar movimientos."
          accion={<button className="btn-primario" onClick={() => navigate('/cuentas')}><Icono nombre="plus" size={18} grosor={2.4} />Crear cuenta</button>}
        />
      ) : (
        <div className="aparecer">
          {/* ── Balance ─────────────────────────────── */}
          <section className="card-hero" aria-label="Balance total" style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>
              Balance total
            </p>
            <p className="cifra-hero" style={{
              fontSize: 'clamp(2rem, 10vw, 2.75rem)', marginBottom: 20,
              color: balanceTotal >= 0 ? 'var(--texto-primario)' : 'var(--gasto)',
            }}>
              {formatCOP(balanceTotal)}
            </p>

            <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>{mesActual}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {[
                  ['Ingresos', resumen.ingresos, 'var(--ingreso)'],
                  ['Gastos', resumen.gastos, 'var(--gasto)'],
                  ['Ahorros', resumen.ahorros, 'var(--ahorro)'],
                ].map(([label, valor, color]) => (
                  <div key={label} style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                      {label}
                    </p>
                    <p className="cifra" style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatCOP(valor || 0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── SMS que necesitan un dato ── */}
          {porRevisar > 0 && (
            <div className="lista-grupo" style={{ marginBottom: porPagar.length ? 10 : 28 }}>
              <button className="fila" onClick={() => navigate('/revisar')} style={{ minHeight: 60 }}>
                <span className="mosaico sm" style={{ background: 'var(--acento)', color: '#fff' }}>
                  <Icono nombre="mensaje" size={16} grosor={2.2} />
                </span>
                <div className="fila-cuerpo">
                  <p className="fila-titulo" style={{ fontSize: 15, fontWeight: 600 }}>
                    {porRevisar === 1 ? '1 SMS por revisar' : `${porRevisar} SMS por revisar`}
                  </p>
                  <p className="fila-sub">{porRevisar === 1 ? 'Toca para completarlo' : 'Toca para completarlos'}</p>
                </div>
                <span className="fila-chevron"><Icono nombre="chevron-right" size={16} grosor={2.2} /></span>
              </button>
            </div>
          )}

          {/* ── Tarjetas por pagar: solo si vencen pronto ── */}
          {porPagar.length > 0 && (
            <section aria-label="Pagos de tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {porPagar.map(t => <AvisoPago key={t.id} tarjeta={t} onPagar={() => navigate(rutaPagarTarjeta(t, t.estado_tarjeta.por_pagar))} />)}
            </section>
          )}

          {/* ── Cuentas ─────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 className="seccion-label">Mis cuentas</h2>
            <button className="btn-texto" onClick={() => navigate('/cuentas')} style={{ minHeight: 32, marginBottom: 4, fontSize: 15 }}>
              Ver todas
            </button>
          </div>
          <div className="lista-grupo">
            {cuentas.map(cuenta => (
              <button key={cuenta.id} className="fila" style={{ '--sangria': '64px' }} onClick={() => navigate('/cuentas')}>
                <span className="mosaico" style={{ background: cuenta.color_hex + '26', color: cuenta.color_hex }}>
                  {cuenta.tipo === 'credito'
                    ? <Icono nombre="tarjeta" size={19} grosor={2} />
                    : <span style={{ width: 12, height: 12, borderRadius: '50%', background: cuenta.color_hex }} />}
                </span>
                <div className="fila-cuerpo">
                  <p className="fila-titulo" style={{ fontWeight: 500 }}>{cuenta.nombre}</p>
                  <SubCuenta cuenta={cuenta} />
                </div>
                <span className="cifra" style={{
                  fontWeight: 600, fontSize: 16, flexShrink: 0,
                  color: esDeuda(cuenta.tipo) && cuenta.balance_actual > 0 ? 'var(--gasto)' : 'var(--texto-primario)',
                }}>
                  {formatCOP(cuenta.balance_actual)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Pagina>
  )
}

function SubCuenta({ cuenta }) {
  if (cuenta.tipo === 'credito') {
    const r = resumenTarjeta(cuenta.estado_tarjeta)
    return <p className="fila-sub" style={{ color: COLOR_TONO[r.tono] }}>{r.texto}</p>
  }
  return <p className="fila-sub">{cuenta.tipo === 'pasivo' ? 'Deuda' : 'Disponible'}</p>
}

// Recordatorio de pago: el monto y la fecha a la vista, la acción a un toque
function AvisoPago({ tarjeta, onPagar }) {
  const e = tarjeta.estado_tarjeta
  const vencida = e.situacion === 'vencida'
  const color = vencida ? 'var(--gasto)' : 'var(--ahorro)'
  const cuando = vencida
    ? `Vencido ${plazo(e.dias_para_pagar)}`
    : `Vence ${plazo(e.dias_para_pagar)}, ${fechaCorta(e.fecha_limite)}`
  return (
    <div
      className="lista-grupo"
      role={vencida ? 'alert' : undefined}
      style={{ borderColor: vencida ? 'rgba(255, 69, 58, 0.35)' : 'rgba(255, 214, 10, 0.25)' }}
    >
      {/* Toda la fila es el botón: el objetivo táctil es grande y la acción obvia */}
      <button
        className="fila"
        onClick={onPagar}
        aria-label={`Pagar ${formatCOP(e.por_pagar)} de ${tarjeta.nombre}. ${cuando}`}
        style={{ minHeight: 68, gap: 12 }}
      >
        <span className="mosaico sm" style={{ background: color, color: vencida ? '#fff' : '#000' }}>
          <Icono nombre={vencida ? 'alerta' : 'calendario'} size={16} grosor={2.2} />
        </span>
        <div className="fila-cuerpo">
          <p className="fila-titulo" style={{ fontSize: 15, fontWeight: 600 }}>
            <span className="cifra">{formatCOP(e.por_pagar)}</span>
            <span style={{ fontWeight: 400, color: 'var(--texto-secundario)' }}> · {tarjeta.nombre}</span>
          </p>
          <p className="fila-sub" style={{ color }}>{cuando}</p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--acento)', fontWeight: 600, fontSize: 15, flexShrink: 0 }}>
          Pagar<Icono nombre="chevron-right" size={16} grosor={2.4} />
        </span>
      </button>
    </div>
  )
}
