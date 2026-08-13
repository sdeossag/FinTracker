// Pantalla de registro rápido de transacción — la más usada de la app
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { ensureArray } from '../api'

const formVacio = {
  nombre: '',
  monto: '',
  tipo: 'gasto',
  fecha: new Date().toISOString().split('T')[0],
  cuenta_origen: '',
  cuenta_destino: '',
  categorias: [],
  notas: '',
}

export default function NuevaTransaccion() {
  const navigate = useNavigate()
  const [form, setForm] = useState(formVacio)
  const [cuentas, setCuentas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const cargar = async () => {
      try {
        const [resCuentas, resCat] = await Promise.all([
          api.get('/cuentas/'),
          api.get('/categorias/'),
        ])
        setCuentas(ensureArray(resCuentas.data))
        setCategorias(ensureArray(resCat.data))
      } catch (err) {
        console.error('Error cargando datos:', err)
      }
    }
    cargar()
  }, [])

  const toggleCategoria = (id) => {
    setForm(prev => ({
      ...prev,
      categorias: prev.categorias.includes(id)
        ? prev.categorias.filter(c => c !== id)
        : [...prev.categorias, id],
    }))
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.monto || parseInt(form.monto) <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (form.tipo === 'gasto' && !form.cuenta_origen) { setError('Selecciona la cuenta de origen'); return }
    if (form.tipo === 'ingreso' && !form.cuenta_destino) { setError('Selecciona la cuenta de destino'); return }
    if (form.tipo === 'ahorro' && (!form.cuenta_origen || !form.cuenta_destino)) {
      setError('Para ahorros necesitas cuenta origen y destino'); return
    }
    setError('')
    setGuardando(true)
    try {
      await api.post('/transacciones/', {
        ...form,
        monto: parseInt(form.monto),
        cuenta_origen: form.cuenta_origen || null,
        cuenta_destino: form.cuenta_destino || null,
        categorias_ids: form.categorias,
      })
      navigate('/transacciones')
    } catch (err) {
      console.error('Error guardando transacción:', err)
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const categoriasFiltradas = categorias.filter(c => c.tipo === form.tipo)

  return (
    <div className="pagina">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'var(--card)', border: '0.5px solid var(--borde)',
          borderRadius: 20, padding: '8px 14px', color: 'var(--texto-secundario)', cursor: 'pointer', fontSize: 14,
        }}>← Volver</button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Nueva transacción</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['gasto', 'ingreso', 'ahorro'].map(t => (
          <button key={t} onClick={() => setForm({ ...formVacio, tipo: t, fecha: form.fecha })} style={{
            flex: 1,
            background: form.tipo === t
              ? t === 'gasto' ? 'var(--gasto)' : t === 'ingreso' ? 'var(--ingreso)' : 'var(--ahorro)'
              : 'var(--card)',
            color: form.tipo === t ? '#fff' : 'var(--texto-secundario)',
            border: '0.5px solid var(--borde)', borderRadius: 'var(--radio-sm)',
            padding: '12px 4px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            textTransform: 'capitalize', transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <p style={{ fontSize: 13, color: 'var(--texto-secundario)', marginBottom: 8 }}>Monto (COP)</p>
        <input type="number" placeholder="0" value={form.monto}
          onChange={e => setForm({ ...form, monto: e.target.value })}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: 48, fontWeight: 700,
            color: form.tipo === 'gasto' ? 'var(--gasto)' : form.tipo === 'ingreso' ? 'var(--ingreso)' : 'var(--ahorro)',
            width: '100%', textAlign: 'center', letterSpacing: -1,
          }} />
        <div style={{ height: 1, background: 'var(--borde)', marginTop: 8 }} />
      </div>

      <label className="label">Descripción</label>
      <input className="input" placeholder="Ej: Metro, Almuerzo..." value={form.nombre}
        onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ marginBottom: 16 }} />

      <label className="label">Fecha</label>
      <input className="input" type="date" value={form.fecha}
        onChange={e => setForm({ ...form, fecha: e.target.value })}
        style={{ marginBottom: 16, colorScheme: 'dark' }} />

      {(form.tipo === 'gasto' || form.tipo === 'ahorro') && (
        <>
          <label className="label">{form.tipo === 'ahorro' ? 'Cuenta origen (de dónde sale)' : 'Cuenta'}</label>
          <select className="input" value={form.cuenta_origen}
            onChange={e => setForm({ ...form, cuenta_origen: e.target.value })} style={{ marginBottom: 16 }}>
            <option value="">Seleccionar cuenta...</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </>
      )}

      {(form.tipo === 'ingreso' || form.tipo === 'ahorro') && (
        <>
          <label className="label">{form.tipo === 'ahorro' ? 'Cuenta destino (a dónde entra)' : 'Cuenta'}</label>
          <select className="input" value={form.cuenta_destino}
            onChange={e => setForm({ ...form, cuenta_destino: e.target.value })} style={{ marginBottom: 16 }}>
            <option value="">Seleccionar cuenta...</option>
            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </>
      )}

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

      <label className="label">Notas (opcional)</label>
      <textarea className="input" placeholder="Agrega un detalle si quieres..." value={form.notas}
        onChange={e => setForm({ ...form, notas: e.target.value })}
        rows={3} style={{ marginBottom: 24, resize: 'none' }} />

      {error && <p style={{ color: 'var(--gasto)', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</p>}

      <button onClick={guardar} className="btn-primario" disabled={guardando}>
        {guardando ? 'Guardando...' : 'Registrar transacción'}
      </button>
    </div>
  )
}