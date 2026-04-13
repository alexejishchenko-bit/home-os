export type User = {
  username: 'lesha' | 'jinya'
  displayName: string
}

const USERS: Record<string, { password: string; displayName: string }> = {
  lesha: { password: 'admin1', displayName: 'Алексей' },
  jinya:  { password: 'admin2', displayName: 'Жиня' },
}

const KEY = 'home-os-user'

export function login(username: string, password: string): User | null {
  const user = USERS[username.toLowerCase()]
  if (!user || user.password !== password) return null
  const session: User = { username: username.toLowerCase() as User['username'], displayName: user.displayName }
  localStorage.setItem(KEY, JSON.stringify(session))
  return session
}

export function logout() {
  localStorage.removeItem(KEY)
}

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
