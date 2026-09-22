import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import './NavBar.css'

const INFLUENCIA = 110   // radio del efecto dock (px)
const ESCALA_MAX = 1.14
const PILL_W     = 64
const HISTERESIS = 10    // px antes de convertir un toque en arrastre

// La píldora se mueve con resortes: interrumpibles y heredan la velocidad actual
const SEGUIR  = { type: 'spring', bounce: 0, visualDuration: 0.18 }  // seguir el dedo / el mouse
const REPOSO  = { type: 'spring', bounce: 0, visualDuration: 0.34 }  // ir a la pestaña activa
const SOLTAR  = { type: 'spring', bounce: 0.2, visualDuration: 0.34 } // viene de un gesto con momentum

const COLOR_ACTIVO   = '#0A84FF'
const COLOR_INACTIVO = 'rgba(255,255,255,0.4)'

// Proyección de momentum de Apple; 0.99 = desaceleración rápida (selector corto)
const proyectar = (v, d = 0.99) => (v / 1000) * d / (1 - d)
const rubberband = (x, dim, c = 0.55) => (x * dim * c) / (dim + c * Math.abs(x))

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
  { id: 'inicio',    path: '/',              label: 'Inicio',   Icon: IconoInicio,    relacionadas: ['/configuracion'] },
  { id: 'historial', path: '/transacciones', label: 'Historial', Icon: IconoHistorial, relacionadas: ['/recurrentes', '/editar'] },
  { id: 'nueva',     path: '/nueva',         label: 'Nueva',    isFab: true },
  { id: 'cuentas',   path: '/cuentas',       label: 'Cuentas',  Icon: IconoCuentas,   relacionadas: [] },
  { id: 'graficas',  path: '/graficas',      label: 'Gráficas', Icon: IconoGraficas,  relacionadas: ['/presupuesto'] },
]

const coincide = (item, ruta) => {
  if (item.isFab) return false
  if (item.relacionadas.some(r => ruta.startsWith(r))) return true
  return item.path === '/' ? ruta === '/' : ruta.startsWith(item.path)
}

