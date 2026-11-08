import { forwardRef } from 'react'
import { DIAGRAM_PALETTE as P, fontStack, nodeAccent, nodePerLine, resolveStyle, wrapLabel } from '@/lib/workbench/diagram'
import { lineCapacity, routeEdge, wrapText } from '@/lib/workbench/drawio'
import type { Diagram, DrawioCell } from '@/lib/workbench/types'

function edgePath(diagram: Diagram, sourceId: string, targetId: string) {
  const s = diagram.nodes.find((n) => n.id === sourceId)
  const t = diagram.nodes.find((n) => n.id === targetId)
  if (!s || !t) return ''
  if (Math.abs(s.y - t.y) < 1) {
    const forward = t.x > s.x
    const x1 = forward ? s.x + s.w : s.x
    const x2 = forward ? t.x : t.x + t.w
    const y = s.y + s.h / 2
    return `M${x1},${y} L${x2},${y}`
  }
  const x1 = s.x + s.w / 2
  const y1 = s.y + s.h
  const x2 = t.x + t.w / 2
  const y2 = t.y
  const midY = (y1 + y2) / 2
  return `M${x1},${y1} L${x1},${midY} L${x2},${midY} L${x2},${y2}`
}

const DEFAULT_FONT = "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif"

function shapePath(c: DrawioCell): { tag: 'rect' | 'ellipse' | 'path'; props: Record<string, number | string> } {
  const { ax: x, ay: y, w, h } = c
  switch (c.style.shape) {
    case 'ellipse':
      return { tag: 'ellipse', props: { cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 } }
    case 'rhombus':
      return { tag: 'path', props: { d: `M${x + w / 2},${y} L${x + w},${y + h / 2} L${x + w / 2},${y + h} L${x},${y + h / 2} Z` } }
    case 'hexagon': {
      const k = Math.min(w * 0.25, h * 0.5)
      return { tag: 'path', props: { d: `M${x + k},${y} L${x + w - k},${y} L${x + w},${y + h / 2} L${x + w - k},${y + h} L${x + k},${y + h} L${x},${y + h / 2} Z` } }
    }
    case 'parallelogram': {
      const k = Math.min(w * 0.2, 30)
      return { tag: 'path', props: { d: `M${x + k},${y} L${x + w},${y} L${x + w - k},${y + h} L${x},${y + h} Z` } }
    }
    case 'cylinder3': {
      const ry = Math.min(h * 0.18, 14)
      return {
        tag: 'path',
        props: {
          d: `M${x},${y + ry} A${w / 2},${ry} 0 0 1 ${x + w},${y + ry} L${x + w},${y + h - ry} A${w / 2},${ry} 0 0 1 ${x},${y + h - ry} Z`,
        },
      }
    }
    default: {
      const rounded = c.style.rounded === '1'
      const arc = rounded ? Math.min(Number(c.style.arcSize ?? 12) / 100, 0.5) * Math.min(w, h) : 0
      return { tag: 'rect', props: { x, y, width: w, height: h, rx: arc, ry: arc } }
    }
  }
}

