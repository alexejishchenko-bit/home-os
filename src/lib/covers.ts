import { supabase } from './supabase'

const COVER_PREFIX = 'storage://covers/'
const MAX_COVER_SIZE = 8 * 1024 * 1024
const COVER_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function uploadCover(file: File, section: 'recipes' | 'travel') {
  const extension = COVER_EXTENSIONS[file.type]
  if (!extension) throw new Error('Поддерживаются JPG, PNG и WebP')
  if (file.size > MAX_COVER_SIZE) throw new Error('Обложка должна быть меньше 8 МБ')

  const path = `${section}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('covers').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error
  return `${COVER_PREFIX}${path}`
}

export async function resolveCoverUrl(value: string | null | undefined) {
  if (!value) return null
  if (!value.startsWith(COVER_PREFIX)) return value
  const path = value.slice(COVER_PREFIX.length)
  const { data, error } = await supabase.storage.from('covers').createSignedUrl(path, 60 * 60)
  return error ? null : data.signedUrl
}
