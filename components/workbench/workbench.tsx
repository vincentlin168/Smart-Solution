'use client'

import { useCallback, useRef, useState } from 'react'
import { FileText, FolderOpen, Sparkles } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { initialBlocks, project } from '@/lib/workbench/seed'
import { exportWord, svgElementToString } from '@/lib/workbench/export'
import type { InsertTarget, TextSelection } from '@/lib/workbench/types'
import { AiConfigProvider } from './ai-config-context'
import { BriefPanel } from './brief-panel'
import { ChangesPanel } from './changes-panel'
import { DocumentEditor } from './document-editor'
import { OutlinePanel } from './outline-panel'
import { ProjectPanel } from './project-panel'
import { Tool01Panel } from './tool01-panel'
import { Tool02Panel } from './tool02-panel'
import { TopBar } from './top-bar'
import { useDocument } from './use-document'

type AssistantTab = 'brief' | 'tool01' | 'tool02' | 'changes'
type MobilePanel = 'project' | 'document' | 'assistant'

export function Workbench() {
  const doc = useDocument(initialBlocks)
  const [selection, setSelection] = useState<TextSelection | null>(null)
  const [target, setTarget] = useState<InsertTarget | null>(null)
  const [tab, setTab] = useState<AssistantTab>('brief')
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('document')
  const [toolSeed, setToolSeed] = useState(0)
  const [showOutline, setShowOutline] = useState(false)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)
  const svgRegistry = useRef(new Map<string, SVGSVGElement>())

  const registerSvg = useCallback((blockId: string, el: SVGSVGElement | null) => {
    if (el) svgRegistry.current.set(blockId, el)
    else svgRegistry.current.delete(blockId)
  }, [])

  function scrollToBlock(blockId: string, block: ScrollLogicalPosition = 'center') {
    setMobilePanel('document')
    requestAnimationFrame(() =>
      document.querySelector(`[data-block-id="${blockId}"]`)?.scrollIntoView({ behavior: 'smooth', block }),
    )
  }

  function openTool(tool: 'tool01' | 'tool02', nextTarget?: InsertTarget, options?: { keepTarget?: boolean }) {
    const applyTarget = nextTarget && !(options?.keepTarget && target)
    if (applyTarget) setTarget(nextTarget)
    if (applyTarget && nextTarget.mode === 'fill') setSelection(null)
    setToolSeed((s) => s + 1)
    setTab(tool)
    setShowRight(true)
    setMobilePanel('assistant')
  }

  function handleInserted(blockId: string) {
    setTarget(null)
    setSelection(null)
    scrollToBlock(blockId)
  }

  function handleExport() {
    const svgs: Record<string, string> = {}
    svgRegistry.current.forEach((el, id) => (svgs[id] = svgElementToString(el)))
    exportWord(project.title, doc.blocks, svgs)
  }

  const hasImage = doc.blocks.some((b) => b.type === 'image')
  const hasDiagram = doc.blocks.some((b) => b.type === 'diagram')
  const currentStep = hasImage && hasDiagram ? 6 : hasDiagram ? 5 : 4
  const pendingConfirms = doc.blocks.filter((b) => b.confirm).length

  const tool01Key = `${toolSeed}|${selection?.text ?? ''}`
  const tool02Key = selection ? `sel|${selection.blockId}|${selection.text}` : `seed|${toolSeed}`

  return (
    <AiConfigProvider>
      <div className="flex h-dvh flex-col bg-background">
        <TopBar
        version={doc.version}
        canUndo={doc.canUndo}
        canRedo={doc.canRedo}
        onUndo={doc.undo}
        onRedo={doc.redo}
        onExport={handleExport}
        currentStep={currentStep}
        pendingConfirms={pendingConfirms}
        showOutline={showOutline}
        showProject={showLeft}
        showRight={showRight}
        onToggleOutline={() => setShowOutline((v) => !v)}
        onToggleProject={() => setShowLeft((v) => !v)}
        onToggleRight={() => setShowRight((v) => !v)}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          aria-label="文章大纲"
          className={cn('hidden min-h-0 shrink-0 border-r lg:w-60', showOutline && 'lg:block')}
        >
          <OutlinePanel blocks={doc.blocks} onJump={(id) => scrollToBlock(id, 'start')} />
        </aside>

        <aside
          aria-label="项目资料与知识来源"
          className={cn(
            'min-h-0 shrink-0 border-r lg:w-72',
            mobilePanel === 'project' ? 'block' : 'hidden',
            showLeft ? 'lg:block' : 'lg:hidden',
          )}
        >
          <ProjectPanel blocks={doc.blocks} />
        </aside>

        <main className={cn('min-h-0 min-w-0 flex-1 lg:block', mobilePanel === 'document' ? 'block' : 'hidden')}>
          <DocumentEditor
            doc={doc}
            target={target}
            selection={selection}
            onSelect={setSelection}
            onSetTarget={setTarget}
            onOpenTool={openTool}
            registerSvg={registerSvg}
          />
        </main>

        <aside
          aria-label="AI助手与工具"
          className={cn(
            'min-h-0 shrink-0 border-l bg-card lg:w-96',
            mobilePanel === 'assistant' ? 'block' : 'hidden',
            showRight ? 'lg:block' : 'lg:hidden',
          )}
        >
          <Tabs value={tab} onValueChange={(v) => setTab(v as AssistantTab)} className="h-full gap-0">
            <TabsList variant="line" className="w-full shrink-0 justify-start border-b px-3">
              <TabsTrigger value="brief">任务书</TabsTrigger>
              <TabsTrigger value="tool01">Tool01</TabsTrigger>
              <TabsTrigger value="tool02">Tool02</TabsTrigger>
              <TabsTrigger value="changes">变更</TabsTrigger>
            </TabsList>
            <TabsContent value="brief" className="min-h-0 overflow-y-auto">
              <BriefPanel blocks={doc.blocks} onJump={scrollToBlock} />
            </TabsContent>
            <TabsContent value="tool01" className="min-h-0 overflow-y-auto">
              <Tool01Panel
                key={tool01Key}
                doc={doc}
                target={target}
                selection={selection}
                onSetTarget={setTarget}
                onInserted={handleInserted}
              />
            </TabsContent>
            <TabsContent value="tool02" className="min-h-0 overflow-y-auto">
              <Tool02Panel
                key={tool02Key}
                doc={doc}
                target={target}
                selection={selection}
                onSetTarget={setTarget}
                onInserted={handleInserted}
              />
            </TabsContent>
            <TabsContent value="changes" className="min-h-0 overflow-y-auto">
              <ChangesPanel changes={doc.changes} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      <nav aria-label="切换面板" className="grid shrink-0 grid-cols-3 border-t bg-card lg:hidden">
        {(
          [
            { id: 'project', label: '资料', icon: FolderOpen },
            { id: 'document', label: '文档', icon: FileText },
            { id: 'assistant', label: '助手', icon: Sparkles },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobilePanel(id)}
            aria-pressed={mobilePanel === id}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-xs',
              mobilePanel === id ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

        <Toaster
          position="bottom-center"
          theme="light"
          style={{ fontFamily: 'var(--font-noto-sans), "PingFang SC", "Microsoft YaHei", sans-serif' }}
          toastOptions={{ style: { fontFamily: 'inherit' } }}
        />
      </div>
    </AiConfigProvider>
  )
}
