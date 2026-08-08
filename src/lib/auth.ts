import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type User = {
  username: 'lesha' | 'jinya'
  displayName: string
}

const ACCOUNTS = {
  lesha: {
    id: '8cc914c7-0e0f-4702-891b-e43c5122a77f',
    email: 'lesha@home-os.local',
    displayName: 'Алексей',
  },
  jinya: {
    id: '52d0ae42-db7d-4259-b373-ac5a83ba0570',
    email: 'jinya@home-os.local',
    displayName: 'Жиня',
  },
} as const

function userFromId(id: string): User | null {
  const match = Object.entries(ACCOUNTS).find(([, account]) => account.id === id)
  if (!match) return null
  const [username, account] = match
  return { username: username as User['username'], displayName: account.displayName }
}

export async function login(username: string, password: string): Promise<User | null> {
  const normalized = username.trim().toLowerCase() as keyof typeof ACCOUNTS
  const account = ACCOUNTS[normalized]
  if (!account) return null

  const { data, error } = await supabase.auth.signInWithPassword({ email: account.email, password })
  if (error || !data.user || data.user.id !== account.id) {
    if (data.session) await supabase.auth.signOut()
    return null
  }
  return userFromId(data.user.id)
}

export async function logout() {
  await supabase.auth.signOut()
}

export async function getUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser()
  return error || !data.user ? null : userFromId(data.user.id)
}

export function subscribeToAuth(onChange: (user: User | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
    onChange(session?.user ? userFromId(session.user.id) : null)
  })
  return () => data.subscription.unsubscribe()
}
