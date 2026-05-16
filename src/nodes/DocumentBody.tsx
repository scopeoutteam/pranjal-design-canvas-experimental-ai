import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DocBlock, DocBlockType } from '../types'

// Miro-style block-based document. Each block (heading/paragraph/list-item/quote/
// divider) is its own row with:
//   - left-side hover controls: [+] insert below + [⋮⋮] drag handle
//   - inline contentEditable area
// Selecting text inside a block surfaces a floating format toolbar with
// block-type dropdown + bold / italic / strike.

const PILL_BG = '#ffffff'
const PILL_BORDER = '#e5e5e5'
const PILL_INK = '#525252'
const PAGE_BG = '#ffffff'
const PAGE_BORDER = '#e5e5e5'
const INK = '#171717'
const SUBTLE = '#737373'

interface DocumentBodyProps {
  blocks: DocBlock[]
  width: number
  height: number
  onChange: (blocks: DocBlock[]) => void
}

const DEFAULT_BLOCKS: DocBlock[] = [
  { id: 'b-default-1', type: 'h1', text: '' },
  { id: 'b-default-2', type: 'p', text: '' },
]

const BLOCK_LABEL: Record<DocBlockType, string> = {
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  p: 'Paragraph',
  bullet: 'Bullet list',
  numbered: 'Ordered list',
  checklist: 'Checklist',
  quote: 'Quote',
  callout: 'Callout',
  divider: 'Divider',
}

// Grouped menu structure for the floating selection bar's "type" dropdown.
// Mirrors the screenshot the user provided.
const TYPE_GROUPS: { label: string; items: { type: DocBlockType; label: string; glyph: string }[] }[] = [
  {
    label: 'Text',
    items: [
      { type: 'p', label: 'Paragraph', glyph: 'Aa' },
      { type: 'h1', label: 'Heading 1', glyph: 'H1' },
      { type: 'h2', label: 'Heading 2', glyph: 'H2' },
      { type: 'h3', label: 'Heading 3', glyph: 'H3' },
    ],
  },
  {
    label: 'List',
    items: [
      { type: 'bullet', label: 'Bullet list', glyph: '☰' },
      { type: 'numbered', label: 'Ordered list', glyph: '1.' },
      { type: 'checklist', label: 'Checklist', glyph: '✓' },
    ],
  },
  {
    label: 'Highlight',
    items: [
      { type: 'quote', label: 'Quote', glyph: '99' },
      { type: 'callout', label: 'Callout', glyph: '▤' },
    ],
  },
]

