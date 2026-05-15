import { useEffect, useMemo, useRef, useState } from 'react'
import { DRAG_MIME, COMPONENT_DRAG_MIME, type NodeKind } from './types'
import { CATALOG, type CatalogEntry } from './catalog/componentTemplates'
import A2uiRenderer from './a2ui/Renderer'
import type { A2uiMessage } from './a2ui/types'

type RailMode = null | 'add' | 'catalog' | 'settings'

export default function LeftRail() {
  const [mode, setMode] = useState<RailMode>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mode) return
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMode(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode(null)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [mode])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 72,
        left: 16,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #e5e5e5',
          borderRadius: 999,
          padding: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <RailButton
          label="Add frame"
          active={mode === 'add'}
          onClick={() => setMode((m) => (m === 'add' ? null : 'add'))}
          icon={<AddIcon />}
        />
        <RailButton
          label="Design system"
          active={mode === 'catalog'}
          onClick={() => setMode((m) => (m === 'catalog' ? null : 'catalog'))}
          icon={<CatalogIcon />}
        />
        <div style={{ height: 1, background: '#e5e5e5', margin: '4px 6px' }} />
        <RailButton
          label="Settings"
          active={mode === 'settings'}
          onClick={() => setMode((m) => (m === 'settings' ? null : 'settings'))}
          icon={<SettingsGearIcon />}
        />
      </div>

      {mode === 'add' && <AddFlyout />}
      {mode === 'catalog' && <CatalogFlyout />}
      {mode === 'settings' && <SettingsFlyout />}
    </div>
  )
}

function RailButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        border: 'none',
        background: active ? '#171717' : 'transparent',
        color: active ? '#ffffff' : '#525252',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = '#f5f5f5'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
    </button>
  )
}

function AddFlyout() {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 16,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        minWidth: 180,
      }}
    >
      <FlyoutItem kind="chat" label="Chat" icon={<ChatIcon />} />
      <FlyoutItem kind="web" label="Web" icon={<WebIcon />} />
      <FlyoutItem kind="mobile" label="Mobile" icon={<MobileIcon />} />
    </div>
  )
}

function FlyoutItem({
  kind,
  label,
  icon,
}: {
  kind: NodeKind
  label: string
  icon: React.ReactNode
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, kind)
        e.dataTransfer.effectAllowed = 'copy'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 10,
        background: dragging ? '#e5e5e5' : '#f5f5f5',
        cursor: 'grab',
        userSelect: 'none',
        opacity: dragging ? 0.6 : 1,
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!dragging) e.currentTarget.style.background = '#ededed'
      }}
      onMouseLeave={(e) => {
        if (!dragging) e.currentTarget.style.background = '#f5f5f5'
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#525252',
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 14, color: '#171717', fontWeight: 500 }}>{label}</span>
    </div>
  )
}

function CatalogFlyout() {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CATALOG
    return CATALOG.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 16,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        width: 320,
        maxHeight: 'calc(100vh - 160px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 10,
          background: '#f5f5f5',
          border: '1px solid #e5e5e5',
        }}
      >
        <SearchIcon />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 13,
            fontFamily: 'inherit',
            color: '#171717',
            minWidth: 0,
          }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
          overflowY: 'auto',
          minHeight: 0,
          paddingRight: 2,
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ gridColumn: 'span 2', padding: '12px 10px', fontSize: 13, color: '#a3a3a3', textAlign: 'center' }}>
            No components match "{query}"
          </div>
        ) : (
          filtered.map((entry) => <CatalogItem key={entry.name} entry={entry} />)
        )}
      </div>
    </div>
  )
}

const PREVIEW_SCALE = 0.45

function CatalogItem({ entry }: { entry: CatalogEntry }) {
  const [dragging, setDragging] = useState(false)
  const previewMessages = useMemo(() => entry.build() as A2uiMessage[], [entry])

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(COMPONENT_DRAG_MIME, entry.name)
        e.dataTransfer.effectAllowed = 'copy'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 6,
        borderRadius: 10,
        border: '1px solid #e5e5e5',
        background: dragging ? '#f5f5f5' : '#ffffff',
        cursor: 'grab',
        userSelect: 'none',
        opacity: dragging ? 0.7 : 1,
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!dragging) {
          e.currentTarget.style.background = '#fafafa'
          e.currentTarget.style.borderColor = '#d4d4d4'
        }
      }}
      onMouseLeave={(e) => {
        if (!dragging) {
          e.currentTarget.style.background = '#ffffff'
          e.currentTarget.style.borderColor = '#e5e5e5'
        }
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 90,
          background: '#fafafa',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            width: `${(1 / PREVIEW_SCALE) * 100}%`,
          }}
        >
          <A2uiRenderer messages={previewMessages} onAction={() => {}} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <CategoryDot category={entry.category} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#171717',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {entry.name}
        </span>
      </div>
    </div>
  )
}

