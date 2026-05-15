import { useEffect, useRef, useState } from 'react'
import A2uiRenderer from '../a2ui/Renderer'
import type { A2uiMessage } from '../a2ui/types'
import type { ChatMessage } from '../App'

export default function ChatBody({
  surface,
  loading,
  error,
  history,
  theme,
  selectedComponentId,
  onSelectComponent,
  onEditText,
  onAction,
  onSendMessage,
  height,
  canvasMode,
}: {
  surface?: A2uiMessage[] | null
  loading?: boolean
  error?: string | null
  history?: ChatMessage[]
  theme?: 'light' | 'dark'
  selectedComponentId?: string | null
  onSelectComponent?: (id: string | null) => void
  onEditText?: (componentId: string, newText: string) => void
  onAction?: (name: string, context: Record<string, unknown> | undefined) => void
  onSendMessage?: (text: string) => void
  height?: number
  canvasMode?: 'design' | 'prototype'
}) {
  const hasLive = !!surface || !!loading || !!error || (history && history.length > 0)

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 28,
        padding: 0,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        height: height ?? 775,
      }}
    >
      <Notch />

      {hasLive ? (
        <LiveBody
          surface={surface}
          loading={loading}
          error={error}
          history={history ?? []}
          theme={theme}
          selectedComponentId={selectedComponentId}
          onSelectComponent={onSelectComponent}
          onEditText={onEditText}
          onAction={onAction}
          onSendMessage={onSendMessage}
          canvasMode={canvasMode}
        />
      ) : (
        <StaticBody onSendMessage={onSendMessage} />
      )}
    </div>
  )
}

function Notch() {
  return (
    <div
      style={{
        position: 'relative',
        padding: '14px 16px 0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 36,
      }}
    >
      <div style={{ width: 96, height: 22, background: '#0a0a0a', borderRadius: 999 }} />
      <div style={{ position: 'absolute', left: 16, top: 18, color: '#737373' }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 2 L10.2 6.4 L14.5 7.2 L11.4 10.2 L12.2 14.5 L9 12.4 L5.8 14.5 L6.6 10.2 L3.5 7.2 L7.8 6.4 Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 16,
          top: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#737373',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 9 L3 13 L7 13 M13 7 L13 3 L9 3 M3 13 L7 9 M13 3 L9 7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

function LiveBody({
  surface,
  loading,
  error,
  history,
  theme,
  selectedComponentId,
  onSelectComponent,
  onEditText,
  onAction,
  onSendMessage,
  canvasMode,
}: {
  surface?: A2uiMessage[] | null
  loading?: boolean
  error?: string | null
  history: ChatMessage[]
  theme?: 'light' | 'dark'
  selectedComponentId?: string | null
  onSelectComponent?: (id: string | null) => void
  onEditText?: (componentId: string, newText: string) => void
  onAction?: (name: string, context: Record<string, unknown> | undefined) => void
  onSendMessage?: (text: string) => void
  canvasMode?: 'design' | 'prototype'
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [surface, loading, history.length])

  const userTurns = history.filter((m) => m.role === 'user')
  const lastUser = userTurns[userTurns.length - 1]
  const showLastUserBubble = !!lastUser && !lastUser.content.startsWith('[action]')

  return (
    <>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          padding: '16px 14px 12px 14px',
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
        {showLastUserBubble ? <UserBubble text={lastUser.content} /> : null}

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
        {loading ? null : null}
      </div>

      <ChatComposer onSendMessage={onSendMessage} disabled={loading} />
    </>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          borderRadius: 16,
          background: '#171717',
          color: '#ffffff',
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {text}
      </div>
    </div>
  )
}

function ThinkingPill() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#737373', fontSize: 13 }}>
      <div
        style={{
          width: 14,
          height: 14,
          border: '2px solid #e5e5e5',
          borderTopColor: '#0f6cbd',
          borderRadius: '50%',
          animation: 'a2ui-spin 0.8s linear infinite',
        }}
      />
      <span>Verbos AI is thinking…</span>
      <style>{`@keyframes a2ui-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ChatComposer({
  onSendMessage,
  disabled,
}: {
  onSendMessage?: (text: string) => void
  disabled?: boolean
}) {
  const [value, setValue] = useState('')

  const send = () => {
    const text = value.trim()
    if (!text || disabled) return
    setValue('')
    onSendMessage?.(text)
  }

  return (
    <div
      style={{
        margin: 12,
        border: '1px solid #e5e5e5',
        borderRadius: 16,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#fafafa',
      }}
    >
      <input
        type="text"
        placeholder="Ask Verbos…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            send()
          }
        }}
        disabled={disabled}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 14,
          fontFamily: 'inherit',
          color: '#171717',
        }}
      />
      <button
        onClick={send}
        disabled={disabled || !value.trim()}
        aria-label="Send"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: 'none',
          background: disabled || !value.trim() ? '#e5e5e5' : '#171717',
          color: disabled || !value.trim() ? '#a3a3a3' : '#ffffff',
          cursor: disabled || !value.trim() ? 'default' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 7 L12 2 L9 12 L7 8 Z"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

function StaticBody({ onSendMessage }: { onSendMessage?: (text: string) => void }) {
  return (
    <>
      <div
        style={{
          flex: 1,
          padding: '24px 20px 16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          overflow: 'hidden',
        }}
      >
        <div style={{ fontSize: 16, color: '#171717', fontWeight: 500 }}>How can we help you?</div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ fontSize: 11, color: '#a3a3a3' }}>Suggestions</div>
          <SuggestionPill onClick={() => onSendMessage?.('Upgrade today!')}>Upgrade today!</SuggestionPill>
          <SuggestionPill onClick={() => onSendMessage?.('Review your bill.')}>Review your bill.</SuggestionPill>
          <SuggestionPill onClick={() => onSendMessage?.('Add a perk')}>Add a perk</SuggestionPill>
          <SuggestionPill onClick={() => onSendMessage?.('Have an order on the way?')}>
            Have an order on the way?
          </SuggestionPill>
        </div>
      </div>

      <ChatComposer onSendMessage={onSendMessage} />
    </>
  )
}

function SuggestionPill({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid #d4d4d4',
        borderRadius: 999,
        padding: '8px 14px',
        fontSize: 13,
        color: '#171717',
        background: '#ffffff',
        cursor: 'pointer',
      }}
    >
      {children}
    </div>
  )
}
