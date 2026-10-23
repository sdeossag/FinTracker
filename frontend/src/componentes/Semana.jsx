// Presupuesto semanal: cuánto llevas de lunes a domingo frente a tu tope.
// La tarjeta va en Inicio y en Presupuesto → Semana; al tocarla se abre el detalle.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../api'
import Sheet from './Sheet'
import Icono from './Icono'
import { AvisoError, CampoMonto } from './Controles'
import { formatCOP, vibrar } from '../utils/formato'
import { COLOR_ESTADO, rangoSemana } from '../utils/semana'

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/* ── Tarjeta ────────────────────────────────────────── */
export function TarjetaSemana({ datos, onAbrir }) {
  const { tope, gastado, queda, estado, por_dia: porDia, dia } = datos
  const color = COLOR_ESTADO[estado]
  const uso = tope ? Math.min(gastado / tope, 1) : 0
  const pasado = estado === 'pasado'

  return (
    <button
      type="button"
      className="card semana-tarjeta"
      onClick={onAbrir}
      aria-label={`Esta semana llevas ${formatCOP(gastado)} de ${formatCOP(tope)}. Ver detalle`}
    >
      <div className="semana-cabecera">
        <span className="texto-nota">Esta semana · {rangoSemana(datos)}</span>
        <span className="fila-chevron"><Icono nombre="chevron-right" size={15} grosor={2.2} /></span>
      </div>

      <p className="semana-cifra">
        <span className="cifra-hero" style={{ fontSize: 'clamp(1.6rem, 7.5vw, 1.9rem)', color: pasado ? 'var(--gasto)' : undefined }}>
          {formatCOP(gastado)}
        </span>
        <span className="texto-nota cifra"> de {formatCOP(tope)}</span>
      </p>

      <div className="progress-track" role="meter" aria-label="Tope de la semana usado"
        aria-valuemin={0} aria-valuemax={tope} aria-valuenow={gastado} style={{ height: 8, borderRadius: 4 }}>
        <div className="progress-fill" style={{ transform: `scaleX(${uso})`, background: color }} />
      </div>

      <Dias porDia={porDia} hoy={dia} color={color} />

      <p className="texto-nota semana-pie" style={{ color: pasado ? 'var(--gasto)' : estado === 'cerca' ? 'var(--ahorro)' : undefined }}>
        {pasado
          ? `Te pasaste ${formatCOP(-queda)}`
          : `Te quedan ${formatCOP(queda)} hasta el domingo`}
      </p>
    </button>
  )
}

