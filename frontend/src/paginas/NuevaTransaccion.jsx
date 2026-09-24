// Pantalla de registro rápido de transacción — la más usada de la app
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import api, { ensureArray } from '../api'
import Pagina from '../componentes/Pagina'
import TransaccionForm from '../componentes/TransaccionForm'
import { TIPOS_TRANSACCION, validarTransaccion } from '../utils/transaccion'
import { AvisoError } from '../componentes/Controles'
import { ConfirmarSheet } from '../componentes/Sheet'
import { fechaLocalISO, formatCOP, vibrar } from '../utils/formato'

// Acepta datos precargados por la URL, p. ej. el botón "Pagar" de una tarjeta:
// /nueva?tipo=transferencia&destino=7&monto=180000&nombre=Pago%20Visa
const formInicial = (params) => {
  const tipo = params.get('tipo')
  const monto = params.get('monto')
  return {
    nombre: params.get('nombre') || '',
    monto: /^\d+$/.test(monto || '') ? monto : '',
    tipo: TIPOS_TRANSACCION.some(t => t.valor === tipo) ? tipo : 'gasto',
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(params.get('fecha') || '') ? params.get('fecha') : fechaLocalISO(),
    cuenta_origen: params.get('origen') || '',
    cuenta_destino: params.get('destino') || '',
    categorias: [],
    notas: '',
    cuotas: 1,
  }
}

// Solo se llena el campo que usa el tipo (un ahorro necesita dos cuentas distintas)
const cuentaUnica = (tipo, id) => ({
  cuenta_origen: tipo === 'ingreso' ? '' : id,
  cuenta_destino: tipo === 'ingreso' ? id : '',
})

export default function NuevaTransaccion() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState(() => formInicial(params))
  const precargado = params.has('tipo')
  // Desde la tarjeta o la bandeja de SMS: al guardar se vuelve allá
  const volverAtras = precargado || params.has('mensaje')
  const [cuentas, setCuentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [categorias, setCategorias] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState({})
  const [errorServidor, setErrorServidor] = useState('')
  const [confirmarSalida, setConfirmarSalida] = useState(false)

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
        // Pagando una deuda con una sola cuenta de dinero: esa es el origen
        const activos = ctas.filter(c => c.tipo === 'activo')
        setForm(f => (f.tipo === 'transferencia' && !f.cuenta_origen && activos.length === 1
          ? { ...f, cuenta_origen: String(activos[0].id) } : f))
      } catch (err) {
        console.error('Error cargando datos:', err)
      } finally {
        setCargando(false)
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
        cuotas: Number(form.cuotas) || 1,
        // Viene de la bandeja de SMS: al guardar, el mensaje queda resuelto
        ...(params.get('mensaje') ? { mensaje_banco: Number(params.get('mensaje')) } : {}),
      })
      vibrar()
      toast.success('Transacción registrada', { description: `${form.nombre.trim()} · ${formatCOP(form.monto)}` })
      // Desde el botón Pagar se vuelve a la tarjeta; si no, al historial
      if (volverAtras && window.history.state?.idx > 0) navigate(-1)
      else navigate('/transacciones')
    } catch (err) {
      console.error('Error guardando transacción:', err)
      setErrorServidor('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // Cancelar: si ya escribiste algo, se pregunta antes de perderlo
  const hayCambios = !!(form.monto || form.nombre.trim() || form.notas.trim() || form.categorias.length)
  const salir = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/')
  }
  const cancelar = () => (hayCambios && !precargado ? setConfirmarSalida(true) : salir())
  const TEXTO_GUARDAR = { transferencia: 'Registrar transferencia', ingreso: 'Registrar ingreso', ahorro: 'Registrar ahorro' }

  return (
    <Pagina
      titulo="Nueva transacción"
      modal
      sinNav
      izquierda={<button type="button" className="btn-barra" onClick={cancelar}>Cancelar</button>}
      acciones={
        <button type="submit" form="form-transaccion" className="btn-barra fuerte" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      }
    >
      <form id="form-transaccion" onSubmit={e => { e.preventDefault(); guardar() }} noValidate>
        <TransaccionForm
          form={form}
          onCambio={cambiar}
          cuentas={cuentas}
          categorias={categorias}
          errores={errores}
          autoFocusMonto={!precargado}
          cargando={cargando}
        />

        <AvisoError>{errorServidor}</AvisoError>

        {/* Al final del formulario, no fijo: en iPhone un botón pegado abajo salta con el teclado */}
        <button type="submit" className="btn-primario" disabled={guardando} style={{ marginTop: 28 }}>
          {guardando ? 'Guardando…' : TEXTO_GUARDAR[form.tipo] || 'Registrar gasto'}
        </button>
      </form>

      <ConfirmarSheet
        abierto={confirmarSalida}
        onCerrar={() => setConfirmarSalida(false)}
        titulo="¿Descartar esta transacción?"
        mensaje="Lo que escribiste no se guardará."
        textoConfirmar="Descartar"
        onConfirmar={() => { setConfirmarSalida(false); salir() }}
      />
    </Pagina>
  )
}
