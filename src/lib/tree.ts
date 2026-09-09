import type { MapNode } from '../types'

export function childrenOf(nodes: MapNode[], parentId: string | null): MapNode[] {
  return nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.createdAt - b.createdAt)
}

export function rootsOf(nodes: MapNode[]): MapNode[] {
  return nodes.filter((n) => n.parentId === null).sort((a, b) => a.createdAt - b.createdAt)
}

export function rootOf(nodes: MapNode[]): MapNode | undefined {
  return rootsOf(nodes)[0]
}

export function isPrimaryRoot(nodes: MapNode[], id: string): boolean {
  return rootOf(nodes)?.id === id
}

export function byId(nodes: MapNode[], id: string): MapNode | undefined {
  return nodes.find((n) => n.id === id)
}

export function descendants(nodes: MapNode[], id: string): MapNode[] {
  const out: MapNode[] = []
  const walk = (pid: string) => {
    for (const child of childrenOf(nodes, pid)) {
      out.push(child)
      walk(child.id)
    }
  }
  walk(id)
  return out
}

export function subtreeIds(nodes: MapNode[], id: string): Set<string> {
  const ids = new Set<string>([id])
  for (const n of descendants(nodes, id)) ids.add(n.id)
  return ids
}

export function pathTo(nodes: MapNode[], id: string): MapNode[] {
  const map = new Map(nodes.map((n) => [n.id, n]))
  const path: MapNode[] = []
  let cur = map.get(id)
  while (cur) {
    path.unshift(cur)
    cur = cur.parentId ? map.get(cur.parentId) : undefined
  }
  return path
}

export function firstLevelIndex(nodes: MapNode[], id: string): number {
  const path = pathTo(nodes, id)
  if (path.length < 2) return -1
  const kids = childrenOf(nodes, path[0].id)
  return kids.findIndex((k) => k.id === path[1].id)
}

export function siblingNav(nodes: MapNode[], id: string, dir: -1 | 1): MapNode | undefined {
  const node = byId(nodes, id)
  if (!node) return
  const sibs = childrenOf(nodes, node.parentId)
  const i = sibs.findIndex((s) => s.id === id)
  return sibs[i + dir]
}

export function outlineRows(nodes: MapNode[]): { node: MapNode; depth: number }[] {
  const rows: { node: MapNode; depth: number }[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const n of childrenOf(nodes, parentId)) {
      rows.push({ node: n, depth })
      walk(n.id, depth + 1)
    }
  }
  for (const root of rootsOf(nodes)) {
    rows.push({ node: root, depth: 0 })
    walk(root.id, 1)
  }
  return rows
}
