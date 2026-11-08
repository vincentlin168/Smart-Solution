'use client'

import { useRef, useState } from 'react'
import { CircleAlert, CircleCheck, CircleX, Download, ImagePlus, Loader2, RefreshCw, Shapes, TriangleAlert, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  buildDiagram,
  buildDiagramFromCells,
  checkPromptCompliance,
  extractStructure,
  resolveStyle,
  validateDiagram,
  type DiagramStructure,
  type ValidationCheck,
} from '@/lib/workbench/diagram'
import { downloadBlob, downloadDrawio, svgElementToString, svgToPngBlob } from '@/lib/workbench/export'
import type { ParsedDrawio } from '@/lib/workbench/drawio'
import type { Diagram, DiagramDirection, DiagramKind, InsertTarget, TextSelection } from '@/lib/workbench/types'
import { DiagramSvg } from './diagram-svg'
import { Chip } from './tool01-panel'
import { TargetPicker } from './target-banner'
import { useAiConfig } from './ai-config-context'
import { describeTarget, newBlockId, type DocumentApi } from './use-document'

const PIPELINE = ['语义提取', '结构设计', '生成 draw.io XML', '校验与渲染'] as const
const AI_PIPELINE = ['上传文本', 'AI 推理', '结构解析', '生成 draw.io XML', '校验与渲染'] as const

interface SourceSnapshot {
  blockId: string
  text: string
  blockTextSnapshot: string
}

function resolveSource(doc: DocumentApi, target: InsertTarget | null, selection: TextSelection | null): SourceSnapshot | null {
  if (selection) return { ...selection }
  if (!target) return null
  const index = doc.blocks.findIndex((b) => b.id === target.blockId)
  for (let i = index; i >= 0; i--) {
    const b = doc.blocks[i]
    if (b.type === 'paragraph' && b.text) return { blockId: b.id, text: b.text, blockTextSnapshot: b.text }
    if (b.type === 'heading') break
  }
  return null
}

const MAX_REF_IMAGES = 3
const MAX_VERSIONS = 20
const REFINE_PRESETS = ['精简模块，每层不超过 4 个', '模块命名更正式、更贴近行业术语', '补充遗漏的关键模块', '调整顺序，按调用关系从上到下'] as const

/** 一次生成或修改产生的图形快照，可随时回退 */
interface DiagramVersion {
  id: number
  label: string
  kind: DiagramKind
  structureText: string
  diagram: Diagram
  checks: ValidationCheck[]
}

/** 读取图片并压缩到最长边 1280px，输出 JPEG data URL，避免请求体过大 */
function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('无法处理图片'))
        return
      }
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败'))
    }
    img.src = url
  })
}

function truncate(s: string, n: number) {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length > n ? `${t.slice(0, n)}…` : t
}

function structureToText(s: DiagramStructure) {
  if (s.kind === 'layered') return s.layers.map((l) => `${l.label}：${l.items.join('、')}`).join('\n')
  return s.steps.join('\n')
}

function textToStructure(text: string, kind: DiagramKind): DiagramStructure {
  if (kind === 'layered') return extractStructure(text.split('\n').join('；'), 'layered')
  return { kind: 'flow', steps: text.split('\n').map((s) => s.trim()).filter(Boolean) }
}

interface Tool02PanelProps {
  doc: DocumentApi
  target: InsertTarget | null
  selection: TextSelection | null
  onSetTarget: (target: InsertTarget | null) => void
  onInserted: (blockId: string) => void
}

