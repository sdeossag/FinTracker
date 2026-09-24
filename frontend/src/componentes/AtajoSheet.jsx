// Conectar el atajo del iPhone que envía los SMS del banco a FinTracker
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import api, { API_URL_ABSOLUTA } from '../api'
import Sheet, { ConfirmarSheet } from './Sheet'
import Icono from './Icono'
import { AvisoError } from './Controles'
import { formatCOP, vibrar } from '../utils/formato'

const URL_INGESTA = `${API_URL_ABSOLUTA}/ingesta/sms/`
const REMITENTES = [
  { banco: 'Bancolombia', numero: '85540' },
  { banco: 'Nequi', numero: '890706' },
]
const TIPO_TEXTO = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia', ahorro: 'Ahorro' }

const hace = (iso) => {
  if (!iso) return null
  const min = Math.round((Date.now() - new Date(iso)) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}

async function copiar(texto, que) {
  try {
    await navigator.clipboard.writeText(texto)
    vibrar()
    toast.success(`${que} copiado`)
  } catch {
    toast.error('No se pudo copiar', { description: 'Mantén presionado el texto para copiarlo.' })
  }
}

export default function AtajoSheet({ abierto, onCerrar }) {
  const [estado, setEstado] = useState(null)
  const [token, setToken] = useState('')
  const [generando, setGenerando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  useEffect(() => {
    if (!abierto) return
    let vivo = true
    api.get('/ingesta/token/').then(r => { if (vivo) setEstado(r.data) }).catch(() => {})
    return () => { vivo = false }
  }, [abierto])

  const generar = async () => {
    setGenerando(true)
    try {
      const r = await api.post('/ingesta/token/')
      setToken(r.data.token)
      setEstado(r.data)
    } catch {
      toast.error('No se pudo generar el token')
    } finally {
      setGenerando(false)
    }
  }

  const desconectar = async () => {
    try {
      await api.delete('/ingesta/token/')
      setToken('')
      setEstado(e => ({ ...e, activo: false }))
      setConfirmar(false)
      toast('Atajo desconectado', { description: 'Los SMS ya no se registrarán hasta que generes otro token.' })
    } catch {
      toast.error('No se pudo desconectar')
    }
  }

  const cerrar = () => { setToken(''); onCerrar() }

  return (
    <>
      <Sheet abierto={abierto} onCerrar={cerrar} titulo="Registro automático">
        <p className="texto-callout" style={{ color: 'var(--texto-secundario)', marginBottom: 18 }}>
          Cada vez que llegue un SMS de tu banco, un atajo del iPhone lo envía a FinTracker y el movimiento queda registrado solo.
        </p>

        {/* Estado de la conexión */}
        <div className="lista-grupo" style={{ background: 'var(--card-hover)', marginBottom: 22 }}>
          <div className="fila" style={{ minHeight: 56 }}>
            <span className="mosaico sm" style={{ background: estado?.activo ? 'var(--ingreso)' : 'var(--relleno)', color: estado?.activo ? '#000' : 'var(--texto-secundario)' }}>
              <Icono nombre={estado?.activo ? 'check' : 'mensaje'} size={16} grosor={2.4} />
            </span>
            <div className="fila-cuerpo">
              <p className="fila-titulo" style={{ fontSize: 16, fontWeight: 600 }}>
                {estado === null ? 'Revisando…' : estado.activo ? 'Conectado' : 'Sin conectar'}
              </p>
              <p className="fila-sub">
                {estado?.activo
                  ? (estado.ultimo_uso ? `Último SMS ${hace(estado.ultimo_uso)}` : 'Aún no ha llegado ningún SMS')
                  : 'Genera un token para configurar el atajo'}
              </p>
            </div>
          </div>
        </div>

        {/* Token recién creado: se muestra una sola vez */}
        {token ? (
          <section aria-label="Datos para el atajo" style={{ marginBottom: 22 }}>
            <Copiable etiqueta="URL" valor={URL_INGESTA} />
            <Copiable etiqueta="Token (X-Token-Ingesta)" valor={token} secreto />
            <p className="campo-ayuda" style={{ color: 'var(--ahorro)' }}>
              Cópialo ahora: por seguridad no lo volverás a ver. Si lo pierdes, genera otro.
            </p>
          </section>
        ) : (
          <button className={estado?.activo ? 'btn-secundario' : 'btn-primario'} onClick={generar} disabled={generando} style={{ marginBottom: 22 }}>
            {generando ? 'Generando…' : estado?.activo ? 'Generar un token nuevo' : 'Generar token'}
          </button>
        )}

        <h3 className="seccion-label" style={{ paddingLeft: 4 }}>Configura el atajo</h3>
        <ol className="pasos">
          <li>Abre <b>Atajos</b> → <b>Automatización</b> → <b>+</b> → <b>Mensaje</b>.</li>
          <li>
            En <b>Remitente</b> elige el número del banco. Si no aparece, guárdalo primero como contacto:
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {REMITENTES.map(r => (
                <button key={r.numero} type="button" className="chip" onClick={() => copiar(r.numero, `Número de ${r.banco}`)}
                  style={{ minHeight: 32 }}>
                  {r.banco} · <span className="cifra">{r.numero}</span>
                </button>
              ))}
            </span>
          </li>
          <li>Marca <b>Ejecutar inmediatamente</b> (sin confirmar).</li>
          <li>
            Agrega la acción <b>Obtener contenido de URL</b> (Get Contents of URL): pega la URL, método <b>POST</b>, encabezado{' '}
            <code>X-Token-Ingesta</code> con tu token, y cuerpo <b>JSON</b> con dos campos:{' '}
            <code>remitente</code> = el número del banco (escrito) y <code>texto</code> = la variable{' '}
            <b>Entrada del atajo</b> (Shortcut Input).
            <span style={{ display: 'block', marginTop: 6, color: 'var(--ahorro)' }}>
              No la escribas: en el campo vacío tócala en la barra sobre el teclado (o en Select Variable). Debe quedar como una burbuja de color.
            </span>
          </li>
          <li>
            Opcional, para ver qué se registró: agrega <b>Obtener valor del diccionario</b> (Get Dictionary Value) con clave{' '}
            <code>mensaje</code> sobre <i>Contenido de la URL</i>, y luego <b>Mostrar notificación</b> (Show Notification) con ese valor.
          </li>
          <li>Repite con Nequi si también lo usas.</li>
        </ol>
        <p className="campo-ayuda" style={{ marginBottom: 22 }}>
          Para saber de qué cuenta es cada SMS, escribe en cada cuenta los últimos dígitos que salen en los mensajes (Cuentas → editar).
          Si llega uno que no reconozco, queda en <b>Por revisar</b> y ahí lo asignas.
        </p>

        <Probador />

        {estado?.activo && (
          <button className="btn-texto peligro" onClick={() => setConfirmar(true)} style={{ width: '100%', marginTop: 8 }}>
            Desconectar atajo
          </button>
        )}
      </Sheet>

      <ConfirmarSheet
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
        titulo="¿Desconectar el atajo?"
        mensaje="El token dejará de funcionar y los SMS ya no se registrarán. Puedes generar otro cuando quieras."
        textoConfirmar="Desconectar"
        onConfirmar={desconectar}
      />
    </>
  )
}

function Copiable({ etiqueta, valor, secreto = false }) {
  return (
    <div className="campo" style={{ marginBottom: 12 }}>
      <p className="label">{etiqueta}</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <code className="input" style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', fontSize: 13,
          overflowWrap: 'anywhere', lineHeight: 1.35, userSelect: 'all', padding: '10px 12px',
        }}>
          {valor}
        </code>
        <button type="button" className="btn-icono acento" onClick={() => copiar(valor, secreto ? 'Token' : etiqueta)}
          aria-label={`Copiar ${etiqueta}`} style={{ width: 48, height: 'auto', borderRadius: 12 }}>
          <Icono nombre="copiar" size={18} />
        </button>
      </div>
    </div>
  )
}

