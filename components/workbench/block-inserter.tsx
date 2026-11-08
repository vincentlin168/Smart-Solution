'use client'

import { useState } from 'react'
import { Crosshair, ImageIcon, Plus, Shapes, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InsertTarget } from '@/lib/workbench/types'

interface BlockInserterProps {
  position: InsertTarget
  active: boolean
  label: string
  onSetTarget: (target: InsertTarget) => void
  onOpenTool: (tool: 'tool01' | 'tool02', target: InsertTarget) => void
}

export function BlockInserter({ position, active, label, onSetTarget, onOpenTool }: BlockInserterProps) {
  const [open, setOpen] = useState(false)

  function choose(action: 'tool01' | 'tool02' | 'target') {
    setOpen(false)
    if (action === 'target') onSetTarget(position)
    else onOpenTool(action, position)
  }

  return (
    <div className="group/ins relative grid grid-cols-[4.5rem_1fr] gap-4 lg:grid-cols-[5.5rem_1fr]">
      <span aria-hidden />
      <div className="flex min-h-6 flex-col justify-center">
        {open ? (
          <div
            role="menu"
            aria-label={`在${label}插入`}
            className="my-1 flex flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 shadow-sm"
          >
            <span className="px-1 text-xs text-muted-foreground">在此插入</span>
            <MenuButton onClick={() => choose('tool01')} icon={<ImageIcon />}>
              Tool01 · PPT页面/图片
            </MenuButton>
            <MenuButton onClick={() => choose('tool02')} icon={<Shapes />}>
              Tool02 · 生成图形
            </MenuButton>
            <MenuButton onClick={() => choose('target')} icon={<Crosshair />}>
              仅设为插入点
            </MenuButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="关闭"
              className="ml-auto rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`在${label}插入素材或图形`}
            aria-haspopup="menu"
            className={cn(
              'flex h-4 w-full items-center gap-2 rounded transition-opacity focus-visible:opacity-100 focus-visible:outline-none',
              active ? 'opacity-100' : 'opacity-25 group-hover/ins:opacity-100',
            )}
          >
            <span className={cn('h-0.5 flex-1 rounded', active ? 'bg-primary' : 'bg-primary/40')} />
            <span
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 text-[11px] leading-4',
                active ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/40 bg-card text-primary',
              )}
            >
              {active ? <Crosshair className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}
              {active ? '插入点' : '插入'}
            </span>
            <span className={cn('h-0.5 flex-1 rounded', active ? 'bg-primary' : 'bg-primary/40')} />
          </button>
        )}
      </div>
    </div>
  )
}

function MenuButton({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:border-primary/50 hover:bg-primary/5 [&_svg]:size-3.5 [&_svg]:text-primary"
    >
      {icon}
      {children}
    </button>
  )
}
