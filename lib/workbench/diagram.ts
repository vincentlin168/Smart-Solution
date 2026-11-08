import { FONT_ALIASES, lineCapacity, serializeDrawioXml, wrapText, type ParsedDrawio } from './drawio'
import type {
  Diagram,
  DiagramDirection,
  DiagramEdge,
  DiagramGroup,
  DiagramKind,
  DiagramNode,
  DiagramStyle,
} from './types'

export const DIAGRAM_PALETTE = {
  ink: '#1e2a3b',
  primary: '#2f5597',
  bandFills: ['#e8eef8', '#dfe7f4', '#d6e0f0', '#cdd9ec', '#c4d2e8', '#bccbe4'],
  node: '#ffffff',
  stroke: '#8aa1c8',
  edge: '#4a5d7a',
  // 新增：现代配色和渐变
  gradients: [
    { from: '#6366f1', to: '#ec4899' }, // Indigo → Pink
    { from: '#3b82f6', to: '#06b6d4' }, // Blue → Cyan
    { from: '#10b981', to: '#14b8a6' }, // Emerald → Teal
    { from: '#f59e0b', to: '#f97316' }, // Amber → Orange
    { from: '#8b5cf6', to: '#6366f1' }, // Violet → Indigo
  ],
  moderns: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
}

export const DEFAULT_STYLE: DiagramStyle = {
  nodeFill: '#ffffff',
  nodeText: DIAGRAM_PALETTE.ink,
  nodeStroke: null,
  edgeColor: DIAGRAM_PALETTE.edge,
  groupFill: null,
  groupText: DIAGRAM_PALETTE.ink,
  fontFamily: null,
  fontSize: 12,
}

function normalizeHex(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase()
  return null
}

/**
 * 校验模型返回的样式：只保留合法字段。
 * 颜色必须是 #RGB/#RRGGBB，字体名只允许字母数字空格连字符与汉字，
 * 这些值会写入 SVG 属性和 draw.io style 字符串，不合法的一律丢弃，防止注入。
 */
export function sanitizeStyle(raw: unknown): Partial<DiagramStyle> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: Partial<DiagramStyle> = {}
  for (const key of ['nodeFill', 'nodeText', 'edgeColor', 'groupText'] as const) {
    const c = normalizeHex(r[key])
    if (c) out[key] = c
  }
  for (const key of ['nodeStroke', 'groupFill'] as const) {
    const c = normalizeHex(r[key])
    if (c) out[key] = c
  }
  if (typeof r.fontFamily === 'string') {
    const name = r.fontFamily.trim()
    const resolved = FONT_ALIASES[name] ?? name
    if (/^[A-Za-z0-9 \-\u4e00-\u9fa5]{1,40}$/.test(resolved)) out.fontFamily = resolved
  }
  const size = Number(r.fontSize)
  if (Number.isFinite(size) && size >= 8 && size <= 24) out.fontSize = Math.round(size)
  return out
}

export function resolveStyle(partial?: Partial<DiagramStyle> | null): DiagramStyle {
  return { ...DEFAULT_STYLE, ...(partial ?? {}) }
}

/** 节点描边与顶部装饰条：自定义底色或描边色时用纯色，不再按序套用彩色强调色 */
export function nodeAccent(style: DiagramStyle, index: number): { stroke: string; bar: boolean } {
  if (style.nodeStroke) return { stroke: style.nodeStroke, bar: false }
  if (style.nodeFill !== DEFAULT_STYLE.nodeFill) return { stroke: style.nodeFill, bar: false }
  return { stroke: DIAGRAM_PALETTE.moderns[index % DIAGRAM_PALETTE.moderns.length], bar: true }
}

export function fontStack(style: DiagramStyle) {
  const fallback = "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif"
  return style.fontFamily ? `'${style.fontFamily}', ${fallback}` : fallback
}

export function nodePerLine(width: number, fontSize: number) {
  return Math.max(4, Math.floor((width - 16) / (fontSize * 1.08)))
}

/**
 * 检查作者提示词里提到的外观要求，AI 是否真的返回了对应样式。
 * 仅做关键词级判断：提到字体而没有字体、提到颜色而样式全是默认值，则给出警告。
 */
