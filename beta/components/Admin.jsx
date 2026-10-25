import { useEffect, useRef, useState } from 'react'
import QrFormEditor from './QrFormEditor.jsx'
import { CONFIG_KEYS, addCustomField, initialDraft, prepareConfig } from '../lib/config.js'
import { supabase } from '../lib/supabase.js'
import { formatWhen } from '../lib/time.js'
import { Button } from './ui.jsx'

function move(list, index, dir) {
  const next = list.slice()
  const target = index + dir
  if (target < 0 || target >= next.length) return list
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export default function Admin({ app }) {
  if (app.backend && !app.adminChecked) return <p className="muted">Checking access…</p>
  if (!app.isAdmin) {
    return (
      <>
        <p className="eyebrow">Admin</p>
        <h1>Admin is closed</h1>
        <p className="lede">This page is only for a listed beta admin.</p>
        <div className="panel">
          <p>Sign in on the beta project with the emailed code. A listed admin can edit the configuration.</p>
          <p className="muted">Device-only mode has no admin list.</p>
        </div>
      </>
    )
  }
  return <Editor app={app} />
}

function Editor({ app }) {
  const [key, setKey] = useState('wording')
  const [draft, setDraft] = useState(() => initialDraft('wording', app.configRaw?.wording))
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(initialDraft('wording', app.configRaw?.wording)))
  const [seenVersion, setSeenVersion] = useState(app.configMeta?.wording?.version || 0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [audit, setAudit] = useState([])
  const meta = app.configMeta?.[key] || { version: 0, customized: false }
  const dirty = JSON.stringify(draft) !== snapshot
  const remoteNewer = dirty && (meta.version || 0) !== seenVersion
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty

  const adopt = (nextKey, source = app) => {
    const value = initialDraft(nextKey, source.configRaw?.[nextKey])
    setKey(nextKey)
    setDraft(value)
    setSnapshot(JSON.stringify(value))
    setSeenVersion(source.configMeta?.[nextKey]?.version || 0)
    setError('')
    setNotice('')
  }

  useEffect(() => {
    if (dirtyRef.current) return
    const value = initialDraft(key, app.configRaw?.[key])
    setDraft(value)
    setSnapshot(JSON.stringify(value))
    setSeenVersion(app.configMeta?.[key]?.version || 0)
  }, [app.configRaw, app.configMeta, key])

  useEffect(() => {
    if (!supabase) return undefined
    let cancel = false
    supabase
      .from('audit_events')
      .select('id,action,summary,before,after,created_at')
      .eq('entity', 'app_config')
      .eq('entity_id', key)
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (!cancel) setAudit(data || [])
      })
    return () => { cancel = true }
  }, [key, meta.version])

  const save = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const value = prepareConfig(key, draft)
      await app.saveConfig(key, value)
      const normalized = initialDraft(key, value)
      setDraft(normalized)
      setSnapshot(JSON.stringify(normalized))
      setNotice('Saved. Open screens pick this up without a new release.')
    } catch (err) {
      setError(err.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!meta.customized) return
    if (!window.confirm('Reset this setting to the built-in default?')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await app.resetConfig(key)
      const cleared = initialDraft(key, null)
      setDraft(cleared)
      setSnapshot(JSON.stringify(cleared))
      setSeenVersion(0)
      setNotice('Reset to the built-in default.')
    } catch (err) {
      setError(err.message || 'Could not reset.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin">
      <p className="eyebrow">Admin</p>
      <h1>Site configuration</h1>
      <p className="lede">Edits apply for this organisation when you save. A phone can leave this open and the change shows up on its own.</p>
      <div className="chip-row" role="tablist" aria-label="Settings">
        {CONFIG_KEYS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip${key === item.id ? ' active' : ''}`}
            onClick={() => adopt(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="muted">
        {CONFIG_KEYS.find((item) => item.id === key)?.blurb}
        {' '}
        {meta.customized ? `Version ${meta.version}.` : 'Built-in default.'}
        {meta.updatedAt ? ` Updated ${formatWhen(meta.updatedAt)}.` : ''}
      </p>
      {remoteNewer && (
        <p className="offline-banner">
          A newer version was saved.
          {' '}
          <button type="button" className="text-btn" onClick={() => adopt(key)}>Load it</button>
        </p>
      )}
      {key === 'wording' && <WordingEditor draft={draft} setDraft={setDraft} />}
      {key === 'forms' && <FormsEditor draft={draft} setDraft={setDraft} />}
      {key === 'modules' && <ModulesEditor draft={draft} setDraft={setDraft} />}
      {key === 'inspection_templates' && <TemplatesEditor draft={draft} setDraft={setDraft} />}
      {key === 'training_matrix' && <MatrixEditor draft={draft} setDraft={setDraft} />}
      {key === 'qr_forms' && <QrFormEditor draft={draft} setDraft={setDraft} />}
      {error && <p className="note">{error}</p>}
      {notice && <p className="offline-banner">{notice}</p>}
      <div className="panel">
        <h2>Audit</h2>
        {audit.length === 0 && <p className="muted">No changes to this setting yet.</p>}
        {audit.map((event) => (
          <details key={event.id} className="audit-item">
            <summary>
              <strong>{event.summary || event.action}</strong>
              <span>{formatWhen(event.created_at)}</span>
            </summary>
            <div className="split">
              <div>
                <div className="field-label">Before</div>
                <pre>{event.before == null ? 'Built-in default' : JSON.stringify(event.before, null, 2)}</pre>
              </div>
              <div>
                <div className="field-label">After</div>
                <pre>{event.after == null ? 'Built-in default' : JSON.stringify(event.after, null, 2)}</pre>
              </div>
            </div>
          </details>
        ))}
      </div>
      <div className="admin-savebar">
        <Button type="button" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save'}</Button>
        <Button type="button" kind="ghost" onClick={reset} disabled={busy || !meta.customized}>Reset to default</Button>
      </div>
    </div>
  )
}

function WordingEditor({ draft, setDraft }) {
  const fields = [
    ['homeTitle', 'Home title', false],
    ['homeLede', 'Home introduction', true],
    ['hseTitle', 'HSE screen title', false],
    ['hseIntro', 'HSE introduction', true],
    ['registerTitle', 'Register title', false],
    ['captureHint', 'Capture hint', true],
  ]
  return (
    <div className="panel">
      {fields.map(([name, label, multiline]) => (
        <label className="field" key={name}>
          <span className="field-label">{label}</span>
          {multiline ? (
            <textarea value={draft[name] || ''} onChange={(event) => setDraft({ ...draft, [name]: event.target.value })} />
          ) : (
            <input value={draft[name] || ''} onChange={(event) => setDraft({ ...draft, [name]: event.target.value })} />
          )}
        </label>
      ))}
    </div>
  )
}

function FormsEditor({ draft, setDraft }) {
  const [kind, setKind] = useState('incident')
  const form = draft[kind]
  const setForm = (next) => setDraft({ ...draft, [kind]: next })
  const sections = []
  for (const field of form?.fields || []) {
    if (!sections.includes(field.section || 'Extra')) sections.push(field.section || 'Extra')
  }
  return (
    <div className="panel">
      <div className="chip-row" aria-label="Forms">
        {Object.entries(draft).map(([id, item]) => (
          <button key={id} type="button" className={`chip${kind === id ? ' active' : ''}`} onClick={() => setKind(id)}>
            {item.label || id}
          </button>
        ))}
      </div>
      {form && (
        <>
          <label className="field">
            <span className="field-label">Form name</span>
            <input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
          </label>
          {sections.map((section) => (
            <details key={section} open>
              <summary className="field-label">{section}</summary>
              {form.fields.map((field, index) => field.section === section || (!field.section && section === 'Extra') ? (
                <FieldEditor
                  key={field.key}
                  field={field}
                  onChange={(next) => {
                    const fields = form.fields.slice()
                    fields[index] = next
                    setForm({ ...form, fields })
                  }}
                  onMove={(dir) => setForm({ ...form, fields: move(form.fields, index, dir) })}
                  onRemove={() => setForm({ ...form, fields: form.fields.filter((item) => item.key !== field.key) })}
                />
              ) : null)}
            </details>
          ))}
          <AddField onAdd={(label, type) => setForm(addCustomField(form, label, type))} />
        </>
      )}
    </div>
  )
}

function FieldEditor({ field, onChange, onMove, onRemove }) {
  return (
    <div className="admin-block">
      <label className="field">
        <span className="field-label">{field.locked ? 'Label (kept)' : 'Label'}</span>
        <input value={field.label} onChange={(event) => onChange({ ...field, label: event.target.value })} />
      </label>
      {field.type === 'note' && (
        <label className="field">
          <span className="field-label">Wording</span>
          <textarea value={field.help || ''} onChange={(event) => onChange({ ...field, help: event.target.value })} />
        </label>
      )}
      {field.type === 'select' && (
        <div className="field">
          <span className="field-label">Dropdown options</span>
          {(field.options || []).map((option, index) => (
            <div className="admin-inline" key={`${field.key}-${index}`}>
              <input
                aria-label={`${field.label} option ${index + 1}`}
                value={option}
                onChange={(event) => {
                  const options = field.options.slice()
                  options[index] = event.target.value
                  onChange({ ...field, options })
                }}
              />
              <button type="button" className="icon-btn" onClick={() => onChange({ ...field, options: field.options.filter((_, i) => i !== index) })} aria-label="Remove option">×</button>
            </div>
          ))}
          <button type="button" className="text-btn" onClick={() => onChange({ ...field, options: [...(field.options || []), ''] })}>Add option</button>
        </div>
      )}
      <div className="admin-inline">
        <label className="check">
          <input
            type="checkbox"
            checked={field.locked ? true : Boolean(field.required)}
            disabled={field.locked}
            onChange={(event) => onChange({ ...field, required: event.target.checked })}
          />
          <span>Required</span>
        </label>
        {!field.locked && (
          <label className="check">
            <input type="checkbox" checked={Boolean(field.hidden)} onChange={(event) => onChange({ ...field, hidden: event.target.checked })} />
            <span>Hide</span>
          </label>
        )}
        <button type="button" className="icon-btn" onClick={() => onMove(-1)} aria-label="Move up">↑</button>
        <button type="button" className="icon-btn" onClick={() => onMove(1)} aria-label="Move down">↓</button>
        {!field.locked && field.custom && (
          <button type="button" className="text-btn" onClick={onRemove}>Remove</button>
        )}
      </div>
    </div>
  )
}

function AddField({ onAdd }) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState('text')
  return (
    <div className="admin-block">
      <span className="field-label">Add a field</span>
      <div className="admin-inline">
        <input aria-label="New field label" value={label} placeholder="Label" onChange={(event) => setLabel(event.target.value)} />
        <select aria-label="New field type" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="text">Short text</option>
          <option value="textarea">Long text</option>
          <option value="select">Dropdown</option>
        </select>
      </div>
      <Button
        type="button"
        kind="ghost"
        onClick={() => {
          if (!label.trim()) return
          onAdd(label.trim(), type)
          setLabel('')
        }}
      >
        Add field
      </Button>
    </div>
  )
}

function ModulesEditor({ draft, setDraft }) {
  return (
    <div className="panel">
      {draft.map((mod, index) => (
        <div className="admin-block" key={mod.id}>
          <label className="field">
            <span className="field-label">Name</span>
            <input value={mod.label} onChange={(event) => {
              const next = draft.slice()
              next[index] = { ...mod, label: event.target.value }
              setDraft(next)
            }} />
          </label>
          <div className="admin-inline">
            <label className="check">
              <input
                type="checkbox"
                checked={mod.id === 'hse' ? true : mod.enabled !== false}
                disabled={mod.id === 'hse' || mod.locked}
                onChange={(event) => {
                  const next = draft.slice()
                  next[index] = { ...mod, enabled: event.target.checked }
                  setDraft(next)
                }}
              />
              <span>{mod.id === 'hse' ? 'Always on' : 'Show'}</span>
            </label>
            <button type="button" className="icon-btn" aria-label="Move module up" onClick={() => setDraft(move(draft, index, -1))}>↑</button>
            <button type="button" className="icon-btn" aria-label="Move module down" onClick={() => setDraft(move(draft, index, 1))}>↓</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function TemplatesEditor({ draft, setDraft }) {
  const update = (index, template) => {
    const next = draft.slice()
    next[index] = template
    setDraft(next)
  }
  return (
    <div className="panel">
      {draft.map((template, index) => (
        <div className="admin-block" key={template.id}>
          <label className="field">
            <span className="field-label">Template name</span>
            <input value={template.name} onChange={(event) => update(index, { ...template, name: event.target.value })} />
          </label>
          {(template.items || []).map((item, itemIndex) => (
            <div className="admin-inline" key={item.id}>
              <input
                aria-label={`${template.name} check ${itemIndex + 1}`}
                value={item.label}
                onChange={(event) => {
                  const items = template.items.slice()
                  items[itemIndex] = { ...item, label: event.target.value }
                  update(index, { ...template, items })
                }}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove check"
                onClick={() => update(index, { ...template, items: template.items.filter((row) => row.id !== item.id) })}
              >
                ×
              </button>
            </div>
          ))}
          <div className="actions">
            <button
              type="button"
              className="text-btn"
              onClick={() => update(index, {
                ...template,
                items: [...(template.items || []), { id: `item_${Date.now().toString(36)}`, label: '' }],
              })}
            >
              Add check
            </button>
            <button type="button" className="text-btn" onClick={() => setDraft(draft.filter((row) => row.id !== template.id))}>Remove template</button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        kind="ghost"
        onClick={() => setDraft([...draft, { id: `template_${Date.now().toString(36)}`, name: 'New inspection', items: [{ id: `item_${Date.now().toString(36)}`, label: '' }] }])}
      >
        Add template
      </Button>
    </div>
  )
}

function MatrixEditor({ draft, setDraft }) {
  const columns = draft.columns || []
  const setColumns = (next) => setDraft({ columns: next })
  return (
    <div className="panel">
      <p className="muted">These are the columns of the training matrix. Roles come from training records.</p>
      {columns.map((column, index) => (
        <div className="admin-inline" key={`${index}-${column}`}>
          <input
            aria-label={`Column ${index + 1}`}
            value={column}
            onChange={(event) => {
              const next = columns.slice()
              next[index] = event.target.value
              setColumns(next)
            }}
          />
          <button type="button" className="icon-btn" aria-label="Move column up" onClick={() => setColumns(move(columns, index, -1))}>↑</button>
          <button type="button" className="icon-btn" aria-label="Move column down" onClick={() => setColumns(move(columns, index, 1))}>↓</button>
          <button type="button" className="icon-btn" aria-label="Remove column" onClick={() => setColumns(columns.filter((_, i) => i !== index))}>×</button>
        </div>
      ))}
      <Button type="button" kind="ghost" onClick={() => setColumns([...columns, ''])}>Add column</Button>
    </div>
  )
}
