import { useEffect, useRef, useState, type PointerEvent as PE } from 'react'
import { BRANCH_COLORS } from '../types'
import { nodeSize, subtreeBounds } from '../lib/layout'
import { byId, childrenOf, firstLevelIndex, rootOf } from '../lib/tree'
import { useApp } from '../state/AppStore'
import { IconAlign, IconCenter, IconChild, IconSibling } from './Icons'

const MIN_Z = 0.25
const MAX_Z = 2.4

export function MindCanvas() {
  const { map, selectedId, editingId, select, startEdit, stopEdit, updateNode, moveNode, addChild, addSibling, align } =
    useApp()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: map?.viewport.x ?? 0, y: map?.viewport.y ?? 0 })
  const [zoom, setZoom] = useState(map?.viewport.zoom ?? 1)
  const [panning, setPanning] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number; panX: number; panY: number } | null>(null)
  const drag = useRef<null | { id: string; dx: number; dy: number; moved: boolean }>(null)
  const lastTap = useRef<{ id: string; t: number } | null>(null)
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  panRef.current = pan
  zoomRef.current = zoom

  const mapId = map?.id

  const mapRefCanvas = useRef(map)
  mapRefCanvas.current = map

  useEffect(() => {
    const current = mapRefCanvas.current
    if (!current) return
    const id = requestAnimationFrame(() => fitToContent(current.nodes))
    return () => cancelAnimationFrame(id)
  }, [mapId])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    const frame = requestAnimationFrame(() => {
      const el = wrapRef.current
      if (!el) return
      const onWheelNative = (e: globalThis.WheelEvent) => {
        e.preventDefault()
        const factor = e.deltaY > 0 ? 0.92 : 1.08
        zoomAtPoint(e.clientX, e.clientY, zoomRef.current * factor)
      }
      el.addEventListener('wheel', onWheelNative, { passive: false })
      cleanup = () => el.removeEventListener('wheel', onWheelNative)
    })
    return () => {
      cancelAnimationFrame(frame)
      cleanup?.()
    }
  }, [mapId])

  const zoomAtPoint = (cx: number, cy: number, nextZoom: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const z = Math.min(MAX_Z, Math.max(MIN_Z, nextZoom))
    const ox = rect.width / 2
    const oy = rect.height / 2
    const wx = (cx - rect.left - ox - panRef.current.x) / zoomRef.current
    const wy = (cy - rect.top - oy - panRef.current.y) / zoomRef.current
    const nextPan = { x: cx - rect.left - ox - wx * z, y: cy - rect.top - oy - wy * z }
    zoomRef.current = z
    panRef.current = nextPan
    setZoom(z)
    setPan(nextPan)
  }

  const fitToContent = (list: { title: string; x: number; y: number }[]) => {
    const el = wrapRef.current
    if (!el || list.length === 0) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of list) {
      const { w, h } = nodeSize(n.title)
      minX = Math.min(minX, n.x - w / 2)
      maxX = Math.max(maxX, n.x + w / 2)
      minY = Math.min(minY, n.y - h / 2)
      maxY = Math.max(maxY, n.y + h / 2)
    }
    const bw = Math.max(280, maxX - minX)
    const bh = Math.max(180, maxY - minY)
    const z = Math.min(
      MAX_Z,
      Math.max(MIN_Z, Math.min(el.clientWidth / (bw + 96), el.clientHeight / (bh + 96))),
    )
    const nextPan = { x: -((minX + maxX) / 2) * z, y: -((minY + maxY) / 2) * z }
    zoomRef.current = z
    panRef.current = nextPan
    setZoom(z)
    setPan(nextPan)
  }

  if (!map) return null
  const root = rootOf(map.nodes)

  const toWorld = (cx: number, cy: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const ox = rect.width / 2
    const oy = rect.height / 2
    return {
      x: (cx - rect.left - ox - panRef.current.x) / zoomRef.current,
      y: (cy - rect.top - oy - panRef.current.y) / zoomRef.current,
    }
  }

  const onPointerDown = (e: PE<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const nodeEl = target.closest('[data-node]') as HTMLElement | null
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      pinch.current = { dist, zoom: zoomRef.current, panX: panRef.current.x, panY: panRef.current.y }
      drag.current = null
      return
    }

    if (nodeEl) {
      const id = nodeEl.dataset.node!
      const node = byId(map.nodes, id)
      if (!node) return
      const w = toWorld(e.clientX, e.clientY)
      drag.current = { id, dx: node.x - w.x, dy: node.y - w.y, moved: false }
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      return
    }

    if (editingId) stopEdit()
    select(null)
    setPanning(true)
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PE<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    if (pointers.current.size === 2 && pinch.current) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const midX = (pts[0].x + pts[1].x) / 2
      const midY = (pts[0].y + pts[1].y) / 2
      const scale = dist / Math.max(1, pinch.current.dist)
      zoomAtPoint(midX, midY, pinch.current.zoom * scale)
      return
    }

    if (drag.current) {
      const w = toWorld(e.clientX, e.clientY)
      const x = w.x + drag.current.dx
      const y = w.y + drag.current.dy
      const orig = byId(map.nodes, drag.current.id)
      if (orig && Math.hypot(x - orig.x, y - orig.y) > 3) drag.current.moved = true
      setDragPos({ id: drag.current.id, x, y })
      return
    }

    if (panning && pointers.current.size === 1) {
      const next = { x: panRef.current.x + e.movementX, y: panRef.current.y + e.movementY }
      panRef.current = next
      setPan(next)
    }
  }

  const onPointerUp = (e: PE<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null

    if (drag.current) {
      const d = drag.current
      if (d.moved && dragPos && dragPos.id === d.id) {
        moveNode(d.id, dragPos.x, dragPos.y)
      } else if (!d.moved) {
        const now = Date.now()
        const prev = lastTap.current
        if (prev && prev.id === d.id && now - prev.t < 320) {
          startEdit(d.id)
          lastTap.current = null
        } else {
          select(d.id)
          lastTap.current = { id: d.id, t: now }
        }
      }
      drag.current = null
      setDragPos(null)
    }

    setPanning(false)
  }

  const nodes = map.nodes.map((n) =>
    dragPos && n.id === dragPos.id ? { ...n, x: dragPos.x, y: dragPos.y } : n,
  )

  const clouds = childrenOf(nodes, root?.id ?? '').map((child, i) => {
    const b = subtreeBounds(nodes, child.id)
    if (!b) return null
    const color = BRANCH_COLORS[i % BRANCH_COLORS.length]
    return (
      <rect
        key={`c-${child.id}`}
        className="cloud"
        x={b.x}
        y={b.y}
        width={b.w}
        height={b.h}
        rx="28"
        fill={color.cloud}
      />
    )
  })

  const links = nodes.flatMap((n) => {
    if (!n.parentId) return []
    const p = byId(nodes, n.parentId)
    if (!p) return []
    const pw = nodeSize(p.title).w
    const nw = nodeSize(n.title).w
    const dir = n.x >= p.x ? 1 : -1
    const sx = p.x + (dir * pw) / 2
    const sy = p.y
    const tx = n.x - (dir * nw) / 2
    const ty = n.y
    const c = Math.max(36, Math.abs(tx - sx) * 0.45)
    const idx = Math.max(0, firstLevelIndex(nodes, n.id))
    const color = BRANCH_COLORS[idx % BRANCH_COLORS.length].line
    return [
      <path
        key={`e-${n.id}`}
        d={`M ${sx} ${sy} C ${sx + dir * c} ${sy}, ${tx - dir * c} ${ty}, ${tx} ${ty}`}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />,
    ]
  })

  return (
    <div className="canvas-wrap">
      <div
        ref={wrapRef}
        className={`viewport${panning ? ' panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="world"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg className="edge-svg">
            {clouds}
            {links}
          </svg>
          {nodes.map((n) => {
            const isRoot = n.id === root?.id
            const idx = firstLevelIndex(nodes, n.id)
            const color = BRANCH_COLORS[Math.max(0, idx) % BRANCH_COLORS.length]
            const selected = n.id === selectedId
            const editing = n.id === editingId
            return (
              <div
                key={n.id}
                data-node={n.id}
                className={`node${isRoot ? ' root' : ''}${selected ? ' selected' : ''}`}
                style={{
                  left: n.x,
                  top: n.y,
                  borderColor: isRoot ? 'transparent' : color.line,
                  width: nodeSize(n.title).w,
                }}
              >
                {editing ? (
                  <input
                    className="node-input"
                    autoFocus
                    value={n.title}
                    onChange={(e) => updateNode(n.id, { title: e.target.value })}
                    onBlur={() => stopEdit()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        stopEdit()
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        stopEdit()
                      }
                      e.stopPropagation()
                    }}
                  />
                ) : (
                  <div className="node-title">{n.title || '이름 없음'}</div>
                )}
                {n.note && !editing ? <span className="node-note-dot" /> : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="float-tools">
        <button className="icon-btn" title="자식 노드 (Tab)" onClick={() => addChild()}>
          <IconChild />
        </button>
        <button className="icon-btn" title="형제 노드 (Enter)" onClick={() => addSibling()}>
          <IconSibling />
        </button>
        <button className="icon-btn" title="자동 정렬" onClick={() => align()}>
          <IconAlign />
        </button>
      </div>

      <div className="zoom-hud">
        <button className="icon-btn" onClick={() => setZoom((z) => Math.max(MIN_Z, z * 0.9))}>
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" onClick={() => setZoom((z) => Math.min(MAX_Z, z * 1.1))}>
          +
        </button>
        <button
          className="icon-btn"
          title="화면 맞춤"
          onClick={() => fitToContent(map.nodes)}
        >
          <IconCenter />
        </button>
        <button className="icon-btn" title="자동 정렬" onClick={() => align()}>
          <IconAlign />
        </button>
      </div>
    </div>
  )
}
