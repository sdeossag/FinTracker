import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { logout } from '../api'
import {
  notifSoportadas, estadoPermiso, notifHabilitadas,
  pedirPermiso, activarNotif, desactivarNotif,
} from '../utils/notificaciones'

const IconChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const IconFaceID = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="2" width="5" height="2" rx="1" fill="currentColor"/>
    <rect x="17" y="2" width="5" height="2" rx="1" fill="currentColor"/>
    <rect x="2" y="20" width="5" height="2" rx="1" fill="currentColor"/>
    <rect x="17" y="20" width="5" height="2" rx="1" fill="currentColor"/>
    <circle cx="9" cy="10" r="1.2" fill="currentColor"/>
    <circle cx="15" cy="10" r="1.2" fill="currentColor"/>
    <path d="M9 15.5C9 15.5 10.5 17 12 17C13.5 17 15 15.5 15 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M12 10V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)

const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M8 11V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
  </svg>
)

const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M3 10H21" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M8 3V7M16 3V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

const IconLogout = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M9 21H5C4.45 21 4 20.55 4 20V4C4 3.45 4.45 3 5 3H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

function FilaConfig({ icono, label, valor, onPress, destructiva = false, borde = true }) {
  return (
    <button
      onClick={onPress}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', background: 'none', border: 'none',
        borderBottom: borde ? '0.5px solid var(--borde)' : 'none',
        padding: '15px 0', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ color: destructiva ? 'var(--gasto)' : 'var(--acento)', flexShrink: 0 }}>
        {icono}
      </span>
      <span style={{
        flex: 1, fontSize: 15, fontWeight: 400,
        color: destructiva ? 'var(--gasto)' : 'var(--texto-primario)',
      }}>
        {label}
      </span>
      {valor && (
        <span style={{ fontSize: 14, color: 'var(--texto-terciario)', marginRight: 4 }}>
          {valor}
        </span>
      )}
      {!destructiva && <span style={{ color: 'var(--texto-terciario)' }}><IconChevron /></span>}
    </button>
  )
}