export default function DocumentBody({ blocks, width, height, onChange }: DocumentBodyProps) {
  const list = blocks && blocks.length > 0 ? blocks : DEFAULT_BLOCKS

  const [hoverId, setHoverId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [menuForId, setMenuForId] = useState<string | null>(null)
  const [selectionBar, setSelectionBar] = useState<{ x: number; y: number; blockId: string } | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  const newId = () => 'b-' + Math.random().toString(36).slice(2, 10)

  const update = useCallback(
    (next: DocBlock[]) => {
      onChange(next)
    },
    [onChange],
  )

  const setBlockText = (id: string, text: string) => {
    update(list.map((b) => (b.id === id ? { ...b, text } : b)))
  }
  const setBlockType = (id: string, type: DocBlockType) => {
    update(list.map((b) => (b.id === id ? { ...b, type } : b)))
  }
  const insertAfter = (id: string) => {
    const idx = list.findIndex((b) => b.id === id)
    if (idx < 0) return
    const next = [...list]
    next.splice(idx + 1, 0, { id: newId(), type: 'p', text: '' })
    update(next)
  }
  const duplicateBlock = (id: string) => {
    const idx = list.findIndex((b) => b.id === id)
    if (idx < 0) return
    const next = [...list]
    next.splice(idx + 1, 0, { ...list[idx], id: newId() })
    update(next)
  }
  const deleteBlock = (id: string) => {
    if (list.length === 1) {
      update([{ id: newId(), type: 'p', text: '' }])
      return
    }
    update(list.filter((b) => b.id !== id))
  }
  const moveBlock = (fromId: string, toId: string) => {
    if (fromId === toId) return
    const fromIdx = list.findIndex((b) => b.id === fromId)
    const toIdx = list.findIndex((b) => b.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...list]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    update(next)
  }

  // Track text selection inside the document, position the floating format bar.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelectionBar(null)
        return
      }
      const range = sel.getRangeAt(0)
      const node = range.startContainer.parentElement
      const blockEl = node?.closest('[data-block-id]') as HTMLElement | null
      if (!blockEl || !pageRef.current?.contains(blockEl)) {
        setSelectionBar(null)
        return
      }
      const rect = range.getBoundingClientRect()
      setSelectionBar({
        x: rect.left + rect.width / 2,
        y: rect.top,
        blockId: blockEl.dataset.blockId!,
      })
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const exec = (cmd: 'bold' | 'italic' | 'strikeThrough') => {
    document.execCommand(cmd, false)
  }

  // Close per-block menu on outside click / Esc.
  useEffect(() => {
    if (!menuForId) return
    const close = () => setMenuForId(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuForId])

  return (
    <div style={{ position: 'relative', width, height, pointerEvents: 'none' }}>
      {/* Header pill */}
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: -32,
          height: 26,
          background: PILL_BG,
          border: `1px solid ${PILL_BORDER}`,
          borderRadius: 8,
          padding: '0 10px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: PILL_INK,
          fontSize: 12,
          fontWeight: 500,
          pointerEvents: 'auto',
          cursor: 'grab',
          userSelect: 'none',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <DocIcon />
        <span>Document</span>
      </div>

      {/* Page */}
      <div
        ref={pageRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: PAGE_BG,
          border: `1px solid ${PAGE_BORDER}`,
          borderRadius: 4,
          boxShadow: '0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
          padding: '36px 56px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          pointerEvents: 'auto',
          overflow: 'auto',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {list.map((block) => (
          <BlockRow
            key={block.id}
            block={block}
            isHover={hoverId === block.id}
            isDragOver={dragOverId === block.id}
            menuOpen={menuForId === block.id}
            onHover={(v) => setHoverId(v ? block.id : null)}
            onTextChange={(t) => setBlockText(block.id, t)}
            onInsertAfter={() => insertAfter(block.id)}
            onOpenMenu={() => setMenuForId(menuForId === block.id ? null : block.id)}
            onTurnInto={(type) => {
              setBlockType(block.id, type)
              setMenuForId(null)
            }}
            onDuplicate={() => {
              duplicateBlock(block.id)
              setMenuForId(null)
            }}
            onDelete={() => {
              deleteBlock(block.id)
              setMenuForId(null)
            }}
            onDragStart={() => {}}
            onDragOver={() => setDragOverId(block.id)}
            onDrop={(fromId) => {
              moveBlock(fromId, block.id)
              setDragOverId(null)
            }}
          />
        ))}
      </div>

      {/* Floating selection format bar */}
      {selectionBar ? (
        <SelectionBar
          x={selectionBar.x}
          y={selectionBar.y}
          currentType={list.find((b) => b.id === selectionBar.blockId)?.type ?? 'p'}
          onTurnInto={(type) => {
            setBlockType(selectionBar.blockId, type)
          }}
          onBold={() => exec('bold')}
          onItalic={() => exec('italic')}
          onStrike={() => exec('strikeThrough')}
        />
      ) : null}
    </div>
  )
}

function BlockRow({
  block,
  isHover,
  isDragOver,
  menuOpen,
  onHover,
  onTextChange,
  onInsertAfter,
  onOpenMenu,
  onTurnInto,
  onDuplicate,
  onDelete,
  onDragOver,
  onDrop,
}: {
  block: DocBlock
  isHover: boolean
  isDragOver: boolean
  menuOpen: boolean
  onHover: (v: boolean) => void
  onTextChange: (t: string) => void
  onInsertAfter: () => void
  onOpenMenu: () => void
  onTurnInto: (type: DocBlockType) => void
  onDuplicate: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: (fromId: string) => void
}) {
  const editRef = useRef<HTMLDivElement>(null)
  // Sync external text changes into contentEditable.
  useEffect(() => {
    if (editRef.current && editRef.current.innerText !== block.text) {
      editRef.current.innerText = block.text
    }
  }, [block.text])

  const isDivider = block.type === 'divider'
  const isList =
    block.type === 'bullet' || block.type === 'numbered' || block.type === 'checklist'
  const isCallout = block.type === 'callout'

  return (
    <div
      data-block-id={block.id}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-doc-block')) {
          e.preventDefault()
          onDragOver()
        }
      }}
      onDrop={(e) => {
        const fromId = e.dataTransfer.getData('application/x-doc-block')
        if (fromId) {
          e.preventDefault()
          onDrop(fromId)
        }
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        padding: '2px 0',
        borderTop: isDragOver ? '2px solid #0f6cbd' : '2px solid transparent',
        minHeight: 28,
      }}
    >
      {/* Left-side controls */}
      <div
        style={{
          position: 'absolute',
          left: -44,
          top: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          opacity: isHover ? 1 : 0,
          transition: 'opacity 120ms ease',
          paddingTop: block.type === 'h1' ? 8 : 4,
        }}
      >
        <IconButton title="Add block" onClick={onInsertAfter} icon={<PlusIcon />} />
        <DragHandle
          title="Drag to reorder · Click for options"
          onClickMenu={onOpenMenu}
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-doc-block', block.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
        />
      </div>

      {/* Block content */}
      <BlockContent block={block} editRef={editRef} onTextChange={onTextChange} isDivider={isDivider} isList={isList} isCallout={isCallout} />

      {menuOpen ? (
        <BlockMenu
          onTurnInto={onTurnInto}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  )
}

function BlockContent({
  block,
  editRef,
  onTextChange,
  isDivider,
  isList,
  isCallout,
}: {
  block: DocBlock
  editRef: React.RefObject<HTMLDivElement | null>
  onTextChange: (t: string) => void
  isDivider: boolean
  isList: boolean
  isCallout: boolean
}) {
  if (isDivider) {
    return (
      <div
        style={{
          flex: 1,
          height: 1,
          background: '#e5e5e5',
          margin: '18px 0',
        }}
      />
    )
  }

  const placeholderFor = (t: DocBlockType) =>
    t === 'h1'
      ? 'Heading 1'
      : t === 'h2'
      ? 'Heading 2'
      : t === 'h3'
      ? 'Heading 3'
      : t === 'quote'
      ? 'Quote'
      : t === 'callout'
      ? 'Callout'
      : t === 'bullet' || t === 'numbered' || t === 'checklist'
      ? 'List item'
      : 'Type here…'

  const isEmpty = !block.text
  const styleFor = (t: DocBlockType): React.CSSProperties => {
    switch (t) {
      case 'h1':
        return { fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: INK }
      case 'h2':
        return { fontSize: 22, fontWeight: 700, lineHeight: 1.25, color: INK }
      case 'h3':
        return { fontSize: 18, fontWeight: 600, lineHeight: 1.3, color: INK }
      case 'quote':
        return {
          fontSize: 15,
          lineHeight: 1.55,
          color: SUBTLE,
          fontStyle: 'italic',
          borderLeft: '3px solid #d4d4d4',
          paddingLeft: 12,
        }
      default:
        return { fontSize: 15, lineHeight: 1.55, color: INK }
    }
  }

  const listMarker =
    block.type === 'bullet'
      ? '•'
      : block.type === 'numbered'
      ? '1.'
      : block.type === 'checklist'
      ? '☐'
      : ''

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        minWidth: 0,
        ...(isCallout
          ? {
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: 8,
              padding: '10px 12px',
            }
          : {}),
      }}
    >
      {isCallout ? (
        <div
          style={{
            width: 20,
            color: '#92400e',
            fontSize: 15,
            lineHeight: 1.55,
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          ▸
        </div>
      ) : null}
      {isList ? (
        <div
          style={{
            width: 18,
            textAlign: 'right',
            color: SUBTLE,
            fontSize: 15,
            lineHeight: 1.55,
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          {listMarker}
        </div>
      ) : null}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        {isEmpty ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              pointerEvents: 'none',
              color: '#a3a3a3',
              ...styleFor(block.type),
            }}
          >
            {placeholderFor(block.type)}
          </div>
        ) : null}
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onTextChange((e.currentTarget as HTMLDivElement).innerText)}
          spellCheck={false}
          style={{
            outline: 'none',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            ...styleFor(block.type),
          }}
        />
      </div>
    </div>
  )
}

