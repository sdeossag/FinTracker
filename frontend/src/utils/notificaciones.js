const STORAGE_KEY = 'ft_notif_enabled'
const ICON = '/pwa-192x192.png'

export const notifSoportadas = () => 'Notification' in window

export const notifHabilitadas = () =>
  notifSoportadas() &&
  Notification.permission === 'granted' &&
  localStorage.getItem(STORAGE_KEY) === 'true'

export const estadoPermiso = () => {
  if (!notifSoportadas()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export const pedirPermiso = async () => {
  if (!notifSoportadas()) return 'unsupported'
  const result = await Notification.requestPermission()
  if (result === 'granted') localStorage.setItem(STORAGE_KEY, 'true')
  return result
}

export const activarNotif  = () => localStorage.setItem(STORAGE_KEY, 'true')
export const desactivarNotif = () => localStorage.removeItem(STORAGE_KEY)

export const mostrarNotif = async (titulo, body, opciones = {}) => {
  if (!notifHabilitadas()) return
  try {
    if ('serviceWorker' in navigator) {
      const sw = await navigator.serviceWorker.ready
      await sw.showNotification(titulo, { body, icon: ICON, ...opciones })
    } else {
      new Notification(titulo, { body, icon: ICON, ...opciones })
    }
  } catch {
    // silencioso si el SW no está listo
  }
}
