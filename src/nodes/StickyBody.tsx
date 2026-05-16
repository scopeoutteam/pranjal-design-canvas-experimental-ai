import { useEffect, useRef, useState } from 'react'
import { STICKY_PALETTE, type StickyColor } from '../types'

export default function StickyBody({
  color,
  text,
  width,
  height,
  onTextChange,
}: {
  color: StickyColor
  text: string
  width: number
  height: number
  onTextChange: (next: string) => void
}) {
  const palette = STICKY_PALETTE[color]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Keep draft in sync if external text changes (e.g. undo, remote update).
  useEffect(() => {
    if (!editing) setDraft(text)
  }, [text, editing])

  // Focus + select-all when entering edit mode.
  useEffect(() => {
    if (editing) {
      taRef.current?.focus()
      taRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== text) onTextChange(draft)
  }

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      style={{
        width,
        height,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 4,
        boxShadow: '0 6px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        padding: 14,
        boxSizing: 'border-box',
        color: palette.ink,
        fontSize: 16,
        lineHeight: 1.35,
        fontWeight: 500,
        fontFamily: 'inherit',
        overflow: 'hidden',
        cursor: editing ? 'text' : 'default',
        position: 'relative',
      }}
    >
      {editing ? (
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(text)
              setEditing(false)
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              commit()
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: palette.ink,
            fontSize: 16,
            lineHeight: 1.35,
            fontWeight: 500,
            fontFamily: 'inherit',
            padding: 0,
            margin: 0,
          }}
        />
      ) : text ? (
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
      ) : (
        <div style={{ opacity: 0.5, fontStyle: 'italic' }}>Double-click to edit</div>
      )}
    </div>
  )
}
