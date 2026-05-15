import { useCallback, useEffect, useRef, useState } from 'react'
import { DRAG_MIME, COMPONENT_DRAG_MIME, NODE_DEFAULTS, type CanvasNodeData, type NodeKind } from './types'
import CanvasNode from './nodes/CanvasNode'
import type { Conversation, SelectionMode } from './App'
import { CATALOG } from './catalog/componentTemplates'

type View = { x: number; y: number; scale: number }
type Marquee = { startScreenX: number; startScreenY: number; endScreenX: number; endScreenY: number; additive: boolean }

const MIN_SCALE = 0.1
const MAX_SCALE = 8
const GRID_SIZE = 24
const DOT_COLOR = '#d4d4d4'
const DOT_RADIUS = 1
const DRAG_THRESHOLD = 4

function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
}

// Approximate world-space height per kind including title pill + gap.
// Matches NODE_DEFAULTS aspect ratios (phone 9:19.5, laptop 16:10).
const NODE_HEIGHT: Record<NodeKind, number> = {
  chat: 823,
  mobile: 823,
  web: 550,
  component: 280,
}

function isInsideScrollable(
  target: HTMLElement | null,
  boundary: HTMLElement,
  deltaX: number,
  deltaY: number,
): boolean {
  let el = target
  while (el && el !== boundary) {
    const s = getComputedStyle(el)
    const canScrollY =
      (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight
    const canScrollX =
      (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth

    if (canScrollY && Math.abs(deltaY) > 0) {
      const atTop = el.scrollTop <= 0
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      // Scrollable up if scrolling up and not already at top, or scrolling down and not at bottom
      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true
    }
    if (canScrollX && Math.abs(deltaX) > 0) {
      const atLeft = el.scrollLeft <= 0
      const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
      if ((deltaX < 0 && !atLeft) || (deltaX > 0 && !atRight)) return true
    }
    el = el.parentElement
  }
  return false
}

function rectsIntersect(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

export interface SnapBounds { x: number; y: number; w: number; h: number }
export interface SnapResult {
  dx: number
  dy: number
  guideX: number | null
  guideY: number | null
}

function bestSnap(draggedEdges: number[], candidates: number[], threshold: number) {
  let best: { adjustment: number; line: number; dist: number } | null = null
  for (const edge of draggedEdges) {
    for (const cand of candidates) {
      const dist = Math.abs(edge - cand)
      if (dist <= threshold && (best === null || dist < best.dist)) {
        best = { adjustment: cand - edge, line: cand, dist }
      }
    }
  }
  return best
}

function computeSnapFor(dragged: SnapBounds, siblings: SnapBounds[], threshold: number): SnapResult {
  const draggedXEdges = [dragged.x, dragged.x + dragged.w / 2, dragged.x + dragged.w]
  const draggedYEdges = [dragged.y, dragged.y + dragged.h / 2, dragged.y + dragged.h]

  const candX: number[] = []
  const candY: number[] = []
  for (const s of siblings) {
    candX.push(s.x, s.x + s.w / 2, s.x + s.w)
    candY.push(s.y, s.y + s.h / 2, s.y + s.h)
  }

  const snapX = bestSnap(draggedXEdges, candX, threshold)
  const snapY = bestSnap(draggedYEdges, candY, threshold)

  return {
    dx: snapX?.adjustment ?? 0,
    dy: snapY?.adjustment ?? 0,
    guideX: snapX?.line ?? null,
    guideY: snapY?.line ?? null,
  }
}

export default function Canvas({
  nodes,
  activeNodeId,
  conversations,
  selectedIds,
  selectedComponentId,
  onAddNode,
  onAddComponentNode,
  onMoveSelection,
  onResizeNode,
  onConnectData,
  onSelectNode,
  onSelectComponent,
  onEditText,
  onSetSelection,
  onClearSelection,
  onDelete,
  onDuplicate,
  onCopy,
  onCut,
  onRename,
  onArrange,
  onAction,
  onSendMessage,
  canvasMode: _canvasMode,
}: {
  nodes: CanvasNodeData[]
  activeNodeId: string | null
  conversations: Map<string, Conversation>
  selectedIds: Set<string>
  selectedComponentId: string | null
  onAddNode: (kind: NodeKind, worldX: number, worldY: number) => void
  onAddComponentNode: (worldX: number, worldY: number, title: string, surface: unknown[]) => void
  onMoveSelection: (dx: number, dy: number) => void
  onResizeNode: (id: string, next: { x: number; y: number; width: number; height: number }) => void
  onConnectData: (id: string) => void
  onSelectNode: (id: string, mode: SelectionMode) => void
  onSelectComponent: (componentId: string | null) => void
  onEditText: (componentId: string, newText: string) => void
  onSetSelection: (ids: string[]) => void
  onClearSelection: () => void
  onDelete: (sourceId: string) => void
  onDuplicate: (sourceId: string) => void
  onCopy: (sourceId: string) => void
  onCut: (sourceId: string) => void
  onRename: (id: string, title: string) => void
  onArrange: (axis: 'horizontal' | 'vertical') => void
  onAction: (name: string, context: Record<string, unknown> | undefined) => void
  onSendMessage: (text: string) => void
  canvasMode?: 'design' | 'prototype'
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 })
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const marqueeRef = useRef<{ moved: boolean } | null>(null)
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  })

  const getSnap = useCallback(
    (bounds: SnapBounds, excludeIds: Set<string>): SnapResult => {
      const siblings: SnapBounds[] = nodes
        .filter((n) => !excludeIds.has(n.id))
        .map((n) => ({
          x: n.x,
          y: n.y,
          w: NODE_DEFAULTS[n.kind].width,
          h: NODE_HEIGHT[n.kind],
        }))
      return computeSnapFor(bounds, siblings, 6 / view.scale)
    },
    [nodes, view.scale],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      const isZoom = e.ctrlKey || e.metaKey
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      if (isZoom) {
        // Always handle zoom — overrides browser page zoom
        e.preventDefault()
        setView((v) => {
          const next = clampScale(v.scale * Math.exp(-e.deltaY * 0.01))
          const ratio = next / v.scale
          return { scale: next, x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio }
        })
        return
      }

      // For pan (plain wheel/two-finger scroll), let scrollable elements scroll natively.
      if (isInsideScrollable(e.target as HTMLElement | null, el, e.deltaX, e.deltaY)) {
        return
      }
      e.preventDefault()
      setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onBackgroundMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle mouse — pan the canvas regardless of where the click lands
      if (e.button === 1) {
        e.preventDefault()
        const startMx = e.clientX
        const startMy = e.clientY
        const startVx = view.x
        const startVy = view.y
        const onMove = (m: MouseEvent) => {
          setView((v) => ({ ...v, x: startVx + (m.clientX - startMx), y: startVy + (m.clientY - startMy) }))
        }
        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          document.body.style.cursor = ''
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        document.body.style.cursor = 'grabbing'
        return
      }
      if (e.button !== 0) return
      if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.canvasBg) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      setMarquee({ startScreenX: sx, startScreenY: sy, endScreenX: sx, endScreenY: sy, additive: e.shiftKey })
      marqueeRef.current = { moved: false }
    },
    [view.x, view.y],
  )

  useEffect(() => {
    if (!marquee) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = marquee.startScreenX
    const startY = marquee.startScreenY
    const additive = marquee.additive

    const onMove = (e: MouseEvent) => {
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      setMarquee((m) => (m ? { ...m, endScreenX: sx, endScreenY: sy } : m))
      if (marqueeRef.current) {
        const dx = sx - startX
        const dy = sy - startY
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          marqueeRef.current.moved = true
        }
      }
    }

    const onUp = (e: MouseEvent) => {
      const wasMoved = !!marqueeRef.current?.moved
      marqueeRef.current = null
      const endX = e.clientX - rect.left
      const endY = e.clientY - rect.top
      setMarquee(null)

      if (!wasMoved) {
        if (!additive) onClearSelection()
        return
      }

      const x0 = Math.min(startX, endX)
      const y0 = Math.min(startY, endY)
      const x1 = Math.max(startX, endX)
      const y1 = Math.max(startY, endY)
      const wx0 = (x0 - view.x) / view.scale
      const wy0 = (y0 - view.y) / view.scale
      const ww = (x1 - x0) / view.scale
      const wh = (y1 - y0) / view.scale
      const hits: string[] = []
      for (const n of nodes) {
        const nw = NODE_DEFAULTS[n.kind].width
        const nh = NODE_HEIGHT[n.kind]
        if (rectsIntersect(wx0, wy0, ww, wh, n.x, n.y, nw, nh)) {
          hits.push(n.id)
        }
      }
      if (additive) {
        const merged = new Set([...selectedIds, ...hits])
        onSetSelection(Array.from(merged))
      } else {
        onSetSelection(hits)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!marquee])

  const zoomBy = useCallback((factor: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    setView((v) => {
      const next = clampScale(v.scale * factor)
      const ratio = next / v.scale
      return { scale: next, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio }
    })
  }, [])

  const resetView = useCallback(() => setView({ x: 0, y: 0, scale: 1 }), [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types)
    if (types.includes(DRAG_MIME) || types.includes(COMPONENT_DRAG_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      // Frame drop
      const kind = e.dataTransfer.getData(DRAG_MIME) as NodeKind
      if (kind) {
        e.preventDefault()
        const defaults = NODE_DEFAULTS[kind]
        const worldX = (screenX - view.x) / view.scale - defaults.width / 2
        const worldY = (screenY - view.y) / view.scale - defaults.height / 2
        onAddNode(kind, worldX, worldY)
        return
      }

      // Component drop from design system
      const componentName = e.dataTransfer.getData(COMPONENT_DRAG_MIME)
      if (componentName) {
        e.preventDefault()
        const defaults = NODE_DEFAULTS.component
        const worldX = (screenX - view.x) / view.scale - defaults.width / 2
        const worldY = (screenY - view.y) / view.scale - defaults.height / 2
        const entry = CATALOG.find((c) => c.name === componentName)
        if (entry) {
          onAddComponentNode(worldX, worldY, componentName, entry.build())
        }
      }
    },
    [view.x, view.y, view.scale, onAddNode, onAddComponentNode],
  )

  const gridStep = GRID_SIZE * view.scale
  const showGrid = gridStep >= 6

  const marqueeRect = marquee
    ? {
        left: Math.min(marquee.startScreenX, marquee.endScreenX),
        top: Math.min(marquee.startScreenY, marquee.endScreenY),
        width: Math.abs(marquee.endScreenX - marquee.startScreenX),
        height: Math.abs(marquee.endScreenY - marquee.startScreenY),
      }
    : null

  return (
    <div
      ref={containerRef}
      data-canvas-bg="true"
      onMouseDown={onBackgroundMouseDown}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        position: 'fixed',
        inset: 0,
        cursor: marquee ? 'crosshair' : 'default',
        userSelect: 'none',
        overflow: 'hidden',
        backgroundColor: '#fafafa',
        backgroundImage: showGrid
          ? `radial-gradient(circle, ${DOT_COLOR} ${DOT_RADIUS}px, transparent ${DOT_RADIUS}px)`
          : 'none',
        backgroundSize: `${gridStep}px ${gridStep}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {nodes.map((n) => (
          <CanvasNode
            key={n.id}
            node={n}
            scale={view.scale}
            selected={selectedIds.has(n.id)}
            isActive={n.id === activeNodeId}
            conversation={conversations.get(n.id)}
            selectedComponentId={n.id === activeNodeId ? selectedComponentId : null}
            onSelectComponent={(cid) => onSelectComponent(cid)}
            onEditText={onEditText}
            onSelect={(mode) => onSelectNode(n.id, mode)}
            onMoveSelection={onMoveSelection}
            onResize={(next) => onResizeNode(n.id, next)}
            onConnectData={() => onConnectData(n.id)}
            onAction={onAction}
            onSendMessage={onSendMessage}
            onDelete={() => onDelete(n.id)}
            onDuplicate={() => onDuplicate(n.id)}
            onCopy={() => onCopy(n.id)}
            onCut={() => onCut(n.id)}
            onRename={(title) => onRename(n.id, title)}
            onArrange={onArrange}
            getSnap={getSnap}
            onSetGuides={setGuides}
            selectedIds={selectedIds}
          />
        ))}
      </div>

      {guides.x !== null ? (
        <div
          style={{
            position: 'absolute',
            left: guides.x * view.scale + view.x,
            top: 0,
            bottom: 0,
            width: 1,
            background: '#0f6cbd',
            pointerEvents: 'none',
            zIndex: 18,
          }}
        />
      ) : null}
      {guides.y !== null ? (
        <div
          style={{
            position: 'absolute',
            top: guides.y * view.scale + view.y,
            left: 0,
            right: 0,
            height: 1,
            background: '#0f6cbd',
            pointerEvents: 'none',
            zIndex: 18,
          }}
        />
      ) : null}

      {marqueeRect && marqueeRect.width > 2 && marqueeRect.height > 2 ? (
        <div
          style={{
            position: 'absolute',
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
            background: 'rgba(15, 108, 189, 0.08)',
            border: '1px solid #0f6cbd',
            borderRadius: 2,
            pointerEvents: 'none',
            zIndex: 15,
          }}
        />
      ) : null}

      <ZoomIndicator
        scale={view.scale}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onReset={resetView}
      />
    </div>
  )
}

function ZoomIndicator({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}) {
  const pct = Math.round(scale * 100)
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 10,
        padding: 4,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
        fontSize: 13,
        fontVariantNumeric: 'tabular-nums',
        zIndex: 20,
      }}
    >
      <HudBtn onClick={onZoomOut} label="Zoom out">−</HudBtn>
      <button
        onClick={onReset}
        title="Reset view"
        style={{
          border: 'none',
          background: 'transparent',
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: 13,
          minWidth: 56,
          color: '#525252',
          borderRadius: 6,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {pct}%
      </button>
      <HudBtn onClick={onZoomIn} label="Zoom in">+</HudBtn>
    </div>
  )
}

function HudBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 28,
        height: 28,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 18,
        lineHeight: 1,
        color: '#525252',
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}
