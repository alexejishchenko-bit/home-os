import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.103.0'

type Mode = 'task' | 'travel' | 'recipe' | 'health'

type TelegramConfig = {
  telegram_bot_token: string
  telegram_webhook_secret: string
  telegram_chat_alex: string
  telegram_chat_jinya: string
  apify_api_token?: string
  gemini_api_key?: string
}

type TelegramUpdate = {
  message?: {
    chat: { id: number }
    text?: string
  }
}

const MENU = {
  keyboard: [
    [{ text: '✅ Создать задачу' }],
    [{ text: '✈️ Добавить путешествие' }, { text: '🍽 Добавить рецепт' }],
    [{ text: '🩺 Добавить здоровье' }],
  ],
  resize_keyboard: true,
}

const MODE_BY_INPUT: Record<string, Mode> = {
  '/task': 'task',
  '✅ Создать задачу': 'task',
  '/travel': 'travel',
  '✈️ Добавить путешествие': 'travel',
  '/recipe': 'recipe',
  '🍽 Добавить рецепт': 'recipe',
  '/health': 'health',
  '🩺 Добавить здоровье': 'health',
}

const PROMPT_BY_MODE: Record<Mode, string> = {
  task: 'Напиши задачу одним сообщением: что сделать, кому назначить, срок и когда напомнить.',
  travel: 'Пришли ссылку на отель, место, пост, Reels или TikTok.',
  recipe: 'Пришли ссылку на рецепт, пост, Reels или TikTok.',
  health: 'Напиши событие или следующий шаг одним сообщением. Я добавлю его в твой раздел «Здоровье».',
}

