// Reglas de usuario y contraseña: las mismas que valida el backend (core/seguridad.py)

export const REQUISITOS_PASSWORD = [
  { id: 'largo', texto: '8 caracteres o más', cumple: p => p.length >= 8 },
  { id: 'mayus', texto: 'Una mayúscula', cumple: p => /[A-ZÁÉÍÓÚÑ]/.test(p) },
  { id: 'numero', texto: 'Un número', cumple: p => /\d/.test(p) },
  { id: 'simbolo', texto: 'Un símbolo, como ! ? # *', cumple: p => /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(p) },
]

export const passwordValida = (p, usuario = '') =>
  REQUISITOS_PASSWORD.every(r => r.cumple(p)) && !(usuario && p.toLowerCase().includes(usuario.toLowerCase()))

// El usuario se escribe siempre en minúsculas y sin espacios
export const normalizarUsuario = (u) => u.toLowerCase().replace(/\s+/g, '')

export function errorUsuario(u) {
  if (!u) return ''
  if (u.length < 3 || u.length > 30) return 'Entre 3 y 30 caracteres.'
  if (!/^[a-z0-9._]+$/.test(u)) return 'Solo letras sin tildes, números, punto y guion bajo.'
  if (/^[.]|[.]$/.test(u) || u.includes('..')) return 'No puede empezar ni terminar en punto, ni tener dos seguidos.'
  return ''
}

export const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
