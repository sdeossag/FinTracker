import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { ensureArray, ensureObject, recurrentesApi } from '../api'
import {
  estadoPermiso, pedirPermiso, activarNotif,
  desactivarNotif, notifHabilitadas,
} from '../utils/notificaciones'

const formatCOP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)

/* ── Icono campana activa ────────────────────────────── */
const IconoCampanaActiva = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

/* ── Icono campana inactiva ──────────────────────────── */
const IconoCampanaInactiva = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

/* ── Icono campana bloqueada ─────────────────────────── */
const IconoCampanaBloqueada = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.4"/>
    <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

export default function Inicio() {
  const navigate = useNavigate()
  const [cuentas, setCuentas] = useState([])
  const [resumen, setResumen] = useState({ ingresos: 0, gastos: 0, ahorros: 0 })
  const [username, setUsername] = useState('')
  const [cargando, setCargando] = useState(true)
  const [autoRegistradas, setAutoRegistradas] = useState(0)
  const [notifEstado, setNotifEstado] = useState('default')
  const [notifActivas, setNotifActivas] = useState(false)

  useEffect(() => {
    setNotifEstado(estadoPermiso())
    setNotifActivas(notifHabilitadas())
  }, [])

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [resCuentas, resResumen, resPerfil] = await Promise.all([
          api.get('/cuentas/'),
          api.get('/transacciones/resumen-mes/'),
          api.get('/perfil/'),
        ])
        const ctas = ensureArray(resCuentas.data)
        setCuentas(ctas)
        setResumen(ensureObject(resResumen.data))
        setUsername(resPerfil.data?.username || '')

        const obKey = 'ft_ob_done'
        if (ctas.length === 0 && !localStorage.getItem(obKey)) {
          navigate('/onboarding', { replace: true })
          return
        }

        try {
          const resEjec = await recurrentesApi.ejecutar()
          const creadas = resEjec.data?.creadas || 0
          if (creadas > 0) {
            setAutoRegistradas(creadas)
            const { mostrarNotif } = await import('../utils/notificaciones')
            mostrarNotif(
              'FinTracker',
              `${creadas} transacción${creadas > 1 ? 'es' : ''} recurrente${creadas > 1 ? 's' : ''} registrada${creadas > 1 ? 's' : ''} automáticamente hoy`,
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
  }, [])

  async function toggleNotificaciones() {
    if (notifEstado === 'unsupported') return
    if (notifEstado === 'denied') return

    if (notifActivas) {
      desactivarNotif()
      setNotifActivas(false)
    } else {
      const permiso = await pedirPermiso()
      setNotifEstado(estadoPermiso())
      if (permiso === 'granted') {
        activarNotif()
        setNotifActivas(true)
      }
    }
  }

  const balanceTotal = cuentas.reduce((acc, c) =>
    c.tipo === 'pasivo' ? acc - c.balance_actual : acc + c.balance_actual, 0)

  const mesActual = new Date().toLocaleString('es-CO', { month: 'long', year: 'numeric' })

  /* ── Saludo según hora ─────────────────────────────── */
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'
  const emojiSaludo = hora < 12 ? '☀️' : hora < 18 ? '👋' : '🌙'

  /* ── Botón notificaciones ──────────────────────────── */
  const notifBloqueada = notifEstado === 'denied' || notifEstado === 'unsupported'
  const notifColor = notifBloqueada
    ? 'rgba(255,255,255,0.25)'
    : notifActivas
      ? '#0A84FF'
      : 'var(--texto-secundario)'

  if (cargando) return (
    <div className="pagina">
      <p style={{ color: 'var(--texto-secundario)' }}>Cargando...</p>
    </div>
  )

  return (
    <div className="pagina">

      {/* ── Barra superior ────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 20,
      }}>
        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #0A84FF 0%, #0055CC 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(10,132,255,0.35)',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 19L8.5 12L12.5 16L17 9L21 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{
            fontSize: 18, fontWeight: 700, letterSpacing: -0.4,
            color: 'var(--texto-primario)',
          }}>
            FinTracker
          </span>
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Notificaciones */}
          <button
            onClick={toggleNotificaciones}
            title={
              notifBloqueada ? 'Notificaciones bloqueadas' :
              notifActivas ? 'Desactivar notificaciones' : 'Activar notificaciones'
            }
            style={{
              background: notifActivas ? 'rgba(10,132,255,0.12)' : 'var(--card)',
              border: notifActivas ? '0.5px solid rgba(10,132,255,0.3)' : '0.5px solid var(--borde)',
              borderRadius: 20, width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: notifBloqueada ? 'not-allowed' : 'pointer',
              color: notifColor,
              transition: 'background 0.2s, border-color 0.2s, color 0.2s',
            }}
          >
            {notifBloqueada
              ? <IconoCampanaBloqueada />
              : notifActivas
                ? <IconoCampanaActiva />
                : <IconoCampanaInactiva />
            }
          </button>

          {/* Ajustes */}
          <button
            onClick={() => navigate('/configuracion')}
            style={{
              background: 'var(--card)', border: '0.5px solid var(--borde)',
              borderRadius: 20, width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--texto-secundario)',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M19.4 15C19.1 15.6 19.3 16.3 19.8 16.8L19.9 16.9C20.2 17.2 20.4 17.6 20.4 18C20.4 18.4 20.2 18.8 19.9 19.1C19.6 19.4 19.2 19.6 18.8 19.6C18.4 19.6 18 19.4 17.7 19.1L17.6 19C17.1 18.5 16.4 18.3 15.8 18.6C15.2 18.9 14.8 19.5 14.8 20.1V20.3C14.8 21.2 14.1 22 13.1 22H10.9C10 22 9.2 21.3 9.2 20.3V20.1C9.2 19.5 8.8 18.9 8.2 18.6C7.6 18.3 6.9 18.5 6.4 19L6.3 19.1C6 19.4 5.6 19.6 5.2 19.6C4.8 19.6 4.4 19.4 4.1 19.1C3.8 18.8 3.6 18.4 3.6 18C3.6 17.6 3.8 17.2 4.1 16.9L4.2 16.8C4.7 16.3 4.9 15.6 4.6 15C4.3 14.4 3.7 14 3.1 14H2.9C2 14 1.2 13.3 1.2 12.3V10.1C1.2 9.2 1.9 8.4 2.9 8.4H3.1C3.7 8.4 4.3 8 4.6 7.4C4.9 6.8 4.7 6.1 4.2 5.6L4.1 5.5C3.8 5.2 3.6 4.8 3.6 4.4C3.6 4 3.8 3.6 4.1 3.3C4.4 3 4.8 2.8 5.2 2.8C5.6 2.8 6 3 6.3 3.3L6.4 3.4C6.9 3.9 7.6 4.1 8.2 3.8C8.8 3.5 9.2 2.9 9.2 2.3V2.1C9.2 1.2 9.9 0.4 10.9 0.4H13.1C14 0.4 14.8 1.1 14.8 2.1V2.3C14.8 2.9 15.2 3.5 15.8 3.8C16.4 4.1 17.1 3.9 17.6 3.4L17.7 3.3C18 3 18.4 2.8 18.8 2.8C19.2 2.8 19.6 3 19.9 3.3C20.2 3.6 20.4 4 20.4 4.4C20.4 4.8 20.2 5.2 19.9 5.5L19.8 5.6C19.3 6.1 19.1 6.8 19.4 7.4C19.7 8 20.3 8.4 20.9 8.4H21.1C22 8.4 22.8 9.1 22.8 10.1V12.3C22.8 13.2 22.1 14 21.1 14H20.9C20.3 14 19.7 14.4 19.4 15Z" stroke="currentColor" strokeWidth="1.8"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Saludo ────────────────────────────────────── */}
      <div style={{ marginBottom: 22 }}>
        <p style={{ fontSize: 13, color: 'var(--texto-secundario)', marginBottom: 2 }}>
          {saludo} {emojiSaludo}
        </p>
        <h2 style={{
          fontSize: 26, fontWeight: 700, letterSpacing: -0.5,
          color: 'var(--texto-primario)', margin: 0,
        }}>
          {username ? username.charAt(0).toUpperCase() + username.slice(1) : 'Bienvenido'}
        </h2>
      </div>

      {/* ── Banner de recurrentes auto-registradas ─────── */}
      {autoRegistradas > 0 && (
        <div onClick={() => setAutoRegistradas(0)} style={{
          background: 'var(--ingreso-suave)', border: '1px solid var(--ingreso)',
          borderRadius: 14, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ingreso)' }}>
              {autoRegistradas} transacción{autoRegistradas > 1 ? 'es' : ''} auto-registrada{autoRegistradas > 1 ? 's' : ''} hoy
            </p>
            <p style={{ fontSize: 12, color: 'var(--texto-secundario)', marginTop: 2 }}>
              Tus recurrentes del día ya fueron registradas
            </p>
          </div>
          <span style={{ color: 'var(--texto-terciario)', fontSize: 16 }}>×</span>
        </div>
      )}

      {cuentas.length > 0 && (
        <>
          {/* ── Tarjeta balance principal ──────────────── */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(10,132,255,0.12) 0%, rgba(10,132,255,0.04) 100%)',
            border: '0.5px solid rgba(10,132,255,0.2)',
            borderRadius: 20, padding: '20px 22px', marginBottom: 14,
          }}>
            <p style={{ fontSize: 12, color: 'rgba(10,132,255,0.75)', fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>
              BALANCE TOTAL
            </p>
            <h1 style={{
              fontSize: 38, fontWeight: 700, letterSpacing: -1, margin: '0 0 16px',
              color: balanceTotal >= 0 ? 'var(--texto-primario)' : 'var(--gasto)',
            }}>
              {formatCOP(balanceTotal)}
            </h1>

            {/* Resumen del mes */}
            <div style={{
              borderTop: '0.5px solid rgba(255,255,255,0.08)',
              paddingTop: 14,
            }}>
              <p style={{ fontSize: 11, color: 'var(--texto-secundario)', marginBottom: 10, textTransform: 'capitalize', letterSpacing: 0.3 }}>
                {mesActual}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--texto-secundario)', marginBottom: 3 }}>Ingresos</p>
                  <p className="monto-ingreso" style={{ fontSize: 16, fontWeight: 600 }}>{formatCOP(resumen.ingresos || 0)}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: 'var(--texto-secundario)', marginBottom: 3 }}>Ahorros</p>
                  <p className="monto-ahorro" style={{ fontSize: 16, fontWeight: 600 }}>{formatCOP(resumen.ahorros || 0)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: 'var(--texto-secundario)', marginBottom: 3 }}>Gastos</p>
                  <p className="monto-gasto" style={{ fontSize: 16, fontWeight: 600 }}>{formatCOP(resumen.gastos || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Mis cuentas ───────────────────────────── */}
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--texto-secundario)', marginBottom: 10, letterSpacing: 0.5 }}>
            MIS CUENTAS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cuentas.map(cuenta => (
              <div key={cuenta.id} className="card" style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '15px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: cuenta.color_hex + '22',
                    border: `1px solid ${cuenta.color_hex}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: cuenta.color_hex }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>{cuenta.nombre}</p>
                    <p style={{ fontSize: 11, color: 'var(--texto-secundario)', marginTop: 1 }}>
                      {cuenta.tipo === 'pasivo' ? 'Pasivo' : 'Activo'}
                    </p>
                  </div>
                </div>
                <p style={{
                  fontWeight: 700, fontSize: 16,
                  color: cuenta.tipo === 'pasivo' ? 'var(--gasto)' : 'var(--texto-primario)',
                }}>
                  {formatCOP(cuenta.balance_actual)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
