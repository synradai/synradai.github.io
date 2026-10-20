import { useState } from 'react'
import { LEAD_TARGETS, leadCounts, weekStarting } from '../lib/leads.js'
import { perthDate, shiftDate } from '../lib/time.js'
import { Button } from './ui.jsx'

export default function Leads({ app }) {
  const [start, setStart] = useState(() => weekStarting(perthDate()))
  const counts = leadCounts(app.rows, start)
  const thisWeek = weekStarting(perthDate())

  return (
    <>
      <p className="eyebrow">Lead indicators</p>
      <h1>This week’s counts</h1>
      <p className="lede">Monday to Sunday, Perth time. Observations are hazard reports. An action counts as on time when it is marked done on or before the due date. Targets are starter numbers.</p>
      <div className="admin-inline">
        <button type="button" className="icon-btn" aria-label="Previous week" onClick={() => setStart(shiftDate(start, -7))}>‹</button>
        <strong>{counts.start.split('-').reverse().join('/')} – {counts.end.split('-').reverse().join('/')}</strong>
        <button type="button" className="icon-btn" aria-label="Next week" onClick={() => setStart(shiftDate(start, 7))}>›</button>
      </div>
      {start !== thisWeek && <Button type="button" kind="ghost" onClick={() => setStart(thisWeek)}>This week</Button>}
      <div className="grid" style={{ marginTop: '0.8rem' }}>
        {LEAD_TARGETS.map((item) => {
          const count = counts[item.id] || 0
          const met = count >= item.target
          return (
            <article className="card" key={item.id}>
              <span className={`tag ${met ? 'live' : 'preview'}`}>{met ? 'Met' : 'Short'}</span>
              <strong>{item.label}</strong>
              <span>{count} of {item.target}</span>
            </article>
          )
        })}
      </div>
    </>
  )
}