export default function Configuracion() {
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState(null)
  const [periodoTemp, setPeriodoTemp] = useState(null)
  const [guardandoPeriodo, setGuardandoPeriodo] = useState(false)

  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [perfilForm, setPerfilForm] = useState({ username: '', email: '' })
  const [perfilError, setPerfilError] = useState('')
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)

  const [permiso, setPermiso] = useState(() => estadoPermiso())
  const [notifOn, setNotifOn] = useState(() => notifHabilitadas())

  const manejarNotif = async () => {
    if (permiso === 'default') {
      const resultado = await pedirPermiso()
      setPermiso(resultado)
      setNotifOn(resultado === 'granted')
    } else if (permiso === 'granted') {
      if (notifOn) { desactivarNotif(); setNotifOn(false) }
      else          { activarNotif();   setNotifOn(true)  }
    }
  }

  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [passForm, setPassForm] = useState({ current: '', nueva: '', confirmar: '' })
  const [passError, setPassError] = useState('')
  const [passExito, setPassExito] = useState(false)
  const [guardandoPass, setGuardandoPass] = useState(false)

  useEffect(() => {
    api.get('/perfil/').then(res => {
      setPerfil(res.data)
      setPeriodoTemp(res.data.periodo_inicio)
      setPerfilForm({ username: res.data.username, email: res.data.email ?? '' })
    }).catch(() => {})
  }, [])

  const iniciales = perfil?.username
    ? perfil.username.slice(0, 2).toUpperCase()
    : '??'

  const guardarPerfil = async () => {
    setPerfilError('')
    if (!perfilForm.username.trim()) { setPerfilError('El nombre no puede estar vacío.'); return }
    setGuardandoPerfil(true)
    try {
      const res = await api.patch('/perfil/', {
        username: perfilForm.username.trim(),
        email: perfilForm.email.trim(),
      })
      setPerfil(res.data)
      setEditandoPerfil(false)
    } catch (err) {
      setPerfilError(err.response?.data?.error ?? 'Error al guardar.')
    } finally {
      setGuardandoPerfil(false)
    }
  }

  const cancelarEditPerfil = () => {
    setEditandoPerfil(false)
    setPerfilError('')
    setPerfilForm({ username: perfil?.username ?? '', email: perfil?.email ?? '' })
  }

  const guardarPeriodo = async (dia) => {
    setPeriodoTemp(dia)
    setGuardandoPeriodo(true)
    try {
      await api.patch('/perfil/', { periodo_inicio: dia })
      setPerfil(prev => ({ ...prev, periodo_inicio: dia }))
    } catch (err) {
      setPeriodoTemp(perfil?.periodo_inicio ?? 1)
    } finally {
      setGuardandoPeriodo(false)
    }
  }

  const cambiarPassword = async () => {
    setPassError('')
    setPassExito(false)
    if (!passForm.current) { setPassError('Escribe tu contraseña actual.'); return }
    if (passForm.nueva.length < 4) { setPassError('La nueva contraseña debe tener al menos 4 caracteres.'); return }
    if (passForm.nueva !== passForm.confirmar) { setPassError('Las contraseñas nuevas no coinciden.'); return }

    setGuardandoPass(true)
    try {
      await api.post('/cambiar-password/', {
        current_password: passForm.current,
        new_password: passForm.nueva,
      })
      setPassExito(true)
      setPassForm({ current: '', nueva: '', confirmar: '' })
      setTimeout(() => { setMostrarPassword(false); setPassExito(false) }, 1500)
    } catch (err) {
      setPassError(err.response?.data?.error ?? 'Error al cambiar la contraseña.')
    } finally {
      setGuardandoPass(false)
    }
  }

  const etiquetaPeriodo = (d) => d === 1 ? 'Día 1 (mes calendario)' : `Día ${d} de cada mes`

  return (
    <div className="pagina" style={{ paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'var(--card)', border: '0.5px solid var(--borde)',
          borderRadius: 20, padding: '8px 14px', color: 'var(--texto-secundario)',
          cursor: 'pointer', fontSize: 14,
        }}>← Volver</button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Configuración</h1>
      </div>

      {/* Tarjeta de perfil */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: editandoPerfil ? 16 : 0 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            background: 'var(--acento)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff',
          }}>
            {iniciales}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 17, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {perfil?.username ?? '—'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--texto-secundario)', marginTop: 2 }}>
              {perfil?.email || 'Sin email'}
            </p>
          </div>
          {!editandoPerfil && (
            <button
              onClick={() => setEditandoPerfil(true)}
              style={{
                background: 'var(--card-hover)', border: 'none', borderRadius: 10,
                padding: '7px 12px', fontSize: 13, color: 'var(--texto-secundario)',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              Editar
            </button>
          )}
        </div>

        {editandoPerfil && (
          <div>
            <input
              className="input"
              placeholder="Nombre de usuario"
              value={perfilForm.username}
              onChange={e => setPerfilForm(p => ({ ...p, username: e.target.value }))}
              style={{ marginBottom: 10 }}
              autoFocus
            />
            <input
              className="input"
              type="email"
              placeholder="Email (opcional)"
              value={perfilForm.email}
              onChange={e => setPerfilForm(p => ({ ...p, email: e.target.value }))}
              style={{ marginBottom: perfilError ? 10 : 14 }}
            />
            {perfilError && (
              <p style={{
                color: 'var(--gasto)', fontSize: 13, marginBottom: 12,
                background: 'var(--gasto-suave)', padding: '8px 12px', borderRadius: 8,
              }}>
                {perfilError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={guardarPerfil} className="btn-primario" disabled={guardandoPerfil}
                style={{ flex: 1, padding: '11px' }}>
                {guardandoPerfil ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={cancelarEditPerfil} style={{
                background: 'var(--card-hover)', border: 'none', borderRadius: 14,
                padding: '11px 18px', fontSize: 14, color: 'var(--texto-secundario)', cursor: 'pointer',
              }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sección Seguridad */}
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-terciario)', marginBottom: 8, letterSpacing: 0.5 }}>
        SEGURIDAD
      </p>
      <div className="card" style={{ padding: '0 18px', marginBottom: 20 }}>
        <FilaConfig
          icono={<IconFaceID />}
          label="Face ID / Touch ID"
          onPress={() => navigate('/biometria')}
        />
        <FilaConfig
          icono={<IconLock />}
          label="Cambiar contraseña"
          onPress={() => { setMostrarPassword(v => !v); setPassError(''); setPassExito(false) }}
          borde={!mostrarPassword}
        />

        {mostrarPassword && (
          <div style={{ paddingBottom: 16 }}>
            <input
              className="input"
              type="password"
              placeholder="Contraseña actual"
              value={passForm.current}
              onChange={e => setPassForm(p => ({ ...p, current: e.target.value }))}
              style={{ marginBottom: 10 }}
              autoFocus
            />
            <input
              className="input"
              type="password"
              placeholder="Nueva contraseña"
              value={passForm.nueva}
              onChange={e => setPassForm(p => ({ ...p, nueva: e.target.value }))}
              style={{ marginBottom: 10 }}
            />
            <input
              className="input"
              type="password"
              placeholder="Confirmar nueva contraseña"
              value={passForm.confirmar}
              onChange={e => setPassForm(p => ({ ...p, confirmar: e.target.value }))}
              style={{ marginBottom: 12 }}
            />
            {passError && (
              <p style={{ color: 'var(--gasto)', fontSize: 13, marginBottom: 10,
                background: 'var(--gasto-suave)', padding: '8px 12px', borderRadius: 8 }}>
                {passError}
              </p>
            )}
            {passExito && (
              <p style={{ color: 'var(--ingreso)', fontSize: 13, marginBottom: 10,
                background: 'rgba(48,209,88,0.12)', padding: '8px 12px', borderRadius: 8 }}>
                ¡Contraseña actualizada!
              </p>
            )}
            <button onClick={cambiarPassword} className="btn-primario" disabled={guardandoPass}
              style={{ padding: '12px' }}>
              {guardandoPass ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </div>
        )}
      </div>

      {/* Sección Presupuesto */}
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-terciario)', marginBottom: 8, letterSpacing: 0.5 }}>
        PRESUPUESTO
      </p>
      <div className="card" style={{ padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <span style={{ color: 'var(--acento)' }}><IconCalendar /></span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15 }}>Inicio del período</p>
            <p style={{ fontSize: 12, color: 'var(--texto-terciario)', marginTop: 2 }}>
              {guardandoPeriodo ? 'Guardando...' : etiquetaPeriodo(periodoTemp ?? 1)}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1, 5, 10, 15, 20, 25].map(dia => (
            <button
              key={dia}
              onClick={() => guardarPeriodo(dia)}
              style={{
                background: periodoTemp === dia ? 'var(--acento)' : 'var(--card-hover)',
                color: periodoTemp === dia ? '#fff' : 'var(--texto-secundario)',
                border: '0.5px solid var(--borde)', borderRadius: 12,
                padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {dia === 1 ? 'Día 1' : `Día ${dia}`}
            </button>
          ))}
        </div>
      </div>

      {/* Sección Notificaciones */}
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-terciario)', marginBottom: 8, letterSpacing: 0.5 }}>
        NOTIFICACIONES
      </p>
      <div className="card" style={{ padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 500 }}>
              {permiso === 'denied'
                ? 'Notificaciones bloqueadas'
                : notifOn ? 'Notificaciones activas' : 'Notificaciones desactivadas'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--texto-terciario)', marginTop: 3 }}>
              {permiso === 'denied'
                ? 'Habilítalas en la configuración del navegador'
                : permiso === 'default'
                ? 'Recibe alertas de recurrentes y presupuesto'
                : notifOn
                ? 'Recurrentes auto-registradas y presupuesto excedido'
                : 'Toca para reactivar'}
            </p>
          </div>
          {permiso !== 'denied' && notifSoportadas() && (
            <button onClick={manejarNotif} style={{
              background: notifOn ? 'var(--acento)' : 'var(--card-hover)',
              color: notifOn ? '#fff' : 'var(--texto-secundario)',
              border: 'none', borderRadius: 20, padding: '7px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              flexShrink: 0, transition: 'all 0.15s',
            }}>
              {permiso === 'default' ? 'Activar' : notifOn ? 'Activas' : 'Activar'}
            </button>
          )}
        </div>
      </div>

      {/* Sección Sesión */}
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-terciario)', marginBottom: 8, letterSpacing: 0.5 }}>
        SESIÓN
      </p>
      <div className="card" style={{ padding: '0 18px' }}>
        <FilaConfig
          icono={<IconLogout />}
          label="Cerrar sesión"
          onPress={logout}
          destructiva
          borde={false}
        />
      </div>

      <p style={{ fontSize: 12, color: 'var(--texto-terciario)', textAlign: 'center', marginTop: 32 }}>
        FinTracker · Versión 1.0
      </p>
    </div>
  )
}
