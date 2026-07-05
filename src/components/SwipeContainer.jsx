import { useRef, useState } from 'react'

// Native-app swipe navigation between panels (shift phases). The content
// follows the finger while dragging, springs back on a short swipe, and
// commits to the next/previous panel past the threshold. Vertical scrolling
// is untouched: a drag only becomes a swipe once it's clearly horizontal.
// Swipes starting on inputs/textareas are ignored (text editing wins).
export default function SwipeContainer({ onPrev, onNext, canPrev, canNext, slideDir, panelKey, children }) {
  const [dx, setDx] = useState(0)
  const start = useRef(null)
  const dragging = useRef(false)

  const onTouchStart = (e) => {
    if (e.target.closest('textarea, input, select')) { start.current = null; return }
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    dragging.current = false
  }

  const onTouchMove = (e) => {
    if (!start.current) return
    const mx = e.touches[0].clientX - start.current.x
    const my = e.touches[0].clientY - start.current.y
    if (!dragging.current) {
      if (Math.abs(mx) > 24 && Math.abs(mx) > Math.abs(my) * 1.5) dragging.current = true
      else if (Math.abs(my) > 14) { start.current = null; return } // vertical scroll wins
      else return
    }
    // Resistance when there's no panel in that direction.
    const blocked = (mx < 0 && !canNext) || (mx > 0 && !canPrev)
    setDx(blocked ? mx * 0.2 : mx)
  }

  const onTouchEnd = () => {
    const wasDragging = dragging.current
    const finalDx = dx
    start.current = null
    dragging.current = false
    setDx(0)
    if (!wasDragging || Math.abs(finalDx) < 70) return
    if (finalDx < 0 && canNext) onNext()
    else if (finalDx > 0 && canPrev) onPrev()
  }

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        key={panelKey}
        className={slideDir ? `swipe-${slideDir}` : ''}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: dx ? 'none' : 'transform 0.2s ease',
          opacity: dx ? Math.max(0.55, 1 - Math.abs(dx) / 500) : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
