import { useState } from 'react'
import type { Task } from '../lib/types'
import { groupTasksByDate, startOfWeek, isoDate } from '../lib/dateUtils'
import './WeekBoard.css'

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const CATEGORY_COLOR: Record<Task['category'], string> = {
  task: 'var(--accent-home)',
  cleaning: 'var(--accent-sport)',
  shopping: 'var(--accent-travel)',
  bill: 'var(--accent-health)',
}

const PERSON_INITIAL: Record<string, string> = { alex: 'А', jinya: 'Ж' }

interface Props {
  tasks: Task[]
  onToggle: (task: Task) => void
  onTaskClick: (task: Task) => void
}

export default function WeekBoard({ tasks, onToggle, onTaskClick }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

  const tasksByDate = groupTasksByDate(tasks)
  const todayStr = isoDate(new Date())

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  function shiftWeek(delta: number) {
    setWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + delta * 7)
      return d
    })
  }

  const rangeLabel = `${days[0].getDate()} ${MONTHS_SHORT[days[0].getMonth()]} – ${days[6].getDate()} ${MONTHS_SHORT[days[6].getMonth()]}`

  return (
    <div className="week-board">
      <div className="wb-header">
        <button className="cal-nav" onClick={() => shiftWeek(-1)}>‹</button>
        <span className="cal-title">{rangeLabel}</span>
        <button className="cal-nav" onClick={() => shiftWeek(1)}>›</button>
      </div>

      <div className="wb-grid">
        {days.map((day, i) => {
          const dateStr = isoDate(day)
          const dayTasks = (tasksByDate[dateStr] || [])
          const isToday = dateStr === todayStr

          return (
            <div key={dateStr} className={`wb-col ${isToday ? 'today' : ''}`}>
              <div className="wb-col-header">
                <span className="wb-day-name">{DAY_NAMES[i]}</span>
                <span className="wb-day-num">{day.getDate()}</span>
              </div>

              <div className="wb-col-body">
                {dayTasks.length === 0 ? (
                  <span className="wb-empty">—</span>
                ) : (
                  dayTasks.map(task => (
                    <div
                      key={task.id}
                      className={`wb-card ${task.done ? 'done' : ''}`}
                      onClick={() => onTaskClick(task)}
                    >
                      <button
                        className="wb-check"
                        style={task.done ? { background: CATEGORY_COLOR[task.category], borderColor: CATEGORY_COLOR[task.category] } : { borderColor: CATEGORY_COLOR[task.category] }}
                        onClick={e => { e.stopPropagation(); onToggle(task) }}
                        aria-label="toggle"
                      >
                        {task.done && <span className="wb-check-icon">✓</span>}
                      </button>
                      <span className="wb-card-title">{task.title}</span>
                      {task.assigned_to && (
                        <span className="wb-person">{PERSON_INITIAL[task.assigned_to]}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
