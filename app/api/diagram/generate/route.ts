import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { sanitizeStyle, type DiagramStructure } from '@/lib/workbench/diagram'
import { extractDrawioXml, MAX_XML_LENGTH, parseDrawioXml, type ParsedDrawio } from '@/lib/workbench/drawio'
import type { DiagramKind } from '@/lib/workbench/types'

interface GenerateRequest {
  text: string
  kind: DiagramKind
  title: string
}

interface GenerateResponse {
  success: boolean
  structure?: DiagramStructure
  /** output=xml 时返回：模型直出的 draw.io XML 经服务端解析、白名单清洗后的结果 */
  drawio?: ParsedDrawio
  error?: string
}

/**
 * 调用 LLM 进行智能图形结构设计
 * 支持多个 LLM 后端：OpenAI / DeepSeek / 兼容端点
 */
export async function POST(request: NextRequest): Promise<NextResponse<GenerateResponse>> {
  try {
    const body = (await request.json()) as GenerateRequest & {
      provider?: string
      endpoint?: string
      model?: string
      userPrompt?: string
      currentStructure?: string
      currentStyle?: unknown
      images?: string[]
      output?: string
      currentXml?: string
    }
    const mode: OutputMode = body.output === 'xml' ? 'xml' : 'structure'
    const currentXml = typeof body.currentXml === 'string' ? body.currentXml.slice(0, MAX_XML_LENGTH) : ''
    const { text, kind, title, provider: bodyProvider, endpoint: bodyEndpoint, model: bodyModel } = body
    const userPrompt = (body.userPrompt || '').trim().slice(0, 2000)
    const currentStructure = (body.currentStructure || '').trim().slice(0, 4000)
    const images = Array.isArray(body.images) ? body.images : []

    if (!text || !kind) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数：text 或 kind' },
        { status: 400 },
      )
    }

    // 垫图校验：最多 3 张，必须是 data:image，总量限制 8MB
    const totalSize = images.reduce((n, s) => n + (typeof s === 'string' ? s.length : 0), 0)
    if (images.length > 3 || images.some((s) => typeof s !== 'string' || !s.startsWith('data:image/')) || totalSize > 8_000_000) {
      return NextResponse.json(
        { success: false, error: '垫图不合法：最多 3 张图片，且总大小不超过 8MB' },
        { status: 400 },
      )
    }

    // 读取配置（优先级：请求体 > 环境变量 > 请求头）
    const aiProvider = bodyProvider || process.env.NEXT_PUBLIC_AI_PROVIDER || 'openai'
    const apiKey = process.env.AI_API_KEY || request.headers.get('x-ai-api-key')
    const endpoint = bodyEndpoint || process.env.AI_API_ENDPOINT

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: '未配置 AI API Key。请在 .env.local 中设置 AI_API_KEY' },
        { status: 401 },
      )
    }

    // 构造提示词
    // 当前样式同样要清洗后再回填进提示词
    const cleanStyle = sanitizeStyle(body.currentStyle)
    const currentStyle = Object.keys(cleanStyle).length ? JSON.stringify(cleanStyle) : ''
    const chat = (p: string) =>
      callChat({ provider: aiProvider, prompt: p, apiKey, endpoint, model: bodyModel, images, mode })

    if (mode === 'xml') {
      const prompt = buildXmlPrompt(text, title, { userPrompt, currentXml, imageCount: images.length })
      return NextResponse.json({ success: true, drawio: await generateXml(chat, prompt) }, { status: 200 })
    }

    const prompt = buildPrompt(text, kind, title, { userPrompt, currentStructure, currentStyle, imageCount: images.length })
    const structure = parseStructure(await chat(prompt))
    return NextResponse.json({ success: true, structure }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Tool02 AI] 生成失败:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/** 用户可能填 base URL（如 https://host/v1），自动补全为 chat/completions 完整地址 */
function resolveChatUrl(endpoint: string | undefined, fallback: string): string {
  if (!endpoint) return fallback
  const trimmed = endpoint.trim().replace(/\/+$/, '')
  return /\/chat\/completions$/.test(trimmed) ? trimmed : `${trimmed}/chat/completions`
}

