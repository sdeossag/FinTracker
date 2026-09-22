import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import api, { ensureArray } from '../api'
import Pagina from '../componentes/Pagina'
import Icono from '../componentes/Icono'
import Sheet, { ConfirmarSheet } from '../componentes/Sheet'
import { AvisoError, CampoMonto, EstadoVacio, Segmentado, SelectorColor } from '../componentes/Controles'
import { formatCOP } from '../utils/formato'

const COLORES = ['#34C759', '#0A84FF', '#BF5AF2', '#FF9F0A', '#FFD60A', '#FF453A', '#64D2FF', '#FF375F']
const cuentaVacia = { nombre: '', tipo: 'activo', balance_inicial: '', color_hex: '#0A84FF', _balance_actual_ref: 0, _balance_inicial_ref: 0 }

const TIPOS_CUENTA = [
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'pasivo', etiqueta: 'Pasivo' },
]

export default function Cuentas() {
  const [cuentas, setCuentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(cuentaVacia)
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [confirmAbierto, setConfirmAbierto] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const cargar = async () => {
    setErrorCarga('')
    try {
      const res = await api.get('/cuentas/')
      setCuentas(ensureArray(res.data))
    } catch {
      setErrorCarga('No se pudieron cargar las cuentas. Verifica tu conexión.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const abrirNueva = () => {
    setForm(cuentaVacia)
    setEditandoId(null)
    setErrorForm('')
    setModalAbierto(true)
  }

  const abrirEditar = (cuenta) => {
    setForm({
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      balance_inicial: String(cuenta.balance_inicial),
      color_hex: cuenta.color_hex,
      _balance_actual_ref: cuenta.balance_actual,
      _balance_inicial_ref: cuenta.balance_inicial,
      _balance_actual_editable: String(cuenta.balance_actual),
    })
    setEditandoId(cuenta.id)
    setErrorForm('')
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setErrorForm('')
  }

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setErrorForm('El nombre de la cuenta es obligatorio.')
      return
    }
    let balanceInicialFinal
    if (editandoId) {
      const balanceActualDeseado = parseInt(form._balance_actual_editable || '0')
      if (isNaN(balanceActualDeseado)) {
        setErrorForm('El balance actual debe ser un número.')
        return
      }
      // Recalcula balance_inicial para que balance_actual sea el valor deseado
      const delta = form._balance_actual_ref - form._balance_inicial_ref
      balanceInicialFinal = balanceActualDeseado - delta
    } else {
      balanceInicialFinal = parseInt(form.balance_inicial || '0')
      if (isNaN(balanceInicialFinal)) {
        setErrorForm('El balance inicial debe ser un número.')
        return
      }
    }

    setErrorForm('')
    setGuardando(true)
    try {
      const datos = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        balance_inicial: balanceInicialFinal,
        color_hex: form.color_hex,
      }
      if (editandoId) {
        await api.patch(`/cuentas/${editandoId}/`, datos)
      } else {
        await api.post('/cuentas/', datos)
      }
      await cargar()
      cerrarModal()
      toast.success(editandoId ? 'Cuenta actualizada' : 'Cuenta creada', { description: datos.nombre })
    } catch (err) {
      const detail = err.response?.data
      if (detail?.nombre) {
        setErrorForm(`Nombre: ${detail.nombre[0]}`)
      } else if (detail?.non_field_errors) {
        setErrorForm(detail.non_field_errors[0])
      } else if (detail?.detail) {
        setErrorForm(detail.detail)
      } else {
        setErrorForm('Error al guardar. Revisa que el nombre no esté repetido.')
      }
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!editandoId) return
    setEliminando(true)
    try {
      await api.delete(`/cuentas/${editandoId}/`)
      setConfirmAbierto(false)
      cerrarModal()
      await cargar()
      toast.success('Cuenta eliminada')
    } catch {
      setConfirmAbierto(false)
      toast.error('No se pudo eliminar la cuenta', { description: 'Revisa tu conexión e intenta de nuevo.' })
    } finally {
      setEliminando(false)
    }
  }

  const activos = cuentas.filter(c => c.tipo !== 'pasivo')
  const pasivos = cuentas.filter(c => c.tipo === 'pasivo')
  const balanceTotal = cuentas.reduce((acc, c) =>
    c.tipo === 'pasivo' ? acc - c.balance_actual : acc + c.balance_actual, 0)

  const grupo = (titulo, lista) => lista.length > 0 && (
    <section style={{ marginBottom: 24 }}>
      <h2 className="seccion-label">{titulo}</h2>
      <div className="lista-grupo">
        {lista.map(cuenta => (
          <button key={cuenta.id} className="fila" style={{ '--sangria': '64px' }} onClick={() => abrirEditar(cuenta)}>
            <span className="mosaico" style={{ background: cuenta.color_hex + '26' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: cuenta.color_hex }} />
            </span>
            <div className="fila-cuerpo">
              <p className="fila-titulo" style={{ fontWeight: 500 }}>{cuenta.nombre}</p>
            </div>
            <span className="cifra" style={{
              fontWeight: 600, fontSize: 16, flexShrink: 0,
              color: cuenta.tipo === 'pasivo' ? 'var(--gasto)' : 'var(--texto-primario)',
            }}>
              {formatCOP(cuenta.balance_actual)}
            </span>
            <span className="fila-chevron"><Icono nombre="chevron-right" size={16} grosor={2.2} /></span>
          </button>
        ))}
      </div>
    </section>
  )

  return (
    <Pagina
      titulo="Cuentas"
      acciones={
        <button onClick={abrirNueva} className="btn-icono acento" aria-label="Nueva cuenta">
          <Icono nombre="plus" size={20} grosor={2.2} />
        </button>
      }
    >
      {errorCarga && <div style={{ marginBottom: 16 }}><AvisoError>{errorCarga}</AvisoError></div>}

      {cargando ? (
        <div aria-busy="true">
          <div className="skeleton" style={{ height: 104, borderRadius: 20, marginBottom: 28 }} />
          <div className="skeleton" style={{ height: 168, borderRadius: 20 }} />
        </div>
      ) : cuentas.length === 0 ? (
        <EstadoVacio
          icono="tarjeta"
          titulo="Ninguna cuenta todavía"
          texto="Agrega Nequi, efectivo, tu banco o una tarjeta de crédito."
          accion={<button className="btn-primario" onClick={abrirNueva}><Icono nombre="plus" size={18} grosor={2.4} />Nueva cuenta</button>}
        />
      ) : (
        <div className="aparecer">
          <section className="card" style={{ marginBottom: 28 }} aria-label="Patrimonio neto">
            <p className="texto-nota" style={{ marginBottom: 4 }}>Patrimonio neto</p>
            <p className="cifra-hero" style={{
              fontSize: 'clamp(1.75rem, 8.5vw, 2.25rem)',
              color: balanceTotal >= 0 ? 'var(--texto-primario)' : 'var(--gasto)',
            }}>
              {formatCOP(balanceTotal)}
            </p>
            <p className="texto-mini" style={{ marginTop: 6 }}>Lo que tienes menos lo que debes</p>
          </section>

          {grupo('Activos', activos)}
          {grupo('Pasivos', pasivos)}
        </div>
      )}

      {/* Crear / editar */}
      <Sheet
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={editandoId ? 'Editar cuenta' : 'Nueva cuenta'}
        pie={
          <>
            <button onClick={guardar} className="btn-primario" disabled={guardando}>
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear cuenta'}
            </button>
            {editandoId && (
              <button className="btn-texto peligro" onClick={() => setConfirmAbierto(true)}>
                Eliminar cuenta
              </button>
            )}
          </>
        }
      >
        <div className="campo">
          <label className="label" htmlFor="cuenta-nombre">Nombre</label>
          <input
            id="cuenta-nombre"
            className="input"
            placeholder="Ej: Nequi, Efectivo, Bancolombia…"
            value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </div>

        <div className="campo">
          <p className="label">Tipo</p>
          <Segmentado etiqueta="Tipo de cuenta" opciones={TIPOS_CUENTA} valor={form.tipo}
            onChange={tipo => setForm({ ...form, tipo })} />
          <p className="campo-ayuda">
            {form.tipo === 'activo'
              ? 'Dinero que tienes: Nequi, efectivo, cuenta de ahorros.'
              : 'Dinero que debes: tarjeta de crédito, préstamo.'}
          </p>
        </div>

        {editandoId ? (
          <div className="campo">
            <label className="label" htmlFor="cuenta-balance">Balance actual</label>
            <CampoMonto
              id="cuenta-balance"
              permitirNegativo
              valor={form._balance_actual_editable}
              onChange={v => setForm({ ...form, _balance_actual_editable: v })}
            />
            <p className="campo-ayuda">Ajústalo al saldo real si hay un error o un movimiento sin registrar.</p>
          </div>
        ) : (
          <div className="campo">
            <label className="label" htmlFor="cuenta-balance">Balance inicial</label>
            <CampoMonto
              id="cuenta-balance"
              permitirNegativo
              valor={form.balance_inicial}
              onChange={v => setForm({ ...form, balance_inicial: v })}
            />
          </div>
        )}

        <div className="campo">
          <p className="label">Color</p>
          <SelectorColor colores={COLORES} valor={form.color_hex} onChange={c => setForm({ ...form, color_hex: c })} />
        </div>

        <AvisoError>{errorForm}</AvisoError>
      </Sheet>

      <ConfirmarSheet
        abierto={confirmAbierto}
        onCerrar={() => setConfirmAbierto(false)}
        titulo="¿Eliminar cuenta?"
        mensaje={`"${form.nombre || 'Esta cuenta'}" se eliminará. Sus transacciones se conservan, pero quedarán sin cuenta asociada. No se puede deshacer.`}
        textoConfirmar="Eliminar cuenta"
        onConfirmar={eliminar}
        cargando={eliminando}
      />
    </Pagina>
  )
}
