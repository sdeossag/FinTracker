import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import api, { ensureArray, ensureObject } from '../api'
import Pagina from '../componentes/Pagina'
import Icono from '../componentes/Icono'
import Sheet, { ConfirmarSheet } from '../componentes/Sheet'
import { AvisoError, CampoMonto, EstadoVacio, Segmentado, SelectorColor } from '../componentes/Controles'
import { formatCOP } from '../utils/formato'

const COLORES = ['#34C759', '#0A84FF', '#BF5AF2', '#FF9F0A', '#FFD60A', '#FF453A', '#64D2FF', '#FF375F']
const FORM_VACIO = { nombre: '', tipo: 'gasto', presupuesto_mensual: '', color_hex: '#0A84FF' }

const TIPOS = [
  { valor: 'gasto',   etiqueta: 'Gastos' },
  { valor: 'ingreso', etiqueta: 'Ingresos' },
  { valor: 'ahorro',  etiqueta: 'Ahorros' },
]
const TIPOS_FORM = [
  { valor: 'gasto',   etiqueta: 'Gasto' },
  { valor: 'ingreso', etiqueta: 'Ingreso' },
  { valor: 'ahorro',  etiqueta: 'Ahorro' },
]

function Barra({ pct, color }) {
  return (
    <div className="progress-track" role="presentation">
      <div className="progress-fill" style={{ transform: `scaleX(${(pct ?? 0) / 100})`, background: color }} />
    </div>
  )
}

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

  const [confirmAbierto, setConfirmAbierto] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  // Las barras crecen desde 0 una vez cargados los datos
  const [listo, setListo] = useState(false)

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

  useEffect(() => {
    if (cargando) return
    const raf = requestAnimationFrame(() => setListo(true))
    return () => cancelAnimationFrame(raf)
  }, [cargando])

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
        mostrarNotif('Presupuesto excedido', `Superaste el límite en: ${nombres}`)
      } else if (al80.length > 0) {
        const nombres = al80.map(c => c.nombre).join(', ')
        mostrarNotif('Presupuesto al límite', `Llevas más del 80% en: ${nombres}`)
      }
    })
  }, [cargando, categorias, gastosMes, filtroTipo])

  const cerrarModal = () => { setModalAbierto(false); setErrorForm('') }

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
      presupuesto_mensual: cat.presupuesto_mensual != null ? String(cat.presupuesto_mensual) : '',
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
      toast.success(editandoId ? 'Categoría actualizada' : 'Categoría creada', { description: datos.nombre })
    } catch (err) {
      const d = err.response?.data
      setErrorForm(d?.nombre ? 'Ya tienes una categoría con ese nombre.' : d?.detail ?? 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!editandoId) return
    setEliminando(true)
    try {
      await api.delete(`/categorias/${editandoId}/`)
      setConfirmAbierto(false)
      cerrarModal()
      await cargar()
      toast.success('Categoría eliminada')
    } catch {
      setConfirmAbierto(false)
      toast.error('No se pudo eliminar la categoría')
    } finally {
      setEliminando(false)
    }
  }

  const categoriasFiltradas = categorias.filter(c => c.tipo === filtroTipo)

  // Resumen total solo para categorías con presupuesto asignado
  const conPresupuesto = categoriasFiltradas.filter(c => c.presupuesto_mensual)
  const totalPresupuesto = conPresupuesto.reduce((s, c) => s + c.presupuesto_mensual, 0)
  const totalGastado     = conPresupuesto.reduce((s, c) => s + (gastosMes[c.id] || 0), 0)
  const pctTotal         = totalPresupuesto > 0 ? Math.min((totalGastado / totalPresupuesto) * 100, 100) : null
  const totalExcedido    = totalPresupuesto > 0 && totalGastado > totalPresupuesto
  const etiquetaTipo     = TIPOS.find(t => t.valor === filtroTipo)?.etiqueta.toLowerCase()

  return (
    <Pagina
      titulo="Presupuesto"
      atras={{ etiqueta: 'Gráficas', a: '/graficas' }}
      acciones={
        <button onClick={abrirNueva} className="btn-icono acento" aria-label="Nueva categoría">
          <Icono nombre="plus" size={20} grosor={2.2} />
        </button>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <Segmentado etiqueta="Tipo de categoría" opciones={TIPOS} valor={filtroTipo} onChange={setFiltroTipo} />
      </div>

      {/* Resumen del mes */}
      {!cargando && pctTotal !== null && filtroTipo === 'gasto' && (
        <section className="card aparecer" style={{ marginBottom: 24 }} aria-label="Total del mes">
          <p className="texto-nota" style={{ marginBottom: 4 }}>Gastado este mes</p>
          <p style={{ marginBottom: 14 }}>
            <span className="cifra-hero" style={{ fontSize: 28, color: totalExcedido ? 'var(--gasto)' : 'var(--texto-primario)' }}>
              {formatCOP(totalGastado)}
            </span>
            <span className="texto-nota cifra"> de {formatCOP(totalPresupuesto)}</span>
          </p>
          <Barra pct={listo ? pctTotal : 0} color={totalExcedido ? 'var(--gasto)' : 'var(--acento)'} />
          <p className="texto-mini" style={{ marginTop: 8, color: totalExcedido ? 'var(--gasto)' : undefined }}>
            {totalExcedido
              ? `Te pasaste por ${formatCOP(totalGastado - totalPresupuesto)}`
              : `Te quedan ${formatCOP(totalPresupuesto - totalGastado)}`}
          </p>
        </section>
      )}

      {cargando ? (
        <div className="lista-grupo" aria-busy="true">
          {[1, 2, 3].map(i => (
            <div key={i} className="fila" style={{ minHeight: 76 }}>
              <div className="skeleton" style={{ width: 36, height: 36 }} />
              <div className="fila-cuerpo">
                <div className="skeleton" style={{ height: 13, width: '50%', marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : categoriasFiltradas.length === 0 ? (
        <EstadoVacio
          icono="etiqueta"
          titulo={`Sin categorías de ${etiquetaTipo}`}
          texto="Las categorías clasifican tus movimientos y te dejan poner un límite mensual."
          accion={<button className="btn-primario" onClick={abrirNueva}><Icono nombre="plus" size={18} grosor={2.4} />Nueva categoría</button>}
        />
      ) : (
        <div className="lista-grupo aparecer">
          {categoriasFiltradas.map(cat => {
            const gastado  = gastosMes[cat.id] || 0
            const pct      = cat.presupuesto_mensual ? Math.min((gastado / cat.presupuesto_mensual) * 100, 100) : null
            const excedido = cat.presupuesto_mensual && gastado > cat.presupuesto_mensual

            return (
              <button key={cat.id} className="fila" style={{ '--sangria': '64px', minHeight: 76, alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }} onClick={() => abrirEditar(cat)}>
                <span className="mosaico" style={{ background: cat.color_hex + '26' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color_hex }} />
                </span>
                <div className="fila-cuerpo">
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: pct !== null ? 8 : 0 }}>
                    <p className="fila-titulo" style={{ flex: 1, fontWeight: 500 }}>{cat.nombre}</p>
                    {excedido && (
                      <span className="etiqueta" style={{ background: 'var(--gasto-suave)', color: 'var(--gasto)' }}>Excedido</span>
                    )}
                  </div>
                  {pct !== null ? (
                    <>
                      <Barra pct={listo ? pct : 0} color={excedido ? 'var(--gasto)' : cat.color_hex} />
                      <p className="texto-mini cifra" style={{ marginTop: 6 }}>
                        <span style={{ color: excedido ? 'var(--gasto)' : 'var(--texto-secundario)', fontWeight: 600 }}>{formatCOP(gastado)}</span>
                        {' '}de {formatCOP(cat.presupuesto_mensual)}
                      </p>
                    </>
                  ) : (
                    <p className="fila-sub cifra">{gastado > 0 ? `${formatCOP(gastado)} · sin límite` : 'Sin límite mensual'}</p>
                  )}
                </div>
                <span className="fila-chevron" style={{ alignSelf: 'center' }}><Icono nombre="chevron-right" size={16} grosor={2.2} /></span>
              </button>
            )
          })}
        </div>
      )}

      {/* Crear / editar */}
      <Sheet
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={editandoId ? 'Editar categoría' : 'Nueva categoría'}
        pie={
          <>
            <button onClick={guardar} className="btn-primario" disabled={guardando}>
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear categoría'}
            </button>
            {editandoId && (
              <button className="btn-texto peligro" onClick={() => setConfirmAbierto(true)}>Eliminar categoría</button>
            )}
          </>
        }
      >
        <div className="campo">
          <label className="label" htmlFor="cat-nombre">Nombre</label>
          <input
            id="cat-nombre"
            className="input"
            placeholder="Ej: Transporte, Mercado…"
            value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
            autoCapitalize="sentences"
            enterKeyHint="next"
          />
        </div>

        <div className="campo">
          <p className="label">Tipo</p>
          <Segmentado etiqueta="Tipo" opciones={TIPOS_FORM} valor={form.tipo} onChange={tipo => setForm({ ...form, tipo })} />
        </div>

        <div className="campo">
          <label className="label" htmlFor="cat-limite">Límite mensual <span style={{ color: 'var(--texto-terciario)' }}>· opcional</span></label>
          <CampoMonto
            id="cat-limite"
            valor={form.presupuesto_mensual}
            onChange={v => setForm({ ...form, presupuesto_mensual: v })}
            placeholder="Sin límite"
          />
        </div>

        <div className="campo">
          <p className="label">Color</p>
          <SelectorColor colores={COLORES} valor={form.color_hex} onChange={c => setForm({ ...form, color_hex: c })} />
        </div>

        <AvisoError>{errorForm}</AvisoError>
      </Sheet>

      <ConfirmarSheet
        abierto={confirmAbierto}
        onCerrar={() => setConfirmAbierto(false)}
        titulo="¿Eliminar categoría?"
        mensaje={`"${form.nombre || 'Esta categoría'}" se eliminará. Tus transacciones se conservan, pero quedarán sin esta categoría.`}
        textoConfirmar="Eliminar categoría"
        onConfirmar={eliminar}
        cargando={eliminando}
      />
    </Pagina>
  )
}
