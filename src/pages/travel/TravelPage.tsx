import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Place } from '../../lib/types'
import { uploadCover } from '../../lib/covers'
import CoverImage from '../../components/CoverImage'
import CoverPicker from '../../components/CoverPicker'
import './TravelPage.css'

const STATUSES = [
  { value: 'wishlist', label: 'Хочу', color: 'var(--accent-travel)' },
  { value: 'planned',  label: 'Планируем', color: 'var(--accent-sport)' },
  { value: 'visited',  label: 'Были', color: 'var(--accent-home)' },
]

type Tab = 'places' | 'docs'
type StatusFilter = 'all' | 'wishlist' | 'planned' | 'visited'

export default function TravelPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('places')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showForm, setShowForm] = useState(false)

  // Place form
  const [pTitle, setPTitle] = useState('')
  const [pCountry, setPCountry] = useState('')
  const [pCity, setPCity] = useState('')
  const [pStatus, setPStatus] = useState<'wishlist' | 'planned' | 'visited'>('wishlist')
  const [pTags, setPTags] = useState('')
  const [pLink, setPLink] = useState('')
  const [pNotes, setPNotes] = useState('')
  const [pImageUrl, setPImageUrl] = useState('')
  const [pImageFile, setPImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [coverUploadingId, setCoverUploadingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadPlaces() {
      const { data } = await supabase
        .from('places')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setPlaces(data)
      setLoading(false)
    }
    loadPlaces()
  }, [])

  async function addPlace(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!pTitle.trim()) return
    setSaving(true)
    let imageUrl = pImageUrl.trim()
    try {
      if (pImageFile) imageUrl = await uploadCover(pImageFile, 'travel')
    } catch (error) {
      setSaving(false)
      alert(error instanceof Error ? error.message : 'Не удалось загрузить обложку')
      return
    }
    const tags = pTags ? pTags.split(',').map(t => t.trim()).filter(Boolean) : null
    const links = pLink ? [{ url: pLink, type: 'other' }] : null
    const { data, error } = await supabase.from('places').insert({
      title: pTitle.trim(),
      country: pCountry || null,
      city: pCity || null,
      status: pStatus,
      tags,
      links,
      notes: pNotes || null,
      image_url: imageUrl || null,
    }).select().single()
    if (error) {
      setSaving(false)
      alert('Не удалось сохранить место: ' + error.message)
      return
    }
    if (data) setPlaces(prev => [data, ...prev])
    setPTitle(''); setPCountry(''); setPCity(''); setPTags(''); setPLink(''); setPNotes('')
    setPImageUrl(''); setPImageFile(null)
    setSaving(false); setShowForm(false)
  }

  async function updateStatus(place: Place, status: Place['status']) {
    await supabase.from('places').update({ status }).eq('id', place.id)
    setPlaces(prev => prev.map(p => p.id === place.id ? { ...p, status } : p))
  }

  async function deletePlace(id: string) {
    await supabase.from('places').delete().eq('id', id)
    setPlaces(prev => prev.filter(p => p.id !== id))
  }

  async function updateCover(place: Place, file: File) {
    setCoverUploadingId(place.id)
    try {
      const imageUrl = await uploadCover(file, 'travel')
      const { error } = await supabase.from('places').update({ image_url: imageUrl }).eq('id', place.id)
      if (error) throw error
      setPlaces(prev => prev.map(p => p.id === place.id ? { ...p, image_url: imageUrl } : p))
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось обновить обложку')
    } finally {
      setCoverUploadingId(null)
    }
  }

  const filtered = places.filter(p =>
    statusFilter === 'all' ? true : p.status === statusFilter
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title travel">Путешествия</h1>
        {tab === 'places' && (
          <button className="add-btn-icon" onClick={() => setShowForm(!showForm)}>
            {showForm ? '×' : '+ Место'}
          </button>
        )}
      </div>

      {/* Add place form */}
      {tab === 'places' && showForm && (
        <form className="add-form" onSubmit={addPlace}>
          <div className="form-row">
            <input className="add-input" placeholder="Название места" value={pTitle}
              onChange={e => setPTitle(e.target.value)} />
          </div>
          <div className="form-row">
            <input className="add-input" placeholder="Страна" value={pCountry}
              onChange={e => setPCountry(e.target.value)} />
            <input className="add-input" placeholder="Город" value={pCity}
              onChange={e => setPCity(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="seg-group">
              {STATUSES.map(s => (
                <button key={s.value} type="button"
                  className={`seg-btn ${pStatus === s.value ? 'active' : ''}`}
                  onClick={() => setPStatus(s.value as Place['status'])}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <input className="add-input" placeholder="Теги через запятую: горы, море, культура"
            value={pTags} onChange={e => setPTags(e.target.value)} />
          <input className="add-input" placeholder="Ссылка (рилс, статья...)"
            value={pLink} onChange={e => setPLink(e.target.value)} />
          <textarea className="add-input textarea" placeholder="Заметки" value={pNotes}
            onChange={e => setPNotes(e.target.value)} rows={2} />
          <div className="modal-label">Обложка</div>
          <CoverPicker value={pImageUrl} file={pImageFile}
            onValueChange={setPImageUrl} onFileChange={setPImageFile} />
          <button className="add-btn travel-btn" type="submit" disabled={saving || !pTitle.trim()}>
            Сохранить
          </button>
        </form>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'places' ? 'active travel' : ''}`}
          onClick={() => setTab('places')}>
          Места <span className="tab-count">{places.length}</span>
        </button>
        <button className={`tab ${tab === 'docs' ? 'active travel' : ''}`}
          onClick={() => setTab('docs')}>
          Документы
        </button>
      </div>

      {tab === 'places' && (
        <>
          {/* Status filter */}
          <div className="status-filters">
            <button className={`status-chip ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}>
              Все ({places.length})
            </button>
            {STATUSES.map(s => {
              const count = places.filter(p => p.status === s.value).length
              return (
                <button key={s.value}
                  className={`status-chip status-${s.value} ${statusFilter === s.value ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s.value as StatusFilter)}>
                  {s.label} {count > 0 && <span>{count}</span>}
                </button>
              )
            })}
          </div>

          {loading ? (
            <div className="empty">Загрузка...</div>
          ) : filtered.length === 0 ? (
            <div className="empty">Мест нет</div>
          ) : (
            <div className="places-grid">
              {filtered.map(place => (
                <PlaceCard key={place.id} place={place}
                  onStatusChange={(s) => updateStatus(place, s)}
                  onCoverChange={(file) => updateCover(place, file)}
                  coverUploading={coverUploadingId === place.id}
                  onDelete={() => deletePlace(place.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'docs' && <DocsPlaceholder />}
    </div>
  )
}

function PlaceCard({ place, onStatusChange, onCoverChange, coverUploading, onDelete }: {
  place: Place
  onStatusChange: (s: Place['status']) => void
  onCoverChange: (file: File) => void
  coverUploading: boolean
  onDelete: () => void
}) {
  return (
    <div className="place-card">
      {place.image_url && <CoverImage value={place.image_url} className="place-cover" />}
      <div className="place-card-top">
        <div className="place-card-info">
          <h3 className="place-title">{place.title}</h3>
          {(place.country || place.city) && (
            <span className="place-location">
              {[place.city, place.country].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
        <button className="delete-btn" onClick={onDelete}>×</button>
      </div>

      {place.tags && place.tags.length > 0 && (
        <div className="place-tags">
          {place.tags.map(tag => (
            <span key={tag} className="place-tag">{tag}</span>
          ))}
        </div>
      )}

      {place.notes && <p className="place-notes">{place.notes}</p>}

      {place.links && place.links.length > 0 && (
        <div className="place-links">
          {place.links.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
              className="place-link">
              {l.title || shortenUrl(l.url)}
            </a>
          ))}
        </div>
      )}

      <label className={`place-cover-action ${coverUploading ? 'disabled' : ''}`}>
        {coverUploading ? 'Загружаем…' : place.image_url ? 'Сменить обложку' : '+ Добавить обложку'}
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={coverUploading}
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) onCoverChange(file)
            event.target.value = ''
          }} />
      </label>

      <div className="place-status-row">
        {STATUSES.map(s => (
          <button key={s.value}
            className={`place-status-btn ${place.status === s.value ? 'active' : ''}`}
            style={place.status === s.value ? { color: s.color, borderColor: s.color } : {}}
            onClick={() => onStatusChange(s.value as Place['status'])}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DocsPlaceholder() {
  return (
    <div className="docs-placeholder">
      <p>Раздел документов (паспорта, визы, страховки) — скоро</p>
    </div>
  )
}

function shortenUrl(url: string) {
  try { return new URL(url).hostname.replace('www.', '') }
  catch { return url }
}
