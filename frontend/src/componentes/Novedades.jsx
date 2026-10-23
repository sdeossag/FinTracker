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

const HAY_ATAJO = !!import.meta.env.VITE_ATAJO_URL

const NOVEDADES = [
  { icono: 'objetivo', color: '#30D158', titulo: 'Tope semanal',
    texto: 'Ponle un máximo a lo que gastas de lunes a domingo. En Inicio ves cuánto llevas, cuánto te queda y qué día gastaste más.' },
  { icono: 'campana', color: '#FF453A', titulo: 'Avisos del tope',
    texto: 'Te avisamos al llegar al 80 % y si te pasas, y cada lunes te contamos cómo cerró la semana. Actívalos en Configuración → Notificaciones.' },
  { icono: 'etiqueta', color: '#FF9F0A', titulo: 'Los gastos fijos, aparte',
    texto: 'En Presupuesto → Semana apaga categorías como arriendo o colegio: así el tope mide tu día a día. Las compras a cuotas cuentan solo la cuota.' },
  { icono: 'lista', color: '#64D2FF', titulo: 'Historial de la semana',
    texto: 'Nuevo filtro "Esta semana" en el Historial, también desde el detalle del tope.' },
  ...(HAY_ATAJO ? [{ icono: 'mensaje', color: '#0A84FF', titulo: 'El atajo, en un toque',
    texto: 'Instálalo desde Configuración → Registrar desde SMS del banco, pega tu token y crea la automatización.' }] : []),
]

const NOTAS = [
  'En iPhone, FinTracker ahora se dibuja detrás de la hora y del notch. Para verlo, borra la app de la pantalla de inicio y agrégala de nuevo desde Safari.',
  'Las versiones nuevas llegan apenas abres la app, sin tener que abrirla dos veces.',
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
