import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Canvas from './Canvas'
import LeftRail from './LeftRail'
import BrandHeader from './BrandHeader'
import QuickPromptWindow from './QuickPromptWindow'
import TopToolbar, { type CanvasMode } from './TopToolbar'
import { NODE_DEFAULTS, type CanvasNodeData, type NodeKind } from './types'
import type { A2uiMessage } from './a2ui/types'
import { extractTheme } from './a2ui/Renderer'

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
}

export default function App() {
  const [nodes, setNodes] = useState<CanvasNodeData[]>([])
  const [conversations, setConversations] = useState<Map<string, Conversation>>(() => new Map())
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [routing, setRouting] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('design')
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

  const addNode = useCallback((kind: NodeKind, worldX: number, worldY: number): string => {
    const id = crypto.randomUUID()
    setNodes((prev) => [...prev, { id, kind, x: worldX, y: worldY }])
    return id
  }, [])

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
      setNodes((prev) =>
        prev.map((n) => (selectedIds.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
      )
    },
    [selectedIds],
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
  const selectNode = useCallback((id: string, mode: SelectionMode) => {
    setSelectedIds((prev) => {
      if (mode === 'replace') return new Set([id])
      const next = new Set(prev)
      if (mode === 'toggle') {
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }
      next.add(id)
      return next
    })
    if (mode === 'replace') {
      setActiveNodeId(id)
      setSelectedComponentId(null)
    }
  }, [])

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
      let kind: NodeKind = 'chat'
      let refined = text
      try {
        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Routing failed')
        kind = (data.kind as NodeKind) || 'chat'
        refined = (data.refined_intent as string) || text
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setRouteError(message)
        setRouting(false)
        return
      }
      setRouting(false)

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
    [activeNodeId, nodes, conversations, selectedComponentId, callGenerate, spawnNodeAt, setSelection, updateConversation],
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
        onArrange={arrangeSelection}
        onAction={submitAction}
        onSendMessage={submitPrompt}
        canvasMode={canvasMode}
      />
      <BrandHeader />
      <TopToolbar mode={canvasMode} onChange={setCanvasMode} />
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
      />
    </>
  )
}
