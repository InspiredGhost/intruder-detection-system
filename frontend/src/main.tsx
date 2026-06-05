import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { CameraProvider } from './components/CameraContext'
import Layout from './components/Layout'
import AlertsPage from './pages/AlertsPage'
import Dashboard from './pages/Dashboard'
import DetectionPage from './pages/DetectionPage'
import EnrollPage from './pages/EnrollPage'
import Login from './pages/Login'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return localStorage.getItem('token') ? <>{children}</> : <Navigate to="/login" replace />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CameraProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/detection" element={<DetectionPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/enroll" element={<EnrollPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </CameraProvider>
  </React.StrictMode>,
)
