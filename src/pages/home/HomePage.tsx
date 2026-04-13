import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Task, Category, Person } from '../../lib/types'
import './HomePage.css'

const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: 'task', label: 'Задачи', icon: '✓' },
  { value: 'cleaning', label: 'Уборка', icon: '🧹' },
  { value: 'shopping', label: 'Покупки', icon: '🛒' },
  { value: 'bill', label: 'Счета', icon: '💳' },
]

const PEOPLE: { value: Person; label: string }[] = [
  { value: null, label: 'Оба' },
  { value: 'alex', label: 'Алексей' },
  { value: 'kate', label: 'Жиня' },
]

const USER_TO_PERSON: Record<'lesha' | 'jinya', Person> = {
  lesha: 'alex',
  jinya: 'kate',
}

export default function HomePage({ currentUser }: { currentUser: 'lesha' | 'jinya' }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [showDone, setShowDone] = useState(false)

  // New task form
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('task')
  const [assignedTo, setAssignedTo] = useState<Person>(USER_TO_PERSON[currentUser])
  const [dueDate, setDueDate] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setTasks(data)
    setLoading(false)
  }

  async function addTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    const { data } = await supabase.from('tasks').insert({
      title: title.trim(),
      category,
      assigned_to: assignedTo,
      due_date: dueDate || null,
    }).select().single()
    if (data) setTasks(prev => [data, ...prev])
    setTitle('')
    setDueDate('')
    setAdding(false)
  }

  async function toggleDone(task: Task) {
    const done = !task.done
    await supabase.from('tasks').update({
      done,
      done_at: done ? new Date().toISOString() : null,
    }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done, done_at: done ? new Date().toISOString() : null } : t))
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const filtered = tasks.filter(t => {
    if (!showDone && t.done) return false
    if (filter !== 'all' && t.category !== filter) return false
    return true
  })

  const activeTasks = tasks.filter(t => !t.done)
  const overdue = activeTasks.filter(t => t.due_date && t.due_date < new Date().toISOString().slice(0, 10))

  return (
    <div className="page">
      <div className="home-header">
        <h1 className="page-title home">Дом</h1>
        {overdue.length > 0 && (
          <span className="overdue-badge">{overdue.length} просрочено</span>
        )}
      </div>

      {/* Add form */}
      <form className="add-form" onSubmit={addTask}>
        <div className="add-row">
          <input
            className="add-input"
            placeholder="Что надо сделать?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={adding}
          />
          <button className="add-btn" type="submit" disabled={adding || !title.trim()}>
            Добавить
          </button>
        </div>
        <div className="add-meta">
          <div className="seg-group">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
                className={`seg-btn ${category === c.value ? 'active' : ''}`}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="seg-group">
            {PEOPLE.map(p => (
              <button
                key={String(p.value)}
                type="button"
                className={`seg-btn ${assignedTo === p.value ? 'active' : ''}`}
                onClick={() => setAssignedTo(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            className="date-input"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>
      </form>

      {/* Filters */}
      <div className="filters">
        <div className="seg-group">
          <button
            className={`seg-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Все ({activeTasks.length})
          </button>
          {CATEGORIES.map(c => {
            const count = activeTasks.filter(t => t.category === c.value).length
            return (
              <button
                key={c.value}
                className={`seg-btn ${filter === c.value ? 'active' : ''}`}
                onClick={() => setFilter(c.value)}
              >
                {c.label} {count > 0 && <span className="count">{count}</span>}
              </button>
            )
          })}
        </div>
        <button
          className={`toggle-done ${showDone ? 'active' : ''}`}
          onClick={() => setShowDone(!showDone)}
        >
          {showDone ? 'Скрыть выполненные' : 'Показать выполненные'}
        </button>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="empty">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="empty">Задач нет</div>
      ) : (
        <ul className="task-list">
          {filtered.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={() => toggleDone(task)}
              onDelete={() => deleteTask(task.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function TaskItem({ task, onToggle, onDelete }: {
  task: Task
  onToggle: () => void
  onDelete: () => void
}) {
  const isOverdue = !task.done && task.due_date && task.due_date < new Date().toISOString().slice(0, 10)
  const cat = CATEGORIES.find(c => c.value === task.category)
  const person = PEOPLE.find(p => p.value === task.assigned_to)

  return (
    <li className={`task-item ${task.done ? 'done' : ''} ${isOverdue ? 'overdue' : ''}`}>
      <button className="check-btn" onClick={onToggle} aria-label="toggle">
        <span className="check-icon">{task.done ? '✓' : ''}</span>
      </button>
      <div className="task-body">
        <span className="task-title">{task.title}</span>
        <div className="task-meta">
          <span className="tag">{cat?.label}</span>
          {person?.label && <span className="tag">{person.label}</span>}
          {task.due_date && (
            <span className={`tag ${isOverdue ? 'tag-red' : ''}`}>
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
      <button className="delete-btn" onClick={onDelete} aria-label="delete">×</button>
    </li>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
