// Pantalla de acceso
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api, { setTokens, webauthnApi } from '../api'
import { base64ToBuffer, bufferToBase64 } from '../utils/webauthn'
import Marca from '../componentes/Marca'
import Icono from '../componentes/Icono'
import { AvisoError } from '../componentes/Controles'
import './Acceso.css'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [biometricCargando, setBiometricCargando] = useState(false)
  const [verPassword, setVerPassword] = useState(false)

  const soportaPasskeys = typeof window !== 'undefined' && !!window.PublicKeyCredential

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const res = await api.post('/token/', { ...form, username: form.username.trim() })
      const { access, refresh } = res.data
      setTokens(access, refresh)
      navigate('/')
    } catch (err) {
      setError('Usuario o contraseña incorrectos.')
      console.error('Error login:', err)
    } finally {
      setCargando(false)
    }
  }

  const handleBiometricLogin = async () => {
    const username = form.username.trim()
    if (!username) {
      setError('Escribe tu usuario para entrar con Face ID o huella.')
      document.getElementById('login-usuario')?.focus()
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

      const assertion = await navigator.credentials.get({ publicKey: options })

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
      setError('No se pudo verificar tu identidad. Intenta con tu contraseña.')
    } finally {
      setBiometricCargando(false)
    }
  }

  return (
    <main className="acceso">
      <div className="acceso-contenido aparecer">
        <header className="acceso-cabecera">
          <Marca size={64} />
          <h1 className="titulo-grande" style={{ marginTop: 20 }}>FinTracker</h1>
          <p className="texto-callout" style={{ color: 'var(--texto-secundario)', marginTop: 6 }}>
            Tu dinero, claro y en orden.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <div className="campo">
            <label className="label" htmlFor="login-usuario">Usuario</label>
            <input
              id="login-usuario"
              className="input"
              type="text"
              placeholder="Tu nombre de usuario"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>

          <div className="campo">
            <label className="label" htmlFor="login-password">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="input"
                type={verPassword ? 'text' : 'password'}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                enterKeyHint="go"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ paddingRight: 84 }}
                required
              />
              <button
                type="button"
                className="btn-texto"
                onClick={() => setVerPassword(v => !v)}
                aria-pressed={verPassword}
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 15 }}
              >
                {verPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <AvisoError>{error}</AvisoError>

          <button
            type="submit"
            className="btn-primario"
            disabled={cargando || !form.username.trim() || !form.password}
            style={{ marginTop: 22 }}
          >
            {cargando ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>

        {soportaPasskeys && (
          <>
            <div className="acceso-separador"><span>o</span></div>
            <button
              type="button"
              className="btn-secundario"
              onClick={handleBiometricLogin}
              disabled={biometricCargando}
            >
              <Icono nombre="face-id" size={20} />
              {biometricCargando ? 'Verificando…' : 'Entrar con Face ID o huella'}
            </button>
          </>
        )}

        <p className="texto-callout acceso-pie">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="acceso-enlace">Regístrate</Link>
        </p>
      </div>
    </main>
  )
}
