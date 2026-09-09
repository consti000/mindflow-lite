import type { MindMap, MapNode } from '../types'
import { nodeSize, sizedNode, wrapTitle } from './layout'
import { firstLevelIndex, rootOf } from './tree'
import { BRANCH_COLORS } from '../types'

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportJson(map: MindMap) {
  const payload = {
    app: 'mindflow-lite',
    version: 1,
    exportedAt: new Date().toISOString(),
    map,
  }
  download(
    `${safeName(map.title)}.mindflow.json`,
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
  )
}

export function parseImportedJson(text: string): MindMap {
  const data = JSON.parse(text) as { map?: MindMap } & Partial<MindMap>
  const map = data.map ?? (data as MindMap)
  if (!map || !Array.isArray(map.nodes) || !map.title) {
    throw new Error('MindFlow JSON 형식이 아닙니다.')
  }
  const nodes = map.nodes.filter(
    (n): n is MapNode =>
      typeof n?.id === 'string' &&
      typeof n.title === 'string' &&
      (n.parentId === null || typeof n.parentId === 'string'),
  )
  if (nodes.length === 0) throw new Error('노드가 없습니다.')
  return {
    id: crypto.randomUUID?.() ?? `m_${Date.now()}`,
    title: String(map.title),
    folder: map.folder ?? 'inbox',
    nodes,
    viewport: map.viewport ?? { x: 0, y: 0, zoom: 1 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function mapToSvg(map: MindMap): { svg: string; width: number; height: number } {
  const pad = 80
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of map.nodes) {
    const { w, h } = nodeSize(sizedNode(map.nodes, n))
    minX = Math.min(minX, n.x - w / 2)
    maxX = Math.max(maxX, n.x + w / 2)
    minY = Math.min(minY, n.y - h / 2)
    maxY = Math.max(maxY, n.y + h / 2)
  }
  if (!Number.isFinite(minX)) {
    minX = -200
    maxX = 200
    minY = -120
    maxY = 120
  }
  const width = Math.ceil(maxX - minX + pad * 2)
  const height = Math.ceil(maxY - minY + pad * 2)
  const ox = -minX + pad
  const oy = -minY + pad
  const root = rootOf(map.nodes)

  const links: string[] = []
  for (const n of map.nodes) {
    if (!n.parentId) continue
    const p = map.nodes.find((x) => x.id === n.parentId)
    if (!p) continue
    const pw = nodeSize(sizedNode(map.nodes, p)).w
    const nw = nodeSize(sizedNode(map.nodes, n)).w
    const dir = n.x >= p.x ? 1 : -1
    const sx = p.x + ox + (dir * pw) / 2
    const sy = p.y + oy
    const tx = n.x + ox - (dir * nw) / 2
    const ty = n.y + oy
    const c = Math.max(40, Math.abs(tx - sx) * 0.45)
    const color = BRANCH_COLORS[Math.max(0, firstLevelIndex(map.nodes, n.id)) % BRANCH_COLORS.length].line
    links.push(
      `<path d="M ${sx} ${sy} C ${sx + dir * c} ${sy}, ${tx - dir * c} ${ty}, ${tx} ${ty}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`,
    )
  }

  const cards = map.nodes.map((n) => {
    const { w, h } = nodeSize(sizedNode(map.nodes, n))
    const x = n.x + ox - w / 2
    const y = n.y + oy - h / 2
    const isRoot = n.id === root?.id
    const idx = firstLevelIndex(map.nodes, n.id)
    const color = isRoot
      ? BRANCH_COLORS[0]
      : BRANCH_COLORS[Math.max(0, idx) % BRANCH_COLORS.length]
    const fontSize = isRoot ? 16 : 14
    const lineH = fontSize * 1.35
    const lines = wrapTitle(n.title || '이름 없음', w - 28, fontSize)
    const startY = n.y + oy - ((lines.length - 1) * lineH) / 2 + 5
    const tspans = lines
      .map(
        (line, i) =>
          `<tspan x="${n.x + ox}" y="${startY + i * lineH}">${escapeXml(line)}</tspan>`,
      )
      .join('')
    return `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${isRoot ? '#7c4dff' : '#ffffff'}" stroke="${isRoot ? '#7c4dff' : color.line}" stroke-width="${isRoot ? 0 : 1.5}"/>
        <text text-anchor="middle" font-family="Pretendard, Segoe UI, sans-serif" font-size="${fontSize}" font-weight="${isRoot ? 700 : 600}" fill="${isRoot ? '#ffffff' : '#1d1633'}">${tspans}</text>
      </g>`
  })

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#faf8ff"/>
  ${links.join('\n')}
  ${cards.join('\n')}
</svg>`
  return { svg, width, height }
}

export async function exportPng(map: MindMap) {
  const { svg, width, height } = mapToSvg(map)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    const scale = 2
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('캔버스를 만들 수 없습니다.')
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    await new Promise<void>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (!b) {
          reject(new Error('PNG 변환에 실패했습니다.'))
          return
        }
        download(`${safeName(map.title)}.png`, b)
        resolve()
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'))
    img.src = url
  })
}

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'mindflow'
}

function escapeXml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function searchNodes(map: MindMap, q: string) {
  const query = q.trim().toLowerCase()
  if (!query) return []
  return map.nodes.filter(
    (n) => n.title.toLowerCase().includes(query) || n.note.toLowerCase().includes(query),
  )
}
