// Formulario compartido por Nueva y Editar transacción
import { Link } from 'react-router-dom'
import Icono from './Icono'
import { CampoMonto, Segmentado } from './Controles'
import { COLOR_TIPO, TIPOS_TRANSACCION, conTipo } from '../utils/transaccion'

export default function TransaccionForm({ form, onCambio, cuentas, categorias, errores = {}, autoFocusMonto = false }) {
  const set = (campo) => (e) => onCambio({ [campo]: e.target.value })
  const categoriasTipo = categorias.filter(c => c.tipo === form.tipo)
  const color = COLOR_TIPO[form.tipo]

  const toggleCategoria = (id) => onCambio({
    categorias: form.categorias.includes(id)
      ? form.categorias.filter(c => c !== id)
      : [...form.categorias, id],
  })

  const selectorCuenta = (campo, etiqueta) => (
    <div className="campo">
      <label className="label" htmlFor={campo}>{etiqueta}</label>
      <select
        id={campo}
        className="input"
        value={form[campo]}
        onChange={set(campo)}
        aria-invalid={!!errores[campo] || undefined}
        aria-describedby={errores[campo] ? `${campo}-error` : undefined}
      >
        <option value="">Seleccionar cuenta…</option>
        {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      {errores[campo] && <p id={`${campo}-error`} className="campo-error">{errores[campo]}</p>}
    </div>
  )

  return (
    <>
      <Segmentado
        grande
        etiqueta="Tipo de transacción"
        opciones={TIPOS_TRANSACCION}
        valor={form.tipo}
        onChange={(tipo) => onCambio(conTipo(form, tipo))}
      />

      {/* Monto: el protagonista de la pantalla */}
      <div style={{ padding: '28px 0 26px', textAlign: 'center' }}>
        <label htmlFor="monto" className="sr-only">Monto en pesos</label>
        <CampoMonto
          id="monto"
          grande
          color={form.monto ? color : undefined}
          valor={form.monto}
          onChange={(monto) => onCambio({ monto })}
          invalido={!!errores.monto}
          autoFocus={autoFocusMonto}
          aria-describedby={errores.monto ? 'monto-error' : undefined}
        />
        <p className="texto-mini" style={{ marginTop: 6 }}>Pesos colombianos</p>
        {errores.monto && <p id="monto-error" className="campo-error" style={{ textAlign: 'center' }}>{errores.monto}</p>}
      </div>

      {cuentas.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: 'var(--acento)', display: 'flex' }}><Icono nombre="info" /></span>
          <p className="texto-nota" style={{ flex: 1 }}>Necesitas al menos una cuenta para registrar movimientos.</p>
          <Link to="/cuentas" className="btn-texto" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Crear</Link>
        </div>
      )}

      <div className="campo">
        <label className="label" htmlFor="nombre">Descripción</label>
        <input
          id="nombre"
          className="input"
          placeholder="Ej: Metro, almuerzo…"
          value={form.nombre}
          onChange={set('nombre')}
          enterKeyHint="next"
          autoCapitalize="sentences"
          aria-invalid={!!errores.nombre || undefined}
          aria-describedby={errores.nombre ? 'nombre-error' : undefined}
        />
        {errores.nombre && <p id="nombre-error" className="campo-error">{errores.nombre}</p>}
      </div>

      <div className="campo">
        <label className="label" htmlFor="fecha">Fecha</label>
        <input id="fecha" className="input" type="date" value={form.fecha} onChange={set('fecha')} />
      </div>

      {(form.tipo === 'gasto' || form.tipo === 'ahorro') &&
        selectorCuenta('cuenta_origen', form.tipo === 'ahorro' ? 'Sale de' : 'Cuenta')}
      {(form.tipo === 'ingreso' || form.tipo === 'ahorro') &&
        selectorCuenta('cuenta_destino', form.tipo === 'ahorro' ? 'Entra a' : 'Cuenta')}

      {categoriasTipo.length > 0 && (
        <div className="campo">
          <p className="label" id="cats-label">Categorías <span style={{ color: 'var(--texto-terciario)' }}>· puedes elegir varias</span></p>
          <div role="group" aria-labelledby="cats-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {categoriasTipo.map(cat => {
              const sel = form.categorias.includes(cat.id)
              return (
                <button
                  key={cat.id}
                  type="button"
                  className="chip"
                  aria-pressed={sel}
                  onClick={() => toggleCategoria(cat.id)}
                  style={sel ? {
                    background: cat.color_hex + '26',
                    borderColor: cat.color_hex,
                    color: 'var(--texto-primario)',
                  } : undefined}
                >
                  {sel
                    ? <Icono nombre="check" size={14} grosor={2.6} style={{ color: cat.color_hex }} />
                    : <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color_hex }} />}
                  {cat.nombre}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="campo">
        <label className="label" htmlFor="notas">Notas <span style={{ color: 'var(--texto-terciario)' }}>· opcional</span></label>
        <textarea
          id="notas"
          className="input"
          placeholder="Agrega un detalle si quieres…"
          value={form.notas}
          onChange={set('notas')}
          rows={3}
        />
      </div>
    </>
  )
}
