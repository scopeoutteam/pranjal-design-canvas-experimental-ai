import { useEffect, useRef, useState } from 'react'
import { NODE_DEFAULTS, type CanvasNodeData, type NodeKind } from '../types'
import ChatBody from './ChatBody'
import MobileBody from './MobileBody'
import WebBody from './WebBody'
import ComponentBody from './ComponentBody'
import type { Conversation, SelectionMode } from '../App'
import type { A2uiMessage } from '../a2ui/types'

const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, a, [role="button"], [role="radio"], [role="checkbox"], [role="switch"], [role="option"], [role="combobox"], [role="link"], [role="menuitem"], [role="tab"], [contenteditable="true"]'

interface DragStart {
  mx: number
  my: number
  nodeStartX: number
  nodeStartY: number
  nodeW: number
  nodeH: number
  lastWorldX: number
  lastWorldY: number
}

export default function CanvasNode({
  node,
  scale,
  selected,
  isActive,
  conversation,
  onSelect,
  onMoveSelection,
  onAction,
  onSendMessage,
  onDelete,
  onDuplicate,
  onCopy,
  onCut,
  onRename,
  onArrange,
  selectedComponentId,
  onSelectComponent,
  onEditText,
  getSnap,
  onSetGuides,
  selectedIds,
}: {
  node: CanvasNodeData
  scale: number
  selected: boolean
  isActive?: boolean
  conversation?: Conversation
  onSelect: (mode: SelectionMode) => void
  onMoveSelection: (dx: number, dy: number) => void
  onAction?: (name: string, context: Record<string, unknown> | undefined) => void
  onSendMessage?: (text: string) => void
  onDelete?: () => void
  onDuplicate?: () => void
  onCopy?: () => void
  onCut?: () => void
  onRename?: (title: string) => void
  onArrange?: (axis: 'horizontal' | 'vertical') => void
  selectedComponentId?: string | null
  onSelectComponent?: (id: string | null) => void
  onEditText?: (componentId: string, newText: string) => void
  getSnap?: (
    bounds: { x: number; y: number; w: number; h: number },
    excludeIds: Set<string>,
  ) => { dx: number; dy: number; guideX: number | null; guideY: number | null }
  onSetGuides?: (g: { x: number | null; y: number | null }) => void
  selectedIds?: Set<string>
}) {
  const { width, title: defaultTitle } = NODE_DEFAULTS[node.kind]
  const title = node.title ?? defaultTitle
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const dragStart = useRef<DragStart | null>(null)

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [contextMenu])

  const onContextMenuOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selected) onSelect('replace')
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const runMenuItem = (fn?: () => void) => () => {
    setContextMenu(null)
    fn?.()
  }

  const onWrapperMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest(INTERACTIVE_SELECTOR)) return
    e.stopPropagation()

    // Alt-drag: duplicate the node (and selection) and drag the copies
    if (e.altKey && onDuplicate) {
      onDuplicate()
    } else if (e.shiftKey) {
      onSelect('toggle')
    } else if (!selected) {
      onSelect('replace')
    }

    setDragging(true)
    const nodeW = NODE_DEFAULTS[node.kind].width
    // Approximate height; component sizes to content (use 280 as floor)
    const nodeH = node.kind === 'component' ? 280 : NODE_DEFAULTS[node.kind].height
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      nodeStartX: node.x,
      nodeStartY: node.y,
      nodeW,
      nodeH,
      lastWorldX: 0,
      lastWorldY: 0,
    } as DragStart
  }

  useEffect(() => {
    if (!dragging) return
    const onMouseMove = (e: MouseEvent) => {
      const s = dragStart.current as DragStart | null
      if (!s) return
      let totalDxWorld = (e.clientX - s.mx) / scale
      let totalDyWorld = (e.clientY - s.my) / scale

      // Apply snap-to-align against other nodes
      if (getSnap) {
        const targetX = s.nodeStartX + totalDxWorld
        const targetY = s.nodeStartY + totalDyWorld
        const excludeIds = new Set<string>([node.id, ...(selectedIds ?? [])])
        const snap = getSnap({ x: targetX, y: targetY, w: s.nodeW, h: s.nodeH }, excludeIds)
        totalDxWorld += snap.dx
        totalDyWorld += snap.dy
        onSetGuides?.({ x: snap.guideX, y: snap.guideY })
      }

      const stepDx = totalDxWorld - s.lastWorldX
      const stepDy = totalDyWorld - s.lastWorldY
      if (stepDx !== 0 || stepDy !== 0) {
        onMoveSelection(stepDx, stepDy)
        s.lastWorldX = totalDxWorld
        s.lastWorldY = totalDyWorld
      }
    }
    const onMouseUp = () => {
      setDragging(false)
      onSetGuides?.({ x: null, y: null })
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, scale, onMoveSelection, getSnap, onSetGuides, node.id, selectedIds])

  const showRing = selected || dragging || hovered
  const ringColor = selected || dragging ? '#0f6cbd' : 'rgba(15,108,189,0.45)'
  const ringWidth = selected ? 2 : dragging ? 2 : 1.5

  return (
    <div
      onMouseDown={onWrapperMouseDown}
      onContextMenu={onContextMenuOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.kind === 'component' ? 'max-content' : width,
        cursor: dragging ? 'grabbing' : 'default',
      }}
    >
      {node.kind !== 'component' && (
        <NodeHeader
          title={title}
          kind={node.kind}
          dragging={dragging}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onCopy={onCopy}
          onCut={onCut}
          onRename={onRename}
          onPlay={() => {
            const surface =
              (conversation?.surface as A2uiMessage[] | null | undefined) ??
              (node.surface as A2uiMessage[] | undefined) ??
              null
            if (!surface) return
            try {
              const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(surface))))
              const url = `${window.location.origin}/preview#kind=${node.kind}&title=${encodeURIComponent(title)}&surface=${encodeURIComponent(b64)}`
              window.open(url, '_blank', 'noopener,noreferrer')
            } catch (e) {
              console.error('Preview encode failed', e)
            }
          }}
        />
      )}
      <div
        style={{
          marginTop: node.kind === 'component' ? 0 : 12,
          position: 'relative',
          borderRadius: node.kind === 'chat' ? 30 : 0,
          boxShadow: showRing ? `0 0 0 ${ringWidth}px ${ringColor}` : 'none',
          transition: 'box-shadow 100ms ease',
          overflow: 'hidden',
        }}
      >
        {node.kind === 'chat' && (
          <ChatBody
            surface={isActive ? conversation?.surface ?? null : null}
            loading={isActive ? conversation?.loading ?? false : false}
            error={isActive ? conversation?.error ?? null : null}
            theme={isActive ? conversation?.theme ?? 'light' : 'light'}
            history={isActive ? conversation?.messages ?? [] : []}
            selectedComponentId={selectedComponentId}
            onSelectComponent={onSelectComponent}
            onEditText={onEditText}
            onAction={onAction}
            onSendMessage={onSendMessage}
          />
        )}
        {node.kind === 'mobile' && (
          <MobileBody
            surface={isActive ? conversation?.surface ?? null : null}
            loading={isActive ? conversation?.loading ?? false : false}
            error={isActive ? conversation?.error ?? null : null}
            theme={isActive ? conversation?.theme ?? 'light' : 'light'}
            selectedComponentId={selectedComponentId}
            onSelectComponent={onSelectComponent}
            onEditText={onEditText}
            onAction={onAction}
          />
        )}
        {node.kind === 'web' && (
          <WebBody
            surface={isActive ? conversation?.surface ?? null : null}
            loading={isActive ? conversation?.loading ?? false : false}
            error={isActive ? conversation?.error ?? null : null}
            theme={isActive ? conversation?.theme ?? 'light' : 'light'}
            selectedComponentId={selectedComponentId}
            onSelectComponent={onSelectComponent}
            onEditText={onEditText}
            onAction={onAction}
          />
        )}
        {node.kind === 'component' && (
          <ComponentBody
            // Prefer LLM-regenerated surface (live conversation) over the initial
            // flyout template so edits are visible.
            surface={(isActive && conversation?.surface) || (node.surface as never) || null}
            loading={isActive ? conversation?.loading ?? false : false}
            error={isActive ? conversation?.error ?? null : null}
            theme={isActive ? conversation?.theme ?? 'light' : 'light'}
            selectedComponentId={selectedComponentId}
            onSelectComponent={onSelectComponent}
            onEditText={onEditText}
            onAction={onAction}
          />
        )}
        {isActive && conversation?.loading ? <ShimmerOverlay /> : null}
      </div>

      {contextMenu ? (
        <div
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#ffffff',
            border: '1px solid #e5e5e5',
            borderRadius: 12,
            padding: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
            minWidth: 180,
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <MenuItem onClick={runMenuItem(onDuplicate)} icon={<DuplicateIcon />} label="Duplicate" />
          <MenuItem onClick={runMenuItem(onCopy)} icon={<CopyIcon />} label="Copy" />
          <MenuItem onClick={runMenuItem(onCut)} icon={<CutIcon />} label="Cut" />
          {selectedIds && selectedIds.size >= 2 && onArrange ? (
            <>
              <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
              <MenuItem
                onClick={runMenuItem(() => onArrange('horizontal'))}
                icon={<TidyHorizontalIcon />}
                label="Auto-layout · Horizontal"
              />
              <MenuItem
                onClick={runMenuItem(() => onArrange('vertical'))}
                icon={<TidyVerticalIcon />}
                label="Auto-layout · Vertical"
              />
            </>
          ) : null}
          {node.kind !== 'component' && onRename ? (
            <MenuItem
              onClick={() => {
                setContextMenu(null)
                // The title pill is double-clicked normally; for now just no-op for component
              }}
              icon={<RenameIcon />}
              label="Rename (double-click title)"
            />
          ) : null}
          <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
          <MenuItem onClick={runMenuItem(onDelete)} icon={<TrashIcon />} label="Delete" danger />
        </div>
      ) : null}
    </div>
  )
}

function RenameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 10 L2 12 L4 12 L11 5 L9 3 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <path d="M9 3 L11 1 L13 3 L11 5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function TidyHorizontalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="3" height="8" rx="0.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="5.5" y="3" width="3" height="8" rx="0.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="10" y="3" width="3" height="8" rx="0.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  )
}

function TidyVerticalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="1" width="8" height="3" rx="0.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="3" y="5.5" width="8" height="3" rx="0.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="3" y="10" width="8" height="3" rx="0.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  )
}

function ShimmerOverlay() {
  return (
    <>
      {/* Wide soft-edged gradient with a long fade ramp; eased timing function
          (cubic-bezier matching CSS "ease-in-out") so the sweep feels organic
          rather than mechanical. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(110deg, ' +
              'rgba(74,70,190,0) 0%, ' +
              'rgba(74,70,190,0.04) 25%, ' +
              'rgba(74,70,190,0.12) 40%, ' +
              'rgba(83,129,191,0.20) 50%, ' +
              'rgba(92,188,193,0.12) 60%, ' +
              'rgba(92,188,193,0.04) 75%, ' +
              'rgba(92,188,193,0) 100%' +
            ')',
          backgroundSize: '260% 100%',
          animation: 'a2ui-shimmer 2.6s cubic-bezier(0.42, 0, 0.58, 1) infinite',
          pointerEvents: 'none',
          borderRadius: 'inherit',
          willChange: 'background-position',
          zIndex: 5,
        }}
      />
      {/* Subtle breathing tint layer — synced to half the shimmer cadence, gives
          the impression of depth instead of a single repeating bar. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 80% at 50% 50%, rgba(74,70,190,0.06) 0%, rgba(92,188,193,0.04) 50%, transparent 75%)',
          animation: 'a2ui-shimmer-breathe 5.2s ease-in-out infinite',
          pointerEvents: 'none',
          borderRadius: 'inherit',
          opacity: 0.7,
          zIndex: 4,
        }}
      />
      <style>{`
        @keyframes a2ui-shimmer { 0% { background-position: -130% 0; } 100% { background-position: 230% 0; } }
        @keyframes a2ui-shimmer-breathe { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.85; } }
      `}</style>
    </>
  )
}

function NodeHeader({
  title,
  kind,
  dragging,
  onDelete,
  onDuplicate,
  onCopy,
  onCut,
  onRename,
  onPlay,
}: {
  title: string
  kind: NodeKind
  dragging: boolean
  onDelete?: () => void
  onDuplicate?: () => void
  onCopy?: () => void
  onCut?: () => void
  onRename?: (title: string) => void
  onPlay?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const menuRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraftTitle(title)
      requestAnimationFrame(() => {
        titleInputRef.current?.focus()
        titleInputRef.current?.select()
      })
    }
  }, [editing, title])

  const commitTitle = () => {
    const next = draftTitle.trim()
    if (next && next !== title) onRename?.(next)
    setEditing(false)
  }

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const run = (fn?: () => void) => () => {
    setMenuOpen(false)
    fn?.()
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      {kind === 'component' ? (
        <div style={{ flex: 1 }} />
      ) : editing ? (
        <input
          ref={titleInputRef}
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitTitle()
            } else if (e.key === 'Escape') {
              setEditing(false)
            }
            e.stopPropagation()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 14px',
            borderRadius: 999,
            background: '#171717',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'inherit',
            border: 'none',
            outline: '2px solid #0f6cbd',
            outlineOffset: 1,
            minWidth: 80,
            maxWidth: 240,
          }}
        />
      ) : (
        <div
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
          title="Double-click to rename"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 14px',
            borderRadius: 999,
            background: '#171717',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 500,
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          {title}
        </div>
      )}
      <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        <button
          aria-label="Open preview"
          title="Open preview in a new tab"
          onClick={(e) => {
            e.stopPropagation()
            onPlay?.()
          }}
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            border: '1px solid #e5e5e5',
            background: '#ffffff',
            color: '#525252',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 2 L10 6 L3 10 Z" fill="currentColor" />
          </svg>
        </button>
        <button
          aria-label="More"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((o) => !o)
          }}
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            border: '1px solid #e5e5e5',
            background: menuOpen ? '#f5f5f5' : '#ffffff',
            color: '#525252',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="3" r="1.2" fill="currentColor" />
            <circle cx="7" cy="7" r="1.2" fill="currentColor" />
            <circle cx="7" cy="11" r="1.2" fill="currentColor" />
          </svg>
        </button>
        {menuOpen ? (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 36,
              right: 0,
              background: '#ffffff',
              border: '1px solid #e5e5e5',
              borderRadius: 12,
              padding: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
              minWidth: 180,
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MenuItem onClick={run(onDuplicate)} icon={<DuplicateIcon />} label="Duplicate" shortcut="" />
            <MenuItem onClick={run(onCopy)} icon={<CopyIcon />} label="Copy" shortcut="" />
            <MenuItem onClick={run(onCut)} icon={<CutIcon />} label="Cut" shortcut="" />
            <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
            <MenuItem
              onClick={run(onDelete)}
              icon={<TrashIcon />}
              label="Delete"
              shortcut=""
              danger
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MenuItem({
  onClick,
  icon,
  label,
  shortcut,
  danger,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  shortcut?: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        border: 'none',
        background: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 8,
        fontSize: 13,
        color: danger ? '#b91c1c' : '#171717',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? '#fef2f2' : '#f5f5f5')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ display: 'inline-flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', color: danger ? '#b91c1c' : '#525252' }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut ? <span style={{ fontSize: 11, color: '#a3a3a3', fontVariantNumeric: 'tabular-nums' }}>{shortcut}</span> : null}
    </button>
  )
}

function DuplicateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <rect x="4.5" y="4.5" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.3" fill="#ffffff" />
    </svg>
  )
}
function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="5" y="5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.3" fill="#ffffff" />
    </svg>
  )
}
function CutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="3.5" cy="10.5" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10.5" cy="10.5" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 9 L12 2 M9 9 L2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 4 L11 4 M5 4 L5 2.5 A0.7 0.7 0 0 1 5.7 1.8 L8.3 1.8 A0.7 0.7 0 0 1 9 2.5 L9 4 M4 4 L4.6 12 A0.8 0.8 0 0 0 5.4 12.7 L8.6 12.7 A0.8 0.8 0 0 0 9.4 12 L10 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function CircleBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      aria-label={label}
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        border: '1px solid #e5e5e5',
        background: '#ffffff',
        color: '#525252',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

