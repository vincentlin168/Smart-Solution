'use client'

import { CircleHelp, Lightbulb, Quote, UserRound } from 'lucide-react'
import { briefFacts, briefGaps, briefSuggestions, consultantIntent } from '@/lib/workbench/seed'
import type { Block } from '@/lib/workbench/types'

export function BriefPanel({ blocks, onJump }: { blocks: Block[]; onJump: (blockId: string) => void }) {
  const chapters = blocks.filter((b) => b.type === 'heading')

  function chapterStatus(headingId: string) {
    const start = blocks.findIndex((b) => b.id === headingId)
    const nextHeading = blocks.findIndex((b, i) => i > start && b.type === 'heading')
    const section = blocks.slice(start + 1, nextHeading === -1 ? undefined : nextHeading)
    if (section.some((b) => b.confirm)) return { label: '需确认', tone: 'accent' as const }
    if (section.some((b) => b.type === 'placeholder' && b.suggestion)) return { label: '待补图', tone: 'primary' as const }
    if (section.some((b) => b.type === 'placeholder')) return { label: '人工填写', tone: 'muted' as const }
    return { label: '已完成', tone: 'muted' as const }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      <section aria-labelledby="brief-h" className="flex flex-col gap-3">
        <h3 id="brief-h" className="text-sm font-semibold">
          方案任务书
        </h3>

        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Quote className="size-3" aria-hidden />
            客户事实
          </p>
          <ul className="flex flex-col gap-1">
            {briefFacts.map((f) => (
              <li key={f.text} className="flex items-start justify-between gap-2 text-sm leading-relaxed">
                <span>{f.text}</span>
                <span className="shrink-0 rounded bg-secondary px-1 text-[10px] leading-4">{f.source}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <UserRound className="size-3" aria-hidden />
            顾问判断
          </p>
          <p className="text-sm leading-relaxed">{consultantIntent}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Lightbulb className="size-3" aria-hidden />
            AI 建议（未写入正文）
          </p>
          <ul className="flex flex-col gap-1">
            {briefSuggestions.map((s) => (
              <li key={s} className="text-sm leading-relaxed text-primary">
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-accent-foreground">
            <CircleHelp className="size-3" aria-hidden />
            信息缺口
          </p>
          <ul className="flex flex-col gap-1">
            {briefGaps.map((g) => (
              <li key={g} className="rounded-md bg-accent px-2 py-1 text-sm leading-relaxed text-accent-foreground">
                {g}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="outline-h" className="flex flex-col gap-2">
        <h3 id="outline-h" className="text-sm font-semibold">
          方案目录
        </h3>
        <ol className="flex flex-col">
          {chapters.map((c) => {
            const status = chapterStatus(c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onJump(c.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                >
                  <span className="truncate">{c.text}</span>
                  <span
                    className={
                      status.tone === 'accent'
                        ? 'shrink-0 rounded px-1.5 text-[11px] bg-accent text-accent-foreground'
                        : status.tone === 'primary'
                          ? 'shrink-0 rounded px-1.5 text-[11px] bg-primary/10 text-primary'
                          : 'shrink-0 text-[11px] text-muted-foreground'
                    }
                  >
                    {status.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
