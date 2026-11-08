'use client'

import { useState } from 'react'
import { Check, Globe, Loader2, Search, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { materials } from '@/lib/workbench/seed'
import { searchMaterials, type ScoredMaterial } from '@/lib/workbench/search'
import type { InsertTarget, MaterialScope, MaterialType, TextSelection } from '@/lib/workbench/types'
import { TargetPicker } from './target-banner'
import { contextAround, describeTarget, newBlockId, type DocumentApi } from './use-document'

const TYPE_OPTIONS: { value: MaterialType; label: string }[] = [
  { value: 'ppt', label: 'PPT页面' },
  { value: 'architecture', label: '架构图' },
  { value: 'flow', label: '流程图' },
  { value: 'screenshot', label: '截图' },
]

const SCOPE_OPTIONS: { value: MaterialScope; label: string }[] = [
  { value: 'internal', label: '企业内部' },
  { value: 'project', label: '当前项目' },
]

interface Tool01PanelProps {
  doc: DocumentApi
  target: InsertTarget | null
  selection: TextSelection | null
  onSetTarget: (target: InsertTarget | null) => void
  onInserted: (blockId: string) => void
}

function initialQuery(doc: DocumentApi, target: InsertTarget | null, selection: TextSelection | null) {
  if (selection) return selection.text.slice(0, 60)
  const block = doc.blocks.find((b) => b.id === target?.blockId)
  if (block?.type === 'placeholder') return (block.text ?? '').replace(/^建议补充[：:]/, '')
  return ''
}

export function Tool01Panel({ doc, target, selection, onSetTarget, onInserted }: Tool01PanelProps) {
  const [query, setQuery] = useState(() => initialQuery(doc, target, selection))
  const [types, setTypes] = useState<MaterialType[]>([])
  const [scopes, setScopes] = useState<MaterialScope[]>(['internal', 'project'])
  const [preferApproved, setPreferApproved] = useState(true)
  const [status, setStatus] = useState<'idle' | 'searching' | 'done'>('idle')
  const [results, setResults] = useState<ScoredMaterial[]>([])
  const [chosen, setChosen] = useState<string | null>(null)

  function toggle<T>(list: T[], value: T) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  function runSearch() {
    if (!query.trim()) return
    setStatus('searching')
    setChosen(null)
    const context = target ? contextAround(doc.blocks, target.blockId) : ''
    setTimeout(() => {
      setResults(searchMaterials(materials, { query, context, types, scopes, preferApproved }))
      setStatus('done')
    }, 600)
  }

  function insert() {
    const result = results.find((r) => r.material.id === chosen)
    if (!result || !target) return
    const id = newBlockId()
    const m = result.material
    const ok = doc.insertBlocks(
      target,
      [{ id, type: 'image', material: m, caption: m.title }],
      'Tool01 插入素材',
      `${m.id}「${m.title}」${m.page ? `（${m.file} 第${m.page}页）` : ''} → ${describeTarget(doc.blocks, target)?.chapter} · ${target.blockId} ${describeTarget(doc.blocks, target)?.action}`,
    )
    if (ok) {
      toast.success('素材已插入方案', { description: `${m.title} · 已保存来源关联` })
      setChosen(null)
      onInserted(id)
    } else {
      toast.error('目标位置已不存在，请重新选择插入点')
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Tool01 · 搜索并插入 PPT 页面或图片</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">结合当前章节上下文，在授权范围内检索可交付素材。</p>
      </div>

      <TargetPicker blocks={doc.blocks} target={target} onChange={onSetTarget} />

      <div className="flex flex-col gap-2">
        <label htmlFor="t1-query" className="text-xs font-medium text-muted-foreground">
          搜索描述
        </label>
        <Textarea
          id="t1-query"
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例如：一页能够表达集团财务共享架构的PPT"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault()
              runSearch()
            }
          }}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-medium text-muted-foreground">素材类型（不选为全部）</legend>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map((o) => (
            <Chip key={o.value} active={types.includes(o.value)} onClick={() => setTypes((t) => toggle(t, o.value))}>
              {o.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-medium text-muted-foreground">检索范围</legend>
        <div className="flex flex-wrap gap-1.5">
          {SCOPE_OPTIONS.map((o) => (
            <Chip key={o.value} active={scopes.includes(o.value)} onClick={() => setScopes((s) => toggle(s, o.value))}>
              {o.label}
            </Chip>
          ))}
          <Chip active={false} disabled onClick={() => undefined}>
            <Globe className="size-3" aria-hidden />
            互联网 · 后续扩展
          </Chip>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={preferApproved}
            onChange={(e) => setPreferApproved(e.target.checked)}
            className="accent-primary"
          />
          优先使用公司已审核素材
        </label>
      </fieldset>

      <Button onClick={runSearch} disabled={!query.trim() || scopes.length === 0 || status === 'searching'}>
        {status === 'searching' ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Search data-icon="inline-start" />}
        {status === 'searching' ? '检索中' : '检索素材'}
      </Button>

      {status === 'done' && (
        <section aria-label="候选素材" className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {results.length ? `找到 ${results.length} 个候选 · 已按权限过滤` : '未找到匹配素材，请调整描述或范围'}
          </p>
          <ul className="flex flex-col gap-2">
            {results.map(({ material: m, score, reasons }) => {
              const active = chosen === m.id
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setChosen(active ? null : m.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full flex-col gap-2 rounded-lg border bg-card p-2 text-left transition-colors hover:border-primary/50',
                      active && 'border-primary ring-2 ring-primary/30',
                    )}
                  >
                    <div className="relative overflow-hidden rounded-md">
                      <img src={m.image || '/placeholder.svg'} alt={m.title} className="aspect-video w-full object-cover" />
                      {active && (
                        <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3.5" aria-hidden />
                        </span>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-2 px-1">
                      <span className="text-sm font-medium leading-snug">{m.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-primary">{Math.round(score * 100)}%</span>
                    </div>
                    <p className="px-1 text-xs text-muted-foreground">
                      {m.file}
                      {m.page ? ` · 第${m.page}页` : ''} · {m.version}
                    </p>
                    <p className="px-1 text-xs leading-relaxed text-foreground/80">{m.description}</p>
                    <div className="flex flex-wrap items-center gap-1 px-1 pb-1">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-1.5 text-[11px] leading-5',
                          m.approved ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground',
                        )}
                      >
                        <ShieldCheck className="size-3" aria-hidden />
                        {m.license}
                      </span>
                      {reasons
                        .filter((r) => r !== '已审核素材')
                        .map((r) => (
                          <span key={r} className="rounded bg-secondary px-1.5 text-[11px] leading-5 text-secondary-foreground">
                            {r}
                          </span>
                        ))}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {chosen && (
        <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-card py-3">
          <p className="text-xs text-muted-foreground">将以页面图片插入，保留原始文件与页码引用。</p>
          <Button onClick={insert} disabled={!target}>
            {target ? '确认插入方案' : '请先在文档中设置插入点'}
          </Button>
        </div>
      )}
    </div>
  )
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50',
        disabled && 'cursor-not-allowed opacity-50 hover:border-border',
      )}
    >
      {children}
    </button>
  )
}

export { Chip }
