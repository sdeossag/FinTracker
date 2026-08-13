import axios from 'axios'

// En producción usa VITE_API_URL; en dev usa el proxy de Vite
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

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

// Interceptor de respuestas: Maneja la expiración del token (401)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refresh = getRefreshToken()
        if (!refresh) throw new Error('No refresh token')

        const res = await axios.post('/api/token/refresh/', { refresh })
        const { access } = res.data
        setTokens(access, refresh)

        originalRequest.headers.Authorization = `Bearer ${access}`
        return api(originalRequest)
      } catch (refreshError) {
        clearTokens()
        window.location.href = '/login'
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