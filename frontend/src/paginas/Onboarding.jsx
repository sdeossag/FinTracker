import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const COLORES = ['#2B7FFF', '#30D158', '#FF453A', '#FFD60A', '#BF5AF2', '#FF9F0A', '#5AC8FA', '#FF375F']

const TOUR = [
  {
    icono: '🏠',
    titulo: 'Inicio',
    desc: 'Ve tu balance total y el resumen del mes: ingresos, gastos y ahorros de un vistazo.',
    ruta: '/',
  },
  {
    icono: '📋',
    titulo: 'Historial',
    desc: 'Revisa todas tus transacciones. Filtra por tipo, mes o busca cualquier movimiento.',
    ruta: '/transacciones',
  },
  {
    icono: '🎯',
    titulo: 'Presupuesto',
    desc: 'Crea límites de gasto por categoría y ve en tiempo real cuánto llevas gastado.',
    ruta: '/presupuesto',
  },
  {
    icono: '⚙️',
    titulo: 'Configuración',
    desc: 'Cambia tu contraseña, vincula Face ID o Touch ID y ajusta el período de tu presupuesto.',
    ruta: '/configuracion',
  },
]

function ProgressDots({ total, actual }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === actual ? 20 : 7,
          height: 7,
          borderRadius: 4,
          background: i === actual ? 'var(--acento)' : 'var(--card-hover)',
          transition: 'all 0.3s ease',
        }} />
      ))}
    </div>
  )
}

function SelectorColor({ valor, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {COLORES.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{
          width: 30, height: 30, borderRadius: '50%', background: c, border: 'none',
          cursor: 'pointer', outline: valor === c ? `3px solid ${c}` : '3px solid transparent',
          outlineOffset: 2, transition: 'outline 0.15s',
        }} />
      ))}
    </div>
  )
}