/** 无垫图时保持纯文本；有垫图时使用 OpenAI 兼容的多模态 content 数组 */
function buildUserContent(prompt: string, images: string[]) {
  if (images.length === 0) return prompt
  return [
    { type: 'text', text: prompt },
    ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
  ]
}

interface PromptExtras {
  userPrompt: string
  currentStructure: string
  currentStyle: string
  imageCount: number
}

/** 样式字段说明：追加在基础提示词的 JSON 格式之后，模型只需在作者提到外观时填写 */
const STYLE_SPEC = `
【外观样式 style】
JSON 顶层可增加可选字段 "style"，用于表达作者对外观的要求。只填写作者明确提到的项，没提到的项不要写；作者没有任何外观要求时整个 style 都不要写。
{
  "style": {
    "nodeFill": "#RRGGBB",    // 节点（矩形文本框）背景色
    "nodeText": "#RRGGBB",    // 节点文字颜色
    "nodeStroke": "#RRGGBB",  // 节点边框色
    "groupFill": "#RRGGBB",   // 分层图中层级色带的背景色
    "groupText": "#RRGGBB",   // 层级标题文字颜色
    "edgeColor": "#RRGGBB",   // 连线与箭头颜色
    "fontFamily": "Microsoft YaHei",  // 单个字体名，中文字体请写英文名：微软雅黑=Microsoft YaHei，宋体=SimSun，黑体=SimHei，苹方=PingFang SC
    "fontSize": 12            // 8-24 的整数，节点文字字号
  }
}
规则：
- 颜色必须换算成 6 位十六进制，例如 深蓝=#1f3a8a，白色=#ffffff，黑色=#000000，浅灰=#f3f4f6，红色=#dc2626，绿色=#16a34a。
- "每个矩形/节点背景为深蓝、文字为白色" 对应 nodeFill 与 nodeText；"字体是微软雅黑" 对应 fontFamily。
- 深色背景必须搭配浅色文字，保证对比度，除非作者另有指定。
- 外观要求只通过 style 表达，不要把颜色、字体写进 label、items 或 steps 里。`
/** 在默认任务之后追加作者提示词、垫图说明与当前结构，作者要求优先于默认规则 */
function buildPrompt(text: string, kind: DiagramKind, title: string, extras: PromptExtras): string {
  const base = buildBasePrompt(text, kind, title)
  const sections: string[] = []
  if (extras.userPrompt) {
    sections.push(`【作者提示词】\n${extras.userPrompt}`)
  }
  if (extras.userPrompt || extras.currentStyle) {
    sections.push(STYLE_SPEC.trim())
  }
  if (extras.currentStyle) {
    sections.push(
      `【当前外观样式（修改时原样保留，除非作者提示词要求改变其中某一项；输出的 style 必须包含保留下来的项）】\n${extras.currentStyle}`,
    )
  }
  if (extras.imageCount > 0) {
    sections.push(
      `【垫图】随消息附带了 ${extras.imageCount} 张参考图。请从图中提取层级划分、模块命名、流程顺序与分组关系作为设计参考；` +
        '图中与文案冲突时，以作者提示词为准，其次以文案事实为准，不要编造文案和图中都没有的内容。',
    )
  }
  if (extras.currentStructure) {
    sections.push(`【当前图形结构（在此基础上按作者提示词修改，未被要求改动的部分保持不变）】\n${extras.currentStructure}`)
  }
  if (sections.length === 0) return base
  return `${base}\n\n补充要求（优先级高于上文的默认数量与措辞约束；输出仍是上文规定的 JSON 格式，仅允许额外增加可选的 style 字段）：\n${sections.join('\n\n')}\n`
}