// Pega un SMS y mira qué se registraría, sin guardar nada
function Probador() {
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState(null)
  const [probando, setProbando] = useState(false)
  const [error, setError] = useState('')

  const probar = async () => {
    if (!texto.trim()) return
    setProbando(true)
    setError('')
    try {
      const r = await api.post('/ingesta/probar/', { texto })
      setResultado(r.data)
    } catch {
      setError('No se pudo probar. Revisa tu conexión.')
    } finally {
      setProbando(false)
    }
  }

  const reg = resultado?.registro
  return (
    <section aria-label="Probar un SMS" style={{ marginBottom: 16 }}>
      <h3 className="seccion-label" style={{ paddingLeft: 4 }}>Probar con un SMS</h3>
      <textarea
        className="input"
        rows={3}
        placeholder="Pega aquí un SMS de tu banco…"
        value={texto}
        onChange={e => { setTexto(e.target.value); setResultado(null) }}
        aria-label="Texto del SMS"
      />
      <button className="btn-tinte" onClick={probar} disabled={probando || !texto.trim()} style={{ marginTop: 10 }}>
        {probando ? 'Leyendo…' : 'Ver qué se registraría'}
      </button>
      <AvisoError>{error}</AvisoError>

      {resultado && (
        <div className="lista-grupo aparecer" role="status" style={{ background: 'var(--card-hover)', marginTop: 12 }}>
          <div className="fila" style={{ alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
            <span className="mosaico sm" style={{
              background: reg ? 'var(--ingreso)' : 'var(--ahorro)', color: '#000',
            }}>
              <Icono nombre={reg ? 'check' : 'info'} size={16} grosor={2.4} />
            </span>
            <div className="fila-cuerpo">
              {reg ? (
                <>
                  <p className="fila-titulo" style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'normal' }}>
                    {TIPO_TEXTO[reg.tipo]} de {formatCOP(reg.monto)} · {reg.nombre}
                  </p>
                  <p className="fila-sub" style={{ whiteSpace: 'normal' }}>
                    {[reg.cuenta_origen && `Desde ${reg.cuenta_origen}`, reg.cuenta_destino && `hacia ${reg.cuenta_destino}`].filter(Boolean).join(' ')}
                    {resultado.metodo === 'ia' ? ' · leído con IA' : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="fila-titulo" style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'normal' }}>
                    {resultado.entendido ? `Entendí ${formatCOP(resultado.datos?.monto || 0)}, pero falta un dato` : 'No lo reconocí'}
                  </p>
                  <p className="fila-sub" style={{ whiteSpace: 'normal' }}>{resultado.motivo}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
