import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function Registro() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm_password: '' })
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [cargando, setCargando] = useState(false)

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm_password) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)
    try {
      await api.post('/registro/', form)
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
      <div className="pagina" style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', minHeight: '100vh',
        background: 'linear-gradient(135deg, var(--card) 0%, #1a1a1a 100%)',
        padding: 20,
      }}>
        <div className="card" style={{
          maxWidth: 400, width: '100%', padding: '48px 32px',
          borderRadius: 32, textAlign: 'center', border: '1px solid var(--borde)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>¡Cuenta creada!</h2>
          <p style={{ color: 'var(--texto-secundario)', fontSize: 15, lineHeight: '1.6', marginBottom: 32 }}>
            Tu cuenta <strong>{form.username}</strong> fue creada exitosamente. Ya puedes iniciar sesión.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primario"
            style={{ width: '100%', padding: 15, fontSize: 16 }}
          >
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pagina" style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--card) 0%, #1a1a1a 100%)',
      padding: 20,
    }}>
      <div className="card" style={{
        maxWidth: 400, width: '100%', padding: '48px 32px',
        borderRadius: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        textAlign: 'center', border: '1px solid var(--borde)',
      }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, background: 'var(--acento)',
            borderRadius: 18, margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
          }}>
            💰
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>
            Crear cuenta
          </h1>
          <p style={{ color: 'var(--texto-secundario)', fontSize: 14, lineHeight: '1.5' }}>
            Empieza a controlar tus finanzas hoy.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
          <div>
            <label className="label" style={{ marginBottom: 6, display: 'block' }}>Usuario</label>
            <input
              className="input"
              type="text"
              placeholder="Tu nombre de usuario"
              value={form.username}
              onChange={set('username')}
              style={{ padding: '13px 16px', fontSize: 15 }}
              required
            />
          </div>

          <div>
            <label className="label" style={{ marginBottom: 6, display: 'block' }}>
              Correo electrónico <span style={{ color: 'var(--texto-terciario)', fontWeight: 400 }}>(opcional)</span>
            </label>
            <input
              className="input"
              type="email"
              placeholder="tu@correo.com"
              value={form.email}
              onChange={set('email')}
              style={{ padding: '13px 16px', fontSize: 15 }}
            />
          </div>

          <div>
            <label className="label" style={{ marginBottom: 6, display: 'block' }}>Contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="Mínimo 4 caracteres"
              value={form.password}
              onChange={set('password')}
              style={{ padding: '13px 16px', fontSize: 15 }}
              required
            />
          </div>

          <div>
            <label className="label" style={{ marginBottom: 6, display: 'block' }}>Confirmar contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="Repite la contraseña"
              value={form.confirm_password}
              onChange={set('confirm_password')}
              style={{ padding: '13px 16px', fontSize: 15 }}
              required
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255, 69, 58, 0.1)', color: 'var(--gasto)',
              padding: 12, borderRadius: 12, fontSize: 13,
              border: '1px solid rgba(255, 69, 58, 0.2)', textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primario"
            disabled={cargando}
            style={{ padding: 15, fontSize: 16, fontWeight: 600, borderRadius: 16, marginTop: 4 }}
          >
            {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p style={{ marginTop: 28, fontSize: 14, color: 'var(--texto-terciario)' }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color: 'var(--acento)', textDecoration: 'none', fontWeight: 500 }}>
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