function buildBasePrompt(text: string, kind: DiagramKind, title: string): string {
  if (kind === 'layered') {
    return `
你是企业架构师和可视化设计专家。分析以下文案，设计一个分层架构图。

文案：
${text}

任务：
1. 识别系统中的 3-5 个主要层级/域
2. 每层下列举 2-4 个关键模块或组件
3. 模块名应简洁（2-6 个中文字符），避免缩写

返回 JSON 格式（必须是有效的 JSON，不要添加 markdown 代码块标记）：
{
  "kind": "layered",
  "layers": [
    { "label": "层级名", "items": ["模块1", "模块2", "模块3"] },
    ...
  ]
}

确保返回的 JSON 可以直接解析，不包含任何额外的文字或代码块标记。
`
  } else {
    return `
你是流程优化专家。分析以下文案，设计一个业务流程图。

文案：
${text}

任务：
1. 提取 5-8 个核心步骤
2. 按逻辑顺序排列
3. 每个步骤简洁清晰（4-10 个中文字符）

返回 JSON 格式（必须是有效的 JSON，不要添加 markdown 代码块标记）：
{
  "kind": "flow",
  "steps": ["步骤1", "步骤2", "步骤3", ...]
}

确保返回的 JSON 可以直接解析，不包含任何额外的文字或代码块标记。
`
  }
}

type OutputMode = 'structure' | 'xml'

const SYSTEM_PROMPTS: Record<OutputMode, string> = {
  structure: 'You are a JSON generator. Always respond with valid JSON only, no markdown formatting.',
  xml: 'You are a draw.io diagram designer. Respond with a single <mxGraphModel> XML document only. No markdown fences, no explanation.',
}

/** OpenAI 与 DeepSeek 均为 chat/completions 兼容协议，仅默认地址与模型不同 */
async function callChat(opts: {
  provider: string
  prompt: string
  apiKey: string
  endpoint?: string
  model?: string
  images: string[]
  mode: OutputMode
}): Promise<string> {
  const deepseek = opts.provider === 'deepseek'
  const label = deepseek ? 'DeepSeek' : 'OpenAI'
  const url = resolveChatUrl(
    opts.endpoint,
    deepseek ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions',
  )
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model || (deepseek ? 'deepseek-chat' : 'gpt-4o-mini'),
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[opts.mode] },
        { role: 'user', content: buildUserContent(opts.prompt, opts.images) },
      ],
      temperature: opts.mode === 'xml' ? 0.4 : 0.3,
      // XML 比结构化 JSON 长得多，token 上限需要放宽
      max_tokens: opts.mode === 'xml' ? 6144 : 1536,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`[${label}] API Error ${response.status}:`, error)
    throw new Error(`${label} API error (${response.status}): ${error}`)
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error(`未收到 ${label} 响应内容`)
  return content
}

/**
 * 生成并解析 draw.io XML。模型输出的 XML 偶尔格式不合法或没有可用节点，
 * 失败时把错误原因反馈给模型自动重试一次，再失败才向用户报错。
 */
async function generateXml(chat: (prompt: string) => Promise<string>, prompt: string): Promise<ParsedDrawio> {
  let reason = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const fix = attempt === 0 ? '' : `\n\n上一次输出无法使用（${reason}）。请重新输出完整、合法的 <mxGraphModel>，只输出 XML。`
    try {
      return parseDrawioXml(extractDrawioXml(await chat(prompt + fix)))
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error)
      console.warn(`[Tool02 AI] XML 第 ${attempt + 1} 次解析失败:`, reason)
    }
  }
  throw new Error(`模型输出的 draw.io XML 不可用：${reason}`)
}

