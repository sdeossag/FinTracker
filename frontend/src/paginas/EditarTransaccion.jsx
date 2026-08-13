import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api, { ensureArray } from '../api'

const TIPOS_COLOR = {
  gasto: 'var(--gasto)',
  ingreso: 'var(--ingreso)',
  ahorro: 'var(--ahorro)',
}

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
  const [error, setError] = useState('')

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
        setError('No se pudo cargar la transacción.')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  const toggleCategoria = (catId) => {
    setForm(prev => ({
      ...prev,
      categorias: prev.categorias.includes(catId)
        ? prev.categorias.filter(c => c !== catId)
        : [...prev.categorias, catId],
    }))
  }

  const cambiarTipo = (tipo) => {
    setForm(prev => ({
      ...prev,
      tipo,
      cuenta_origen: '',
      cuenta_destino: '',
      categorias: [],
    }))
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.monto || parseInt(form.monto) <= 0) { setError('El monto debe ser mayor a 0.'); return }
    if (form.tipo === 'gasto' && !form.cuenta_origen) { setError('Selecciona la cuenta de origen.'); return }
    if (form.tipo === 'ingreso' && !form.cuenta_destino) { setError('Selecciona la cuenta de destino.'); return }
    if (form.tipo === 'ahorro' && (!form.cuenta_origen || !form.cuenta_destino)) {
      setError('Para ahorros necesitas cuenta origen y destino.'); return
    }
    setError('')
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
      navigate('/transacciones')
    } catch (err) {
      console.error('Error guardando:', err)
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    setEliminando(true)
    try {
      await api.delete(`/transacciones/${id}/`)
      navigate('/transacciones')
    } catch (err) {
      console.error('Error eliminando:', err)
      setEliminando(false)
    }
  }

  if (cargando) return (
    <div className="pagina">
      <p style={{ color: 'var(--texto-secundario)' }}>Cargando...</p>
    </div>
  )

  if (!form) return (
    <div className="pagina">
      <p style={{ color: 'var(--gasto)' }}>{error || 'Transacción no encontrada.'}</p>
      <button onClick={() => navigate(-1)} className="btn-secundario" style={{ marginTop: 16 }}>Volver</button>
    </div>
  )

  const categoriasFiltradas = categorias.filter(c => c.tipo === form.tipo)
  const colorTipo = TIPOS_COLOR[form.tipo]

  return (
    <div className="pagina">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'var(--card)', border: '0.5px solid var(--borde)',
          borderRadius: 20, padding: '8px 14px', color: 'var(--texto-secundario)', cursor: 'pointer', fontSize: 14,
        }}>← Volver</button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Editar transacción</h1>
      </div>

      {/* Selector de tipo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['gasto', 'ingreso', 'ahorro'].map(t => (
          <button key={t} onClick={() => cambiarTipo(t)} style={{
            flex: 1,
            background: form.tipo === t ? TIPOS_COLOR[t] : 'var(--card)',
            color: form.tipo === t ? '#fff' : 'var(--texto-secundario)',
            border: '0.5px solid var(--borde)', borderRadius: 'var(--radio-sm)',
            padding: '12px 4px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            textTransform: 'capitalize', transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {/* Monto grande */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <p style={{ fontSize: 13, color: 'var(--texto-secundario)', marginBottom: 8 }}>Monto (COP)</p>
        <input
          type="number"
          placeholder="0"
          value={form.monto}
          onChange={e => setForm({ ...form, monto: e.target.value })}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: 48, fontWeight: 700, color: colorTipo,
            width: '100%', textAlign: 'center', letterSpacing: -1,
          }}
        />
        <div style={{ height: 1, background: 'var(--borde)', marginTop: 8 }} />
      </div>

      {/* Descripción */}
      <label className="label">Descripción</label>
      <input
        className="input"
        placeholder="Ej: Metro, Almuerzo..."
        value={form.nombre}
        onChange={e => setForm({ ...form, nombre: e.target.value })}
        style={{ marginBottom: 16 }}
      />

      {/* Fecha */}
      <label className="label">Fecha</label>
      <input
        className="input"
        type="date"
        value={form.fecha}
        onChange={e => setForm({ ...form, fecha: e.target.value })}
        style={{ marginBottom: 16, colorScheme: 'dark' }}
      />

      {/* Cuenta origen */}
      {(form.tipo === 'gasto' || form.tipo === 'ahorro') && (
        <>
          <label className="label">{form.tipo === 'ahorro' ? 'Cuenta origen (de dónde sale)' : 'Cuenta'}</label>
          <select className="input" value={form.cuenta_origen}
            onChange={e => setForm({ ...form, cuenta_origen: e.target.value })}
            style={{ marginBottom: 16 }}>
            <option value="">Seleccionar cuenta...</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </>
      )}

      {/* Cuenta destino */}
      {(form.tipo === 'ingreso' || form.tipo === 'ahorro') && (
        <>
          <label className="label">{form.tipo === 'ahorro' ? 'Cuenta destino (a dónde entra)' : 'Cuenta'}</label>
          <select className="input" value={form.cuenta_destino}
            onChange={e => setForm({ ...form, cuenta_destino: e.target.value })}
            style={{ marginBottom: 16 }}>
            <option value="">Seleccionar cuenta...</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </>
      )}

      {/* Categorías */}
      {categoriasFiltradas.length > 0 && (
        <>
          <label className="label">Categorías (puedes elegir varias)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {categoriasFiltradas.map(cat => (
              <button key={cat.id} onClick={() => toggleCategoria(cat.id)} style={{
                background: form.categorias.includes(cat.id) ? cat.color_hex : 'var(--card)',
                color: form.categorias.includes(cat.id) ? '#fff' : 'var(--texto-secundario)',
                border: `0.5px solid ${form.categorias.includes(cat.id) ? cat.color_hex : 'var(--borde)'}`,
                borderRadius: 20, padding: '8px 14px', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{cat.nombre}</button>
            ))}
          </div>
        </>
      )}

      {/* Notas */}
      <label className="label">Notas (opcional)</label>
      <textarea
        className="input"
        placeholder="Agrega un detalle si quieres..."
        value={form.notas}
        onChange={e => setForm({ ...form, notas: e.target.value })}
        rows={3}
        style={{ marginBottom: 24, resize: 'none' }}
      />

      {error && (
        <p style={{ color: 'var(--gasto)', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</p>
      )}

      {/* Botón guardar */}
      <button onClick={guardar} className="btn-primario" disabled={guardando} style={{ marginBottom: 12 }}>
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {/* Eliminar con confirmación inline */}
      {confirmEliminar ? (
        <div style={{
          background: 'var(--gasto-suave)', border: '1px solid var(--gasto)',
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <p style={{ flex: 1, fontSize: 14, color: 'var(--texto-primario)' }}>
            ¿Eliminar esta transacción? No se puede deshacer.
          </p>
          <button onClick={eliminar} disabled={eliminando} style={{
            background: 'var(--gasto)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            {eliminando ? '...' : 'Eliminar'}
          </button>
          <button onClick={() => setConfirmEliminar(false)} style={{
            background: 'var(--card)', border: 'none', borderRadius: 10,
            padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--texto-secundario)',
          }}>
            Cancelar
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmEliminar(true)} style={{
          width: '100%', background: 'none', border: '0.5px solid var(--gasto)',
          borderRadius: 14, padding: '13px', fontSize: 14, fontWeight: 500,
          color: 'var(--gasto)', cursor: 'pointer',
        }}>
          Eliminar transacción
        </button>
      )}
    </div>
  )
}
