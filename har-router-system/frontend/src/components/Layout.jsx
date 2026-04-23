import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, Upload, Zap, BarChart2, Settings, LogOut, Bell } from 'lucide-react'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/upload',    label: 'Upload',    Icon: Upload           },
  { to: '/predict',   label: 'Predict',   Icon: Zap              },
  { to: '/analytics', label: 'Analytics', Icon: BarChart2        },
]

// Shared logout confirmation modal — renders over everything
function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm">
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <LogOut size={22} className="text-red-500" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Sign out?</h3>
            <p className="text-sm text-gray-500 mt-1">You will be returned to the login screen.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const { logout }       = useAuth()
  const navigate         = useNavigate()
  const [showModal, setShowModal] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <>
      {showModal && (
        <LogoutModal
          onConfirm={handleLogout}
          onCancel={() => setShowModal(false)}
        />
      )}

      <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#f0f2f5' }}>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-56 flex-shrink-0 bg-[#1e2d45] flex-col text-white">
          <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-sm">H</div>
            <span className="font-bold text-base tracking-tight">HAR Router</span>
          </div>

          <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                   ${isActive ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`
                }
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="px-3 py-4 border-t border-white/10 flex flex-col gap-1">
            <NavLink to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`
              }
            >
              <Settings size={16} strokeWidth={1.75} />
              Settings
            </NavLink>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-colors w-full text-left"
            >
              <LogOut size={16} strokeWidth={1.75} />
              Logout
            </button>
          </div>
        </aside>

        {/* Right side */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* Mobile topbar */}
          <header className="md:hidden flex-shrink-0 h-14 bg-[#1e2d45] flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-xs text-white">H</div>
              <span className="font-bold text-white text-sm">HAR Router</span>
            </div>
            <div className="flex items-center gap-3">
              <NavLink to="/settings" className={({ isActive }) => `${isActive ? 'text-blue-400' : 'text-white/70'} hover:text-white transition-colors`}>
                <Settings size={18} strokeWidth={1.75} />
              </NavLink>
              <button
                onClick={() => setShowModal(true)}
                className="text-white/70 hover:text-red-300 transition-colors"
              >
                <LogOut size={18} strokeWidth={1.75} />
              </button>
            </div>
          </header>

          {/* Desktop topbar */}
          <header className="hidden md:flex flex-shrink-0 h-14 bg-white border-b border-gray-200 items-center px-6 justify-end">
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              <Bell size={18} strokeWidth={1.75} />
            </button>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '16px' }} className="md:p-6">
            <Outlet />
          </main>

          {/* Mobile bottom nav */}
          <nav className="md:hidden flex-shrink-0 bg-white border-t border-gray-200 flex"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {NAV.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
                   ${isActive ? 'text-blue-600' : 'text-gray-400'}`
                }
              >
                <Icon size={20} strokeWidth={1.75} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </NavLink>
            ))}
          </nav>

        </div>
      </div>
    </>
  )
}