function BlockMenu({
  onTurnInto,
  onDuplicate,
  onDelete,
}: {
  onTurnInto: (type: DocBlockType) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <div
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: -8,
        top: 28,
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 10,
        padding: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        minWidth: 170,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <MenuLabel>Turn into</MenuLabel>
      {(['h1', 'h2', 'h3', 'p', 'bullet', 'numbered', 'checklist', 'quote', 'callout', 'divider'] as DocBlockType[]).map((t) => (
        <MenuItem key={t} onClick={() => onTurnInto(t)} label={BLOCK_LABEL[t]} />
      ))}
      <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
      <MenuItem onClick={onDuplicate} label="Duplicate" />
      <MenuItem onClick={onDelete} label="Delete" danger />
    </div>
  )
}

function SelectionBar({
  x,
  y,
  currentType,
  onTurnInto,
  onBold,
  onItalic,
  onStrike,
}: {
  x: number
  y: number
  currentType: DocBlockType
  onTurnInto: (type: DocBlockType) => void
  onBold: () => void
  onItalic: () => void
  onStrike: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: x,
        top: y - 44,
        transform: 'translateX(-50%)',
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 10,
        padding: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        zIndex: 60,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={pillBtn}
        title="Block type"
      >
        <span style={{ fontWeight: 600, marginRight: 6 }}>Aa</span>
        {BLOCK_LABEL[currentType]}
        <span style={{ marginLeft: 6, color: '#a3a3a3' }}>▾</span>
      </button>
      {open ? (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 4,
            marginTop: 6,
            background: '#ffffff',
            border: '1px solid #e5e5e5',
            borderRadius: 12,
            padding: 6,
            boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            minWidth: 240,
            zIndex: 70,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {TYPE_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 ? <div style={{ height: 1, background: '#f0f0f0', margin: '6px 4px' }} /> : null}
              <div
                style={{
                  fontSize: 11,
                  color: '#a3a3a3',
                  textTransform: 'none',
                  padding: '6px 12px 4px',
                }}
              >
                {group.label}
              </div>
              {group.items.map((it) => (
                <TypeMenuRow
                  key={it.type}
                  glyph={it.glyph}
                  label={it.label}
                  active={currentType === it.type}
                  onClick={() => {
                    onTurnInto(it.type)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ width: 1, height: 18, background: '#e5e5e5', margin: '0 4px' }} />
      <IconTextBtn onClick={onBold} title="Bold"><span style={{ fontWeight: 700 }}>B</span></IconTextBtn>
      <IconTextBtn onClick={onItalic} title="Italic"><span style={{ fontStyle: 'italic' }}>I</span></IconTextBtn>
      <IconTextBtn onClick={onStrike} title="Strikethrough"><span style={{ textDecoration: 'line-through' }}>S</span></IconTextBtn>
    </div>
  )
}

const pillBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#171717',
  cursor: 'pointer',
}

function IconTextBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 30,
        height: 30,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 14,
        color: '#171717',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

function IconButton({
  onClick,
  title,
  icon,
}: {
  onClick: () => void
  title: string
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        border: 'none',
        background: 'transparent',
        color: SUBTLE,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  )
}

function DragHandle({
  onClickMenu,
  onDragStart,
  title,
}: {
  onClickMenu: () => void
  onDragStart: (e: React.DragEvent) => void
  title: string
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={(e) => {
        e.stopPropagation()
        onClickMenu()
      }}
      title={title}
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        cursor: 'grab',
        color: SUBTLE,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="2.5" cy="3" r="1.3" />
        <circle cx="2.5" cy="7" r="1.3" />
        <circle cx="2.5" cy="11" r="1.3" />
        <circle cx="7.5" cy="3" r="1.3" />
        <circle cx="7.5" cy="7" r="1.3" />
        <circle cx="7.5" cy="11" r="1.3" />
      </svg>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: '#a3a3a3',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        padding: '4px 10px',
      }}
    >
      {children}
    </div>
  )
}

function MenuItem({
  onClick,
  label,
  danger,
}: {
  onClick: () => void
  label: string
  danger?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? '#f5f5f5' : 'transparent',
        border: 'none',
        textAlign: 'left',
        padding: '6px 10px',
        borderRadius: 6,
        fontSize: 13,
        fontFamily: 'inherit',
        color: danger ? '#b91c1c' : '#171717',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function TypeMenuRow({
  glyph,
  label,
  active,
  onClick,
}: {
  glyph: string
  label: string
  active: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderRadius: 6,
        border: 'none',
        background: hover ? '#f5f5f5' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        width: '100%',
      }}
    >
      <span
        style={{
          width: 22,
          textAlign: 'center',
          color: '#171717',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        {glyph}
      </span>
      <span style={{ flex: 1, fontSize: 14, color: '#171717' }}>{label}</span>
      {active ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#2563eb', flexShrink: 0 }}>
          <polyline points="2.5,7.5 5.5,10.5 11.5,4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      ) : null}
    </button>
  )
}

function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M3 1.5 H8 L10.5 4 V11.5 H3 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M8 1.5 V4 H10.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
