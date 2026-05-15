export type CanvasMode = 'design' | 'prototype'

export default function TopToolbar({
  mode,
  onChange,
}: {
  mode: CanvasMode
  onChange: (m: CanvasMode) => void
}) {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 22,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        background: '#ffffff',
        border: '1px solid #171717',
        borderRadius: 999,
        padding: 3,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <ToggleButton active={mode === 'design'} onClick={() => onChange('design')}>
        Design
      </ToggleButton>
      <ToggleButton active={mode === 'prototype'} onClick={() => onChange('prototype')}>
        Prototype
      </ToggleButton>
    </div>
  )
}

function ToggleButton({
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
        padding: '6px 16px',
        borderRadius: 999,
        border: 'none',
        background: active ? '#171717' : 'transparent',
        color: active ? '#ffffff' : '#171717',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {children}
    </button>
  )
}
