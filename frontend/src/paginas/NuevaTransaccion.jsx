// Pantalla de registro rápido de transacción — la más usada de la app
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api, { ensureArray } from '../api'
import Pagina from '../componentes/Pagina'
import TransaccionForm from '../componentes/TransaccionForm'
import { validarTransaccion } from '../utils/transaccion'
import { AvisoError } from '../componentes/Controles'
import { fechaLocalISO, formatCOP, vibrar } from '../utils/formato'

const formVacio = () => ({
  nombre: '',
  monto: '',
  tipo: 'gasto',
  fecha: fechaLocalISO(),
  cuenta_origen: '',
  cuenta_destino: '',
  categorias: [],
  notas: '',
})

// Solo se llena el campo que usa el tipo (un ahorro necesita dos cuentas distintas)
const cuentaUnica = (tipo, id) => ({
  cuenta_origen: tipo === 'ingreso' ? '' : id,
  cuenta_destino: tipo === 'ingreso' ? id : '',
})

export default function NuevaTransaccion() {
  const navigate = useNavigate()
  const [form, setForm] = useState(formVacio)
  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})
  const [errorServidor, setErrorServidor] = useState('')

  useEffect(() => {
    const cargar = async () => {
      try {
        const [resCuentas, resCat] = await Promise.all([
          api.get('/cuentas/'),
          api.get('/categorias/'),
        ])
        const ctas = ensureArray(resCuentas.data)
        setCuentas(ctas)
        setCategorias(ensureArray(resCat.data))
        // Con una sola cuenta, ya está elegida
        if (ctas.length === 1) setForm(f => ({ ...f, ...cuentaUnica(f.tipo, String(ctas[0].id)) }))
      } catch (err) {
        console.error('Error cargando datos:', err)
      }
    }
    cargar()
  }, [])

  // Al editar un campo, su error desaparece (validación en línea)
  const cambiar = (parcial) => {
    if ('tipo' in parcial && cuentas.length === 1) {
      parcial = { ...parcial, ...cuentaUnica(parcial.tipo, String(cuentas[0].id)) }
    }
    setForm(f => ({ ...f, ...parcial }))
    setErrores(e => {
      const sig = { ...e }
      Object.keys(parcial).forEach(k => delete sig[k])
      if ('tipo' in parcial) return {}
      return sig
    })
  }

  const guardar = async () => {
    const e = validarTransaccion(form)
    setErrores(e)
    if (Object.keys(e).length) {
      document.getElementById(Object.keys(e)[0])?.focus()
      return
    }
    setErrorServidor('')
    setGuardando(true)
    try {
      await api.post('/transacciones/', {
        ...form,
        monto: parseInt(form.monto),
        cuenta_origen: form.cuenta_origen || null,
        cuenta_destino: form.cuenta_destino || null,
        categorias_ids: form.categorias,
      })
      vibrar()
      toast.success('Transacción registrada', { description: `${form.nombre.trim()} · ${formatCOP(form.monto)}` })
      navigate('/transacciones')
    } catch (err) {
      console.error('Error guardando transacción:', err)
      setErrorServidor('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Pagina titulo="Nueva transacción" atras={{ etiqueta: 'Atrás', a: '/' }} sinNav>
      <form onSubmit={e => { e.preventDefault(); guardar() }} noValidate>
        <TransaccionForm
          form={form}
          onCambio={cambiar}
          cuentas={cuentas}
          categorias={categorias}
          errores={errores}
          autoFocusMonto
        />

        <AvisoError>{errorServidor}</AvisoError>

        <div className="barra-accion">
          <button type="submit" className="btn-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Registrar transacción'}
          </button>
        </div>
      </form>
    </Pagina>
  )
}