// Siete barras: lo que gastaste cada día. Hoy resaltado, los días que vienen apagados.
function Dias({ porDia, hoy, color }) {
  const max = Math.max(...porDia, 1)
  // Crecen una sola vez al montar (no en cada recarga): el 0 inicial se cambia en el siguiente frame
  const [listo, setListo] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setListo(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="semana-dias" role="img"
      aria-label={porDia.map((v, i) => `${DIAS_LARGOS[i]}: ${formatCOP(v)}`).join(', ')}>
      {porDia.map((v, i) => (
        <div key={i} className="semana-dia" data-hoy={i === hoy || undefined} data-futuro={i > hoy || undefined}>
          <div className="semana-dia-pista">
            <div
              className="semana-dia-barra"
              style={{
                // clip-path en vez de scaleY: la barra crece sin aplastar sus esquinas redondeadas
                clipPath: `inset(${(1 - (listo ? Math.max(v / max, v ? 0.08 : 0) : 0)) * 100}% 0 0 0 round 6px)`,
                background: i === hoy ? color : undefined,
                transitionDelay: `${i * 30}ms`,
              }}
            />
          </div>
          <span className="semana-dia-letra">{DIAS[i]}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Invitación (sin tope todavía) ──────────────────── */
const CLAVE_INVITACION = 'ft_tope_invitacion_oculta'

export function InvitacionTope({ onCrear }) {
  const [oculta, setOculta] = useState(() => {
    try { return localStorage.getItem(CLAVE_INVITACION) === '1' } catch { return false }
  })
  if (oculta) return null
  const descartar = () => {
    try { localStorage.setItem(CLAVE_INVITACION, '1') } catch { /* sin almacenamiento */ }
    setOculta(true)
  }
  return (
    <div className="lista-grupo" style={{ marginBottom: 28 }}>
      <div className="fila" style={{ minHeight: 64, paddingRight: 6 }}>
        <span className="mosaico sm" style={{ background: 'var(--ingreso)', color: '#000' }}>
          <Icono nombre="objetivo" size={16} grosor={2.2} />
        </span>
        <button type="button" className="fila-cuerpo" onClick={onCrear} style={{ textAlign: 'left', minHeight: 44 }}>
          <p className="fila-titulo" style={{ fontSize: 15, fontWeight: 600 }}>Ponle un tope a tu semana</p>
          <p className="fila-sub">Mira cada día cuánto llevas y cuánto te queda</p>
        </button>
        <button type="button" className="sheet-cerrar" onClick={descartar} aria-label="No mostrar más">
          <Icono nombre="x" size={14} grosor={2.4} />
        </button>
      </div>
    </div>
  )
}

/* ── Detalle de la semana ───────────────────────────── */
export function DetalleSemanaSheet({ abierto, onCerrar, datos, onCambiarTope }) {
  const navigate = useNavigate()
  if (!datos) return null
  const { tope, gastado, estado, por_categoria: categorias, semana_pasada: pasada } = datos
  const diferencia = gastado - pasada

  return (
    <Sheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Esta semana"
      pie={
        <>
          <button className="btn-primario" onClick={() => { onCerrar(); navigate('/transacciones?semana=actual') }}>
            Ver movimientos de la semana
          </button>
          <button className="btn-secundario" onClick={onCambiarTope}>Cambiar tope</button>
        </>
      }
    >
      <p className="texto-nota" style={{ marginBottom: 2 }}>{rangoSemana(datos)}</p>
      <p style={{ marginBottom: 6 }}>
        <span className="cifra-hero" style={{ fontSize: 'clamp(1.9rem, 9vw, 2.4rem)', color: estado === 'pasado' ? 'var(--gasto)' : undefined }}>
          {formatCOP(gastado)}
        </span>
        <span className="texto-nota cifra"> de {formatCOP(tope)}</span>
      </p>
      {pasada > 0 && (
        <p className="texto-nota" style={{ marginBottom: 22 }}>
          {diferencia <= 0
            ? `${formatCOP(-diferencia)} menos que la semana pasada`
            : `${formatCOP(diferencia)} más que la semana pasada`}
        </p>
      )}

      <h3 className="seccion-label" style={{ marginTop: pasada > 0 ? 0 : 18 }}>En qué se fue</h3>
      {categorias.length === 0 ? (
        <p className="texto-nota" style={{ padding: '4px 4px 8px' }}>Todavía no hay gastos esta semana.</p>
      ) : (
        <div className="lista-grupo" style={{ background: 'var(--card-hover)' }}>
          {categorias.map(c => (
            <div key={c.id ?? 'sin'} className="fila" style={{ alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color_hex, marginTop: 6, flexShrink: 0 }} />
              <div className="fila-cuerpo">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <p className="texto-cuerpo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</p>
                  <span className="cifra" style={{ fontWeight: 600, flexShrink: 0 }}>{formatCOP(c.total)}</span>
                </div>
                <div className="progress-track" role="presentation" style={{ height: 4 }}>
                  <div className="progress-fill" style={{ transform: `scaleX(${Math.min(c.total / Math.max(tope, gastado), 1)})`, background: c.color_hex }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="campo-ayuda">
        Cuenta de lunes a domingo. Las compras a cuotas suman solo la cuota. Los gastos fijos los sacas en Presupuesto → Semana.
      </p>
    </Sheet>
  )
}

/* ── Poner o cambiar el tope ────────────────────────── */
export function TopeSheet({ abierto, onCerrar, datos, onGuardado }) {
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Cada vez que se abre arranca con el tope actual (o vacío, con la sugerencia a un toque)
  const [abiertoAntes, setAbiertoAntes] = useState(abierto)
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto)
    if (abierto) {
      setValor(datos?.tope ? String(datos.tope) : '')
      setError('')
    }
  }

  const guardar = async (tope) => {
    setError('')
    setGuardando(true)
    try {
      const { data } = await api.patch('/semana/', { tope })
      vibrar()
      onGuardado(data)
      onCerrar()
      toast.success(tope ? 'Tope guardado' : 'Tope quitado', tope ? { description: `${formatCOP(tope)} por semana` } : undefined)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar. Revisa tu conexión.')
    } finally {
      setGuardando(false)
    }
  }

  const sugerido = datos?.sugerido
  const numero = parseInt(valor || '0')

  return (
    <Sheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={datos?.tope ? 'Cambiar tope semanal' : 'Tope semanal'}
      pie={
        <>
          <button className="btn-primario" onClick={() => guardar(numero)} disabled={guardando || numero < 1000}>
            {guardando ? 'Guardando…' : 'Guardar tope'}
          </button>
          {datos?.tope && (
            <button className="btn-texto peligro" onClick={() => guardar(null)} disabled={guardando}>Quitar tope</button>
          )}
        </>
      }
    >
      <p className="texto-callout" style={{ color: 'var(--texto-secundario)', marginBottom: 18 }}>
        Lo máximo que quieres gastar de lunes a domingo. Te avisamos al llegar al 80 % y si te pasas.
      </p>
      <div className="campo">
        <label className="label" htmlFor="tope-semanal">Tope por semana</label>
        <CampoMonto id="tope-semanal" valor={valor} onChange={setValor} placeholder="$ 0" />
        {sugerido > 0 && String(sugerido) !== valor && (
          <button type="button" className="chip" onClick={() => setValor(String(sugerido))} style={{ marginTop: 10 }}>
            Usar {formatCOP(sugerido)} · tu promedio semanal
          </button>
        )}
      </div>
      <AvisoError>{error}</AvisoError>
    </Sheet>
  )
}
