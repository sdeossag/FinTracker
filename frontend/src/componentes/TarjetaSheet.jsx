// Detalle de una tarjeta de crédito: cuánto debes, qué pagar y hasta cuándo
import { useNavigate } from 'react-router-dom'
import Sheet from './Sheet'
import Icono from './Icono'
import { formatCOP } from '../utils/formato'
import { COLOR_TONO, fechaCorta, plazo, resumenTarjeta, rutaPagarTarjeta, tituloFecha } from '../utils/cuentas'

// Mosaico del estado: color sólido, icono con el contraste que pide cada fondo
const FONDO_ESTADO = { ok: 'var(--ingreso)', peligro: 'var(--gasto)', alerta: 'var(--ahorro)', neutro: 'var(--acento)' }
const TINTA_ESTADO = { ok: '#000', peligro: '#fff', alerta: '#000', neutro: '#fff' }

export default function TarjetaSheet({ tarjeta, abierto, onCerrar, onEditar }) {
  const navigate = useNavigate()
  const e = tarjeta?.estado_tarjeta

  const pagar = () => navigate(rutaPagarTarjeta(tarjeta, e?.por_pagar || 0))

  return (
    <Sheet
      abierto={abierto && !!tarjeta}
      onCerrar={onCerrar}
      titulo={tarjeta?.nombre}
      pie={tarjeta && (
        <>
          <button className="btn-primario" onClick={pagar}>
            {e?.por_pagar > 0 ? `Pagar ${formatCOP(e.por_pagar)}` : 'Registrar un pago'}
          </button>
          <button className="btn-secundario" onClick={onEditar}>Editar tarjeta</button>
        </>
      )}
    >
      {tarjeta && <Detalle tarjeta={tarjeta} e={e} />}
    </Sheet>
  )
}

