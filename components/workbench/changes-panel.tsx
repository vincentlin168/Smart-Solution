import type { ChangeRecord } from '@/lib/workbench/types'

export function ChangesPanel({ changes }: { changes: ChangeRecord[] }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">文档变更记录</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          每次插入、编辑与确认都是独立变更，统一由文档服务落稿。
        </p>
      </div>
      <ol className="flex flex-col">
        {changes.map((c, i) => (
          <li key={c.id} className="relative flex gap-3 pb-4">
            {i < changes.length - 1 && <span className="absolute top-5 left-[0.6875rem] h-full w-px bg-border" aria-hidden />}
            <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-card text-[10px] tabular-nums text-muted-foreground">
              {c.version}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium">
                {c.label}
                <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">{c.at}</span>
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground break-all">{c.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
