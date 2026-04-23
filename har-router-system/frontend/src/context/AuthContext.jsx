import React, { createContext, useContext, useState } from 'react'
import axios from 'axios'
import { BASE_URL } from '../config/apiConfig'

const AuthContext = createContext(null)
const api = axios.create({ baseURL: BASE_URL })

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('har_auth') === 'true'
  )
  const [currentUser, setCurrentUser] = useState(
    () => {
      try { return JSON.parse(localStorage.getItem('har_user') || 'null') }
      catch { return null }
    }
  )

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password })
      const { user, action } = res.data.data
      localStorage.setItem('har_auth', 'true')
      localStorage.setItem('har_user', JSON.stringify(user))
      setIsLoggedIn(true)
      setCurrentUser(user)
      return { success: true, action }  // action = 'login' or 'registered'
    } catch (e) {
      const msg = e.response?.data?.detail || 'Invalid credentials.'
      return { success: false, error: msg }
    }
  }

  const logout = () => {
    localStorage.removeItem('har_auth')
    localStorage.removeItem('har_user')
    setIsLoggedIn(false)
    setCurrentUser(null)
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
