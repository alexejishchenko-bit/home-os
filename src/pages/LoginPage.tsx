import { useState } from 'react'
import { login } from '../lib/auth'
import type { User } from '../lib/auth'
import './LoginPage.css'

export default function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const user = login(username, password)
    if (user) {
      onLogin(user)
    } else {
      setError(true)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1 className="login-title">HomeOS</h1>
        <p className="login-sub">Добро пожаловать домой</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="login-input"
            placeholder="Логин"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(false) }}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <input
            className="login-input"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false) }}
          />
          {error && <p className="login-error">Неверный логин или пароль</p>}
          <button className="login-btn" type="submit">Войти</button>
        </form>
      </div>
    </div>
  )
}
