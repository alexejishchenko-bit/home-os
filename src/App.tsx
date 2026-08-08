import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { getUser, logout, subscribeToAuth } from './lib/auth'
import type { User } from './lib/auth'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/home/HomePage'
import HealthPage from './pages/health/HealthPage'
import SportPage from './pages/sport/SportPage'
import TravelPage from './pages/travel/TravelPage'
import RecipesPage from './pages/recipes/RecipesPage'
import './App.css'

const NAV = [
  { to: '/', end: true, label: 'Дом', cls: 'home', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )},
  { to: '/health', label: 'Здоровье', cls: 'health', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )},
  { to: '/sport', label: 'Спорт', cls: 'sport', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  )},
  { to: '/travel', label: 'Путешествия', cls: 'travel', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )},
  { to: '/recipes', label: 'Рецепты', cls: 'recipes', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 3v7a4 4 0 0 0 8 0V3"/>
      <path d="M12 10v11"/>
      <path d="M18 3c-1.5 2-1.5 5 0 8"/>
    </svg>
  )},
]

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    let active = true
    getUser().then(currentUser => {
      if (!active) return
      setUser(currentUser)
      setAuthReady(true)
    })
    const unsubscribe = subscribeToAuth(nextUser => {
      if (active) setUser(nextUser)
    })
    return () => { active = false; unsubscribe() }
  }, [])

  if (!authReady) {
    return <div className="login-wrap"><div className="login-box"><p className="login-sub">Проверяем доступ…</p></div></div>
  }

  if (!user) return <LoginPage onLogin={setUser} />

  async function handleLogout() {
    await logout()
  }

  return (
    <BrowserRouter>
      <div className="layout">
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-brand">
            <div className="sidebar-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <div className="sidebar-logo">HomeOS</div>
              <div className="sidebar-kicker">Лёша + Жиня</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-section-label">Пространство</div>
            {NAV.map(({ to, end, label, cls, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `sidebar-link ${cls} ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-icon">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-user">
            <div className="sidebar-avatar">{user.displayName[0]}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-username">{user.displayName}</span>
              <span className="sidebar-user-status">Личное пространство</span>
            </div>
            <button className="sidebar-logout" onClick={handleLogout} title="Выйти">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </aside>

        <div className="content">
          <header className="topbar">
            <button className="burger" onClick={() => setSidebarOpen(true)} aria-label="Открыть навигацию">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="topbar-context">
              <span className="topbar-logo">HomeOS</span>
              <span className="topbar-separator">/</span>
              <span className="topbar-section">Обзор</span>
            </div>
            <div className="sync-state"><span /> Синхронизировано</div>
            <span className="topbar-person">{user.displayName}</span>
          </header>

          <main className="main">
            <Routes>
              <Route path="/" element={<HomePage currentUser={user.username} />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="/sport" element={<SportPage />} />
              <Route path="/travel" element={<TravelPage />} />
              <Route path="/recipes" element={<RecipesPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
