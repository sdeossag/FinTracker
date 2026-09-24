// Formulario compartido por Nueva y Editar transacción.
// Patrón de iOS para crear algo (Calendario, Contactos): tipo y monto arriba,
// y los datos en una lista agrupada — etiqueta a la izquierda, valor a la derecha.
import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import Icono from './Icono'
import { CampoMonto, Segmentado } from './Controles'
import { COLOR_TIPO, TIPOS_TRANSACCION, conTipo, usaDestino, usaOrigen } from '../utils/transaccion'
import { esDeuda } from '../utils/cuentas'

// [origen, destino] según el tipo
const ETIQUETA_CUENTA = {
  gasto: ['Pagado con', null],
  ingreso: [null, 'Entra a'],
  ahorro: ['Sale de', 'Entra a'],
  transferencia: ['Desde', 'Hacia'],
}

const GRUPOS_CUENTA = [
  { etiqueta: 'Cuentas', tipos: ['activo'] },
  { etiqueta: 'Tarjetas de crédito', tipos: ['credito'] },
  { etiqueta: 'Deudas', tipos: ['pasivo'] },
]

export default function TransaccionForm({
  form, onCambio, cuentas, categorias, errores = {}, autoFocusMonto = false, cargando = false,
}) {
  const set = (campo) => (e) => onCambio({ [campo]: e.target.value })
  const categoriasTipo = categorias.filter(c => c.tipo === form.tipo)
  const color = COLOR_TIPO[form.tipo]

  const toggleCategoria = (id) => onCambio({
    categorias: form.categorias.includes(id)
      ? form.categorias.filter(c => c !== id)
      : [...form.categorias, id],
  })

  // Con tarjetas o deudas, el selector agrupa para que se vea qué es cada cuenta
  const grupos = GRUPOS_CUENTA
    .map(g => ({ ...g, lista: cuentas.filter(c => g.tipos.includes(c.tipo)) }))
    .filter(g => g.lista.length > 0)
  const opcion = c => <option key={c.id} value={c.id}>{c.nombre}</option>
  const cuentaDe = (campo) => cuentas.find(c => String(c.id) === String(form[campo]))

  const ayudaCuenta = (campo) => {
    const c = cuentaDe(campo)
    if (!c) return null
    if (campo === 'cuenta_origen' && form.tipo === 'gasto' && c.tipo === 'credito') {
      return 'Queda como deuda en la tarjeta. Cuando la pagues, registra una transferencia.'
    }
    if (campo === 'cuenta_destino' && form.tipo === 'transferencia' && esDeuda(c.tipo)) {
      return 'Pago de deuda: no cuenta como gasto, porque lo que compraste ya se contó.'
    }
    return null
  }

  const filaCuenta = (campo, etiqueta) => {
    const c = cuentaDe(campo)
    return (
      <div className={`fila-campo tocable${errores[campo] ? ' invalida' : ''}`}>
        <span className="fila-campo-label" aria-hidden="true">{etiqueta}</span>
        <span className={`fila-campo-valor${c ? '' : ' vacio'}`} aria-hidden="true">
          {c && <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color_hex, flexShrink: 0 }} />}
          <span className="nombre">{c ? c.nombre : 'Elegir'}</span>
          <Icono nombre="chevron-down" size={14} grosor={2.4} style={{ flexShrink: 0, color: 'var(--texto-terciario)' }} />
        </span>
        <select
          id={campo}
          className="selector-oculto"
          value={form[campo]}
          onChange={set(campo)}
          aria-label={etiqueta}
          aria-invalid={!!errores[campo] || undefined}
          aria-describedby={errores[campo] ? `${campo}-error` : undefined}
        >
          <option value="">Elegir cuenta…</option>
          {grupos.length > 1
            ? grupos.map(g => <optgroup key={g.etiqueta} label={g.etiqueta}>{g.lista.map(opcion)}</optgroup>)
            : cuentas.map(opcion)}
        </select>
      </div>
    )
  }

  const camposCuenta = [
    usaOrigen(form.tipo) && ['cuenta_origen', ETIQUETA_CUENTA[form.tipo][0]],
    usaDestino(form.tipo) && ['cuenta_destino', ETIQUETA_CUENTA[form.tipo][1]],
  ].filter(Boolean)

  // Errores y ayudas del grupo, debajo de la lista (como el pie de sección de iOS)
  const avisos = [
    errores.nombre && { id: 'nombre-error', texto: errores.nombre, error: true },
    ...camposCuenta.map(([campo]) => errores[campo]
      ? { id: `${campo}-error`, texto: errores[campo], error: true }
      : ayudaCuenta(campo) && { id: `${campo}-ayuda`, texto: ayudaCuenta(campo) }),
  ].filter(Boolean)

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
      <div style={{ padding: '26px 0 24px', textAlign: 'center' }}>
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
        {errores.monto && <p id="monto-error" className="campo-error" style={{ textAlign: 'center' }}>{errores.monto}</p>}
      </div>

      {!cargando && cuentas.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: 'var(--acento)', display: 'flex' }}><Icono nombre="info" /></span>
          <p className="texto-nota" style={{ flex: 1 }}>Necesitas al menos una cuenta para registrar movimientos.</p>
          <Link to="/cuentas" className="btn-texto" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Crear</Link>
        </div>
      )}

      {/* Detalle */}
      <div className="lista-grupo">
        <div className={`fila-campo${errores.nombre ? ' invalida' : ''}`}>
          <input
            id="nombre"
            className="campo-inline"
            placeholder="Descripción (Ej: almuerzo, Uber)"
            aria-label="Descripción"
            value={form.nombre}
            onChange={set('nombre')}
            enterKeyHint="done"
            autoCapitalize="sentences"
            aria-invalid={!!errores.nombre || undefined}
            aria-describedby={errores.nombre ? 'nombre-error' : undefined}
          />
        </div>
        <label className="fila-campo" htmlFor="fecha">
          <span className="fila-campo-label">Fecha</span>
          <input id="fecha" className="fecha-pildora" type="date" value={form.fecha} onChange={set('fecha')} required />
        </label>
        {camposCuenta.map(([campo, etiqueta]) => <Fragment key={campo}>{filaCuenta(campo, etiqueta)}</Fragment>)}
      </div>
      {avisos.length > 0 && (
        <div className="form-avisos">
          {avisos.map(a => <p key={a.id} id={a.id} className={a.error ? 'campo-error' : 'campo-ayuda'} style={{ margin: 0 }}>{a.texto}</p>)}
        </div>
      )}

      {categoriasTipo.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <h2 className="seccion-label" id="cats-label">Categorías</h2>
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
          <p className="seccion-pie">Puedes elegir varias.</p>
        </section>
      )}

      <div className="lista-grupo" style={{ marginTop: 26 }}>
        <div className="fila-campo">
          <textarea
            id="notas"
            className="campo-inline"
            placeholder="Notas (opcional)"
            aria-label="Notas"
            value={form.notas}
            onChange={set('notas')}
            rows={3}
          />
        </div>
      </div>
    </>
  )
}