function Detalle({ tarjeta, e }) {
  const deuda = Math.max(tarjeta.balance_actual, 0)
  const cupo = tarjeta.cupo
  const uso = cupo ? Math.min(deuda / cupo, 1) : null
  const resumen = resumenTarjeta(e)

  if (!e) return (
    <p className="texto-nota">Agrega el día de corte y de pago para ver cuánto pagar cada mes.</p>
  )

  return (
    <>
      {/* Lo que debes, y cuánto cupo queda */}
      <section aria-label="Deuda" style={{ marginBottom: 22 }}>
        <p className="texto-nota" style={{ marginBottom: 2 }}>Deuda total</p>
        <p className="cifra-hero" style={{ fontSize: 'clamp(1.9rem, 9vw, 2.4rem)' }}>{formatCOP(deuda)}</p>
        {uso !== null && (
          <div style={{ marginTop: 14 }}>
            <div
              className="progress-track"
              role="meter"
              aria-label="Cupo usado"
              aria-valuemin={0}
              aria-valuemax={cupo}
              aria-valuenow={deuda}
              style={{ height: 8, borderRadius: 4 }}
            >
              <div className="progress-fill" style={{
                transform: `scaleX(${uso})`,
                background: uso > 0.9 ? 'var(--gasto)' : uso > 0.7 ? 'var(--ahorro)' : tarjeta.color_hex,
              }} />
            </div>
            <div className="texto-mini" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, gap: 12 }}>
              <span>{Math.round(uso * 100)}% de {formatCOP(cupo)}</span>
              <span className="cifra" style={{ color: 'var(--texto-secundario)' }}>Disponible {formatCOP(Math.max(e.cupo_disponible, 0))}</span>
            </div>
          </div>
        )}
      </section>

      {/* El pago del extracto: lo más importante, primero */}
      <div className="lista-grupo" style={{ background: 'var(--card-hover)', marginBottom: 12 }}>
        <div className="fila" style={{ alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>
          <span className="mosaico sm" style={{ background: FONDO_ESTADO[resumen.tono], color: TINTA_ESTADO[resumen.tono] }}>
            <Icono nombre={e.situacion === 'al_dia' ? 'check' : e.situacion === 'vencida' ? 'alerta' : 'calendario'} size={17} grosor={2.2} />
          </span>
          <div className="fila-cuerpo">
            <p className="fila-titulo" style={{ fontWeight: 600 }}>
              {e.situacion === 'al_dia' ? 'Estás al día' : e.situacion === 'vencida' ? 'Pago vencido' : 'Para pagar'}
            </p>
            <p className="fila-sub" style={{ whiteSpace: 'normal', color: COLOR_TONO[resumen.tono] }}>
              {e.situacion === 'al_dia'
                ? `Nada pendiente del corte del ${fechaCorta(e.ultimo_corte)}`
                : `${e.situacion === 'vencida' ? 'Venció' : 'Antes del'} ${tituloFecha(e.fecha_limite).toLowerCase()} · ${plazo(e.dias_para_pagar)}`}
            </p>
          </div>
          {e.por_pagar > 0 && (
            <span className="cifra" style={{ fontWeight: 700, fontSize: 17, flexShrink: 0 }}>{formatCOP(e.por_pagar)}</span>
          )}
        </div>
      </div>

      <div className="lista-grupo" style={{ background: 'var(--card-hover)' }}>
        <Dato titulo="Compras desde el corte" sub={`Se cobran en el corte del ${fechaCorta(e.proximo_corte)}`} valor={formatCOP(e.compras_del_ciclo)} />
        {e.abonos_del_ciclo > 0 && (
          <Dato titulo="Pagado desde el corte" valor={formatCOP(e.abonos_del_ciclo)} color="var(--ingreso)" />
        )}
        <Dato titulo="Último corte" valor={fechaCorta(e.ultimo_corte)} />
        <Dato titulo="Próximo corte" valor={fechaCorta(e.proximo_corte)} />
      </div>

      {/* Compras a cuotas: cuánto va y cuánto falta de cada una */}
      {e.compras_a_cuotas?.length > 0 && (
        <section aria-label="Compras a cuotas" style={{ marginTop: 22 }}>
          <h3 className="seccion-label">Compras a cuotas</h3>
          <div className="lista-grupo" style={{ background: 'var(--card-hover)' }}>
            {e.compras_a_cuotas.map((c, i) => {
              const falta = c.monto - Math.round(c.monto * c.facturadas / c.cuotas)
              return (
                <div key={i} className="fila" style={{ alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                  <div className="fila-cuerpo">
                    <p className="texto-cuerpo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</p>
                    <p className="fila-sub" style={{ whiteSpace: 'normal' }}>
                      {c.facturadas === 0 ? `${c.cuotas} cuotas, la primera en el próximo corte` : `Van ${c.facturadas} de ${c.cuotas} cuotas`}
                      {' · '}{formatCOP(c.cuota)} al mes
                    </p>
                    <div className="progress-track" role="presentation" style={{ marginTop: 8, height: 4 }}>
                      <div className="progress-fill" style={{ transform: `scaleX(${c.facturadas / c.cuotas})`, background: tarjeta.color_hex }} />
                    </div>
                  </div>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="cifra" style={{ display: 'block', fontWeight: 600 }}>{formatCOP(falta)}</span>
                    <span className="texto-mini">por cobrar</span>
                  </span>
                </div>
              )
            })}
          </div>
          <p className="campo-ayuda">
            Cada mes solo entra la cuota al pago. {e.diferido > 0 && `Quedan ${formatCOP(e.diferido)} para los meses siguientes. `}Sin contar intereses.
          </p>
        </section>
      )}
    </>
  )
}

function Dato({ titulo, sub, valor, color }) {
  return (
    <div className="fila" style={{ minHeight: 48 }}>
      <div className="fila-cuerpo">
        <p className="texto-cuerpo">{titulo}</p>
        {sub && <p className="fila-sub">{sub}</p>}
      </div>
      <span className="cifra" style={{ color: color || 'var(--texto-secundario)', flexShrink: 0 }}>{valor}</span>
    </div>
  )
}
