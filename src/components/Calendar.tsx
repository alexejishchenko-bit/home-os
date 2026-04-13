import { useState } from 'react'
import type { Task } from '../lib/types'
import './Calendar.css'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

interface Props {
  tasks: Task[]
  onDayClick: (date: string | null) => void
  selectedDate: string | null
}

export default function Calendar({ tasks, onDayClick, selectedDate }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1)
  // Monday-based: Mon=0 ... Sun=6
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Map date string → tasks
  const tasksByDate: Record<string, Task[]> = {}
  tasks.forEach(t => {
    if (t.due_date) {
      if (!tasksByDate[t.due_date]) tasksByDate[t.due_date] = []
      tasksByDate[t.due_date].push(t)
    }
  })

  const todayStr = today.toISOString().slice(0, 10)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="calendar">
      <div className="cal-header">
        <button className="cal-nav" onClick={prevMonth}>‹</button>
        <span className="cal-title">{MONTHS[month]} {year}</span>
        <button className="cal-nav" onClick={nextMonth}>›</button>
      </div>

      <div className="cal-grid">
        {DAYS.map(d => (
          <div key={d} className="cal-day-name">{d}</div>
        ))}

        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="cal-cell empty" />

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayTasks = tasksByDate[dateStr] || []
          const doneTasks = dayTasks.filter(t => t.done)
          const activeTasks = dayTasks.filter(t => !t.done)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const isOverdue = dateStr < todayStr && activeTasks.length > 0

          return (
            <div
              key={dateStr}
              className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isOverdue ? 'overdue' : ''} ${dayTasks.length > 0 ? 'has-tasks' : ''}`}
              onClick={() => onDayClick(isSelected ? null : dateStr)}
            >
              <span className="cal-date">{day}</span>
              {dayTasks.length > 0 && (
                <div className="cal-dots">
                  {activeTasks.slice(0, 3).map((_, j) => (
                    <span key={j} className="cal-dot active" />
                  ))}
                  {doneTasks.slice(0, 2).map((_, j) => (
                    <span key={j} className="cal-dot done" />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
