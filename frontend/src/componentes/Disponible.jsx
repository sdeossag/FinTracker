// "Puedes gastar hoy": la cifra más útil de la app, arriba en Inicio.
// Tocarla abre el cálculo completo, para que el número se entienda y se confíe.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sheet from './Sheet'
import Icono from './Icono'
import { formatCOP } from '../utils/formato'
import { fechaCorta } from '../utils/cuentas'

const COLOR = {
  bien: 'var(--ingreso)',
  justo: 'var(--ahorro)',
  pasado: 'var(--gasto)',
  negativo: 'var(--gasto)',
}

export default function Disponible({ datos }) {
  const [abierto, setAbierto] = useState(false)
  if (!datos) return null

  const { estado, por_dia, gastado_hoy, queda_hoy, dias_restantes, proximo_ingreso, disponible } = datos
  const color = COLOR[estado]
  const hasta = proximo_ingreso.nombre
    ? `${proximo_ingreso.nombre.toLowerCase()} (${fechaCorta(proximo_ingreso.fecha)})`
    : `el ${fechaCorta(proximo_ingreso.fecha)}`
  const uso = por_dia > 0 ? Math.min(gastado_hoy / por_dia, 1) : 1

  let etiqueta = 'Puedes gastar hoy'
  let cifra = queda_hoy
  let detalle = `${formatCOP(por_dia)} al día · ${dias_restantes} ${dias_restantes === 1 ? 'día' : 'días'} hasta ${hasta}`
  if (estado === 'negativo') {
    etiqueta = 'Te falta plata'
    cifra = -disponible
    detalle = `Tus deudas y pagos superan lo que tienes hasta ${hasta}`
  } else if (estado === 'pasado') {
    etiqueta = 'Hoy te pasaste'
    cifra = -queda_hoy
    detalle = `Lo que queda se reparte en menos por día hasta ${hasta}`
  }

  return (
    <>
      <button
        className="card disponible"
        onClick={() => setAbierto(true)}
        aria-label={`${etiqueta}: ${formatCOP(cifra)}. ${detalle}. Ver cómo se calcula`}
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="texto-nota" style={{ fontWeight: 600 }}>{etiqueta}</span>
          <Icono nombre="chevron-right" size={16} grosor={2.2} style={{ color: 'var(--texto-cuaternario)' }} />
        </span>
        <span className="cifra-hero" style={{ display: 'block', fontSize: 'clamp(1.9rem, 9vw, 2.3rem)', color, margin: '2px 0 12px' }}>
          {formatCOP(Math.max(cifra, 0))}
        </span>
        {estado !== 'negativo' && (
          <span className="progress-track" style={{ display: 'block', marginBottom: 10 }} role="presentation">
            <span className="progress-fill" style={{ display: 'block', transform: `scaleX(${uso})`, background: color }} />
          </span>
        )}
        <span className="texto-mini" style={{ display: 'block', color: 'var(--texto-secundario)' }}>{detalle}</span>
      </button>

      <Sheet abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Cómo se calcula">
        <Calculo datos={datos} onCerrar={() => setAbierto(false)} />
      </Sheet>
    </>
  )
}

function Calculo({ datos, onCerrar }) {
  const navigate = useNavigate()
  const { desglose, disponible, dias_restantes, por_dia, gastado_hoy, proximo_ingreso } = datos
  const fecha = fechaCorta(proximo_ingreso.fecha)

  return (
    <>
      <div className="lista-grupo" style={{ background: 'var(--card-hover)' }}>
        <Fila titulo="En tus cuentas" valor={formatCOP(desglose.cuentas)} />
        <Fila titulo="Deuda de tarjetas" valor={`−${formatCOP(desglose.tarjetas)}`} apagado={!desglose.tarjetas} />
        <Fila titulo={`Pagos antes del ${fecha}`} valor={`−${formatCOP(desglose.pendientes)}`} apagado={!desglose.pendientes} />
        {desglose.lista_pendientes.map((p, i) => (
          <Fila key={i} sub titulo={`${p.nombre} · ${fechaCorta(p.fecha)}`} valor={formatCOP(p.monto)} />
        ))}
        <Fila fuerte titulo="Plata para gastar" valor={formatCOP(disponible)} color={disponible < 0 ? 'var(--gasto)' : undefined} />
      </div>

      <div className="lista-grupo" style={{ background: 'var(--card-hover)', marginTop: 14 }}>
        <Fila
          titulo={`÷ ${dias_restantes} ${dias_restantes === 1 ? 'día' : 'días'}`}
          sub2={proximo_ingreso.nombre ? `Hasta ${proximo_ingreso.nombre} · ${fecha}` : `Hasta tu nuevo período · ${fecha}`}
          valor={`${formatCOP(por_dia)} al día`}
          fuerte
        />
        <Fila titulo="Gastado hoy" valor={formatCOP(gastado_hoy)} />
      </div>

      <p className="campo-ayuda" style={{ margin: '14px 4px 16px' }}>
        {proximo_ingreso.fuente === 'periodo'
          ? 'Crea tu sueldo como transacción recurrente de ingreso y calcularé hasta el día en que te pagan. '
          : ''}
        Las cuentas de ahorro puedes dejarlas fuera: Cuentas → editar → "Plata para gastar".
      </p>
      <button className="btn-secundario" onClick={() => { onCerrar(); navigate('/cuentas') }}>Ir a Cuentas</button>
    </>
  )
}

function Fila({ titulo, valor, sub, sub2, fuerte, apagado, color }) {
  return (
    <div className="fila" style={{ minHeight: sub ? 36 : 48, paddingLeft: sub ? 32 : 16, opacity: apagado ? 0.5 : 1 }}>
      <div className="fila-cuerpo">
        <p className={sub ? 'texto-nota' : 'texto-cuerpo'} style={{ fontWeight: fuerte ? 600 : 400 }}>{titulo}</p>
        {sub2 && <p className="fila-sub">{sub2}</p>}
      </div>
      <span className="cifra" style={{
        flexShrink: 0, fontWeight: fuerte ? 700 : 500, fontSize: sub ? 13 : 16,
        color: color || (sub ? 'var(--texto-secundario)' : 'var(--texto-primario)'),
      }}>
        {valor}
      </span>
    </div>
  )
}
