import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api, { ensureArray } from '../api'
import Pagina from '../componentes/Pagina'
import Icono from '../componentes/Icono'
import TransaccionForm from '../componentes/TransaccionForm'
import { validarTransaccion } from '../utils/transaccion'
import { AvisoError, EstadoVacio } from '../componentes/Controles'
import { ConfirmarSheet } from '../componentes/Sheet'
import { vibrar } from '../utils/formato'

export default function EditarTransaccion() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [form, setForm] = useState(null)
  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [errores, setErrores] = useState({})
  const [errorServidor, setErrorServidor] = useState('')

  useEffect(() => {
    const cargar = async () => {
      try {
        const [resT, resCuentas, resCat] = await Promise.all([
          api.get(`/transacciones/${id}/`),
          api.get('/cuentas/'),
          api.get('/categorias/'),
        ])
        const t = resT.data
        setForm({
          nombre: t.nombre,
          monto: String(t.monto),
          tipo: t.tipo,
          fecha: t.fecha,
          cuenta_origen: t.cuenta_origen ? String(t.cuenta_origen) : '',
          cuenta_destino: t.cuenta_destino ? String(t.cuenta_destino) : '',
          categorias: (t.categorias || []).map(c => c.id),
          notas: t.notas || '',
        })
        setCuentas(ensureArray(resCuentas.data))
        setCategorias(ensureArray(resCat.data))
      } catch (err) {
        console.error('Error cargando transacción:', err)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  const cambiar = (parcial) => {
    setForm(f => ({ ...f, ...parcial }))
    setErrores(e => {
      if ('tipo' in parcial) return {}
      const sig = { ...e }
      Object.keys(parcial).forEach(k => delete sig[k])
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
      await api.patch(`/transacciones/${id}/`, {
        nombre: form.nombre,
        monto: parseInt(form.monto),
        tipo: form.tipo,
        fecha: form.fecha,
        cuenta_origen: form.cuenta_origen || null,
        cuenta_destino: form.cuenta_destino || null,
        categorias_ids: form.categorias,
        notas: form.notas,
      })
      vibrar()
      toast.success('Cambios guardados')
      navigate('/transacciones')
    } catch (err) {
      console.error('Error guardando:', err)
      setErrorServidor('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    setEliminando(true)
    try {
      await api.delete(`/transacciones/${id}/`)
      setConfirmEliminar(false)
      toast.success('Transacción eliminada')
      navigate('/transacciones')
    } catch (err) {
      console.error('Error eliminando:', err)
      toast.error('No se pudo eliminar la transacción')
      setEliminando(false)
    }
  }

  const salir = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/transacciones')
  }
  const atras = { etiqueta: 'Historial', a: '/transacciones' }

  if (cargando) return (
    <Pagina titulo="Editar" atras={atras} sinNav>
      <div className="skeleton" style={{ height: 40, marginBottom: 32 }} />
      <div className="skeleton" style={{ height: 60, width: '60%', margin: '0 auto 36px' }} />
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 50, marginBottom: 18 }} />)}
    </Pagina>
  )

  if (!form) return (
    <Pagina titulo="Editar" atras={atras} sinNav>
      <EstadoVacio
        icono="alerta"
        titulo="No encontramos esta transacción"
        texto="Puede que se haya eliminado o que no haya conexión."
        accion={<button className="btn-primario" onClick={() => navigate('/transacciones')}>Ir al historial</button>}
      />
    </Pagina>
  )

  const barra = {
    titulo: 'Editar',
    modal: true,
    sinNav: true,
    izquierda: <button type="button" className="btn-barra" onClick={salir}>Cancelar</button>,
    acciones: (
      <button type="submit" form="form-transaccion" className="btn-barra fuerte" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    ),
  }

  return (
    <Pagina {...barra}>
      <form id="form-transaccion" onSubmit={e => { e.preventDefault(); guardar() }} noValidate>
        <TransaccionForm
          form={form}
          onCambio={cambiar}
          cuentas={cuentas}
          categorias={categorias}
          errores={errores}
        />

        <AvisoError>{errorServidor}</AvisoError>

        <button type="submit" className="btn-primario" disabled={guardando} style={{ marginTop: 28 }}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>

        {/* Acción destructiva aparte, al final, como en iOS */}
        <div className="lista-grupo" style={{ marginTop: 28 }}>
          <button type="button" className="fila" onClick={() => setConfirmEliminar(true)} style={{ justifyContent: 'center', minHeight: 50 }}>
            <span className="fila-titulo" style={{ color: 'var(--gasto)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icono nombre="basura" size={18} />
              Eliminar transacción
            </span>
          </button>
        </div>
      </form>

      <ConfirmarSheet
        abierto={confirmEliminar}
        onCerrar={() => setConfirmEliminar(false)}
        titulo="¿Eliminar transacción?"
        mensaje={`"${form.nombre}" se eliminará y los saldos de tus cuentas se recalcularán. Esta acción no se puede deshacer.`}
        textoConfirmar="Eliminar transacción"
        onConfirmar={eliminar}
        cargando={eliminando}
      />
    </Pagina>
  )
}
