import { useEffect, useState, useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
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

type PersonTab = 'alex' | 'kate'
type MainTab = 'workouts' | 'weight' | 'progress'

interface Exercise {
  name: string
  sets: number
  reps: number
  weight: number
}

function totalVolume(exercises: Exercise[]): number {
  return exercises.reduce((sum, e) => sum + e.sets * e.reps * e.weight, 0)
}

function totalSets(exercises: Exercise[]): number {
  return exercises.reduce((sum, e) => sum + e.sets, 0)
}

export default function SportPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<MainTab>('workouts')
  const [personTab, setPersonTab] = useState<PersonTab>('alex')
  const [showForm, setShowForm] = useState(false)

  // Workout form
  const [wPerson, setWPerson] = useState<PersonTab>('alex')
  const [wType, setWType] = useState('strength')
  const [wDate, setWDate] = useState(today())
  const [wDuration, setWDuration] = useState('')
  const [wNotes, setWNotes] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([
    { name: '', sets: 3, reps: 10, weight: 0 }
  ])

  // Weight form
  const [weightPerson, setWeightPerson] = useState<PersonTab>('alex')
  const [weightVal, setWeightVal] = useState('')
  const [weightDate, setWeightDate] = useState(today())

  // Progress
  const [selectedExercise, setSelectedExercise] = useState<string>('')

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

  // Exercise form helpers
  function updateExercise(i: number, field: keyof Exercise, val: string) {
    setExercises(prev => prev.map((e, idx) =>
      idx === i ? { ...e, [field]: field === 'name' ? val : (parseFloat(val) || 0) } : e
    ))
  }

  function addExercise() {
    setExercises(prev => [...prev, { name: '', sets: 3, reps: 10, weight: 0 }])
  }

  function removeExercise(i: number) {
    setExercises(prev => prev.filter((_, idx) => idx !== i))
  }

  async function addWorkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const cleanExercises = exercises.filter(e => e.name.trim())
    const { data } = await supabase.from('workouts').insert({
      person: wPerson,
      type: wType,
      date: wDate,
      duration_min: wDuration ? parseInt(wDuration) : null,
      exercises: cleanExercises.length > 0 ? cleanExercises : null,
      notes: wNotes || null,
    }).select().single()
    if (data) setWorkouts(prev => [data, ...prev])
    setWDuration(''); setWNotes(''); setWDate(today())
    setExercises([{ name: '', sets: 3, reps: 10, weight: 0 }])
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

  // All unique exercise names across person's workouts
  const exerciseNames = useMemo(() => {
    const names = new Set<string>()
    personWorkouts.forEach(w => {
      (w.exercises || []).forEach((e: Exercise) => { if (e.name) names.add(e.name) })
    })
    return Array.from(names).sort()
  }, [personWorkouts])

  // Progress data for selected exercise
  const progressData = useMemo(() => {
    if (!selectedExercise) return []
    return personWorkouts
      .filter(w => (w.exercises || []).some((e: Exercise) => e.name === selectedExercise))
      .map(w => {
        const sets = (w.exercises || []).filter((e: Exercise) => e.name === selectedExercise)
        const maxWeight = Math.max(...sets.map((e: Exercise) => e.weight))
        const volume = sets.reduce((s: number, e: Exercise) => s + e.sets * e.reps * e.weight, 0)
        const totalS = sets.reduce((s: number, e: Exercise) => s + e.sets, 0)
        return {
          date: formatShortDate(w.date),
          maxWeight,
          volume,
          sets: totalS,
        }
      })
      .reverse()
  }, [selectedExercise, personWorkouts])

  // Weekly summary
  const weeklySummary = useMemo(() => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekStr = weekAgo.toISOString().slice(0, 10)
    const weekWorkouts = personWorkouts.filter(w => w.date >= weekStr)
    const totalVol = weekWorkouts.reduce((s, w) =>
      s + totalVolume((w.exercises || []) as Exercise[]), 0)
    const totalS = weekWorkouts.reduce((s, w) =>
      s + totalSets((w.exercises || []) as Exercise[]), 0)
    return { count: weekWorkouts.length, volume: totalVol, sets: totalS }
  }, [personWorkouts])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title sport">Спорт</h1>
        <button className="add-btn-icon" onClick={() => setShowForm(!showForm)}>
          {showForm ? '×' : '+ Тренировка'}
        </button>
      </div>

      {/* Workout form */}
      {showForm && (
        <form className="add-form" onSubmit={addWorkout}>
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

          {/* Exercises */}
          <div className="exercises-block">
            <div className="exercises-header">
              <span className="form-section-title">Упражнения</span>
              {exercises.length > 0 && (
                <span className="volume-preview">
                  {totalVolume(exercises.filter(e => e.name)).toLocaleString('ru')} кг общий объём
                </span>
              )}
            </div>
            <div className="exercises-labels">
              <span>Упражнение</span>
              <span>Подх.</span>
              <span>Повт.</span>
              <span>Вес кг</span>
              <span></span>
            </div>
            {exercises.map((ex, i) => (
              <div key={i} className="exercise-row">
                <input className="add-input ex-name" placeholder="Жим лёжа..."
                  value={ex.name} onChange={e => updateExercise(i, 'name', e.target.value)}
                  list="exercise-suggestions" />
                <input className="add-input ex-num" type="number" min="1" max="20"
                  value={ex.sets} onChange={e => updateExercise(i, 'sets', e.target.value)} />
                <input className="add-input ex-num" type="number" min="1" max="100"
                  value={ex.reps} onChange={e => updateExercise(i, 'reps', e.target.value)} />
                <input className="add-input ex-num" type="number" min="0" step="0.5"
                  value={ex.weight} onChange={e => updateExercise(i, 'weight', e.target.value)} />
                <button type="button" className="ex-remove"
                  onClick={() => removeExercise(i)}>×</button>
              </div>
            ))}
            <button type="button" className="ex-add-btn" onClick={addExercise}>
              + упражнение
            </button>
            <datalist id="exercise-suggestions">
              {exerciseNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          <textarea className="add-input textarea" placeholder="Заметки"
            value={wNotes} onChange={e => setWNotes(e.target.value)} rows={2} />
          <button className="add-btn sport-btn" type="submit" disabled={saving}>
            Сохранить тренировку
          </button>
        </form>
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
          onClick={() => setTab('weight')}>Вес</button>
        <button className={`sub-tab ${tab === 'progress' ? 'active' : ''}`}
          onClick={() => setTab('progress')}>Динамика</button>
      </div>

      {loading ? <div className="empty">Загрузка...</div> : (
        <>
          {/* Workouts tab */}
          {tab === 'workouts' && (
            <>
              {weeklySummary.count > 0 && (
                <div className="week-summary">
                  <div className="week-stat">
                    <span className="week-num">{weeklySummary.count}</span>
                    <span className="week-label">тренировок за неделю</span>
                  </div>
                  <div className="week-stat">
                    <span className="week-num">{weeklySummary.sets}</span>
                    <span className="week-label">подходов</span>
                  </div>
                  <div className="week-stat">
                    <span className="week-num">{weeklySummary.volume.toLocaleString('ru')}</span>
                    <span className="week-label">кг объём</span>
                  </div>
                </div>
              )}
              {personWorkouts.length === 0
                ? <div className="empty">Тренировок нет</div>
                : <div className="workout-list">
                    {personWorkouts.map(w => (
                      <WorkoutCard key={w.id} workout={w}
                        onDelete={() => deleteWorkout(w.id)} />
                    ))}
                  </div>
              }
            </>
          )}

          {/* Weight tab */}
          {tab === 'weight' && (
            <div className="weight-section">
              <form className="add-form" onSubmit={addWeight}>
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
                  <button className="add-btn sport-btn" type="submit"
                    disabled={saving || !weightVal} style={{ whiteSpace: 'nowrap' }}>
                    + Записать
                  </button>
                </div>
              </form>

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

              {personWeight.length > 1 && (
                <div className="chart-block">
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={[...personWeight].reverse().map(e => ({
                      date: formatShortDate(e.date), кг: e.weight_kg
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                      <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: '#888', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 8 }} />
                      <Line type="monotone" dataKey="кг" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} />
                    </LineChart>
                  </ResponsiveContainer>
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

          {/* Progress tab */}
          {tab === 'progress' && (
            <div className="progress-section">
              {exerciseNames.length === 0 ? (
                <div className="empty">Добавь тренировки с упражнениями</div>
              ) : (
                <>
                  <div className="exercise-picker">
                    {exerciseNames.map(name => (
                      <button key={name}
                        className={`exercise-chip ${selectedExercise === name ? 'active' : ''}`}
                        onClick={() => setSelectedExercise(name)}>
                        {name}
                      </button>
                    ))}
                  </div>

                  {selectedExercise && progressData.length > 0 && (
                    <div className="progress-charts">
                      <div className="chart-block">
                        <div className="chart-title">Максимальный вес (кг)</div>
                        <ResponsiveContainer width="100%" height={180}>
                          <LineChart data={progressData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                            <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 8 }} />
                            <Line type="monotone" dataKey="maxWeight" name="Вес кг"
                              stroke="#60a5fa" strokeWidth={2} dot={{ r: 4, fill: '#60a5fa' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="chart-block">
                        <div className="chart-title">Объём нагрузки (подх × повт × вес)</div>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={progressData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
                            <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: 8 }} />
                            <Bar dataKey="volume" name="Объём кг" fill="#4ade80" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="progress-stats">
                        {progressData.length >= 2 && (() => {
                          const first = progressData[0]
                          const last = progressData[progressData.length - 1]
                          const weightGrowth = last.maxWeight - first.maxWeight
                          const volGrowth = last.volume - first.volume
                          return (
                            <>
                              <div className="progress-stat">
                                <span className="progress-stat-label">Прогресс веса</span>
                                <span className={`progress-stat-val ${weightGrowth >= 0 ? 'pos' : 'neg'}`}>
                                  {weightGrowth >= 0 ? '+' : ''}{weightGrowth} кг
                                </span>
                              </div>
                              <div className="progress-stat">
                                <span className="progress-stat-label">Прогресс объёма</span>
                                <span className={`progress-stat-val ${volGrowth >= 0 ? 'pos' : 'neg'}`}>
                                  {volGrowth >= 0 ? '+' : ''}{volGrowth.toLocaleString('ru')} кг
                                </span>
                              </div>
                              <div className="progress-stat">
                                <span className="progress-stat-label">Сессий</span>
                                <span className="progress-stat-val">{progressData.length}</span>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </>
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
  const exs = (workout.exercises || []) as Exercise[]
  const vol = totalVolume(exs)
  const sets = totalSets(exs)

  return (
    <div className="workout-card">
      <div className="workout-top">
        <div className="workout-left">
          <span className="workout-type-tag">{typeLabel}</span>
          <span className="workout-date">{formatDate(workout.date)}</span>
          {workout.duration_min && (
            <span className="workout-meta-item">{workout.duration_min} мин</span>
          )}
        </div>
        <div className="workout-totals">
          {sets > 0 && <span className="workout-total-chip">{sets} подх.</span>}
          {vol > 0 && <span className="workout-total-chip">{vol.toLocaleString('ru')} кг</span>}
        </div>
        <button className="delete-btn" onClick={onDelete}>×</button>
      </div>

      {exs.length > 0 && (
        <table className="exercises-table">
          <thead>
            <tr>
              <th>Упражнение</th>
              <th>Подх.</th>
              <th>Повт.</th>
              <th>Вес</th>
              <th>Объём</th>
            </tr>
          </thead>
          <tbody>
            {exs.map((ex, i) => (
              <tr key={i}>
                <td>{ex.name}</td>
                <td>{ex.sets}</td>
                <td>{ex.reps}</td>
                <td>{ex.weight} кг</td>
                <td className="vol-cell">{(ex.sets * ex.reps * ex.weight).toLocaleString('ru')} кг</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {workout.notes && <p className="workout-notes">{workout.notes}</p>}
    </div>
  )
}

function today() { return new Date().toISOString().slice(0, 10) }

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