Deno.serve(async (request: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    const serviceKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) throw new Error('Supabase service key is unavailable')

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: config, error: configError } = await supabase.rpc('telegram_bot_config')
    if (configError || !config) throw configError ?? new Error('Telegram config is unavailable')
    const telegramConfig = config as TelegramConfig

    const webhookSecret = request.headers.get('x-telegram-bot-api-secret-token')
    if (webhookSecret !== telegramConfig.telegram_webhook_secret) {
      return new Response('Forbidden', { status: 403 })
    }

    const update = await request.json() as TelegramUpdate
    const message = update.message
    if (!message?.text) return json({ ok: true })

    const chatId = String(message.chat.id)
    const person = chatId === telegramConfig.telegram_chat_alex
      ? 'alex'
      : chatId === telegramConfig.telegram_chat_jinya ? 'jinya' : null

    if (!person) {
      await sendTelegram(telegramConfig.telegram_bot_token, chatId, 'Этот чат не подключён к HomeOS.')
      return json({ ok: true })
    }

    const text = message.text.trim()
    if (text === '/start' || text === '/menu') {
      await clearSession(supabase, chatId)
      await sendTelegram(
        telegramConfig.telegram_bot_token,
        chatId,
        'HomeOS на связи. Что добавить?',
        { reply_markup: MENU },
      )
      return json({ ok: true })
    }

    if (text === '/cancel' || text === 'Отмена') {
      await clearSession(supabase, chatId)
      await sendTelegram(telegramConfig.telegram_bot_token, chatId, 'Отменено.', { reply_markup: MENU })
      return json({ ok: true })
    }

    const requestedMode = MODE_BY_INPUT[text.split('@')[0]]
    if (requestedMode) {
      await supabase.from('telegram_sessions').upsert({ chat_id: Number(chatId), mode: requestedMode, updated_at: new Date().toISOString() })
      await sendTelegram(telegramConfig.telegram_bot_token, chatId, PROMPT_BY_MODE[requestedMode])
      return json({ ok: true })
    }

    const { data: session } = await supabase
      .from('telegram_sessions')
      .select('mode')
      .eq('chat_id', Number(chatId))
      .maybeSingle()

    if (!session?.mode) {
      await sendTelegram(telegramConfig.telegram_bot_token, chatId, 'Сначала выбери действие в меню.', { reply_markup: MENU })
      return json({ ok: true })
    }

    const mode = session.mode as Mode
    if (mode === 'task') {
      const task = parseTaskText(text, person)
      const { error } = await supabase.from('tasks').insert({
        title: task.title,
        category: task.category,
        assigned_to: task.assignedTo,
        due_date: task.dueDate,
        notes: task.notes,
        status: 'inbox',
        priority: task.priority,
        link_url: task.linkUrl,
        remind_at: task.remindAt,
      })
      if (error) throw error
      await clearSession(supabase, chatId)
      await sendTelegram(telegramConfig.telegram_bot_token, chatId, taskConfirmation(task), { reply_markup: MENU })
      return json({ ok: true })
    }

    if (mode === 'health') {
      const { error } = await supabase.from('health_events').insert({
        person,
        type: 'other',
        title: text,
      })
      if (error) throw error
      await clearSession(supabase, chatId)
      await sendTelegram(
        telegramConfig.telegram_bot_token,
        chatId,
        `Добавлено в «Здоровье»: ${text}\nДату и напоминание можно уточнить на сайте.`,
        { reply_markup: MENU },
      )
      return json({ ok: true })
    }

    const sourceUrl = extractUrl(text)
    if (!sourceUrl) {
      await sendTelegram(telegramConfig.telegram_bot_token, chatId, 'Не вижу ссылку. Пришли URL целиком или нажми /cancel.')
      return json({ ok: true })
    }

    if (!telegramConfig.apify_api_token) {
      await sendTelegram(
        telegramConfig.telegram_bot_token,
        chatId,
        'Apify ещё не подключён. Добавление ссылки остановлено, чтобы не сохранять неточные данные.',
      )
      return json({ ok: true })
    }

    const apifyMetadata = await fetchApifyMetadata(sourceUrl, telegramConfig.apify_api_token)
    const directMetadata = await fetchMetadata(sourceUrl)
    const fallbackMetadata = mergeMetadata(apifyMetadata, directMetadata)
    const geminiMetadata = telegramConfig.gemini_api_key
      ? await analyzeWithGemini(mode, sourceUrl, apifyMetadata, telegramConfig.gemini_api_key)
      : null
    const analyzedMetadata = geminiMetadata ? mergeMetadata(geminiMetadata, fallbackMetadata) : fallbackMetadata
    const metadata = hasUsefulMetadata(mode, analyzedMetadata)
      ? analyzedMetadata
      : linkOnlyMetadata(mode, sourceUrl)
    if (mode === 'travel') {
      const { error } = await supabase.from('places').insert({
        title: metadata.title || hostnameLabel(sourceUrl),
        country: metadata.country,
        city: metadata.city,
        status: 'wishlist',
        links: [{ url: sourceUrl, type: linkType(sourceUrl), title: metadata.title }],
        notes: metadata.description,
        image_url: metadata.image,
      })
      if (error) throw error
      await clearSession(supabase, chatId)
      await sendTelegram(
        telegramConfig.telegram_bot_token,
        chatId,
        `Добавлено в путешествия: ${metadata.title || hostnameLabel(sourceUrl)}`,
        { reply_markup: MENU },
      )
      return json({ ok: true })
    }

    const { error } = await supabase.from('recipes').insert({
      title: metadata.title || hostnameLabel(sourceUrl),
      ingredients: metadata.ingredients,
      instructions: metadata.instructions,
      prep_time_min: metadata.prepTime,
      servings: metadata.servings,
      source_url: sourceUrl,
      image_url: metadata.image,
      notes: metadata.description,
    })
    if (error) throw error
    await clearSession(supabase, chatId)
    await sendTelegram(
      telegramConfig.telegram_bot_token,
      chatId,
      `Рецепт добавлен: ${metadata.title || hostnameLabel(sourceUrl)}`,
      { reply_markup: MENU },
    )
    return json({ ok: true })
  } catch (error) {
    console.error('telegram-home-os failed', error instanceof Error ? error.message : String(error))
    return json({ ok: false }, 500)
  }
})

async function clearSession(supabase: ReturnType<typeof createClient>, chatId: string) {
  await supabase.from('telegram_sessions').delete().eq('chat_id', Number(chatId))
}

type TaskInput = {
  title: string
  category: 'task' | 'cleaning' | 'shopping' | 'bill'
  assignedTo: 'alex' | 'jinya'
  dueDate: string | null
  remindAt: string | null
  priority: 'normal' | 'high' | 'urgent'
  notes: string | null
  linkUrl: string | null
}

