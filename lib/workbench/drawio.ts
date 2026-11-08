import type { DrawioCell } from './types'

/**
 * 模型直出 draw.io XML 的解析 / 清洗 / 序列化 / 预览排版。
 *
 * 安全约定：模型输出的 XML 不会被原样使用。这里按白名单解析出 DrawioCell，
 * 预览和导出的 .drawio 都由 DrawioCell 重新生成，因此 style、value、id 中的
 * 任何非常规内容（脚本、外链、HTML、未知 shape）都不会进入最终产物。
 */

export const MAX_CELLS = 150
export const MAX_XML_LENGTH = 60_000
const PAD = 20
const COORD_LIMIT = 3000
const SIZE_LIMIT = 2400
const MAX_POINTS = 6

/** 常见中文字体名 → 英文名（SVG 与 draw.io 都按英文名识别） */
export const FONT_ALIASES: Record<string, string> = {
  微软雅黑: 'Microsoft YaHei',
  宋体: 'SimSun',
  黑体: 'SimHei',
  楷体: 'KaiTi',
  仿宋: 'FangSong',
  苹方: 'PingFang SC',
  思源黑体: 'Noto Sans SC',
}

const SHAPES = new Set(['rectangle', 'ellipse', 'rhombus', 'cylinder3', 'hexagon', 'parallelogram', 'swimlane', 'text'])
const SHAPE_ALIAS: Record<string, string> = { cylinder: 'cylinder3' }

const COLOR_KEYS = new Set(['fillColor', 'strokeColor', 'fontColor', 'swimlaneFillColor', 'labelBackgroundColor'])
const NUM_RANGES: Record<string, [number, number]> = {
  strokeWidth: [0, 8],
  fontSize: [8, 36],
  arcSize: [0, 50],
  startSize: [16, 80],
  opacity: [0, 100],
  spacingLeft: [0, 60],
  spacingRight: [0, 60],
  spacingTop: [0, 60],
  spacingBottom: [0, 60],
  fontStyle: [0, 7],
}
const FLAG_KEYS = new Set(['rounded', 'dashed', 'shadow', 'curved', 'horizontal', 'endFill', 'startFill'])
const ARROWS = ['classic', 'classicThin', 'block', 'blockThin', 'open', 'oval', 'diamond', 'none']
const ENUM_KEYS: Record<string, string[]> = {
  align: ['left', 'center', 'right'],
  verticalAlign: ['top', 'middle', 'bottom'],
  edgeStyle: ['orthogonalEdgeStyle', 'elbowEdgeStyle'],
  endArrow: ARROWS,
  startArrow: ARROWS,
}

export function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function decodeEntities(s: string) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function safeChar(code: number) {
  return Number.isFinite(code) && code >= 32 && code < 0x10000 ? String.fromCharCode(code) : code === 10 ? '\n' : ''
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) out[m[1]] = decodeEntities(m[2] ?? m[3] ?? '')
  return out
}

