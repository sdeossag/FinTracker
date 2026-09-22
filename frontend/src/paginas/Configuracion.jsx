import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api, { logout } from '../api'
import {
  notifSoportadas, estadoPermiso, notifHabilitadas,
  pedirPermiso, activarNotif, desactivarNotif,
} from '../utils/notificaciones'
import Pagina from '../componentes/Pagina'
import Icono from '../componentes/Icono'
import Sheet from '../componentes/Sheet'
import { AvisoError, Interruptor, Segmentado } from '../componentes/Controles'

// Mosaico de color con glifo blanco, como en Ajustes de iOS
function Mosaico({ icono, color }) {
  return (
    <span className="mosaico sm" style={{ background: color, color: '#fff' }}>
      <Icono nombre={icono} size={17} grosor={2} />
    </span>
  )
}

const DIAS_PERIODO = [1, 5, 10, 15, 20, 25]

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

  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [passForm, setPassForm] = useState({ current: '', nueva: '', confirmar: '' })
  const [passError, setPassError] = useState('')
  const [guardandoPass, setGuardandoPass] = useState(false)

  useEffect(() => {
    api.get('/perfil/').then(res => {
      setPerfil(res.data)
      setPeriodoTemp(res.data.periodo_inicio)
      setPerfilForm({ username: res.data.username, email: res.data.email ?? '' })
    }).catch(() => {})
  }, [])

  const manejarNotif = async (activar) => {
    if (permiso === 'default') {
      const resultado = await pedirPermiso()
      setPermiso(resultado)
      setNotifOn(resultado === 'granted')
    } else if (permiso === 'granted') {
      if (activar) { activarNotif(); setNotifOn(true) }
      else { desactivarNotif(); setNotifOn(false) }
    }
  }

  const iniciales = perfil?.username ? perfil.username.slice(0, 2).toUpperCase() : ''

  const abrirPerfil = () => {
    setPerfilError('')
    setPerfilForm({ username: perfil?.username ?? '', email: perfil?.email ?? '' })
    setEditandoPerfil(true)
  }

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
      toast.success('Perfil actualizado')
    } catch (err) {
      setPerfilError(err.response?.data?.error ?? 'Error al guardar.')
    } finally {
      setGuardandoPerfil(false)
    }
  }

  const guardarPeriodo = async (dia) => {
    const anterior = periodoTemp
    setPeriodoTemp(dia)
    setGuardandoPeriodo(true)
    try {
      await api.patch('/perfil/', { periodo_inicio: dia })
      setPerfil(prev => ({ ...prev, periodo_inicio: dia }))
    } catch {
      setPeriodoTemp(anterior ?? perfil?.periodo_inicio ?? 1)
      toast.error('No se pudo guardar el período')
    } finally {
      setGuardandoPeriodo(false)
    }
  }

  const abrirPassword = () => {
    setPassForm({ current: '', nueva: '', confirmar: '' })
    setPassError('')
    setMostrarPassword(true)
  }

  const cambiarPassword = async () => {
    setPassError('')
    if (!passForm.current) { setPassError('Escribe tu contraseña actual.'); return }
    if (passForm.nueva.length < 4) { setPassError('La nueva contraseña debe tener al menos 4 caracteres.'); return }
    if (passForm.nueva !== passForm.confirmar) { setPassError('Las contraseñas nuevas no coinciden.'); return }

    setGuardandoPass(true)
    try {
      await api.post('/cambiar-password/', {
        current_password: passForm.current,
        new_password: passForm.nueva,
      })
      setMostrarPassword(false)
      setPassForm({ current: '', nueva: '', confirmar: '' })
      toast.success('Contraseña actualizada')
    } catch (err) {
      setPassError(err.response?.data?.error ?? 'Error al cambiar la contraseña.')
    } finally {
      setGuardandoPass(false)
    }
  }

  const noCoinciden = passForm.confirmar.length > 0 && passForm.nueva !== passForm.confirmar
  const soportadas = notifSoportadas()
  const periodoLabel = (periodoTemp ?? 1) === 1 ? 'Día 1 · mes calendario' : `Día ${periodoTemp} de cada mes`

  return (
    <Pagina titulo="Configuración" atras={{ etiqueta: 'Inicio', a: '/' }}>

      {/* Perfil */}
      <div className="lista-grupo" style={{ marginBottom: 32 }}>
        <button className="fila" onClick={abrirPerfil} style={{ minHeight: 76 }} disabled={!perfil}>
          <span style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(145deg, #3da8ff, #0A84FF 55%, #0055CC)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 19, fontWeight: 600, color: '#fff', letterSpacing: '0.02em',
          }}>
            {iniciales || <Icono nombre="usuario" size={24} />}
          </span>
          <div className="fila-cuerpo">
            <p className="fila-titulo" style={{ fontSize: 19, fontWeight: 600 }}>{perfil?.username ?? '—'}</p>
            <p className="fila-sub">{perfil?.email || 'Sin correo · toca para editar'}</p>
          </div>
          <span className="fila-chevron"><Icono nombre="chevron-right" size={16} grosor={2.2} /></span>
        </button>
      </div>

      {/* Seguridad */}
      <h2 className="seccion-label">Seguridad</h2>
      <div className="lista-grupo" style={{ marginBottom: 32 }}>
        <button className="fila" style={{ '--sangria': '58px', minHeight: 48 }} onClick={() => navigate('/biometria')}>
          <Mosaico icono="face-id" color="#30D158" />
          <span className="fila-cuerpo fila-titulo">Face ID / huella</span>
          <span className="fila-chevron"><Icono nombre="chevron-right" size={16} grosor={2.2} /></span>
        </button>
        <button className="fila" style={{ '--sangria': '58px', minHeight: 48 }} onClick={abrirPassword}>
          <Mosaico icono="candado" color="#8E8E93" />
          <span className="fila-cuerpo fila-titulo">Cambiar contraseña</span>
          <span className="fila-chevron"><Icono nombre="chevron-right" size={16} grosor={2.2} /></span>
        </button>
      </div>

      {/* Presupuesto */}
      <h2 className="seccion-label">Presupuesto</h2>
      <div className="lista-grupo" style={{ padding: '12px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Mosaico icono="calendario" color="#FF9F0A" />
          <div className="fila-cuerpo">
            <p className="fila-titulo">Inicio del período</p>
            <p className="fila-sub" aria-live="polite">{guardandoPeriodo ? 'Guardando…' : periodoLabel}</p>
          </div>
        </div>
        <Segmentado
          etiqueta="Día de inicio del período"
          opciones={DIAS_PERIODO.map(d => ({ valor: d, etiqueta: String(d) }))}
          valor={periodoTemp ?? 1}
          onChange={guardarPeriodo}
        />
      </div>
      <p className="seccion-pie" style={{ marginBottom: 32 }}>El día del mes en que empiezan a contar tus límites de gasto.</p>

      {/* Notificaciones */}
      <h2 className="seccion-label">Notificaciones</h2>
      <div className="lista-grupo">
        <div className="fila" style={{ minHeight: 52 }}>
          <Mosaico icono="campana" color="#FF453A" />
          <span className="fila-cuerpo fila-titulo">Alertas</span>
          {soportadas && permiso !== 'denied' ? (
            <Interruptor activo={notifOn} onChange={manejarNotif} etiqueta="Alertas" />
          ) : (
            <span className="texto-nota">{soportadas ? 'Bloqueadas' : 'No disponibles'}</span>
          )}
        </div>
      </div>
      <p className="seccion-pie" style={{ marginBottom: 32 }}>
        {!soportadas
          ? 'Este navegador no admite notificaciones.'
          : permiso === 'denied'
            ? 'Las bloqueaste en el navegador. Actívalas desde sus ajustes del sitio.'
            : 'Recurrentes registradas automáticamente y presupuestos que se pasan del límite.'}
      </p>

      {/* Sesión */}
      <div className="lista-grupo">
        <button className="fila" onClick={logout} style={{ justifyContent: 'center', minHeight: 50 }}>
          <span className="fila-titulo" style={{ color: 'var(--gasto)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icono nombre="salir" size={18} />
            Cerrar sesión
          </span>
        </button>
      </div>

      <p className="texto-mini" style={{ textAlign: 'center', marginTop: 28 }}>FinTracker · Versión 1.0</p>

      {/* Editar perfil */}
      <Sheet
        abierto={editandoPerfil}
        onCerrar={() => setEditandoPerfil(false)}
        titulo="Editar perfil"
        pie={
          <button onClick={guardarPerfil} className="btn-primario" disabled={guardandoPerfil}>
            {guardandoPerfil ? 'Guardando…' : 'Guardar'}
          </button>
        }
      >
        <div className="campo">
          <label className="label" htmlFor="perfil-usuario">Nombre de usuario</label>
          <input id="perfil-usuario" className="input" value={perfilForm.username}
            onChange={e => setPerfilForm(p => ({ ...p, username: e.target.value }))}
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </div>
        <div className="campo">
          <label className="label" htmlFor="perfil-email">Correo <span style={{ color: 'var(--texto-terciario)' }}>· opcional</span></label>
          <input id="perfil-email" className="input" type="email" inputMode="email" value={perfilForm.email}
            onChange={e => setPerfilForm(p => ({ ...p, email: e.target.value }))}
            placeholder="tu@correo.com" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </div>
        <AvisoError>{perfilError}</AvisoError>
      </Sheet>

      {/* Cambiar contraseña */}
      <Sheet
        abierto={mostrarPassword}
        onCerrar={() => setMostrarPassword(false)}
        titulo="Cambiar contraseña"
        pie={
          <button onClick={cambiarPassword} className="btn-primario" disabled={guardandoPass}>
            {guardandoPass ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
        }
      >
        {/* Campo oculto de usuario: ayuda a los gestores de contraseñas */}
        <input type="text" autoComplete="username" value={perfil?.username ?? ''} readOnly hidden />
        <div className="campo">
          <label className="label" htmlFor="pass-actual">Contraseña actual</label>
          <input id="pass-actual" className="input" type="password" autoComplete="current-password"
            value={passForm.current} onChange={e => setPassForm(p => ({ ...p, current: e.target.value }))} />
        </div>
        <div className="campo">
          <label className="label" htmlFor="pass-nueva">Nueva contraseña</label>
          <input id="pass-nueva" className="input" type="password" autoComplete="new-password" placeholder="Mínimo 4 caracteres"
            value={passForm.nueva} onChange={e => setPassForm(p => ({ ...p, nueva: e.target.value }))} />
        </div>
        <div className="campo">
          <label className="label" htmlFor="pass-confirmar">Confirmar nueva contraseña</label>
          <input id="pass-confirmar" className="input" type="password" autoComplete="new-password"
            value={passForm.confirmar} onChange={e => setPassForm(p => ({ ...p, confirmar: e.target.value }))}
            aria-invalid={noCoinciden || undefined} />
          {noCoinciden && <p className="campo-error">Las contraseñas no coinciden.</p>}
        </div>
        <AvisoError>{passError}</AvisoError>
      </Sheet>
    </Pagina>
  )
}
