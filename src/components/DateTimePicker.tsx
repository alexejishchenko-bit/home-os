import { useRef } from 'react'
import './DateTimePicker.css'

export default function DateTimePicker({ value, onChange }: {
  value: string
  onChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker() {
    const input = inputRef.current
    if (!input) return
    input.focus()
    try {
      input.showPicker?.()
    } catch {
      // Focus leaves the native date/time controls available as a fallback.
    }
  }

  return (
    <div className="datetime-picker">
      <input ref={inputRef} className="add-input" type="datetime-local" value={value}
        onChange={event => onChange(event.target.value)} onClick={openPicker} />
      <button type="button" className="datetime-picker-button" onClick={openPicker}
        aria-label="Открыть календарь и выбрать время" title="Выбрать дату и время">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 3v3m10-3v3M4.5 9.5h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </svg>
      </button>
    </div>
  )
}
