// Qué versión de "Novedades" ya vio esta persona.
// Se guarda en el teléfono (respuesta inmediata) y en su perfil del servidor
// (una sola vez por cuenta, aunque se borre el almacenamiento o cambie de dispositivo).
// Al cambiar VERSION_NOVEDADES la hoja vuelve a abrirse una vez.
import api from '../api'

export const VERSION_NOVEDADES = '2026-09-cuotas'
const CLAVE = 'ft_novedades_vistas'

export const vistasEnEsteDispositivo = () => {
  try { return localStorage.getItem(CLAVE) === VERSION_NOVEDADES } catch { return false }
}

export const marcarNovedadesVistas = () => {
  try { localStorage.setItem(CLAVE, VERSION_NOVEDADES) } catch { /* sin almacenamiento */ }
  // Sin sesión (p. ej. justo al registrarse) basta con el teléfono
  if (localStorage.getItem('access_token')) {
    api.patch('/perfil/', { novedades_vistas: VERSION_NOVEDADES }).catch(() => {})
  }
}

// ¿Hay que mostrarlas? Pregunta al servidor solo si este teléfono no las marcó
export async function hayNovedades() {
  if (vistasEnEsteDispositivo()) return false
  try {
    const { data } = await api.get('/perfil/')
    if (data?.novedades_vistas === VERSION_NOVEDADES) {
      try { localStorage.setItem(CLAVE, VERSION_NOVEDADES) } catch { /* sin almacenamiento */ }
      return false
    }
  } catch { /* sin conexión: se decide con lo que sabe el teléfono */ }
  return true
}
