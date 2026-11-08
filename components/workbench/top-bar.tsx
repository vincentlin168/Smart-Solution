'use client'

import { useState } from 'react'
import {
  FileDown,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Settings2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { workflowSteps } from '@/lib/workbench/seed'
import { AiSettingsDialog } from './ai-settings-dialog'

interface TopBarProps {
  version: number
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  currentStep: number
  pendingConfirms: number
  showOutline: boolean
  showProject: boolean
  showRight: boolean
  onToggleOutline: () => void
  onToggleProject: () => void
  onToggleRight: () => void
}

export function TopBar({
  version,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  currentStep,
  pendingConfirms,
  showOutline,
  showProject,
  showRight,
  onToggleOutline,
  onToggleProject,
  onToggleRight,
}: TopBarProps) {
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-3 lg:px-4">
        <Button
          size="icon-sm"
          variant={showOutline ? 'secondary' : 'ghost'}
          onClick={onToggleOutline}
          aria-label={showOutline ? '收起大纲栏' : '展开大纲栏'}
          aria-pressed={showOutline}
          title={showOutline ? '收起大纲栏' : '展开大纲栏'}
          className="hidden lg:inline-flex"
        >
          <ListTree />
        </Button>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary font-serif text-sm font-bold text-primary-foreground">
            案
          </span>
          <span className="hidden text-sm font-semibold sm:inline">售前方案智能工作台</span>
        </div>

        <nav aria-label="方案流程" className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
          <ol className="flex items-center gap-1">
            {workflowSteps.map((step, i) => {
              const state = i < currentStep ? 'done' : i === currentStep ? 'current' : 'todo'
              return (
                <li key={step} className="flex items-center gap-1" aria-current={state === 'current' ? 'step' : undefined}>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs whitespace-nowrap',
                      state === 'done' && 'text-muted-foreground',
                      state === 'current' && 'bg-primary text-primary-foreground',
                      state === 'todo' && 'text-muted-foreground/60',
                    )}
                  >
                    {step}
                  </span>
                  {i < workflowSteps.length - 1 && (
                    <span className={cn('h-px w-3', i < currentStep ? 'bg-primary' : 'bg-border')} aria-hidden />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {pendingConfirms > 0 && (
            <span className="hidden rounded-full bg-accent px-2 py-1 text-xs text-accent-foreground md:inline">
              {pendingConfirms} 项待人工确认
            </span>
          )}
          <span className="px-1 text-xs tabular-nums text-muted-foreground">v{version}</span>
          <Button size="icon-sm" variant="ghost" onClick={onUndo} disabled={!canUndo} aria-label="撤销">
            <Undo2 />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onRedo} disabled={!canRedo} aria-label="恢复">
            <Redo2 />
          </Button>
          <Button
            size="icon-sm"
            variant={showProject ? 'secondary' : 'ghost'}
            onClick={onToggleProject}
            aria-label={showProject ? '收起资料栏' : '展开资料栏'}
            aria-pressed={showProject}
            title={showProject ? '收起资料栏' : '展开资料栏'}
            className="hidden lg:inline-flex"
          >
            {showProject ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setAiSettingsOpen(true)}
            aria-label="配置 AI 模型"
            title="配置 AI 模型"
            className="hidden lg:inline-flex"
          >
            <Settings2 className="size-4" />
          </Button>
          <Button size="sm" onClick={onExport}>
            <FileDown data-icon="inline-start" />
            导出 Word
          </Button>
          <Button
            size="icon-sm"
            variant={showRight ? 'secondary' : 'ghost'}
            onClick={onToggleRight}
            aria-label={showRight ? '收起助手栏' : '展开助手栏'}
            title={showRight ? '收起助手栏' : '展开助手栏'}
            className="hidden lg:inline-flex"
          >
            {showRight ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>
        </div>
      </header>

      <AiSettingsDialog open={aiSettingsOpen} onOpenChange={setAiSettingsOpen} />
    </>
  )
}
