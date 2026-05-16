import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Canvas from './Canvas'
import LeftRail from './LeftRail'
import BrandHeader from './BrandHeader'
import QuickPromptWindow from './QuickPromptWindow'
type CanvasMode = 'design' | 'prototype'
import { NODE_DEFAULTS, type CanvasNodeData, type DataConnection, type NodeKind } from './types'
import type { A2uiMessage } from './a2ui/types'
import { surfaceHasDataComponents } from './a2ui/types'
import { extractTheme } from './a2ui/Renderer'
import ConnectDataModal from './ConnectDataModal'

export type SelectionMode = 'replace' | 'add' | 'toggle'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Conversation {
  kind: NodeKind | null
  messages: ChatMessage[]
  surface: A2uiMessage[] | null
  theme: 'light' | 'dark'
  loading: boolean
  error: string | null
  routing: boolean
  routeReason: string | null
  dataConnection?: DataConnection | null
}

const INITIAL_CONVERSATION: Conversation = {
  kind: null,
  messages: [],
  surface: null,
  theme: 'light',
  loading: false,
  error: null,
  routing: false,
  routeReason: null,
  dataConnection: null,
}

export default function App() {
  const [nodes, setNodes] = useState<CanvasNodeData[]>([])
  const [conversations, setConversations] = useState<Map<string, Conversation>>(() => new Map())
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [routing, setRouting] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  // Toggle removed from UI; canvas is always in design mode (static surfaces, no
  // LLM call on action). Keep the constant + prop wiring so Canvas/Renderer
  // gating still type-checks if the toggle is reintroduced later.
  const canvasMode: CanvasMode = 'design'
  const [connectModalNodeId, setConnectModalNodeId] = useState<string | null>(null)
  const clipboard = useRef<Array<Omit<CanvasNodeData, 'id'>>>([])

  // Active conversation derived from map
  const activeConversation: Conversation = useMemo(() => {
    if (!activeNodeId) return INITIAL_CONVERSATION
    return conversations.get(activeNodeId) ?? INITIAL_CONVERSATION
  }, [activeNodeId, conversations])

  const updateConversation = useCallback((nodeId: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => {
      const next = new Map(prev)
      const current = next.get(nodeId) ?? INITIAL_CONVERSATION
      next.set(nodeId, updater(current))
      return next
    })
  }, [])

  // ── Node ops ────────────────────────────────────────────────────
  const renameNode = useCallback((id: string, title: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)))
  }, [])

  const addNode = useCallback(
    (
      kind: NodeKind,
      worldX: number,
      worldY: number,
      extras?: Partial<CanvasNodeData>,
    ): string => {
      const id = crypto.randomUUID()
      setNodes((prev) => [...prev, { id, kind, x: worldX, y: worldY, ...extras }])
      return id
    },
    [],
  )

  const updateNodeText = useCallback((id: string, text: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)))
  }, [])

  const updateNodeBlocks = useCallback((id: string, documentBlocks: import('./types').DocBlock[]) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, documentBlocks } : n)))
  }, [])

  // Generic patcher used by floating editors (e.g. ShapeToolbar) to update one
  // or more visual properties on a node.
  const updateNodeProps = useCallback((id: string, patch: Partial<CanvasNodeData>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }, [])

  // Group all currently-selected nodes under one fresh groupId. Clicking any
  // member of a group selects the whole group (see selectNode below). If only
  // one node is selected, this is a no-op.
  const groupSelection = useCallback(() => {
    if (selectedIds.size < 2) return
    const gid = crypto.randomUUID()
    const ids = new Set(selectedIds)
    setNodes((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, groupId: gid } : n)))
  }, [selectedIds])

  // Strip groupId from every selected node.
  const ungroupSelection = useCallback(() => {
    if (selectedIds.size === 0) return
    const ids = new Set(selectedIds)
    setNodes((prev) =>
      prev.map((n) => {
        if (!ids.has(n.id) || !n.groupId) return n
        const { groupId: _omit, ...rest } = n
        return rest as CanvasNodeData
      }),
    )
  }, [selectedIds])

  // Wrap the current selection in a new Section frame. The section is sized to
  // the bbox of the selection + padding, placed behind them, and each selected
  // node gets parentId = section.id so dragging the section moves them too.
  const wrapInSection = useCallback(() => {
    if (selectedIds.size === 0) return
    const selected = nodes.filter((n) => selectedIds.has(n.id))
    if (selected.length === 0) return
    const widthOf = (n: CanvasNodeData) => n.width ?? NODE_DEFAULTS[n.kind].width
    const heightOf = (n: CanvasNodeData) => n.height ?? NODE_DEFAULTS[n.kind].height
    const pad = 32
    // Reserve space above the wrapped content for the floating Figma-style
    // section label (LABEL_HEIGHT 22 + LABEL_OFFSET 6 in SectionBody).
    const headerH = 28
    const xs = selected.map((n) => n.x)
    const ys = selected.map((n) => n.y)
    const rights = selected.map((n) => n.x + widthOf(n))
    const bottoms = selected.map((n) => n.y + heightOf(n))
    const minX = Math.min(...xs) - pad
    const minY = Math.min(...ys) - pad - headerH
    const maxX = Math.max(...rights) + pad
    const maxY = Math.max(...bottoms) + pad
    const sectionId = crypto.randomUUID()
    const section: CanvasNodeData = {
      id: sectionId,
      kind: 'section',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      title: 'Section',
    }
    const memberIds = new Set(selectedIds)
    setNodes((prev) => {
      // Insert the section BEFORE its members so it renders behind them in
      // the flat z-order (later siblings render on top in absolute layout).
      const others = prev.filter((n) => !memberIds.has(n.id))
      const members = prev
        .filter((n) => memberIds.has(n.id))
        .map((n) => ({ ...n, parentId: sectionId }))
      return [...others, section, ...members]
    })
  }, [selectedIds, nodes])

  // Spawn a generated journey/flowchart as individual shape nodes + connecting
  // arrows on the canvas. Centered horizontally in the viewport.
  type JourneyShape = 'rectangle' | 'ellipse' | 'triangle' | 'diamond' | 'text'
  interface JourneyNode {
    id: string
    shape: JourneyShape
    text: string
    x: number
    y: number
  }
  interface JourneyEdge {
    from: string
    to: string
    label?: string
  }
  const spawnJourney = useCallback(
    (payload: { title?: string; nodes: JourneyNode[]; edges: JourneyEdge[] }) => {
      // Default sizing per shape — kept in client so the LLM doesn't have to.
      const sizeFor = (shape: JourneyShape): { w: number; h: number } => {
        if (shape === 'diamond') return { w: 220, h: 120 }
        if (shape === 'text') return { w: 80, h: 28 }
        return { w: 220, h: 80 }
      }

      // Center the flow horizontally in the viewport, near the top.
      const vw = window.innerWidth
      const baseX = vw / 2
      const baseY = 80

      // Compute absolute positions for each journey node (top-left in world space).
      const positions = new Map<string, { x: number; y: number; w: number; h: number }>()
      for (const n of payload.nodes) {
        const { w, h } = sizeFor(n.shape)
        positions.set(n.id, { x: baseX + n.x - w / 2, y: baseY + n.y, w, h })
      }

      const newIds: string[] = []

      // Spawn shape nodes first.
      for (const n of payload.nodes) {
        const p = positions.get(n.id)!
        const id = addNode('shape', p.x, p.y, {
          shapeType: n.shape,
          text: n.text,
          width: p.w,
          height: p.h,
        })
        newIds.push(id)
      }

      // Spawn an arrow per edge — from bottom-center of source to top-center of target.
      for (const e of payload.edges) {
        const a = positions.get(e.from)
        const b = positions.get(e.to)
        if (!a || !b) continue
        const sx = a.x + a.w / 2
        const sy = a.y + a.h
        const ex = b.x + b.w / 2
        const ey = b.y
        // Skip degenerate (target above source).
        if (ey < sy) continue

        // Bounding box that contains both endpoints (with a tiny margin).
        const pad = 8
        const minX = Math.min(sx, ex) - pad
        const minY = Math.min(sy, ey)
        const maxX = Math.max(sx, ex) + pad
        const maxY = Math.max(sy, ey)
        const bboxW = Math.max(2, maxX - minX)
        const bboxH = Math.max(2, maxY - minY)
        const arrowId = addNode('shape', minX, minY, {
          shapeType: 'arrow',
          width: bboxW,
          height: bboxH,
          arrowStart: { x: sx - minX, y: sy - minY },
          arrowEnd: { x: ex - minX, y: ey - minY },
        })
        newIds.push(arrowId)

        // Edge label as a small unstyled text node placed at the midpoint.
        if (e.label) {
          const midX = (sx + ex) / 2
          const midY = (sy + ey) / 2
          const labelW = 60
          const labelH = 24
          const labelId = addNode('shape', midX - labelW / 2, midY - labelH / 2, {
            shapeType: 'text',
            text: e.label,
            width: labelW,
            height: labelH,
          })
          newIds.push(labelId)
        }
      }

      // Don't auto-select — let the canvas look clean after generation.
      void newIds
    },
    [addNode],
  )

  // Spawn a generated empathy map as a six-quadrant board (title + dividers +
  // persona ellipse + per-quadrant colored stickies). Layout matches FigJam's
  // empathy-map template.
  interface EmpathyPayload {
    title?: string
    persona: { name: string; archetype?: string; bullets?: string[]; about?: string }
    quadrants: {
      hears: string[]
      sees: string[]
      saysAndDoes: string[]
      thinksAndFeels: string[]
      pain: string[]
      gain: string[]
    }
  }
  const spawnEmpathyMap = useCallback(
    (payload: EmpathyPayload) => {
      // Board geometry in canvas px. Origin (0,0) is the top-left of the empathy map.
      const W = 1200
      const TITLE_H = 60
      // Three rows under the title — taller HEARS/SEES row, mid SAYS/THINKS, bottom PAIN/GAIN.
      const ROW1_TOP = TITLE_H + 40   // 100
      const ROW2_TOP = 420
      const ROW3_TOP = 660
      const BOTTOM = 880

      // Center the board horizontally in the viewport, top-aligned with a bit of pad.
      const vw = window.innerWidth
      const baseX = vw / 2 - W / 2
      const baseY = 80
      const at = (x: number, y: number) => ({ x: baseX + x, y: baseY + y })

      // Title — big text shape spanning the top.
      const titleW = 600
      const titleH = 40
      const titlePos = at(W / 2 - titleW / 2, 4)
      addNode('shape', titlePos.x, titlePos.y, {
        shapeType: 'text',
        text: payload.title ?? 'Empathy Map',
        width: titleW,
        height: titleH,
      })

      // Dividers — vertical line down the middle, two horizontals between rows.
      // Use 'line' shape with explicit start/end so it draws diagonally if needed (here straight).
      const vlinePos = at(W / 2 - 1, TITLE_H + 20)
      addNode('shape', vlinePos.x, vlinePos.y, {
        shapeType: 'line',
        width: 2,
        height: BOTTOM - (TITLE_H + 20),
        arrowStart: { x: 1, y: 0 },
        arrowEnd: { x: 1, y: BOTTOM - (TITLE_H + 20) },
      })
      const hr1 = at(40, ROW2_TOP - 20)
      addNode('shape', hr1.x, hr1.y, {
        shapeType: 'line',
        width: W - 80,
        height: 2,
        arrowStart: { x: 0, y: 1 },
        arrowEnd: { x: W - 80, y: 1 },
      })
      const hr2 = at(40, ROW3_TOP - 20)
      addNode('shape', hr2.x, hr2.y, {
        shapeType: 'line',
        width: W - 80,
        height: 2,
        arrowStart: { x: 0, y: 1 },
        arrowEnd: { x: W - 80, y: 1 },
      })

      // Centered persona ellipse at the intersection of the first horizontal divider.
      const personaSize = 110
      const personaPos = at(W / 2 - personaSize / 2, ROW2_TOP - 20 - personaSize / 2)
      addNode('shape', personaPos.x, personaPos.y, {
        shapeType: 'ellipse',
        text: payload.persona?.name ?? 'Persona',
        width: personaSize,
        height: personaSize,
      })

      // Helper to spawn a quadrant: label + 3 stickies in a row.
      const QUADRANTS: Array<{
        key: keyof EmpathyPayload['quadrants']
        label: string
        color: 'green' | 'blue' | 'yellow' | 'purple' | 'pink' | 'orange'
        colCenterX: number
        rowTop: number
      }> = [
        { key: 'hears',          label: 'HEARS',          color: 'green',  colCenterX: W * 0.25, rowTop: ROW1_TOP },
        { key: 'sees',           label: 'SEES',           color: 'blue',   colCenterX: W * 0.75, rowTop: ROW1_TOP },
        { key: 'saysAndDoes',    label: 'SAYS & DOES',    color: 'yellow', colCenterX: W * 0.25, rowTop: ROW2_TOP },
        { key: 'thinksAndFeels', label: 'THINKS & FEELS', color: 'purple', colCenterX: W * 0.75, rowTop: ROW2_TOP },
        { key: 'pain',           label: 'PAIN',           color: 'pink',   colCenterX: W * 0.25, rowTop: ROW3_TOP },
        { key: 'gain',           label: 'GAIN',           color: 'orange', colCenterX: W * 0.75, rowTop: ROW3_TOP },
      ]
      const STICKY_W = 130
      const STICKY_H = 130
      const STICKY_GAP = 16
      const LABEL_H = 26

      for (const q of QUADRANTS) {
        // Quadrant label
        const labelW = 220
        const labelPos = at(q.colCenterX - labelW / 2, q.rowTop)
        addNode('shape', labelPos.x, labelPos.y, {
          shapeType: 'text',
          text: q.label,
          width: labelW,
          height: LABEL_H,
        })

        // 3 stickies in a row, centered under the label
        const items = payload.quadrants?.[q.key] ?? []
        const n = Math.min(items.length, 3)
        const totalW = STICKY_W * n + STICKY_GAP * (n - 1)
        const startX = q.colCenterX - totalW / 2
        const stickyY = q.rowTop + LABEL_H + 16
        for (let i = 0; i < n; i++) {
          const sx = startX + i * (STICKY_W + STICKY_GAP)
          const pos = at(sx, stickyY)
          addNode('sticky', pos.x, pos.y, {
            stickyColor: q.color,
            text: items[i],
            width: STICKY_W,
            height: STICKY_H,
          })
        }
      }
    },
    [addNode],
  )

  const addComponentNode = useCallback(
    (worldX: number, worldY: number, title: string, surface: unknown[]) => {
      const id = crypto.randomUUID()
      setNodes((prev) => [
        ...prev,
        { id, kind: 'component', x: worldX, y: worldY, title, surface },
      ])
    },
    [],
  )

  const deleteNodes = useCallback(
    (sourceId: string) => {
      const ids =
        selectedIds.has(sourceId) && selectedIds.size > 1 ? Array.from(selectedIds) : [sourceId]
      const removed = new Set(ids)
      setNodes((prev) => prev.filter((n) => !removed.has(n.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
      setConversations((prev) => {
        const next = new Map(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
      if (activeNodeId && removed.has(activeNodeId)) {
        setActiveNodeId(null)
        setSelectedComponentId(null)
      }
    },
    [selectedIds, activeNodeId],
  )

  const duplicateNodes = useCallback(
    (sourceId: string) => {
      const ids =
        selectedIds.has(sourceId) && selectedIds.size > 1 ? Array.from(selectedIds) : [sourceId]
      const offset = 32
      let newIds: string[] = []
      setNodes((prev) => {
        const idSet = new Set(ids)
        const dups = prev
          .filter((n) => idSet.has(n.id))
          .map((n) => ({ ...n, id: crypto.randomUUID(), x: n.x + offset, y: n.y + offset }))
        newIds = dups.map((d) => d.id)
        return [...prev, ...dups]
      })
      requestAnimationFrame(() => {
        if (newIds.length > 0) setSelectedIds(new Set(newIds))
      })
    },
    [selectedIds],
  )

  const copyNodes = useCallback(
    (sourceId: string) => {
      const ids =
        selectedIds.has(sourceId) && selectedIds.size > 1 ? Array.from(selectedIds) : [sourceId]
      const idSet = new Set(ids)
      clipboard.current = nodes
        .filter((n) => idSet.has(n.id))
        .map(({ id: _id, ...rest }) => rest)
    },
    [nodes, selectedIds],
  )

  const cutNodes = useCallback(
    (sourceId: string) => {
      copyNodes(sourceId)
      deleteNodes(sourceId)
    },
    [copyNodes, deleteNodes],
  )

  const moveSelection = useCallback(
    (dx: number, dy: number) => {
      // Drag-targets = selectedIds plus children of any section in the selection
      // (so dragging a section carries its contents).
      setNodes((prev) => {
        const sectionIds = new Set(
          prev.filter((n) => n.kind === 'section' && selectedIds.has(n.id)).map((n) => n.id),
        )
        return prev.map((n) => {
          const isSelected = selectedIds.has(n.id)
          const isInDraggedSection = n.parentId && sectionIds.has(n.parentId)
          if (isSelected || isInDraggedSection) {
            return { ...n, x: n.x + dx, y: n.y + dy }
          }
          return n
        })
      })
    },
    [selectedIds],
  )

  const resizeNode = useCallback(
    (id: string, next: { x: number; y: number; width: number; height: number }) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, x: next.x, y: next.y, width: next.width, height: next.height }
            : n,
        ),
      )
    },
    [],
  )

  const openConnectModal = useCallback((nodeId: string) => {
    setConnectModalNodeId(nodeId)
  }, [])

  const setDataConnection = useCallback(
    (nodeId: string, conn: DataConnection | null) => {
      setConversations((prev) => {
        const next = new Map(prev)
        const existing = next.get(nodeId) ?? INITIAL_CONVERSATION
        next.set(nodeId, { ...existing, dataConnection: conn })
        return next
      })
    },
    [],
  )

  // Figma-style auto-layout: arrange the current selection in a clean row or
  // column with consistent gaps based on their current axis ordering.
  const arrangeSelection = useCallback(
    (axis: 'horizontal' | 'vertical', gap = 32) => {
      if (selectedIds.size < 2) return
      setNodes((prev) => {
        const selected = prev.filter((n) => selectedIds.has(n.id))
        if (selected.length < 2) return prev
        const sorted = [...selected].sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y))
        const widthOf = (n: CanvasNodeData) => NODE_DEFAULTS[n.kind].width
        const heightOf = (n: CanvasNodeData) => NODE_DEFAULTS[n.kind].height
        const baseX = sorted[0].x
        const baseY = sorted[0].y
        const positions = new Map<string, { x: number; y: number }>()
        if (axis === 'horizontal') {
          let cursor = baseX
          for (const n of sorted) {
            positions.set(n.id, { x: cursor, y: baseY })
            cursor += widthOf(n) + gap
          }
        } else {
          let cursor = baseY
          for (const n of sorted) {
            positions.set(n.id, { x: baseX, y: cursor })
            cursor += heightOf(n) + gap
          }
        }
        return prev.map((n) => {
          const p = positions.get(n.id)
          return p ? { ...n, x: p.x, y: p.y } : n
        })
      })
    },
    [selectedIds],
  )

  // ── Selection ───────────────────────────────────────────────────
  // Expand a single id to the full group it belongs to (if any).
  const expandToGroup = useCallback(
    (id: string): string[] => {
      const node = nodes.find((n) => n.id === id)
      if (!node?.groupId) return [id]
      const gid = node.groupId
      return nodes.filter((n) => n.groupId === gid).map((n) => n.id)
    },
    [nodes],
  )

  const selectNode = useCallback(
    (id: string, mode: SelectionMode) => {
      const groupPeers = expandToGroup(id)
      setSelectedIds((prev) => {
        if (mode === 'replace') return new Set(groupPeers)
        const next = new Set(prev)
        if (mode === 'toggle') {
          // Toggle the whole group together.
          const allIn = groupPeers.every((g) => next.has(g))
          for (const g of groupPeers) {
            if (allIn) next.delete(g)
            else next.add(g)
          }
          return next
        }
        for (const g of groupPeers) next.add(g)
        return next
      })
      if (mode === 'replace') {
        setActiveNodeId(id)
        setSelectedComponentId(null)
      }
    },
    [expandToGroup],
  )

  const setSelection = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()))
  }, [])

  const selectComponent = useCallback((componentId: string | null) => {
    setSelectedComponentId(componentId)
  }, [])

  // Double-click-to-edit: rewrite a component's text in-place, preferring the
  // live conversation surface, falling back to node.surface for flyout-spawned
  // components that haven't seen an LLM turn yet.
  const editComponentText = useCallback(
    (componentId: string, newText: string, field: string = 'text') => {
      if (!activeNodeId) return
      // Immutable update at a dotted path (e.g. "title", "columns.0.header",
      // "rows.1.name"). Supports object and array steps.
      const setPath = (obj: unknown, path: string, value: unknown): unknown => {
        const keys = path.split('.')
        const head = keys[0]
        const rest = keys.slice(1).join('.')
        const isNumericHead = /^\d+$/.test(head)
        if (rest === '') {
          if (Array.isArray(obj)) {
            const copy = obj.slice()
            copy[isNumericHead ? Number(head) : (head as never)] = value as never
            return copy
          }
          return { ...(obj as Record<string, unknown>), [head]: value }
        }
        if (Array.isArray(obj)) {
          const idx = Number(head)
          const copy = obj.slice()
          copy[idx] = setPath(obj[idx] ?? {}, rest, value)
          return copy
        }
        const o = (obj as Record<string, unknown>) ?? {}
        return { ...o, [head]: setPath(o[head] ?? {}, rest, value) }
      }
      const rewrite = (msgs: A2uiMessage[] | null | undefined): A2uiMessage[] | null => {
        if (!msgs) return msgs ?? null
        return msgs.map((m) => {
          if ('updateComponents' in m && m.updateComponents?.components) {
            return {
              ...m,
              updateComponents: {
                ...m.updateComponents,
                components: m.updateComponents.components.map((c) =>
                  c.id === componentId
                    ? (setPath(c, field, newText) as typeof c)
                    : c,
                ) as never,
              },
            } as A2uiMessage
          }
          return m
        })
      }
      const live = conversations.get(activeNodeId)?.surface
      if (live) {
        updateConversation(activeNodeId, (c) => ({ ...c, surface: rewrite(c.surface) }))
        return
      }
      // Flyout-spawned component, no live conversation yet — mutate node.surface
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== activeNodeId) return n
          const rewritten = rewrite(n.surface as A2uiMessage[] | null | undefined)
          return rewritten ? ({ ...n, surface: rewritten as unknown[] } as CanvasNodeData) : n
        }),
      )
    },
    [activeNodeId, conversations, updateConversation],
  )

  // ── Generation ──────────────────────────────────────────────────
  const spawnNodeAt = useCallback(
    (kind: NodeKind, index: number, totalNew: number): string => {
      const w = window.innerWidth
      const h = window.innerHeight
      const defaults = NODE_DEFAULTS[kind]
      // Lay out new nodes horizontally for multi-screen flows
      const totalWidth = defaults.width * totalNew + 60 * (totalNew - 1)
      const baseX = w / 2 - totalWidth / 2
      const worldX = baseX + index * (defaults.width + 60)
      const worldY = h / 2 - defaults.height / 2
      return addNode(kind, worldX, worldY)
    },
    [addNode],
  )

  type SurfaceResp = { title?: string; messages: A2uiMessage[] }

  const callGenerate = useCallback(
    async (nodeId: string, kind: NodeKind, messages: ChatMessage[]) => {
      // Surface to send as context: prefer live conversation surface, else node-local surface
      const node = nodes.find((n) => n.id === nodeId)
      const liveSurface = conversations.get(nodeId)?.surface ?? null
      const seedSurface = (liveSurface ?? (node?.surface as A2uiMessage[] | undefined)) ?? null
      updateConversation(nodeId, (c) => ({ ...c, loading: true, error: null }))
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, messages, currentSurface: seedSurface }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Generation failed')
        const surfaces = (data?.surfaces as SurfaceResp[] | undefined) ?? null
        if (surfaces && surfaces.length > 0) {
          // First surface lands in this node
          const first = surfaces[0]
          const surface = first.messages ?? null
          updateConversation(nodeId, (c) => ({
            ...c,
            messages: [...c.messages, { role: 'assistant', content: data?.raw ?? '' }],
            // Don't blank the canvas when the LLM returns an unparseable surface
            surface: surface && Array.isArray(surface) && surface.length > 0 ? surface : c.surface,
            theme: surface ? extractTheme(surface) : c.theme,
            loading: false,
            error:
              surface && Array.isArray(surface) && surface.length > 0
                ? null
                : 'AI returned an unparseable surface — kept the previous one',
          }))
          if (first.title) {
            setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, title: first.title } : n)))
          }
          // Spawn additional nodes for remaining surfaces (multi-screen)
          if (surfaces.length > 1) {
            const extra = surfaces.slice(1)
            const newIds: string[] = []
            const sourceX = nodes.find((n) => n.id === nodeId)?.x ?? 0
            const sourceY = nodes.find((n) => n.id === nodeId)?.y ?? 0
            const defaults = NODE_DEFAULTS[kind]
            extra.forEach((s, i) => {
              const id = crypto.randomUUID()
              newIds.push(id)
              const worldX = sourceX + (i + 1) * (defaults.width + 60)
              const worldY = sourceY
              setNodes((prev) => [...prev, { id, kind, x: worldX, y: worldY, title: s.title }])
              setConversations((prev) => {
                const next = new Map(prev)
                next.set(id, {
                  kind,
                  messages: messages.slice(),
                  surface: s.messages ?? null,
                  theme: extractTheme(s.messages ?? null),
                  loading: false,
                  error: null,
                  routing: false,
                  routeReason: null,
                })
                return next
              })
            })
          }
        } else {
          const newSurface = (data?.messages as A2uiMessage[] | null) ?? null
          updateConversation(nodeId, (c) => ({
            ...c,
            messages: [...c.messages, { role: 'assistant', content: data?.raw ?? '' }],
            surface:
              newSurface && Array.isArray(newSurface) && newSurface.length > 0
                ? newSurface
                : c.surface,
            theme: newSurface ? extractTheme(newSurface) : c.theme,
            loading: false,
            error:
              newSurface && Array.isArray(newSurface) && newSurface.length > 0
                ? null
                : 'AI returned an unparseable surface — kept the previous one',
          }))
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        updateConversation(nodeId, (c) => ({ ...c, loading: false, error: message }))
      }
    },
    [updateConversation, nodes],
  )

  const submitPrompt = useCallback(
    async (text: string) => {
      if (!text.trim()) return

      // If there's an active conversation, continue it (optionally with a component target)
      if (activeNodeId) {
        const node = nodes.find((n) => n.id === activeNodeId)
        if (node) {
          let prompt = text
          if (selectedComponentId) {
            prompt = `[edit target_component=${selectedComponentId}] ${text}`
            setSelectedComponentId(null)
          }
          const current = conversations.get(activeNodeId) ?? INITIAL_CONVERSATION
          const next = [...current.messages, { role: 'user' as const, content: prompt }]
          updateConversation(activeNodeId, (c) => ({ ...c, messages: next }))
          await callGenerate(activeNodeId, node.kind, next)
          return
        }
      }

      // First prompt — route to a block kind
      setRouting(true)
      setRouteError(null)
      let routedKind: NodeKind | 'journey' | 'empathy' = 'chat'
      let refined = text
      try {
        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Routing failed')
        routedKind = (data.kind as NodeKind | 'journey' | 'empathy') || 'chat'
        refined = (data.refined_intent as string) || text
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setRouteError(message)
        setRouting(false)
        return
      }

      // Journey — call /api/journey, spawn shape nodes directly. No frame, no conversation.
      if (routedKind === 'journey') {
        try {
          const r = await fetch('/api/journey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: refined }),
          })
          const journey = await r.json()
          if (!r.ok) throw new Error(journey?.error || 'Journey generation failed')
          if (!journey?.nodes || !Array.isArray(journey.nodes)) {
            throw new Error('Journey response missing nodes[]')
          }
          spawnJourney(journey)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          setRouteError(message)
        } finally {
          setRouting(false)
        }
        return
      }

      // Empathy map — call /api/empathy, spawn the six-quadrant board.
      if (routedKind === 'empathy') {
        try {
          const r = await fetch('/api/empathy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: refined }),
          })
          const empathy = await r.json()
          if (!r.ok) throw new Error(empathy?.error || 'Empathy map generation failed')
          if (!empathy?.quadrants || !empathy?.persona) {
            throw new Error('Empathy response missing quadrants/persona')
          }
          spawnEmpathyMap(empathy)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          setRouteError(message)
        } finally {
          setRouting(false)
        }
        return
      }
      setRouting(false)

      const kind = routedKind as NodeKind
      const newNodeId = spawnNodeAt(kind, 0, 1)
      setActiveNodeId(newNodeId)
      setSelection([newNodeId])

      const seed: ChatMessage[] = [{ role: 'user', content: refined }]
      setConversations((prev) => {
        const next = new Map(prev)
        next.set(newNodeId, {
          kind,
          messages: seed,
          surface: null,
          theme: 'light',
          loading: true,
          error: null,
          routing: false,
          routeReason: null,
        })
        return next
      })
      await callGenerate(newNodeId, kind, seed)
    },
    [activeNodeId, nodes, conversations, selectedComponentId, callGenerate, spawnNodeAt, setSelection, updateConversation, spawnJourney, spawnEmpathyMap],
  )

  const submitAction = useCallback(
    async (name: string, context: Record<string, unknown> | undefined) => {
      // In design mode, components are static — no LLM call on action
      if (canvasMode === 'design') return
      if (!activeNodeId) return
      const node = nodes.find((n) => n.id === activeNodeId)
      if (!node) return
      const ctxStr = context ? ` context=${JSON.stringify(context)}` : ''
      const text = `[action] name=${name}${ctxStr}`
      const current = conversations.get(activeNodeId) ?? INITIAL_CONVERSATION
      const next = [...current.messages, { role: 'user' as const, content: text }]
      updateConversation(activeNodeId, (c) => ({ ...c, messages: next }))
      await callGenerate(activeNodeId, node.kind, next)
    },
    [activeNodeId, nodes, conversations, callGenerate, updateConversation, canvasMode],
  )

  // Clear component target when active node changes
  useEffect(() => {
    setSelectedComponentId(null)
  }, [activeNodeId])

  // Backspace / Delete removes the current selection (unless typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (target.isContentEditable) return
      }
      if (selectedIds.size === 0) return
      e.preventDefault()
      const first = selectedIds.values().next().value
      if (first) deleteNodes(first)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, deleteNodes])

  // ── Render ──────────────────────────────────────────────────────
  const activeNode = activeNodeId ? nodes.find((n) => n.id === activeNodeId) : null
  const targetLabel = activeNode
    ? selectedComponentId
      ? `${activeNode.title ?? NODE_DEFAULTS[activeNode.kind].title} › ${selectedComponentId}`
      : (activeNode.title ?? NODE_DEFAULTS[activeNode.kind].title)
    : null

  return (
    <>
      <Canvas
        nodes={nodes}
        activeNodeId={activeNodeId}
        conversations={conversations}
        selectedIds={selectedIds}
        selectedComponentId={selectedComponentId}
        onAddNode={addNode}
        onAddComponentNode={addComponentNode}
        onMoveSelection={moveSelection}
        onResizeNode={resizeNode}
        onConnectData={openConnectModal}
        onSelectNode={selectNode}
        onSelectComponent={selectComponent}
        onEditText={editComponentText}
        onSetSelection={setSelection}
        onClearSelection={clearSelection}
        onDelete={deleteNodes}
        onDuplicate={duplicateNodes}
        onCopy={copyNodes}
        onCut={cutNodes}
        onRename={renameNode}
        onUpdateNodeText={updateNodeText}
        onUpdateNodeBlocks={updateNodeBlocks}
        onUpdateNodeProps={updateNodeProps}
        onArrange={arrangeSelection}
        onGroup={groupSelection}
        onUngroup={ungroupSelection}
        onWrapInSection={wrapInSection}
        onAction={submitAction}
        onSendMessage={submitPrompt}
        canvasMode={canvasMode}
      />
      <BrandHeader />
      <LeftRail />
      <QuickPromptWindow
        onSubmit={submitPrompt}
        loading={routing || activeConversation.loading}
        statusLabel={routing ? 'Routing…' : activeConversation.loading ? 'Thinking…' : undefined}
        targetLabel={targetLabel}
        onClearTarget={() => {
          setSelectedComponentId(null)
          setActiveNodeId(null)
        }}
        routeError={routeError}
        dataRecommendation={
          activeNodeId && surfaceHasDataComponents(activeConversation.surface)
            ? {
                connection: activeConversation.dataConnection ?? null,
                onConnect: () => activeNodeId && openConnectModal(activeNodeId),
              }
            : null
        }
      />
      <ConnectDataModal
        open={!!connectModalNodeId}
        initial={
          connectModalNodeId
            ? conversations.get(connectModalNodeId)?.dataConnection ?? null
            : null
        }
        frameTitle={
          connectModalNodeId
            ? nodes.find((n) => n.id === connectModalNodeId)?.title ??
              NODE_DEFAULTS[
                nodes.find((n) => n.id === connectModalNodeId)?.kind ?? 'mobile'
              ].title
            : undefined
        }
        onSave={(conn) => {
          if (connectModalNodeId) {
            setDataConnection(connectModalNodeId, conn)
            setConnectModalNodeId(null)
          }
        }}
        onDisconnect={() => {
          if (connectModalNodeId) {
            setDataConnection(connectModalNodeId, null)
            setConnectModalNodeId(null)
          }
        }}
        onClose={() => setConnectModalNodeId(null)}
      />
    </>
  )
}
