import { useState } from 'react'
import { SHAPE_PALETTE, type CanvasNodeData, type ShapeType } from './types'

interface ShapeToolbarProps {
  node: CanvasNodeData
  screenX: number
  screenY: number
  onChange: (patch: Partial<CanvasNodeData>) => void
}

// FigJam-style compact dark pill with 3 dropdowns: Shape / Fill / Border.
// Each opens a dark popover. Fill popover has Fill / Transparent / No fill
// tabs + 22 circular color swatches + custom hex. Border popover has Solid /
// Dashed / None tabs + the same color grid.

const PILL_BG = '#ffffff'
const PILL_BORDER = '#e5e5e5'
const POPOVER_BG = '#ffffff'
const POPOVER_BORDER = '#e5e5e5'
const INK = '#171717'
const SUBTLE_INK = '#737373'
const TAB_ACTIVE_BG = '#ede9fe'
const TAB_ACTIVE_INK = '#5b21b6'
const TAB_HOVER_BG = '#f5f5f5'

const SHAPE_TYPES: { value: ShapeType; label: string }[] = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'line', label: 'Line' },
]

type OpenPicker = null | 'shape' | 'fill' | 'border' | 'dims'

export default function ShapeToolbar({ node, screenX, screenY, onChange }: ShapeToolbarProps) {
  const [open, setOpen] = useState<OpenPicker>(null)

  const fill = node.fillColor ?? '#ffffff'
  const stroke = node.strokeColor ?? '#1f2024'
  const strokeW = node.strokeWidth ?? 2
  const strokeStyle = node.strokeStyle ?? 'solid'
  const shapeType = node.shapeType ?? 'rectangle'

  const fillMode: 'fill' | 'transparent' | 'none' =
    fill === 'transparent' || fill === ''
      ? 'none'
      : node.fillOpacity !== undefined && node.fillOpacity < 1
      ? 'transparent'
      : 'fill'

  const borderMode: 'solid' | 'dashed' | 'none' = strokeW === 0 ? 'none' : strokeStyle === 'dashed' ? 'dashed' : 'solid'

  // Stable "effective" color so the Fill button still shows the last picked
  // color even when in Transparent / No-fill mode.
  const effectiveFillColor = fill === 'transparent' || fill === '' ? '#ffffff' : fill

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: screenX,
        top: screenY - 56,
        transform: 'translateX(-50%)',
        background: PILL_BG,
        border: `1px solid ${PILL_BORDER}`,
        borderRadius: 10,
        padding: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        zIndex: 60,
        fontFamily: 'inherit',
      }}
    >
      {/* Shape picker */}
      <PillBtn
        active={open === 'shape'}
        onClick={() => setOpen(open === 'shape' ? null : 'shape')}
        title="Shape"
      >
        <ShapeGlyph shape={shapeType} />
        <Chevron />
      </PillBtn>

      {/* Fill */}
      <PillBtn
        active={open === 'fill'}
        onClick={() => setOpen(open === 'fill' ? null : 'fill')}
        title="Fill"
      >
        <ColorDot color={effectiveFillColor} muted={fillMode === 'none'} />
        <Chevron />
      </PillBtn>

      {/* Border style */}
      <PillBtn
        active={open === 'border'}
        onClick={() => setOpen(open === 'border' ? null : 'border')}
        title="Border"
      >
        <BorderGlyph mode={borderMode} />
        <Chevron />
      </PillBtn>

      {/* Size & position */}
      <PillBtn
        active={open === 'dims'}
        onClick={() => setOpen(open === 'dims' ? null : 'dims')}
        title="Size & position"
      >
        <DimsGlyph />
        <Chevron />
      </PillBtn>

      {open === 'shape' ? (
        <DarkPopover>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, minWidth: 180 }}>
            {SHAPE_TYPES.map((s) => (
              <ShapeTile
                key={s.value}
                shape={s.value}
                label={s.label}
                active={shapeType === s.value}
                onClick={() => {
                  onChange({ shapeType: s.value })
                  setOpen(null)
                }}
              />
            ))}
          </div>
        </DarkPopover>
      ) : null}

      {open === 'fill' ? (
        <DarkPopover>
          <TabRow>
            <Tab
              icon={<TabFillIcon />}
              label="Fill"
              active={fillMode === 'fill'}
              onClick={() =>
                onChange({ fillColor: effectiveFillColor, fillOpacity: 1 })
              }
            />
            <Tab
              icon={<TabTransparentIcon />}
              label="Transparent"
              active={fillMode === 'transparent'}
              onClick={() => onChange({ fillColor: effectiveFillColor, fillOpacity: 0.5 })}
            />
            <Tab
              icon={<TabNoFillIcon />}
              label="No fill"
              active={fillMode === 'none'}
              onClick={() => onChange({ fillColor: 'transparent' })}
            />
          </TabRow>
          <ColorGrid
            current={fill}
            disabled={fillMode === 'none'}
            onPick={(v) => {
              // Picking a color in "No fill" mode re-enables fill at full opacity.
              if (fillMode === 'none') onChange({ fillColor: v, fillOpacity: 1 })
              else onChange({ fillColor: v })
            }}
          />
        </DarkPopover>
      ) : null}

      {open === 'dims' ? (
        <DarkPopover>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
            <SectionLabel>Size</SectionLabel>
            <div style={{ display: 'flex', gap: 6 }}>
              <NumInput
                label="W"
                value={Math.round(node.width ?? 200)}
                onChange={(v) => onChange({ width: Math.max(20, v) })}
              />
              <NumInput
                label="H"
                value={Math.round(node.height ?? 160)}
                onChange={(v) => onChange({ height: Math.max(20, v) })}
              />
            </div>
            <SectionLabel>Position</SectionLabel>
            <div style={{ display: 'flex', gap: 6 }}>
              <NumInput
                label="X"
                value={Math.round(node.x)}
                onChange={(v) => onChange({ x: v })}
              />
              <NumInput
                label="Y"
                value={Math.round(node.y)}
                onChange={(v) => onChange({ y: v })}
              />
            </div>
            {/* Corner radius — primarily meaningful for rectangles, but harmless on others. */}
            {shapeType === 'rectangle' ? (
              <>
                <SectionLabel>Corner radius</SectionLabel>
                <div style={{ display: 'flex', gap: 6 }}>
                  <NumInput
                    label="R"
                    value={Math.round(node.cornerRadius ?? 4)}
                    onChange={(v) => onChange({ cornerRadius: Math.max(0, v) })}
                  />
                </div>
              </>
            ) : null}
          </div>
        </DarkPopover>
      ) : null}

      {open === 'border' ? (
        <DarkPopover>
          <TabRow>
            <Tab
              icon={<TabSolidIcon />}
              label="Solid"
              active={borderMode === 'solid'}
              onClick={() => onChange({ strokeStyle: 'solid', strokeWidth: strokeW > 0 ? strokeW : 2 })}
            />
            <Tab
              icon={<TabDashedIcon />}
              label="Dashed"
              active={borderMode === 'dashed'}
              onClick={() => onChange({ strokeStyle: 'dashed', strokeWidth: strokeW > 0 ? strokeW : 2 })}
            />
            <Tab
              icon={<TabNoneIcon />}
              label="None"
              active={borderMode === 'none'}
              onClick={() => onChange({ strokeWidth: 0 })}
            />
          </TabRow>
          <ColorGrid
            current={stroke}
            disabled={borderMode === 'none'}
            onPick={(v) => {
              if (borderMode === 'none') onChange({ strokeColor: v, strokeWidth: 2 })
              else onChange({ strokeColor: v })
            }}
          />
          <WidthRow
            current={strokeW}
            disabled={borderMode === 'none'}
            onPick={(w) => onChange({ strokeWidth: w })}
          />
        </DarkPopover>
      ) : null}
    </div>
  )
}

