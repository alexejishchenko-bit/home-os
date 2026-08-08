import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.103.0'

const HOME = { lat: 55.7263818, lng: 37.7705483 }
const ALLOWED_ORIGINS = new Set([
  'https://home-os-chi.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
])

type Place = {
  id: string
  title: string
  city: string | null
  country: string | null
  image_url: string | null
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') ?? ''
  const headers = corsHeaders(origin)
  if (request.method === 'OPTIONS') return new Response(null, { headers })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    const serviceKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!serviceKey || !token) return json({ error: 'Unauthorized' }, 401, headers)

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401, headers)

    const { data: membership } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .eq('active', true)
      .maybeSingle()
    if (!membership) return json({ error: 'Forbidden' }, 403, headers)

    const body = await request.json() as { placeId?: string }
    if (!body.placeId) return json({ error: 'placeId is required' }, 400, headers)
    const { data: place, error: placeError } = await supabase
      .from('places')
      .select('id,title,city,country,image_url')
      .eq('id', body.placeId)
      .single()
    if (placeError || !place) return json({ error: 'Place not found' }, 404, headers)

    const { data: config, error: configError } = await supabase.rpc('telegram_bot_config')
    const apifyToken = config?.apify_api_token as string | undefined
    if (configError || !apifyToken) return json({ error: 'Apify is not configured' }, 503, headers)

    let details
    try {
      details = await findPlace(place as Place, apifyToken)
    } catch (error) {
      console.warn('[enrich-place] Apify fallback', error instanceof Error ? error.message : String(error))
      details = await findPublicPlace(place as Place)
    }
    const photos = await persistPhotos(supabase, place.id, details.photoUrls)
    const route = details.latitude != null && details.longitude != null && isMoscow(place as Place, details)
      ? await drivingRoute(details.latitude, details.longitude)
      : null

    const existingCover = (place as Place).image_url
    const durableCover = existingCover?.startsWith('storage://covers/') ? existingCover : photos[0] ?? existingCover
    const patch = {
      image_url: durableCover,
      photos: photos.length ? photos : null,
      latitude: details.latitude,
      longitude: details.longitude,
      distance_km: route ? Math.round(route.distanceKm * 10) / 10 : null,
      drive_minutes: route ? Math.max(1, Math.round(route.durationMinutes)) : null,
      enriched_at: new Date().toISOString(),
    }
    const { data: updated, error: updateError } = await supabase
      .from('places')
      .update(patch)
      .eq('id', place.id)
      .select()
      .single()
    if (updateError) throw updateError
    return json({ place: updated }, 200, headers)
  } catch (error) {
    console.error('[enrich-place] failed', error instanceof Error ? error.message : String(error))
    return json({ error: 'Не удалось обновить данные места' }, 500, headers)
  }
})

async function findPlace(place: Place, token: string) {
  const endpoint = new URL('https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items')
  endpoint.searchParams.set('timeout', '90')
  endpoint.searchParams.set('maxItems', '1')
  endpoint.searchParams.set('maxTotalChargeUsd', '1')
  endpoint.searchParams.set('clean', 'true')
  const response = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(95_000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      searchStringsArray: [place.title],
      locationQuery: [place.city, place.country].filter(Boolean).join(', ') || undefined,
      maxCrawledPlacesPerSearch: 1,
      maxImages: 3,
      language: 'ru',
      maxReviews: 0,
      scrapeImageAuthors: false,
      scrapeReviewsPersonalData: false,
    }),
  })
  if (!response.ok) {
    const responseBody = await response.text()
    let errorCode = 'unknown'
    try {
      const parsed = JSON.parse(responseBody) as { error?: { type?: string } }
      errorCode = parsed.error?.type ?? errorCode
    } catch {
      // Keep external response bodies out of logs.
    }
    throw new Error(`Apify returned ${response.status} (${errorCode})`)
  }
  const items = await response.json() as Record<string, unknown>[]
  const item = items[0] ?? {}
  const location = record(item.location)
  const latitude = numberValue(item.latitude ?? item.lat ?? location?.lat)
  const longitude = numberValue(item.longitude ?? item.lng ?? location?.lng)
  const images = Array.isArray(item.images) ? item.images : []
  const photoUrls = uniqueStrings([
    ...(Array.isArray(item.imageUrls) ? item.imageUrls : []),
    ...images.map(image => record(image)?.imageUrl),
    item.imageUrl,
  ]).slice(0, 3)
  return {
    latitude,
    longitude,
    city: text(item.city),
    address: text(item.address),
    photoUrls,
  }
}

