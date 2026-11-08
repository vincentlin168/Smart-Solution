'use client'

import { useCallback, useReducer } from 'react'
import type { Block, ChangeRecord, InsertTarget } from '@/lib/workbench/types'

interface DocState {
  blocks: Block[]
  version: number
  past: { blocks: Block[]; change: ChangeRecord }[]
  future: { blocks: Block[]; change: ChangeRecord }[]
  changes: ChangeRecord[]
}

type Action =
  | { type: 'commit'; blocks: Block[]; label: string; detail: string }
  | { type: 'undo' }
  | { type: 'redo' }

function now() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function reducer(state: DocState, action: Action): DocState {
  switch (action.type) {
    case 'commit': {
      const change: ChangeRecord = {
        id: `chg-${state.version + 1}`,
        version: state.version + 1,
        label: action.label,
        detail: action.detail,
        at: now(),
      }
      return {
        blocks: action.blocks,
        version: state.version + 1,
        past: [...state.past, { blocks: state.blocks, change }],
        future: [],
        changes: [change, ...state.changes],
      }
    }
    case 'undo': {
      const last = state.past[state.past.length - 1]
      if (!last) return state
      const change: ChangeRecord = {
        id: `chg-${state.version + 1}`,
        version: state.version + 1,
        label: '撤销',
        detail: `撤销 v${last.change.version}：${last.change.label}`,
        at: now(),
      }
      return {
        blocks: last.blocks,
        version: state.version + 1,
        past: state.past.slice(0, -1),
        future: [{ blocks: state.blocks, change: last.change }, ...state.future],
        changes: [change, ...state.changes],
      }
    }
    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      const change: ChangeRecord = {
        id: `chg-${state.version + 1}`,
        version: state.version + 1,
        label: '恢复',
        detail: `恢复：${next.change.label}`,
        at: now(),
      }
      return {
        blocks: next.blocks,
        version: state.version + 1,
        past: [...state.past, { blocks: state.blocks, change: next.change }],
        future: state.future.slice(1),
        changes: [change, ...state.changes],
      }
    }
  }
}

let blockCounter = 900

export function newBlockId() {
  blockCounter += 1
  return `blk-${blockCounter.toString().padStart(4, '0')}`
}

export function useDocument(initial: Block[]) {
  const [state, dispatch] = useReducer(reducer, {
    blocks: initial,
    version: 12,
    past: [],
    future: [],
    changes: [
      { id: 'chg-12', version: 12, label: '生成初稿', detail: 'AI 按目录分章节检索并生成 6 章正文', at: '09:41:20' },
      { id: 'chg-11', version: 11, label: '确认目录', detail: '顾问确认方案目录（6 章）', at: '09:36:02' },
    ],
  })

  const insertBlocks = useCallback(
    (target: InsertTarget, newBlocks: Block[], label: string, detail: string) => {
      const index = state.blocks.findIndex((b) => b.id === target.blockId)
      if (index === -1) return false
      const next = [...state.blocks]
      if (target.mode === 'fill') next.splice(index, 1, ...newBlocks)
      else if (target.mode === 'before') next.splice(index, 0, ...newBlocks)
      else next.splice(index + 1, 0, ...newBlocks)
      dispatch({ type: 'commit', blocks: next, label, detail })
      return true
    },
    [state.blocks],
  )

  const updateBlock = useCallback(
    (id: string, patch: Partial<Block>, label: string, detail: string) => {
      dispatch({
        type: 'commit',
        blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        label,
        detail,
      })
    },
    [state.blocks],
  )

  const removeBlock = useCallback(
    (id: string) => {
      const block = state.blocks.find((b) => b.id === id)
      dispatch({
        type: 'commit',
        blocks: state.blocks.filter((b) => b.id !== id),
        label: '删除内容块',
        detail: `删除 ${id}${block?.caption ? `（${block.caption}）` : ''}`,
      })
    },
    [state.blocks],
  )

  return {
    ...state,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    insertBlocks,
    updateBlock,
    removeBlock,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
  }
}

export type DocumentApi = ReturnType<typeof useDocument>

export function chapterOf(blocks: Block[], blockId: string) {
  const index = blocks.findIndex((b) => b.id === blockId)
  for (let i = index; i >= 0; i--) {
    if (blocks[i].type === 'heading') return blocks[i]
  }
  return undefined
}

export function contextAround(blocks: Block[], blockId: string) {
  const chapter = chapterOf(blocks, blockId)
  const index = blocks.findIndex((b) => b.id === blockId)
  const neighbours = blocks
    .slice(Math.max(0, index - 1), index + 2)
    .map((b) => b.text ?? b.items?.join('') ?? '')
    .join('')
  return `${chapter?.text ?? ''}${neighbours}`
}

export function describeTarget(blocks: Block[], target: InsertTarget | null) {
  if (!target) return null
  const block = blocks.find((b) => b.id === target.blockId)
  if (!block) return null
  const chapter = chapterOf(blocks, block.id)
  const action = target.mode === 'fill' ? '填充占位区' : target.mode === 'before' ? '插入到其前' : '插入到其后'
  return { chapter: chapter?.text ?? '文档开头', blockId: block.id, action }
}
