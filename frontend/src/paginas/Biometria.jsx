import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { webauthnApi, ensureArray } from '../api'
import { bufferToBase64, base64ToBuffer } from '../utils/webauthn'

export default function Biometria() {
  const navigate = useNavigate()
  const [credentials, setCredentials] = useState([])
  const [cargando, setCargando] = useState(true)
  const [registrando, setRegistrando] = useState(false)
  const [error, setError] = useState('')
  const [nickname, setNickname] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [editandoNombre, setEditandoNombre] = useState('')

  useEffect(() => { cargarCredenciales() }, [])

  const cargarCredenciales = async () => {
    setCargando(true)
    try {
      const res = await webauthnApi.getCredentials()
      setCredentials(ensureArray(res.data))
    } catch {
      // El usuario verá la lista vacía
    } finally {
      setCargando(false)
    }
  }

  const registrarDispositivo = async () => {
    const nombreFinal = nickname.trim()
    if (!nombreFinal) {
      setError('Escribe un nombre para identificar este dispositivo.')
      return
    }
    setError('')
    setRegistrando(true)
    try {
      const resOptions = await webauthnApi.getRegisterOptions()
      const options = resOptions.data

      options.challenge = base64ToBuffer(options.challenge)
      options.user.id = base64ToBuffer(options.user.id)
      if (options.excludeCredentials) {
        options.excludeCredentials = options.excludeCredentials.map(c => ({
          ...c,
          id: base64ToBuffer(c.id),
        }))
      }

      const credential = await navigator.credentials.create({ publicKey: options })

      await webauthnApi.verifyRegister({
        id: credential.id,
        rawId: bufferToBase64(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64(credential.response.clientDataJSON),
          attestationObject: bufferToBase64(credential.response.attestationObject),
        },
        nickname: nombreFinal,
      })

      setNickname('')
      await cargarCredenciales()
    } catch (err) {
      console.error('Error registro biométrico:', err)
      setError('No se pudo registrar el dispositivo. Verifica que tu navegador soporte WebAuthn.')
    } finally {
      setRegistrando(false)
    }
  }

  const guardarNombre = async (id) => {
    const nombre = editandoNombre.trim()
    if (!nombre) return
    try {
      await webauthnApi.updateCredential(id, { nickname: nombre })
      setCredentials(prev => prev.map(c => c.id === id ? { ...c, nickname: nombre } : c))
      setEditandoId(null)
    } catch {
      setEditandoId(null)
    }
  }

  const eliminarCredencial = async (id) => {
    try {
      await webauthnApi.deleteCredential(id)
      setCredentials(prev => prev.filter(c => c.id !== id))
    } catch {
      // silencioso
    }
  }

  return (
    <div className="pagina" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'var(--card)', border: '0.5px solid var(--borde)',
          borderRadius: 20, padding: '8px 14px', color: 'var(--texto-secundario)',
          cursor: 'pointer', fontSize: 14,
        }}>← Volver</button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Face ID / Touch ID</h1>
      </div>

      {/* Registrar nuevo dispositivo */}
      <div className="card" style={{ padding: '20px', marginBottom: 24 }}>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 14, lineHeight: '1.6', marginBottom: 16 }}>
          Registra este dispositivo para entrar sin contraseña usando huella o reconocimiento facial.
        </p>

        <label className="label">Nombre del dispositivo</label>
        <input
          className="input"
          placeholder="Ej: Mi PC, iPhone de trabajo..."
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          style={{ marginBottom: 12 }}
          disabled={registrando}
        />

        {error && (
          <p style={{
            color: 'var(--gasto)', fontSize: 13, marginBottom: 12,
            background: 'var(--gasto-suave)', padding: '8px 12px', borderRadius: 8,
          }}>
            {error}
          </p>
        )}

        <button
          onClick={registrarDispositivo}
          disabled={registrando}
          className="btn-primario"
          style={{ width: '100%', padding: '13px' }}
        >
          {registrando ? 'Registrando...' : 'Registrar este dispositivo'}
        </button>
      </div>

      {/* Lista de dispositivos */}
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-terciario)', marginBottom: 10, letterSpacing: 0.5 }}>
        DISPOSITIVOS VINCULADOS
      </p>

      {cargando ? (
        <p style={{ color: 'var(--texto-terciario)', fontSize: 14 }}>Cargando...</p>
      ) : credentials.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 24 }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🔑</p>
          <p style={{ color: 'var(--texto-terciario)', fontSize: 14 }}>Ningún dispositivo registrado aún</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {credentials.map(cred => (
            <div key={cred.id} className="card" style={{ padding: '14px 18px' }}>
              {editandoId === cred.id ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="input"
                    value={editandoNombre}
                    onChange={e => setEditandoNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && guardarNombre(cred.id)}
                    autoFocus
                    style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
                  />
                  <button onClick={() => guardarNombre(cred.id)} className="btn-primario"
                    style={{ padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
                    Guardar
                  </button>
                  <button onClick={() => setEditandoId(null)} className="btn-secundario"
                    style={{ padding: '8px 14px', fontSize: 13 }}>
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ingreso)', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontWeight: 500, fontSize: 15 }}>{cred.nickname}</p>
                      <p style={{ fontSize: 11, color: 'var(--texto-terciario)', marginTop: 2 }}>
                        {new Date(cred.creado_en).toLocaleDateString('es-CO', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setEditandoId(cred.id); setEditandoNombre(cred.nickname) }}
                      className="btn-secundario"
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      Renombrar
                    </button>
                    <button
                      onClick={() => eliminarCredencial(cred.id)}
                      style={{
                        background: 'var(--gasto-suave)', color: 'var(--gasto)', border: 'none',
                        borderRadius: 12, padding: '6px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
