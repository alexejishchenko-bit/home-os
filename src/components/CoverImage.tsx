import { useEffect, useState } from 'react'
import { resolveCoverUrl } from '../lib/covers'

export default function CoverImage({ value, className }: { value: string; className: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    resolveCoverUrl(value).then(result => { if (active) setUrl(result) })
    return () => { active = false }
  }, [value])

  return url ? <div className={className} style={{ backgroundImage: `url(${url})` }} /> : null
}
