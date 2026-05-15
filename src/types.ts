export type NodeKind = 'chat' | 'mobile' | 'web' | 'component'

export interface CanvasNodeData {
  id: string
  kind: NodeKind
  x: number
  y: number
  title?: string
  // Local-only pre-populated surface (used for design-system-dragged component nodes
  // that don't yet have an LLM-generated surface).
  surface?: unknown[]
}

// Aspect-ratio-correct sizes:
// chat / mobile: 9:19.5 (iPhone-class phone)
// web: 16:10 (laptop / desktop)
export const NODE_DEFAULTS: Record<NodeKind, { width: number; height: number; title: string }> = {
  chat: { width: 380, height: 823, title: 'New Chat' },
  mobile: { width: 380, height: 823, title: 'Mobile Screen' },
  web: { width: 880, height: 550, title: 'App Screen' },
  component: { width: 420, height: 280, title: 'Component' },
}

export const DRAG_MIME = 'application/x-a2ui-kind'
export const COMPONENT_DRAG_MIME = 'application/x-a2ui-component'
