import { useState, useEffect } from 'react'
import api, { ensureArray } from '../api'

const formatCOP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)

const COLORES = ['#34C759', '#0A84FF', '#BF5AF2', '#FF9F0A', '#FFD60A', '#FF453A', '#64D2FF', '#FF375F']
const cuentaVacia = { nombre: '', tipo: 'activo', balance_inicial: '0', color_hex: '#0A84FF' }

export default function Cuentas() {
  const [cuentas, setCuentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(cuentaVacia)
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [confirmandoId, setConfirmandoId] = useState(null)

  const cargar = async () => {
    setErrorCarga('')
    try {
      const res = await api.get('/cuentas/')
      setCuentas(ensureArray(res.data))
    } catch (err) {
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
    // Validación con mensajes visibles
    if (!form.nombre.trim()) {
      setErrorForm('El nombre de la cuenta es obligatorio.')
      return
    }
    const balanceNum = parseInt(form.balance_inicial)
    if (isNaN(balanceNum)) {
      setErrorForm('El balance inicial debe ser un número.')
      return
    }

    setErrorForm('')
    setGuardando(true)
    try {
      const datos = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        balance_inicial: balanceNum,
        color_hex: form.color_hex,
      }
      if (editandoId) {
        await api.patch(`/cuentas/${editandoId}/`, datos)
      } else {
        await api.post('/cuentas/', datos)
      }
      await cargar()
      cerrarModal()
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

  const eliminar = async (id) => {
    try {
      await api.delete(`/cuentas/${id}/`)
      setConfirmandoId(null)
      await cargar()
    } catch (err) {
      alert('No se pudo eliminar la cuenta. Puede que tenga transacciones asociadas.')
    }
  }

  const balanceTotal = cuentas.reduce((acc, c) =>
    c.tipo === 'pasivo' ? acc - c.balance_actual : acc + c.balance_actual, 0)

  return (
    <div className="pagina">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="titulo-seccion" style={{ marginBottom: 0 }}>Cuentas</h1>
        <button onClick={abrirNueva} style={{
          background: 'var(--acento)', color: '#fff', border: 'none',
          borderRadius: 20, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>+ Nueva</button>
      </div>

      <div className="card" style={{ marginBottom: 20, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--texto-secundario)', marginBottom: 6 }}>Patrimonio neto</p>
        <p style={{
          fontSize: 32, fontWeight: 700, letterSpacing: -0.5,
          color: balanceTotal >= 0 ? 'var(--ingreso)' : 'var(--gasto)',
        }}>
          {formatCOP(balanceTotal)}
        </p>
      </div>

      {errorCarga && (
        <p style={{ color: 'var(--gasto)', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>
          {errorCarga}
        </p>
      )}

      {cargando ? (
        <p style={{ color: 'var(--texto-secundario)' }}>Cargando...</p>
      ) : cuentas.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <p style={{ fontSize: 36, marginBottom: 8 }}>🏦</p>
          <p style={{ color: 'var(--texto-secundario)', marginBottom: 4 }}>Ninguna cuenta todavía</p>
          <p style={{ color: 'var(--texto-terciario)', fontSize: 14 }}>
            Toca "+ Nueva" para agregar Nequi, Efectivo, etc.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cuentas.map(cuenta => (
            <div key={cuenta.id} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: cuenta.color_hex }} />
                  <div>
                    <p style={{ fontWeight: 500 }}>{cuenta.nombre}</p>
                    <p style={{ fontSize: 12, color: 'var(--texto-secundario)' }}>
                      {cuenta.tipo === 'pasivo' ? 'Pasivo' : 'Activo'}
                    </p>
                  </div>
                </div>
                <p style={{
                  fontWeight: 600, fontSize: 17,
                  color: cuenta.tipo === 'pasivo' ? 'var(--gasto)' : 'var(--texto-primario)',
                }}>
                  {formatCOP(cuenta.balance_actual)}
                </p>
              </div>
              <div className="separador" />

              {confirmandoId === cuenta.id ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--texto-secundario)', flex: 1 }}>
                    ¿Eliminar esta cuenta?
                  </p>
                  <button onClick={() => eliminar(cuenta.id)} style={{
                    background: 'var(--gasto)', color: '#fff', border: 'none',
                    borderRadius: 'var(--radio-sm)', padding: '8px 14px', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer',
                  }}>Sí, eliminar</button>
                  <button onClick={() => setConfirmandoId(null)} className="btn-secundario"
                    style={{ padding: '8px 14px', fontSize: 13 }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => abrirEditar(cuenta)} className="btn-secundario"
                    style={{ padding: '8px', fontSize: 13 }}>
                    Editar
                  </button>
                  <button onClick={() => setConfirmandoId(cuenta.id)} style={{
                    background: 'var(--gasto-suave)', color: 'var(--gasto)', border: 'none',
                    borderRadius: 'var(--radio-sm)', padding: '8px', fontSize: 13,
                    fontWeight: 500, width: '100%', cursor: 'pointer',
                  }}>Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom sheet modal */}
      {modalAbierto && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}
          onClick={cerrarModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)', borderRadius: '24px 24px 0 0',
              padding: '24px 20px 48px', width: '100%', maxWidth: 430, margin: '0 auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 18, fontWeight: 600 }}>
                {editandoId ? 'Editar cuenta' : 'Nueva cuenta'}
              </p>
              <button onClick={cerrarModal} style={{
                background: 'none', border: 'none', color: 'var(--texto-secundario)',
                fontSize: 22, cursor: 'pointer', lineHeight: 1,
              }}>×</button>
            </div>

            <label className="label">Nombre</label>
            <input
              className="input"
              placeholder="Ej: Nequi, Efectivo, Bancolombia..."
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              style={{ marginBottom: 16 }}
              autoFocus
            />

            <label className="label">Tipo</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {['activo', 'pasivo'].map(t => (
                <button key={t} onClick={() => setForm({ ...form, tipo: t })} style={{
                  flex: 1,
                  background: form.tipo === t ? 'var(--acento)' : 'var(--card-hover)',
                  color: form.tipo === t ? '#fff' : 'var(--texto-secundario)',
                  border: '0.5px solid var(--borde)', borderRadius: 'var(--radio-sm)',
                  padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  textTransform: 'capitalize',
                }}>{t}</button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--texto-terciario)', marginTop: -10, marginBottom: 16 }}>
              Activo: dinero que tienes (Nequi, efectivo). Pasivo: deuda (tarjeta crédito).
            </p>

            <label className="label">Balance inicial (COP)</label>
            <input
              className="input"
              type="number"
              placeholder="0"
              value={form.balance_inicial}
              onChange={e => setForm({ ...form, balance_inicial: e.target.value })}
              style={{ marginBottom: 16 }}
            />

            <label className="label">Color</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {COLORES.map(color => (
                <div key={color} onClick={() => setForm({ ...form, color_hex: color })} style={{
                  width: 32, height: 32, borderRadius: '50%', background: color, cursor: 'pointer',
                  border: form.color_hex === color ? '3px solid #fff' : '3px solid transparent',
                  transition: 'border-color 0.15s',
                }} />
              ))}
            </div>

            {errorForm && (
              <p style={{
                color: 'var(--gasto)', fontSize: 13, marginBottom: 16,
                background: 'var(--gasto-suave)', padding: '10px 14px', borderRadius: 10,
              }}>
                {errorForm}
              </p>
            )}

            <button onClick={guardar} className="btn-primario" disabled={guardando}>
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear cuenta'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
