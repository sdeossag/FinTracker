import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { webauthnApi, ensureArray } from '../api'
import { bufferToBase64, base64ToBuffer } from '../utils/webauthn'
import Pagina from '../componentes/Pagina'
import Icono from '../componentes/Icono'
import { ConfirmarSheet } from '../componentes/Sheet'
import { AvisoError } from '../componentes/Controles'

export default function Biometria() {
  const [credentials, setCredentials] = useState([])
  const [cargando, setCargando] = useState(true)
  const [registrando, setRegistrando] = useState(false)
  const [error, setError] = useState('')
  const [nickname, setNickname] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [editandoNombre, setEditandoNombre] = useState('')
  const [aQuitar, setAQuitar] = useState(null)
  const [confirmAbierto, setConfirmAbierto] = useState(false)
  const [quitando, setQuitando] = useState(false)

  const soportado = typeof window !== 'undefined' && !!window.PublicKeyCredential

  const cargarCredenciales = async () => {
    try {
      const res = await webauthnApi.getCredentials()
      setCredentials(ensureArray(res.data))
    } catch {
      // El usuario verá la lista vacía
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarCredenciales() }, [])

  const registrarDispositivo = async () => {
    const nombreFinal = nickname.trim()
    if (!nombreFinal) {
      setError('Escribe un nombre para identificar este dispositivo.')
      document.getElementById('bio-nombre')?.focus()
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
      toast.success('Dispositivo registrado', { description: nombreFinal })
    } catch (err) {
      console.error('Error registro biométrico:', err)
      setError('No se pudo registrar el dispositivo. Verifica que tu navegador soporte passkeys.')
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
    } catch {
      toast.error('No se pudo renombrar')
    } finally {
      setEditandoId(null)
    }
  }

  const quitar = async () => {
    if (!aQuitar) return
    setQuitando(true)
    try {
      await webauthnApi.deleteCredential(aQuitar.id)
      setCredentials(prev => prev.filter(c => c.id !== aQuitar.id))
      setConfirmAbierto(false)
      toast.success('Dispositivo quitado')
    } catch {
      toast.error('No se pudo quitar el dispositivo')
    } finally {
      setQuitando(false)
    }
  }

  return (
    <Pagina titulo="Face ID / huella" atras={{ etiqueta: 'Configuración', a: '/configuracion' }} sinNav>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 28 }}>
        <span className="mosaico lg" style={{ background: 'var(--ingreso-suave)', color: 'var(--ingreso)' }}>
          <Icono nombre="face-id" size={28} />
        </span>
        <p className="texto-callout" style={{ color: 'var(--texto-secundario)', flex: 1 }}>
          Registra este dispositivo para entrar sin contraseña con tu cara, huella o el PIN del equipo.
        </p>
      </div>

      {/* Registrar */}
      <h2 className="seccion-label">Este dispositivo</h2>
      <div className="card" style={{ padding: 16, marginBottom: 32 }}>
        {soportado ? (
          <>
            <label className="label" htmlFor="bio-nombre">Nombre</label>
            <input
              id="bio-nombre"
              className="input"
              placeholder="Ej: iPhone, PC de la casa…"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && registrarDispositivo()}
              enterKeyHint="done"
              disabled={registrando}
              style={{ marginBottom: 12 }}
            />
            {error && <div style={{ marginBottom: 12 }}><AvisoError>{error}</AvisoError></div>}
            <button onClick={registrarDispositivo} disabled={registrando} className="btn-primario">
              <Icono nombre="face-id" size={19} />
              {registrando ? 'Esperando verificación…' : 'Registrar este dispositivo'}
            </button>
          </>
        ) : (
          <p className="texto-nota">Este navegador no admite passkeys. Prueba con Safari, Chrome o Edge actualizados.</p>
        )}
      </div>

      {/* Dispositivos */}
      <h2 className="seccion-label">Dispositivos vinculados</h2>
      {cargando ? (
        <div className="skeleton" style={{ height: 112, borderRadius: 20 }} aria-busy="true" />
      ) : credentials.length === 0 ? (
        <div className="lista-grupo">
          <div className="fila" style={{ justifyContent: 'center', color: 'var(--texto-terciario)', minHeight: 64 }}>
            <Icono nombre="llave" size={18} />
            <span className="texto-callout">Ningún dispositivo registrado aún</span>
          </div>
        </div>
      ) : (
        <div className="lista-grupo">
          {credentials.map(cred => (
            <div key={cred.id} className="fila" style={{ '--sangria': '58px' }}>
              <span className="mosaico sm" style={{ background: 'var(--card-hover)', color: 'var(--ingreso)' }}>
                <Icono nombre="llave" size={16} grosor={2} />
              </span>
              {editandoId === cred.id ? (
                <form style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}
                  onSubmit={e => { e.preventDefault(); guardarNombre(cred.id) }}>
                  <input
                    className="input"
                    aria-label="Nuevo nombre"
                    value={editandoNombre}
                    onChange={e => setEditandoNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setEditandoId(null)}
                    autoFocus
                    enterKeyHint="done"
                    style={{ flex: 1, minHeight: 40, padding: '8px 12px' }}
                  />
                  <button type="submit" className="btn-texto" style={{ fontWeight: 600 }}>Listo</button>
                </form>
              ) : (
                <>
                  <div className="fila-cuerpo">
                    <p className="fila-titulo" style={{ fontWeight: 500 }}>{cred.nickname}</p>
                    <p className="fila-sub">
                      Desde el {new Date(cred.creado_en).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <button className="btn-icono" style={{ background: 'transparent', border: 'none' }}
                    aria-label={`Renombrar ${cred.nickname}`}
                    onClick={() => { setEditandoId(cred.id); setEditandoNombre(cred.nickname) }}>
                    <Icono nombre="lapiz" size={17} />
                  </button>
                  <button className="btn-icono" style={{ background: 'transparent', border: 'none', color: 'var(--gasto)' }}
                    aria-label={`Quitar ${cred.nickname}`}
                    onClick={() => { setAQuitar(cred); setConfirmAbierto(true) }}>
                    <Icono nombre="basura" size={17} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmarSheet
        abierto={confirmAbierto}
        onCerrar={() => setConfirmAbierto(false)}
        titulo="¿Quitar dispositivo?"
        mensaje={`"${aQuitar?.nickname ?? ''}" ya no podrá entrar con Face ID o huella. Podrás registrarlo de nuevo cuando quieras.`}
        textoConfirmar="Quitar dispositivo"
        onConfirmar={quitar}
        cargando={quitando}
      />
    </Pagina>
  )
}
