// Bottom sheet con física de resorte (Apple · Designing Fluid Interfaces):
// — sigue al dedo 1:1 desde la cabecera, con resistencia progresiva hacia arriba
// — al soltar proyecta el momentum para decidir si cierra o regresa
// — el resorte hereda la velocidad del dedo (sin costura entre arrastre y animación)
// — se puede agarrar a mitad de animación; entra y sale por el mismo camino
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AnimatePresence, animate, motion, useMotionValue, usePresence,
  useReducedMotion, useTransform,
} from 'motion/react'
import Icono from './Icono'
import { bloquearScroll } from '../utils/scroll'

const ABRIR   = { type: 'spring', bounce: 0, visualDuration: 0.38 }   // críticamente amortiguado
const REGRESO = { type: 'spring', bounce: 0.2, visualDuration: 0.3 }  // viene de un gesto → leve rebote
const CERRAR  = { type: 'spring', bounce: 0, visualDuration: 0.28 }

const proyectar = (v, d = 0.998) => (v / 1000) * d / (1 - d)
const rubberband = (x, dim, c = 0.55) => (x * dim * c) / (dim + c * Math.abs(x))

// Bloqueo de scroll y pila de hojas abiertas (Escape solo cierra la de arriba)
let bloqueos = 0
const pila = []

export default function Sheet({ abierto, ...props }) {
  return createPortal(
    <AnimatePresence>{abierto && <Panel key="sheet" {...props} />}</AnimatePresence>,
    document.body,
  )
}