/* ── Componente ─────────────────────────────────────── */
export default function NavBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const reducir = useReducedMotion()

  const navRef  = useRef(null)
  const btnRefs = useRef([])
  const pillX   = useMotionValue(0)          // borde izquierdo de la píldora, relativo al nav
  const destino = useRef(null)
  const gesto   = useRef(null)               // arrastre táctil en curso
  const hover   = useRef(false)              // mouse sobre la barra
  const suprimirClick = useRef(false)
  const pillRef = useRef(null)
  const lista   = useRef(false)              // ya se colocó la píldora por primera vez
  const [arrastrando, setArrastrando] = useState(false)

  const activoIdx = ITEMS.findIndex(it => coincide(it, pathname))

  const ir = (path) => { if (pathname !== path) navigate(path) }

  const centro = (i) => {
    const nav = navRef.current
    const btn = btnRefs.current[i]
    if (!nav || !btn) return 0
    const n = nav.getBoundingClientRect()
    const b = btn.getBoundingClientRect()
    return b.left - n.left + b.width / 2
  }

  const moverPill = (cx, resorte = REPOSO, inmediato = false) => {
    const x = cx - PILL_W / 2
    destino.current = x
    if (inmediato || reducir) pillX.jump(x)
    else animate(pillX, x, resorte)
  }

  /* ── Revelado del icono/label bajo la píldora ────── */
  const revelar = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const n = nav.getBoundingClientRect()
    const izq = pillX.get()
    const der = izq + PILL_W
    ITEMS.forEach((item, i) => {
      if (item.isFab) return
      const btn = btnRefs.current[i]
      if (!btn) return
      const fill = btn.querySelector('[data-icon-fill]')
      const label = btn.querySelector('[data-label]')
      const solape = (el) => {
        const r = el.getBoundingClientRect()
        const l = r.left - n.left
        const rr = l + r.width
        const oL = Math.max(izq, l)
        const oR = Math.min(der, rr)
        return oR <= oL ? null : { l: (oL - l) / r.width, r: (rr - oR) / r.width }
      }
      if (fill) {
        const s = solape(fill)
        fill.style.clipPath = s
          ? `inset(0 ${(s.r * 100).toFixed(2)}% 0 ${(s.l * 100).toFixed(2)}%)`
          : 'inset(0 0 0 100%)'
      }
      if (label) {
        const s = solape(label)
        label.style.color = s && 1 - s.l - s.r > 0.35 ? COLOR_ACTIVO : COLOR_INACTIVO
      }
    })
  }, [pillX])

  useEffect(() => pillX.on('change', revelar), [pillX, revelar])

  /* ── Colocar la píldora en la pestaña activa ─────── */
  useLayoutEffect(() => {
    const pill = pillRef.current
    if (activoIdx < 0) { if (pill) pill.style.opacity = '0'; return }
    if (gesto.current?.activo || hover.current) return
    const x = centro(activoIdx) - PILL_W / 2
    if (pill) pill.style.opacity = '1'
    if (lista.current && destino.current != null && Math.abs(destino.current - x) < 0.5) return
    moverPill(x + PILL_W / 2, REPOSO, !lista.current)
    lista.current = true
    revelar()
  }, [pathname])

  useEffect(() => {
    const onResize = () => { if (activoIdx >= 0) moverPill(centro(activoIdx), REPOSO, true) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [activoIdx])

  /* ── Efecto dock (escala según la distancia) ─────── */
  const magnificar = (x, y) => {
    const nav = navRef.current
    if (!nav) return null
    const n = nav.getBoundingClientRect()
    const lx = x - n.left
    const ly = y - n.top
    let total = 0
    let pond = 0
    ITEMS.forEach((item, i) => {
      const btn = btnRefs.current[i]
      if (!btn) return
      const cx = centro(i)
      const d = Math.hypot(lx - cx, ly - n.height / 2)
      const t = Math.max(0, 1 - d / INFLUENCIA)
      const e = t * t * (3 - 2 * t)
      if (!reducir) {
        btn.style.transform = `scale(${(1 + (ESCALA_MAX - 1) * e).toFixed(3)}) translateY(${(-e * 2).toFixed(2)}px)`
        if (item.isFab) {
          const fab = btn.querySelector('[data-fab]')
          if (fab) fab.style.boxShadow = `0 ${(3 + e * 4).toFixed(1)}px ${(12 + e * 10).toFixed(1)}px rgba(10,132,255,${(0.38 + e * 0.28).toFixed(2)})`
        }
      }
      if (!item.isFab && e > 0) { total += e; pond += cx * e }
    })
    return total > 0 ? pond / total : null
  }

  const restaurar = () => {
    ITEMS.forEach((item, i) => {
      const btn = btnRefs.current[i]
      if (!btn) return
      btn.style.transform = ''
      if (item.isFab) {
        const fab = btn.querySelector('[data-fab]')
        if (fab) fab.style.boxShadow = ''
      }
    })
    setArrastrando(false)
  }

  /* ── Pointer Events: mouse (hover) y táctil (arrastre) ── */
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' || (gesto.current && !e.isPrimary)) return
    gesto.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, activo: false, muestras: [] }
  }

  const onPointerMove = (e) => {
    if (e.pointerType === 'mouse') {
      if (e.buttons) return
      hover.current = true
      if (!arrastrando) setArrastrando(true)
      const cx = magnificar(e.clientX, e.clientY)
      if (cx != null) moverPill(cx, SEGUIR)
      return
    }
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    if (!g.activo) {
      if (Math.abs(e.clientX - g.x0) < HISTERESIS && Math.abs(e.clientY - g.y0) < HISTERESIS) return
      g.activo = true
      navRef.current.setPointerCapture(e.pointerId)   // el arrastre sigue aunque salga de la barra
      setArrastrando(true)
    }
    g.muestras.push({ t: e.timeStamp, x: e.clientX })
    while (g.muestras.length > 2 && e.timeStamp - g.muestras[0].t > 100) g.muestras.shift()

    // La píldora va bajo el dedo, con resistencia más allá de la primera/última pestaña
    const n = navRef.current.getBoundingClientRect()
    const primero = centro(0)
    const ultimo = centro(ITEMS.length - 1)
    let cx = e.clientX - n.left
    if (cx < primero) cx = primero + rubberband(cx - primero, n.width)
    if (cx > ultimo) cx = ultimo + rubberband(cx - ultimo, n.width)
    magnificar(e.clientX, e.clientY)
    moverPill(cx, SEGUIR)
  }

  const onPointerUp = (e) => {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    gesto.current = null
    if (!g.activo) return                          // toque simple → lo maneja onClick
    suprimirClick.current = true

    // ¿Soltó sobre el botón central?
    const fabIdx = ITEMS.findIndex(it => it.isFab)
    const fab = btnRefs.current[fabIdx]?.getBoundingClientRect()
    restaurar()
    if (e.type === 'pointerup' && fab && e.clientX >= fab.left && e.clientX <= fab.right && e.clientY >= fab.top && e.clientY <= fab.bottom) {
      if (activoIdx >= 0) moverPill(centro(activoIdx))
      ir('/nueva')
      return
    }

    // Proyectar el momentum y elegir la pestaña más cercana a donde "iba"
    const m = g.muestras
    const dt = m.length > 1 ? (m[m.length - 1].t - m[0].t) / 1000 : 0
    const vel = dt > 0 && e.timeStamp - m[m.length - 1].t < 80 ? (m[m.length - 1].x - m[0].x) / dt : 0
    const proyectado = pillX.get() + PILL_W / 2 + proyectar(vel)
    let mejor = -1
    let mejorDist = Infinity
    ITEMS.forEach((item, i) => {
      if (item.isFab) return
      const d = Math.abs(proyectado - centro(i))
      if (d < mejorDist) { mejorDist = d; mejor = i }
    })
    if (mejor < 0) return
    moverPill(centro(mejor), SOLTAR)
    ir(ITEMS[mejor].path)
  }

  const onPointerLeave = (e) => {
    if (e.pointerType !== 'mouse') return
    hover.current = false
    restaurar()
    if (activoIdx >= 0) moverPill(centro(activoIdx))
  }

  /* ── Render ─────────────────────────────────────── */
  return (
    <nav
      ref={navRef}
      className="navbar"
      aria-label="Principal"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      onPointerLeave={onPointerLeave}
      onClickCapture={e => {
        if (suprimirClick.current) { suprimirClick.current = false; e.stopPropagation(); e.preventDefault() }
      }}
    >
      <motion.div
        ref={pillRef}
        className={`navbar-pill ${arrastrando ? 'pill-drag' : 'pill-rest'}`}
        style={{ x: pillX }}
        aria-hidden="true"
      >
        <div className="navbar-pill-fill" />
        <div className="navbar-pill-shine" />
      </motion.div>

      {ITEMS.map((item, i) => {
        const active = i === activoIdx

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

        const { Icon } = item
        return (
          <button
            key={item.id}
            ref={el => { btnRefs.current[i] = el }}
            onClick={() => ir(item.path)}
            className="nav-item"
            aria-current={active ? 'page' : undefined}
          >
            <div className="nav-icon-stack">
              <div className="nav-icon-base"><Icon /></div>
              <div
                data-icon-fill=""
                className="nav-icon-fill"
                style={{ clipPath: active ? 'inset(0 0% 0 0%)' : 'inset(0 0 0 100%)' }}
              >
                <Icon />
              </div>
            </div>
            <span data-label="" className="nav-label" style={{ color: active ? COLOR_ACTIVO : COLOR_INACTIVO }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
