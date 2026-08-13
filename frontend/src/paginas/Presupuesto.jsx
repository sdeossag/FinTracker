import { useState, useEffect } from 'react'
import api, { ensureArray, ensureObject } from '../api'

const formatCOP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)

const COLORES = ['#34C759', '#0A84FF', '#BF5AF2', '#FF9F0A', '#FFD60A', '#FF453A', '#64D2FF', '#FF375F']
const FORM_VACIO = { nombre: '', tipo: 'gasto', presupuesto_mensual: '', color_hex: '#0A84FF' }

const TIPOS = [
  { valor: 'gasto',   etiqueta: 'Gastos' },
  { valor: 'ingreso', etiqueta: 'Ingresos' },
  { valor: 'ahorro',  etiqueta: 'Ahorros' },
]

export default function Presupuesto() {
  const [categorias, setCategorias] = useState([])
  const [gastosMes, setGastosMes] = useState({})
  const [cargando, setCargando] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('gasto')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState('')

  const cargar = async () => {
    try {
      const [resCat, resGastos] = await Promise.all([
        api.get('/categorias/'),
        api.get('/categorias/gastos-mes/'),
      ])
      setCategorias(ensureArray(resCat.data))
      setGastosMes(ensureObject(resGastos.data))
    } catch (err) {
      console.error('Error cargando presupuesto:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  // Notificar presupuestos excedidos (una vez por sesión)
  useEffect(() => {
    if (cargando || filtroTipo !== 'gasto') return
    const yaNotificado = sessionStorage.getItem('ft_budget_notif')
    if (yaNotificado) return
    sessionStorage.setItem('ft_budget_notif', '1')

    import('../utils/notificaciones').then(({ mostrarNotif }) => {
      const excedidas = categorias.filter(c =>
        c.tipo === 'gasto' && c.presupuesto_mensual && (gastosMes[c.id] || 0) > c.presupuesto_mensual
      )
      const al80 = categorias.filter(c =>
        c.tipo === 'gasto' && c.presupuesto_mensual &&
        (gastosMes[c.id] || 0) / c.presupuesto_mensual >= 0.8 &&
        (gastosMes[c.id] || 0) <= c.presupuesto_mensual
      )
      if (excedidas.length > 0) {
        const nombres = excedidas.map(c => c.nombre).join(', ')
        mostrarNotif('⚠️ Presupuesto excedido', `Superaste el límite en: ${nombres}`)
      } else if (al80.length > 0) {
        const nombres = al80.map(c => c.nombre).join(', ')
        mostrarNotif('📊 Presupuesto al límite', `Llevas más del 80% en: ${nombres}`)
      }
    })
  }, [cargando, categorias, gastosMes, filtroTipo])

  const cerrarModal = () => { setModalAbierto(false); setErrorForm(''); setEditandoId(null) }

  const abrirNueva = () => {
    setForm({ ...FORM_VACIO, tipo: filtroTipo })
    setEditandoId(null)
    setErrorForm('')
    setModalAbierto(true)
  }

  const abrirEditar = (cat) => {
    setForm({
      nombre: cat.nombre,
      tipo: cat.tipo,
      presupuesto_mensual: cat.presupuesto_mensual ?? '',
      color_hex: cat.color_hex,
    })
    setEditandoId(cat.id)
    setErrorForm('')
    setModalAbierto(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { setErrorForm('El nombre es obligatorio.'); return }
    setErrorForm('')
    setGuardando(true)
    try {
      const datos = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        color_hex: form.color_hex,
        presupuesto_mensual: form.presupuesto_mensual === '' ? null : parseInt(form.presupuesto_mensual),
      }
      if (editandoId) {
        await api.patch(`/categorias/${editandoId}/`, datos)
      } else {
        await api.post('/categorias/', datos)
      }
      await cargar()
      cerrarModal()
    } catch (err) {
      const d = err.response?.data
      setErrorForm(d?.nombre ? 'Ya tienes una categoría con ese nombre.' : d?.detail ?? 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    setEliminando(true)
    setErrorEliminar('')
    try {
      await api.delete(`/categorias/${id}/`)
      setConfirmEliminar(null)
      await cargar()
    } catch {
      setErrorEliminar('No se pudo eliminar.')
    } finally {
      setEliminando(false)
    }
  }

  const categoriasFiltradas = categorias.filter(c => c.tipo === filtroTipo)

  // Resumen total solo para gastos con presupuesto asignado
  const conPresupuesto = categoriasFiltradas.filter(c => c.presupuesto_mensual)
  const totalPresupuesto = conPresupuesto.reduce((s, c) => s + c.presupuesto_mensual, 0)
  const totalGastado     = conPresupuesto.reduce((s, c) => s + (gastosMes[c.id] || 0), 0)
  const pctTotal         = totalPresupuesto > 0 ? Math.min((totalGastado / totalPresupuesto) * 100, 100) : null
  const totalExcedido    = totalPresupuesto > 0 && totalGastado > totalPresupuesto

  return (
    <div className="pagina">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="titulo-seccion" style={{ margin: 0 }}>Presupuesto</h1>
        <button onClick={abrirNueva} style={{
          background: 'var(--acento)', color: '#fff', border: 'none',
          borderRadius: 20, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          + Categoría
        </button>
      </div>

      {/* Filtro tipo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {TIPOS.map(f => (
          <button key={f.valor} onClick={() => setFiltroTipo(f.valor)} style={{
            flex: 1,
            background: filtroTipo === f.valor ? 'var(--acento)' : 'var(--card)',
            color: filtroTipo === f.valor ? '#fff' : 'var(--texto-secundario)',
            border: '0.5px solid var(--borde)', borderRadius: 20,
            padding: '9px 4px', fontSize: 13, fontWeight: filtroTipo === f.valor ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {f.etiqueta}
          </button>
        ))}
      </div>

      {/* Resumen total del mes (solo si hay categorías con presupuesto) */}
      {!cargando && pctTotal !== null && filtroTipo === 'gasto' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <p style={{ fontSize: 13, color: 'var(--texto-secundario)', fontWeight: 500 }}>
              Total del mes
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: totalExcedido ? 'var(--gasto)' : 'var(--texto-primario)' }}>
              {formatCOP(totalGastado)}
              <span style={{ fontWeight: 400, color: 'var(--texto-terciario)' }}> / {formatCOP(totalPresupuesto)}</span>
            </p>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pctTotal}%`,
              background: totalExcedido ? 'var(--gasto)' : 'var(--acento)',
              borderRadius: 4, transition: 'width 0.5s ease',
            }} />
          </div>
          {totalExcedido && (
            <p style={{ fontSize: 12, color: 'var(--gasto)', marginTop: 8 }}>
              Excediste el presupuesto por {formatCOP(totalGastado - totalPresupuesto)}
            </p>
          )}
        </div>
      )}

      {/* Lista */}
      {cargando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 90, background: 'var(--card)', borderRadius: 22, opacity: 0.4 }} />
          ))}
        </div>
      ) : categoriasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📂</p>
          <p style={{ color: 'var(--texto-secundario)', fontSize: 16, fontWeight: 500 }}>
            Sin categorías de {filtroTipo}
          </p>
          <p style={{ color: 'var(--texto-terciario)', fontSize: 13, marginTop: 6 }}>
            Toca "+ Categoría" para crear la primera
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {categoriasFiltradas.map(cat => {
            const gastado  = gastosMes[cat.id] || 0
            const pct      = cat.presupuesto_mensual
              ? Math.min((gastado / cat.presupuesto_mensual) * 100, 100)
              : null
            const excedido = cat.presupuesto_mensual && gastado > cat.presupuesto_mensual
            const esConfirm = confirmEliminar === cat.id

            return (
              <div key={cat.id} className="card" style={{ padding: '18px 20px' }}>

                {/* Fila nombre + monto */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: cat.color_hex + '22',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color_hex }} />
                  </div>
                  <p style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{cat.nombre}</p>
                  {cat.presupuesto_mensual ? (
                    <p style={{ fontSize: 13, fontWeight: 600, color: excedido ? 'var(--gasto)' : 'var(--texto-secundario)', flexShrink: 0 }}>
                      {formatCOP(gastado)}
                      <span style={{ fontWeight: 400, color: 'var(--texto-terciario)' }}> / {formatCOP(cat.presupuesto_mensual)}</span>
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--texto-terciario)', flexShrink: 0 }}>
                      {gastado > 0 ? formatCOP(gastado) : 'Sin límite'}
                    </p>
                  )}
                </div>

                {/* Barra de progreso */}
                {pct !== null && (
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: excedido ? 'var(--gasto)' : cat.color_hex,
                      borderRadius: 3, transition: 'width 0.4s ease',
                    }} />
                  </div>
                )}
                {pct === null && (
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3, marginBottom: 14 }} />
                )}

                {/* Confirmación de eliminar */}
                {esConfirm ? (
                  <div style={{ background: 'var(--gasto-suave)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={{ flex: 1, fontSize: 13 }}>¿Eliminar esta categoría?</p>
                    {errorEliminar && <p style={{ fontSize: 12, color: 'var(--gasto)' }}>{errorEliminar}</p>}
                    <button onClick={() => eliminar(cat.id)} disabled={eliminando} style={{
                      background: 'var(--gasto)', color: '#fff', border: 'none',
                      borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {eliminando ? '...' : 'Eliminar'}
                    </button>
                    <button onClick={() => { setConfirmEliminar(null); setErrorEliminar('') }} style={{
                      background: 'var(--card)', border: 'none', borderRadius: 8,
                      padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--texto-secundario)',
                    }}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => abrirEditar(cat)} style={{
                      flex: 1, background: 'var(--card-hover)', border: 'none',
                      borderRadius: 10, padding: '8px', fontSize: 13, fontWeight: 500,
                      color: 'var(--texto-secundario)', cursor: 'pointer',
                    }}>
                      Editar
                    </button>
                    <button onClick={() => { setConfirmEliminar(cat.id); setErrorEliminar('') }} style={{
                      width: 38, height: 36, borderRadius: 10, border: 'none',
                      background: 'var(--gasto-suave)', color: 'var(--gasto)',
                      cursor: 'pointer', fontSize: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      🗑
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      {modalAbierto && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}
          onClick={cerrarModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)', borderRadius: '24px 24px 0 0',
              padding: '24px 20px', paddingBottom: 'calc(var(--nav-height) + 20px)',
              width: '100%', maxWidth: 430, margin: '0 auto',
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <p style={{ fontSize: 18, fontWeight: 600 }}>
                {editandoId ? 'Editar categoría' : 'Nueva categoría'}
              </p>
              <button onClick={cerrarModal} style={{
                background: 'var(--card-hover)', border: 'none', borderRadius: '50%',
                width: 32, height: 32, fontSize: 18, color: 'var(--texto-secundario)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>

            <label className="label">Nombre</label>
            <input
              className="input"
              placeholder="Ej: Transporte, Mercado..."
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              style={{ marginBottom: 16 }}
              autoFocus
            />

            <label className="label">Tipo</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['gasto', 'ingreso', 'ahorro'].map(t => (
                <button key={t} onClick={() => setForm({ ...form, tipo: t })} style={{
                  flex: 1,
                  background: form.tipo === t ? 'var(--acento)' : 'var(--card-hover)',
                  color: form.tipo === t ? '#fff' : 'var(--texto-secundario)',
                  border: '0.5px solid var(--borde)', borderRadius: 10,
                  padding: '10px 4px', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
                }}>
                  {t}
                </button>
              ))}
            </div>

            <label className="label">Límite mensual (opcional)</label>
            <input
              className="input"
              type="number"
              placeholder="Ej: 200000"
              value={form.presupuesto_mensual}
              onChange={e => setForm({ ...form, presupuesto_mensual: e.target.value })}
              style={{ marginBottom: 20 }}
            />

            <label className="label">Color</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {COLORES.map(color => (
                <button
                  key={color}
                  onClick={() => setForm({ ...form, color_hex: color })}
                  style={{
                    width: 36, height: 36, borderRadius: '50%', background: color,
                    border: form.color_hex === color ? '3px solid #fff' : '3px solid transparent',
                    cursor: 'pointer', transition: 'border 0.15s',
                  }}
                />
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
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear categoría'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
