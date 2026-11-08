export type MaterialType = 'ppt' | 'architecture' | 'flow' | 'screenshot' | 'image'
export type MaterialScope = 'internal' | 'project'

export interface Material {
  id: string
  title: string
  type: MaterialType
  scope: MaterialScope
  image: string
  file: string
  page?: number
  version: string
  tags: string[]
  description: string
  license: string
  approved: boolean
}

export interface DiagramGroup {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
}

export interface DiagramNode {
  id: string
  label: string
  groupId?: string
  x: number
  y: number
  w: number
  h: number
}

export interface DiagramEdge {
  id: string
  source: string
  target: string
}

export type DiagramKind = 'layered' | 'flow'
export type DiagramDirection = 'horizontal' | 'vertical'

/** 图形外观。颜色一律为 #RRGGBB；null 表示沿用内置配色（节点描边按序取强调色、层级底色按序取渐变蓝） */
export interface DiagramStyle {
  nodeFill: string
  nodeText: string
  nodeStroke: string | null
  edgeColor: string
  groupFill: string | null
  groupText: string
  /** 单个字体名，如 Microsoft YaHei；渲染时自动追加中文回退字体。null 表示沿用默认字体栈 */
  fontFamily: string | null
  fontSize: number
}

/** 经过白名单清洗的 draw.io 单元。x/y 相对 parent，ax/ay 为画布绝对坐标 */
export interface DrawioCell {
  id: string
  kind: 'vertex' | 'edge'
  value: string
  /** 已清洗的 style 键值；shape 为 rectangle/ellipse/rhombus/cylinder3/cylinder/hexagon/parallelogram/swimlane/text 之一 */
  style: Record<string, string>
  parent: string
  x: number
  y: number
  w: number
  h: number
  ax: number
  ay: number
  source?: string
  target?: string
  /** 连线途经点（绝对坐标） */
  points?: { x: number; y: number }[]
}

export interface Diagram {
  id: string
  title: string
  kind: DiagramKind
  direction: DiagramDirection
  style?: DiagramStyle
  /** 存在时表示图形由模型直接生成 draw.io XML，预览与导出都以 cells 为准 */
  cells?: DrawioCell[]
  width: number
  height: number
  groups: DiagramGroup[]
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  xml: string
  sourceText: string
}

export interface SourceRef {
  id: string
  title: string
  location: string
  kind: 'project' | 'knowledge' | 'case'
}

export type BlockType = 'heading' | 'paragraph' | 'list' | 'image' | 'diagram' | 'placeholder'

export interface Block {
  id: string
  type: BlockType
  level?: 1 | 2
  text?: string
  items?: string[]
  caption?: string
  material?: Material
  diagram?: Diagram
  refs?: string[]
  confirm?: string
  suggestion?: 'tool01' | 'tool02'
}

export type InsertMode = 'before' | 'after' | 'fill'

export interface InsertTarget {
  blockId: string
  mode: InsertMode
}

export interface TextSelection {
  blockId: string
  text: string
  blockTextSnapshot: string
}

export interface ChangeRecord {
  id: string
  version: number
  label: string
  detail: string
  at: string
}