// ============================================================================
// Layout primitives
// ============================================================================

function DarkPopover({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: POPOVER_BG,
        border: `1px solid ${POPOVER_BORDER}`,
        borderRadius: 12,
        padding: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)',
        zIndex: 70,
        color: INK,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {children}
    </div>
  )
}

function TabRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: 2 }}>{children}</div>
  )
}

function Tab({
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
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 8,
        border: 'none',
        background: active ? TAB_ACTIVE_BG : hover ? TAB_HOVER_BG : 'transparent',
        color: active ? TAB_ACTIVE_INK : INK,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function PillBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        height: 32,
        borderRadius: 8,
        border: 'none',
        background: active ? TAB_HOVER_BG : hover ? '#fafafa' : 'transparent',
        color: INK,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

// ============================================================================
// Color grid + circular swatches
// ============================================================================

function ColorGrid({
  current,
  disabled,
  onPick,
}: {
  current: string
  disabled?: boolean
  onPick: (v: string) => void
}) {
  // Last cell of the second row is the "custom hex" cell.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: disabled ? 0.4 : 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 6 }}>
        {SHAPE_PALETTE.slice(0, 11).map((c) => (
          <Swatch key={c.value} color={c.value} current={current} onPick={onPick} title={c.label} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 6 }}>
        {SHAPE_PALETTE.slice(11).map((c) => (
          <Swatch key={c.value} color={c.value} current={current} onPick={onPick} title={c.label} />
        ))}
        <CustomHex current={current} onPick={onPick} />
      </div>
    </div>
  )
}

function Swatch({
  color,
  current,
  onPick,
  title,
}: {
  color: string
  current: string
  onPick: (v: string) => void
  title: string
}) {
  const active = color.toLowerCase() === current.toLowerCase()
  // White swatch needs a visible border so it shows on the white bg.
  const isWhite = color.toLowerCase() === '#ffffff'
  return (
    <button
      onClick={() => onPick(color)}
      title={title}
      style={{
        width: 24,
        height: 24,
        borderRadius: 999,
        border: active
          ? '2px solid #7c3aed'
          : isWhite
          ? '1px solid #e5e5e5'
          : 'none',
        outline: active ? '2px solid rgba(124,58,237,0.25)' : 'none',
        outlineOffset: 1,
        background: color,
        cursor: 'pointer',
        padding: 0,
      }}
    />
  )
}

function CustomHex({ current, onPick }: { current: string; onPick: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    let v = draft.trim()
    if (!v) {
      setEditing(false)
      return
    }
    if (!v.startsWith('#')) v = '#' + v
    if (/^#([0-9a-fA-F]{3})$/.test(v)) {
      const m = v.slice(1)
      v = `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`
    }
    if (/^#([0-9a-fA-F]{6})$/.test(v)) {
      onPick(v.toUpperCase())
      setEditing(false)
      setDraft('')
    }
  }

  // Is `current` an off-palette custom color?
  const isPaletteValue =
    SHAPE_PALETTE.some((c) => c.value.toLowerCase() === current.toLowerCase()) ||
    current === 'transparent' ||
    current === ''
  const isCustomActive = !isPaletteValue

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9a-fA-F#]/g, '').slice(0, 7))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setEditing(false)
            setDraft('')
          }
        }}
        placeholder="#RRGGBB"
        spellCheck={false}
        style={{
          gridColumn: 'span 2',
          height: 24,
          borderRadius: 12,
          border: '1px solid #e5e5e5',
          background: '#fafafa',
          color: INK,
          fontSize: 11,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          padding: '0 8px',
          outline: 'none',
          textAlign: 'center',
          textTransform: 'uppercase',
        }}
      />
    )
  }
  return (
    <button
      onClick={() => {
        setEditing(true)
        setDraft(isCustomActive ? current : '')
      }}
      title="Custom hex"
      style={{
        width: 24,
        height: 24,
        borderRadius: 999,
        border: isCustomActive ? '2px solid #7c3aed' : 'none',
        outline: isCustomActive ? '2px solid rgba(124,58,237,0.25)' : 'none',
        outlineOffset: 1,
        background: isCustomActive
          ? current
          : 'conic-gradient(from 0deg, #ef4444, #f97316, #facc15, #22c55e, #14b8a6, #3b82f6, #7c3aed, #ec4899, #ef4444)',
        cursor: 'pointer',
        padding: 0,
      }}
    />
  )
}

