import { QUESTION_TYPES } from '../lib/qrForms.js'
import { Button, Field } from './ui.jsx'

function move(list, index, dir) {
  const next = list.slice()
  const target = index + dir
  if (target < 0 || target >= next.length) return list
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export default function QrFormEditor({ draft, setDraft }) {
  const forms = Array.isArray(draft) ? draft : []

  const setForm = (index, patch) => {
    setDraft(forms.map((form, formIndex) => (formIndex === index ? { ...form, ...patch } : form)))
  }

  const setQuestion = (formIndex, questionIndex, patch) => {
    const form = forms[formIndex]
    const questions = form.questions.map((question, index) => (index === questionIndex ? { ...question, ...patch } : question))
    setForm(formIndex, { questions })
  }

  return (
    <div className="stack">
      {forms.map((form, formIndex) => (
        <div className="panel" key={form.id || formIndex}>
          <Field label="Form name">
            <input value={form.title || ''} onChange={(event) => setForm(formIndex, { title: event.target.value })} />
          </Field>
          {(form.questions || []).map((question, questionIndex) => (
            <div className="panel" key={question.id || questionIndex}>
              <Field label="Question">
                <input value={question.label || ''} onChange={(event) => setQuestion(formIndex, questionIndex, { label: event.target.value })} />
              </Field>
              <Field label="Type">
                <select
                  value={question.type || 'text'}
                  onChange={(event) => {
                    const type = event.target.value
                    setQuestion(formIndex, questionIndex, { type, critical: type === 'ynna' ? question.critical : false })
                  }}
                >
                  {QUESTION_TYPES.map((type) => <option key={type} value={type}>{type === 'ynna' ? 'Yes / No / N/A' : type}</option>)}
                </select>
              </Field>
              {question.type === 'dropdown' && (
                <Field label="Options" hint="Separate choices with commas.">
                  <input
                    value={Array.isArray(question.options) ? question.options.join(', ') : (question.options || '')}
                    onChange={(event) => setQuestion(formIndex, questionIndex, { options: event.target.value })}
                  />
                </Field>
              )}
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={Boolean(question.required)}
                  onChange={(event) => setQuestion(formIndex, questionIndex, { required: event.target.checked })}
                />
                Required
              </label>
              {question.type === 'ynna' && (
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={Boolean(question.critical)}
                    onChange={(event) => setQuestion(formIndex, questionIndex, { critical: event.target.checked })}
                  />
                  Critical — No stops the job
                </label>
              )}
              <div className="actions">
                <button type="button" className="text-btn" onClick={() => setForm(formIndex, { questions: move(form.questions, questionIndex, -1) })}>Up</button>
                <button type="button" className="text-btn" onClick={() => setForm(formIndex, { questions: move(form.questions, questionIndex, 1) })}>Down</button>
                {form.questions.length > 1 && (
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setForm(formIndex, { questions: form.questions.filter((_, index) => index !== questionIndex) })}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="actions">
            <Button
              type="button"
              kind="ghost"
              onClick={() => setForm(formIndex, {
                questions: [...form.questions, { id: '', type: 'ynna', label: '', required: true, critical: false, help: '', options: '' }],
              })}
            >
              Add question
            </Button>
            {forms.length > 1 && (
              <Button type="button" kind="ghost" onClick={() => setDraft(forms.filter((_, index) => index !== formIndex))}>
                Remove form
              </Button>
            )}
          </div>
        </div>
      ))}
      <Button
        type="button"
        kind="ghost"
        onClick={() => setDraft([...forms, {
          id: '',
          title: '',
          questions: [{ id: '', type: 'text', label: '', required: false, critical: false, help: '', options: '' }],
        }])}
      >
        Add form
      </Button>
    </div>
  )
}
