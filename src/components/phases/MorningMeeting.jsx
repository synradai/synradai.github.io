import { useState, useRef } from 'react'
import { generateId } from '../../utils/storage'
import { callAnthropicAPI, buildTalkingPointsPrompt } from '../../utils/api'
import SectionBlock from '../SectionBlock'
import SafetyTextarea from '../SafetyTextarea'
import { PhaseHeader, TEXTAREA, INPUT_FLEX, BTN_ADD, EMPTY_TEXT } from '../ui'

export default function MorningMeeting({ shift, updateShift, apiKey }) {
  const [newTopic, setNewTopic] = useState('')
  const [confirmed, setConfirmed] = useState([false, false, false])
  const [loadingTopics, setLoadingTopics] = useState({})
  const [topicErrors, setTopicErrors] = useState({})
  const [openPoints, setOpenPoints] = useState({})

  const mtg = shift.meeting || { topics: [], agendaNotes: '', attendees: '' }
  const update = (u) => updateShift({ meeting: { ...mtg, ...u } })
  const confirm = (i) => setConfirmed(prev => { const n = [...prev]; n[i] = !n[i]; return n })

  const topics = mtg.topics || []
  const coveredCount = topics.filter(t => t.covered).length

  const addTopic = () => {
    if (!newTopic.trim()) return
    update({ topics: [...topics, { id: generateId(), text: newTopic.trim(), talkingPoints: '', covered: false }] })
    setNewTopic('')
  }
  const removeTopic = (id) => update({ topics: topics.filter(t => t.id !== id) })
  const toggleCovered = (id) => update({ topics: topics.map(t => t.id === id ? { ...t, covered: !t.covered } : t) })
  const moveTopic = (id, dir) => {
    const list = [...topics]
    const idx = list.findIndex(t => t.id === id)
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    const [item] = list.splice(idx, 1)
    list.splice(target, 0, item)
    update({ topics: list })
  }

  const generateTalkingPoints = async (topic) => {
    setLoadingTopics(prev => ({ ...prev, [topic.id]: true }))
    setTopicErrors(prev => ({ ...prev, [topic.id]: '' }))
    try {
      const text = await callAnthropicAPI(apiKey, buildTalkingPointsPrompt(topic.text), 400)
      update({ topics: topics.map(t => t.id === topic.id ? { ...t, talkingPoints: text } : t) })
      setOpenPoints(prev => ({ ...prev, [topic.id]: true }))
    } catch (e) {
      setTopicErrors(prev => ({ ...prev, [topic.id]: e.message }))
    } finally {
      setLoadingTopics(prev => ({ ...prev, [topic.id]: false }))
    }
  }

  const ref1 = useRef()
  const ref2 = useRef()

  return (
    <div style={{ padding: '1.5rem 1rem' }}>
      <PhaseHeader
        phase={2}
        title="Morning Meeting"
        blurb="Run the toolbox talk straight from this screen — tick topics off as you cover them, then record notes and attendance."
        meta={topics.length > 0 ? `${coveredCount}/${topics.length} topics covered` : null}
      />

      <div style={{ marginBottom: '1.75rem' }}>
        <SectionBlock
          title="Safety Topics"
          hint={topics.length === 0 ? 'Add topics before the meeting' : coveredCount === topics.length ? `All ${topics.length} covered ✓` : `${coveredCount}/${topics.length} covered`}
          confirmed={confirmed[0]}
          onConfirm={() => confirm(0)}
          confirmLabel="topics"
          nextRef={ref1}
        >
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTopic()}
              placeholder="e.g. Working at heights — permit requirements and spotter placement"
              style={INPUT_FLEX}
            />
            <button onClick={addTopic} style={BTN_ADD}>Add</button>
          </div>

          {topics.length === 0 ? (
            <p style={EMPTY_TEXT}>No topics added yet.</p>
          ) : topics.map((topic, idx) => (
            <div key={topic.id} style={{ backgroundColor: 'var(--bg-input)', border: `1px solid ${topic.covered ? 'var(--success-border)' : 'var(--border)'}`, borderRadius: '0.5rem', marginBottom: '0.4rem', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.625rem 0.75rem' }}>
                {/* Covered tick — tap as you run the meeting */}
                <button
                  onClick={() => toggleCovered(topic.id)}
                  title={topic.covered ? 'Covered — tap to undo' : 'Tap when covered in the meeting'}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `1.5px solid ${topic.covered ? 'var(--success)' : 'var(--border-accent)'}`,
                    backgroundColor: topic.covered ? 'var(--success)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  {topic.covered && <span style={{ color: 'var(--on-accent)', fontSize: 11, fontWeight: 700 }}>✓</span>}
                </button>

                <span style={{ flex: 1, fontSize: '0.875rem', color: topic.covered ? 'var(--text-faint)' : 'var(--text-primary)', textDecoration: topic.covered ? 'line-through' : 'none' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '0.7rem', marginRight: '0.4rem' }}>{idx + 1}</span>
                  {topic.text}
                </span>

                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  <SmallBtn onClick={() => moveTopic(topic.id, -1)} disabled={idx === 0}>↑</SmallBtn>
                  <SmallBtn onClick={() => moveTopic(topic.id, 1)} disabled={idx === topics.length - 1}>↓</SmallBtn>
                  <SmallBtn onClick={() => removeTopic(topic.id)}>✕</SmallBtn>
                </div>
              </div>

              {/* Talking points — collapsible so the list stays compact */}
              <div style={{ padding: '0 0.75rem 0.6rem 2.35rem' }}>
                {topic.talkingPoints ? (
                  <>
                    <button
                      onClick={() => setOpenPoints(prev => ({ ...prev, [topic.id]: !prev[topic.id] }))}
                      style={LINK_BTN}
                    >
                      {openPoints[topic.id] ? '▾ Hide talking points' : '▸ Show talking points'}
                    </button>
                    {openPoints[topic.id] && (
                      <div style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-accent)', borderRadius: '0.375rem', padding: '0.5rem 0.625rem', marginTop: '0.3rem' }}>
                        <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: '0.78rem', color: 'var(--accent-soft)', lineHeight: 1.6 }}>{topic.talkingPoints}</pre>
                        <button
                          onClick={() => generateTalkingPoints(topic)}
                          disabled={loadingTopics[topic.id]}
                          style={{ ...LINK_BTN, marginTop: '0.4rem' }}
                        >
                          {loadingTopics[topic.id] ? 'Regenerating...' : 'Regenerate'}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => generateTalkingPoints(topic)}
                    disabled={loadingTopics[topic.id] || !apiKey}
                    style={{ ...LINK_BTN, opacity: !apiKey ? 0.4 : 1, cursor: !apiKey ? 'not-allowed' : 'pointer' }}
                  >
                    {loadingTopics[topic.id] ? 'Generating talking points...' : '✨ Talking points (AI)'}
                  </button>
                )}
                {topicErrors[topic.id] && <div style={{ fontSize: '0.7rem', color: 'var(--error-text)', marginTop: '0.25rem', fontWeight: 600 }}>{topicErrors[topic.id]}</div>}
              </div>
            </div>
          ))}
          {!apiKey && topics.length > 0 && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.4rem', fontWeight: 600 }}>No API key — go to Settings to enable AI talking points.</p>
          )}
        </SectionBlock>
      </div>

      <div ref={ref1} style={{ marginBottom: '1.75rem', scrollMarginTop: '4rem' }}>
        <SectionBlock
          title="Meeting Notes"
          hint="What was raised, agreed, or escalated"
          confirmed={confirmed[1]}
          onConfirm={() => confirm(1)}
          confirmLabel="notes"
          nextRef={ref2}
        >
          <SafetyTextarea
            value={mtg.agendaNotes}
            onChange={e => update({ agendaNotes: e.target.value })}
            placeholder={`Record what happened in the meeting.\n\nE.g. Crew raised concerns about dust suppression near the ROM pad — agreed to escalate to site manager. Hot work procedure reviewed.`}
            rows={5}
            style={TEXTAREA}
            apiKey={apiKey}
          />
        </SectionBlock>
      </div>

      <div ref={ref2} style={{ marginBottom: '1.75rem', scrollMarginTop: '4rem' }}>
        <SectionBlock
          title="Who Attended"
          hint="Names, roles, or crew numbers"
          confirmed={confirmed[2]}
          onConfirm={() => confirm(2)}
          confirmLabel="attendees"
        >
          <SafetyTextarea
            value={mtg.attendees}
            onChange={e => update({ attendees: e.target.value })}
            placeholder="e.g. T. Morrison (SA), Crew 4B (8 pax), L. Nguyen (Maintenance lead)"
            rows={2}
            style={TEXTAREA}
            apiKey={apiKey}
          />
        </SectionBlock>
      </div>
    </div>
  )
}

function SmallBtn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: 26, height: 26, border: 'none', borderRadius: 4, backgroundColor: 'var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.25 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  )
}

const LINK_BTN = { padding: '0.2rem 0', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }
