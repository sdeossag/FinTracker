import { Navigate } from 'react-router-dom'
import { getAccessToken } from '../api'

export default function ProtectedRoute({ children }) {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />
  }
  return children
}
