import { useEffect, useState } from 'react'
import { resolveCoverUrl } from '../lib/covers'

type Person = 'alex' | 'jinya'

const AVATARS: Partial<Record<Person, string>> = {
  jinya: 'storage://covers/avatars/jinya-v2.png',
}

export default function PersonAvatar({ person, className = '' }: { person: Person; className?: string }) {
  const classes = `${className} person-avatar ${person}`.trim()
  const avatar = AVATARS[person]
  if (!avatar) return <span className={classes} aria-hidden="true">А</span>

  return <StoredAvatar value={avatar} className={classes} />
}

function StoredAvatar({ value, className }: { value: string; className: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    resolveCoverUrl(value).then(result => { if (active) setUrl(result) })
    return () => { active = false }
  }, [value])

  return (
    <span
      className={className}
      style={url ? { backgroundImage: `url(${url})` } : undefined}
      aria-hidden="true"
    >
      {!url && 'Ж'}
    </span>
  )
}
