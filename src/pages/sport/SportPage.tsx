import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Workout, WeightEntry } from '../../lib/types'
import './SportPage.css'

const WORKOUT_TYPES = [
  { value: 'strength', label: 'Силовая' },
  { value: 'cardio',   label: 'Кардио' },
  { value: 'yoga',     label: 'Йога' },
  { value: 'other',    label: 'Другое' },
]

const PEOPLE = [
  { value: 'alex', label: 'Алексей' },
  { value: 'kate', label: 'Жиня' },
]

type Tab = 'workouts' | 'weight'
type PersonTab = 'alex' | 'kate'

export default function SportPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('workouts')
  const [personTab, setPersonTab] = useState<PersonTab>('alex')
  const [showForm, setShowForm] = useState(false)

  // Workout form
  const [wPerson, setWPerson] = useState<PersonTab>('alex')
  const [wType, setWType] = useState('strength')
  const [wDate, setWDate] = useState(today())
  const [wDuration, setWDuration] = useState('')
  const [wNotes, setWNotes] = useState('')

  // Weight form
  const [weightPerson, setWeightPerson] = useState<PersonTab>('alex')
  const [weightVal, setWeightVal] = useState('')
  const [weightDate, setWeightDate] = useState(today())

  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [w, wl] = await Promise.all([
      supabase.from('workouts').select('*').order('date', { ascending: false }),
      supabase.from('weight_log').select('*').order('date', { ascending: false }),
    ])
    if (w.data) setWorkouts(w.data)
    if (wl.data) setWeightLog(wl.data)
    setLoading(false)
  }

  async function addWorkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const { data } = await supabase.from('workouts').insert({
      person: wPerson,
      type: wType,
      date: wDate,
      duration_min: wDuration ? parseInt(wDuration) : null,
      notes: wNotes || null,
    }).select().single()
    if (data) setWorkouts(prev => [data, ...prev])
    setWDuration(''); setWNotes(''); setWDate(today())
    setSaving(false); setShowForm(false)
  }

  async function addWeight(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!weightVal) return
    setSaving(true)
    const { data } = await supabase.from('weight_log').insert({
      person: weightPerson,
      date: weightDate,
      weight_kg: parseFloat(weightVal),
    }).select().single()
    if (data) setWeightLog(prev => [data, ...prev])
    setWeightVal(''); setWeightDate(today())
    setSaving(false); setShowForm(false)
  }

  async function deleteWorkout(id: string) {
    await supabase.from('workouts').delete().eq('id', id)
    setWorkouts(prev => prev.filter(w => w.id !== id))
  }

  async function deleteWeight(id: string) {
    await supabase.from('weight_log').delete().eq('id', id)
    setWeightLog(prev => prev.filter(w => w.id !== id))
  }

  const personWorkouts = workouts.filter(w => w.person === personTab)
  const personWeight = weightLog.filter(w => w.person === personTab)
  const lastWeight = personWeight[0]?.weight_kg
  const prevWeight = personWeight[1]?.weight_kg
  const weightDiff = lastWeight && prevWeight ? (lastWeight - prevWeight).toFixed(1) : null

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title sport">Спорт</h1>
        <button className="add-btn-icon" onClick={() => setShowForm(!showForm)}>
          {showForm ? '×' : '+ Добавить'}
        </button>
      </div>

      {showForm && (
        <div className="sport-forms">
          <form className="add-form" onSubmit={addWorkout}>
            <div className="form-section-title">Тренировка</div>
            <div className="form-row">
              <div className="seg-group">
                {PEOPLE.map(p => (
                  <button key={p.value} type="button"
                    className={`seg-btn ${wPerson === p.value ? 'active' : ''}`}
                    onClick={() => setWPerson(p.value as PersonTab)}>{p.label}</button>
                ))}
              </div>
              <div className="seg-group">
                {WORKOUT_TYPES.map(t => (
                  <button key={t.value} type="button"
                    className={`seg-btn ${wType === t.value ? 'active' : ''}`}
                    onClick={() => setWType(t.value)}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <input className="add-input" type="date" value={wDate}
                onChange={e => setWDate(e.target.value)} />
              <input className="add-input" type="number" placeholder="Минуты" value={wDuration}
                onChange={e => setWDuration(e.target.value)} min="1" max="300" />
            </div>
            <textarea className="add-input textarea" placeholder="Заметки (упражнения, ощущения...)"
              value={wNotes} onChange={e => setWNotes(e.target.value)} rows={2} />
            <button className="add-btn sport-btn" type="submit" disabled={saving}>Сохранить тренировку</button>
          </form>

          <form className="add-form" onSubmit={addWeight}>
            <div className="form-section-title">Вес</div>
            <div className="form-row">
              <div className="seg-group">
                {PEOPLE.map(p => (
                  <button key={p.value} type="button"
                    className={`seg-btn ${weightPerson === p.value ? 'active' : ''}`}
                    onClick={() => setWeightPerson(p.value as PersonTab)}>{p.label}</button>
                ))}
              </div>
              <input className="add-input" type="number" step="0.1" placeholder="Вес, кг"
                value={weightVal} onChange={e => setWeightVal(e.target.value)} />
              <input className="add-input" type="date" value={weightDate}
                onChange={e => setWeightDate(e.target.value)} />
            </div>
            <button className="add-btn sport-btn" type="submit" disabled={saving || !weightVal}>
              Сохранить вес
            </button>
          </form>
        </div>
      )}

      {/* Person tabs */}
      <div className="tabs">
        {PEOPLE.map(p => (
          <button key={p.value} className={`tab ${personTab === p.value ? 'active sport' : ''}`}
            onClick={() => setPersonTab(p.value as PersonTab)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Sub tabs */}
      <div className="sub-tabs">
        <button className={`sub-tab ${tab === 'workouts' ? 'active' : ''}`}
          onClick={() => setTab('workouts')}>
          Тренировки <span className="tab-count">{personWorkouts.length}</span>
        </button>
        <button className={`sub-tab ${tab === 'weight' ? 'active' : ''}`}
          onClick={() => setTab('weight')}>
          Вес
        </button>
      </div>

      {loading ? <div className="empty">Загрузка...</div> : (
        <>
          {tab === 'workouts' && (
            personWorkouts.length === 0 ? <div className="empty">Тренировок нет</div> : (
              <div className="workout-list">
                {personWorkouts.map(w => (
                  <WorkoutCard key={w.id} workout={w} onDelete={() => deleteWorkout(w.id)} />
                ))}
              </div>
            )
          )}

          {tab === 'weight' && (
            <div className="weight-section">
              {lastWeight && (
                <div className="weight-summary">
                  <div className="weight-current">
                    <span className="weight-num">{lastWeight}</span>
                    <span className="weight-unit">кг</span>
                  </div>
                  {weightDiff && (
                    <span className={`weight-diff ${parseFloat(weightDiff) > 0 ? 'up' : 'down'}`}>
                      {parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff} кг
                    </span>
                  )}
                </div>
              )}
              {personWeight.length === 0 ? <div className="empty">Записей нет</div> : (
                <div className="weight-list">
                  {personWeight.map(entry => (
                    <div key={entry.id} className="weight-row">
                      <span className="weight-date">{formatDate(entry.date)}</span>
                      <span className="weight-val">{entry.weight_kg} кг</span>
                      <button className="delete-btn" onClick={() => deleteWeight(entry.id)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function WorkoutCard({ workout, onDelete }: { workout: Workout; onDelete: () => void }) {
  const typeLabel = WORKOUT_TYPES.find(t => t.value === workout.type)?.label
  return (
    <div className="workout-card">
      <div className="workout-top">
        <div className="workout-left">
          <span className="workout-type-tag">{typeLabel}</span>
          <span className="workout-date">{formatDate(workout.date)}</span>
          {workout.duration_min && (
            <span className="workout-duration">{workout.duration_min} мин</span>
          )}
        </div>
        <button className="delete-btn" onClick={onDelete}>×</button>
      </div>
      {workout.notes && <p className="workout-notes">{workout.notes}</p>}
    </div>
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
