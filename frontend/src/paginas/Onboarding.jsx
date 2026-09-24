import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import api from '../api'
import Icono from '../componentes/Icono'
import Marca from '../componentes/Marca'
import { AvisoError, CampoMonto, SelectorColor } from '../componentes/Controles'
import { capitalizar } from '../utils/formato'
import { irArriba } from '../utils/scroll'
import { marcarNovedadesVistas } from '../utils/novedades'

const COLORES = ['#0A84FF', '#30D158', '#FF453A', '#FFD60A', '#BF5AF2', '#FF9F0A', '#5AC8FA', '#FF375F']

const TOUR = [
  { icono: 'inicio', color: '#0A84FF', titulo: 'Inicio', desc: 'Tu balance total y el resumen del mes: ingresos, gastos y ahorros de un vistazo.' },
  { icono: 'lista', color: '#30D158', titulo: 'Historial', desc: 'Todas tus transacciones. Filtra por tipo o mes, o busca cualquier movimiento.' },
  { icono: 'objetivo', color: '#FF9F0A', titulo: 'Presupuesto', desc: 'Límites de gasto por categoría y cuánto llevas gastado en tiempo real.' },
  { icono: 'ajustes', color: '#8E8E93', titulo: 'Configuración', desc: 'Cambia tu contraseña, vincula Face ID o huella y ajusta el período del presupuesto.' },
]

function Cabecera({ icono, color, titulo, texto }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <span className="mosaico xl" style={{ background: color + '26', color, margin: '0 auto 18px' }}>
        <Icono nombre={icono} size={34} />
      </span>
      <h2 className="titulo-2" style={{ marginBottom: 8 }}>{titulo}</h2>
      <p className="texto-callout" style={{ color: 'var(--texto-secundario)' }}>{texto}</p>
    </div>
  )
}

function Hecho({ titulo, item, texto, onSiguiente }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <span className="mosaico xl" style={{ background: 'var(--ingreso-suave)', color: 'var(--ingreso)', margin: '0 auto 18px' }}>
        <Icono nombre="check" size={34} grosor={2.4} />
      </span>
      <h2 className="titulo-2" style={{ marginBottom: 20 }}>{titulo}</h2>
      <div className="lista-grupo" style={{ marginBottom: 16, textAlign: 'left' }}>
        <div className="fila">
          <span className="mosaico" style={{ background: item.color + '26' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }} />
          </span>
          <div className="fila-cuerpo">
            <p className="fila-titulo" style={{ fontWeight: 500 }}>{item.nombre}</p>
            <p className="fila-sub">{item.sub}</p>
          </div>
        </div>
      </div>
      <p className="texto-nota" style={{ marginBottom: 32 }}>{texto}</p>
      <button onClick={onSiguiente} className="btn-primario">Continuar</button>
    </div>
  )
}

function OpcionTipo({ activa, titulo, hint, onClick }) {
  return (
    <button type="button" role="radio" aria-checked={activa} onClick={onClick} style={{
      flex: 1, padding: '12px 10px', borderRadius: 14, textAlign: 'center',
      background: activa ? 'var(--acento-suave)' : 'var(--card)',
      boxShadow: activa ? 'inset 0 0 0 1.5px var(--acento)' : 'inset 0 0 0 0.5px var(--borde)',
      color: activa ? 'var(--acento)' : 'var(--texto-secundario)',
      transition: 'background-color 180ms ease, box-shadow 180ms ease, color 180ms ease',
    }}>
      <p style={{ fontWeight: 600, fontSize: 15 }}>{titulo}</p>
      {hint && <p style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{hint}</p>}
    </button>
  )
}