// ── PASO 1: Bienvenida ────────────────────────────────────────────────────────
function PasoBienvenida({ username, onSiguiente, onSaltar }) {
  const props = [
    { icono: '💳', titulo: 'Tus cuentas', desc: 'Bancos, efectivo, deudas — todo en un lugar.' },
    { icono: '📊', titulo: 'Presupuestos', desc: 'Define límites y ve cuánto llevas en cada categoría.' },
    { icono: '🔎', titulo: 'Historial claro', desc: 'Busca, filtra por mes y tipo de movimiento.' },
  ]

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24, background: 'var(--acento)',
        margin: '0 auto 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 40,
        boxShadow: '0 12px 32px rgba(43,127,255,0.35)',
      }}>
        💰
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>
        Hola, {username || 'bienvenido'}
      </h1>
      <p style={{ color: 'var(--texto-secundario)', fontSize: 15, lineHeight: '1.6', marginBottom: 32 }}>
        Te vamos a guiar en 4 pasos para que saques el máximo provecho de FinTracker.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36, textAlign: 'left' }}>
        {props.map((p, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{p.icono}</span>
            <div>
              <p style={{ fontWeight: 600, fontSize: 15 }}>{p.titulo}</p>
              <p style={{ color: 'var(--texto-secundario)', fontSize: 13, marginTop: 2 }}>{p.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onSiguiente} className="btn-primario" style={{ width: '100%', padding: 15, fontSize: 16, fontWeight: 600 }}>
        Empezar tour →
      </button>
      <button onClick={onSaltar} style={{
        background: 'none', border: 'none', color: 'var(--texto-terciario)',
        fontSize: 14, cursor: 'pointer', marginTop: 16, padding: '8px 0',
      }}>
        Ya conozco la app, saltar
      </button>
    </div>
  )
}

// ── PASO 2: Primera cuenta ────────────────────────────────────────────────────
function PasoCuenta({ onSiguiente, onSaltar }) {
  const [form, setForm] = useState({ nombre: '', tipo: 'activo', balance_inicial: '', color_hex: '#2B7FFF' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [creada, setCreada] = useState(null)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleCrear = async () => {
    if (!form.nombre.trim()) { setError('Escribe un nombre para la cuenta.'); return }
    setError('')
    setCargando(true)
    try {
      const res = await api.post('/cuentas/', { ...form, balance_inicial: parseFloat(form.balance_inicial) || 0 })
      setCreada(res.data)
    } catch (err) {
      const data = err.response?.data
      setError(data?.nombre?.[0] || data?.non_field_errors?.[0] || data?.detail || 'No se pudo crear la cuenta.')
    } finally {
      setCargando(false)
    }
  }

  if (creada) return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>¡Cuenta creada!</h2>
      <div className="card" style={{ margin: '20px 0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: creada.color_hex, flexShrink: 0 }} />
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontWeight: 600 }}>{creada.nombre}</p>
          <p style={{ fontSize: 13, color: 'var(--texto-secundario)' }}>{creada.tipo === 'pasivo' ? 'Pasivo' : 'Activo'}</p>
        </div>
      </div>
      <p style={{ color: 'var(--texto-secundario)', fontSize: 14, marginBottom: 32 }}>
        Puedes agregar más cuentas desde la sección Cuentas en cualquier momento.
      </p>
      <button onClick={onSiguiente} className="btn-primario" style={{ width: '100%', padding: 14, fontSize: 16 }}>
        Siguiente →
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🏦</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Tu primera cuenta</h2>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 14, lineHeight: '1.6' }}>
          Puede ser tu banco, efectivo, una tarjeta o una deuda. Después podrás crear más.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="label" style={{ marginBottom: 6, display: 'block' }}>Nombre</label>
          <input className="input" placeholder="Ej: Bancolombia, Efectivo, Nequi..." value={form.nombre} onChange={set('nombre')} />
        </div>

        <div>
          <label className="label" style={{ marginBottom: 6, display: 'block' }}>Tipo</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['activo', '📈 Activo', 'Dinero que tienes'], ['pasivo', '📉 Pasivo', 'Deuda o crédito']].map(([val, label, hint]) => (
              <button key={val} onClick={() => setForm(f => ({ ...f, tipo: val }))} style={{
                flex: 1, padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
                background: form.tipo === val ? 'var(--acento-suave)' : 'var(--card)',
                border: form.tipo === val ? '1.5px solid var(--acento)' : '0.5px solid var(--borde)',
                color: form.tipo === val ? 'var(--acento)' : 'var(--texto-secundario)',
                textAlign: 'center',
              }}>
                <p style={{ fontWeight: 600, fontSize: 13 }}>{label}</p>
                <p style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" style={{ marginBottom: 6, display: 'block' }}>Balance inicial</label>
          <input className="input" type="number" placeholder="0" value={form.balance_inicial} onChange={set('balance_inicial')} />
        </div>

        <div>
          <label className="label" style={{ marginBottom: 8, display: 'block' }}>Color</label>
          <SelectorColor valor={form.color_hex} onChange={c => setForm(f => ({ ...f, color_hex: c }))} />
        </div>

        {error && (
          <p style={{ color: 'var(--gasto)', fontSize: 13, background: 'var(--gasto-suave)', padding: '10px 14px', borderRadius: 10 }}>
            {error}
          </p>
        )}
      </div>

      <div style={{ marginTop: 28 }}>
        <button onClick={handleCrear} disabled={cargando} className="btn-primario" style={{ width: '100%', padding: 14, fontSize: 16, marginBottom: 12 }}>
          {cargando ? 'Creando...' : 'Crear cuenta'}
        </button>
        <button onClick={onSaltar} style={{
          width: '100%', background: 'none', border: 'none',
          color: 'var(--texto-terciario)', fontSize: 14, cursor: 'pointer', padding: '8px 0',
        }}>
          Saltar este paso
        </button>
      </div>
    </div>
  )
}

// ── PASO 3: Primera categoría ─────────────────────────────────────────────────
function PasoCategoria({ onSiguiente, onSaltar }) {
  const [form, setForm] = useState({ nombre: '', tipo: 'gasto', color_hex: '#FF453A' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [creada, setCreada] = useState(null)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleCrear = async () => {
    if (!form.nombre.trim()) { setError('Escribe un nombre para la categoría.'); return }
    setError('')
    setCargando(true)
    try {
      const res = await api.post('/categorias/', form)
      setCreada(res.data)
    } catch (err) {
      const data = err.response?.data
      setError(data?.nombre?.[0] || data?.non_field_errors?.[0] || data?.detail || 'No se pudo crear la categoría.')
    } finally {
      setCargando(false)
    }
  }

  if (creada) return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🏷️</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>¡Categoría lista!</h2>
      <div className="card" style={{ margin: '20px 0', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: creada.color_hex, flexShrink: 0 }} />
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontWeight: 600 }}>{creada.nombre}</p>
          <p style={{ fontSize: 13, color: 'var(--texto-secundario)' }}>{creada.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</p>
        </div>
      </div>
      <p style={{ color: 'var(--texto-secundario)', fontSize: 14, marginBottom: 32 }}>
        Crea más categorías desde la sección Presupuesto. Úsalas para clasificar cada movimiento.
      </p>
      <button onClick={onSiguiente} className="btn-primario" style={{ width: '100%', padding: 14, fontSize: 16 }}>
        Siguiente →
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🏷️</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Organiza tus movimientos</h2>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 14, lineHeight: '1.6' }}>
          Las categorías te permiten clasificar tus transacciones y ver en qué gastas o ganas más.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="label" style={{ marginBottom: 6, display: 'block' }}>Nombre</label>
          <input className="input" placeholder="Ej: Comida, Transporte, Salario..." value={form.nombre} onChange={set('nombre')} />
        </div>

        <div>
          <label className="label" style={{ marginBottom: 6, display: 'block' }}>Tipo</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['gasto', '↓ Gasto'], ['ingreso', '↑ Ingreso']].map(([val, label]) => (
              <button key={val} onClick={() => setForm(f => ({
                ...f,
                tipo: val,
                color_hex: val === 'gasto' ? '#FF453A' : '#30D158',
              }))} style={{
                flex: 1, padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
                background: form.tipo === val ? 'var(--acento-suave)' : 'var(--card)',
                border: form.tipo === val ? '1.5px solid var(--acento)' : '0.5px solid var(--borde)',
                color: form.tipo === val ? 'var(--acento)' : 'var(--texto-secundario)',
                fontWeight: 600, fontSize: 14,
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" style={{ marginBottom: 8, display: 'block' }}>Color</label>
          <SelectorColor valor={form.color_hex} onChange={c => setForm(f => ({ ...f, color_hex: c }))} />
        </div>

        {error && (
          <p style={{ color: 'var(--gasto)', fontSize: 13, background: 'var(--gasto-suave)', padding: '10px 14px', borderRadius: 10 }}>
            {error}
          </p>
        )}
      </div>

      <div style={{ marginTop: 28 }}>
        <button onClick={handleCrear} disabled={cargando} className="btn-primario" style={{ width: '100%', padding: 14, fontSize: 16, marginBottom: 12 }}>
          {cargando ? 'Creando...' : 'Crear categoría'}
        </button>
        <button onClick={onSaltar} style={{
          width: '100%', background: 'none', border: 'none',
          color: 'var(--texto-terciario)', fontSize: 14, cursor: 'pointer', padding: '8px 0',
        }}>
          Saltar este paso
        </button>
      </div>
    </div>
  )
}

// ── PASO 4: Tour de la app ────────────────────────────────────────────────────
function PasoTour({ onSiguiente }) {
  const [activo, setActivo] = useState(0)

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🗺️</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Conoce tu app</h2>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 14, lineHeight: '1.6' }}>
          FinTracker tiene 4 secciones principales. Toca cada una para explorarla.
        </p>
      </div>

      {/* Cards del tour */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {TOUR.map((item, i) => (
          <button key={i} onClick={() => setActivo(i === activo ? -1 : i)} style={{
            background: 'var(--card)', border: activo === i ? '1.5px solid var(--acento)' : '0.5px solid var(--borde)',
            borderRadius: 16, padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
            transition: 'all 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: activo === i ? 'var(--acento-suave)' : 'var(--card-hover)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>
                {item.icono}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 15, color: activo === i ? 'var(--acento)' : 'var(--texto-primario)' }}>
                  {item.titulo}
                </p>
                {activo === i && (
                  <p style={{ color: 'var(--texto-secundario)', fontSize: 13, marginTop: 4, lineHeight: '1.5' }}>
                    {item.desc}
                  </p>
                )}
              </div>
              <span style={{ color: 'var(--texto-terciario)', fontSize: 18, fontWeight: 300 }}>
                {activo === i ? '−' : '+'}
              </span>
            </div>
          </button>
        ))}
      </div>

      <button onClick={onSiguiente} className="btn-primario" style={{ width: '100%', padding: 14, fontSize: 16 }}>
        Ya lo tengo →
      </button>
    </div>
  )
}

