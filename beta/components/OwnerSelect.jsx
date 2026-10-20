import { ownerChoices } from '../lib/actions.js'

export default function OwnerSelect({ members, user, value, onChange }) {
  const choices = ownerChoices(members, user)
  if (!choices.length) return <p className="muted">Nobody in this organisation yet.</p>
  const current = choices.some((person) => person.id === value) ? value : choices[0].id
  return (
    <select value={current} onChange={(event) => onChange(event.target.value)}>
      {choices.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
    </select>
  )
}