function parseTaskText(text: string, sender: 'alex' | 'jinya'): TaskInput {
  const parts = text.split(/[,;\n]+/).map(part => part.trim()).filter(Boolean)
  const metadata = parts.filter(isTaskMetadata)
  const titleParts = parts.filter(part => !isTaskMetadata(part))
  const title = titleParts.join(', ') || parts[0] || text
  const joinedMetadata = metadata.join(' ')
  const assigneeText = joinedMetadata || text
  const assignedTo = /(?:на|для|назнач(?:ить|ь)|ответственн\w*)\s+(?:жин(?:ю|е|и|я))/iu.test(assigneeText)
    ? 'jinya'
    : /(?:на|для|назнач(?:ить|ь)|ответственн\w*)\s+(?:л[её]ш(?:у|е|и)|алекс(?:ея|ею|ей))/iu.test(assigneeText)
      ? 'alex'
      : sender
  return {
    title,
    category: /купить|заказать|покупк/iu.test(text) ? 'shopping'
      : /уборк|помыть|убрать/iu.test(text) ? 'cleaning'
      : /сч[её]т|оплатить/iu.test(text) ? 'bill' : 'task',
    assignedTo,
    dueDate: null,
    remindAt: parseReminder(text),
    priority: /срочно|urgent/iu.test(text) ? 'urgent' : /важн|высок(?:ий|ого) приоритет/iu.test(text) ? 'high' : 'normal',
    notes: null,
    linkUrl: extractUrl(text),
  }
}

function isTaskMetadata(part: string) {
  return /^(?:задача|исполнитель|ответственн\w*|назнач(?:ить|ь)|для)\b/iu.test(part)
    || /^(?:уведом(?:ление|ить)|напомни(?:ть|ание)?)\b/iu.test(part)
    || /^(?:срок|дедлайн|приоритет|категория)\b/iu.test(part)
}

function parseReminder(text: string) {
  const reminder = text.match(/(?:уведом(?:ление|ить)|напомни(?:ть|ание)?)[\s\S]*?\bв\s*(\d{1,2})(?:[:.](\d{2}))?/iu)
  if (!reminder || !/\b(?:сегодня|завтра)\b/iu.test(text)) return null
  const hour = Number(reminder[1])
  const minute = Number(reminder[2] ?? 0)
  if (hour > 23 || minute > 59) return null
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const dateParts = Object.fromEntries(formatter.formatToParts(new Date()).map(part => [part.type, part.value]))
  const base = new Date(`${dateParts.year}-${dateParts.month}-${dateParts.day}T00:00:00+03:00`)
  if (/\bзавтра\b/iu.test(text)) base.setUTCDate(base.getUTCDate() + 1)
  return `${base.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+03:00`
}

function taskConfirmation(task: TaskInput) {
  const person = task.assignedTo === 'jinya' ? 'Жиня' : 'Алексей'
  const reminder = task.remindAt
    ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(task.remindAt))
    : null
  return [`Задача создана: ${task.title}`, `Ответственный: ${person}`, reminder ? `Напоминание: ${reminder}` : null]
    .filter(Boolean).join('\n')
}

async function sendTelegram(token: string, chatId: string, text: string, extra: Record<string, unknown> = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true, ...extra }),
  })
  if (!response.ok) throw new Error(`Telegram sendMessage failed: ${response.status}`)
}

function extractUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s]+/i)
  const candidate = match?.[0].replace(/[),.!?]+$/, '')
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    return isPublicHostname(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

function isPublicHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return false
  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return true
  const [first, second] = octets
  return first !== 0
    && first !== 10
    && first !== 127
    && !(first === 169 && second === 254)
    && !(first === 172 && second >= 16 && second <= 31)
    && !(first === 192 && second === 168)
}

function hostnameLabel(url: string) {
  return new URL(url).hostname.replace(/^www\./, '')
}

function linkType(url: string) {
  const host = new URL(url).hostname
  if (host.includes('instagram.com')) return 'reel'
  if (host.includes('tiktok.com')) return 'tiktok'
  return 'article'
}

type LinkMetadata = {
  title: string | null
  description: string | null
  image: string | null
  city: string | null
  country: string | null
  ingredients: string[] | null
  instructions: string | null
  prepTime: number | null
  servings: number | null
  sourceText?: string | null
  confidence?: number | null
}