export function checkPromptCompliance(prompt: string, style: DiagramStyle): ValidationCheck[] {
  const p = prompt.trim()
  if (!p) return []
  const checks: ValidationCheck[] = []
  if (/字体|雅黑|宋体|黑体|楷体|仿宋|苹方|字号/.test(p)) {
    const ok = style.fontFamily !== null || style.fontSize !== DEFAULT_STYLE.fontSize
    checks.push({
      id: 'prompt-font',
      category: '内容检查',
      label: '提示词遵从 · 字体',
      status: ok ? 'pass' : 'warn',
      detail: ok ? `已应用：${style.fontFamily ?? '默认字体'} · ${style.fontSize}px` : '提示词提到了字体，但 AI 没有返回字体设置，请换更明确的说法重试',
    })
  }
  if (/背景|底色|填充|颜色|字色|文字色|[深浅]?[蓝红绿黄橙紫灰黑白青粉]色|[深浅][蓝红绿黄橙紫灰黑白青粉]|#[0-9a-fA-F]{3,6}/.test(p)) {
    const changed =
      style.nodeFill !== DEFAULT_STYLE.nodeFill ||
      style.nodeText !== DEFAULT_STYLE.nodeText ||
      style.nodeStroke !== null ||
      style.groupFill !== null ||
      style.edgeColor !== DEFAULT_STYLE.edgeColor ||
      style.groupText !== DEFAULT_STYLE.groupText
    checks.push({
      id: 'prompt-color',
      category: '内容检查',
      label: '提示词遵从 · 颜色',
      status: changed ? 'pass' : 'warn',
      detail: changed
        ? `节点底色 ${style.nodeFill} · 文字 ${style.nodeText}`
        : '提示词提到了颜色，但 AI 没有返回配色设置，图形仍是默认配色',
    })
  }
  return checks
}

export interface LayerStructure {
  kind: 'layered'
  layers: { label: string; items: string[] }[]
  style?: Partial<DiagramStyle>
}

export interface FlowStructure {
  kind: 'flow'
  steps: string[]
  style?: Partial<DiagramStyle>
}

export type DiagramStructure = LayerStructure | FlowStructure

const LEAD_WORDS = /^(并|然后|再|最后|其次|首先|同时|由|经|系统|在)?/

export function extractStructure(text: string, kind: DiagramKind): DiagramStructure {
  const clean = text.replace(/\s+/g, '')
  if (kind === 'layered') {
    const segments = clean.split(/[；;。\n]/).filter(Boolean)
    const layers = segments
      .map((seg, i) => {
        const parts = seg.split(/[：:]/).filter(Boolean)
        if (parts.length >= 2) {
          const label = parts[parts.length - 2].slice(-10)
          const items = parts[parts.length - 1].split(/[、，,]/).map((s) => s.trim()).filter(Boolean)
          return { label, items }
        }
        const items = seg.split(/[、，,]/).map((s) => s.trim()).filter(Boolean)
        if (items.length === 1) return { label: items[0].slice(0, 10), items: [] }
        return { label: `第${i + 1}层`, items }
      })
      .filter((l) => l.label || l.items.length)
    return { kind: 'layered', layers: layers.slice(0, 8) }
  }
  const steps = clean
    .split(/[，,。；;\n]/)
    .map((s) => s.replace(LEAD_WORDS, '').trim())
    .filter((s) => s.length > 1)
  return { kind: 'flow', steps: steps.slice(0, 12) }
}

const CHARS_PER_LINE = 8

export function wrapLabel(label: string, perLine = CHARS_PER_LINE, maxLines = 2) {
  const lines: string[] = []
  for (let i = 0; i < label.length && lines.length < maxLines; i += perLine) {
    lines.push(label.slice(i, i + perLine))
  }
  const truncated = label.length > perLine * maxLines
  if (truncated) lines[lines.length - 1] = lines[lines.length - 1].slice(0, perLine - 1) + '…'
  return { lines, truncated }
}

