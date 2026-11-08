import { Crosshair } from 'lucide-react'
import type { Block, InsertTarget } from '@/lib/workbench/types'

interface TargetPickerProps {
  blocks: Block[]
  target: InsertTarget | null
  onChange: (target: InsertTarget | null) => void
}

function snippet(block: Block) {
  const text =
    block.type === 'image' || block.type === 'diagram'
      ? `[图] ${block.caption ?? ''}`
      : (block.text ?? block.items?.[0] ?? '')
  return text.length > 14 ? `${text.slice(0, 14)}…` : text
}

function buildOptions(blocks: Block[]) {
  const groups: { chapter: string; options: { value: string; label: string }[] }[] = []
  if (blocks[0]) {
    groups.push({ chapter: '文档开头', options: [{ value: `before:${blocks[0].id}`, label: '插入到文档最前' }] })
  }
  blocks.forEach((block) => {
    if (block.type === 'heading') {
      groups.push({ chapter: block.text ?? '', options: [] })
    }
    const group = groups[groups.length - 1]
    if (block.type === 'placeholder') {
      group.options.push({ value: `fill:${block.id}`, label: `填充占位区 · ${snippet(block)}` })
    }
    group.options.push({
      value: `after:${block.id}`,
      label: block.type === 'heading' ? '章节标题之后' : `${snippet(block)} 之后`,
    })
  })
  return groups
}

export function TargetPicker({ blocks, target, onChange }: TargetPickerProps) {
  const value = target ? `${target.mode}:${target.blockId}` : ''
  const groups = buildOptions(blocks)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="insert-target" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Crosshair className="size-3" aria-hidden />
        插入位置
      </label>
      <select
        id="insert-target"
        value={value}
        onChange={(e) => {
          const [mode, blockId] = e.target.value.split(':')
          onChange(blockId ? { mode: mode as InsertTarget['mode'], blockId } : null)
        }}
        className={
          target
            ? 'h-9 w-full rounded-md border border-primary/40 bg-primary/5 px-2 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
            : 'h-9 w-full rounded-md border border-dashed bg-card px-2 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
        }
      >
        <option value="">请选择插入位置…</option>
        {groups.map((g) => (
          <optgroup key={g.chapter} label={g.chapter}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        也可在文档任意两段之间点击「+ 插入」，位置按内容块 ID 定位，正文变化后不会错位。
      </p>
    </div>
  )
}