// ── PASO 1: Bienvenida ────────────────────────────────────────────────────────
function PasoBienvenida({ username, onSiguiente, onSaltar }) {
  const props = [
    { icono: 'tarjeta', color: '#0A84FF', titulo: 'Tus cuentas', desc: 'Bancos, efectivo, deudas — todo en un lugar.' },
    { icono: 'objetivo', color: '#FF9F0A', titulo: 'Presupuestos', desc: 'Define límites y ve cuánto llevas en cada categoría.' },
    { icono: 'search', color: '#30D158', titulo: 'Historial claro', desc: 'Busca y filtra por mes y tipo de movimiento.' },
  ]

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}><Marca size={76} /></div>
        <h1 className="titulo-grande" style={{ marginBottom: 10 }}>Hola, {username ? capitalizar(username) : 'bienvenido'}</h1>
        <p className="texto-callout" style={{ color: 'var(--texto-secundario)' }}>
          Configuremos FinTracker en unos pasos para que le saques el máximo provecho.
        </p>
      </div>

      <div className="lista-grupo" style={{ marginBottom: 36 }}>
        {props.map((p, i) => (
          <div key={i} className="fila" style={{ '--sangria': '64px', alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>
            <span className="mosaico" style={{ background: p.color + '26', color: p.color }}>
              <Icono nombre={p.icono} size={19} />
            </span>
            <div className="fila-cuerpo">
              <p className="titulo-3" style={{ fontSize: 16 }}>{p.titulo}</p>
              <p className="texto-nota" style={{ marginTop: 2 }}>{p.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onSiguiente} className="btn-primario">Empezar</button>
      <button onClick={onSaltar} className="btn-texto" style={{ width: '100%', marginTop: 8, color: 'var(--texto-secundario)' }}>
        Ya conozco la app
      </button>
    </div>
  )
}

// ── PASO 2: Primera cuenta ────────────────────────────────────────────────────
function PasoCuenta({ onSiguiente, onSaltar }) {
  const [form, setForm] = useState({ nombre: '', tipo: 'activo', balance_inicial: '', color_hex: '#0A84FF' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [creada, setCreada] = useState(null)

  const handleCrear = async () => {
    if (!form.nombre.trim()) { setError('Escribe un nombre para la cuenta.'); return }
    setError('')
    setCargando(true)
    try {
      const res = await api.post('/cuentas/', { ...form, nombre: form.nombre.trim(), balance_inicial: parseFloat(form.balance_inicial) || 0 })
      setCreada(res.data)
    } catch (err) {
      const data = err.response?.data
      setError(data?.nombre?.[0] || data?.non_field_errors?.[0] || data?.detail || 'No se pudo crear la cuenta.')
    } finally {
      setCargando(false)
    }
  }

  if (creada) return (
    <Hecho
      titulo="¡Cuenta creada!"
      item={{ nombre: creada.nombre, color: creada.color_hex, sub: creada.tipo === 'pasivo' ? 'Pasivo' : 'Activo' }}
      texto="Puedes agregar más cuentas desde la pestaña Cuentas cuando quieras."
      onSiguiente={onSiguiente}
    />
  )

  return (
    <div>
      <Cabecera icono="banco" color="#0A84FF" titulo="Tu primera cuenta"
        texto="Puede ser tu banco, Nequi o efectivo. Tus tarjetas de crédito las agregas luego en Cuentas." />

      <div className="campo">
        <label className="label" htmlFor="ob-cuenta">Nombre</label>
        <input id="ob-cuenta" className="input" placeholder="Ej: Bancolombia, Efectivo, Nequi…" value={form.nombre}
          onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} autoCapitalize="words" enterKeyHint="next" />
      </div>

      <div className="campo">
        <p className="label">Tipo</p>
        <div role="radiogroup" aria-label="Tipo de cuenta" style={{ display: 'flex', gap: 8 }}>
          <OpcionTipo activa={form.tipo === 'activo'} titulo="Activo" hint="Dinero que tienes" onClick={() => setForm(f => ({ ...f, tipo: 'activo' }))} />
          <OpcionTipo activa={form.tipo === 'pasivo'} titulo="Pasivo" hint="Préstamo o deuda" onClick={() => setForm(f => ({ ...f, tipo: 'pasivo' }))} />
        </div>
      </div>

      <div className="campo">
        <label className="label" htmlFor="ob-balance">Saldo actual</label>
        <CampoMonto id="ob-balance" valor={form.balance_inicial} onChange={v => setForm(f => ({ ...f, balance_inicial: v }))} />
      </div>

      <div className="campo">
        <p className="label">Color</p>
        <SelectorColor colores={COLORES} valor={form.color_hex} onChange={c => setForm(f => ({ ...f, color_hex: c }))} />
      </div>

      <AvisoError>{error}</AvisoError>

      <div style={{ marginTop: 24 }}>
        <button onClick={handleCrear} disabled={cargando} className="btn-primario">
          {cargando ? 'Creando…' : 'Crear cuenta'}
        </button>
        <button onClick={onSaltar} className="btn-texto" style={{ width: '100%', marginTop: 8, color: 'var(--texto-secundario)' }}>
          Omitir por ahora
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

  const handleCrear = async () => {
    if (!form.nombre.trim()) { setError('Escribe un nombre para la categoría.'); return }
    setError('')
    setCargando(true)
    try {
      const res = await api.post('/categorias/', { ...form, nombre: form.nombre.trim() })
      setCreada(res.data)
    } catch (err) {
      const data = err.response?.data
      setError(data?.nombre?.[0] || data?.non_field_errors?.[0] || data?.detail || 'No se pudo crear la categoría.')
    } finally {
      setCargando(false)
    }
  }

  if (creada) return (
    <Hecho
      titulo="¡Categoría lista!"
      item={{ nombre: creada.nombre, color: creada.color_hex, sub: creada.tipo === 'ingreso' ? 'Ingreso' : 'Gasto' }}
      texto="Crea más desde Presupuesto y úsalas para clasificar cada movimiento."
      onSiguiente={onSiguiente}
    />
  )

  return (
    <div>
      <Cabecera icono="etiqueta" color="#FF9F0A" titulo="Organiza tus movimientos"
        texto="Las categorías clasifican tus transacciones y muestran en qué gastas o ganas más." />

      <div className="campo">
        <label className="label" htmlFor="ob-cat">Nombre</label>
        <input id="ob-cat" className="input" placeholder="Ej: Comida, Transporte, Salario…" value={form.nombre}
          onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} autoCapitalize="sentences" enterKeyHint="next" />
      </div>

      <div className="campo">
        <p className="label">Tipo</p>
        <div role="radiogroup" aria-label="Tipo de categoría" style={{ display: 'flex', gap: 8 }}>
          <OpcionTipo activa={form.tipo === 'gasto'} titulo="Gasto"
            onClick={() => setForm(f => ({ ...f, tipo: 'gasto', color_hex: '#FF453A' }))} />
          <OpcionTipo activa={form.tipo === 'ingreso'} titulo="Ingreso"
            onClick={() => setForm(f => ({ ...f, tipo: 'ingreso', color_hex: '#30D158' }))} />
        </div>
      </div>

      <div className="campo">
        <p className="label">Color</p>
        <SelectorColor colores={COLORES} valor={form.color_hex} onChange={c => setForm(f => ({ ...f, color_hex: c }))} />
      </div>

      <AvisoError>{error}</AvisoError>

      <div style={{ marginTop: 24 }}>
        <button onClick={handleCrear} disabled={cargando} className="btn-primario">
          {cargando ? 'Creando…' : 'Crear categoría'}
        </button>
        <button onClick={onSaltar} className="btn-texto" style={{ width: '100%', marginTop: 8, color: 'var(--texto-secundario)' }}>
          Omitir por ahora
        </button>
      </div>
    </div>
  )
}

// ── PASO 4: Tour de la app ────────────────────────────────────────────────────
function PasoTour({ onSiguiente }) {
  return (
    <div>
      <Cabecera icono="mapa" color="#30D158" titulo="Conoce tu app"
        texto="Estas son las secciones principales de FinTracker." />

      <div className="lista-grupo" style={{ marginBottom: 32 }}>
        {TOUR.map((item, i) => (
          <div key={i} className="fila" style={{ '--sangria': '58px', alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>
            <span className="mosaico sm" style={{ background: item.color, color: '#fff', marginTop: 1 }}>
              <Icono nombre={item.icono} size={16} grosor={2} />
            </span>
            <div className="fila-cuerpo">
              <p className="titulo-3" style={{ fontSize: 16 }}>{item.titulo}</p>
              <p className="texto-nota" style={{ marginTop: 2 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onSiguiente} className="btn-primario">Continuar</button>
    </div>
  )
}

// ── PASO 5: ¡Listo! ───────────────────────────────────────────────────────────
function PasoListo({ username, onEntrar }) {
  return (
    <div>
      <Cabecera icono="cohete" color="#BF5AF2" titulo={`¡Todo listo${username ? `, ${capitalizar(username)}` : ''}!`}
        texto="Registra tu primera transacción con el botón + de la barra inferior." />

      <div className="lista-grupo" style={{ marginBottom: 32 }}>
        {[
          ['plus', 'Toca + para una nueva transacción'],
          ['tarjeta', 'Gestiona tus cuentas en la pestaña Cuentas'],
          ['objetivo', 'Define presupuestos por categoría'],
          ['face-id', 'Vincula Face ID desde Configuración'],
        ].map(([icono, texto], i) => (
          <div key={i} className="fila" style={{ '--sangria': '52px', minHeight: 48 }}>
            <span style={{ color: 'var(--acento)', display: 'flex', width: 24, justifyContent: 'center' }}><Icono nombre={icono} size={19} /></span>
            <p className="texto-callout" style={{ flex: 1 }}>{texto}</p>
          </div>
        ))}
      </div>

      <button onClick={onEntrar} className="btn-primario">Ir al inicio</button>
    </div>
  )
}

// ── Página principal de Onboarding ────────────────────────────────────────────
const TOTAL_PASOS = 5

function ProgressDots({ total, actual }) {
  return (
    <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={actual + 1}
      aria-label={`Paso ${actual + 1} de ${total}`} style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{
          width: i === actual ? 20 : 7,
          height: 7,
          borderRadius: 4,
          background: i <= actual ? 'var(--acento)' : 'var(--card-hover)',
          opacity: i < actual ? 0.45 : 1,
          transition: 'width 300ms var(--ease-out), background-color 300ms ease, opacity 300ms ease',
        }} />
      ))}
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const reducir = useReducedMotion()
  const [paso, setPaso] = useState(0)
  const [direccion, setDireccion] = useState(1)
  const [username, setUsername] = useState('')

  useEffect(() => {
    api.get('/perfil/').then(res => setUsername(res.data?.username || '')).catch(() => {})
  }, [])

  const irA = (n) => {
    setDireccion(n > paso ? 1 : -1)
    setPaso(Math.max(0, Math.min(n, TOTAL_PASOS - 1)))
    irArriba()
  }
  const siguiente = () => irA(paso + 1)
  // Si quedan pasos de configuración, saltar al tour; si está en el tour, a listo
  const saltar = () => irA(paso <= 2 ? 3 : 4)

  const terminar = () => {
    localStorage.setItem('ft_ob_done', 'true')
    marcarNovedadesVistas()   // cuenta nueva: para ella todo es nuevo
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

  // Avanzar entra desde la derecha y sale por la izquierda; retroceder, al revés
  const variantes = {
    entra: (d) => ({ opacity: 0, x: reducir ? 0 : 28 * d }),
    centro: { opacity: 1, x: 0 },
    sale: (d) => ({ opacity: 0, x: reducir ? 0 : -28 * d }),
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--fondo)',
      padding: 'calc(var(--safe-top) + 12px) 20px calc(var(--safe-bottom) + 32px)',
      maxWidth: 430,
      margin: '0 auto',
      overflowX: 'hidden',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', minHeight: 44, marginBottom: 20 }}>
        <div>
          {paso > 0 && (
            <button className="btn-atras" onClick={() => irA(paso - 1)} aria-label="Paso anterior" style={{ marginLeft: -8 }}>
              <Icono nombre="chevron-left" size={24} grosor={2.2} />
              Atrás
            </button>
          )}
        </div>
        <ProgressDots total={TOTAL_PASOS} actual={paso} />
        <div />
      </div>

      <AnimatePresence mode="wait" custom={direccion} initial={false}>
        <motion.div
          key={paso}
          custom={direccion}
          variants={variantes}
          initial="entra"
          animate="centro"
          exit="sale"
          transition={{ type: 'spring', bounce: 0, visualDuration: 0.28 }}
        >
          {pasoActual()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
