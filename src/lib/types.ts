export type Category = 'task' | 'cleaning' | 'shopping' | 'bill'
export type Person = 'alex' | 'jinya' | null
export type TaskStatus = 'inbox' | 'planned' | 'in_progress' | 'waiting'
export type TaskPriority = 'normal' | 'high' | 'urgent'

export interface Task {
  id: string
  title: string
  category: Category
  assigned_to: Person
  due_date: string | null
  done: boolean
  done_at: string | null
  notes: string | null
  status: TaskStatus
  priority: TaskPriority
  link_url: string | null
  remind_at: string | null
  reminder_sent_at: string | null
  created_at: string
}

export interface HealthEvent {
  id: string
  person: string
  type: string
  title: string
  date: string | null
  doctor: string | null
  notes: string | null
  next_step: string | null
  next_date: string | null
  remind_at: string | null
  reminder_sent_at: string | null
  created_at: string
}

export interface Workout {
  id: string
  person: string
  date: string
  type: string
  exercises: { name: string; sets: number; reps: number; weight: number }[] | null
  duration_min: number | null
  notes: string | null
  created_at: string
}

export interface WeightEntry {
  id: string
  person: string
  date: string
  weight_kg: number
  created_at: string
}

export interface Place {
  id: string
  title: string
  country: string | null
  city: string | null
  status: 'wishlist' | 'planned' | 'visited'
  tags: string[] | null
  links: { url: string; type: string; title?: string }[] | null
  notes: string | null
  image_url: string | null
  photos: string[] | null
  latitude: number | null
  longitude: number | null
  distance_km: number | null
  drive_minutes: number | null
  enriched_at: string | null
  created_at: string
}

export interface Recipe {
  id: string
  title: string
  ingredients: string[] | null
  instructions: string | null
  prep_time_min: number | null
  servings: number | null
  source_url: string | null
  tags: string[] | null
  image_url: string | null
  notes: string | null
  created_at: string
}
