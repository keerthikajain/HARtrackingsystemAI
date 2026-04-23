import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UploadTrain from './pages/UploadTrain'
import RunPrediction from './pages/RunPrediction'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import { AuthProvider, useAuth } from './context/AuthContext'

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"   element={<Dashboard />} />
          <Route path="upload"      element={<UploadTrain />} />
          <Route path="predict"     element={<RunPrediction />} />
          <Route path="analytics"   element={<Analytics />} />          <Route path="settings"    element={<Settings />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
