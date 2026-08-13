import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import EditarTransaccion from './paginas/EditarTransaccion'
import NavBar from './componentes/NavBar'
import ProtectedRoute from './componentes/ProtectedRoute'
import Configuracion from './paginas/Configuracion'
import Graficas from './paginas/Graficas'

function AppContent() {
  const location = useLocation()
  const sinNav = ['/login', '/registro', '/biometria', '/onboarding'].includes(location.pathname)

  return (
    <>
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
        <Route path="/editar/:id" element={<ProtectedRoute><EditarTransaccion /></ProtectedRoute>} />
        <Route path="/graficas" element={<ProtectedRoute><Graficas /></ProtectedRoute>} />
        <Route path="/configuracion" element={<ProtectedRoute><Configuracion /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {!sinNav && <NavBar />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
