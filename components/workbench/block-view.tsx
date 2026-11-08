'use client'

import { useState } from 'react'
import {
  Download,
  ImageIcon,
  Pencil,
  Shapes,
  Trash2,
  TriangleAlert,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { downloadDrawio } from '@/lib/workbench/export'
import type { Block, InsertTarget, TextSelection } from '@/lib/workbench/types'
import { DiagramSvg } from './diagram-svg'
import type { DocumentApi } from './use-document'

export interface BlockViewProps {
  block: Block
  doc: DocumentApi
  target: InsertTarget | null
  selection: TextSelection | null
  onSelect: (selection: TextSelection | null) => void
  onSetTarget: (target: InsertTarget) => void
  onOpenTool: (tool: 'tool01' | 'tool02', target?: InsertTarget, options?: { keepTarget?: boolean }) => void
  registerSvg: (blockId: string, el: SVGSVGElement | null) => void
}

export function BlockView({
  block,
  doc,
  target,
  selection,
  onSelect,
  onSetTarget,
  onOpenTool,
  registerSvg,
}: BlockViewProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(block.text ?? '')
  const isTarget = target?.blockId === block.id
  const hasSelection = selection?.blockId === block.id

  function handleMouseUp() {
    const sel = window.getSelection()
    const text = sel?.toString().trim() ?? ''
    if (text.length >= 4) {
      onSelect({ blockId: block.id, text, blockTextSnapshot: block.text ?? '' })
    }
  }

  function selectWhole() {
    onSelect({ blockId: block.id, text: block.text ?? '', blockTextSnapshot: block.text ?? '' })
  }

  const textual = block.type === 'paragraph'

  return (
    <div
      data-block-id={block.id}
      className={cn(
        'group relative grid grid-cols-[4.5rem_1fr] gap-4 rounded-md py-1.5 lg:grid-cols-[5.5rem_1fr]',
        isTarget && target?.mode === 'fill' && 'bg-primary/5 ring-2 ring-primary/40',
      )}
    >
      <div className="flex flex-col items-end gap-1 pt-1 text-right">
        <span className="text-[11px] leading-none tracking-tight text-muted-foreground tabular-nums">{block.id}</span>
        {block.refs?.length ? (
          <span className="flex flex-wrap justify-end gap-0.5">
            {block.refs.map((r) => (
              <span key={r} className="rounded bg-secondary px-1 text-[10px] leading-4 text-secondary-foreground">
                {r}
              </span>
            ))}
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        {block.type === 'heading' && (
          <h2 className="font-serif text-xl font-semibold leading-snug text-foreground text-balance">{block.text}</h2>
        )}

        {textual && !editing && (
          <p
            onMouseUp={handleMouseUp}
            className={cn(
              'cursor-text text-[15px] leading-7 text-foreground/90 text-pretty selection:bg-primary/20',
              hasSelection && 'rounded bg-primary/5',
            )}
          >
            {block.text}
          </p>
        )}

        {textual && editing && (
          <div className="flex flex-col gap-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="text-[15px] leading-7" />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  doc.updateBlock(block.id, { text: draft }, '编辑正文', `顾问修改 ${block.id}`)
                  setEditing(false)
                }}
              >
                保存
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                取消
              </Button>
            </div>
          </div>
        )}

        {block.type === 'list' && (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-7 text-foreground/90 marker:text-primary">
            {block.items?.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        {block.type === 'image' && block.material && (
          <figure className="flex flex-col gap-2">
            <div className="overflow-hidden rounded-md border bg-card">
              <img
                src={block.material.image || '/placeholder.svg'}
                alt={block.caption ?? block.material.title}
                className="aspect-video w-full object-cover"
              />
            </div>
            <CaptionEditor block={block} doc={doc} />
            <p className="text-xs text-muted-foreground">
              {block.material.id} · {block.material.file}
              {block.material.page ? ` 第${block.material.page}页` : ''} · {block.material.license}
            </p>
          </figure>
        )}

        {block.type === 'diagram' && block.diagram && (
          <figure className="flex flex-col gap-2">
            <div className="overflow-x-auto rounded-md border bg-card p-2">
              <DiagramSvg
                ref={(el) => registerSvg(block.id, el)}
                diagram={block.diagram}
                className="h-auto w-full min-w-[480px]"
              />
            </div>
            <CaptionEditor block={block} doc={doc} />
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {block.diagram.id} · draw.io 源文件已保存 · {block.diagram.cells ? block.diagram.cells.filter((c) => c.kind === 'vertex').length : block.diagram.nodes.length} 节点
              </span>
              <button
                type="button"
                onClick={() => block.diagram && downloadDrawio(block.diagram)}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Download className="size-3" aria-hidden />
                下载 .drawio
              </button>
            </p>
          </figure>
        )}

        {block.type === 'placeholder' && (
          <div className="flex flex-col gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-primary">{block.text}</span>
            {block.suggestion && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenTool(block.suggestion!, { blockId: block.id, mode: 'fill' })}
              >
                {block.suggestion === 'tool01' ? <ImageIcon data-icon="inline-start" /> : <Shapes data-icon="inline-start" />}
                {block.suggestion === 'tool01' ? '用 Tool01 搜索素材' : '用 Tool02 生成图形'}
              </Button>
            )}
          </div>
        )}

        {block.confirm && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="flex-1 leading-relaxed">待确认：{block.confirm}</span>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
              onClick={() => doc.updateBlock(block.id, { confirm: undefined }, '人工确认', `顾问确认 ${block.id}`)}
            >
              <Check className="size-3" aria-hidden />
              已确认
            </button>
          </div>
        )}

        {hasSelection && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5 shadow-sm">
            <span className="px-1 text-xs text-muted-foreground">已选 {selection!.text.length} 字</span>
            <Button
              size="xs"
              onClick={() => onOpenTool('tool02', { blockId: block.id, mode: 'after' }, { keepTarget: true })}
            >
              <Shapes data-icon="inline-start" />
              生成图形
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => onOpenTool('tool01', { blockId: block.id, mode: 'after' }, { keepTarget: true })}
            >
              <ImageIcon data-icon="inline-start" />
              搜索素材
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onSelect(null)}>
              取消选择
            </Button>
          </div>
        )}

        <div className="mt-1 flex h-6 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {textual && !editing && (
            <>
              <HoverAction
                onClick={() => {
                  setDraft(block.text ?? '')
                  setEditing(true)
                }}
                icon={<Pencil />}
              >
                编辑
              </HoverAction>
              <HoverAction onClick={selectWhole} icon={<Shapes />}>
                选中整段
              </HoverAction>
            </>
          )}
          {(block.type === 'image' || block.type === 'diagram') && (
            <HoverAction onClick={() => doc.removeBlock(block.id)} icon={<Trash2 />}>
              删除
            </HoverAction>
          )}
        </div>

      </div>
    </div>
  )
}

function HoverAction({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground [&_svg]:size-3"
    >
      {icon}
      {children}
    </button>
  )
}

function CaptionEditor({ block, doc }: { block: Block; doc: DocumentApi }) {
  const [value, setValue] = useState(block.caption ?? '')
  return (
    <Input
      aria-label="图注"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== block.caption) doc.updateBlock(block.id, { caption: value }, '编辑图注', `${block.id} 图注：${value}`)
      }}
      className="mx-auto h-7 max-w-md border-transparent bg-transparent text-center text-sm text-muted-foreground shadow-none hover:border-input focus-visible:border-input"
    />
  )
}
