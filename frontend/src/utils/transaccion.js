// Reglas compartidas de las transacciones (tipos, colores, validación)

export const TIPOS_TRANSACCION = [
  { valor: 'gasto',   etiqueta: 'Gasto',   color: 'var(--gasto)' },
  { valor: 'ingreso', etiqueta: 'Ingreso', color: 'var(--ingreso)' },
  { valor: 'ahorro',  etiqueta: 'Ahorro',  color: 'var(--ahorro)', colorTexto: '#000' },
]

export const COLOR_TIPO = { gasto: 'var(--gasto)', ingreso: 'var(--ingreso)', ahorro: 'var(--ahorro)' }

// Devuelve { campo: mensaje } — vacío si todo está bien
export function validarTransaccion(f) {
  const e = {}
  if (!(parseInt(f.monto) > 0)) e.monto = 'Escribe un monto mayor a 0.'
  if (!f.nombre.trim()) e.nombre = 'Agrega una descripción.'
  if ((f.tipo === 'gasto' || f.tipo === 'ahorro') && !f.cuenta_origen) e.cuenta_origen = 'Elige de qué cuenta sale.'
  if ((f.tipo === 'ingreso' || f.tipo === 'ahorro') && !f.cuenta_destino) e.cuenta_destino = 'Elige a qué cuenta entra.'
  if (f.tipo === 'ahorro' && f.cuenta_origen && f.cuenta_origen === f.cuenta_destino) {
    e.cuenta_destino = 'La cuenta destino debe ser distinta a la de origen.'
  }
  return e
}

// Cambiar de tipo conserva lo escrito; solo reinicia lo que depende del tipo
export const conTipo = (f, tipo) => ({ ...f, tipo, cuenta_origen: '', cuenta_destino: '', categorias: [] })
