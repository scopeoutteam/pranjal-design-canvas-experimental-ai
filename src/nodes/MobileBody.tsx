import A2uiRenderer from '../a2ui/Renderer'
import type { A2uiMessage } from '../a2ui/types'

export default function MobileBody({
  surface,
  loading,
  error,
  theme,
  selectedComponentId,
  onSelectComponent,
  onEditText,
  onAction,
  height,
  canvasMode,
}: {
  surface?: A2uiMessage[] | null
  loading?: boolean
  error?: string | null
  theme?: 'light' | 'dark'
  selectedComponentId?: string | null
  onSelectComponent?: (id: string | null) => void
  onEditText?: (componentId: string, newText: string) => void
  onAction?: (name: string, context: Record<string, unknown> | undefined) => void
  height?: number
  canvasMode?: 'design' | 'prototype'
} = {}) {
  const hasLive = !!surface || !!loading || !!error
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 0,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        height: height ?? 775,
      }}
    >
      {hasLive ? (
        <LiveBody surface={surface} loading={loading} error={error} theme={theme} selectedComponentId={selectedComponentId} onSelectComponent={onSelectComponent} onEditText={onEditText} onAction={onAction} canvasMode={canvasMode} />
      ) : (
        <div style={{ flex: 1 }} />
      )}
    </div>
  )
}

function LiveBody({
  surface,
  loading,
  error,
  theme,
  selectedComponentId,
  onSelectComponent,
  onEditText,
  onAction,
  canvasMode,
}: {
  surface?: A2uiMessage[] | null
  loading?: boolean
  error?: string | null
  theme?: 'light' | 'dark'
  selectedComponentId?: string | null
  onSelectComponent?: (id: string | null) => void
  onEditText?: (componentId: string, newText: string) => void
  onAction?: (name: string, context: Record<string, unknown> | undefined) => void
  canvasMode?: 'design' | 'prototype'
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: '16px 14px',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: theme === 'dark' ? '#1f1f1f' : 'transparent',
        color: theme === 'dark' ? '#f5f5f5' : 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {error ? (
        <div
          style={{
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            padding: 12,
            borderRadius: 12,
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      ) : null}
      {surface ? (
        <A2uiRenderer messages={surface} onAction={(ev) => onAction?.(ev.name, ev.context)} selectedComponentId={selectedComponentId} onSelectComponent={onSelectComponent} onEditText={onEditText} canvasMode={canvasMode} />
      ) : null}
      {/* Loading state shown via shimmer overlay in CanvasNode */}
    </div>
  )
}