function CellsSvg({ diagram, className, svgRef }: { diagram: Diagram; className?: string; svgRef: React.Ref<SVGSVGElement> }) {
  const cells = diagram.cells ?? []
  const vertices = cells.filter((c) => c.kind === 'vertex')
  const edges = cells.filter((c) => c.kind === 'edge')
  const byId = new Map(vertices.map((v) => [v.id, v]))
  const arrow = `arrow-${diagram.id}`

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${diagram.width} ${diagram.height}`}
      width={diagram.width}
      height={diagram.height}
      className={className}
      role="img"
      aria-label={diagram.title}
      fontFamily={DEFAULT_FONT}
    >
      <defs>
        {/* 每种连线颜色一个箭头标记，箭头颜色与线一致 */}
        {[...new Set(edges.map((e) => e.style.strokeColor ?? '#4a5d7a'))].map((color) => (
          <marker
            key={color}
            id={`${arrow}-${color.replace('#', '')}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={color} />
          </marker>
        ))}
        <filter id={`shadow-${diagram.id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
        </filter>
      </defs>
      <rect width={diagram.width} height={diagram.height} fill="#ffffff" />

      {vertices.map((c) => {
        const s = c.style
        const shape = s.shape
        const fontSize = Number(s.fontSize ?? 12)
        const fontStyle = Number(s.fontStyle ?? 0)
        const family = s.fontFamily ? `'${s.fontFamily}', ${DEFAULT_FONT}` : undefined
        const textColor = s.fontColor ?? '#1e2a3b'
        const stroke = s.strokeColor ?? '#8aa1c8'
        const strokeW = Number(s.strokeWidth ?? 1)
        const common = {
          stroke: stroke === 'none' ? 'none' : stroke,
          strokeWidth: strokeW,
          strokeDasharray: s.dashed === '1' ? '6 4' : undefined,
          opacity: s.opacity ? Number(s.opacity) / 100 : undefined,
          filter: s.shadow === '1' ? `url(#shadow-${diagram.id})` : undefined,
        }
        const textProps = {
          fontSize,
          fontWeight: fontStyle & 1 ? 700 : 500,
          fontStyle: fontStyle & 2 ? ('italic' as const) : undefined,
          textDecoration: fontStyle & 4 ? 'underline' : undefined,
          fill: textColor,
          fontFamily: family,
        }

        if (shape === 'swimlane') {
          const horizontal = s.horizontal !== '0'
          const head = Number(s.startSize ?? 28)
          const bodyFill = s.swimlaneFillColor ?? 'none'
          const headFill = s.fillColor ?? '#e8eef8'
          const label = wrapText(c.value, horizontal ? c.w - 16 : head - 6, fontSize, horizontal ? 1 : Math.floor(c.h / (fontSize * 1.3)))
          return (
            <g key={c.id}>
              <rect x={c.ax} y={c.ay} width={c.w} height={c.h} fill={bodyFill} {...common} />
              {horizontal ? (
                <rect x={c.ax} y={c.ay} width={c.w} height={head} fill={headFill} {...common} />
              ) : (
                <rect x={c.ax} y={c.ay} width={head} height={c.h} fill={headFill} {...common} />
              )}
              {horizontal ? (
                <text x={c.ax + c.w / 2} y={c.ay + head / 2} textAnchor="middle" dominantBaseline="middle" {...textProps} fontWeight={700}>
                  {label.lines[0]}
                </text>
              ) : (
                <text
                  x={c.ax + head / 2}
                  y={c.ay + c.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(-90 ${c.ax + head / 2} ${c.ay + c.h / 2})`}
                  {...textProps}
                  fontWeight={700}
                >
                  {wrapText(c.value, c.h - 12, fontSize, 1).lines[0]}
                </text>
              )}
            </g>
          )
        }

        const fill = s.fillColor ?? (shape === 'text' ? 'none' : '#ffffff')
        const geo = shapePath(c)
        const cap = lineCapacity(c.h, fontSize)
        const inset = shape === 'rhombus' ? 0.5 : shape === 'ellipse' ? 0.75 : 1
        const { lines } = wrapText(c.value, (c.w - 14) * inset, fontSize, cap)
        const lineH = fontSize * 1.3
        const align = s.align ?? 'center'
        const tx = align === 'left' ? c.ax + 8 : align === 'right' ? c.ax + c.w - 8 : c.ax + c.w / 2
        const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle'
        const vAlign = s.verticalAlign ?? 'middle'
        const blockH = lines.length * lineH
        const top = vAlign === 'top' ? c.ay + 6 : vAlign === 'bottom' ? c.ay + c.h - 6 - blockH : c.ay + (c.h - blockH) / 2
        const noStroke = shape === 'text' && !s.strokeColor
        const Tag = geo.tag as 'rect'

        return (
          <g key={c.id}>
            <Tag {...(geo.props as Record<string, number>)} fill={fill === 'none' ? 'none' : fill} {...common} stroke={noStroke ? 'none' : common.stroke} />
            {shape === 'cylinder3' && (
              <ellipse cx={c.ax + c.w / 2} cy={c.ay + Math.min(c.h * 0.18, 14)} rx={c.w / 2} ry={Math.min(c.h * 0.18, 14)} fill="none" {...common} />
            )}
            {lines.map((line, i) => (
              <text
                key={i}
                x={tx}
                y={top + i * lineH + lineH / 2}
                textAnchor={anchor}
                dominantBaseline="middle"
                {...textProps}
              >
                {line}
              </text>
            ))}
          </g>
        )
      })}

      {edges.map((e) => {
        const route = routeEdge(e, byId)
        if (!route) return null
        const color = e.style.strokeColor ?? '#4a5d7a'
        const endArrow = e.style.endArrow !== 'none'
        const fontSize = Number(e.style.fontSize ?? 11)
        return (
          <g key={e.id}>
            <path
              d={route.d}
              fill="none"
              stroke={color}
              strokeWidth={Number(e.style.strokeWidth ?? 1.6)}
              strokeDasharray={e.style.dashed === '1' ? '6 4' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={endArrow ? `url(#${arrow}-${color.replace('#', '')})` : undefined}
              opacity={0.85}
            />
            {e.value && (
              <text
                x={route.mid.x}
                y={route.mid.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fill={e.style.fontColor ?? '#1e2a3b'}
                stroke="#ffffff"
                strokeWidth={4}
                paintOrder="stroke"
                fontFamily={e.style.fontFamily ? `'${e.style.fontFamily}', ${DEFAULT_FONT}` : undefined}
              >
                {e.value.split('\n')[0]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export const DiagramSvg = forwardRef<SVGSVGElement, { diagram: Diagram; className?: string }>(
  function DiagramSvg({ diagram, className }, ref) {
    if (diagram.cells) return <CellsSvg diagram={diagram} className={className} svgRef={ref} />

    const style = resolveStyle(diagram.style)
    const lineH = Math.round(style.fontSize * 1.35)

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${diagram.width} ${diagram.height}`}
        width={diagram.width}
        height={diagram.height}
        className={className}
        role="img"
        aria-label={diagram.title}
        fontFamily={fontStack(style)}
      >
        <defs>
          {/* 箭头标记 */}
          <marker id={`arrow-${diagram.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={style.edgeColor} />
          </marker>

          {/* 阴影滤镜 */}
          <filter id={`shadow-${diagram.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
          </filter>
        </defs>

        <rect width={diagram.width} height={diagram.height} fill="#ffffff" />

        {/* 层级背景 */}
        {diagram.groups.map((g, i) => {
          const fill = style.groupFill ?? P.bandFills[i % P.bandFills.length]
          return (
            <g key={g.id}>
              <rect
                x={g.x}
                y={g.y}
                width={g.w}
                height={g.h}
                rx={8}
                fill={fill}
                stroke={P.stroke}
                strokeWidth={1}
                opacity={0.8}
                filter={`url(#shadow-${diagram.id})`}
              />
              <text
                x={g.x + 14}
                y={g.y + g.h / 2}
                dominantBaseline="middle"
                fontSize={style.fontSize + 1}
                fontWeight={700}
                fill={style.groupText}
              >
                {g.label}
              </text>
            </g>
          )
        })}

        {/* 连接线 */}
        {diagram.edges.map((e) => (
          <path
            key={e.id}
            d={edgePath(diagram, e.source, e.target)}
            fill="none"
            stroke={style.edgeColor}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={`url(#arrow-${diagram.id})`}
            opacity={0.7}
          />
        ))}

        {/* 节点 */}
        {diagram.nodes.map((n, nodeIdx) => {
          const { lines } = wrapLabel(n.label, nodePerLine(n.w, style.fontSize))
          const startY = n.y + n.h / 2 - ((lines.length - 1) * lineH) / 2
          const accent = nodeAccent(style, nodeIdx)

          return (
            <g key={n.id} filter={`url(#shadow-${diagram.id})`}>
              <rect
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={10}
                fill={style.nodeFill}
                stroke={accent.stroke}
                strokeWidth={1.8}
              />

              {/* 顶部装饰条：仅在使用默认彩色强调时绘制 */}
              {accent.bar && <rect x={n.x} y={n.y} width={n.w} height={3} rx={10} fill={accent.stroke} opacity={0.7} />}

              {lines.map((line, i) => (
                <text
                  key={i}
                  x={n.x + n.w / 2}
                  y={startY + i * lineH}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={style.fontSize}
                  fontWeight={500}
                  fill={style.nodeText}
                >
                  {line}
                </text>
              ))}
            </g>
          )
        })}
      </svg>
    )
  },
)
