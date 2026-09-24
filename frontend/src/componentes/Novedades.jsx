// "Novedades": se abre sola una vez por versión, la primera vez que la persona entra
// después de actualizar. Estilo "What's New" de iOS: título grande, filas con ícono
// de color y un solo botón. Las cuentas nuevas no la ven (para ellas todo es nuevo):
// el registro y el onboarding la marcan como vista.
// Se marca como vista apenas se muestra (no al cerrarla): así, aunque cierres la app
// con la hoja abierta, no vuelve a salir.
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import Icono from './Icono'
import { hayNovedades, marcarNovedadesVistas } from '../utils/novedades'

const NOVEDADES = [
  { icono: 'calendario', color: '#FF9F0A', titulo: 'Compras a cuotas',
    texto: 'Al pagar con tarjeta de crédito eliges en cuántas cuotas. Cada mes solo cuenta la cuota: la tarjeta te muestra cuánto va y cuánto falta de cada compra.' },
  { icono: 'objetivo', color: '#30D158', titulo: 'Puedes gastar hoy',
    texto: 'En Inicio ves cuánto puedes gastar hoy y por día hasta tu próximo sueldo, ya descontando tarjetas y pagos que vienen. Tócalo para ver el cálculo.' },
  { icono: 'tarjeta', color: '#BF5AF2', titulo: 'Tarjetas de crédito',
    texto: 'Agrega tu tarjeta con el día de corte y de pago. Te decimos cuánto pagar y hasta cuándo, y te avisamos en Inicio cuando se acerca la fecha.' },
  { icono: 'transferencia', color: '#0A84FF', titulo: 'Pagar la tarjeta no es un gasto',
    texto: 'Nuevo tipo "Transferir" para mover plata entre tus cuentas. Pagar la tarjeta ya no cuenta doble: el gasto se contó cuando compraste.' },
  { icono: 'mensaje', color: '#30D158', titulo: 'Tus compras se anotan solas',
    texto: 'Conecta un atajo del iPhone y cada SMS de Bancolombia o Nequi se registra solo, con su categoría. Configuración → Registrar desde SMS del banco.' },
  { icono: 'bandeja', color: '#FF9F0A', titulo: 'Por revisar',
    texto: 'Si llega un SMS de una tarjeta que no conozco, te pregunto una sola vez de qué cuenta es y desde ahí entra solo.' },
  { icono: 'search', color: '#64D2FF', titulo: 'Historial más rápido',
    texto: 'Carga al instante aunque tengas años de movimientos, y la búsqueda encuentra cualquiera, no solo los recientes.' },
  { icono: 'lapiz', color: '#FF375F', titulo: 'Registrar es más cómodo',
    texto: 'Nueva pantalla para crear y editar movimientos: Cancelar y Guardar siempre a mano, y los datos en una lista como en Ajustes.' },
]

const NOTAS = [
  'La sesión ya no se cierra sola cada rato: te mantiene adentro 30 días mientras uses la app.',
  'Los saldos de deudas se corrigieron: lo que debes ahora resta de tu patrimonio, como debe ser.',
  'Si tenías una tarjeta guardada como "Pasivo", edítala en Cuentas y cámbiala a "Tarjeta" con sus fechas.',
  'En iPhone, borra FinTracker de la pantalla de inicio y agrégalo de nuevo desde Safari: así ves el ícono nuevo y la app ocupa toda la pantalla, sin la franja negra de abajo.',
  'La barra de abajo ya no se descuadra y se esconde cuando escribes.'
]

export default function Novedades() {
  const [abierta, setAbierta] = useState(false)

  useEffect(() => {
    let vivo = true
    hayNovedades().then(mostrar => {
      if (!vivo || !mostrar) return
      marcarNovedadesVistas()
      setAbierta(true)
    })
    return () => { vivo = false }
  }, [])

  const cerrar = () => setAbierta(false)

  return (
    <Sheet
      abierto={abierta}
      onCerrar={cerrar}
      pie={<button className="btn-primario" onClick={cerrar}>Continuar</button>}
    >
      <p className="texto-nota" style={{ color: 'var(--acento)', fontWeight: 600, marginBottom: 2 }}>Actualización</p>
      <h2 className="titulo-grande" style={{ marginBottom: 6 }}>Novedades</h2>
      <p className="texto-callout" style={{ color: 'var(--texto-secundario)', marginBottom: 24 }}>
        Esto es lo que cambió en FinTracker.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28 }}>
        {NOVEDADES.map(({ icono, color, titulo, texto }, i) => (
          // Entrada escalonada: se ve una sola vez, así que aquí sí cabe un poco de encanto
          <div key={titulo} className="aparecer" style={{ display: 'flex', gap: 14, animationDelay: `${120 + i * 45}ms` }}>
            <span className="mosaico" style={{ width: 40, height: 40, borderRadius: 12, background: color, color: '#fff' }}>
              <Icono nombre={icono} size={21} grosor={2} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="texto-cuerpo" style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>{titulo}</span>
              <span className="texto-nota" style={{ display: 'block', lineHeight: 1.45 }}>{texto}</span>
            </span>
          </div>
        ))}
      </div>

      <h3 className="seccion-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icono nombre="info" size={14} grosor={2.2} /> Notas de la actualización
      </h3>
      <div className="card" style={{ padding: '14px 16px', marginBottom: 8 }}>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {NOTAS.map(n => <li key={n} className="texto-nota" style={{ lineHeight: 1.45 }}>{n}</li>)}
        </ul>
      </div>
    </Sheet>
  )
}
