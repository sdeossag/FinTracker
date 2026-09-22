import Icono from './Icono'

// Logotipo de la app: la misma marca en inicio, acceso y onboarding
export default function Marca({ size = 34 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: size * 0.3, flexShrink: 0,
      background: 'linear-gradient(135deg, #3da8ff 0%, #0A84FF 45%, #0055CC 100%)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 10px rgba(10,132,255,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
      color: '#fff',
    }}>
      <Icono nombre="grafica" size={size * 0.53} grosor={2.4} />
    </span>
  )
}
