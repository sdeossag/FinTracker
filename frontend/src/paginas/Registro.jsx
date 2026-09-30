import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'
import Marca from '../componentes/Marca'
import { AvisoError, ReglasPassword } from '../componentes/Controles'
import './Acceso.css'
import { marcarNovedadesVistas } from '../utils/novedades'
import { emailValido, errorUsuario, normalizarUsuario, passwordValida } from '../utils/cuentaUsuario'

export default function Registro() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm_password: '' })
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [cargando, setCargando] = useState(false)

  const [tocado, setTocado] = useState({})

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })
  const salir = (campo) => () => setTocado(t => ({ ...t, [campo]: true }))

  // Validación en línea, no solo al enviar. Los errores salen al dejar el campo, no mientras escribes.
  const usuarioMal = errorUsuario(form.username)
  const emailMal = form.email.length > 0 && !emailValido(form.email.trim())
  const passOk = passwordValida(form.password, form.username)
  const noCoinciden = form.confirm_password.length > 0 && form.password !== form.confirm_password
  const listo = form.username && !usuarioMal && emailValido(form.email.trim()) && passOk && form.confirm_password && !noCoinciden

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm_password) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)
    try {
      await api.post('/registro/', { ...form, email: form.email.trim() })
      marcarNovedadesVistas()   // cuenta nueva: no necesita ver qué cambió
      setExito(true)
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al crear la cuenta. Intenta de nuevo.'
      setError(msg)
    } finally {
      setCargando(false)
    }
  }

  if (exito) {
    return (
      <main className="acceso">
        <div className="acceso-contenido" style={{ textAlign: 'center' }}>
          <div className="check-exito" style={{ margin: '0 auto 24px' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <h1 className="titulo-2" style={{ marginBottom: 10 }}>¡Cuenta creada!</h1>
          <p className="texto-callout" style={{ color: 'var(--texto-secundario)', marginBottom: 32 }}>
            Tu usuario <strong style={{ color: 'var(--texto-primario)' }}>{form.username}</strong> está listo. Ya puedes iniciar sesión.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primario">
            Iniciar sesión
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="acceso">
      <div className="acceso-contenido aparecer">
        <header className="acceso-cabecera" style={{ marginBottom: 28 }}>
          <Marca size={56} />
          <h1 className="titulo-grande" style={{ marginTop: 18 }}>Crear cuenta</h1>
          <p className="texto-callout" style={{ color: 'var(--texto-secundario)', marginTop: 6 }}>
            Empieza a controlar tus finanzas hoy.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <div className="campo">
            <label className="label" htmlFor="reg-usuario">Usuario</label>
            <input
              id="reg-usuario"
              className="input"
              type="text"
              placeholder="Tu nombre de usuario"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={form.username}
              onChange={e => setForm({ ...form, username: normalizarUsuario(e.target.value) })}
              onBlur={salir('username')}
              maxLength={30}
              aria-invalid={(tocado.username && !!usuarioMal) || undefined}
              aria-describedby="reg-usuario-ayuda"
              required
            />
            <p id="reg-usuario-ayuda" className={tocado.username && usuarioMal ? 'campo-error' : 'campo-ayuda'}>
              {tocado.username && usuarioMal ? usuarioMal : 'En minúsculas: letras, números, punto o guion bajo.'}
            </p>
          </div>

          <div className="campo">
            <label className="label" htmlFor="reg-email">
              Correo
            </label>
            <input
              id="reg-email"
              className="input"
              type="email"
              inputMode="email"
              placeholder="tu@correo.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={form.email}
              onChange={set('email')}
              onBlur={salir('email')}
              aria-invalid={(tocado.email && emailMal) || undefined}
              aria-describedby={tocado.email && emailMal ? 'reg-email-error' : undefined}
              required
            />
            {tocado.email && emailMal && <p id="reg-email-error" className="campo-error">Escribe un correo válido.</p>}
          </div>

          <div className="campo">
            <label className="label" htmlFor="reg-pass">Contraseña</label>
            <input
              id="reg-pass"
              className="input"
              type="password"
              placeholder="Crea una contraseña"
              autoComplete="new-password"
              enterKeyHint="next"
              value={form.password}
              onChange={set('password')}
              aria-describedby="reg-pass-reglas"
              required
            />
            <ReglasPassword id="reg-pass-reglas" password={form.password} usuario={form.username} />
          </div>

          <div className="campo">
            <label className="label" htmlFor="reg-confirm">Confirmar contraseña</label>
            <input
              id="reg-confirm"
              className="input"
              type="password"
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              enterKeyHint="go"
              value={form.confirm_password}
              onChange={set('confirm_password')}
              aria-invalid={noCoinciden || undefined}
              aria-describedby={noCoinciden ? 'reg-confirm-error' : undefined}
              required
            />
            {noCoinciden && <p id="reg-confirm-error" className="campo-error">Las contraseñas no coinciden.</p>}
          </div>

          <AvisoError>{error}</AvisoError>

          <button
            type="submit"
            className="btn-primario"
            disabled={cargando || !listo}
            style={{ marginTop: 8 }}
          >
            {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="texto-callout acceso-pie">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="acceso-enlace">Inicia sesión</Link>
        </p>
      </div>
    </main>
  )
}
