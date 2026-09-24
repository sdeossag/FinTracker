import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import api, { ensureArray } from '../api'
import Pagina from '../componentes/Pagina'
import Icono from '../componentes/Icono'
import Sheet, { ConfirmarSheet } from '../componentes/Sheet'
import TarjetaSheet from '../componentes/TarjetaSheet'
import { AvisoError, CampoMonto, EstadoVacio, Interruptor, Segmentado, SelectorColor } from '../componentes/Controles'
import { formatCOP } from '../utils/formato'
import {
  AYUDA_TIPO_CUENTA, COLOR_TONO, TIPOS_CUENTA, esDeuda, patrimonio, resumenTarjeta,
} from '../utils/cuentas'

const COLORES = ['#34C759', '#0A84FF', '#BF5AF2', '#FF9F0A', '#FFD60A', '#FF453A', '#64D2FF', '#FF375F']
const cuentaVacia = {
  nombre: '', tipo: 'activo', balance_inicial: '', color_hex: '#0A84FF',
  cupo: '', dia_corte: '', dia_pago: '', terminaciones: '', incluir_en_disponible: true,
  _balance_actual_ref: 0, _balance_inicial_ref: 0,
}
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)

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
  // La hoja de la tarjeta lee siempre la versión recién cargada
  const [tarjetaId, setTarjetaId] = useState(null)
  const tarjeta = cuentas.find(c => c.id === tarjetaId)

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
      cupo: cuenta.cupo != null ? String(cuenta.cupo) : '',
      dia_corte: cuenta.dia_corte ? String(cuenta.dia_corte) : '',
      dia_pago: cuenta.dia_pago ? String(cuenta.dia_pago) : '',
      terminaciones: cuenta.terminaciones || '',
      incluir_en_disponible: cuenta.incluir_en_disponible !== false,
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
    if (form.tipo === 'credito' && (!form.dia_corte || !form.dia_pago)) {
      setErrorForm('Elige el día de corte y el día límite de pago. Están en tu extracto.')
      return
    }
    let balanceInicialFinal
    if (editandoId) {
      const balanceActualDeseado = parseInt(form._balance_actual_editable || '0')
      if (isNaN(balanceActualDeseado)) {
        setErrorForm('El saldo debe ser un número.')
        return
      }
      // Recalcula balance_inicial para que balance_actual sea el valor deseado
      const delta = form._balance_actual_ref - form._balance_inicial_ref
      balanceInicialFinal = balanceActualDeseado - delta
    } else {
      balanceInicialFinal = parseInt(form.balance_inicial || '0')
      if (isNaN(balanceInicialFinal)) {
        setErrorForm('El saldo debe ser un número.')
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
        terminaciones: form.terminaciones,
        incluir_en_disponible: form.incluir_en_disponible,
        ...(form.tipo === 'credito' ? {
          cupo: form.cupo ? parseInt(form.cupo) : null,
          dia_corte: parseInt(form.dia_corte),
          dia_pago: parseInt(form.dia_pago),
        } : {}),
      }
      if (editandoId) {
        await api.patch(`/cuentas/${editandoId}/`, datos)
      } else {
        await api.post('/cuentas/', datos)
      }
      await cargar()
      cerrarModal()
      const tipoTexto = form.tipo === 'credito' ? 'Tarjeta' : 'Cuenta'
      toast.success(editandoId ? `${tipoTexto} actualizada` : `${tipoTexto} creada`, { description: datos.nombre })
    } catch (err) {
      const detail = err.response?.data
      const primero = (campo) => Array.isArray(detail?.[campo]) ? detail[campo][0] : null
      setErrorForm(
        (primero('nombre') && `Nombre: ${primero('nombre')}`)
        || primero('dia_corte') || primero('dia_pago') || primero('cupo')
        || primero('non_field_errors') || detail?.detail
        || 'Error al guardar. Revisa que el nombre no esté repetido.',
      )
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
      setTarjetaId(null)
      await cargar()
      toast.success(form.tipo === 'credito' ? 'Tarjeta eliminada' : 'Cuenta eliminada')
    } catch {
      setConfirmAbierto(false)
      toast.error('No se pudo eliminar', { description: 'Revisa tu conexión e intenta de nuevo.' })
    } finally {
      setEliminando(false)
    }
  }

  const activos = cuentas.filter(c => c.tipo === 'activo')
  const tarjetas = cuentas.filter(c => c.tipo === 'credito')
  const deudas = cuentas.filter(c => c.tipo === 'pasivo')
  const balanceTotal = patrimonio(cuentas)
  const esTarjeta = form.tipo === 'credito'

  const fila = (cuenta) => {
    const resumen = cuenta.tipo === 'credito' ? resumenTarjeta(cuenta.estado_tarjeta) : null
    return (
      <button
        key={cuenta.id}
        className="fila"
        style={{ '--sangria': '64px' }}
        onClick={() => cuenta.tipo === 'credito' ? setTarjetaId(cuenta.id) : abrirEditar(cuenta)}
      >
        <span className="mosaico" style={{ background: cuenta.color_hex + '26', color: cuenta.color_hex }}>
          {cuenta.tipo === 'credito'
            ? <Icono nombre="tarjeta" size={19} grosor={2} />
            : <span style={{ width: 12, height: 12, borderRadius: '50%', background: cuenta.color_hex }} />}
        </span>
        <div className="fila-cuerpo">
          <p className="fila-titulo" style={{ fontWeight: 500 }}>{cuenta.nombre}</p>
          {resumen && <p className="fila-sub" style={{ color: COLOR_TONO[resumen.tono] }}>{resumen.texto}</p>}
        </div>
        <span className="cifra" style={{
          fontWeight: 600, fontSize: 16, flexShrink: 0,
          color: esDeuda(cuenta.tipo) && cuenta.balance_actual > 0 ? 'var(--gasto)' : 'var(--texto-primario)',
        }}>
          {formatCOP(cuenta.balance_actual)}
        </span>
        <span className="fila-chevron"><Icono nombre="chevron-right" size={16} grosor={2.2} /></span>
      </button>
    )
  }

  const grupo = (titulo, lista, nota) => lista.length > 0 && (
    <section style={{ marginBottom: 24 }}>
      <h2 className="seccion-label">{titulo}</h2>
      <div className="lista-grupo">{lista.map(fila)}</div>
      {nota && <p className="campo-ayuda" style={{ marginLeft: 16 }}>{nota}</p>}
    </section>
  )

  const porPagarTotal = tarjetas.reduce((s, t) => s + (t.estado_tarjeta?.por_pagar || 0), 0)

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

          {grupo('Cuentas', activos)}
          {grupo('Tarjetas de crédito', tarjetas,
            porPagarTotal > 0 ? `Este mes debes pagar ${formatCOP(porPagarTotal)} en total.` : null)}
          {grupo('Deudas', deudas)}
        </div>
      )}

      <TarjetaSheet
        tarjeta={tarjeta}
        abierto={!!tarjeta}
        onCerrar={() => setTarjetaId(null)}
        onEditar={() => tarjeta && abrirEditar(tarjeta)}
      />

      {/* Crear / editar */}
      <Sheet
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={editandoId ? (esTarjeta ? 'Editar tarjeta' : 'Editar cuenta') : 'Nueva cuenta'}
        pie={
          <>
            <button onClick={guardar} className="btn-primario" disabled={guardando}>
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : esTarjeta ? 'Agregar tarjeta' : 'Crear cuenta'}
            </button>
            {editandoId && (
              <button className="btn-texto peligro" onClick={() => setConfirmAbierto(true)}>
                {esTarjeta ? 'Eliminar tarjeta' : 'Eliminar cuenta'}
              </button>
            )}
          </>
        }
      >
        <div className="campo">
          <p className="label">Tipo</p>
          <Segmentado etiqueta="Tipo de cuenta" opciones={TIPOS_CUENTA} valor={form.tipo}
            onChange={tipo => setForm({ ...form, tipo })} />
          <p className="campo-ayuda">{AYUDA_TIPO_CUENTA[form.tipo]}</p>
        </div>

        <div className="campo">
          <label className="label" htmlFor="cuenta-nombre">Nombre</label>
          <input
            id="cuenta-nombre"
            className="input"
            placeholder={esTarjeta ? 'Ej: Visa Bancolombia' : 'Ej: Nequi, Efectivo, Bancolombia…'}
            value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </div>

        {esTarjeta && (
          <>
            <div className="campo">
              <label className="label" htmlFor="cuenta-cupo">Cupo total <span style={{ color: 'var(--texto-terciario)' }}>· opcional</span></label>
              <CampoMonto id="cuenta-cupo" valor={form.cupo} onChange={v => setForm({ ...form, cupo: v })} />
            </div>

            <div className="campo">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <div>
                  <label className="label" htmlFor="cuenta-corte">Día de corte</label>
                  <select id="cuenta-corte" className="input" value={form.dia_corte}
                    onChange={e => setForm({ ...form, dia_corte: e.target.value })}>
                    <option value="">Elegir…</option>
                    {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="cuenta-pago">Pagar hasta el día</label>
                  <select id="cuenta-pago" className="input" value={form.dia_pago}
                    onChange={e => setForm({ ...form, dia_pago: e.target.value })}>
                    <option value="">Elegir…</option>
                    {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <p className="campo-ayuda">Los dos aparecen en tu extracto. Con ellos calculamos cuánto pagar y te lo recordamos en Inicio.</p>
            </div>
          </>
        )}

        {editandoId ? (
          <div className="campo">
            <label className="label" htmlFor="cuenta-balance">{esDeuda(form.tipo) ? 'Deuda actual' : 'Saldo actual'}</label>
            <CampoMonto
              id="cuenta-balance"
              permitirNegativo={!esDeuda(form.tipo)}
              valor={form._balance_actual_editable}
              onChange={v => setForm({ ...form, _balance_actual_editable: v })}
            />
            <p className="campo-ayuda">Ajústalo al valor real si hay un error o un movimiento sin registrar.</p>
          </div>
        ) : (
          <div className="campo">
            <label className="label" htmlFor="cuenta-balance">{esDeuda(form.tipo) ? 'Lo que debes hoy' : 'Saldo actual'}</label>
            <CampoMonto
              id="cuenta-balance"
              permitirNegativo={!esDeuda(form.tipo)}
              valor={form.balance_inicial}
              onChange={v => setForm({ ...form, balance_inicial: v })}
            />
            {esTarjeta && <p className="campo-ayuda">Todo lo que debes en la tarjeta, incluidas las compras recientes.</p>}
          </div>
        )}

        {form.tipo === 'activo' && (
          <div className="campo">
            <div className="lista-grupo" style={{ background: 'var(--card-hover)' }}>
              <div className="fila" style={{ minHeight: 52 }}>
                <div className="fila-cuerpo">
                  <p className="texto-cuerpo">Plata para gastar</p>
                  <p className="fila-sub">Cuenta en "Puedes gastar hoy"</p>
                </div>
                <Interruptor
                  activo={form.incluir_en_disponible}
                  onChange={v => setForm({ ...form, incluir_en_disponible: v })}
                  etiqueta="Plata para gastar"
                />
              </div>
            </div>
            <p className="campo-ayuda">Apágalo en cuentas de ahorro o bolsillos que no quieres tocar.</p>
          </div>
        )}

        <div className="campo">
          <label className="label" htmlFor="cuenta-terminaciones">
            Números en los SMS <span style={{ color: 'var(--texto-terciario)' }}>· opcional</span>
          </label>
          <input
            id="cuenta-terminaciones"
            className="input"
            placeholder={esTarjeta ? 'Ej: 7992' : 'Ej: 8174, 5284'}
            value={form.terminaciones}
            onChange={e => setForm({ ...form, terminaciones: e.target.value })}
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <p className="campo-ayuda">Los últimos dígitos con que tu banco nombra esta cuenta o tarjeta en los SMS (*7992). Así se registran solos.</p>
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
        titulo={esTarjeta ? '¿Eliminar tarjeta?' : '¿Eliminar cuenta?'}
        mensaje={`"${form.nombre || 'Esta cuenta'}" se eliminará. Sus transacciones se conservan, pero quedarán sin cuenta asociada. No se puede deshacer.`}
        textoConfirmar={esTarjeta ? 'Eliminar tarjeta' : 'Eliminar cuenta'}
        onConfirmar={eliminar}
        cargando={eliminando}
      />
    </Pagina>
  )
}