// ============================================================================
// Glyphs / icons
// ============================================================================

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2.5 4 L5 6.5 L7.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ColorDot({ color, muted }: { color: string; muted?: boolean }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        background: muted ? 'transparent' : color,
        border: muted
          ? '1.5px dashed #a3a3a3'
          : color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fff'
          ? '1px solid #e5e5e5'
          : 'none',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

function ShapeGlyph({ shape }: { shape: ShapeType }) {
  const stroke = INK
  const sw = 1.5
  if (shape === 'ellipse')
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <ellipse cx="9" cy="9" rx="7" ry="6" stroke={stroke} strokeWidth={sw} fill="none" />
      </svg>
    )
  if (shape === 'triangle')
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <polygon points="9,2 16,15 2,15" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      </svg>
    )
  if (shape === 'diamond')
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <polygon points="9,2 16,9 9,16 2,9" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" fill="none" />
      </svg>
    )
  if (shape === 'arrow')
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <line x1="2" y1="9" x2="14" y2="9" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <polyline points="12,5 16,9 12,13" stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  if (shape === 'line')
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <line x1="2" y1="9" x2="16" y2="9" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    )
  // rectangle (default)
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" stroke={stroke} strokeWidth={sw} fill="none" />
    </svg>
  )
}

function ShapeTile({
  shape,
  label,
  active,
  onClick,
}: {
  shape: ShapeType
  label: string
  active: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        borderRadius: 8,
        border: 'none',
        background: active ? TAB_ACTIVE_BG : hover ? TAB_HOVER_BG : '#fafafa',
        color: active ? TAB_ACTIVE_INK : INK,
        cursor: 'pointer',
      }}
    >
      <ShapeGlyph shape={shape} />
    </button>
  )
}

