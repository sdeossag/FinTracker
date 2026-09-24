// El documento nunca hace scroll: lo hace <main id="scroller"> dentro de un
// contenedor fijo a los cuatro bordes. En iPhone, el scroll del documento (con su
// rebote y el teclado) descuadraba la barra de pestañas fija; así queda anclada.
export const contenedorScroll = () => document.getElementById('scroller')

export const scrollActual = () => contenedorScroll()?.scrollTop ?? window.scrollY

export const irArriba = () => {
  const el = contenedorScroll()
  if (el) el.scrollTop = 0
  else window.scrollTo(0, 0)
}

// Bloquea el scroll del fondo mientras hay una hoja abierta
export const bloquearScroll = (bloquear) => {
  const el = contenedorScroll() || document.documentElement
  el.style.overflow = bloquear ? 'hidden' : ''
}
