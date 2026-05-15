import { useEffect, useRef, useState } from 'react'
import scopeoutLogo from './assets/scopeout-logo.svg'

const GRADIENT = 'linear-gradient(90deg, #4A46BE 0%, #5CBCC1 100%)'

// Slow shimmering version — same hues, repeated across a 200% strip and slid via
// background-position animation. Used on the QPW outer border for a subtle ambient glow.
const GRADIENT_SHIMMER =
  'linear-gradient(110deg, #4A46BE 0%, #5CBCC1 25%, #4A46BE 50%, #5CBCC1 75%, #4A46BE 100%)'

// Inject keyframes once into the document
function useShimmerStyles() {
  if (typeof document !== 'undefined' && !document.getElementById('qpw-shimmer-keyframes')) {
    const s = document.createElement('style')
    s.id = 'qpw-shimmer-keyframes'
    s.textContent = `
      @keyframes qpw-shimmer { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }
      @keyframes qpw-pop-in { from { opacity: 0; transform: translateY(8px) scale(0.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
    `
    document.head.appendChild(s)
  }
}

export default function QuickPromptWindow({
  onSubmit,
  loading,
  statusLabel,
  targetLabel,
  onClearTarget,
  routeError,
  dataRecommendation,
}: {
  onSubmit?: (text: string) => void | Promise<void>
  loading?: boolean
  statusLabel?: string
  targetLabel?: string | null
  onClearTarget?: () => void
  routeError?: string | null
  dataRecommendation?: {
    connection: import('./types').DataConnection | null
    onConnect: () => void
  } | null
}) {
  useShimmerStyles()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Click outside the QPW collapses it (when expanded)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [open])

  const submit = () => {
    const text = value.trim()
    if (!text || loading) return
    setValue('')
    setOpen(false)
    onSubmit?.(text)
  }

  return (
    <div
      ref={rootRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
      }}
    >
      <div
        key={open ? 'expanded' : 'collapsed'}
        style={{ animation: 'qpw-pop-in 200ms cubic-bezier(0.16, 1, 0.3, 1)', transformOrigin: 'bottom center' }}
      >
      {open ? (
        <ExpandedPanel
          value={value}
          onChange={setValue}
          onCollapse={() => setOpen(false)}
          onSubmit={submit}
          loading={!!loading}
          statusLabel={statusLabel}
          targetLabel={targetLabel ?? null}
          onClearTarget={onClearTarget}
          routeError={routeError ?? null}
          dataRecommendation={dataRecommendation ?? null}
          textareaRef={textareaRef}
        />
      ) : (
        <CollapsedPill onClick={() => setOpen(true)} />
      )}
      </div>
    </div>
  )
}

function CollapsedPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: GRADIENT_SHIMMER,
        backgroundSize: '200% 100%',
        animation: 'qpw-shimmer 2s linear infinite',
        opacity: 0.95,
        padding: 1.5,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 999,
          padding: '14px 22px 14px 18px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <img src={scopeoutLogo} alt="" width={20} height={20} style={{ display: 'block' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#171717', letterSpacing: -0.1 }}>
          Scout AI
        </span>
        <span style={{ color: '#e5e5e5' }}>|</span>
        <span
          style={{
            fontSize: 13,
            color: '#737373',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ fontSize: 14 }}>⌘</span>
          <span>K</span>
        </span>
      </div>
    </button>
  )
}