const XML_SPEC = `只输出一个完整的 <mxGraphModel> 文档，结构如下，不要 markdown 代码块，不要解释：
<mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a1" value="文字" style="rounded=1;fillColor=#1f3a8a;fontColor=#ffffff;strokeColor=#1f3a8a;fontSize=13;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="140" height="48" as="geometry"/></mxCell>
<mxCell id="e1" value="" style="edgeStyle=orthogonalEdgeStyle;endArrow=block;strokeColor=#4a5d7a;" edge="1" parent="1" source="a1" target="a2"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel>

规则：
- 每个 id 唯一；id 只用字母、数字、下划线。连线的 source/target 必须是已存在的 vertex id。
- 坐标为像素，整体控制在 1200x800 以内，节点之间留 30px 以上间距，不要重叠；有连线的节点要摆在能直线或折线连通的位置。
- 可用图形（style 中写 shape=xxx，或直接写名称）：rectangle(默认)、ellipse、rhombus(判断)、cylinder3(数据库)、hexagon、parallelogram、swimlane(泳道/分组容器)、text(纯文字)。
- 容器：swimlane 的 style 加 startSize=28；子节点的 parent 设为容器 id，其 x/y 是相对容器左上角的坐标。容器必须足够大以包住所有子节点。
- 可用 style 键（其他会被丢弃）：fillColor、strokeColor、fontColor（均为 #RRGGBB）、fontSize(8-36)、fontStyle(1粗 2斜 4下划线)、fontFamily、rounded=0|1、arcSize、dashed=0|1、strokeWidth、shadow=0|1、opacity、align=left|center|right、verticalAlign=top|middle|bottom、swimlaneFillColor、horizontal=0|1；连线另有 edgeStyle=orthogonalEdgeStyle、endArrow、startArrow。
- 节点文字要简短（一般不超过 12 个汉字），长句拆成多个节点或放进容器标题。换行用 &lt;br&gt;。value 中不要出现 HTML 标签以外的内容。
- 禁止：脚本、事件属性、外部链接、图片 URL、base64、自定义 shape 库。
- 节点数量不超过 60 个，布局要有设计感：分层/泳道/分支/汇聚按内容选择最合适的，而不是机械排成一行。`

interface XmlPromptExtras {
  userPrompt: string
  currentXml: string
  imageCount: number
}

function buildXmlPrompt(text: string, title: string, extras: XmlPromptExtras): string {
  const parts: string[] = [`你是售前方案图形设计师。根据下面的文案，直接设计并输出 draw.io 的 mxGraphModel XML。图名：${title}。`]
  parts.push(`【选中文案】\n${text.slice(0, 4000)}`)
  if (extras.imageCount > 0) {
    parts.push(
      `【参考垫图】共 ${extras.imageCount} 张。请观察图中的版式（泳道/分层/中心辐射/时间线等）、配色、形状风格、连线方式，并在 XML 中尽量复刻其视觉结构；图中的文字内容以"选中文案"为准，不要照抄图里无关的文字。`,
    )
  }
  if (extras.currentXml) {
    parts.push(
      `【当前图形 XML】\n${extras.currentXml}\n请在此基础上按"作者要求"修改：未被提及的部分保持节点 id、位置、文字、样式不变，只改需要改的地方，输出修改后的完整 XML。`,
    )
  }
  if (extras.userPrompt) {
    parts.push(
      `【作者要求（最高优先级，颜色、字体、形状、布局必须逐条落实到 style 中）】\n${extras.userPrompt}\n字体名请用英文（如 Microsoft YaHei）；颜色用 #RRGGBB。`,
    )
  }
  parts.push(`【输出格式】\n${XML_SPEC}`)
  return parts.join('\n\n')
}


/** 提取 JSON、校验结构，并对 style 做白名单清洗（颜色/字体会写入 SVG 与 draw.io style，必须过滤） */
function parseStructure(content: string): DiagramStructure {
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  const raw = JSON.parse(jsonMatch ? jsonMatch[0] : content)

  if (raw?.kind === 'layered') {
    const layers = Array.isArray(raw.layers) ? raw.layers : null
    if (!layers) throw new Error('LLM 返回的结构不符合预期格式')
    return {
      kind: 'layered',
      layers: layers.map((l: { label?: unknown; items?: unknown }) => ({
        label: String(l?.label ?? ''),
        items: Array.isArray(l?.items) ? l.items.map(String) : [],
      })),
      style: sanitizeStyle(raw.style),
    }
  }
  if (raw?.kind === 'flow') {
    if (!Array.isArray(raw.steps)) throw new Error('LLM 返回的结构不符合预期格式')
    return { kind: 'flow', steps: raw.steps.map(String), style: sanitizeStyle(raw.style) }
  }
  throw new Error('LLM 返回的结构不符合预期格式')
}
