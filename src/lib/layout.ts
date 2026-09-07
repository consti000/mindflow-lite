import type { MapNode } from '../types'
import { childrenOf, rootOf } from './tree'

export const NODE_H = 52
export const V_GAP = 18
export const H_GAP = 72
export const MIN_W = 132
export const MAX_W = 240

export function nodeSize(title: string): { w: number; h: number } {
  const w = Math.min(MAX_W, Math.max(MIN_W, 28 + title.length * 13))
  return { w, h: NODE_H }
}

function subtreeHeight(nodes: MapNode[], id: string): number {
  const kids = childrenOf(nodes, id)
  if (kids.length === 0) return NODE_H
  const sum = kids.reduce((acc, k) => acc + subtreeHeight(nodes, k.id), 0)
  return Math.max(NODE_H, sum + V_GAP * (kids.length - 1))
}

export function autoLayout(nodes: MapNode[]): MapNode[] {
  const root = rootOf(nodes)
  if (!root) return nodes
  const pos = new Map<string, { x: number; y: number }>()
  pos.set(root.id, { x: 0, y: 0 })

  const placeGroup = (parentId: string, kids: MapNode[], side: 'left' | 'right') => {
    const parent = pos.get(parentId)
    if (!parent) return
    const heights = kids.map((k) => subtreeHeight(nodes, k.id))
    const total = heights.reduce((a, b) => a + b, 0) + V_GAP * Math.max(0, kids.length - 1)
    let y = parent.y - total / 2
    const parentW = nodeSize(nodes.find((n) => n.id === parentId)?.title ?? '').w
    const dir = side === 'right' ? 1 : -1

    kids.forEach((kid, i) => {
      const h = heights[i]
      const kidW = nodeSize(kid.title).w
      const x = parent.x + dir * (parentW / 2 + H_GAP + kidW / 2)
      pos.set(kid.id, { x, y: y + h / 2 })
      place(kid.id, side)
      y += h + V_GAP
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

  place(root.id, 'both')
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
    const { w, h } = nodeSize(n.title)
    minX = Math.min(minX, n.x - w / 2)
    maxX = Math.max(maxX, n.x + w / 2)
    minY = Math.min(minY, n.y - h / 2)
    maxY = Math.max(maxY, n.y + h / 2)
  }
  const pad = 22
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
}
