// Presupuesto semanal: datos y formato compartidos por Inicio y Presupuesto
import { useCallback, useEffect, useState } from 'react'
import api from '../api'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Verde mientras vas bien, amarillo desde el 80 %, rojo si te pasas
export const COLOR_ESTADO = { bien: 'var(--ingreso)', cerca: 'var(--ahorro)', pasado: 'var(--gasto)', sin_tope: 'var(--acento)' }

const fecha = (iso) => {
  const [, m, d] = iso.split('-').map(Number)
  return { dia: d, mes: MESES[m - 1] }
}

export function rangoSemana(datos) {
  const a = fecha(datos.inicio)
  const b = fecha(datos.fin)
  return a.mes === b.mes ? `${a.dia} – ${b.dia} ${b.mes}` : `${a.dia} ${a.mes} – ${b.dia} ${b.mes}`
}

// Estado de la semana con recarga, para Inicio y Presupuesto
export function useSemana() {
  const [datos, setDatos] = useState(null)
  const recargar = useCallback(() =>
    api.get('/semana/').then(r => { setDatos(r.data); return r.data }).catch(() => null), [])
  useEffect(() => {
    let vivo = true
    api.get('/semana/').then(r => { if (vivo) setDatos(r.data) }).catch(() => {})
    return () => { vivo = false }
  }, [])
  return { datos, setDatos, recargar }
}
