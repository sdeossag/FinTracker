// Barra de pestañas flotante (misma física que la de NutriFit, según apple-design).
//
// La selección es un lente. Todo lo que se mueve lo hace con resortes que parten
// del valor en pantalla, así cualquier movimiento se puede agarrar y redirigir (§3):
//   - Al tocar, el lente crece y viaja a la pestaña bajo el dedo antes de soltar (§1).
//   - Se arrastra 1:1 respetando dónde se agarró (§2), con resistencia en los bordes (§9).
//   - Al soltar hereda la velocidad del dedo (§5) y cae donde apuntaba el gesto (§6),
//     como mucho una pestaña más allá.
//   - Se estira en la dirección del movimiento según la velocidad (§8, §11).
//   - Pinta de azul exactamente lo que cubre y agranda los íconos cerca del dedo.
//   - Arrastrar lejos de la barra y soltar cancela el cambio (§10).
// El botón central "Nueva" no es una pestaña: el lente lo cruza, y soltar encima lo abre.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  haptic, prefersReducedMotion, project, rubberband, spring, trackPointer, velocityFrom,
} from '../utils/movimiento'
import './NavBar.css'

/* ── Iconos ─────────────────────────────────────────── */
const IconoInicio = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
const IconoHistorial = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" rx="1.25" fill="currentColor"/><rect x="3" y="10.75" width="18" height="2.5" rx="1.25" fill="currentColor"/><rect x="3" y="16.5" width="12" height="2.5" rx="1.25" fill="currentColor"/></svg>
const IconoCuentas = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" opacity="0.2"/><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="2"/><rect x="2" y="9.5" width="20" height="2.5" fill="currentColor"/><circle cx="7" cy="15" r="1.8" fill="currentColor"/></svg>
const IconoGraficas = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 19L8.5 12.5L12.5 16.5L17 9L21 12" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 19L8.5 12.5L12.5 16.5L17 9L21 12V20H3Z" fill="currentColor" opacity="0.18"/>
  </svg>
)
const IconoMas = () => (
  <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path d="M11 4V18M4 11H18" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
  </svg>
)

/* ── Items ──────────────────────────────────────────── */
// "relacionadas": pantallas a las que se llega desde esa pestaña (wayfinding)
const ITEMS = [
  { id: 'inicio',    path: '/',              label: 'Inicio',    Icon: IconoInicio,    relacionadas: ['/configuracion', '/revisar'] },
  { id: 'historial', path: '/transacciones', label: 'Historial', Icon: IconoHistorial, relacionadas: ['/recurrentes', '/editar'] },
  { id: 'nueva',     path: '/nueva',         label: 'Nueva',     isFab: true },
  { id: 'cuentas',   path: '/cuentas',       label: 'Cuentas',   Icon: IconoCuentas,   relacionadas: [] },
  { id: 'graficas',  path: '/graficas',      label: 'Gráficas',  Icon: IconoGraficas,  relacionadas: ['/presupuesto'] },
]
const TABS = ITEMS.map((it, i) => (it.isFab ? -1 : i)).filter(i => i >= 0)
const FAB = ITEMS.findIndex(it => it.isFab)

const coincide = (item, ruta) => {
  if (item.isFab) return false
  if (item.relacionadas.some(r => ruta.startsWith(r))) return true
  return item.path === '/' ? ruta === '/' : ruta.startsWith(item.path)
}

const DRAG_THRESHOLD  = 10     // histéresis antes de tratarlo como arrastre (§10)
const CANCEL_DISTANCE = 80     // px por encima de la barra para cancelar al soltar
const INSET           = 4
const LIFT_SCALE      = 0.1    // el lente crece 10% mientras se toca
const MAX_MAGNIFY     = 0.14   // un ícono bajo el dedo crece hasta 14%
const MAX_STRETCH     = 0.14   // estiramiento máximo por velocidad
const STRETCH_SPEED   = 3200   // px/s para llegar al estiramiento máximo

// Resortes (response en segundos, damping 1 = sin rebote)
const SP_MOVE   = { response: 0.36, damping: 1 }
const SP_CATCH  = { response: 0.18, damping: 1 }
const SP_LIFT   = { response: 0.24, damping: 1 }
const SP_SETTLE = { response: 0.34, damping: 1 }
const SP_MAG_IN = { response: 0.16, damping: 1 }

const smoothstep = (t) => t * t * (3 - 2 * t)
const clamp01 = (v) => Math.max(0, Math.min(1, v))

function Contenido({ item }) {
  const { Icon } = item
  return (
    <>
      <Icon />
      <span className="nav-label">{item.label}</span>
    </>
  )
}

