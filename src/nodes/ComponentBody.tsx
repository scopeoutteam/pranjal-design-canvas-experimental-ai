import A2uiRenderer from '../a2ui/Renderer'
import type { A2uiMessage } from '../a2ui/types'

export default function ComponentBody({
  surface,
  loading,
  error,
  selectedComponentId,
  onSelectComponent,
  onAction,
}: {
  surface?: A2uiMessage[] | null
  loading?: boolean
  error?: string | null
  theme?: 'light' | 'dark'
  selectedComponentId?: string | null
  onSelectComponent?: (id: string | null) => void
  onAction?: (name: string, context: Record<string, unknown> | undefined) => void
} = {}) {
  return (
    <div style={{ display: 'inline-block', minWidth: 40, minHeight: 24 }}>
      {error ? (
        <div
          style={{
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            padding: 10,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}
      {surface ? (
        <A2uiRenderer
          messages={surface}
          onAction={(ev) => onAction?.(ev.name, ev.context)}
          selectedComponentId={selectedComponentId}
          onSelectComponent={onSelectComponent}
        />
      ) : null}
      {/* Loading state shown via shimmer overlay in CanvasNode */}
    </div>
  )
}
