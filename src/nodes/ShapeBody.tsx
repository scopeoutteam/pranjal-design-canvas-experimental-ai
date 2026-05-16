import type { ShapeType } from '../types'

const DEFAULT_STROKE = '#171717'
const DEFAULT_FILL = '#ffffff'
const DEFAULT_STROKE_W = 2

function dashArray(style: 'solid' | 'dashed' | 'dotted' | undefined, w: number): string | undefined {
  if (!style || style === 'solid') return undefined
  if (style === 'dashed') return `${w * 3} ${w * 2}`
  // dotted
  return `${w} ${w * 2}`
}

export default function ShapeBody({
  shape,
  width,
  height,
  text,
  arrowStart,
  arrowEnd,
  fillColor,
  strokeColor,
  strokeWidth,
  strokeStyle,
  fillOpacity,
  cornerRadius,
}: {
  shape: ShapeType
  width: number
  height: number
  text?: string
  arrowStart?: { x: number; y: number }
  arrowEnd?: { x: number; y: number }
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: 'solid' | 'dashed' | 'dotted'
  fillOpacity?: number
  cornerRadius?: number
}) {
  const RADIUS = cornerRadius ?? 4
  const STROKE = strokeColor || DEFAULT_STROKE
  const FILL = fillColor === undefined ? DEFAULT_FILL : fillColor === 'transparent' || fillColor === '' ? 'transparent' : fillColor
  const FILL_OPACITY = fillOpacity ?? 1
  const STROKE_W = strokeWidth ?? DEFAULT_STROKE_W
  const dash = dashArray(strokeStyle, STROKE_W)
  // When border width is 0, render no stroke at all.
  const showStroke = STROKE_W > 0 && STROKE !== 'transparent'
  const strokeProps: React.SVGProps<SVGElement> = showStroke
    ? { stroke: STROKE, strokeWidth: STROKE_W, ...(dash ? { strokeDasharray: dash } : {}) }
    : { stroke: 'none' }

  const inset = STROKE_W / 2
  const w = Math.max(1, width - STROKE_W)
  const h = Math.max(1, height - STROKE_W)

  return (
    <div style={{ position: 'relative', width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', position: 'absolute', inset: 0 }}
      >
        {shape === 'rectangle' && (
          <rect x={inset} y={inset} width={w} height={h} fill={FILL} fillOpacity={FILL_OPACITY} {...(strokeProps as React.SVGProps<SVGRectElement>)} rx={RADIUS} />
        )}
        {shape === 'ellipse' && (
          <ellipse cx={width / 2} cy={height / 2} rx={w / 2} ry={h / 2} fill={FILL} fillOpacity={FILL_OPACITY} {...(strokeProps as React.SVGProps<SVGEllipseElement>)} />
        )}
        {shape === 'triangle' && (
          <polygon
            points={`${width / 2},${inset} ${width - inset},${height - inset} ${inset},${height - inset}`}
            fill={FILL} fillOpacity={FILL_OPACITY}
            {...(strokeProps as React.SVGProps<SVGPolygonElement>)}
            strokeLinejoin="round"
          />
        )}
        {shape === 'diamond' && (
          <polygon
            points={`${width / 2},${inset} ${width - inset},${height / 2} ${width / 2},${height - inset} ${inset},${height / 2}`}
            fill={FILL} fillOpacity={FILL_OPACITY}
            {...(strokeProps as React.SVGProps<SVGPolygonElement>)}
            strokeLinejoin="round"
          />
        )}
        {shape === 'arrow' && (() => {
          const sx = arrowStart?.x ?? inset
          const sy = arrowStart?.y ?? height / 2
          const ex = arrowEnd?.x ?? width - inset
          const ey = arrowEnd?.y ?? height / 2
          const dx = ex - sx
          const dy = ey - sy
          const len = Math.max(1, Math.hypot(dx, dy))
          const headSize = Math.min(14, len / 3)
          const ux = dx / len
          const uy = dy / len
          const baseX = ex - ux * headSize
          const baseY = ey - uy * headSize
          const px = -uy
          const py = ux
          const headHalf = headSize / 2
          return (
            <g fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" {...(dash ? { strokeDasharray: dash } : {})}>
              <line x1={sx} y1={sy} x2={baseX} y2={baseY} />
              <polyline
                points={`${baseX + px * headHalf},${baseY + py * headHalf} ${ex},${ey} ${baseX - px * headHalf},${baseY - py * headHalf}`}
              />
            </g>
          )
        })()}
        {shape === 'line' && (() => {
          const sx = arrowStart?.x ?? inset
          const sy = arrowStart?.y ?? height / 2
          const ex = arrowEnd?.x ?? width - inset
          const ey = arrowEnd?.y ?? height / 2
          return (
            <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={STROKE} strokeWidth={STROKE_W} strokeLinecap="round" {...(dash ? { strokeDasharray: dash } : {})} />
          )
        })()}
      </svg>
      {text && shape !== 'arrow' && shape !== 'line' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: shape === 'diamond' ? '12% 18%' : 12,
            pointerEvents: 'none',
            color: '#171717',
            fontSize: 13,
            lineHeight: 1.3,
            fontWeight: 500,
            textAlign: 'center',
            wordBreak: 'break-word',
            boxSizing: 'border-box',
          }}
        >
          {text}
        </div>
      )}
    </div>
  )
}
