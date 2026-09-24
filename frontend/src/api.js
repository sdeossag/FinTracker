import axios from 'axios'

// En producción usa VITE_API_URL; en dev usa el proxy de Vite
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Para compartir fuera de la app (p. ej. el atajo del iPhone): siempre con dominio
export const API_URL_ABSOLUTA = new URL(BASE_URL, window.location.origin).href.replace(/\/$/, '')

const api = axios.create({
  baseURL: BASE_URL,
})

// Gestión de tokens
export const setTokens = (access, refresh) => {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

export const getAccessToken = () => localStorage.getItem('access_token')
export const getRefreshToken = () => localStorage.getItem('refresh_token')

export const clearTokens = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export const logout = () => {
  clearTokens()
  window.location.href = '/login'
}

// Interceptor de peticiones: Añade el token Bearer automáticamente
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Renovación del token de acceso.
// — Va al backend real (BASE_URL): en producción el frontend está en otro dominio y
//   la ruta relativa '/api/...' fallaba, cerrando la sesión cada vez que vencía el token.
// — Una sola renovación a la vez: si vencen varias peticiones juntas, todas esperan la misma.
let renovando = null

function renovarAcceso() {
  if (!renovando) {
    const refresh = getRefreshToken()
    renovando = (refresh
      ? axios.post(`${BASE_URL}/token/refresh/`, { refresh })
      : Promise.reject(Object.assign(new Error('Sin token de renovación'), { sinSesion: true }))
    )
      .then(({ data }) => {
        // Con rotación activada el backend entrega también un refresh nuevo
        setTokens(data.access, data.refresh || refresh)
        return data.access
      })
      .finally(() => { renovando = null })
  }
  return renovando
}

// Solo se cierra la sesión si el servidor la rechaza, no por quedarse sin señal
const sesionRechazada = (err) => err.sinSesion || [400, 401].includes(err.response?.status)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const access = await renovarAcceso()
        originalRequest.headers.Authorization = `Bearer ${access}`
        return api(originalRequest)
      } catch (refreshError) {
        if (sesionRechazada(refreshError)) {
          clearTokens()
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

// WebAuthn API helpers
export const webauthnApi = {
  getRegisterOptions: () => api.get('/webauthn/register-options/'),
  verifyRegister: (data) => api.post('/webauthn/register-verify/', data),
  getAuthOptions: (username) => api.get(`/webauthn/auth-options/?username=${username}`),
  verifyAuth: (data) => api.post('/webauthn/auth-verify/', data),
  getCredentials: () => api.get('/webauthn/credentials/'),
  updateCredential: (id, data) => api.patch(`/webauthn/credentials/${id}/`, data),
  deleteCredential: (id) => api.delete(`/webauthn/credentials/${id}/`),
}

export const recurrentesApi = {
  ejecutar: () => api.post('/recurrentes/ejecutar/'),
}

export const ensureArray = (data) => {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && Array.isArray(data.results)) return data.results
  return []
}

export const ensureObject = (data) => {
  if (data && typeof data === 'object' && !Array.isArray(data)) return data
  return {}
}

export default api