// Estructura común de pantalla: barra superior translúcida (aparece al hacer
// scroll, con el título compacto) + Large Title + contenido.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icono from './Icono'
import { contenedorScroll, scrollActual } from '../utils/scroll'

export default function Pagina({
  titulo,
  sobreTitulo,
  tituloCompacto, // false: sin título en la barra compacta (la barra ya tiene marca)
  atras,          // { etiqueta, a } — "a" es la ruta si no hay historial al que volver
  izquierda,      // nodo propio en lugar del botón atrás
  acciones,       // nodos a la derecha de la barra
  sinNav = false,
  modal = false,   // tarea enfocada (crear/editar): título siempre en la barra, sin Large Title
  children,
}) {
  const navigate = useNavigate()
  const barraRef = useRef(null)
  const tituloRef = useRef(null)
  const [compacta, setCompacta] = useState(false)
  // Algo ya pasa por detrás de la hora: esa franja se vuelve material aunque la barra no esté compacta
  const [bajoHora, setBajoHora] = useState(false)

  useEffect(() => {
    let raf = 0
    const medir = () => {
      raf = 0
      const barra = barraRef.current
      const t = tituloRef.current
      if (!barra) return
      const limite = barra.getBoundingClientRect().bottom
      setCompacta(t ? t.getBoundingClientRect().bottom < limite : scrollActual() > 4)
      setBajoHora(scrollActual() > 1)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(medir) }
    medir()
    const objetivo = contenedorScroll() || window
    objetivo.addEventListener('scroll', onScroll, { passive: true })
    return () => { objetivo.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  const volver = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate(atras?.a || '/')
  }

  return (
    <div className={`pagina${sinNav ? ' sin-nav' : ''}`}>
      <header className="barra" data-compacta={compacta} data-bajo-hora={bajoHora} data-modal={modal || undefined} ref={barraRef}>
        <span className="barra-estado" aria-hidden="true" />
        <div className="barra-lado">
          {izquierda ?? (atras && (
            <button type="button" className="btn-atras" onClick={volver}>
              <Icono nombre="chevron-left" size={24} grosor={2.2} />
              {atras.etiqueta || 'Atrás'}
            </button>
          ))}
        </div>
        <div className="barra-titulo" aria-hidden={!compacta}>{tituloCompacto === false ? null : (tituloCompacto || titulo)}</div>
        <div className="barra-lado der">{acciones}</div>
      </header>

      {titulo && !modal && (
        <div className="cabecera-pagina">
          {sobreTitulo && <p className="sobre-titulo">{sobreTitulo}</p>}
          <h1 ref={tituloRef} className="titulo-grande">{titulo}</h1>
        </div>
      )}

      {children}
    </div>
  )
}
