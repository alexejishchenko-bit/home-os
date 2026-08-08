import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Recipe } from '../../lib/types'
import './RecipesPage.css'

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null)
  const [editing, setEditing] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [servings, setServings] = useState('')
  const [tags, setTags] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchRecipes() }, [])

  async function fetchRecipes() {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setRecipes(data)
    setLoading(false)
  }

  function resetForm() {
    setTitle(''); setImageUrl(''); setPrepTime(''); setServings('')
    setTags(''); setIngredients(''); setInstructions(''); setSourceUrl(''); setNotes('')
  }

  function fillForm(recipe: Recipe) {
    setTitle(recipe.title)
    setImageUrl(recipe.image_url ?? '')
    setPrepTime(recipe.prep_time_min != null ? String(recipe.prep_time_min) : '')
    setServings(recipe.servings != null ? String(recipe.servings) : '')
    setTags(recipe.tags?.join(', ') ?? '')
    setIngredients(recipe.ingredients?.join('\n') ?? '')
    setInstructions(recipe.instructions ?? '')
    setSourceUrl(recipe.source_url ?? '')
    setNotes(recipe.notes ?? '')
  }

  function buildPayload() {
    return {
      title: title.trim(),
      image_url: imageUrl.trim() || null,
      prep_time_min: prepTime ? Number(prepTime) : null,
      servings: servings ? Number(servings) : null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      ingredients: ingredients ? ingredients.split('\n').map(l => l.trim()).filter(Boolean) : null,
      instructions: instructions.trim() || null,
      source_url: sourceUrl.trim() || null,
      notes: notes.trim() || null,
    }
  }

  async function addRecipe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('recipes').insert(buildPayload()).select().single()
    setSaving(false)
    if (error) { alert('Не удалось сохранить рецепт: ' + error.message); return }
    setRecipes(prev => [data, ...prev])
    resetForm()
    setShowForm(false)
  }

  async function saveEdit() {
    if (!openRecipe || !title.trim()) return
    setSaving(true)
    const patch = buildPayload()
    const { error } = await supabase.from('recipes').update(patch).eq('id', openRecipe.id)
    setSaving(false)
    if (error) { alert('Не удалось сохранить изменения: ' + error.message); return }
    setRecipes(prev => prev.map(r => r.id === openRecipe.id ? { ...r, ...patch } : r))
    setOpenRecipe(prev => prev ? { ...prev, ...patch } : prev)
    setEditing(false)
  }

  async function deleteRecipe(id: string) {
    await supabase.from('recipes').delete().eq('id', id)
    setRecipes(prev => prev.filter(r => r.id !== id))
    if (openRecipe?.id === id) { setOpenRecipe(null); setEditing(false) }
  }

  function openDetail(recipe: Recipe) {
    setOpenRecipe(recipe)
    setEditing(false)
  }

  function startEdit() {
    if (!openRecipe) return
    fillForm(openRecipe)
    setEditing(true)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title recipes">Рецепты</h1>
        <button className="add-btn-icon" onClick={() => { resetForm(); setShowForm(!showForm) }}>
          {showForm ? '×' : '+ Рецепт'}
        </button>
      </div>

      {showForm && (
        <form className="add-form" onSubmit={addRecipe}>
          <RecipeFormFields
            title={title} setTitle={setTitle}
            imageUrl={imageUrl} setImageUrl={setImageUrl}
            prepTime={prepTime} setPrepTime={setPrepTime}
            servings={servings} setServings={setServings}
            tags={tags} setTags={setTags}
            ingredients={ingredients} setIngredients={setIngredients}
            instructions={instructions} setInstructions={setInstructions}
            sourceUrl={sourceUrl} setSourceUrl={setSourceUrl}
            notes={notes} setNotes={setNotes}
          />
          <button className="add-btn recipes-btn" type="submit" disabled={saving || !title.trim()}>
            Сохранить
          </button>
        </form>
      )}

      {loading ? (
        <div className="empty">Загрузка...</div>
      ) : recipes.length === 0 ? (
        <div className="empty">Рецептов нет</div>
      ) : (
        <div className="recipes-grid">
          {recipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe}
              onOpen={() => openDetail(recipe)}
              onDelete={() => deleteRecipe(recipe.id)} />
          ))}
        </div>
      )}

      {openRecipe && (
        <div className="modal-overlay" onClick={() => setOpenRecipe(null)}>
          <div className="modal recipe-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Редактировать рецепт' : openRecipe.title}</span>
              <button className="modal-close" onClick={() => setOpenRecipe(null)}>×</button>
            </div>

            <div className="modal-body">
              {editing ? (
                <RecipeFormFields
                  title={title} setTitle={setTitle}
                  imageUrl={imageUrl} setImageUrl={setImageUrl}
                  prepTime={prepTime} setPrepTime={setPrepTime}
                  servings={servings} setServings={setServings}
                  tags={tags} setTags={setTags}
                  ingredients={ingredients} setIngredients={setIngredients}
                  instructions={instructions} setInstructions={setInstructions}
                  sourceUrl={sourceUrl} setSourceUrl={setSourceUrl}
                  notes={notes} setNotes={setNotes}
                />
              ) : (
                <RecipeDetail recipe={openRecipe} />
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-delete" onClick={() => deleteRecipe(openRecipe.id)}>
                Удалить
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing ? (
                  <>
                    <button className="modal-cancel" onClick={() => setEditing(false)}>Отмена</button>
                    <button className="modal-save recipes-save" onClick={saveEdit} disabled={saving || !title.trim()}>
                      Сохранить
                    </button>
                  </>
                ) : (
                  <button className="modal-save recipes-save" onClick={startEdit}>
                    Редактировать
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RecipeFormFields(props: {
  title: string; setTitle: (v: string) => void
  imageUrl: string; setImageUrl: (v: string) => void
  prepTime: string; setPrepTime: (v: string) => void
  servings: string; setServings: (v: string) => void
  tags: string; setTags: (v: string) => void
  ingredients: string; setIngredients: (v: string) => void
  instructions: string; setInstructions: (v: string) => void
  sourceUrl: string; setSourceUrl: (v: string) => void
  notes: string; setNotes: (v: string) => void
}) {
  const {
    title, setTitle, imageUrl, setImageUrl, prepTime, setPrepTime, servings, setServings,
    tags, setTags, ingredients, setIngredients, instructions, setInstructions,
    sourceUrl, setSourceUrl, notes, setNotes,
  } = props

  return (
    <>
      <div className="form-row">
        <input className="add-input" placeholder="Название рецепта" value={title}
          onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="form-row">
        <input className="add-input" placeholder="Картинка (URL)" value={imageUrl}
          onChange={e => setImageUrl(e.target.value)} />
      </div>
      <div className="form-row">
        <input className="add-input" type="number" min="0" placeholder="Время, мин" value={prepTime}
          onChange={e => setPrepTime(e.target.value)} />
        <input className="add-input" type="number" min="0" placeholder="Порции" value={servings}
          onChange={e => setServings(e.target.value)} />
      </div>
      <input className="add-input" placeholder="Теги через запятую: паста, быстрое, десерт"
        value={tags} onChange={e => setTags(e.target.value)} />
      <div className="modal-label">Ингредиенты (по строке)</div>
      <textarea className="add-input textarea" placeholder={'200г спагетти\n2 яйца\n50г пармезана'}
        value={ingredients} onChange={e => setIngredients(e.target.value)} rows={4} />
      <div className="modal-label">Шаги (по строке)</div>
      <textarea className="add-input textarea" placeholder={'Вскипятить воду\nОтварить спагетти\n...'}
        value={instructions} onChange={e => setInstructions(e.target.value)} rows={4} />
      <input className="add-input" placeholder="Ссылка на источник"
        value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
      <textarea className="add-input textarea" placeholder="Заметки"
        value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
    </>
  )
}

function RecipeCard({ recipe, onOpen, onDelete }: {
  recipe: Recipe; onOpen: () => void; onDelete: () => void
}) {
  return (
    <div className="recipe-card" onClick={onOpen}>
      {recipe.image_url && (
        <div className="recipe-thumb" style={{ backgroundImage: `url(${recipe.image_url})` }} />
      )}
      <div className="recipe-card-body">
        <div className="recipe-card-top">
          <h3 className="recipe-title">{recipe.title}</h3>
          <button className="delete-btn" onClick={e => { e.stopPropagation(); onDelete() }}>×</button>
        </div>
        {(recipe.prep_time_min || recipe.servings) && (
          <span className="recipe-meta">
            {recipe.prep_time_min ? `${recipe.prep_time_min} мин` : ''}
            {recipe.prep_time_min && recipe.servings ? ' · ' : ''}
            {recipe.servings ? `${recipe.servings} порц.` : ''}
          </span>
        )}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="recipe-tags">
            {recipe.tags.map(tag => (
              <span key={tag} className="recipe-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RecipeDetail({ recipe }: { recipe: Recipe }) {
  return (
    <div className="recipe-detail">
      {recipe.image_url && (
        <div className="recipe-detail-thumb" style={{ backgroundImage: `url(${recipe.image_url})` }} />
      )}
      {(recipe.prep_time_min || recipe.servings) && (
        <span className="recipe-meta">
          {recipe.prep_time_min ? `${recipe.prep_time_min} мин` : ''}
          {recipe.prep_time_min && recipe.servings ? ' · ' : ''}
          {recipe.servings ? `${recipe.servings} порц.` : ''}
        </span>
      )}
      {recipe.tags && recipe.tags.length > 0 && (
        <div className="recipe-tags">
          {recipe.tags.map(tag => <span key={tag} className="recipe-tag">{tag}</span>)}
        </div>
      )}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <>
          <div className="modal-label">Ингредиенты</div>
          <ul className="recipe-list">
            {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
          </ul>
        </>
      )}
      {recipe.instructions && (
        <>
          <div className="modal-label">Шаги</div>
          <ol className="recipe-list">
            {recipe.instructions.split('\n').filter(Boolean).map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </>
      )}
      {recipe.source_url && (
        <a className="recipe-source-link" href={recipe.source_url} target="_blank" rel="noopener noreferrer">
          Источник ↗
        </a>
      )}
      {recipe.notes && <p className="place-notes">{recipe.notes}</p>}
    </div>
  )
}