function normColor(v: string): string | null {
  const s = v.trim().toLowerCase()
  if (s === 'none') return 'none'
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
  return null
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function num(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** 清洗 style 字符串。返回的 Record 只含白名单键与合法值；shape 键已规范化 */
export function sanitizeStyleString(raw: string, isEdge: boolean, onUnknownShape?: () => void): Record<string, string> {
  const out: Record<string, string> = {}
  for (const token of raw.split(';')) {
    const t = token.trim()
    if (!t) continue
    const eq = t.indexOf('=')
    const key = eq < 0 ? '' : t.slice(0, eq).trim()
    const val = eq < 0 ? '' : t.slice(eq + 1).trim()

    if (eq < 0 || key === 'shape') {
      if (isEdge) continue
      const name = SHAPE_ALIAS[eq < 0 ? t : val] ?? (eq < 0 ? t : val)
      if (SHAPES.has(name)) out.shape = name
      else if (key === 'shape') {
        out.shape = 'rectangle'
        onUnknownShape?.()
      }
      continue
    }
    if (COLOR_KEYS.has(key)) {
      const c = normColor(val)
      if (c) out[key] = c
    } else if (key in NUM_RANGES) {
      const n = Number(val)
      if (Number.isFinite(n)) out[key] = String(clamp(n, NUM_RANGES[key][0], NUM_RANGES[key][1]))
    } else if (FLAG_KEYS.has(key)) {
      if (val === '0' || val === '1') out[key] = val
    } else if (key in ENUM_KEYS) {
      if (ENUM_KEYS[key].includes(val)) out[key] = val
    } else if (key === 'fontFamily') {
      const resolved = FONT_ALIASES[val] ?? val
      if (/^[A-Za-z0-9 \-\u4e00-\u9fa5]{1,40}$/.test(resolved)) out[key] = resolved
    }
  }
  return out
}

function cleanLabel(v: string) {
  const s = v
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
  return decodeEntities(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 120)
}

interface RawCell {
  id: string
  cid: string
  value: string
  style: string
  parent: string
  vertex: boolean
  edge: boolean
  source: string
  target: string
  geo?: { x: number; y: number; w: number; h: number }
  points: { x: number; y: number }[]
  skip: boolean
}

export interface ParsedDrawio {
  cells: DrawioCell[]
  width: number
  height: number
  warnings: string[]
}

/** 从模型回复中取出 mxGraphModel（容忍 markdown 代码块、mxfile/diagram 外壳、前后多余文字） */
export function extractDrawioXml(content: string): string {
  const model = content.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/)
  if (model) return model[0]
  const open = content.indexOf('<mxGraphModel')
  if (open >= 0) return `${content.slice(open)}</root></mxGraphModel>`
  throw new Error('未在模型回复中找到 mxGraphModel')
}

export function parseDrawioXml(input: string): ParsedDrawio {
  if (input.length > MAX_XML_LENGTH) throw new Error('draw.io XML 过长，已拒绝')
  const warnings: string[] = []
  const src = input.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '')

  const raws: RawCell[] = []
  let cur: RawCell | null = null
  let inPoints = false
  const tagRe = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(src))) {
    const [, closing, name, attrStr, selfClose] = m
    if (name === 'mxCell') {
      if (cur) {
        raws.push(cur)
        cur = null
      }
      if (closing) continue
      const a = parseAttrs(attrStr)
      const c: RawCell = {
        id: a.id ?? '',
        cid: '',
        value: a.value ?? '',
        style: a.style ?? '',
        parent: a.parent ?? '1',
        vertex: a.vertex === '1',
        edge: a.edge === '1',
        source: a.source ?? '',
        target: a.target ?? '',
        points: [],
        skip: false,
      }
      if (selfClose) raws.push(c)
      else cur = c
    } else if (name === 'mxGeometry' && cur && !closing) {
      const a = parseAttrs(attrStr)
      cur.geo = { x: num(a.x), y: num(a.y), w: num(a.width), h: num(a.height) }
    } else if (name === 'Array') {
      inPoints = !closing && parseAttrs(attrStr).as === 'points'
    } else if (name === 'mxPoint' && cur && inPoints && !closing && cur.points.length < MAX_POINTS) {
      const a = parseAttrs(attrStr)
      cur.points.push({ x: clamp(num(a.x), -COORD_LIMIT, COORD_LIMIT), y: clamp(num(a.y), -COORD_LIMIT, COORD_LIMIT) })
    }
    if (raws.length > MAX_CELLS * 3) break
  }
  if (cur) raws.push(cur)

  // id 规范化：非法或重复的 id 重新分配，重复定义以第一个为准
  const used = new Set<string>(['0', '1'])
  for (const r of raws) if (/^[A-Za-z0-9_-]{1,40}$/.test(r.id)) used.add(r.id)
  const idMap = new Map<string, string>()
  let seq = 0
  for (const r of raws) {
    if (r.id === '0' || r.id === '1') {
      r.skip = true
      continue
    }
    if (idMap.has(r.id)) {
      r.skip = true
      continue
    }
    let id = r.id
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
      do id = `c${++seq}`
      while (used.has(id))
      used.add(id)
    }
    r.cid = id
    idMap.set(r.id, id)
  }

  let unknownShapes = 0
  const vertices = new Map<string, DrawioCell>()
  const order: string[] = []
  const rawParent = new Map<string, string>()
  let droppedVertices = 0
  for (const r of raws) {
    if (r.skip || !r.vertex) continue
    if (!r.geo || !(r.geo.w > 0) || !(r.geo.h > 0)) {
      droppedVertices++
      continue
    }
    if (vertices.size >= MAX_CELLS) {
      droppedVertices++
      continue
    }
    const style = sanitizeStyleString(r.style, false, () => unknownShapes++)
    style.shape ??= 'rectangle'
    vertices.set(r.cid, {
      id: r.cid,
      kind: 'vertex',
      value: cleanLabel(r.value),
      style,
      parent: '1',
      x: clamp(r.geo.x, -COORD_LIMIT, COORD_LIMIT),
      y: clamp(r.geo.y, -COORD_LIMIT, COORD_LIMIT),
      w: clamp(r.geo.w, 1, SIZE_LIMIT),
      h: clamp(r.geo.h, 1, SIZE_LIMIT),
      ax: 0,
      ay: 0,
    })
    order.push(r.cid)
    rawParent.set(r.cid, r.parent)
  }
  if (vertices.size === 0) throw new Error('XML 中没有可用的图形节点（vertex）')

  // 父子关系：只允许指向已有节点，限制层级深度，杜绝环
  for (const id of order) {
    const p = idMap.get(rawParent.get(id) ?? '')
    if (!p || p === id || !vertices.has(p)) continue
    let depth = 1
    let walk: string | undefined = p
    let ok = true
    while (walk && walk !== '1') {
      if (walk === id || depth > 5) {
        ok = false
        break
      }
      walk = rawParent.get(walk) && idMap.get(rawParent.get(walk)!)
      if (walk && !vertices.has(walk)) walk = undefined
      depth++
    }
    if (ok) vertices.get(id)!.parent = p
  }

  const absMemo = new Map<string, { x: number; y: number }>()
  const abs = (id: string): { x: number; y: number } => {
    const hit = absMemo.get(id)
    if (hit) return hit
    const c = vertices.get(id)!
    const base = c.parent !== '1' ? abs(c.parent) : { x: 0, y: 0 }
    const r = { x: base.x + c.x, y: base.y + c.y }
    absMemo.set(id, r)
    return r
  }
  let minX = Infinity
  let minY = Infinity
  for (const id of order) {
    const a = abs(id)
    minX = Math.min(minX, a.x)
    minY = Math.min(minY, a.y)
  }
  const dx = PAD - minX
  const dy = PAD - minY
  let width = 0
  let height = 0
  for (const id of order) {
    const c = vertices.get(id)!
    const a = abs(id)
    c.ax = Math.round(a.x + dx)
    c.ay = Math.round(a.y + dy)
    if (c.parent === '1') {
      c.x = c.ax
      c.y = c.ay
    }
    c.x = Math.round(c.x)
    c.y = Math.round(c.y)
    c.w = Math.round(c.w)
    c.h = Math.round(c.h)
    width = Math.max(width, c.ax + c.w)
    height = Math.max(height, c.ay + c.h)
  }

  const depthOf = (id: string) => {
    let d = 0
    for (let c = vertices.get(id)!; c.parent !== '1'; c = vertices.get(c.parent)!) d++
    return d
  }
  const sorted = order
    .map((id, i) => ({ id, i, d: depthOf(id) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((o) => vertices.get(o.id)!)

  const edges: DrawioCell[] = []
  let droppedEdges = 0
  for (const r of raws) {
    if (r.skip || !r.edge) continue
    const s = idMap.get(r.source)
    const t = idMap.get(r.target)
    if (!s || !t || !vertices.has(s) || !vertices.has(t) || s === t) {
      droppedEdges++
      continue
    }
    edges.push({
      id: r.cid,
      kind: 'edge',
      value: cleanLabel(r.value),
      style: sanitizeStyleString(r.style, true),
      parent: '1',
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      ax: 0,
      ay: 0,
      source: s,
      target: t,
      points: r.points.map((p) => ({ x: Math.round(p.x + dx), y: Math.round(p.y + dy) })),
    })
  }

  if (unknownShapes) warnings.push(`${unknownShapes} 个节点使用了不支持的图形，已改为矩形`)
  if (droppedVertices) warnings.push(`${droppedVertices} 个节点因尺寸无效或超过 ${MAX_CELLS} 上限被丢弃`)
  if (droppedEdges) warnings.push(`${droppedEdges} 条连线因端点不存在被丢弃`)

  return { cells: [...sorted, ...edges], width: width + PAD, height: height + PAD, warnings }
}

function styleToString(c: DrawioCell) {
  const parts: string[] = []
  const { shape, ...rest } = c.style
  if (c.kind === 'vertex' && shape && shape !== 'rectangle') parts.push(`shape=${shape}`)
  for (const [k, v] of Object.entries(rest)) parts.push(`${k}=${v}`)
  if (!('html' in rest)) parts.push('html=1')
  if (c.kind === 'vertex') parts.push('whiteSpace=wrap')
  return `${parts.join(';')};`
}

function labelToValue(label: string) {
  return escapeXml(label.replace(/\n/g, '<br>'))
}

/** 由清洗后的 cells 重新生成 .drawio 文件内容 */
export function serializeDrawioXml(title: string, cells: DrawioCell[], width: number, height: number, sourceText: string) {
  const out: string[] = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
  for (const c of cells) {
    if (c.kind === 'vertex') {
      out.push(
        `<mxCell id="${c.id}" value="${labelToValue(c.value)}" style="${escapeXml(styleToString(c))}" vertex="1" parent="${c.parent}"><mxGeometry x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" as="geometry"/></mxCell>`,
      )
    } else {
      const pts = c.points?.length
        ? `<Array as="points">${c.points.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('')}</Array>`
        : ''
      out.push(
        `<mxCell id="${c.id}" value="${labelToValue(c.value)}" style="${escapeXml(styleToString(c))}" edge="1" parent="1" source="${c.source}" target="${c.target}"><mxGeometry relative="1" as="geometry">${pts}</mxGeometry></mxCell>`,
      )
    }
  }
  return `<mxfile host="presales-workbench" agent="Tool02-AI"><diagram id="d-${Date.now()}" name="${escapeXml(title)}"><mxGraphModel grid="1" gridSize="10" page="1" pageWidth="${width}" pageHeight="${height}" sourceText="${escapeXml(sourceText.slice(0, 200))}"><root>${out.join('')}</root></mxGraphModel></diagram></mxfile>`
}

// ───────────── 预览排版辅助（纯函数，供 SVG 渲染使用） ─────────────

export function charWidth(ch: string, fontSize: number) {
  const code = ch.charCodeAt(0)
  if (code > 255) return fontSize
  if (ch === ' ') return fontSize * 0.3
  if (/[A-Z0-9MW@%]/.test(ch)) return fontSize * 0.66
  return fontSize * 0.54
}

/** 按像素宽度折行，保留显式换行；超出 maxLines 时末行以省略号结尾 */
export function wrapText(label: string, maxWidth: number, fontSize: number, maxLines: number) {
  const lines: string[] = []
  for (const para of label.split('\n')) {
    let line = ''
    let w = 0
    for (const ch of para) {
      const cw = charWidth(ch, fontSize)
      if (w + cw > maxWidth && line) {
        lines.push(line)
        line = ''
        w = 0
      }
      line += ch
      w += cw
    }
    lines.push(line)
  }
  const truncated = lines.length > maxLines
  const shown = lines.slice(0, Math.max(1, maxLines))
  if (truncated) shown[shown.length - 1] = `${shown[shown.length - 1].slice(0, -1)}…`
  return { lines: shown, truncated }
}

export function lineCapacity(h: number, fontSize: number) {
  return Math.max(1, Math.floor((h - 6) / (fontSize * 1.3)))
}

type P = { x: number; y: number }

/** 从形状中心朝 (tx,ty) 方向射线与形状边界的交点 */
function clip(c: DrawioCell, tx: number, ty: number): P {
  const cx = c.ax + c.w / 2
  const cy = c.ay + c.h / 2
  const dx = tx - cx
  const dy = ty - cy
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return { x: cx, y: cy }
  const hw = c.w / 2
  const hh = c.h / 2
  let t: number
  switch (c.style.shape) {
    case 'ellipse':
      t = 1 / Math.sqrt((dx / hw) ** 2 + (dy / hh) ** 2)
      break
    case 'rhombus':
      t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh)
      break
    default:
      t = Math.min(Math.abs(dx) > 0.01 ? hw / Math.abs(dx) : Infinity, Math.abs(dy) > 0.01 ? hh / Math.abs(dy) : Infinity)
  }
  return { x: cx + dx * t, y: cy + dy * t }
}

export function routeEdge(edge: DrawioCell, byId: Map<string, DrawioCell>): { d: string; mid: P } | null {
  const s = byId.get(edge.source ?? '')
  const t = byId.get(edge.target ?? '')
  if (!s || !t) return null
  const sc = { x: s.ax + s.w / 2, y: s.ay + s.h / 2 }
  const tc = { x: t.ax + t.w / 2, y: t.ay + t.h / 2 }
  let pts: P[]
  if (edge.points?.length) {
    const first = edge.points[0]
    const last = edge.points[edge.points.length - 1]
    pts = [clip(s, first.x, first.y), ...edge.points, clip(t, last.x, last.y)]
  } else {
    const dx = tc.x - sc.x
    const dy = tc.y - sc.y
    if (edge.style.edgeStyle && Math.abs(dx) > 6 && Math.abs(dy) > 6) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        const p1 = clip(s, sc.x + dx, sc.y)
        const p4 = clip(t, tc.x - dx, tc.y)
        const midX = (p1.x + p4.x) / 2
        pts = [p1, { x: midX, y: sc.y }, { x: midX, y: tc.y }, p4]
      } else {
        const p1 = clip(s, sc.x, sc.y + dy)
        const p4 = clip(t, tc.x, tc.y - dy)
        const midY = (p1.y + p4.y) / 2
        pts = [p1, { x: sc.x, y: midY }, { x: tc.x, y: midY }, p4]
      }
    } else {
      pts = [clip(s, tc.x, tc.y), clip(t, sc.x, sc.y)]
    }
  }
  const r = (n: number) => Math.round(n * 10) / 10
  const d = `M${pts.map((p) => `${r(p.x)},${r(p.y)}`).join(' L')}`
  let total = 0
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  let run = 0
  let mid = pts[0]
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    if (run + seg >= total / 2) {
      const k = seg === 0 ? 0 : (total / 2 - run) / seg
      mid = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k }
      break
    }
    run += seg
  }
  return { d, mid }
}