export function Tool02Panel({ doc, target, selection, onSetTarget, onInserted }: Tool02PanelProps) {
  const { config: aiConfig } = useAiConfig()
  const [source] = useState(() => resolveSource(doc, target, selection))
  const [kind, setKind] = useState<DiagramKind>(() => (source && /层/.test(source.text) ? 'layered' : 'flow'))
  const [direction, setDirection] = useState<DiagramDirection>('horizontal')
  const [title, setTitle] = useState(() => (source && /层/.test(source.text) ? '平台总体架构图' : '业务流程图'))
  const [stage, setStage] = useState(-1)
  const [structureText, setStructureText] = useState('')
  const [diagram, setDiagram] = useState<Diagram | null>(null)
  const [checks, setChecks] = useState<ValidationCheck[]>([])
  const [staleWarning, setStaleWarning] = useState(false)
  const [useAi, setUseAi] = useState(false)
  /** 自由绘制：让模型直接输出 draw.io XML，而不是层级/步骤结构 */
  const [freeDrawPref, setFreeDraw] = useState(true)
  const [userPrompt, setUserPrompt] = useState('')
  const [refImages, setRefImages] = useState<string[]>([])
  const [refineText, setRefineText] = useState('')
  const [history, setHistory] = useState<DiagramVersion[]>([])
  const [activeVersion, setActiveVersion] = useState<number | null>(null)
  const versionSeq = useRef(0)
  const svgRef = useRef<SVGSVGElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function addImages(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    const room = MAX_REF_IMAGES - refImages.length
    if (room <= 0) {
      toast.error(`最多添加 ${MAX_REF_IMAGES} 张垫图`)
      return
    }
    if (imgs.length > room) toast.info(`最多 ${MAX_REF_IMAGES} 张垫图，已忽略多余的 ${imgs.length - room} 张`)
    try {
      const urls = await Promise.all(imgs.slice(0, room).map(fileToCompressedDataUrl))
      setRefImages((prev) => [...prev, ...urls].slice(0, MAX_REF_IMAGES))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '图片处理失败')
    }
  }

  const targetInfo = describeTarget(doc.blocks, target)
  const running = stage >= 0 && stage < PIPELINE.length
  const aiRunning = stage >= 0 && stage < AI_PIPELINE.length

  /** 应用一个结构：生成图形、更新编辑区，并记入版本历史 */
  function commit(structure: DiagramStructure, label: string, promptForCheck = '') {
    if (!source) return
    const d = buildDiagram(structure, { title: title || '方案图形', direction, sourceText: source.text })
    // 提示词遵从检查：作者提到了字体/颜色但 AI 没返回样式时，明确告警，而不是让作者对着默认配色猜
    const c = [...validateDiagram(d), ...checkPromptCompliance(promptForCheck, resolveStyle(d.style))]
    const text = structureToText(structure)
    const id = ++versionSeq.current
    setDiagram(d)
    setChecks(c)
    setStructureText(text)
    setActiveVersion(id)
    setStaleWarning(false)
    setHistory((prev) => [...prev, { id, label, kind: structure.kind, structureText: text, diagram: d, checks: c }].slice(-MAX_VERSIONS))
  }

  /** 应用模型直出（已在服务端清洗）的 draw.io 图形，并记入版本历史 */
  function commitDrawio(parsed: ParsedDrawio, label: string) {
    if (!source) return
    const d = buildDiagramFromCells(parsed, { title: title || '方案图形', direction, sourceText: source.text })
    const c = [...validateDiagram(d)]
    if (parsed.warnings.length) {
      c.push({ id: 'sanitize', category: '技术校验', label: 'XML 清洗', status: 'warn', detail: parsed.warnings.join('；') })
    }
    const id = ++versionSeq.current
    setDiagram(d)
    setChecks(c)
    setStructureText('')
    setActiveVersion(id)
    setStaleWarning(false)
    setHistory((prev) => [...prev, { id, label, kind, structureText: '', diagram: d, checks: c }].slice(-MAX_VERSIONS))
  }

  function restoreVersion(v: DiagramVersion) {
    setKind(v.kind)
    setDiagram(v.diagram)
    setChecks(v.checks)
    setStructureText(v.structureText)
    setActiveVersion(v.id)
    setStaleWarning(false)
  }

  /** instruction 有值时为"修改当前图形"：保留现有图形，以编辑区的结构为基础交给 AI 修改 */
  async function generateWithAi(instruction?: string) {
    if (!source) return
    const isRefine = Boolean(instruction && diagram)
    // 修改时沿用当前图形的类型（自由绘制图只能用 XML 继续改）；新生成时看开关
    const freeDraw = isRefine ? Boolean(diagram?.cells) : freeDrawPref
    if (!isRefine) setDiagram(null)
    setStaleWarning(false)

    if (!aiConfig.apiKey) {
      toast.error('请先在顶部栏配置 AI API Key')
      return
    }

    setStage(0)
    const endpoint = aiConfig.endpoint || undefined
    
    try {
      // 上传文本
      setStage(1)
      await new Promise((r) => setTimeout(r, 300))
      
      // AI 推理
      setStage(2)
      const response = await fetch('/api/diagram/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-api-key': aiConfig.apiKey,
        },
        body: JSON.stringify({
          text: source.text,
          kind,
          title: title || '方案图形',
          provider: aiConfig.provider,
          endpoint,
          model: aiConfig.model || undefined,
          userPrompt: (isRefine ? instruction : userPrompt)?.trim() || undefined,
          images: refImages.length > 0 ? refImages : undefined,
          output: freeDraw ? 'xml' : undefined,
          // 修改自由绘制图时，把当前 xml 交给模型在其基础上改；旧版结构化图则沿用结构文本
          currentXml: freeDraw && isRefine ? diagram?.xml : undefined,
          currentStructure: !freeDraw && isRefine && structureText.trim() ? structureText : undefined,
          currentStyle: !freeDraw && isRefine ? diagram?.style : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMsg = errorData.error || `HTTP ${response.status}`
        throw new Error(errorMsg)
      }

      const result = (await response.json()) as {
        success: boolean
        structure?: DiagramStructure
        drawio?: ParsedDrawio
        error?: string
      }
      if (!result.success || !(freeDraw ? result.drawio : result.structure)) {
        throw new Error(result.error || '未获得有效的图形结构')
      }

      // 结构解析
      setStage(3)
      await new Promise((r) => setTimeout(r, 300))
      
      // 生成 draw.io XML
      setStage(4)
      const versionLabel = isRefine ? `AI 修改：${truncate(instruction!, 14)}` : freeDraw ? 'AI 自由绘制' : 'AI 生成'
      if (freeDraw && result.drawio) {
        commitDrawio(result.drawio, versionLabel)
      } else if (result.structure) {
        commit(result.structure, versionLabel, (isRefine ? instruction : userPrompt) ?? '')
      }
      setStage(-1)
      if (isRefine) setRefineText('')
      toast.success(isRefine ? '已按指令修改，可继续调整' : 'AI 图形生成成功，可继续修改')
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[Tool02] AI 生成失败:', msg)
      toast.error(`AI 生成失败：${msg}`)
      setStage(-1)
      // 修改失败时保留当前图形；首次生成且作者给了提示词/垫图时也不降级，避免结果与预期不符
      if (!isRefine && !userPrompt.trim() && refImages.length === 0) generate()
    }
  }

  function generate(fromStructure?: DiagramStructure) {
    if (!source) return
    // 手动调整结构后重新生成：直接应用并记入历史，不清空预览、不走进度动画
    if (fromStructure) {
      // 文本框只描述结构，外观沿用当前图形，否则手动改一个字就会丢掉 AI 设置的配色和字体
      commit({ ...fromStructure, style: diagram?.style }, '手动调整')
      return
    }
    setDiagram(null)
    setStaleWarning(false)
    setStage(0)
    const structure = extractStructure(source.text, kind)
    PIPELINE.forEach((_, i) => setTimeout(() => setStage(i + 1), (i + 1) * 450))
    setTimeout(() => {
      commit(structure, '规则生成')
      setStage(-1)
    }, PIPELINE.length * 450)
  }

  function insert(force = false) {
    if (!diagram || !target || !source) return
    const current = doc.blocks.find((b) => b.id === source.blockId)
    if (!force && (!current || current.text !== source.blockTextSnapshot)) {
      setStaleWarning(true)
      return
    }
    const id = newBlockId()
    const ok = doc.insertBlocks(
      target,
      [{ id, type: 'diagram', diagram: { ...diagram, title: title || diagram.title }, caption: title || diagram.title }],
      'Tool02 插入图形',
      `${diagram.id}「${title}」源自 ${source.blockId} → ${targetInfo?.chapter} · ${target.blockId} ${targetInfo?.action}`,
    )
    if (ok) {
      toast.success('图形已插入方案', { description: 'draw.io 源文件已独立保存，可随时下载继续编辑' })
      onInserted(id)
    } else {
      toast.error('目标位置已不存在，请重新选择插入点')
    }
  }

  async function downloadPng() {
    if (!svgRef.current || !diagram) return
    const blob = await svgToPngBlob(svgElementToString(svgRef.current), diagram.width, diagram.height)
    downloadBlob(blob, `${title}.png`, 'image/png')
  }

  if (!source) {
    return (
      <div className="flex flex-col gap-4 px-4 py-4">
        <Header />
        <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm leading-relaxed text-muted-foreground">
          请在文档中选中一段文案（拖选或点击「选中整段」），或点击带有「用 Tool02 生成图形」的占位区。
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <Header />
      <TargetPicker blocks={doc.blocks} target={target} onChange={onSetTarget} />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          选中文案 · 来自 <span className="tabular-nums">{source.blockId}</span>
        </p>
        <blockquote className="max-h-32 overflow-y-auto rounded-md border-l-2 border-primary bg-secondary px-3 py-2 text-sm leading-relaxed">
          {source.text}
        </blockquote>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-medium text-muted-foreground">图形类型</legend>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={kind === 'layered'} onClick={() => setKind('layered')}>
              分层架构图
            </Chip>
            <Chip active={kind === 'flow'} onClick={() => setKind('flow')}>
              业务流程图
            </Chip>
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2" disabled={kind === 'layered'}>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">流程方向</legend>
          <div className={cn('flex flex-wrap gap-1.5', kind === 'layered' && 'opacity-50')}>
            <Chip active={direction === 'horizontal'} onClick={() => setDirection('horizontal')} disabled={kind === 'layered'}>
              横向
            </Chip>
            <Chip active={direction === 'vertical'} onClick={() => setDirection('vertical')} disabled={kind === 'layered'}>
              纵向
            </Chip>
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="t2-title" className="text-xs font-medium text-muted-foreground">
          图名
        </label>
        <Input id="t2-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">生成方式</label>
        <div className="flex gap-2">
          <Chip active={!useAi} onClick={() => setUseAi(false)}>
            规则生成
          </Chip>
          <Chip active={useAi} onClick={() => setUseAi(true)}>
            <Sparkles className="size-3 mr-1" />
            AI 生成
          </Chip>
        </div>
      </div>

      {useAi && (
        <section aria-label="AI 提示词与垫图" className="flex flex-col gap-3 rounded-md border bg-secondary/40 p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">绘制模式</span>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={freeDrawPref} onClick={() => setFreeDraw(true)}>
                自由绘制（AI 直出 draw.io）
              </Chip>
              <Chip active={!freeDrawPref} onClick={() => setFreeDraw(false)}>
                结构化（分层 / 流程）
              </Chip>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {freeDrawPref
                ? '版式、形状、泳道由 AI 自行设计，垫图会被真正参照；复杂图的生成耗时更长，节点文字可能含 AI 补充内容，请核对。'
                : '只提取层级或步骤，版式由本地算法固定，稳定但样式有限。'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="t2-prompt" className="text-xs font-medium text-muted-foreground">
              提示词（可选）· 告诉 AI 你想要的结构与风格
            </label>
            <Textarea
              id="t2-prompt"
              rows={4}
              value={userPrompt}
              maxLength={2000}
              placeholder={
                kind === 'layered'
                  ? '例如：按"端—边—云"划分为四层；AI 能力层单独成层并突出大模型网关；每层不超过 4 个模块；用客户术语命名'
                  : '例如：按泳道拆分为"员工 / 部门负责人 / 共享中心 / 财务系统"；增加退回与重提分支；步骤名用动宾结构'
              }
              onChange={(e) => setUserPrompt(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files)
                if (files.some((f) => f.type.startsWith('image/'))) {
                  e.preventDefault()
                  void addImages(files)
                }
              }}
              className="text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              垫图（可选）· 参考已有架构图或手绘草图，最多 {MAX_REF_IMAGES} 张，也可在提示词框直接粘贴
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {refImages.map((src, i) => (
                <div key={i} className="relative size-16 overflow-hidden rounded-md border bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`垫图 ${i + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setRefImages((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`移除垫图 ${i + 1}`}
                    className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-foreground/70 text-background"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {refImages.length < MAX_REF_IMAGES && (
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus data-icon="inline-start" />
                  添加图片
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  void addImages(Array.from(e.target.files ?? []))
                  e.target.value = ''
                }}
              />
            </div>
            {refImages.length > 0 && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                垫图需要所选模型支持图片输入（如 gpt-4o 系列）；不支持时请求会报错，请移除垫图或更换模型。
              </p>
            )}
          </div>

        </section>
      )}

      <Button onClick={() => (useAi ? generateWithAi() : generate())} disabled={aiRunning || running}>
        {aiRunning || running ? (
          <>
            <Loader2 data-icon="inline-start" className="animate-spin" />
            {useAi ? '生成中' : '生成中'}
          </>
        ) : (
          <>
            {useAi ? <Sparkles data-icon="inline-start" /> : <Shapes data-icon="inline-start" />}
            {useAi ? (diagram ? 'AI 从头重新生成' : 'AI 生成图形') : diagram ? '按设置重新生成' : '生成 draw.io 图形'}
          </>
        )}
      </Button>

      {(stage >= 0 && (useAi ? stage < AI_PIPELINE.length : stage < PIPELINE.length)) && (
        <ol className="grid gap-1" aria-label="生成进度" style={{gridTemplateColumns: `repeat(${useAi ? 5 : 4}, 1fr)`}}>
          {(useAi ? AI_PIPELINE : PIPELINE).map((step, i) => (
            <li key={step} className="flex flex-col gap-1">
              <span className={cn('h-1 rounded-full', i < stage ? 'bg-primary' : 'bg-border')} />
              <span className={cn('text-[11px] leading-tight', i < stage ? 'text-foreground' : 'text-muted-foreground')}>
                {step}
              </span>
            </li>
          ))}
        </ol>
      )}

      {diagram && (
        <>
          <section aria-label="图形预览" className="flex flex-col gap-2">
            <div className="overflow-x-auto rounded-md border bg-card p-2">
              <DiagramSvg ref={svgRef} diagram={diagram} className="h-auto w-full min-w-[320px]" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="xs" variant="outline" onClick={() => downloadDrawio(diagram)}>
                <Download data-icon="inline-start" />
                .drawio
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => svgRef.current && downloadBlob(svgElementToString(svgRef.current), `${title}.svg`, 'image/svg+xml')}
              >
                <Download data-icon="inline-start" />
                SVG
              </Button>
              <Button size="xs" variant="outline" onClick={downloadPng}>
                <Download data-icon="inline-start" />
                PNG
              </Button>
            </div>
          </section>

          <section aria-labelledby="refine-h" className="flex flex-col gap-2 rounded-md border bg-secondary/40 p-3">
            <h4 id="refine-h" className="text-xs font-medium text-muted-foreground">
              继续修改 · 用一句话告诉 AI 改哪里，未提及的部分保持不变
            </h4>
            <Textarea
              rows={2}
              value={refineText}
              maxLength={1000}
              placeholder="例如：把第三层拆成两层；去掉「其他」模块；各层模块名改成客户内部叫法"
              onChange={(e) => setRefineText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && refineText.trim() && !aiRunning) {
                  e.preventDefault()
                  void generateWithAi(refineText)
                }
              }}
              className="text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {REFINE_PRESETS.map((p) => (
                <Chip key={p} active={false} onClick={() => setRefineText(p)}>
                  {p}
                </Chip>
              ))}
            </div>
            <Button size="sm" onClick={() => generateWithAi(refineText)} disabled={!refineText.trim() || aiRunning || running}>
              {aiRunning ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
              让 AI 修改当前图形
            </Button>
            {!aiConfig.apiKey && <p className="text-[11px] text-muted-foreground">需要先在顶部栏齿轮中配置 API Key。</p>}
          </section>

          {history.length > 1 && (
            <section aria-labelledby="history-h" className="flex flex-col gap-1.5">
              <h4 id="history-h" className="text-xs font-medium text-muted-foreground">
                版本历史 · 点击可回到任一版本，之后的修改会接在该版本上
              </h4>
              <ol className="flex flex-col gap-1">
                {[...history].reverse().map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => restoreVersion(v)}
                      aria-current={v.id === activeVersion ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs',
                        v.id === activeVersion ? 'border-primary bg-primary/10' : 'hover:bg-secondary',
                      )}
                    >
                      <span className="tabular-nums text-muted-foreground">v{v.id}</span>
                      <span className="flex-1 truncate">{v.label}</span>
                      {v.id === activeVersion && <span className="text-primary">当前</span>}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section aria-labelledby="checks-h" className="flex flex-col gap-2">
            <h4 id="checks-h" className="text-xs font-medium text-muted-foreground">
              校验结果 · 渲染成功不等于表达准确
            </h4>
            <ul className="flex flex-col gap-1">
              {checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  {c.status === 'pass' && <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-label="通过" />}
                  {c.status === 'warn' && <CircleAlert className="mt-0.5 size-4 shrink-0 text-accent-foreground" aria-label="警告" />}
                  {c.status === 'fail' && <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="失败" />}
                  <span className="flex-1 leading-relaxed">
                    <span className="text-muted-foreground">{c.category} · </span>
                    {c.label}
                    <span className="block text-xs text-muted-foreground">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {!diagram.cells && (
          <section aria-labelledby="adjust-h" className="flex flex-col gap-2">
            <h4 id="adjust-h" className="text-xs font-medium text-muted-foreground">
              调整图形结构（每行一个{kind === 'layered' ? '层：模块、模块' : '步骤'}）
            </h4>
            <Textarea rows={5} value={structureText} onChange={(e) => setStructureText(e.target.value)} className="text-sm" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => generate(textToStructure(structureText, kind))}
              disabled={running || aiRunning}
            >
              <RefreshCw data-icon="inline-start" />
              应用手动调整
            </Button>
          </section>
          )}

          {staleWarning && (
            <div role="alert" className="flex flex-col gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
              <p className="flex items-start gap-2 leading-relaxed">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                来源段落 {source.blockId} 在生成后已被修改或删除，图形可能与当前正文不一致。
              </p>
              <div className="flex gap-2">
                <Button size="xs" onClick={() => insert(true)}>
                  仍然插入
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setStaleWarning(false)}>
                  取消
                </Button>
              </div>
            </div>
          )}

          <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-card py-3">
            <Button onClick={() => insert()} disabled={!target || checks.some((c) => c.status === 'fail')}>
              {target ? '确认插入方案' : '请先在文档中设置插入点'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function Header() {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">Tool02 · 选中文案生成可编辑 draw.io 图形</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        提取系统、层级与步骤，生成源文件与预览图，顾问确认后插入。
      </p>
    </div>
  )
}
