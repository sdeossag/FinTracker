// Formateadores compartidos — una sola instancia de Intl por formato

const fmtCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
})
const fmtMiles = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

export const formatCOP = (n) => fmtCOP.format(Number(n) || 0)

export const formatMiles = (n) => fmtMiles.format(Number(n) || 0)

// 1.2M, 450K — para ejes y valores compactos
export const formatCorto = (n) => {
  const v = Math.abs(Number(n) || 0)
  const signo = n < 0 ? '-' : ''
  if (v >= 1_000_000) return `${signo}$${parseFloat((v / 1_000_000).toFixed(1))}M`
  if (v >= 1_000) return `${signo}$${Math.round(v / 1_000)}K`
  return `${signo}$${v}`
}

// Fecha local YYYY-MM-DD. toISOString() usa UTC: en Colombia (UTC-5)
// después de las 7 p. m. devolvía la fecha de mañana.
export const fechaLocalISO = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

export const capitalizar = (s = '') => s.charAt(0).toUpperCase() + s.slice(1)

// Solo dígitos (y un "-" inicial opcional) a partir de lo que el usuario escribió
export const limpiarMonto = (texto, permitirNegativo = false) => {
  const negativo = permitirNegativo && String(texto).includes('-')
  const digitos = String(texto).replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digitos) return negativo ? '-' : ''
  return (negativo ? '-' : '') + digitos
}

// Pequeño toque háptico donde el sistema lo soporta (Android). En iOS no hace nada.
export const vibrar = (ms = 10) => {
  try { navigator.vibrate?.(ms) } catch { /* sin soporte */ }
}
