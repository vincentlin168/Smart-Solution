import type { Block, Diagram } from './types'

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadDrawio(diagram: Diagram) {
  downloadBlob(diagram.xml, `${diagram.title}.drawio`, 'application/xml')
}

export function svgElementToString(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(clone)
}

export async function svgToPngBlob(svgString: string, width: number, height: number, scale = 2) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(url)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png'),
  )
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function exportWord(title: string, blocks: Block[], diagramSvgs: Record<string, string>) {
  const origin = window.location.origin
  const body = blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return `<h${b.level === 2 ? 2 : 1}>${escapeHtml(b.text ?? '')}</h${b.level === 2 ? 2 : 1}>`
        case 'paragraph':
          return `<p>${escapeHtml(b.text ?? '')}</p>`
        case 'list':
          return `<ul>${(b.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
        case 'image':
          return `<p><img src="${origin}${b.material?.image}" width="560" /></p><p class="cap">${escapeHtml(b.caption ?? '')}</p>`
        case 'diagram':
          return `${diagramSvgs[b.id] ?? ''}<p class="cap">${escapeHtml(b.caption ?? '')}</p>`
        default:
          return ''
      }
    })
    .join('\n')
  const html = `<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:"Microsoft YaHei",sans-serif;line-height:1.6}h1{font-size:18pt;color:#1e2a3b}.cap{text-align:center;color:#666;font-size:10pt}</style></head><body><h1 style="text-align:center">${escapeHtml(title)}</h1>${body}</body></html>`
  downloadBlob(html, `${title}.doc`, 'application/msword')
}