function BorderGlyph({ mode }: { mode: 'solid' | 'dashed' | 'none' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        width: 18,
        height: 18,
      }}
    >
      {mode === 'none' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke={SUBTLE_INK} strokeWidth="1.4" fill="none" />
          <line x1="3" y1="13" x2="13" y2="3" stroke={SUBTLE_INK} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <>
          <span
            style={{
              width: 14,
              height: 0,
              borderTop: `1.5px ${mode === 'dashed' ? 'dashed' : 'solid'} ${INK}`,
            }}
          />
          <span
            style={{
              width: 14,
              height: 0,
              borderTop: `1.5px ${mode === 'dashed' ? 'dashed' : 'solid'} ${INK}`,
            }}
          />
          <span
            style={{
              width: 14,
              height: 0,
              borderTop: `1.5px ${mode === 'dashed' ? 'dashed' : 'solid'} ${INK}`,
            }}
          />
        </>
      )}
    </span>
  )
}

function TabFillIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.3" />
    </svg>
  )
}

function TabTransparentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeDasharray="2 2" />
    </svg>
  )
}

function TabNoFillIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </svg>
  )
}

function TabSolidIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <line x1="2" y1="11" x2="12" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function TabDashedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <line x1="2" y1="11" x2="12" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 2" />
    </svg>
  )
}

function TabNoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <line x1="3" y1="11" x2="11" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function DimsGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="3.5" y="3.5" width="11" height="11" rx="1.5" stroke={INK} strokeWidth="1.5" fill="none" />
      <line x1="3.5" y1="11" x2="14.5" y2="11" stroke={SUBTLE_INK} strokeWidth="1" strokeDasharray="1 1" />
      <line x1="9" y1="3.5" x2="9" y2="14.5" stroke={SUBTLE_INK} strokeWidth="1" strokeDasharray="1 1" />
    </svg>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: SUBTLE_INK,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  )
}

function NumInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  // Resync external changes when not actively editing
  useDraftSync(draft, setDraft, String(value))
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        border: '1px solid #e5e5e5',
        borderRadius: 8,
        flex: 1,
        background: '#fafafa',
      }}
    >
      <span style={{ fontSize: 11, color: SUBTLE_INK, fontWeight: 600 }}>{label}</span>
      <input
        type="number"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = parseInt(e.target.value, 10)
          if (!Number.isNaN(n)) onChange(n)
        }}
        onBlur={() => {
          const n = parseInt(draft, 10)
          if (Number.isNaN(n)) setDraft(String(value))
        }}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 13,
          fontFamily: 'inherit',
          color: INK,
          minWidth: 0,
        }}
      />
    </div>
  )
}

// Lightweight effect that syncs `draft` back to `external` whenever external
// changes (e.g. user drags the node and we want the popover input to follow).
function useDraftSync(draft: string, setDraft: (v: string) => void, external: string) {
  if (draft !== external && document.activeElement?.tagName !== 'INPUT') {
    queueMicrotask(() => setDraft(external))
  }
}

const BORDER_WIDTHS = [1, 2, 3, 5, 8]

function WidthRow({
  current,
  disabled,
  onPick,
}: {
  current: number
  disabled?: boolean
  onPick: (w: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: disabled ? 0.4 : 1 }}>
      <SectionLabel>Width</SectionLabel>
      <div style={{ display: 'inline-flex', gap: 4 }}>
        {BORDER_WIDTHS.map((w) => {
          const active = w === current && !disabled
          return (
            <button
              key={w}
              onClick={() => !disabled && onPick(w)}
              title={`${w}px`}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 6,
                border: 'none',
                background: active ? TAB_ACTIVE_BG : '#fafafa',
                color: active ? TAB_ACTIVE_INK : INK,
                cursor: disabled ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 600,
                gap: 6,
              }}
            >
              <span style={{ width: 16, height: 0, borderTop: `${w}px solid currentColor` }} />
              <span>{w}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
