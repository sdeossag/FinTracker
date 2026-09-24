// Reglas compartidas de cuentas: qué es deuda y cómo se lee el estado de una tarjeta
import { capitalizar } from './formato'

export const TIPOS_CUENTA = [
  { valor: 'activo',  etiqueta: 'Cuenta' },
  { valor: 'credito', etiqueta: 'Tarjeta' },
  { valor: 'pasivo',  etiqueta: 'Deuda' },
]

export const AYUDA_TIPO_CUENTA = {
  activo:  'Plata que tienes: Nequi, efectivo, cuenta de ahorros.',
  credito: 'Tarjeta de crédito: lo que compras con ella suma a lo que debes.',
  pasivo:  'Otra deuda: un préstamo, un crédito de libre inversión.',
}

export const esDeuda = (tipo) => tipo === 'pasivo' || tipo === 'credito'

// Patrimonio: lo que tienes menos lo que debes
export const patrimonio = (cuentas) =>
  cuentas.reduce((acc, c) => esDeuda(c.tipo) ? acc - c.balance_actual : acc + c.balance_actual, 0)

const aFecha = (iso) => new Date(iso + 'T00:00:00')

// "30 sep" / "jueves 30 sep"
export const fechaCorta = (iso, conDia = false) => aFecha(iso).toLocaleDateString('es-CO', {
  ...(conDia ? { weekday: 'long' } : {}), day: 'numeric', month: 'short',
}).replace('.', '')

// "hoy", "mañana", "en 6 días", "hace 3 días"
export function plazo(dias) {
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias > 1) return `en ${dias} días`
  if (dias === -1) return 'ayer'
  return `hace ${-dias} días`
}

// Resumen de una línea para listas: qué hacer con la tarjeta y cuándo
export function resumenTarjeta(estado) {
  if (!estado) return { texto: 'Tarjeta de crédito', tono: 'neutro' }
  if (estado.situacion === 'vencida') {
    return { texto: `Pago vencido ${plazo(estado.dias_para_pagar)}`, tono: 'peligro' }
  }
  if (estado.situacion === 'pendiente') {
    return {
      texto: `Paga antes del ${fechaCorta(estado.fecha_limite)}`,
      tono: estado.dias_para_pagar <= 3 ? 'alerta' : 'neutro',
    }
  }
  return { texto: `Al día · corte el ${fechaCorta(estado.proximo_corte)}`, tono: 'ok' }
}

export const COLOR_TONO = {
  peligro: 'var(--gasto)',
  alerta: 'var(--ahorro)',
  ok: 'var(--ingreso)',
  neutro: 'var(--texto-secundario)',
}

// Tarjetas que piden atención en Inicio: vencidas o con pago en los próximos 5 días
export const tarjetasPorPagar = (cuentas) => cuentas
  .filter(c => c.estado_tarjeta && c.estado_tarjeta.por_pagar > 0
    && (c.estado_tarjeta.situacion === 'vencida' || c.estado_tarjeta.dias_para_pagar <= 5))
  .sort((a, b) => a.estado_tarjeta.dias_para_pagar - b.estado_tarjeta.dias_para_pagar)

// Ruta de "Nueva transacción" con el pago de la tarjeta ya llenado
export const rutaPagarTarjeta = (tarjeta, monto) => {
  const p = new URLSearchParams({ tipo: 'transferencia', destino: String(tarjeta.id), nombre: `Pago ${tarjeta.nombre}` })
  if (monto > 0) p.set('monto', String(monto))
  return `/nueva?${p}`
}

export const tituloFecha = (iso) => capitalizar(fechaCorta(iso, true))