function layoutLayered(structure: LayerStructure) {
  const width = 800
  const pad = 20
  const labelW = 132
  const bandH = 76
  const gap = 10
  const groups: DiagramGroup[] = []
  const nodes: DiagramNode[] = []
  structure.layers.forEach((layer, i) => {
    const y = pad + i * (bandH + gap)
    const gid = `g${i + 1}`
    groups.push({ id: gid, label: layer.label, x: pad, y, w: width - pad * 2, h: bandH })
    const count = Math.max(layer.items.length, 1)
    const innerX = pad + labelW
    const innerW = width - pad * 2 - labelW - 14
    const slot = innerW / count
    layer.items.forEach((item, j) => {
      const w = Math.min(slot - 12, 160)
      nodes.push({
        id: `${gid}n${j + 1}`,
        label: item,
        groupId: gid,
        x: Math.round(innerX + j * slot + (slot - w) / 2),
        y: y + 14,
        w: Math.round(w),
        h: bandH - 28,
      })
    })
  })
  const height = pad * 2 + structure.layers.length * (bandH + gap) - gap
  return { width, height, groups, nodes, edges: [] as DiagramEdge[] }
}

function layoutFlow(structure: FlowStructure, direction: DiagramDirection) {
  const pad = 24
  const w = 132
  const h = 60
  const gapX = 44
  const gapY = 48
  const perRow = direction === 'horizontal' ? 4 : 1
  const nodes: DiagramNode[] = structure.steps.map((step, i) => {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    return {
      id: `n${i + 1}`,
      label: step,
      x: pad + col * (w + gapX),
      y: pad + row * (h + gapY),
      w,
      h,
    }
  })
  const edges: DiagramEdge[] = nodes.slice(1).map((n, i) => ({
    id: `e${i + 1}`,
    source: nodes[i].id,
    target: n.id,
  }))
  const rows = Math.ceil(nodes.length / perRow)
  const cols = Math.min(nodes.length, perRow)
  return {
    width: pad * 2 + cols * w + (cols - 1) * gapX,
    height: pad * 2 + rows * h + (rows - 1) * gapY,
    groups: [] as DiagramGroup[],
    nodes,
    edges,
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function toDrawioXml(
  title: string,
  layout: Pick<Diagram, 'width' | 'height' | 'groups' | 'nodes' | 'edges'>,
  sourceText: string,
  style: DiagramStyle = DEFAULT_STYLE,
) {
  const p = DIAGRAM_PALETTE
  const font = style.fontFamily ? `fontFamily=${style.fontFamily};` : ''
  const cells: string[] = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
  layout.groups.forEach((g, i) => {
    const fill = style.groupFill ?? p.bandFills[i % p.bandFills.length]
    cells.push(
      `<mxCell id="${g.id}" value="${escapeXml(g.label)}" style="rounded=1;arcSize=6;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${p.stroke};align=left;spacingLeft=14;fontStyle=1;fontColor=${style.groupText};fontSize=${style.fontSize + 1};${font}" vertex="1" parent="1"><mxGeometry x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" as="geometry"/></mxCell>`,
    )
  })
  layout.nodes.forEach((n, i) => {
    const accent = nodeAccent(style, i).stroke
    cells.push(
      `<mxCell id="${n.id}" value="${escapeXml(n.label)}" style="rounded=1;arcSize=12;whiteSpace=wrap;html=1;shadow=1;strokeWidth=2;fillColor=${style.nodeFill};strokeColor=${accent};fontColor=${style.nodeText};fontSize=${style.fontSize};${font}" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`,
    )
  })
  layout.edges.forEach((e) => {
    cells.push(
      `<mxCell id="${e.id}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;strokeColor=${style.edgeColor};" edge="1" parent="1" source="${e.source}" target="${e.target}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
    )
  })
  return `<mxfile host="presales-workbench" agent="Tool02"><diagram id="d-${Date.now()}" name="${escapeXml(title)}"><mxGraphModel grid="1" gridSize="10" page="1" pageWidth="${layout.width}" pageHeight="${layout.height}" sourceText="${escapeXml(sourceText.slice(0, 200))}"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`
}

export function buildDiagram(
  structure: DiagramStructure,
  options: { title: string; direction: DiagramDirection; sourceText: string },
): Diagram {
  const layout =
    structure.kind === 'layered' ? layoutLayered(structure) : layoutFlow(structure, options.direction)
  const style = resolveStyle(structure.style)
  return {
    id: `DGM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    title: options.title,
    kind: structure.kind,
    direction: options.direction,
    style,
    ...layout,
    xml: toDrawioXml(options.title, layout, options.sourceText, style),
    sourceText: options.sourceText,
  }
}

/**
 * 由模型直出并已清洗的 draw.io 单元构建图形。
 * nodes/groups/edges 留空：预览与导出以 cells 为准，旧的结构化字段仅用于"层级/步骤"模式。
 */
export function buildDiagramFromCells(
  parsed: ParsedDrawio,
  options: { title: string; direction: DiagramDirection; sourceText: string },
): Diagram {
  return {
    id: `DGM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    title: options.title,
    kind: 'flow',
    direction: options.direction,
    width: parsed.width,
    height: parsed.height,
    groups: [],
    nodes: [],
    edges: [],
    cells: parsed.cells,
    xml: serializeDrawioXml(options.title, parsed.cells, parsed.width, parsed.height, options.sourceText),
    sourceText: options.sourceText,
  }
}

/** 自由绘制图的校验：与结构化图共用 XML 检查，其余按 cells 计算 */
function validateCells(diagram: Diagram, xmlCheck: ValidationCheck): ValidationCheck[] {
  const cells = diagram.cells ?? []
  const vertices = cells.filter((c) => c.kind === 'vertex')
  const edges = cells.filter((c) => c.kind === 'edge')
  const ids = new Set(vertices.map((v) => v.id))
  const broken = edges.filter((e) => !ids.has(e.source ?? '') || !ids.has(e.target ?? ''))
  const checks: ValidationCheck[] = [
    xmlCheck,
    {
      id: 'refs',
      category: '技术校验',
      label: '节点与连线引用',
      status: broken.length ? 'fail' : 'pass',
      detail: broken.length ? `${broken.length} 条连线引用不存在的节点` : `${vertices.length} 个图形 · ${edges.length} 条连线`,
    },
  ]

  const source = diagram.sourceText.replace(/\s+/g, '')
  // 两字及以下多为"是/否/开始"这类流程符号文案，不参与溯源判断
  const missing = vertices.filter((v) => {
    const t = v.value.replace(/\s+/g, '').replace('…', '')
    return t.length > 2 && !source.includes(t)
  })
  checks.push({
    id: 'grounded',
    category: '内容检查',
    label: '无依据新模块',
    status: missing.length ? 'warn' : 'pass',
    detail: missing.length
      ? `${missing.length} 个图形文字未在选中文案中出现：${missing.slice(0, 5).map((m) => m.value.replace(/\n/g, ' ')).join('、')}（自由绘制可能含 AI 补充的内容，请核对）`
      : '所有图形文字均来自选中文案',
  })

  const emptyBox = vertices.filter((v) => !v.value && v.style.shape !== 'text' && v.w < 60 && v.h < 40)
  checks.push({
    id: 'coverage',
    category: '内容检查',
    label: '空白图形',
    status: emptyBox.length ? 'warn' : 'pass',
    detail: emptyBox.length ? `${emptyBox.length} 个小图形没有文字` : '图形均有文字或为容器',
  })

  const truncated = vertices.filter((v) => {
    if (!v.value || v.style.shape === 'swimlane') return false
    const fs = Number(v.style.fontSize ?? 12)
    return wrapText(v.value, v.w - 14, fs, lineCapacity(v.h, fs)).truncated
  })
  checks.push({
    id: 'truncate',
    category: '版式检查',
    label: '文字截断',
    status: truncated.length ? 'warn' : 'pass',
    detail: truncated.length
      ? `${truncated.length} 个图形文字放不下：${truncated.slice(0, 5).map((t) => t.value.slice(0, 8)).join('、')}`
      : '图形文字均可完整显示',
  })

  // 容器（泳道、分组框）包含子图形属正常，只统计互不包含的图形之间的重叠
  const contains = (a: (typeof vertices)[number], b: (typeof vertices)[number]) =>
    a.ax <= b.ax + 1 && a.ay <= b.ay + 1 && a.ax + a.w >= b.ax + b.w - 1 && a.ay + a.h >= b.ay + b.h - 1
  let overlaps = 0
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const a = vertices[i]
      const b = vertices[j]
      if (contains(a, b) || contains(b, a)) continue
      if (a.ax < b.ax + b.w && a.ax + a.w > b.ax && a.ay < b.ay + b.h && a.ay + a.h > b.ay) overlaps++
    }
  }
  checks.push({
    id: 'overlap',
    category: '版式检查',
    label: '图形重叠',
    status: overlaps ? 'warn' : 'pass',
    detail: overlaps ? `${overlaps} 处图形互相重叠（非包含关系）` : '无重叠',
  })
  return checks
}

export interface ValidationCheck {
  id: string
  category: '技术校验' | '内容检查' | '版式检查'
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

export function validateDiagram(diagram: Diagram): ValidationCheck[] {
  const checks: ValidationCheck[] = []

  let xmlOk = true
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(diagram.xml, 'application/xml')
    xmlOk = doc.getElementsByTagName('parsererror').length === 0
  }
  checks.push({
    id: 'xml',
    category: '技术校验',
    label: 'XML 可解析',
    status: xmlOk ? 'pass' : 'fail',
    detail: xmlOk ? 'mxfile 结构完整' : 'XML 解析失败',
  })

  if (diagram.cells) return validateCells(diagram, checks[0])

  const ids = new Set([...diagram.nodes.map((n) => n.id), ...diagram.groups.map((g) => g.id)])
  const broken = diagram.edges.filter((e) => !ids.has(e.source) || !ids.has(e.target))
  checks.push({
    id: 'refs',
    category: '技术校验',
    label: '节点与连线引用',
    status: broken.length ? 'fail' : 'pass',
    detail: broken.length
      ? `${broken.length} 条连线引用不存在的节点`
      : `${diagram.nodes.length} 个节点 · ${diagram.edges.length} 条连线`,
  })

  const source = diagram.sourceText.replace(/\s+/g, '')
  const missing = [...diagram.nodes, ...diagram.groups].filter(
    (n) => !n.label.startsWith('第') && !source.includes(n.label.replace('…', '')),
  )
  checks.push({
    id: 'grounded',
    category: '内容检查',
    label: '无依据新模块',
    status: missing.length ? 'warn' : 'pass',
    detail: missing.length
      ? `${missing.map((m) => m.label).join('、')} 未在选中文案中出现`
      : '所有节点均来自选中文案',
  })

  const empty = diagram.kind === 'layered' ? diagram.groups.filter((g) => !diagram.nodes.some((n) => n.groupId === g.id)) : []
  checks.push({
    id: 'coverage',
    category: '内容检查',
    label: '概念覆盖',
    status: empty.length ? 'warn' : 'pass',
    detail: empty.length ? `${empty.map((g) => g.label).join('、')} 下没有识别到模块` : '已识别的层级与步骤均已表达',
  })

  const fontSize = diagram.style?.fontSize ?? DEFAULT_STYLE.fontSize
  const truncated = diagram.nodes.filter((n) => {
    const perLine = nodePerLine(n.w, fontSize)
    return wrapLabel(n.label, perLine).truncated
  })
  checks.push({
    id: 'truncate',
    category: '版式检查',
    label: '文字截断',
    status: truncated.length ? 'warn' : 'pass',
    detail: truncated.length
      ? `${truncated.length} 个节点文字过长，建议精简：${truncated.map((t) => t.label.slice(0, 8)).join('、')}`
      : '节点文字均可完整显示',
  })

  let overlaps = 0
  for (let i = 0; i < diagram.nodes.length; i++) {
    for (let j = i + 1; j < diagram.nodes.length; j++) {
      const a = diagram.nodes[i]
      const b = diagram.nodes[j]
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) overlaps++
    }
  }
  checks.push({
    id: 'overlap',
    category: '版式检查',
    label: '节点重叠',
    status: overlaps ? 'warn' : 'pass',
    detail: overlaps ? `${overlaps} 处节点重叠` : '无重叠',
  })

  return checks
}
