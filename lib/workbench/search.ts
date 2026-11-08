import type { Material, MaterialScope, MaterialType } from './types'

function bigrams(text: string) {
  const clean = text.replace(/[\s，。、；：,.;:“”"'（）()]/g, '')
  const grams = new Set<string>()
  for (let i = 0; i < clean.length - 1; i++) grams.add(clean.slice(i, i + 2))
  return grams
}

export interface ScoredMaterial {
  material: Material
  score: number
  reasons: string[]
}

export function searchMaterials(
  library: Material[],
  options: {
    query: string
    context: string
    types: MaterialType[]
    scopes: MaterialScope[]
    preferApproved: boolean
  },
): ScoredMaterial[] {
  const queryGrams = bigrams(options.query)
  const contextGrams = bigrams(options.context)

  return library
    .filter((m) => options.scopes.includes(m.scope))
    .filter((m) => options.types.length === 0 || options.types.includes(m.type))
    .map((m) => {
      const haystack = bigrams(`${m.title}${m.tags.join('')}${m.description}`)
      let q = 0
      let c = 0
      queryGrams.forEach((g) => haystack.has(g) && q++)
      contextGrams.forEach((g) => haystack.has(g) && c++)
      const reasons: string[] = []
      const matchedTags = m.tags.filter((t) => options.query.includes(t) || options.context.includes(t))
      if (matchedTags.length) reasons.push(`匹配：${matchedTags.slice(0, 3).join('、')}`)
      if (c > 0) reasons.push('与当前章节相关')
      if (m.approved) reasons.push('已审核素材')
      const raw =
        (queryGrams.size ? q / queryGrams.size : 0) * 0.6 +
        Math.min(c / 6, 1) * 0.25 +
        (options.preferApproved && m.approved ? 0.15 : 0)
      return { material: m, score: Math.min(0.99, raw), reasons }
    })
    .filter((r) => r.score > 0.12)
    .sort((a, b) => b.score - a.score)
}
