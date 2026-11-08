'use client'

import { AlignLeft } from 'lucide-react'
import type { Block } from '@/lib/workbench/types'

interface OutlinePanelProps {
  blocks: Block[]
  onJump: (blockId: string) => void
}

export function OutlinePanel({ blocks, onJump }: OutlinePanelProps) {
  const headings = blocks.filter((b) => b.type === 'heading')

  if (headings.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
        <p>暂无标题。添加标题后会显示在大纲中。</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <AlignLeft className="size-4" aria-hidden />
        <h2 className="text-sm font-semibold">文章大纲</h2>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-1">
          {headings.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => onJump(h.id)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent ${
                  h.level === 1
                    ? 'font-semibold leading-snug text-foreground'
                    : 'ml-4 text-muted-foreground hover:text-foreground'
                }`}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