function ExpandedPanel({
  value,
  onChange,
  onCollapse,
  onSubmit,
  loading,
  statusLabel,
  targetLabel,
  onClearTarget,
  routeError,
  dataRecommendation,
  textareaRef,
}: {
  value: string
  onChange: (v: string) => void
  onCollapse: () => void
  onSubmit: () => void
  loading: boolean
  statusLabel?: string
  targetLabel: string | null
  onClearTarget?: () => void
  routeError: string | null
  dataRecommendation: {
    connection: import('./types').DataConnection | null
    onConnect: () => void
  } | null
  textareaRef: React.RefObject<HTMLTextAreaElement>
}) {
  return (
    <div
      style={{
        background: GRADIENT_SHIMMER,
        backgroundSize: '200% 100%',
        animation: 'qpw-shimmer 2s linear infinite',
        opacity: 0.95,
        padding: 1.5,
        borderRadius: 22,
        width: 720,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 21,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={scopeoutLogo} alt="" width={20} height={20} style={{ display: 'block' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#171717' }}>Scout AI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconBtn label="Settings">
              <SettingsIcon />
            </IconBtn>
            <IconBtn label="Add screenshot">
              <FrameAddIcon />
            </IconBtn>
            <IconBtn label="Collapse" onClick={onCollapse}>
              <MinimizeIcon />
            </IconBtn>
          </div>
        </div>

        {targetLabel ? (
          <div
            style={{
              display: 'inline-flex',
              alignSelf: 'flex-start',
              alignItems: 'center',
              gap: 8,
              padding: '4px 4px 4px 10px',
              borderRadius: 999,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#0f6cbd',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <span>Editing: {targetLabel}</span>
            {onClearTarget ? (
              <button
                onClick={onClearTarget}
                aria-label="Clear target"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#0f6cbd',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#dbeafe')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </div>
        ) : null}

        {routeError ? (
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: 12,
            }}
          >
            {routeError}
          </div>
        ) : null}

        {dataRecommendation ? (
          <DataRecommendationBanner
            connection={dataRecommendation.connection}
            onConnect={dataRecommendation.onConnect}
          />
        ) : null}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit()
            }
          }}
          placeholder="Describe a use case to generate a flow… (or type /conversation-maker)"
          rows={2}
          disabled={loading}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: 14,
            fontFamily: 'inherit',
            color: '#171717',
            background: 'transparent',
            lineHeight: 1.5,
            padding: 0,
            opacity: loading ? 0.5 : 1,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            aria-label="Add"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: '#525252',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <PlusIcon />
          </button>
          <SkillsPill />
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={onSubmit}
              disabled={loading || !value.trim()}
              style={{
                background: loading || !value.trim() ? '#e5e5e5' : '#171717',
                color: loading || !value.trim() ? '#a3a3a3' : '#ffffff',
                border: 'none',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: loading || !value.trim() ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {loading ? statusLabel || 'Thinking…' : 'Send'}
              {!loading ? (
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 7 L12 2 L9 12 L7 8 Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 30,
        height: 30,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
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

function SkillsPill() {
  return (
    <div
      style={{
        background: GRADIENT,
        padding: 1,
        borderRadius: 999,
        display: 'inline-block',
      }}
    >
      <button
        style={{
          background: '#ffffff',
          borderRadius: 999,
          padding: '3px 10px 3px 3px',
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontFamily: 'inherit',
          color: '#171717',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SparkleIconBrand />
        </div>
        <span>Skills</span>
        <ChevronDown />
      </button>
    </div>
  )
}

function SparkleColorIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1 L9.3 6 L14 7.5 L9.3 9 L8 14 L6.7 9 L2 7.5 L6.7 6 Z" fill="#dc2626" />
      <path d="M12.5 2 L13 4 L15 4.5 L13 5 L12.5 7 L12 5 L10 4.5 L12 4 Z" fill="#f59e0b" />
    </svg>
  )
}

function SparkleIconWhite() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 1 L8.1 5.2 L12.5 6.4 L8.1 7.6 L7 12 L5.9 7.6 L1.5 6.4 L5.9 5.2 Z" fill="#ffffff" />
    </svg>
  )
}

function SparkleIconBrand() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <defs>
        <linearGradient id="qpw-skill-grad" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4A46BE" />
          <stop offset="100%" stopColor="#5CBCC1" />
        </linearGradient>
      </defs>
      <path d="M8 1 L9.3 6 L14 7.5 L9.3 9 L8 14 L6.7 9 L2 7.5 L6.7 6 Z" fill="url(#qpw-skill-grad)" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.5 L8 3 M8 13 L8 14.5 M2.7 4.5 L4 5.2 M12 10.8 L13.3 11.5 M2.7 11.5 L4 10.8 M12 5.2 L13.3 4.5 M1.5 8 L3 8 M13 8 L14.5 8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function FrameAddIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M8 6.5 L8 9.5 M6.5 8 L9.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function MinimizeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8 L6 8 L6 11 M10 8 L13 8 L13 5 M6 8 L3 11 M10 8 L13 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2 L7 12 M2 7 L12 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 5 L6 8 L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function DataRecommendationBanner({
  connection,
  onConnect,
}: {
  connection: import('./types').DataConnection | null
  onConnect: () => void
}) {
  const isConnected = !!connection
  const summary = !connection
    ? null
    : connection.kind === 'api'
    ? connection.endpoint
    : connection.serverName || connection.serverUrl

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px 8px 12px',
        borderRadius: 10,
        background: isConnected
          ? 'linear-gradient(90deg, rgba(74,70,190,0.06) 0%, rgba(92,188,193,0.06) 100%)'
          : 'linear-gradient(90deg, rgba(74,70,190,0.08) 0%, rgba(92,188,193,0.08) 100%)',
        border: '1px solid',
        borderColor: isConnected ? 'rgba(92,188,193,0.45)' : 'rgba(74,70,190,0.25)',
        color: '#171717',
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #4A46BE 0%, #5CBCC1 100%)',
          color: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <ellipse cx="4" cy="3.5" rx="2.5" ry="1.2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M1.5 3.5 V7 C1.5 7.66 2.62 8.2 4 8.2 C5.38 8.2 6.5 7.66 6.5 7 V3.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <path d="M6.5 7 L9 7 M9 7 L7.6 5.6 M9 7 L7.6 8.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="11" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.3" fill="none" />
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#171717' }}>
          {isConnected ? 'Connected to live data' : 'This frame uses mock data'}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#525252',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isConnected
            ? `${connection?.kind === 'api' ? 'API' : 'MCP'} · ${summary}`
            : 'Connect an API endpoint or MCP server to render real values.'}
        </div>
      </div>
      <button
        type="button"
        onClick={onConnect}
        style={{
          padding: '6px 12px',
          borderRadius: 999,
          border: 'none',
          background: isConnected
            ? '#ffffff'
            : 'linear-gradient(90deg, #4A46BE 0%, #5CBCC1 100%)',
          color: isConnected ? '#4A46BE' : '#ffffff',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          flexShrink: 0,
          boxShadow: isConnected ? '0 0 0 1px rgba(74,70,190,0.35) inset' : 'none',
        }}
      >
        {isConnected ? 'Edit' : 'Connect data'}
      </button>
    </div>
  )
}