// ── PASO 5: ¡Listo! ───────────────────────────────────────────────────────────
function PasoListo({ username, onEntrar }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>🚀</div>
      <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>¡Todo listo, {username || ''}!</h2>
      <p style={{ color: 'var(--texto-secundario)', fontSize: 15, lineHeight: '1.7', marginBottom: 36 }}>
        Ya tienes todo configurado para empezar. Registra tu primera transacción tocando el botón <strong>+</strong> en la barra inferior.
      </p>

      <div className="card" style={{ padding: '16px 20px', marginBottom: 32, textAlign: 'left' }}>
        {[
          ['➕', 'Toca + para nueva transacción'],
          ['🏦', 'Gestiona cuentas desde la pestaña Cuentas'],
          ['🎯', 'Define presupuestos por categoría'],
          ['🔐', 'Vincula Face ID desde Configuración'],
        ].map(([icon, text], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
            borderBottom: i < 3 ? '0.5px solid var(--separador)' : 'none' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
            <p style={{ fontSize: 14, color: 'var(--texto-secundario)' }}>{text}</p>
          </div>
        ))}
      </div>

      <button onClick={onEntrar} className="btn-primario" style={{ width: '100%', padding: 16, fontSize: 17, fontWeight: 700 }}>
        Entrar al dashboard
      </button>
    </div>
  )
}