const EMPTY_METADATA: LinkMetadata = {
  title: null, description: null, image: null, city: null, country: null,
  ingredients: null, instructions: null, prepTime: null, servings: null,
}

async function fetchApifyMetadata(url: string, token: string): Promise<LinkMetadata> {
  const { actor, input } = apifyActorFor(url)
  const endpoint = new URL(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`)
  endpoint.searchParams.set('timeout', '60')
  endpoint.searchParams.set('maxItems', '1')
  endpoint.searchParams.set('maxTotalChargeUsd', '0.15')
  endpoint.searchParams.set('clean', 'true')

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(65_000),
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(input),
    })
    if (!response.ok) return EMPTY_METADATA
    const items = await response.json()
    const item = Array.isArray(items) && items[0] && typeof items[0] === 'object'
      ? items[0] as Record<string, unknown>
      : null
    return item ? metadataFromApify(item) : EMPTY_METADATA
  } catch {
    return EMPTY_METADATA
  }
}

function apifyActorFor(url: string) {
  const host = new URL(url).hostname.toLowerCase()
  if (host.includes('instagram.com')) {
    return {
      actor: 'apify~instagram-scraper',
      input: { directUrls: [url], resultsType: 'posts', resultsLimit: 1 },
    }
  }
  if (host.includes('tiktok.com')) {
    return {
      actor: 'clockworks~tiktok-video-scraper',
      input: {
        postURLs: [url],
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false,
        shouldDownloadSubtitles: false,
        shouldDownloadVideos: false,
      },
    }
  }
  return {
    actor: 'apify~website-content-crawler',
    input: {
      startUrls: [{ url }],
      crawlerType: 'playwright:adaptive',
      maxCrawlDepth: 0,
      maxCrawlPages: 1,
      saveMarkdown: true,
      saveHtml: false,
      saveHtmlAsFile: false,
      useSitemaps: false,
      respectRobotsTxtFile: true,
    },
  }
}

function metadataFromApify(item: Record<string, unknown>): LinkMetadata {
  const nestedMetadata = recordValue(item.metadata)
  const location = recordValue(item.location)
  const address = recordValue(item.address)
  const caption = firstText(item.caption, item.text, item.description, item.markdown)
  return {
    title: firstText(item.title, item.name, nestedMetadata?.title, firstLine(caption)),
    description: firstText(item.description, item.caption, item.text, nestedMetadata?.description, truncateText(item.markdown)),
    image: imageValue(item.displayUrl ?? item.imageUrl ?? item.image ?? item.thumbnailUrl ?? nestedMetadata?.image),
    city: firstText(item.locationName, location?.name, address?.addressLocality, item.city),
    country: firstText(address?.addressCountry, item.country),
    ingredients: stringArray(item.recipeIngredient ?? item.ingredients),
    instructions: firstText(item.recipeInstructions ?? item.instructions),
    prepTime: parseIsoMinutes(firstText(item.totalTime, item.prepTime)),
    servings: parseServings(item.recipeYield ?? item.servings),
    sourceText: apifyTextEvidence(item),
  }
}

function mergeMetadata(primary: LinkMetadata, fallback: LinkMetadata): LinkMetadata {
  return {
    title: primary.title ?? fallback.title,
    description: primary.description ?? fallback.description,
    image: primary.image ?? fallback.image,
    city: primary.city ?? fallback.city,
    country: primary.country ?? fallback.country,
    ingredients: primary.ingredients ?? fallback.ingredients,
    instructions: primary.instructions ?? fallback.instructions,
    prepTime: primary.prepTime ?? fallback.prepTime,
    servings: primary.servings ?? fallback.servings,
    sourceText: primary.sourceText ?? fallback.sourceText,
    confidence: primary.confidence ?? fallback.confidence,
  }
}

function apifyTextEvidence(item: Record<string, unknown>) {
  const values = [
    item.caption,
    item.text,
    item.description,
    item.transcript,
    item.subtitles,
    item.closedCaptions,
    item.markdown,
  ].flatMap(extractTextParts)
  const unique = [...new Set(values.map(value => value.trim()).filter(Boolean))]
  return unique.length ? unique.join('\n\n').slice(0, 16_000) : null
}

function extractTextParts(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(extractTextParts)
  const object = recordValue(value)
  if (!object) return []
  return [object.text, object.content, object.transcript, object.caption].flatMap(extractTextParts)
}

function hasUsefulMetadata(mode: Mode, metadata: LinkMetadata) {
  if (mode === 'recipe') {
    return Boolean(metadata.ingredients?.length || metadata.instructions)
  }
  if (mode === 'travel') {
    return Boolean(
      metadata.city
      || metadata.country
      || (metadata.title && metadata.description && metadata.description.length >= 30)
    )
  }
  return false
}

function linkOnlyMetadata(mode: 'recipe' | 'travel', url: string): LinkMetadata {
  const source = hostnameLabel(url)
  return {
    ...EMPTY_METADATA,
    title: mode === 'recipe' ? `Рецепт · ${source}` : `Место · ${source}`,
  }
}

async function analyzeWithGemini(
  mode: Mode,
  sourceUrl: string,
  evidence: LinkMetadata,
  apiKey: string,
): Promise<LinkMetadata | null> {
  if (mode !== 'recipe' && mode !== 'travel') return null
  if (!evidence.sourceText?.trim()) return null
  const input: Record<string, unknown>[] = [{
    type: 'text',
    text: analyzerPrompt(mode, sourceUrl, evidence),
  }]

  try {
    let response = await requestGeminiAnalysis('gemini-3.6-flash', input, mode, apiKey)
    if (response.status === 429) {
      response = await requestGeminiAnalysis('gemini-3.5-flash', input, mode, apiKey)
    }
    if (!response.ok) {
      console.error('Gemini analysis failed', response.status)
      return null
    }
    const body = await response.json() as Record<string, unknown>
    const text = interactionOutputText(body)
    if (!text) return null
    return metadataFromGemini(JSON.parse(text) as Record<string, unknown>, mode)
  } catch (error) {
    console.error('Gemini analysis failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

function requestGeminiAnalysis(
  model: string,
  input: Record<string, unknown>[],
  mode: 'recipe' | 'travel',
  apiKey: string,
) {
  return fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal: AbortSignal.timeout(120_000),
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({ model, input, response_format: analyzerSchema(mode) }),
  })
}

function analyzerPrompt(mode: 'recipe' | 'travel', sourceUrl: string, evidence: LinkMetadata) {
  const task = mode === 'recipe'
    ? 'Extract a practical recipe: concise dish name, ingredients with quantities exactly as stated, ordered cooking steps, total time and servings.'
    : 'Extract a travel place: concise place or hotel name, city, country and a useful factual description.'
  return `${task}
Analyze only the supplied text collected by Apify: caption, description, transcript, subtitles or page text.
Use only facts supported by the source. Never invent missing names, quantities, locations, times or steps.
Source URL: ${sourceUrl}
Existing title: ${evidence.title ?? ''}
Apify text: ${evidence.sourceText ?? evidence.description ?? ''}`
}

function analyzerSchema(mode: 'recipe' | 'travel') {
  const common = {
    title: { type: 'string', description: 'A short normalized Russian title.' },
    description: { type: ['string', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  }
  const properties = mode === 'recipe' ? {
    ...common,
    ingredients: { type: 'array', items: { type: 'string' } },
    instructions: { type: 'array', items: { type: 'string' } },
    prep_time_min: { type: ['integer', 'null'] },
    servings: { type: ['integer', 'null'] },
  } : {
    ...common,
    city: { type: ['string', 'null'] },
    country: { type: ['string', 'null'] },
  }
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }
}

function interactionOutputText(body: Record<string, unknown>) {
  const steps = Array.isArray(body.steps) ? body.steps : []
  for (const stepValue of steps) {
    const step = recordValue(stepValue)
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue
    for (const partValue of step.content) {
      const part = recordValue(partValue)
      if (part?.type === 'text' && typeof part.text === 'string') return part.text
    }
  }
  return null
}

function metadataFromGemini(item: Record<string, unknown>, mode: 'recipe' | 'travel'): LinkMetadata {
  const instructions = stringArray(item.instructions)
  return {
    ...EMPTY_METADATA,
    title: firstText(item.title),
    description: firstText(item.description),
    city: mode === 'travel' ? firstText(item.city) : null,
    country: mode === 'travel' ? firstText(item.country) : null,
    ingredients: mode === 'recipe' ? stringArray(item.ingredients) : null,
    instructions: mode === 'recipe' && instructions?.length ? instructions.join('\n') : null,
    prepTime: mode === 'recipe' && typeof item.prep_time_min === 'number' ? item.prep_time_min : null,
    servings: mode === 'recipe' && typeof item.servings === 'number' ? item.servings : null,
    confidence: typeof item.confidence === 'number' ? item.confidence : null,
  }
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = asText(value)
    if (text) return text
  }
  return null
}

function firstLine(value: string | null) {
  return value?.split(/\r?\n/).find(line => line.trim())?.trim() ?? null
}

function truncateText(value: unknown) {
  const text = asText(value)
  return text ? text.slice(0, 1200) : null
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const items = value.map(asText).filter((item): item is string => Boolean(item))
  return items.length ? items : null
}

async function fetchMetadata(url: string): Promise<LinkMetadata> {
  const fallback = EMPTY_METADATA
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HomeOSBot/1.0)' },
    })
    if (!response.ok) return fallback
    const html = (await response.text()).slice(0, 1_500_000)
    const jsonLd = findJsonLd(html)
    const recipe = findTypedObject(jsonLd, 'Recipe')
    const place = findTypedObject(jsonLd, ['Hotel', 'LodgingBusiness', 'TouristAttraction', 'Place'])
    const address = place?.address && typeof place.address === 'object' ? place.address : null
    const instructions = normalizeInstructions(recipe?.recipeInstructions)

    return {
      title: asText(recipe?.name ?? place?.name) ?? metaContent(html, ['og:title', 'twitter:title']) ?? pageTitle(html),
      description: asText(recipe?.description ?? place?.description) ?? metaContent(html, ['og:description', 'description']),
      image: imageValue(recipe?.image ?? place?.image) ?? metaContent(html, ['og:image', 'twitter:image']),
      city: asText(address?.addressLocality),
      country: asText(address?.addressCountry),
      ingredients: Array.isArray(recipe?.recipeIngredient) ? recipe.recipeIngredient.map(String) : null,
      instructions,
      prepTime: parseIsoMinutes(asText(recipe?.totalTime ?? recipe?.prepTime)),
      servings: parseServings(recipe?.recipeYield),
    }
  } catch {
    return fallback
  }
}

function metaContent(html: string, names: string[]) {
  const tags = html.match(/<meta\s+[^>]*>/gi) ?? []
  for (const tag of tags) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(match => [match[1].toLowerCase(), decodeHtml(match[2])]),
    )
    const name = (attrs.property ?? attrs.name ?? '').toLowerCase()
    if (names.includes(name) && attrs.content) return attrs.content
  }
  return null
}

function pageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? decodeHtml(match[1].trim()) : null
}

function findJsonLd(html: string): unknown[] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  return scripts.flatMap(match => {
    try {
      const value = JSON.parse(match[1])
      return Array.isArray(value) ? value : [value]
    } catch { return [] }
  })
}

function findTypedObject(values: unknown[], types: string | string[]): Record<string, unknown> | null {
  const wanted = Array.isArray(types) ? types : [types]
  const queue = [...values]
  while (queue.length) {
    const value = queue.shift()
    if (!value || typeof value !== 'object') continue
    const object = value as Record<string, unknown>
    const objectTypes = Array.isArray(object['@type']) ? object['@type'] : [object['@type']]
    if (objectTypes.some(type => wanted.includes(String(type)))) return object
    if (Array.isArray(object['@graph'])) queue.push(...object['@graph'])
  }
  return null
}

function normalizeInstructions(value: unknown) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return null
  const steps = value.map(item => {
    if (typeof item === 'string') return item
    if (item && typeof item === 'object') return asText((item as Record<string, unknown>).text)
    return null
  }).filter(Boolean)
  return steps.length ? steps.join('\n') : null
}

function imageValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return imageValue(value[0])
  if (value && typeof value === 'object') return asText((value as Record<string, unknown>).url)
  return null
}

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object') return asText((value as Record<string, unknown>).name)
  return null
}

function parseIsoMinutes(value: string | null) {
  if (!value) return null
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/i)
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : null
}

function parseServings(value: unknown) {
  const text = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
  const match = text.match(/\d+/)
  return match ? Number(match[0]) : null
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
