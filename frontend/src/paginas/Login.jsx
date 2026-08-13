// Pantalla de acceso — Diseño Premium
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api, { setTokens } from '../api'
import { webauthnApi } from '../api'
import { base64ToBuffer, bufferToBase64 } from '../utils/webauthn'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [biometricCargando, setBiometricCargando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)

    try {
      const res = await api.post('/token/', form)
      const { access, refresh } = res.data
      setTokens(access, refresh)
      navigate('/')
    } catch (err) {
      setError('Credenciales incorrectas. Por favor, verifica tu usuario y contraseña.')
      console.error('Error login:', err)
    } finally {
      setCargando(false)
    }
  }

  const handleBiometricLogin = async () => {
    const username = form.username
    if (!username) {
      setError('Por favor, ingresa tu usuario primero para usar biometría.')
      return
    }

    setError('')
    setBiometricCargando(true)
    try {
      const resOptions = await webauthnApi.getAuthOptions(username)
      const options = resOptions.data

      options.challenge = base64ToBuffer(options.challenge)
      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map(c => ({
          ...c,
          id: base64ToBuffer(c.id),
        }))
      }

      const assertion = await navigator.credentials.get({
        publicKey: options
      })

      const verifyData = {
        id: assertion.id,
        rawId: bufferToBase64(assertion.rawId),
        type: assertion.type,
        response: {
          clientDataJSON: bufferToBase64(assertion.response.clientDataJSON),
          authenticatorData: bufferToBase64(assertion.response.authenticatorData),
          signature: bufferToBase64(assertion.response.signature),
        },
      }

      const resVerify = await webauthnApi.verifyAuth(verifyData)
      const { access, refresh } = resVerify.data
      setTokens(access, refresh)
      navigate('/')
    } catch (err) {
      console.error('Error login biométrico:', err)
      setError('Error de autenticación biométrica. Intenta con contraseña.')
    } finally {
      setBiometricCargando(false)
    }
  }

  return (
    <div className="pagina" style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--card) 0%, #1a1a1a 100%)',
      padding: '20px'
    }}>
      <div className="card" style={{
        maxWidth: 400,
        width: '100%',
        padding: '48px 32px',
        borderRadius: '32px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        textAlign: 'center',
        border: '1px solid var(--borde)'
      }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, background: 'var(--acento)',
            borderRadius: '18px', margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
          }}>
            💰
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.5px' }}>
            FinTracker
          </h1>
          <p style={{ color: 'var(--texto-secundario)', fontSize: 15, lineHeight: '1.5' }}>
            Bienvenido de nuevo. Accede a tu centro de control financiero.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ textAlign: 'left' }}>
            <label className="label" style={{ marginBottom: 8, display: 'block', fontSize: 13, fontWeight: 600 }}>
              Usuario
            </label>
            <input
              className="input"
              type="text"
              placeholder="Introduce tu usuario"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              style={{ padding: '14px 16px', fontSize: 15 }}
              required
            />
          </div>
          <div style={{ textAlign: 'left' }}>
            <label className="label" style={{ marginBottom: 8, display: 'block', fontSize: 13, fontWeight: 600 }}>
              Contraseña
            </label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              style={{ padding: '14px 16px', fontSize: 15 }}
              required
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255, 69, 58, 0.1)',
              color: 'var(--gasto)',
              padding: '12px',
              borderRadius: '12px',
              fontSize: 13,
              border: '1px solid rgba(255, 69, 58, 0.2)',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primario"
            disabled={cargando}
            style={{
              padding: '16px',
              fontSize: 16,
              fontWeight: 600,
              borderRadius: '16px',
              transition: 'all 0.2s ease',
              marginTop: 8
            }}
          >
            {cargando ? 'Autenticando...' : 'Entrar la aplicación'}
          </button>
        </form>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ height: 1, background: 'var(--borde)', margin: '20px 0' }} />

          <p style={{ fontSize: 13, color: 'var(--texto-terciario)' }}>o usa biometría</p>

          <button
            onClick={handleBiometricLogin}
            disabled={biometricCargando}
            style={{
              background: 'var(--card-hover)',
              color: 'var(--texto-primario)',
              border: '0.5px solid var(--borde)',
              borderRadius: '16px',
              padding: '12px',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: 16 }}>🔐</span> Login con FaceID / TouchID
          </button>
        </div>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--texto-terciario)', fontSize: 14 }}>
            ¿No tienes cuenta?{' '}
            <Link to="/registro" style={{ color: 'var(--acento)', textDecoration: 'none', fontWeight: 500 }}>
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
