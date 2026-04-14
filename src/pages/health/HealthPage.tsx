import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { HealthEvent } from '../../lib/types'
import './HealthPage.css'

const TYPES = [
  { value: 'consultation', label: 'Консультация' },
  { value: 'procedure',    label: 'Процедура' },
  { value: 'aligner',      label: 'Элайнер' },
  { value: 'research',     label: 'Ресёрч' },
]

const PEOPLE = [
  { value: 'alex', label: 'Алексей' },
  { value: 'kate', label: 'Жиня' },
]

type Tab = 'alex' | 'kate'

export default function HealthPage() {
  const [events, setEvents] = useState<HealthEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('alex')
  const [showForm, setShowForm] = useState(false)

  // Form
  const [person, setPerson] = useState<'alex' | 'kate'>('alex')
  const [type, setType] = useState('consultation')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [doctor, setDoctor] = useState('')
  const [notes, setNotes] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchEvents() }, [])

  async function fetchEvents() {
    const { data } = await supabase
      .from('health_events')
      .select('*')
      .order('date', { ascending: false })
    if (data) setEvents(data)
    setLoading(false)
  }

  async function addEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const { data } = await supabase.from('health_events').insert({
      person,
      type,
      title: title.trim(),
      date: date || null,
      doctor: doctor || null,
      notes: notes || null,
      next_step: nextStep || null,
      next_date: nextDate || null,
    }).select().single()
    if (data) setEvents(prev => [data, ...prev])
    setTitle(''); setDate(''); setDoctor(''); setNotes(''); setNextStep(''); setNextDate('')
    setSaving(false)
    setShowForm(false)
  }

  async function deleteEvent(id: string) {
    await supabase.from('health_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const tabEvents = events.filter(e => e.person === tab)
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title health">Здоровье</h1>
        <button className="add-btn-icon" onClick={() => { setShowForm(!showForm); setPerson(tab) }}>
          {showForm ? '×' : '+ Добавить'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form className="add-form" onSubmit={addEvent}>
          <div className="form-row">
            <div className="seg-group">
              {PEOPLE.map(p => (
                <button key={p.value} type="button"
                  className={`seg-btn ${person === p.value ? 'active' : ''}`}
                  onClick={() => setPerson(p.value as 'alex' | 'kate')}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="seg-group">
              {TYPES.map(t => (
                <button key={t.value} type="button"
                  className={`seg-btn ${type === t.value ? 'active' : ''}`}
                  onClick={() => setType(t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <input className="add-input" placeholder="Название / тема" value={title}
            onChange={e => setTitle(e.target.value)} />
          <div className="form-row">
            <input className="add-input" type="date" value={date}
              onChange={e => setDate(e.target.value)} placeholder="Дата" />
            <input className="add-input" placeholder="Врач / клиника" value={doctor}
              onChange={e => setDoctor(e.target.value)} />
          </div>
          <textarea className="add-input textarea" placeholder="Заметки" value={notes}
            onChange={e => setNotes(e.target.value)} rows={2} />
          <div className="form-row">
            <input className="add-input" placeholder="Следующий шаг" value={nextStep}
              onChange={e => setNextStep(e.target.value)} />
            <input className="add-input" type="date" value={nextDate}
              onChange={e => setNextDate(e.target.value)} />
          </div>
          <button className="add-btn health-btn" type="submit" disabled={saving || !title.trim()}>
            Сохранить
          </button>
        </form>
      )}

      {/* Person tabs */}
      <div className="tabs">
        {PEOPLE.map(p => (
          <button key={p.value} className={`tab ${tab === p.value ? 'active health' : ''}`}
            onClick={() => setTab(p.value as Tab)}>
            {p.label}
            <span className="tab-count">{events.filter(e => e.person === p.value).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">Загрузка...</div>
      ) : tabEvents.length === 0 ? (
        <div className="empty">Событий нет</div>
      ) : (
        <div className="health-list">
          {tabEvents.map(ev => (
            <HealthCard key={ev.id} event={ev} todayStr={todayStr} onDelete={() => deleteEvent(ev.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function HealthCard({ event, todayStr, onDelete }: {
  event: HealthEvent; todayStr: string; onDelete: () => void
}) {
  const typeLabel = TYPES.find(t => t.value === event.type)?.label
  const hasNext = event.next_date || event.next_step
  const nextOverdue = event.next_date && event.next_date < todayStr

  return (
    <div className="health-card">
      <div className="health-card-top">
        <div className="health-card-left">
          <span className="health-type-tag">{typeLabel}</span>
          <h3 className="health-card-title">{event.title}</h3>
          <div className="health-card-meta">
            {event.date && <span>{formatDate(event.date)}</span>}
            {event.doctor && <span>{event.doctor}</span>}
          </div>
        </div>
        <button className="delete-btn" onClick={onDelete}>×</button>
      </div>
      {event.notes && <p className="health-notes">{event.notes}</p>}
      {hasNext && (
        <div className={`health-next ${nextOverdue ? 'overdue' : ''}`}>
          <span className="health-next-label">Следующий шаг:</span>
          {event.next_step && <span>{event.next_step}</span>}
          {event.next_date && <span className="health-next-date">{formatDate(event.next_date)}</span>}
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}