const CATEGORY_COLORS: Record<CatalogEntry['category'], string> = {
  layout: '#6366f1',
  text: '#0ea5e9',
  input: '#10b981',
  data: '#f59e0b',
  feedback: '#ef4444',
  navigation: '#8b5cf6',
  media: '#ec4899',
}

function CategoryDot({ category }: { category: CatalogEntry['category'] }) {
  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: CATEGORY_COLORS[category],
        flexShrink: 0,
      }}
    />
  )
}

type CatalogSource = 'a2ui' | 'storybook'

function SettingsFlyout() {
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [source, setSource] = useState<CatalogSource>('a2ui')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/catalog/get')
      .then((r) => r.json())
      .then((d) => setCurrentId(d?.catalogId ?? null))
      .catch(() => setCurrentId(null))
  }, [])

  const apply = async (payload: { url?: string; reset?: boolean; storybookUrl?: string }) => {
    setLoading(true)
    setError(null)
    setStatus(null)
    try {
      let r: Response
      if (payload.storybookUrl) {
        r = await fetch('/api/catalog/from-storybook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: payload.storybookUrl }),
        })
      } else {
        r = await fetch('/api/catalog/set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed')
      setCurrentId(d.catalogId ?? null)
      if (d.reset) setStatus('Reset to default catalog')
      else if (d.componentCount) setStatus(`Imported ${d.componentCount} components`)
      else setStatus('Catalog loaded')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 16,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        width: 320,
        maxHeight: 'calc(100vh - 160px)',
        overflowY: 'auto',
      }}
    >
      <ApiKeySection />

      <div style={{ height: 1, background: '#f0f0f0' }} />

      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#171717' }}>Design system</div>
        <div style={{ fontSize: 12, color: '#737373', marginTop: 4, lineHeight: 1.45 }}>
          Swap the catalog the AI uses to generate UI. Paste a URL to an A2UI catalog JSON file.
        </div>
      </div>

      <div
        style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: '#f5f5f5',
          border: '1px solid #e5e5e5',
          fontSize: 12,
          color: '#525252',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          wordBreak: 'break-all',
        }}
      >
        <div style={{ color: '#737373', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
          Active catalog
        </div>
        {currentId ?? '—'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: '#737373', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Source
        </div>
        <div
          style={{
            display: 'inline-flex',
            background: '#f5f5f5',
            border: '1px solid #e5e5e5',
            borderRadius: 999,
            padding: 3,
            alignSelf: 'flex-start',
          }}
        >
          <SourceTab active={source === 'a2ui'} onClick={() => setSource('a2ui')}>
            A2UI catalog
          </SourceTab>
          <SourceTab active={source === 'storybook'} onClick={() => setSource('storybook')}>
            Storybook
          </SourceTab>
        </div>

        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={
            source === 'storybook'
              ? 'https://storybooks.fluentui.dev'
              : 'https://example.com/catalog.json'
          }
          style={{
            border: '1px solid #e5e5e5',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
            color: '#171717',
          }}
        />
        <div style={{ fontSize: 11, color: '#737373', lineHeight: 1.45 }}>
          {source === 'storybook'
            ? 'Scrapes the Storybook root for component names via /index.json. Works with Storybook 6+ deployments.'
            : 'Loads an A2UI catalog JSON file. Must include a top-level catalogId.'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => {
              const u = url.trim()
              if (!u) return
              if (source === 'storybook') apply({ storybookUrl: u })
              else apply({ url: u })
            }}
            disabled={loading || !url.trim()}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: loading || !url.trim() ? '#e5e5e5' : '#171717',
              color: loading || !url.trim() ? '#a3a3a3' : '#ffffff',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: loading || !url.trim() ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Loading…' : source === 'storybook' ? 'Import from Storybook' : 'Load catalog'}
          </button>
          <button
            onClick={() => apply({ reset: true })}
            disabled={loading}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #e5e5e5',
              background: '#ffffff',
              color: '#171717',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {status ? (
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#107c10',
            fontSize: 12,
          }}
        >
          {status}
        </div>
      ) : null}
      {error ? (
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#92400e',
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        <strong>Note:</strong> the renderer ships with Fluent v9 component mappings. The AI will start using the new catalog's component names immediately, but unmapped components will render as "Unknown component" until renderer support is added.
      </div>
    </div>
  )
}

interface KeyStatus {
  hasKey: boolean
  source: 'env' | 'runtime' | 'none'
  envHasKey: boolean
  maskedKey: string | null
}

function ApiKeySection() {
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)

  const refresh = async () => {
    try {
      const r = await fetch('/api/config/status')
      const d = (await r.json()) as KeyStatus
      setStatus(d)
    } catch {
      setStatus(null)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const save = async () => {
    const key = draft.trim()
    if (!key) return
    setSaving(true)
    setError(null)
    setOkMsg(null)
    try {
      const r = await fetch('/api/config/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed to save key')
      setOkMsg('Key saved for this session')
      setDraft('')
      refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    setSaving(true)
    setError(null)
    setOkMsg(null)
    try {
      const r = await fetch('/api/config/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Failed')
      setOkMsg(d.source === 'env' ? 'Restored env key' : 'Cleared key (none active)')
      refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const statusColor =
    status?.source === 'none' ? '#b91c1c' : status?.source === 'env' ? '#107c10' : '#0f6cbd'
  const statusLabel =
    status?.source === 'none'
      ? 'No key set'
      : status?.source === 'env'
      ? `From .env (${status.maskedKey})`
      : 'Set in app (this session)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#171717' }}>AI API key</div>
      <div style={{ fontSize: 12, color: '#737373', lineHeight: 1.45 }}>
        Anthropic API key used for routing and generation. Stored in server memory only — refresh
        the page or restart Vite to drop it.
      </div>

      <div
        style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: '#fafafa',
          border: '1px solid #e5e5e5',
          fontSize: 12,
          color: '#525252',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: statusColor, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{statusLabel}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid #e5e5e5',
            borderRadius: 8,
            paddingRight: 6,
          }}
        >
          <input
            type={reveal ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="sk-ant-api03-…"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              padding: '8px 10px',
              fontSize: 13,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              color: '#171717',
              minWidth: 0,
              background: 'transparent',
            }}
          />
          <button
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Hide' : 'Show'}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#737373',
              cursor: 'pointer',
              fontSize: 11,
              padding: '4px 6px',
              fontFamily: 'inherit',
            }}
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={save}
            disabled={saving || !draft.trim()}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: saving || !draft.trim() ? '#e5e5e5' : '#171717',
              color: saving || !draft.trim() ? '#a3a3a3' : '#ffffff',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: saving || !draft.trim() ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save key'}
          </button>
          <button
            onClick={reset}
            disabled={saving || status?.source !== 'runtime'}
            title="Restore the key from .env (or clear if no env key)"
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #e5e5e5',
              background: '#ffffff',
              color: status?.source === 'runtime' ? '#171717' : '#a3a3a3',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: saving || status?.source !== 'runtime' ? 'default' : 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {okMsg ? (
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#107c10',
            fontSize: 12,
          }}
        >
          {okMsg}
        </div>
      ) : null}
      {error ? (
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  )
}

function SourceTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        borderRadius: 999,
        border: 'none',
        background: active ? '#ffffff' : 'transparent',
        color: active ? '#171717' : '#525252',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {children}
    </button>
  )
}

function SettingsGearIcon() {
  // Proper gear: 8 teeth around a circular hub
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2.07 2.07 0 0 1 0 2.93 2.07 2.07 0 0 1-2.93 0l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2.08 2.08 0 0 1-4.16 0v-.09A1.7 1.7 0 0 0 8.7 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2.07 2.07 0 0 1-2.93 0 2.07 2.07 0 0 1 0-2.93l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H2.5a2.08 2.08 0 0 1 0-4.16h.09a1.7 1.7 0 0 0 1.56-1.03 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2.07 2.07 0 0 1 0-2.93 2.07 2.07 0 0 1 2.93 0l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1.03-1.56V2.5a2.08 2.08 0 0 1 4.16 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2.07 2.07 0 0 1 2.93 0 2.07 2.07 0 0 1 0 2.93l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.56 1.03H21.5a2.08 2.08 0 0 1 0 4.16h-.09a1.7 1.7 0 0 0-1.56 1.03Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  )
}

function AddIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10" y="2" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="10" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 10 L13 16 M10 13 L16 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function CatalogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 4 L9 1.5 L15 4 L9 6.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <path d="M3 9 L9 11.5 L15 9" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <path d="M3 13 L9 15.5 L15 13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="#737373" strokeWidth="1.4" />
      <path d="M9 9 L12 12" stroke="#737373" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="3.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 14 L7 17 L11 14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function WebIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="3.5" width="16" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 17 L13 17 M10 14.5 L10 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function MobileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="5" y="2" width="10" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="15.5" r="0.6" fill="currentColor" />
    </svg>
  )
}
