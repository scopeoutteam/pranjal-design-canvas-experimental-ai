import { useEffect, useRef, useState } from 'react'
import type { DataConnection } from './types'

export default function ConnectDataModal({
  open,
  initial,
  frameTitle,
  onSave,
  onDisconnect,
  onClose,
}: {
  open: boolean
  initial?: DataConnection | null
  frameTitle?: string
  onSave: (conn: DataConnection) => void
  onDisconnect?: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'api' | 'mcp'>(initial?.kind === 'mcp' ? 'mcp' : 'api')
  const [apiEndpoint, setApiEndpoint] = useState(initial?.kind === 'api' ? initial.endpoint : '')
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST'>(
    initial?.kind === 'api' ? initial.method ?? 'GET' : 'GET',
  )
  const [apiAuth, setApiAuth] = useState(initial?.kind === 'api' ? initial.authHeader ?? '' : '')
  const [apiNotes, setApiNotes] = useState(initial?.kind === 'api' ? initial.notes ?? '' : '')

  const [mcpUrl, setMcpUrl] = useState(initial?.kind === 'mcp' ? initial.serverUrl : '')
  const [mcpName, setMcpName] = useState(initial?.kind === 'mcp' ? initial.serverName ?? '' : '')
  const [mcpTool, setMcpTool] = useState(initial?.kind === 'mcp' ? initial.tool ?? '' : '')
  const [mcpNotes, setMcpNotes] = useState(initial?.kind === 'mcp' ? initial.notes ?? '' : '')

  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // Reset to initial values when (re)opening
      setTab(initial?.kind === 'mcp' ? 'mcp' : 'api')
      setApiEndpoint(initial?.kind === 'api' ? initial.endpoint : '')
      setApiMethod(initial?.kind === 'api' ? initial.method ?? 'GET' : 'GET')
      setApiAuth(initial?.kind === 'api' ? initial.authHeader ?? '' : '')
      setApiNotes(initial?.kind === 'api' ? initial.notes ?? '' : '')
      setMcpUrl(initial?.kind === 'mcp' ? initial.serverUrl : '')
      setMcpName(initial?.kind === 'mcp' ? initial.serverName ?? '' : '')
      setMcpTool(initial?.kind === 'mcp' ? initial.tool ?? '' : '')
      setMcpNotes(initial?.kind === 'mcp' ? initial.notes ?? '' : '')
      requestAnimationFrame(() => firstFieldRef.current?.focus())
    }
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSave =
    tab === 'api' ? apiEndpoint.trim().length > 0 : mcpUrl.trim().length > 0

  const handleSave = () => {
    if (tab === 'api') {
      if (!apiEndpoint.trim()) return
      onSave({
        kind: 'api',
        endpoint: apiEndpoint.trim(),
        method: apiMethod,
        authHeader: apiAuth.trim() || undefined,
        notes: apiNotes.trim() || undefined,
      })
    } else {
      if (!mcpUrl.trim()) return
      onSave({
        kind: 'mcp',
        serverUrl: mcpUrl.trim(),
        serverName: mcpName.trim() || undefined,
        tool: mcpTool.trim() || undefined,
        notes: mcpNotes.trim() || undefined,
      })
    }
  }

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.32)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: 'calc(100vw - 40px)',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.06)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#171717' }}>
            Connect to real data
          </div>
          <div style={{ fontSize: 13, color: '#737373' }}>
            {frameTitle ? (
              <>
                Hook <span style={{ color: '#525252', fontWeight: 500 }}>{frameTitle}</span> up
                to an API endpoint or an MCP server so it renders live data instead of mocks.
              </>
            ) : (
              'Hook this frame up to an API endpoint or an MCP server.'
            )}
          </div>
        </div>

        <div
          style={{
            display: 'inline-flex',
            padding: 3,
            background: '#f5f5f5',
            borderRadius: 999,
            gap: 2,
            alignSelf: 'flex-start',
          }}
        >
          <TabButton active={tab === 'api'} onClick={() => setTab('api')} label="API endpoint" />
          <TabButton active={tab === 'mcp'} onClick={() => setTab('mcp')} label="MCP server" />
        </div>

        {tab === 'api' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Endpoint URL">
              <input
                ref={firstFieldRef}
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://api.example.com/v1/metrics"
                style={inputStyle}
              />
            </Field>
            <Field label="Method">
              <div style={{ display: 'inline-flex', gap: 6 }}>
                {(['GET', 'POST'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setApiMethod(m)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      border: `1px solid ${apiMethod === m ? '#4A46BE' : '#e5e5e5'}`,
                      background: apiMethod === m ? '#eef0ff' : '#ffffff',
                      color: apiMethod === m ? '#4A46BE' : '#525252',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Authorization header (optional)">
              <input
                value={apiAuth}
                onChange={(e) => setApiAuth(e.target.value)}
                placeholder="Bearer sk_live_…"
                type="password"
                style={inputStyle}
              />
            </Field>
            <Field label="Notes for Scout (optional)">
              <textarea
                value={apiNotes}
                onChange={(e) => setApiNotes(e.target.value)}
                placeholder="e.g. Response shape: { rows: [{ name, mrr, plan }] }"
                rows={2}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="MCP server URL">
              <input
                ref={firstFieldRef}
                value={mcpUrl}
                onChange={(e) => setMcpUrl(e.target.value)}
                placeholder="https://mcp.example.com or stdio://path/to/server"
                style={inputStyle}
              />
            </Field>
            <Field label="Server name (optional)">
              <input
                value={mcpName}
                onChange={(e) => setMcpName(e.target.value)}
                placeholder="postgres-prod"
                style={inputStyle}
              />
            </Field>
            <Field label="Tool to call (optional)">
              <input
                value={mcpTool}
                onChange={(e) => setMcpTool(e.target.value)}
                placeholder="query_metrics"
                style={inputStyle}
              />
            </Field>
            <Field label="Notes for Scout (optional)">
              <textarea
                value={mcpNotes}
                onChange={(e) => setMcpNotes(e.target.value)}
                placeholder="What does this server expose?"
                rows={2}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 4,
          }}
        >
          <div>
            {initial && onDisconnect ? (
              <button
                type="button"
                onClick={onDisconnect}
                style={{
                  fontSize: 13,
                  color: '#b10e1c',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  fontFamily: 'inherit',
                }}
              >
                Disconnect
              </button>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #e5e5e5',
                background: '#ffffff',
                color: '#525252',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: canSave
                  ? 'linear-gradient(90deg, #4A46BE 0%, #5CBCC1 100%)'
                  : '#e5e5e5',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                cursor: canSave ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              {initial ? 'Save changes' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: 'none',
        background: active ? '#ffffff' : 'transparent',
        color: active ? '#171717' : '#737373',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#525252' }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #e5e5e5',
  background: '#ffffff',
  color: '#171717',
  outline: 'none',
  fontFamily: 'inherit',
}
