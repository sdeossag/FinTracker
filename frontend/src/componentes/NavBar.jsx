import { useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './NavBar.css'

const ACCENT     = '#0A84FF'
const ACCENT_RGB = '10,132,255'
const INFLUENCE  = 110
const MAX_SCALE  = 1.14
const PILL_W     = 64

/* ── Iconos ─────────────────────────────────────────── */
const IconoInicio = ({ filled }) => filled
  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>

const IconoHistorial = ({ filled }) => filled
  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="2.5" rx="1.25" fill="currentColor"/><rect x="3" y="10.75" width="18" height="2.5" rx="1.25" fill="currentColor"/><rect x="3" y="16.5" width="12" height="2.5" rx="1.25" fill="currentColor"/></svg>
  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 6H20M4 12H20M4 18H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>

const IconoCuentas = ({ filled }) => filled
  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" opacity="0.2"/><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="2"/><rect x="2" y="9.5" width="20" height="2.5" fill="currentColor"/><circle cx="7" cy="15" r="1.8" fill="currentColor"/></svg>
  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M2 10H22" stroke="currentColor" strokeWidth="1.8"/><circle cx="7" cy="15" r="1.5" fill="currentColor"/></svg>

const IconoGraficas = ({ filled }) => filled
  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 19L8.5 12.5L12.5 16.5L17 9L21 12" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 19L8.5 12.5L12.5 16.5L17 9L21 12V20H3Z" fill="currentColor" opacity="0.18"/>
    </svg>
  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 19L8.5 12.5L12.5 16.5L17 9L21 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>

const IconoMas = () => (
  <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
    <path d="M11 4V18M4 11H18" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
  </svg>
)

/* ── Items ──────────────────────────────────────────── */
const ITEMS = [
  { id: 'inicio',    path: '/',              label: 'Inicio',    Icon: IconoInicio },
  { id: 'historial', path: '/transacciones', label: 'Historial', Icon: IconoHistorial },
  { id: 'nueva',     path: '/nueva',         label: 'Nueva',     isFab: true },
  { id: 'cuentas',   path: '/cuentas',       label: 'Cuentas',   Icon: IconoCuentas },
  { id: 'graficas',  path: '/graficas',      label: 'Gráficas',  Icon: IconoGraficas },
]

/* ── Componente ─────────────────────────────────────── */
export default function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()

  const navRef   = useRef(null)
  const btnRefs  = useRef([])
  const pillRef  = useRef(null)
  const animRef  = useRef(null)
  const restAnimRef = useRef(null)
  const pillX    = useRef(0)
  const targetX  = useRef(0)
  const isDragging = useRef(false)

  function isActive(item) {
    if (item.path === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  }

  function lerp(a, b, t) { return a + (b - a) * t }

  function getBtnCenterX(i) {
    const nav = navRef.current
    const btn = btnRefs.current[i]
    if (!nav || !btn) return 0
    const navRect = nav.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    return btnRect.left - navRect.left + btnRect.width / 2
  }

  function getActiveCenterX() {
    const idx = ITEMS.findIndex(item => !item.isFab && isActive(item))
    return idx >= 0 ? getBtnCenterX(idx) : null
  }

  // Mueve la píldora al tab activo en modo reposo (sombra neutral)
  function colocarEnReposo(cx) {
    if (!pillRef.current || cx === null) return
    pillX.current   = cx
    targetX.current = cx
    pillRef.current.style.left = (cx - PILL_W / 2) + 'px'
    pillRef.current.classList.remove('pill-drag')
    pillRef.current.classList.add('pill-rest')
    pillRef.current.style.opacity = '1'
  }

  // Al cambiar de ruta, reposiciona la píldora en el nuevo tab activo
  useEffect(() => {
    if (isDragging.current) return
    // rAF asegura que el DOM ya renderizó la nueva ruta
    const raf = requestAnimationFrame(() => {
      const cx = getActiveCenterX()
      if (cx !== null) colocarEnReposo(cx)
    })
    return () => cancelAnimationFrame(raf)
  }, [location.pathname])

  /* ── clipPath reveal ─────────────────────────────── */
  function clipForRect(rect, navRect) {
    const left      = rect.left - navRect.left
    const right     = left + rect.width
    const pillLeft  = pillX.current - PILL_W / 2
    const pillRight = pillLeft + PILL_W
    const overlapL  = Math.max(pillLeft, left)
    const overlapR  = Math.min(pillRight, right)
    if (overlapR <= overlapL) return { fromLeft: 100, fromRight: 0 }
    const w = rect.width
    return {
      fromLeft:  +((overlapL - left) / w * 100).toFixed(2),
      fromRight: +((right - overlapR) / w * 100).toFixed(2),
    }
  }

  function updateReveal() {
    const nav = navRef.current
    if (!nav) return
    const navRect = nav.getBoundingClientRect()
    ITEMS.forEach((item, i) => {
      if (item.isFab) return
      const btn = btnRefs.current[i]
      if (!btn) return
      const iconFill = btn.querySelector('[data-icon-fill]')
      const labelEl  = btn.querySelector('[data-label]')
      if (iconFill) {
        const c = clipForRect(iconFill.getBoundingClientRect(), navRect)
        iconFill.style.clipPath = `inset(0 ${c.fromRight}% 0 ${c.fromLeft}%)`
      }
      if (labelEl) {
        // El label cambia de color completo (sin split) según superposición
        const c = clipForRect(labelEl.getBoundingClientRect(), navRect)
        const overlap = 1 - (c.fromLeft + c.fromRight) / 100
        labelEl.style.color = overlap > 0.35 ? '#0A84FF' : 'rgba(255,255,255,0.38)'
      }
    })
  }

  /* ── Animación lerp de la píldora ────────────────── */
  function animatePill() {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(() => {
      pillX.current = lerp(pillX.current, targetX.current, 0.22)
      if (pillRef.current) pillRef.current.style.left = (pillX.current - PILL_W / 2) + 'px'
      updateReveal()
      if (Math.abs(pillX.current - targetX.current) > 0.3) animatePill()
    })
  }

  /* ── Animación de regreso al tab activo ─────────── */
  function animarAReposo(cx) {
    if (restAnimRef.current) cancelAnimationFrame(restAnimRef.current)
    targetX.current = cx
    const step = () => {
      pillX.current = lerp(pillX.current, targetX.current, 0.18)
      if (pillRef.current) pillRef.current.style.left = (pillX.current - PILL_W / 2) + 'px'
      if (Math.abs(pillX.current - targetX.current) > 0.4) {
        restAnimRef.current = requestAnimationFrame(step)
      } else {
        colocarEnReposo(cx)
      }
    }
    restAnimRef.current = requestAnimationFrame(step)
  }

  /* ── Mientras se arrastra ────────────────────────── */
  function updateTabBar(mouseX, mouseY) {
    const nav = navRef.current
    if (!nav) return
    isDragging.current = true
    if (restAnimRef.current) cancelAnimationFrame(restAnimRef.current)

    // Activar modo drag en la píldora
    if (pillRef.current) {
      pillRef.current.classList.remove('pill-rest')
      pillRef.current.classList.add('pill-drag')
      pillRef.current.style.opacity = '1'
    }

    const navRect = nav.getBoundingClientRect()
    const localX  = mouseX - navRect.left
    const localY  = mouseY - navRect.top

    const eases = ITEMS.map((_, i) => {
      const cx   = getBtnCenterX(i)
      const cy   = navRect.height / 2
      const dist = Math.sqrt((localX - cx) ** 2 + (localY - cy) ** 2)
      const t    = Math.max(0, 1 - dist / INFLUENCE)
      return t * t * (3 - 2 * t)
    })

    // Posición ponderada de la píldora (solo tabs, no FAB)
    let totalEase = 0, weightedX = 0
    ITEMS.forEach((item, i) => {
      if (item.isFab) return
      const e = eases[i]
      if (e > 0) { totalEase += e; weightedX += getBtnCenterX(i) * e }
    })

    // Efecto dock — magnification
    ITEMS.forEach((item, i) => {
      const btn = btnRefs.current[i]
      if (!btn) return
      const e     = eases[i]
      const scale = 1 + (MAX_SCALE - 1) * e
      btn.style.transform = `scale(${scale.toFixed(3)}) translateY(${(-e * 2).toFixed(2)}px)`
      if (item.isFab) {
        const fabEl  = btn.querySelector('[data-fab]')
        const labFab = btn.querySelector('[data-label-fab]')
        if (fabEl)  fabEl.style.boxShadow = `0 ${(3 + e * 4).toFixed(1)}px ${(12 + e * 10).toFixed(1)}px rgba(${ACCENT_RGB},${(0.38 + e * 0.28).toFixed(2)})`
        if (labFab) labFab.style.color    = `rgba(255,255,255,${(0.4 + 0.45 * e).toFixed(2)})`
      }
    })

    if (totalEase > 0) {
      targetX.current = weightedX / totalEase
      animatePill()
    }
  }

  /* ── Al soltar ───────────────────────────────────── */
  function resetTabBar(destinoPath) {
    isDragging.current = false
    if (animRef.current) cancelAnimationFrame(animRef.current)

    // Restaurar escalas
    ITEMS.forEach((item, i) => {
      const btn = btnRefs.current[i]
      if (!btn) return
      btn.style.transform = 'scale(1) translateY(0px)'
      if (item.isFab) {
        const fabEl  = btn.querySelector('[data-fab]')
        const labFab = btn.querySelector('[data-label-fab]')
        if (fabEl)  fabEl.style.boxShadow = `0 3px 12px rgba(${ACCENT_RGB},0.4)`
        if (labFab) labFab.style.color    = 'rgba(255,255,255,0.45)'
      }
    })

    // Restaurar clipPath del icono y color del label al estado base
    ITEMS.forEach((item, i) => {
      if (item.isFab) return
      const btn = btnRefs.current[i]
      if (!btn) return
      const activo   = destinoPath ? item.path === destinoPath || (item.path !== '/' && destinoPath.startsWith(item.path)) : isActive(item)
      const iconFill = btn.querySelector('[data-icon-fill]')
      const labelEl  = btn.querySelector('[data-label]')
      if (iconFill) iconFill.style.clipPath = activo ? 'inset(0 0% 0 0%)' : 'inset(0 100% 0 0)'
      if (labelEl)  labelEl.style.color     = activo ? '#0A84FF' : 'rgba(255,255,255,0.38)'
    })

    // Píldora vuelve al tab destino (o activo) en modo sombra
    const destIdx = destinoPath ? ITEMS.findIndex(item => !item.isFab && (item.path === destinoPath || (item.path !== '/' && destinoPath.startsWith(item.path)))) : -1
    const cx = destIdx >= 0 ? getBtnCenterX(destIdx) : getActiveCenterX()
    if (cx !== null) {
      if (pillRef.current) {
        pillRef.current.classList.remove('pill-drag')
        pillRef.current.classList.add('pill-rest')
      }
      animarAReposo(cx)
    }
  }

  /* ── Navegar al soltar el drag ───────────────────── */
  function handleTouchEnd(e) {
    if (!isDragging.current) return // tap simple → onClick lo maneja

    const t = e.changedTouches[0]

    // ¿Soltó sobre el FAB?
    const fabIdx = ITEMS.findIndex(item => item.isFab)
    if (fabIdx >= 0) {
      const fabBtn = btnRefs.current[fabIdx]
      if (fabBtn) {
        const r = fabBtn.getBoundingClientRect()
        if (t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom) {
          resetTabBar()
          navigate(ITEMS[fabIdx].path)
          return
        }
      }
    }

    // Tab más cercana a la posición actual de la píldora
    let closestIdx = -1, closestDist = Infinity
    ITEMS.forEach((item, i) => {
      if (item.isFab) return
      const dist = Math.abs(pillX.current - getBtnCenterX(i))
      if (dist < closestDist) { closestDist = dist; closestIdx = i }
    })

    const destino = closestIdx >= 0 ? ITEMS[closestIdx].path : null
    resetTabBar(destino)
    if (destino) navigate(destino)
  }

  /* ── Render ─────────────────────────────────────── */
  return (
    <nav
      ref={navRef}
      className="navbar"
      onMouseMove={e => updateTabBar(e.clientX, e.clientY)}
      onMouseLeave={resetTabBar}
      onTouchMove={e => { e.preventDefault(); const t = e.touches[0]; updateTabBar(t.clientX, t.clientY) }}
      onTouchEnd={handleTouchEnd}
    >
      {/* Píldora */}
      <div ref={pillRef} className="navbar-pill pill-rest" style={{ opacity: 0 }}>
        <div className="navbar-pill-fill" />
        <div className="navbar-pill-shine" />
      </div>

      {ITEMS.map((item, i) => {
        const active = !item.isFab && isActive(item)

        if (item.isFab) {
          return (
            <button
              key={item.id}
              ref={el => btnRefs.current[i] = el}
              onClick={() => navigate(item.path)}
              className="nav-fab-wrapper"
            >
              <div data-fab="" className="nav-fab"><IconoMas /></div>
              <span data-label-fab="" className="nav-fab-label">{item.label}</span>
            </button>
          )
        }

        const { Icon } = item
        return (
          <button
            key={item.id}
            ref={el => btnRefs.current[i] = el}
            onClick={() => navigate(item.path)}
            className="nav-item"
          >
            <div className="nav-icon-stack">
              {/* Base siempre visible en gris — el fill azul lo cubre cuando el clipPath lo revela */}
              <div className="nav-icon-base">
                <Icon filled={true} />
              </div>
              {/* Fill: mismo icono, mismo path → alineación pixel-perfect */}
              <div
                data-icon-fill=""
                className="nav-icon-fill"
                style={{ clipPath: active ? 'inset(0 0% 0 0%)' : 'inset(0 100% 0 0)' }}
              >
                <Icon filled={true} />
              </div>
            </div>
            {/* Un solo span — sin capas superpuestas, sin desalineación */}
            <span
              data-label=""
              className="nav-label"
              style={{ color: active ? '#0A84FF' : 'rgba(255,255,255,0.38)' }}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
