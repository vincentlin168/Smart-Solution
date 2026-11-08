'use client'

import { Fragment } from 'react'
import type { InsertTarget, TextSelection } from '@/lib/workbench/types'
import { project } from '@/lib/workbench/seed'
import { BlockInserter } from './block-inserter'
import { BlockView } from './block-view'
import type { DocumentApi } from './use-document'

interface DocumentEditorProps {
  doc: DocumentApi
  target: InsertTarget | null
  selection: TextSelection | null
  onSelect: (selection: TextSelection | null) => void
  onSetTarget: (target: InsertTarget) => void
  onOpenTool: (tool: 'tool01' | 'tool02', target?: InsertTarget, options?: { keepTarget?: boolean }) => void
  registerSvg: (blockId: string, el: SVGSVGElement | null) => void
}

function isSameTarget(a: InsertTarget | null, b: InsertTarget) {
  return a?.blockId === b.blockId && a.mode === b.mode
}

export function DocumentEditor(props: DocumentEditorProps) {
  const { doc, target, onSetTarget, onOpenTool } = props
  const first = doc.blocks[0]

  return (
    <div className="h-full overflow-y-auto bg-background">
      <article
        aria-label="方案文档"
        className="mx-auto my-4 flex max-w-3xl flex-col rounded-lg border bg-card px-3 py-8 shadow-sm sm:px-6 lg:my-8 lg:py-12"
      >
        <header className="mb-4 flex flex-col items-center gap-2 px-4 text-center">
          <span className="text-xs tracking-widest text-muted-foreground">
            {project.customer} · {project.id}
          </span>
          <h1 className="font-serif text-2xl font-bold leading-tight text-foreground text-balance lg:text-3xl">
            {project.title}
          </h1>
          <span className="text-xs text-muted-foreground">
            文档版本 v{doc.version} · 面向：{project.audience}
          </span>
        </header>

        {first && (
          <BlockInserter
            position={{ blockId: first.id, mode: 'before' }}
            active={isSameTarget(target, { blockId: first.id, mode: 'before' })}
            label="文档开头"
            onSetTarget={onSetTarget}
            onOpenTool={onOpenTool}
          />
        )}

        {doc.blocks.map((block) => {
          const after: InsertTarget = { blockId: block.id, mode: 'after' }
          return (
            <Fragment key={block.id}>
              <BlockView block={block} {...props} />
              <BlockInserter
                position={after}
                active={isSameTarget(target, after)}
                label={`${block.id} 之后`}
                onSetTarget={onSetTarget}
                onOpenTool={onOpenTool}
              />
            </Fragment>
          )
        })}
      </article>
    </div>
  )
}
