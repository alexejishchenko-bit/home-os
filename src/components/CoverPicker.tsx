import { useEffect, useId, useMemo, useState } from 'react'
import { resolveCoverUrl } from '../lib/covers'
import './CoverPicker.css'

export default function CoverPicker({ value, file, onValueChange, onFileChange }: {
  value: string
  file: File | null
  onValueChange: (value: string) => void
  onFileChange: (file: File | null) => void
}) {
  const inputId = useId()
  const [remotePreview, setRemotePreview] = useState<string | null>(null)
  const localPreview = useMemo(() => file ? URL.createObjectURL(file) : null, [file])

  useEffect(() => {
    if (!localPreview) return
    return () => URL.revokeObjectURL(localPreview)
  }, [localPreview])

  useEffect(() => {
    let active = true
    resolveCoverUrl(value).then(url => { if (active) setRemotePreview(url) })
    return () => { active = false }
  }, [value])

  const preview = localPreview ?? remotePreview

  return (
    <div className="cover-picker">
      {preview && <div className="cover-picker-preview" style={{ backgroundImage: `url(${preview})` }} />}
      <div className="cover-picker-controls">
        <input className="add-input" placeholder="URL обложки" value={file ? '' : value}
          disabled={Boolean(file)}
          onChange={event => { onFileChange(null); onValueChange(event.target.value) }} />
        <div className="cover-picker-actions">
          <label className="cover-picker-button" htmlFor={inputId}>Выбрать файл</label>
          {(file || value) && (
            <button className="cover-picker-remove" type="button"
              onClick={() => { onFileChange(null); onValueChange('') }}>Убрать</button>
          )}
        </div>
      </div>
      <input id={inputId} className="cover-picker-input" type="file" accept="image/jpeg,image/png,image/webp"
        onChange={event => onFileChange(event.target.files?.[0] ?? null)} />
    </div>
  )
}
