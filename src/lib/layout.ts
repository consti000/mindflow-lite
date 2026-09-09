import type { MapNode } from '../types'
import { childrenOf, isPrimaryRoot, rootsOf } from './tree'

export const NODE_H = 52
export const V_GAP = 18
export const H_GAP = 72
export const MIN_W = 96
export const MAX_W = 240
export const MIN_NODE_W = 96
export const MAX_NODE_W = 720
export const MIN_NODE_H = 48

const PAD_X = 28
const PAD_Y = 20

export type SizedNode = Pick<MapNode, 'title' | 'parentId'> & {
  w?: number
  h?: number
  primary?: boolean
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

let measureCtx: CanvasRenderingContext2D | null = null

function measure(text: string, fontSize: number): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.92
  if (!measureCtx) {
    const canvas = document.createElement('canvas')
    measureCtx = canvas.getContext('2d')
  }
  if (!measureCtx) return text.length * fontSize * 0.92
  measureCtx.font = `700 ${fontSize}px Pretendard, "Segoe UI", sans-serif`
  return measureCtx.measureText(text).width
}

export function wrapTitle(title: string, maxInner: number, fontSize = 14): string[] {
  const text = title || '이름 없음'
  const inner = Math.max(24, maxInner)
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    const next = line + ch
    if (line && measure(next, fontSize) > inner) {
      lines.push(line)
      line = ch
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

export function contentHeight(title: string, width: number, isRoot = false): number {
  const fontSize = isRoot ? 16 : 14
  const lineH = fontSize * 1.35
  const lines = wrapTitle(title, width - PAD_X, fontSize)
  return Math.max(NODE_H, Math.ceil(PAD_Y + lines.length * lineH + 2))
}

export function sizedNode(nodes: MapNode[], node: MapNode): SizedNode {
  return { ...node, primary: isPrimaryRoot(nodes, node.id) }
}

export function nodeSize(node: SizedNode): { w: number; h: number } {
  const isRoot = node.primary === true
  const fontSize = isRoot ? 16 : 14
  const autoW = Math.min(
    MAX_W,
    Math.max(isRoot ? 160 : MIN_W, Math.ceil(measure(node.title || '이름 없음', fontSize) + PAD_X)),
  )
  const w = node.w == null ? autoW : Math.min(MAX_NODE_W, Math.max(MIN_NODE_W, node.w))
  const textH = contentHeight(node.title, w, isRoot)
  const h = Math.max(textH, node.h ?? 0)
  return { w, h }
}

export function applyResize(
  start: { handle: ResizeHandle; startW: number; startH: number; startX: number; startY: number },
  dx: number,
  dy: number,
  node: SizedNode,
): { w: number; h: number; x: number; y: number } {
  let left = start.startX - start.startW / 2
  let right = start.startX + start.startW / 2
  let top = start.startY - start.startH / 2
  let bottom = start.startY + start.startH / 2
  const { handle } = start
  if (handle.includes('e')) right = start.startX + start.startW / 2 + dx
  if (handle.includes('w')) left = start.startX - start.startW / 2 + dx
  if (handle.includes('s')) bottom = start.startY + start.startH / 2 + dy
  if (handle.includes('n')) top = start.startY - start.startH / 2 + dy

  let w = right - left
  w = Math.min(MAX_NODE_W, Math.max(MIN_NODE_W, w))
  if (handle.includes('w') && !handle.includes('e')) left = right - w
  else right = left + w

  const textH = contentHeight(node.title, w, node.primary === true)
  let h = Math.max(textH, bottom - top, MIN_NODE_H)
  if (handle.includes('n') && !handle.includes('s')) top = bottom - h
  else bottom = top + h

  return { w, h, x: (left + right) / 2, y: (top + bottom) / 2 }
}

function subtreeHeight(nodes: MapNode[], id: string): number {
  const self = nodes.find((n) => n.id === id)
  const selfH = self ? nodeSize(sizedNode(nodes, self)).h : NODE_H
  const kids = childrenOf(nodes, id)
  if (kids.length === 0) return selfH
  const sum = kids.reduce((acc, k) => acc + subtreeHeight(nodes, k.id), 0)
  return Math.max(selfH, sum + V_GAP * (kids.length - 1))
}

export function autoLayout(nodes: MapNode[]): MapNode[] {
  const roots = rootsOf(nodes)
  if (roots.length === 0) return nodes
  const pos = new Map<string, { x: number; y: number }>()
  for (const root of roots) pos.set(root.id, { x: root.x, y: root.y })

  const placeGroup = (parentId: string, kids: MapNode[], side: 'left' | 'right') => {
    const parent = pos.get(parentId)
    if (!parent) return
    const heights = kids.map((k) => subtreeHeight(nodes, k.id))
    const total = heights.reduce((a, b) => a + b, 0) + V_GAP * Math.max(0, kids.length - 1)
    let y = parent.y - total / 2
    const parentNode = nodes.find((n) => n.id === parentId)
    const parentW = parentNode ? nodeSize(sizedNode(nodes, parentNode)).w : MIN_W
    const dir = side === 'right' ? 1 : -1

    kids.forEach((kid, i) => {
      const blockH = heights[i]
      const kidW = nodeSize(sizedNode(nodes, kid)).w
      const x = parent.x + dir * (parentW / 2 + H_GAP + kidW / 2)
      pos.set(kid.id, { x, y: y + blockH / 2 })
      place(kid.id, side)
      y += blockH + V_GAP
    })
  }

  const place = (id: string, side: 'left' | 'right' | 'both') => {
    const kids = childrenOf(nodes, id)
    if (kids.length === 0) return
    if (side === 'both') {
      const right = kids.filter((_, i) => i % 2 === 0)
      const left = kids.filter((_, i) => i % 2 === 1)
      placeGroup(id, right, 'right')
      placeGroup(id, left, 'left')
      return
    }
    placeGroup(id, kids, side)
  }

  for (const root of roots) place(root.id, 'both')
  return nodes.map((n) => {
    const p = pos.get(n.id)
    return p ? { ...n, x: p.x, y: p.y } : n
  })
}

export function subtreeBounds(nodes: MapNode[], id: string): { x: number; y: number; w: number; h: number } | null {
  const ids = new Set<string>([id])
  const walk = (pid: string) => {
    for (const c of childrenOf(nodes, pid)) {
      ids.add(c.id)
      walk(c.id)
    }
  }
  walk(id)
  const subset = nodes.filter((n) => ids.has(n.id))
  if (subset.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of subset) {
    const { w, h } = nodeSize(sizedNode(nodes, n))
    minX = Math.min(minX, n.x - w / 2)
    maxX = Math.max(maxX, n.x + w / 2)
    minY = Math.min(minY, n.y - h / 2)
    maxY = Math.max(maxY, n.y + h / 2)
  }
  const pad = 22
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
}
