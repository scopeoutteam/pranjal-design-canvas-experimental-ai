import { useEffect, useMemo, useState } from 'react'
import A2uiRenderer from './a2ui/Renderer'
import type { A2uiMessage } from './a2ui/types'
import scopeoutLogo from './assets/scopeout-logo-full.svg'

type PreviewKind = 'chat' | 'mobile' | 'web'

interface Decoded {
  kind: PreviewKind
  title: string
  surface: A2uiMessage[]
}

function decodeHash(): Decoded | null {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const kind = (params.get('kind') as PreviewKind) || 'mobile'
  const title = params.get('title') ?? 'Preview'
  const b64 = params.get('surface')
  if (!b64) return null
  try {
    const json = atob(b64)
    const surface = JSON.parse(json) as A2uiMessage[]
    return { kind, title, surface }
  } catch {
    return null
  }
}

const FRAME_SIZES: Record<PreviewKind, { width: number; height: number }> = {
  chat: { width: 380, height: 823 },
  mobile: { width: 380, height: 823 },
  web: { width: 880, height: 550 },
}

export default function PreviewPage() {
  const [decoded, setDecoded] = useState<Decoded | null>(() => decodeHash())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onHashChange = () => setDecoded(decodeHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (decoded?.title) document.title = `${decoded.title} — Preview`
  }, [decoded?.title])

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore
    }
  }

  const size = useMemo(() => FRAME_SIZES[decoded?.kind ?? 'mobile'], [decoded?.kind])

  if (!decoded) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fafafa',
          color: '#737373',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
          fontSize: 14,
        }}
      >
        Empty preview link.
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fafafa',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
        color: '#171717',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 22px',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={scopeoutLogo} alt="Scopeout" height={22} style={{ display: 'block', width: 'auto' }} />
          <span style={{ color: '#e5e5e5' }}>/</span>
          <span style={{ fontSize: 13, color: '#525252' }}>
            {decoded.title} <span style={{ color: '#a3a3a3' }}>· {decoded.kind}</span>
          </span>
        </div>
        <button
          onClick={share}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            borderRadius: 999,
            border: '1px solid #e5e5e5',
            background: '#ffffff',
            color: '#171717',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'background 120ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
        >
          <ShareIcon />
          <span>{copied ? 'Link copied' : 'Share'}</span>
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        <div
          style={{
            width: size.width,
            height: size.height,
            background: '#ffffff',
            border: '1px solid #e5e5e5',
            borderRadius: decoded.kind === 'chat' ? 30 : 0,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'auto',
            padding: decoded.kind === 'chat' ? 24 : 20,
          }}
        >
          <A2uiRenderer messages={decoded.surface} onAction={() => {}} />
        </div>
      </div>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="12" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.8 7 L10.3 4.5 M5.8 9 L10.3 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
