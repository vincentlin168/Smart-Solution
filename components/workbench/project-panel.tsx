'use client'

import { BookOpen, Building2, Download, FileText, ImageIcon, Lock, Shapes, Upload } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { consultantIntent, project, projectFiles, sources } from '@/lib/workbench/seed'
import { downloadDrawio } from '@/lib/workbench/export'
import type { Block } from '@/lib/workbench/types'

const sourceKindLabel = { project: '项目资料', knowledge: '产品知识', case: '脱敏案例' } as const

export function ProjectPanel({ blocks }: { blocks: Block[] }) {
  const usedRefs = new Set(blocks.flatMap((b) => b.refs ?? []))
  const assets = blocks.filter((b) => b.type === 'image' || b.type === 'diagram')

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex flex-col gap-1 border-b px-4 py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="size-3.5" aria-hidden />
          项目空间 · {project.id}
        </div>
        <p className="font-serif text-base font-semibold leading-snug">{project.customer}</p>
        <p className="text-xs text-muted-foreground">
          {project.owner} · {project.sales}
        </p>
      </div>

      <Tabs defaultValue="files" className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className="w-full justify-start border-b px-3">
          <TabsTrigger value="files">资料</TabsTrigger>
          <TabsTrigger value="knowledge">知识来源</TabsTrigger>
          <TabsTrigger value="assets">
            素材
            {assets.length > 0 && <span className="text-[10px] tabular-nums text-primary">{assets.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="min-h-0 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-5">
            <section aria-labelledby="files-h" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 id="files-h" className="text-xs font-medium text-muted-foreground">
                  客户资料
                </h3>
                <button type="button" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Upload className="size-3" aria-hidden />
                  导入
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {projectFiles.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
                    <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.kind} · {f.by} · {f.date}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="intent-h" className="flex flex-col gap-2">
              <h3 id="intent-h" className="text-xs font-medium text-muted-foreground">
                顾问方案思路
              </h3>
              <p className="rounded-md border bg-card px-3 py-2 text-sm leading-relaxed">{consultantIntent}</p>
            </section>

            <section aria-labelledby="tpl-h" className="flex flex-col gap-2">
              <h3 id="tpl-h" className="text-xs font-medium text-muted-foreground">
                模板与交付
              </h3>
              <dl className="grid grid-cols-[4rem_1fr] gap-y-1 text-sm">
                <dt className="text-muted-foreground">模板</dt>
                <dd>{project.template}</dd>
                <dt className="text-muted-foreground">格式</dt>
                <dd>{project.format}</dd>
              </dl>
            </section>

            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
              客户资料仅服务于本授权项目，与企业共享知识库逻辑隔离。
            </p>
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="min-h-0 overflow-y-auto px-4 py-4">
          <ul className="flex flex-col gap-2">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 rounded-md border bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-secondary px-1 text-[10px] leading-4">{s.id}</span>
                  <span className="truncate text-sm font-medium">{s.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.location}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    <BookOpen data-icon="inline-start" />
                    {sourceKindLabel[s.kind]}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">{usedRefs.has(s.id) ? '已在正文引用' : '未引用'}</span>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="assets" className="min-h-0 overflow-y-auto px-4 py-4">
          {assets.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm leading-relaxed text-muted-foreground">
              尚无插入的素材。通过 Tool01 插入 PPT 页面或图片，或用 Tool02 生成 draw.io 图形后会出现在这里。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {assets.map((b) => (
                <li key={b.id} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2">
                  {b.type === 'image' ? (
                    <ImageIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <Shapes className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{b.caption}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.material?.id ?? b.diagram?.id} · 位于 {b.id}
                    </p>
                  </div>
                  {b.diagram && (
                    <button
                      type="button"
                      aria-label="下载 draw.io 源文件"
                      onClick={() => b.diagram && downloadDrawio(b.diagram)}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Download className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
