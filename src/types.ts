export type NodeKind =
  | 'chat'
  | 'mobile'
  | 'web'
  | 'component'
  | 'shape'
  | 'sticky'
  | 'section'
  | 'document'

export type ShapeType = 'rectangle' | 'ellipse' | 'triangle' | 'diamond' | 'arrow' | 'line' | 'text'
export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange'

export interface CanvasNodeData {
  id: string
  kind: NodeKind
  x: number
  y: number
  title?: string
  // User-resized artboard dimensions. Fall back to NODE_DEFAULTS[kind] when absent.
  width?: number
  height?: number
  // Local-only pre-populated surface (used for design-system-dragged component nodes
  // that don't yet have an LLM-generated surface).
  surface?: unknown[]
  // Shape / sticky extras.
  shapeType?: ShapeType
  stickyColor?: StickyColor
  text?: string
  // Shape style overrides. When absent, ShapeBody uses its built-in defaults.
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: 'solid' | 'dashed' | 'dotted'
  strokeOpacity?: number // 0..1
  fillOpacity?: number // 0..1
  cornerRadius?: number // px, applies to rectangles
  // For arrow / line shapes used as journey connectors: explicit start and end
  // points expressed in node-local pixels (0,0 = top-left of the node's bbox).
  // When absent, arrow/line render horizontally across the bbox.
  arrowStart?: { x: number; y: number }
  arrowEnd?: { x: number; y: number }
  // Group / section membership. groupId binds peers so selecting one selects all.
  // parentId binds a node to a section frame so dragging the section moves it too.
  groupId?: string
  parentId?: string
  // Document blocks (Miro-style): each block is a paragraph/heading/list item with
  // its own type and text. Stored when kind === 'document'.
  documentBlocks?: DocBlock[]
}

export type DocBlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'p'
  | 'bullet'
  | 'numbered'
  | 'checklist'
  | 'quote'
  | 'callout'
  | 'divider'

export interface DocBlock {
  id: string
  type: DocBlockType
  text: string
}

export const MIN_NODE_SIZE: Record<NodeKind, { width: number; height: number }> = {
  chat: { width: 240, height: 360 },
  mobile: { width: 240, height: 360 },
  web: { width: 480, height: 320 },
  component: { width: 200, height: 120 },
  shape: { width: 40, height: 40 },
  sticky: { width: 350, height: 350 },
  section: { width: 200, height: 160 },
  document: { width: 320, height: 280 },
}

// Aspect-ratio-correct sizes:
// chat / mobile: 9:19.5 (iPhone-class phone)
// web: 16:10 (laptop / desktop)
export const NODE_DEFAULTS: Record<NodeKind, { width: number; height: number; title: string }> = {
  chat: { width: 380, height: 823, title: 'New Chat' },
  mobile: { width: 380, height: 823, title: 'Mobile Screen' },
  web: { width: 880, height: 550, title: 'App Screen' },
  component: { width: 420, height: 280, title: 'Component' },
  shape: { width: 200, height: 160, title: '' },
  // Default spawn size for a sticky note. Equal to MIN_NODE_SIZE.sticky (350×350)
  // so a fresh sticky is exactly at its minimum and can only be resized larger.
  sticky: { width: 350, height: 350, title: '' },
  section: { width: 480, height: 320, title: 'Section' },
  // Miro-style Document: labeled rich-text page on the canvas.
  document: { width: 560, height: 720, title: 'Heading' },
}

export const DRAG_MIME = 'application/x-a2ui-kind'
export const COMPONENT_DRAG_MIME = 'application/x-a2ui-component'
// Shape and sticky drags carry the sub-type in the data value (e.g. "rectangle", "yellow").
export const SHAPE_DRAG_MIME = 'application/x-a2ui-shape'
export const STICKY_DRAG_MIME = 'application/x-a2ui-sticky'
export const DOCUMENT_DRAG_MIME = 'application/x-a2ui-document'

// Default fill / accent colors for stickies. Soft body + saturated accent for any chrome.
// FigJam-style palette for shape fill / border pickers. 22 colors arranged
// as two rows of 11: row 1 saturated, row 2 pastels. Last cell of row 2 is the
// "custom" slot (handled by the toolbar, not stored here).
export const SHAPE_PALETTE: { label: string; value: string }[] = [
  // Row 1 — saturated
  { label: 'Black', value: '#1f2024' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'White', value: '#ffffff' },
  // Row 2 — pastels
  { label: 'Gray light', value: '#a3a3a3' },
  { label: 'Gray lighter', value: '#d4d4d4' },
  { label: 'Red light', value: '#fecaca' },
  { label: 'Orange light', value: '#fed7aa' },
  { label: 'Yellow light', value: '#fef9c3' },
  { label: 'Green light', value: '#bbf7d0' },
  { label: 'Teal light', value: '#ccfbf1' },
  { label: 'Blue light', value: '#dbeafe' },
  { label: 'Purple light', value: '#ddd6fe' },
  { label: 'Pink light', value: '#fbcfe8' },
]

export const STICKY_PALETTE: Record<StickyColor, { bg: string; border: string; ink: string }> = {
  yellow: { bg: '#FEF3C7', border: '#FBBF24', ink: '#78350F' },
  pink: { bg: '#FCE7F3', border: '#EC4899', ink: '#831843' },
  blue: { bg: '#DBEAFE', border: '#3B82F6', ink: '#1E3A8A' },
  green: { bg: '#DCFCE7', border: '#22C55E', ink: '#14532D' },
  purple: { bg: '#EDE9FE', border: '#A855F7', ink: '#4C1D95' },
  orange: { bg: '#FED7AA', border: '#F97316', ink: '#7C2D12' },
}

export type DataConnection =
  | {
      kind: 'api'
      endpoint: string
      method?: 'GET' | 'POST'
      authHeader?: string
      notes?: string
    }
  | {
      kind: 'mcp'
      serverUrl: string
      serverName?: string
      tool?: string
      notes?: string
    }

export const DATA_COMPONENT_TYPES = new Set([
  'Table',
  'BarChart',
  'LineChart',
  'KeyValueList',
  'StatCard',
  'MetricGrid',
])