export default function NavBar({ oculta = false }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const navRef  = useRef(null)
  const pillRef = useRef(null)
  const btnRefs = useRef([])
  const litRefs = useRef([])
  const geo     = useRef({ lefts: [], widths: [], width: 0 })

  // Valores en pantalla (presentation values) y sus resortes
  const x       = useRef(null)
  const lift    = useRef(0)
  const stretch = useRef(0)
  const mag     = useRef(ITEMS.map(() => 0))
  const anims   = useRef({ x: null, lift: null, stretch: null, mag: [] })

  const gesture      = useRef(null)
  const hovering     = useRef(false)
  const fromDrag     = useRef(false)
  const lastHover    = useRef(-1)
  const pendiente    = useRef(false)
  const stretchTimer = useRef(0)

  const activoIdx = ITEMS.findIndex(it => coincide(it, pathname))
  const activeRef = useRef(activoIdx)
  useLayoutEffect(() => { activeRef.current = activoIdx }, [activoIdx])

  const ir = (path) => { if (pathname !== path) navigate(path) }

  // ── Geometría (cacheada: no se lee layout en cada frame) ──
  const medir = () => {
    const btns = btnRefs.current
    geo.current = {
      lefts:  btns.map(b => b?.offsetLeft ?? 0),
      widths: btns.map(b => b?.offsetWidth ?? 0),
      width:  navRef.current?.offsetWidth ?? 0,
    }
  }
  const centro    = (i) => geo.current.lefts[i] + geo.current.widths[i] / 2
  const pillWidth = () => (geo.current.widths[TABS[0]] ?? 64) - INSET * 2
  // Posición dentro de TABS de la pestaña más cercana (el botón central no cuenta)
  const nearestPos = (cx) => {
    let best = 0
    TABS.forEach((i, p) => { if (Math.abs(centro(i) - cx) < Math.abs(centro(TABS[best]) - cx)) best = p })
    return best
  }
  const nearest = (cx) => TABS[nearestPos(cx)]
  const reposo = () => (activeRef.current >= 0 ? centro(activeRef.current) : null)

  // ── Render: compone todos los valores en un solo frame ──
  const render = () => {
    pendiente.current = false
    const pill = pillRef.current
    if (!pill || x.current == null) return
    const w  = pillWidth()
    const cx = x.current
    const s  = 1 + LIFT_SCALE * lift.current
    const st = stretch.current
    // Sin pestaña activa (p. ej. en una pantalla sin equivalente) el lente solo aparece al tocar
    const visible = activeRef.current >= 0 || gesture.current || hovering.current
    pill.style.opacity = visible ? '1' : '0'
    pill.style.width = `${w}px`
    pill.style.transform =
      `translate3d(${(cx - w / 2).toFixed(2)}px, 0, 0) scale(${(s * (1 + st)).toFixed(4)}, ${(s * (1 - st * 0.5)).toFixed(4)})`

    // Transferencia de color: el azul aparece solo donde el lente cubre cada pestaña
    const half = (w * s * (1 + st)) / 2
    const pL = visible ? cx - half : 0
    const pR = visible ? cx + half : 0
    const { lefts, widths } = geo.current
    litRefs.current.forEach((lit, i) => {
      if (!lit) return
      const bL = lefts[i], bW = widths[i] || 1, bR = bL + bW
      const oL = Math.max(pL, bL), oR = Math.min(pR, bR)
      lit.style.clipPath = oR <= oL
        ? 'inset(0 100% 0 0)'
        : `inset(0 ${(((bR - oR) / bW) * 100).toFixed(2)}% 0 ${(((oL - bL) / bW) * 100).toFixed(2)}%)`
    })

    // Lupa: los íconos cerca del dedo crecen
    btnRefs.current.forEach((btn, i) => {
      if (!btn) return
      const t = mag.current[i]
      btn.style.transform = t > 0.001
        ? `translateY(${(-3 * t).toFixed(2)}px) scale(${(1 + MAX_MAGNIFY * t).toFixed(4)})`
        : ''
    })
  }
  // Se dibuja en la misma tarea (microtarea), no en el siguiente frame: cero latencia (§1)
  const schedule = () => {
    if (pendiente.current) return
    pendiente.current = true
    queueMicrotask(render)
  }

  // ── Resortes que parten del valor actual (y heredan su velocidad) ──
  const animar = (key, ref, target, cfg, { velocity, idx } = {}) => {
    const actual = idx == null ? anims.current[key] : anims.current.mag[idx]
    const from = idx == null ? ref.current : ref.current[idx]
    const v = velocity ?? actual?.velocity ?? 0
    actual?.stop()
    const a = spring({
      from: from ?? target, to: target, velocity: v,
      response: cfg.response, damping: cfg.damping,
      restDelta: key === 'x' ? 0.3 : 0.001,
      onUpdate: (val) => {
        if (idx == null) ref.current = val; else ref.current[idx] = val
        schedule()
      },
      onComplete: () => {
        if (idx == null) anims.current[key] = null; else anims.current.mag[idx] = null
      },
    })
    const vivo = prefersReducedMotion() ? null : a
    if (idx == null) anims.current[key] = vivo; else anims.current.mag[idx] = vivo
  }

  const moverA = (target, cfg = SP_MOVE, velocity) => {
    if (target == null) { schedule(); return }
    animar('x', x, target, cfg, { velocity })
  }
  const levantar = (on) => {
    animar('lift', lift, on ? 1 : 0, on ? SP_LIFT : SP_SETTLE)
    if (pillRef.current) pillRef.current.dataset.lifted = on ? 'true' : 'false'
  }
  const estirar = (v) => {
    if (prefersReducedMotion()) return
    const objetivo = Math.min(Math.abs(v) / STRETCH_SPEED, 1) * MAX_STRETCH
    animar('stretch', stretch, objetivo, SP_MAG_IN)
    // Si el dedo se detiene no llegan más eventos: el lente recupera su forma
    clearTimeout(stretchTimer.current)
    stretchTimer.current = setTimeout(() => animar('stretch', stretch, 0, SP_SETTLE), 70)
  }
  const magnify = (px) => {
    const reducir = prefersReducedMotion()
    const { lefts, widths } = geo.current
    const radio = (widths[TABS[0]] || 64) * 1.6
    ITEMS.forEach((_, i) => {
      const t = px == null || reducir ? 0 : smoothstep(clamp01(1 - Math.abs(px - (lefts[i] + widths[i] / 2)) / radio))
      animar('mag', mag, t, px == null ? SP_SETTLE : SP_MAG_IN, { idx: i })
    })
  }
  const detenerX = () => { anims.current.x?.stop(); anims.current.x = null }

  // ── Posición inicial y cambios de tamaño: sin animación ──
  useLayoutEffect(() => {
    medir()
    x.current = reposo() ?? centro(TABS[0])
    render()
    const ro = new ResizeObserver(() => {
      medir()
      if (!gesture.current && !anims.current.x && !hovering.current) {
        x.current = reposo() ?? x.current
        schedule()
      }
    })
    ro.observe(navRef.current)
    return () => {
      ro.disconnect()
      clearTimeout(stretchTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cambio de pantalla por toque, teclado o código: el lente viaja con resorte
  useEffect(() => {
    if (fromDrag.current) { fromDrag.current = false; return }
    if (x.current == null || hovering.current || gesture.current) return
    moverA(reposo())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activoIdx])

  const objetivoDesde = (clientX, left, grab = 0) => {
    const min = centro(TABS[0]), max = centro(TABS[TABS.length - 1])
    let t = clientX - left - grab
    if (t < min) t = min - rubberband(min - t, geo.current.width)
    if (t > max) t = max + rubberband(t - max, geo.current.width)
    return t
  }

  // Tick háptico al cruzar a otra pestaña mientras se arrastra (§13)
  const tickSiCambia = (cx) => {
    const i = nearest(cx)
    if (i !== lastHover.current) {
      if (lastHover.current !== -1) haptic(4)
      lastHover.current = i
    }
  }

  // ── Toque / clic presionado ──
  const onPointerDown = (e) => {
    if (e.button !== 0 || gesture.current) return
    // El botón central es un botón normal: solo su propio clic
    if (e.target.closest?.('.nav-fab-wrapper')) return
    medir()
    const rect = navRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const onPill = activeRef.current >= 0 && Math.abs(px - x.current) < pillWidth() / 2
    gesture.current = {
      left: rect.left, top: rect.top, startX: e.clientX, startY: e.clientY,
      grab: onPill ? px - x.current : 0,
      catching: !onPill,
      dragging: false,
      samples: [{ x: e.clientX, t: e.timeStamp }],
    }
    lastHover.current = nearest(px)
    // §1: responde al presionar — el lente crece y va hacia la pestaña tocada
    levantar(true)
    if (!onPill) moverA(centro(nearest(px)), SP_CATCH)
    trackPointer(e, { onMove, onEnd })
  }

  const onMove = (e) => {
    const g = gesture.current
    if (!g) return false
    if (!g.dragging) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return false
      g.dragging = true
    }
    g.samples.push({ x: e.clientX, t: e.timeStamp })
    if (g.samples.length > 8) g.samples.shift()

    // Lejos de la barra: el lente se relaja para anunciar que soltar cancela
    const lejos = g.top - e.clientY > CANCEL_DISTANCE
    if (lejos !== !!g.lejos) { g.lejos = lejos; levantar(!lejos) }

    const target = objetivoDesde(e.clientX, g.left, g.grab)
    magnify(lejos ? null : e.clientX - g.left)
    estirar(velocityFrom(g.samples))
    tickSiCambia(target)

    if (g.catching) {
      // Se agarró fuera del lente: lo alcanza con resorte y luego lo sigue 1:1
      moverA(target, SP_CATCH)
      if (Math.abs(x.current - target) < 2) { g.catching = false; detenerX() }
    } else {
      detenerX()
      x.current = target
      schedule()
    }
    return true
  }

  const onEnd = (e) => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (!hovering.current) { levantar(false); magnify(null) }

    if (!g.dragging) {
      // Toque simple: el click confirma el cambio. Si se tocó la pestaña activa
      // (o el toque se canceló), el lente vuelve a su sitio.
      const tocada = nearest(g.startX - g.left)
      if (tocada === activeRef.current || e.type === 'pointercancel') moverA(reposo())
      return
    }

    // Soltar sobre el botón central abre "Nueva"
    const fab = btnRefs.current[FAB]?.getBoundingClientRect()
    if (e.type === 'pointerup' && fab && e.clientX >= fab.left && e.clientX <= fab.right && e.clientY >= fab.top - 12 && e.clientY <= fab.bottom) {
      detenerX()
      moverA(reposo())
      haptic(10)
      ir('/nueva')
      return
    }

    g.samples.push({ x: e.clientX, t: e.timeStamp })
    const cancelar = e.type === 'pointercancel' || g.top - e.clientY > CANCEL_DISTANCE
    const v = cancelar ? 0 : velocityFrom(g.samples)
    // El momentum la lleva como mucho una pestaña más allá de donde se soltó
    const base = nearestPos(x.current)
    const proj = nearestPos(x.current + project(v, 0.99))
    const pos  = Math.max(base - 1, Math.min(base + 1, proj))
    const idx  = cancelar ? activeRef.current : TABS[pos]
    detenerX()
    if (idx < 0) { moverA(reposo()); return }
    moverA(centro(idx), Math.abs(v) > 300 ? { response: 0.4, damping: 0.8 } : SP_MOVE, v)
    if (idx !== activeRef.current) {
      fromDrag.current = true
      haptic(10)
      ir(ITEMS[idx].path)
    }
  }

  // ── Mouse sin presionar: el lente sigue al puntero (solo computador) ──
  const onHoverMove = (e) => {
    if (e.pointerType !== 'mouse' || e.buttons !== 0 || gesture.current) return
    const rect = navRef.current.getBoundingClientRect()
    if (!hovering.current) { hovering.current = true; medir(); levantar(true) }
    magnify(e.clientX - rect.left)
    moverA(objetivoDesde(e.clientX, rect.left), { response: 0.22, damping: 1 })
  }

  const onHoverLeave = (e) => {
    if (e.pointerType !== 'mouse' || !hovering.current) return
    hovering.current = false
    if (gesture.current) return
    levantar(false)
    magnify(null)
    moverA(reposo(), { response: 0.4, damping: 1 })
  }

  return (
    <nav
      ref={navRef}
      className="navbar"
      aria-label="Principal"
      data-oculta={oculta || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onHoverMove}
      onPointerLeave={onHoverLeave}
    >
      {/* Lente: tinte, borde de luz y brillo especular */}
      <div ref={pillRef} className="navbar-pill" data-lifted="false" aria-hidden="true">
        <span className="navbar-pill-shine" />
      </div>

      {ITEMS.map((item, i) => {
        if (item.isFab) {
          return (
            <button
              key={item.id}
              ref={el => { btnRefs.current[i] = el }}
              onClick={() => ir(item.path)}
              className="nav-fab-wrapper"
              aria-label="Nueva transacción"
            >
              <div data-fab="" className="nav-fab"><IconoMas /></div>
              <span className="nav-fab-label" aria-hidden="true">{item.label}</span>
            </button>
          )
        }
        return (
          <button
            key={item.id}
            ref={el => { btnRefs.current[i] = el }}
            onClick={() => ir(item.path)}
            className="nav-item"
            aria-current={i === activoIdx ? 'page' : undefined}
            aria-label={item.label}
          >
            <span className="nav-capa nav-base"><Contenido item={item} /></span>
            <span ref={el => { litRefs.current[i] = el }} className="nav-capa nav-lit" aria-hidden="true">
              <Contenido item={item} />
            </span>
          </button>
        )
      })}
    </nav>
  )
}
