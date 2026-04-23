import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Check, X } from 'lucide-react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RULES = [
  { label: 'At least 8 characters',      test: p => p.length >= 8           },
  { label: '1 uppercase letter (A–Z)',    test: p => /[A-Z]/.test(p)         },
  { label: '1 lowercase letter (a–z)',    test: p => /[a-z]/.test(p)         },
  { label: '1 number (0–9)',              test: p => /\d/.test(p)            },
  { label: '1 special character (!@#…)', test: p => /[^A-Za-z0-9]/.test(p)  },
]

export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)

  const emailValid    = EMAIL_REGEX.test(email.trim())
  const ruleResults   = RULES.map(r => ({ ...r, passed: r.test(password) }))
  const passwordValid = ruleResults.every(r => r.passed)
  const showRules     = passwordTouched && password.length > 0 && !passwordValid
  const canSubmit     = emailValid && passwordValid

  const handleSubmit = async e => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')
    const result = await login(email.trim(), password)
    setLoading(false)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 border border-gray-100">

          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-500/30 mb-4">
              H
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">HAR Router</h1>
            <p className="text-sm text-gray-500 mt-1">Human Activity Recognition System</p>
          </div>

          <div className="mb-7">
            <h2 className="text-xl font-bold text-gray-900">Sign in to your account</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your email and password to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Email Address</label>
              <div className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 transition-all min-w-0
                ${email && !emailValid
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-gray-50 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100'}`}>
                <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  type="email" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="flex-1 min-w-0 outline-none text-sm text-gray-900 bg-transparent placeholder-gray-400"
                />
                {emailValid && <Check size={16} className="text-green-500 flex-shrink-0" strokeWidth={2.5} />}
              </div>
              {email && !emailValid && (
                <p className="text-xs text-red-600 mt-0.5">Enter a valid email address.</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Password</label>
              <div className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 transition-all
                ${passwordTouched && password.length > 0 && !passwordValid
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-gray-200 bg-gray-50 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100'}`}>
                <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPasswordTouched(true)}
                  className="flex-1 min-w-0 outline-none text-sm text-gray-900 bg-transparent placeholder-gray-400"
                />
                {passwordValid && password.length > 0 && <Check size={16} className="text-green-500 flex-shrink-0" strokeWidth={2.5} />}
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-1">
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Password strength rules — shown only while typing and not yet valid */}
              {showRules && (
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Password requirements</p>
                  {ruleResults.map(r => (
                    <div key={r.label} className="flex items-center gap-2">
                      {r.passed
                        ? <Check size={13} className="text-green-500 flex-shrink-0" strokeWidth={2.5} />
                        : <X size={13} className="text-red-400 flex-shrink-0" strokeWidth={2.5} />}
                      <span className={`text-xs ${r.passed ? 'text-green-600' : 'text-gray-500'}`}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Server error */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={!canSubmit || loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 disabled:shadow-none text-sm tracking-wide">
              {loading ? 'Signing in...' : 'Sign In to Dashboard'}
            </button>
          </form>

        </div>

        <p className="text-center text-xs text-white/40 mt-6">© 2025 HAR Router · Human Activity Recognition System</p>
      </div>
    </div>
  )
}
