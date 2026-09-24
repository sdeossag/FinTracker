import { useEffect, useLayoutEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'

import Inicio from './paginas/Inicio'
import Transacciones from './paginas/Transacciones'
import Cuentas from './paginas/Cuentas'
import Presupuesto from './paginas/Presupuesto'
import NuevaTransaccion from './paginas/NuevaTransaccion'
import Login from './paginas/Login'
import Registro from './paginas/Registro'
import Biometria from './paginas/Biometria'
import Onboarding from './paginas/Onboarding'
import Recurrentes from './paginas/Recurrentes'
import Revisar from './paginas/Revisar'
import EditarTransaccion from './paginas/EditarTransaccion'
import NavBar from './componentes/NavBar'
import ProtectedRoute from './componentes/ProtectedRoute'
import Configuracion from './paginas/Configuracion'
import Graficas from './paginas/Graficas'
import Icono from './componentes/Icono'
import { irArriba } from './utils/scroll'
import Novedades from './componentes/Novedades'
import { getAccessToken } from './api'

// Pantallas enfocadas en una tarea: sin barra de pestañas
const SIN_NAV = ['/login', '/registro', '/biometria', '/onboarding', '/nueva', '/editar']
// Donde no se muestran las novedades: sin sesión o configurando la cuenta
const SIN_NOVEDADES = ['/login', '/registro', '/onboarding']

// Teclado abierto (solo pantallas táctiles): la barra de pestañas se esconde
// para no quedar flotando encima del teclado
function useTecladoAbierto() {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return
    const esCampo = (el) =>
      el?.matches?.('textarea, input:not([type=button]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=color])')
    let t
    const onIn  = (e) => { if (esCampo(e.target)) { clearTimeout(t); setAbierto(true) } }
    const onOut = (e) => { if (esCampo(e.target)) { t = setTimeout(() => setAbierto(esCampo(document.activeElement)), 80) } }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut) }
  }, [])
  return abierto
}

function AppContent() {
  const location = useLocation()
  const tipoNavegacion = useNavigationType()
  // Una pantalla nueva arranca arriba; al volver atrás se respeta donde estaba
  useLayoutEffect(() => {
    if (tipoNavegacion !== 'POP') irArriba()
  }, [location.key, tipoNavegacion])
  const sinNav = SIN_NAV.some(r => location.pathname === r || location.pathname.startsWith(r + '/'))

  const tecladoAbierto = useTecladoAbierto()

  return (
    // Fijo a los cuatro bordes: el documento nunca hace scroll, lo hace <main>.
    // Así la barra de pestañas no se descuadra con el rebote ni con el teclado (como NutriFit).
    <div id="app-shell">
      <main id="scroller">
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        {/* Onboarding — protegida pero sin navbar */}
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

        {/* Rutas protegidas */}
        <Route path="/biometria" element={<ProtectedRoute><Biometria /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Inicio /></ProtectedRoute>} />
        <Route path="/transacciones" element={<ProtectedRoute><Transacciones /></ProtectedRoute>} />
        <Route path="/nueva" element={<ProtectedRoute><NuevaTransaccion /></ProtectedRoute>} />
        <Route path="/cuentas" element={<ProtectedRoute><Cuentas /></ProtectedRoute>} />
        <Route path="/presupuesto" element={<ProtectedRoute><Presupuesto /></ProtectedRoute>} />
        <Route path="/recurrentes" element={<ProtectedRoute><Recurrentes /></ProtectedRoute>} />
        <Route path="/revisar" element={<ProtectedRoute><Revisar /></ProtectedRoute>} />
        <Route path="/editar/:id" element={<ProtectedRoute><EditarTransaccion /></ProtectedRoute>} />
        <Route path="/graficas" element={<ProtectedRoute><Graficas /></ProtectedRoute>} />
        <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </main>
      {!sinNav && <NavBar oculta={tecladoAbierto} />}
      {getAccessToken() && !SIN_NOVEDADES.includes(location.pathname) && <Novedades />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
      {/* Un solo Toaster en la raíz. Arriba, lejos de la barra de pestañas y del pulgar. */}
      <Toaster
        theme="dark"
        position="top-center"
        offset={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        mobileOffset={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)', left: '12px', right: '12px' }}
        gap={8}
        icons={{
          success: <Icono nombre="check-circulo" size={18} style={{ color: 'var(--ingreso)' }} />,
          error: <Icono nombre="alerta" size={18} style={{ color: 'var(--gasto)' }} />,
          info: <Icono nombre="info" size={18} style={{ color: 'var(--acento)' }} />,
        }}
        toastOptions={{
          style: {
            background: 'rgba(28, 36, 54, 0.92)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            color: 'var(--texto-primario)',
            borderRadius: 16,
            fontFamily: 'inherit',
            fontSize: 15,
            boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
          },
        }}
      />
    </BrowserRouter>
  )
}
