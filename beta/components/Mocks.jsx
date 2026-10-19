import { useState } from 'react'
import { KPIS, PRESTART, SCAFFOLD, SCAFFOLD_RATE, STORES, TICKETS, VEHICLES } from '../mocks/data.js'
import { PreviewBanner, Button } from './ui.jsx'

export function TrainingPreview() {
  const [fileName, setFileName] = useState('')
  return (
    <>
      <PreviewBanner />
      <p className="eyebrow">Training</p>
      <h1>Tickets</h1>
      <p className="lede">QR upload of a ticket is a preview. The file stays on this device and is not read.</p>
      <label className="btn ghost">Upload ticket photo
        <input hidden type="file" accept="image/*" capture="environment" onChange={(event) => setFileName(event.target.files?.[0]?.name || '')} />
      </label>
      {fileName && <p className="offline-banner">Preview received “{fileName}”. No QR was decoded.</p>}
      <div className="grid" style={{ marginTop: 12 }}>
        {TICKETS.map((ticket) => (
          <article className="card" key={ticket.ticket + ticket.role}>
            <span className="tag preview">{ticket.state}</span>
            <strong>{ticket.ticket}</strong>
            <span>{ticket.role} · expires {ticket.expires}</span>
          </article>
        ))}
      </div>
    </>
  )
}

export function MaintenancePreview() {
  const [vehicle, setVehicle] = useState(VEHICLES[0].id)
  const [checks, setChecks] = useState({})
  const current = VEHICLES.find((item) => item.id === vehicle)
  return (
    <>
      <PreviewBanner />
      <p className="eyebrow">Maintenance</p>
      <h1>Vehicles and pre-starts</h1>
      <p className="lede">Schedules are sample data. Ticks stay in this preview only.</p>
      <div className="grid">
        {VEHICLES.map((item) => (
          <button className="card" key={item.id} onClick={() => setVehicle(item.id)} style={{ textAlign: 'left' }}>
            <span className="tag preview">{item.prestart}</span>
            <strong>{item.id} · {item.type}</strong>
            <span>Service {item.due} · {item.km}</span>
          </button>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <h2>Supervisor pre-start · {current.id}</h2>
        {PRESTART.map((item) => (
          <label className="check" key={item}>
            <input type="checkbox" checked={Boolean(checks[item])} onChange={() => setChecks((prev) => ({ ...prev, [item]: !prev[item] }))} />
            <span>{item}</span>
          </label>
        ))}
      </div>
    </>
  )
}

export function KpiPreview() {
  return (
    <>
      <PreviewBanner />
      <p className="eyebrow">KPIs & forms</p>
      <h1>This week at Red Range</h1>
      <p className="lede">Sample figures for a dashboard. They are not calculated from the HSE register.</p>
      <div className="grid">
        {KPIS.map((item) => (
          <article className="panel" key={item.label}>
            <div className="kpi"><strong>{item.label}</strong><span>{item.value}</span></div>
            <div className="bar" style={{ marginTop: 8 }}><span style={{ width: item.width }} /></div>
          </article>
        ))}
      </div>
    </>
  )
}

export function StoresPreview() {
  const [items, setItems] = useState(STORES)
  const [picked, setPicked] = useState(STORES[0].id)
  const [seen, setSeen] = useState('')
  const item = items.find((row) => row.id === picked)
  const sign = (status) => {
    const holder = status === 'Out' ? 'Day-shift fitter' : '—'
    setItems((prev) => prev.map((row) => row.id === picked ? { ...row, status, holder, due: status === 'Out' ? 'End of shift' : '—' } : row))
  }
  return (
    <>
      <PreviewBanner />
      <p className="eyebrow">Stores</p>
      <h1>Issue and return</h1>
      <p className="lede">Item recognition and QR sign-out are a preview. The pattern below is not a scannable code.</p>
      <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="qr" aria-hidden="true" />
        <div>
          <strong>{item.name}</strong>
          <div className="muted">{item.id} · bin {item.bin}</div>
          <div className="actions" style={{ marginTop: 8 }}>
            <Button type="button" onClick={() => setSeen(`${item.name} recognised from the sample photo. Bin ${item.bin}.`)}>Recognise item</Button>
            <Button type="button" kind="ghost" onClick={() => sign('Out')}>QR sign out</Button>
            <Button type="button" kind="ghost" onClick={() => sign('In stores')}>QR sign in</Button>
          </div>
        </div>
      </div>
      {seen && <p className="offline-banner">{seen}</p>}
      <div className="grid" style={{ marginTop: 12 }}>
        {items.map((row) => (
          <button className="card" key={row.id} onClick={() => setPicked(row.id)} style={{ textAlign: 'left' }}>
            <span className="tag preview">{row.status}</span>
            <strong>{row.name}</strong>
            <span>{row.id} · {row.holder} · {row.due}</span>
          </button>
        ))}
      </div>
    </>
  )
}

export function ScaffoldPreview() {
  const tonnes = SCAFFOLD.reduce((sum, row) => sum + row.tonnes, 0)
  return (
    <>
      <PreviewBanner />
      <p className="eyebrow">Scaffold register</p>
      <h1>Gear on hire</h1>
      <p className="lede">Photos, location, tag schedule, and gear weight for a per-tonne bill. Rate is a sample: ${SCAFFOLD_RATE.toFixed(2)} per tonne per week.</p>
      <div className="panel">
        <strong>{tonnes.toFixed(2)} t on the register</strong>
        <div className="muted">Sample week: ${(tonnes * SCAFFOLD_RATE).toFixed(2)} before stand-down credits.</div>
      </div>
      <div className="grid" style={{ marginTop: 12 }}>
        {SCAFFOLD.map((row) => (
          <article className="card" key={row.id}>
            <span className="tag preview">{row.tag}</span>
            <strong>{row.place}</strong>
            <span>{row.id} · {row.height} · {row.tonnes.toFixed(2)} t · ${(row.tonnes * SCAFFOLD_RATE).toFixed(2)} / week</span>
            <span>Inspected {row.inspected} · next {row.next}</span>
          </article>
        ))}
      </div>
    </>
  )
}
