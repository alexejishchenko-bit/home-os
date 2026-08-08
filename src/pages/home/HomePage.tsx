import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Task, Category, Person, TaskStatus, TaskPriority } from '../../lib/types'
import WeekBoard from '../../components/WeekBoard'
import { isoDate } from '../../lib/dateUtils'
import './HomePage.css'

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'task', label: 'Задачи' },
  { value: 'cleaning', label: 'Уборка' },
  { value: 'shopping', label: 'Покупки' },
  { value: 'bill', label: 'Счета' },
]

const PEOPLE: { value: Person; label: string }[] = [
  { value: null, label: 'Оба' },
  { value: 'alex', label: 'Алексей' },
  { value: 'jinya', label: 'Жиня' },
]

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'inbox', label: 'Входящие' },
  { value: 'planned', label: 'Запланировано' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'waiting', label: 'Ждём' },
]

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'normal', label: 'Обычный' },
  { value: 'high', label: 'Важный' },
  { value: 'urgent', label: 'Срочный' },
]

const USER_TO_PERSON: Record<'lesha' | 'jinya', Person> = {
  lesha: 'alex',
  jinya: 'jinya',
}

type ViewMode = 'list' | 'board'

export default function HomePage({ currentUser }: { currentUser: 'lesha' | 'jinya' }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('list')
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [showDone, setShowDone] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // New task form
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('task')
  const [assignedTo, setAssignedTo] = useState<Person>(USER_TO_PERSON[currentUser])
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<TaskStatus>('inbox')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [notes, setNotes] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    async function loadTasks() {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setTasks(data)
      setLoading(false)
    }
    loadTasks()
  }, [])

  async function addTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    const { data } = await supabase.from('tasks').insert({
      title: title.trim(),
      category,
      assigned_to: assignedTo,
      due_date: dueDate || null,
      status,
      priority,
      notes: notes.trim() || null,
      link_url: linkUrl.trim() || null,
      remind_at: remindAt ? new Date(remindAt).toISOString() : null,
      reminder_sent_at: null,
    }).select().single()
    if (data) setTasks(prev => [data, ...prev])
    setTitle('')
    setDueDate('')
    setStatus('inbox')
    setPriority('normal')
    setNotes('')
    setLinkUrl('')
    setRemindAt('')
    setShowDetails(false)
    setAdding(false)
  }

  async function toggleDone(task: Task) {
    const done = !task.done
    await supabase.from('tasks').update({
      done,
      done_at: done ? new Date().toISOString() : null,
    }).eq('id', task.id)
    setTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, done, done_at: done ? new Date().toISOString() : null } : t
    ))
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    if (editingTask?.id === id) setEditingTask(null)
  }

  async function updateTask(id: string, patch: Partial<Task>) {
    await supabase.from('tasks').update(patch).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    setEditingTask(prev => prev?.id === id ? { ...prev, ...patch } : prev)
  }

  const todayStr = isoDate(new Date())
  const activeTasks = tasks.filter(t => !t.done)
  const overdue = activeTasks.filter(t => t.due_date && t.due_date < todayStr)
  const dueToday = activeTasks.filter(t => t.due_date === todayStr)
  const completed = tasks.filter(t => t.done)

  const filtered = tasks.filter(t => {
    if (!showDone && t.done) return false
    if (filter !== 'all' && t.category !== filter) return false
    return true
  })

  const filteredOverdue = filtered.filter(t => !t.done && t.due_date && t.due_date < todayStr)
  const filteredToday = filtered.filter(t => !t.done && t.due_date === todayStr)
  const filteredNext = filtered.filter(t => !t.done && (!t.due_date || t.due_date > todayStr))
  const filteredDone = filtered.filter(t => t.done)

  return (
    <div className="page">
      <div className="home-header">
        <div>
          <div className="page-eyebrow">Дом · общий трекер</div>
          <div className="home-title-row">
            <h1 className="page-title home">Задачи</h1>
            {overdue.length > 0 && (
              <span className="overdue-badge">{overdue.length} просрочено</span>
            )}
          </div>
          <p className="page-description">Всё, что нужно не забыть, решить или сделать вместе.</p>
        </div>
        <div className="view-toggle">
          <button
            className={`view-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Список
          </button>
          <button
            className={`view-btn ${view === 'board' ? 'active' : ''}`}
            onClick={() => setView('board')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="4" height="16" rx="1"/>
              <rect x="10" y="4" width="4" height="10" rx="1"/>
              <rect x="17" y="4" width="4" height="13" rx="1"/>
            </svg>
            Борд
          </button>
        </div>
      </div>

      <div className="task-overview" aria-label="Сводка по задачам">
        <div className="overview-item">
          <span className="overview-value">{activeTasks.length}</span>
          <span className="overview-label">В работе</span>
        </div>
        <div className="overview-item today">
          <span className="overview-value">{dueToday.length}</span>
          <span className="overview-label">На сегодня</span>
        </div>
        <div className="overview-item overdue">
          <span className="overview-value">{overdue.length}</span>
          <span className="overview-label">Просрочено</span>
        </div>
        <div className="overview-item completed">
          <span className="overview-value">{completed.length}</span>
          <span className="overview-label">Готово</span>
        </div>
      </div>

      {/* Add form */}
      <form className="add-form task-capture" onSubmit={addTask}>
        <div className="add-row">
          <div className="capture-plus" aria-hidden="true">+</div>
          <input
            className="add-input"
            placeholder="Добавить новую задачу..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={adding}
          />
          <button className="add-btn" type="submit" disabled={adding || !title.trim()}>
            Создать
          </button>
        </div>
        <div className="add-meta">
          <div className="seg-group">
            {CATEGORIES.map(c => (
              <button key={c.value} type="button"
                className={`seg-btn ${category === c.value ? 'active' : ''}`}
                onClick={() => setCategory(c.value)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="seg-group">
            {PEOPLE.map(p => (
              <button key={String(p.value)} type="button"
                className={`seg-btn ${assignedTo === p.value ? 'active' : ''}`}
                onClick={() => setAssignedTo(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          <input type="date" className="date-input" value={dueDate}
            onChange={e => setDueDate(e.target.value)} />
          <button type="button" className={`details-toggle ${showDetails ? 'active' : ''}`}
            onClick={() => setShowDetails(value => !value)} aria-expanded={showDetails}>
            {showDetails ? 'Скрыть детали' : 'Подробнее'}
          </button>
        </div>
        {showDetails && (
          <div className="task-details-panel">
            <div className="task-details-field">
              <span className="task-details-label">Статус</span>
              <div className="seg-group">
                {STATUSES.map(item => (
                  <button key={item.value} type="button"
                    className={`seg-btn ${status === item.value ? 'active' : ''}`}
                    onClick={() => setStatus(item.value)}>{item.label}</button>
                ))}
              </div>
            </div>
            <div className="task-details-field">
              <span className="task-details-label">Приоритет</span>
              <div className="seg-group">
                {PRIORITIES.map(item => (
                  <button key={item.value} type="button"
                    className={`seg-btn priority-${item.value} ${priority === item.value ? 'active' : ''}`}
                    onClick={() => setPriority(item.value)}>{item.label}</button>
                ))}
              </div>
            </div>
            <textarea className="add-input textarea" placeholder="Заметка к задаче"
              value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            <input className="add-input" type="url" placeholder="Ссылка на товар, документ или переписку"
              value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
            <label className="reminder-field">
              <span className="task-details-label">Напомнить в Telegram</span>
              <input className="add-input" type="datetime-local" value={remindAt}
                onChange={e => setRemindAt(e.target.value)} />
            </label>
          </div>
        )}
      </form>

      {/* Week board view */}
      {view === 'board' && (
        <WeekBoard
          tasks={tasks}
          onToggle={toggleDone}
          onTaskClick={setEditingTask}
        />
      )}

      {/* Filters (list only) */}
      {view === 'list' && (
        <div className="filters">
          <div className="seg-group">
            <button className={`seg-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}>
              Все ({activeTasks.length})
            </button>
            {CATEGORIES.map(c => {
              const count = activeTasks.filter(t => t.category === c.value).length
              return (
                <button key={c.value}
                  className={`seg-btn ${filter === c.value ? 'active' : ''}`}
                  onClick={() => setFilter(c.value)}>
                  {c.label} {count > 0 && <span className="count">{count}</span>}
                </button>
              )
            })}
          </div>
          <button className={`toggle-done ${showDone ? 'active' : ''}`}
            onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Скрыть выполненные' : 'Показать выполненные'}
          </button>
        </div>
      )}

      {/* Task list */}
      {view === 'list' && (loading ? (
        <div className="empty">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="empty">Задач нет</div>
      ) : (
        <div className="task-sections">
          <TaskSection title="Просрочено" tone="overdue" tasks={filteredOverdue}
            onToggle={toggleDone} onDelete={deleteTask} onEdit={setEditingTask} />
          <TaskSection title="Сегодня" tone="today" tasks={filteredToday}
            onToggle={toggleDone} onDelete={deleteTask} onEdit={setEditingTask} />
          <TaskSection title="Дальше" tasks={filteredNext}
            onToggle={toggleDone} onDelete={deleteTask} onEdit={setEditingTask} />
          {showDone && <TaskSection title="Выполнено" tone="done" tasks={filteredDone}
            onToggle={toggleDone} onDelete={deleteTask} onEdit={setEditingTask} />}
        </div>
      ))}

      {/* Edit modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={(patch) => updateTask(editingTask.id, patch)}
          onDelete={() => deleteTask(editingTask.id)}
        />
      )}
    </div>
  )
}

function TaskSection({ title, tone = '', tasks, onToggle, onDelete, onEdit }: {
  title: string
  tone?: string
  tasks: Task[]
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
}) {
  if (tasks.length === 0) return null

  return (
    <section className={`task-section ${tone}`}>
      <header className="task-section-header">
        <span className="task-section-dot" />
        <h2>{title}</h2>
        <span className="task-section-count">{tasks.length}</span>
      </header>
      <ul className="task-list">
        {tasks.map(task => (
          <TaskItem key={task.id} task={task}
            onToggle={() => onToggle(task)}
            onDelete={() => onDelete(task.id)}
            onEdit={() => onEdit(task)} />
        ))}
      </ul>
    </section>
  )
}

function TaskItem({ task, onToggle, onDelete, onEdit }: {
  task: Task; onToggle: () => void; onDelete: () => void; onEdit: () => void
}) {
  const isOverdue = !task.done && task.due_date && task.due_date < isoDate(new Date())
  const cat = CATEGORIES.find(c => c.value === task.category)
  const person = PEOPLE.find(p => p.value === task.assigned_to)
  const taskStatus = STATUSES.find(s => s.value === task.status)
  const taskPriority = PRIORITIES.find(p => p.value === task.priority)

  return (
    <li className={`task-item ${task.done ? 'done' : ''} ${isOverdue ? 'overdue' : ''}`}>
      <button className="check-btn" onClick={onToggle}
        aria-label={task.done ? `Вернуть задачу «${task.title}»` : `Выполнить задачу «${task.title}»`}>
        <span className="check-icon">{task.done ? '✓' : ''}</span>
      </button>
      <span className={`task-category-marker category-${task.category}`} aria-hidden="true" />
      <div className="task-body" onClick={onEdit} style={{ cursor: 'pointer' }}>
        <span className="task-title">{task.title}</span>
        <div className="task-meta">
          <span className="tag">{cat?.label}</span>
          {person?.label && <span className="tag">{person.label}</span>}
          {task.status && task.status !== 'inbox' && <span className="tag tag-status">{taskStatus?.label}</span>}
          {task.priority && task.priority !== 'normal' && (
            <span className={`tag tag-priority priority-${task.priority}`}>{taskPriority?.label}</span>
          )}
          {task.due_date && (
            <span className={`tag ${isOverdue ? 'tag-red' : ''}`}>{formatDate(task.due_date)}</span>
          )}
          {task.notes && <span className="tag">заметка</span>}
          {task.link_url && <a className="tag task-link" href={task.link_url} target="_blank"
            rel="noopener noreferrer" onClick={e => e.stopPropagation()}>ссылка ↗</a>}
          {task.remind_at && (
            <span className={`tag reminder-tag ${task.reminder_sent_at ? 'sent' : ''}`}>
              {task.reminder_sent_at ? 'уведомлено' : `напомнить ${formatDateTime(task.remind_at)}`}
            </span>
          )}
        </div>
      </div>
      <button className="delete-btn" onClick={onDelete} aria-label={`Удалить задачу «${task.title}»`}>×</button>
    </li>
  )
}

function TaskEditModal({ task, onClose, onSave, onDelete }: {
  task: Task
  onClose: () => void
  onSave: (patch: Partial<Task>) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [category, setCategory] = useState<Category>(task.category)
  const [assignedTo, setAssignedTo] = useState<Person>(task.assigned_to)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [status, setStatus] = useState<TaskStatus>(task.status ?? 'inbox')
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? 'normal')
  const [linkUrl, setLinkUrl] = useState(task.link_url ?? '')
  const [remindAt, setRemindAt] = useState(toDateTimeLocal(task.remind_at))

  function handleSave() {
    const nextReminder = remindAt ? new Date(remindAt).toISOString() : null
    onSave({ title: title.trim(), category, assigned_to: assignedTo, due_date: dueDate || null,
      status, priority, notes: notes.trim() || null, link_url: linkUrl.trim() || null,
      remind_at: nextReminder,
      reminder_sent_at: nextReminder === task.remind_at ? task.reminder_sent_at : null })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Редактировать задачу</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <input className="add-input" value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Название задачи" />

          <div className="modal-label">Категория</div>
          <div className="seg-group">
            {CATEGORIES.map(c => (
              <button key={c.value} type="button"
                className={`seg-btn ${category === c.value ? 'active' : ''}`}
                onClick={() => setCategory(c.value)}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="modal-label">Кто</div>
          <div className="seg-group">
            {PEOPLE.map(p => (
              <button key={String(p.value)} type="button"
                className={`seg-btn ${assignedTo === p.value ? 'active' : ''}`}
                onClick={() => setAssignedTo(p.value)}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="modal-label">Дедлайн</div>
          <input className="add-input" type="date" value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            style={{ colorScheme: 'dark' }} />

          <div className="modal-label">Статус</div>
          <div className="seg-group">
            {STATUSES.map(item => (
              <button key={item.value} type="button"
                className={`seg-btn ${status === item.value ? 'active' : ''}`}
                onClick={() => setStatus(item.value)}>{item.label}</button>
            ))}
          </div>

          <div className="modal-label">Приоритет</div>
          <div className="seg-group">
            {PRIORITIES.map(item => (
              <button key={item.value} type="button"
                className={`seg-btn priority-${item.value} ${priority === item.value ? 'active' : ''}`}
                onClick={() => setPriority(item.value)}>{item.label}</button>
            ))}
          </div>

          <div className="modal-label">Заметки</div>
          <textarea className="add-input textarea" value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Дополнительные детали..." rows={3} />

          <div className="modal-label">Ссылка</div>
          <input className="add-input" type="url" value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://..." />

          <div className="modal-label">Напомнить в Telegram</div>
          <input className="add-input" type="datetime-local" value={remindAt}
            onChange={e => setRemindAt(e.target.value)} />
        </div>

        <div className="modal-footer">
          <button className="modal-delete" onClick={() => { onDelete(); onClose() }}>
            Удалить
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="modal-cancel" onClick={onClose}>Отмена</button>
            <button className="modal-save" onClick={handleSave} disabled={!title.trim()}>
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