// ── Página principal de Onboarding ────────────────────────────────────────────
const TOTAL_PASOS = 5

export default function Onboarding() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState(0)
  const [username, setUsername] = useState('')

  useEffect(() => {
    api.get('/perfil/').then(res => setUsername(res.data?.username || '')).catch(() => {})
  }, [])

  const siguiente = () => setPaso(p => Math.min(p + 1, TOTAL_PASOS - 1))

  const saltar = () => {
    // Si quedan 2 o más pasos, saltar al tour; si está en el tour, saltar a listo
    if (paso <= 2) setPaso(3)
    else setPaso(4)
  }

  const terminar = () => {
    localStorage.setItem('ft_ob_done', 'true')
    navigate('/')
  }

  const pasoActual = () => {
    switch (paso) {
      case 0: return <PasoBienvenida username={username} onSiguiente={siguiente} onSaltar={terminar} />
      case 1: return <PasoCuenta onSiguiente={siguiente} onSaltar={saltar} />
      case 2: return <PasoCategoria onSiguiente={siguiente} onSaltar={saltar} />
      case 3: return <PasoTour onSiguiente={siguiente} />
      case 4: return <PasoListo username={username} onEntrar={terminar} />
      default: return null
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--fondo)',
      padding: '56px 20px 40px',
      maxWidth: 430,
      margin: '0 auto',
    }}>
      <ProgressDots total={TOTAL_PASOS} actual={paso} />
      {pasoActual()}
    </div>
  )
}
