// Notificaciones.
// — Push (Web Push): llegan con la app cerrada. El backend avisa cortes y pagos de
//   tarjetas una vez al día. En iPhone solo funcionan con la app en la pantalla de
//   inicio (iOS 16.4 o más nuevo).
// — Locales (mostrarNotif): avisos mientras la app está abierta.
import { useCallback, useEffect, useState } from 'react'
import api from '../api'

const STORAGE_KEY = 'ft_notif_enabled'
const ICON = '/pwa-192x192.png'

export const notifSoportadas = () => 'Notification' in window

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const instalada = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export const pushSoportado = () =>
  'serviceWorker' in navigator && 'PushManager' in window && notifSoportadas()

export const notifHabilitadas = () =>
  notifSoportadas() &&
  Notification.permission === 'granted' &&
  localStorage.getItem(STORAGE_KEY) === 'true'

// VAPID viene en base64url; el navegador la quiere en bytes
function llaveEnBytes(base64) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, c => c.charCodeAt(0))
}

async function suscripcionActual() {
  const sw = await navigator.serviceWorker.ready
  return sw.pushManager.getSubscription()
}

/**
 * 'instalar'    → iPhone en Safari: hay que agregarla a la pantalla de inicio primero
 * 'no-soportado'→ este navegador no tiene push
 * 'bloqueadas'  → el permiso se negó; solo se cambia en Ajustes
 * 'activas' | 'apagadas'
 */
export async function estadoNotificaciones() {
  if (esIOS() && !instalada()) return 'instalar'
  if (!pushSoportado()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueadas'
  if (Notification.permission !== 'granted') return 'apagadas'
  try {
    return (await suscripcionActual()) && localStorage.getItem(STORAGE_KEY) === 'true' ? 'activas' : 'apagadas'
  } catch {
    return 'apagadas'
  }
}

export async function activarNotificaciones() {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueadas' : 'apagadas'

  const { data } = await api.get('/push/')
  if (!data?.clave_publica) throw new Error('El servidor no tiene notificaciones configuradas.')

  const sw = await navigator.serviceWorker.ready
  let sub = await sw.pushManager.getSubscription()
  if (!sub) {
    sub = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: llaveEnBytes(data.clave_publica),
    })
  }
  await api.post('/push/', sub.toJSON())
  localStorage.setItem(STORAGE_KEY, 'true')
  return 'activas'
}

export async function desactivarNotificaciones() {
  localStorage.removeItem(STORAGE_KEY)
  try {
    const sub = await suscripcionActual()
    if (sub) {
      await api.delete('/push/', { data: { endpoint: sub.endpoint } }).catch(() => {})
      await sub.unsubscribe()
    }
  } catch { /* sin service worker: ya no hay nada que apagar */ }
  return 'apagadas'
}

export const probarNotificacion = () => api.post('/push/probar/')

// Estado + acciones, para usar en cualquier pantalla
export function useNotificaciones() {
  const [estado, setEstado] = useState('cargando')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    estadoNotificaciones().then(e => vivo && setEstado(e))
    return () => { vivo = false }
  }, [])

  const cambiar = useCallback(async (activar) => {
    setOcupado(true)
    try {
      const nuevo = activar ? await activarNotificaciones() : await desactivarNotificaciones()
      setEstado(nuevo)
      return nuevo
    } finally {
      setOcupado(false)
    }
  }, [])

  return { estado, ocupado, cambiar }
}

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
