import type { Task } from './types'

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Monday-based start of week
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return d
}

export function groupTasksByDate(tasks: Task[]): Record<string, Task[]> {
  const byDate: Record<string, Task[]> = {}
  tasks.forEach(t => {
    if (t.due_date) {
      if (!byDate[t.due_date]) byDate[t.due_date] = []
      byDate[t.due_date].push(t)
    }
  })
  return byDate
}
