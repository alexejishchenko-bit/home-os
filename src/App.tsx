import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { getUser, logout } from './lib/auth'
import type { User } from './lib/auth'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/home/HomePage'
import HealthPage from './pages/health/HealthPage'
import SportPage from './pages/sport/SportPage'
import TravelPage from './pages/travel/TravelPage'
import './App.css'

export default function App() {
  const [user, setUser] = useState<User | null>(getUser)

  if (!user) {
    return <LoginPage onLogin={setUser} />
  }

  function handleLogout() {
    logout()
    setUser(null)
  }

  return (
    <BrowserRouter>
      <div className="layout">
        <nav className="nav">
          <span className="nav-logo">HomeOS</span>
          <div className="nav-links">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active home' : 'home'}>
              Дом
            </NavLink>
            <NavLink to="/health" className={({ isActive }) => isActive ? 'active health' : 'health'}>
              Здоровье
            </NavLink>
            <NavLink to="/sport" className={({ isActive }) => isActive ? 'active sport' : 'sport'}>
              Спорт
            </NavLink>
            <NavLink to="/travel" className={({ isActive }) => isActive ? 'active travel' : 'travel'}>
              Путешествия
            </NavLink>
          </div>
          <div className="nav-user">
            <span className="nav-username">{user.displayName}</span>
            <button className="nav-logout" onClick={handleLogout}>Выйти</button>
          </div>
        </nav>

        <main className="main">
          <Routes>
            <Route path="/" element={<HomePage currentUser={user.username} />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/sport" element={<SportPage />} />
            <Route path="/travel" element={<TravelPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