function Panel({ onCerrar, titulo, children, pie, rol = 'dialog' }) {
  const [presente, listoParaQuitar] = usePresence()
  const reducir = useReducedMotion()
  const tituloId = useId()
  const panelRef = useRef(null)
  const [altoInicial] = useState(() => window.innerHeight)
  const alto = useRef(altoInicial)
  const y = useMotionValue(reducir ? 0 : altoInicial)
  const opacidad = useMotionValue(reducir ? 0 : 1)
  const scrim = useTransform([y, opacidad], ([vy, op]) =>
    op * (1 - Math.min(Math.max(vy / alto.current, 0), 1)))
  const velCierre = useRef(0)
  const arrastre = useRef(null)
  const presenteRef = useRef(presente)
  const montado = useRef(false)
  const onCerrarRef = useRef(onCerrar)
  useLayoutEffect(() => { onCerrarRef.current = onCerrar })

  const cerrar = (velocidad = 0) => {
    velCierre.current = velocidad
    onCerrarRef.current?.()
  }

  // Entrada: medir y subir desde abajo con un resorte sin rebote
  useLayoutEffect(() => {
    const el = panelRef.current
    alto.current = el.offsetHeight || alto.current
    if (reducir) {
      y.jump(0)
      animate(opacidad, 1, { duration: 0.2, ease: 'easeOut' })
    } else {
      y.jump(alto.current)
      animate(y, 0, ABRIR)
    }
    const ro = new ResizeObserver(() => { alto.current = el.offsetHeight || alto.current })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Salida por el mismo camino, heredando la velocidad del gesto.
  // Si se vuelve a abrir durante la salida, revierte desde donde está.
  useEffect(() => {
    presenteRef.current = presente
    if (!montado.current) { montado.current = true; return }
    if (presente) {
      if (reducir) animate(opacidad, 1, { duration: 0.2 })
      else animate(y, 0, ABRIR)
      return
    }
    const ctrl = reducir
      ? animate(opacidad, 0, { duration: 0.16, ease: 'easeOut' })
      : animate(y, alto.current + 20, { ...CERRAR, velocity: velCierre.current })
    ctrl.then(() => { if (!presenteRef.current) listoParaQuitar() })
  }, [presente])

  // Foco, Escape y bloqueo de scroll del fondo
  useEffect(() => {
    const previo = document.activeElement
    const yo = {}
    pila.push(yo)
    panelRef.current?.focus({ preventScroll: true })
    if (bloqueos++ === 0) bloquearScroll(true)
    const onKey = (e) => {
      if (e.key === 'Escape' && pila[pila.length - 1] === yo) { e.stopPropagation(); cerrar() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      pila.splice(pila.indexOf(yo), 1)
      if (--bloqueos === 0) bloquearScroll(false)
      if (previo && document.contains(previo)) previo.focus?.({ preventScroll: true })
    }
  }, [])

  /* ── Arrastre ─────────────────────────────────── */
  const onPointerDown = (e) => {
    if (arrastre.current && !e.isPrimary) return                  // ignora un segundo dedo
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target.closest('button, a, input, select, textarea')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    y.stop()                                                      // agarrar a mitad de animación
    arrastre.current = {
      id: e.pointerId, inicio: e.clientY, origen: y.get(), activo: false,
      muestras: [{ t: e.timeStamp, y: e.clientY }],
    }
  }

  const onPointerMove = (e) => {
    const a = arrastre.current
    if (!a || a.id !== e.pointerId) return
    const dy = e.clientY - a.inicio
    if (!a.activo) {
      if (Math.abs(dy) < 3) return
      a.activo = true
    }
    const bruto = a.origen + dy
    y.set(bruto < 0 ? rubberband(bruto, alto.current) : bruto)
    a.muestras.push({ t: e.timeStamp, y: e.clientY })
    while (a.muestras.length > 2 && e.timeStamp - a.muestras[0].t > 100) a.muestras.shift()
  }

  // También cubre lostpointercapture: si el sistema roba el puntero, el gesto termina igual
  const onPointerUp = (e) => {
    const a = arrastre.current
    if (!a || a.id !== e.pointerId) return
    arrastre.current = null
    if (!a.activo) return
    const primera = a.muestras[0]
    const ultima = a.muestras[a.muestras.length - 1]
    const dt = (ultima.t - primera.t) / 1000
    const quieto = e.type !== 'pointerup' || e.timeStamp - ultima.t > 80
    const v = !quieto && dt > 0 ? (ultima.y - primera.y) / dt : 0
    const destino = y.get() + proyectar(v)
    const cierra = v > 550 || (v > -150 && destino > alto.current * 0.45)
    if (cierra) cerrar(v)
    else animate(y, 0, { ...REGRESO, velocity: v })
  }

  return (
    <div className="sheet-raiz" style={{ pointerEvents: presente ? 'auto' : 'none' }}>
      <motion.div className="sheet-scrim" style={{ opacity: scrim }} onClick={() => cerrar()} aria-hidden="true" />
      <motion.div
        ref={panelRef}
        className="sheet"
        role={rol}
        aria-modal="true"
        aria-labelledby={titulo ? tituloId : undefined}
        tabIndex={-1}
        style={{ y, opacity: reducir ? opacidad : 1 }}
      >
        <div
          className="sheet-cabecera"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
        >
          <div className="sheet-handle" />
          {titulo && (
            <div className="sheet-titulo-fila">
              <h2 id={tituloId} className="sheet-titulo">{titulo}</h2>
              <button type="button" className="sheet-cerrar" aria-label="Cerrar" onClick={() => cerrar()}>
                <Icono nombre="x" size={15} grosor={2.6} />
              </button>
            </div>
          )}
        </div>
        <div className="sheet-cuerpo">{children}</div>
        {pie && <div className="sheet-pie">{pie}</div>}
      </motion.div>
    </div>
  )
}

// Confirmación para acciones destructivas e irreversibles (como la action sheet de iOS)
export function ConfirmarSheet({
  abierto, onCerrar, titulo, mensaje, textoConfirmar = 'Eliminar', onConfirmar, cargando,
}) {
  return (
    <Sheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      rol="alertdialog"
      pie={
        <>
          <button type="button" className="btn-destructivo" onClick={onConfirmar} disabled={cargando}>
            {cargando ? 'Eliminando…' : textoConfirmar}
          </button>
          <button type="button" className="btn-secundario" onClick={onCerrar}>Cancelar</button>
        </>
      }
    >
      <p className="texto-callout" style={{ color: 'var(--texto-secundario)' }}>{mensaje}</p>
    </Sheet>
  )
}
