import { useNavigate } from 'react-router-dom'

const pasos = [
  {
    icono: '🏦',
    titulo: 'Crea tus cuentas',
    desc: 'Agrega tus cuentas bancarias, efectivo, tarjetas o deudas para tener todo en un lugar.',
  },
  {
    icono: '🏷️',
    titulo: 'Define categorías',
    desc: 'Crea categorías de gastos e ingresos para organizar y entender tus movimientos.',
  },
  {
    icono: '📈',
    titulo: 'Registra y controla',
    desc: 'Añade transacciones diarias y ve tu situación financiera en tiempo real.',
  },
]

export default function Onboarding({ username }) {
  const navigate = useNavigate()
  const nombre = username || 'por aquí'

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Saludo */}
      <div style={{ textAlign: 'center', marginBottom: 36, paddingTop: 8 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '22px',
          background: 'var(--acento)', margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}>
          💰
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>
          Bienvenido, {nombre}
        </h1>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 15, lineHeight: '1.6', maxWidth: 300, margin: '0 auto' }}>
          Tu centro de control financiero está listo. Empieza en 3 pasos.
        </p>
      </div>

      {/* Pasos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {pasos.map((paso, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '14px',
              background: 'var(--card-hover)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {paso.icono}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--acento)',
                  background: 'rgba(99,102,241,0.12)', borderRadius: 20, padding: '2px 8px',
                }}>
                  PASO {i + 1}
                </span>
              </div>
              <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{paso.titulo}</p>
              <p style={{ color: 'var(--texto-secundario)', fontSize: 13, lineHeight: '1.5' }}>{paso.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <button
        onClick={() => navigate('/cuentas')}
        className="btn-primario"
        style={{ width: '100%', padding: '15px', fontSize: 16, fontWeight: 600, marginBottom: 12 }}
      >
        Crear primera cuenta →
      </button>
      <button
        onClick={() => navigate('/presupuesto')}
        className="btn-secundario"
        style={{ width: '100%', padding: '13px', fontSize: 15 }}
      >
        Configurar categorías
      </button>
    </div>
  )
}
