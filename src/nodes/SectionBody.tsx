import { useEffect, useRef, useState } from 'react'

// Figma-style section. The frame itself is a thin-bordered rectangle with a
// very subtle fill; the title floats as a small label OUTSIDE the frame's
// top-left so it doesn't compete with wrapped content.

const LABEL_HEIGHT = 22
const LABEL_OFFSET = 6 // gap between label and frame top edge
const FRAME_BG = 'rgba(0,0,0,0.02)'
const FRAME_BORDER = '#d4d4d4'
const TITLE_INK = '#525252'

export default function SectionBody({
  title,
  width,
  height,
  onTitleChange,
}: {
  title: string
  width: number
  height: number
  onTitleChange: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(title)
  }, [title, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft !== title) onTitleChange(draft.trim())
  }

  const frameTop = LABEL_HEIGHT + LABEL_OFFSET
  const frameH = Math.max(0, height - frameTop)

  return (
    <div style={{ position: 'relative', width, height, pointerEvents: 'none' }}>
      {/* Floating title label — small, top-left, OUTSIDE the frame */}
      <div
        onDoubleClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: LABEL_HEIGHT,
          display: 'inline-flex',
          alignItems: 'center',
          color: TITLE_INK,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: 0.1,
          padding: '0 4px',
          pointerEvents: 'auto',
          cursor: editing ? 'text' : 'grab',
          userSelect: 'none',
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDraft(title)
                setEditing(false)
              }
              if (e.key === 'Enter') commit()
            }}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: TITLE_INK,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              padding: 0,
              minWidth: 80,
            }}
          />
        ) : (
          <span>{title || 'Section'}</span>
        )}
      </div>

      {/* The frame */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: frameTop,
          width,
          height: frameH,
          background: FRAME_BG,
          border: `1px solid ${FRAME_BORDER}`,
          borderRadius: 8,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