async function findPublicPlace(place: Place) {
  const query = [place.title, place.city, place.country].filter(Boolean).join(', ')
  const [geocoded, photoUrls] = await Promise.all([
    geocodePlace(query),
    findCommonsPhotos(place.title),
  ])
  return {
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    city: place.city,
    address: geocoded.address,
    photoUrls,
  }
}

async function geocodePlace(query: string) {
  const endpoint = new URL('https://nominatim.openstreetmap.org/search')
  endpoint.searchParams.set('q', query)
  endpoint.searchParams.set('format', 'jsonv2')
  endpoint.searchParams.set('limit', '1')
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'HomeOS/1.0' },
  })
  if (!response.ok) return { latitude: null, longitude: null, address: null }
  const items = await response.json() as { lat?: string; lon?: string; display_name?: string }[]
  const item = items[0]
  return {
    latitude: numberValue(item?.lat),
    longitude: numberValue(item?.lon),
    address: text(item?.display_name),
  }
}

async function findCommonsPhotos(title: string) {
  const endpoint = new URL('https://commons.wikimedia.org/w/api.php')
  endpoint.searchParams.set('action', 'query')
  endpoint.searchParams.set('generator', 'search')
  endpoint.searchParams.set('gsrsearch', title)
  endpoint.searchParams.set('gsrnamespace', '6')
  endpoint.searchParams.set('gsrlimit', '3')
  endpoint.searchParams.set('prop', 'imageinfo')
  endpoint.searchParams.set('iiprop', 'url|mime')
  endpoint.searchParams.set('iiurlwidth', '1600')
  endpoint.searchParams.set('format', 'json')
  endpoint.searchParams.set('origin', '*')
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(12_000) })
  if (!response.ok) return []
  const body = await response.json() as {
    query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string; mime?: string }[] }> }
  }
  const pages = Object.values(body.query?.pages ?? {})
  return uniqueStrings(pages.flatMap(page => {
    const image = page.imageinfo?.[0]
    return image && ['image/jpeg', 'image/png', 'image/webp'].includes(image.mime ?? '')
      ? [image.thumburl ?? image.url]
      : []
  })).slice(0, 3)
}

async function persistPhotos(supabase: ReturnType<typeof createClient>, placeId: string, urls: string[]) {
  const saved: string[] = []
  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      const contentType = response.headers.get('content-type')?.split(';')[0] ?? ''
      if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) continue
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength > 8 * 1024 * 1024) continue
      const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
      const path = `travel/${placeId}-${index}-${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage.from('covers').upload(path, bytes, {
        contentType,
        cacheControl: '31536000',
        upsert: false,
      })
      if (!error) saved.push(`storage://covers/${path}`)
    } catch {
      // A failed photo must not block place coordinates or route enrichment.
    }
  }
  return saved
}

async function drivingRoute(latitude: number, longitude: number) {
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${HOME.lng},${HOME.lat};${longitude},${latitude}`)
  url.searchParams.set('overview', 'false')
  url.searchParams.set('alternatives', 'false')
  url.searchParams.set('steps', 'false')
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'HomeOS/1.0' },
  })
  if (!response.ok) return null
  const body = await response.json() as { routes?: { distance: number; duration: number }[] }
  const route = body.routes?.[0]
  return route ? { distanceKm: route.distance / 1000, durationMinutes: route.duration / 60 } : null
}

function isMoscow(place: Place, details: { city: string | null; address: string | null }) {
  return [place.city, place.country, details.city, details.address]
    .filter(Boolean)
    .some(value => /москв|moscow/i.test(String(value)))
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && /^https:\/\//.test(value)))]
}

function corsHeaders(origin: string) {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://home-os-chi.vercel.app'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  })
}
