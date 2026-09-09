import { useEffect, useRef, useState, type PointerEvent as PE } from 'react'
import { BRANCH_COLORS, type MapNode } from '../types'
import { applyResize, nodeSize, sizedNode, subtreeBounds, type ResizeHandle } from '../lib/layout'
import { byId, childrenOf, firstLevelIndex, isPrimaryRoot, rootsOf } from '../lib/tree'
import { useApp } from '../state/AppStore'
import { IconAlign, IconCenter, IconChild, IconFree, IconSibling, IconTrash, IconX } from './Icons'

const MIN_Z = 0.25
const MAX_Z = 2.4

export function MindCanvas() {
  const {
    map,
    selectedId,
    editingId,
    select,
    startEdit,
    stopEdit,
    updateNode,
    moveNode,
    resizeNode,
    addChild,
    addSibling,
    addFreeNode,
    deleteNode,
    align,
  } = useApp()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: map?.viewport.x ?? 0, y: map?.viewport.y ?? 0 })
  const [zoom, setZoom] = useState(map?.viewport.zoom ?? 1)
  const [panning, setPanning] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number; panX: number; panY: number } | null>(null)
  const drag = useRef<null | { id: string; dx: number; dy: number; moved: boolean }>(null)
  const lastTap = useRef<{ id: string; t: number } | null>(null)
  const lastBlankTap = useRef<{ x: number; y: number; t: number } | null>(null)
  const blankPan = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const lastFreeAdd = useRef(0)
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const resize = useRef<null | {
    id: string
    handle: ResizeHandle
    startW: number
    startH: number
    startX: number
    startY: number
    originX: number
    originY: number
  }>(null)
  const [liveSize, setLiveSize] = useState<null | { id: string; w: number; h: number; x: number; y: number }>(null)
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

  const fitToContent = (list: MapNode[]) => {
    const el = wrapRef.current
    if (!el || list.length === 0) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of list) {
      const { w, h } = nodeSize(sizedNode(list, n))
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

  const spawnFreeAt = (cx: number, cy: number) => {
    const now = Date.now()
    if (now - lastFreeAdd.current < 400) return
    lastFreeAdd.current = now
    const world = toWorld(cx, cy)
    addFreeNode(world.x, world.y)
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
      const handleEl = target.closest('[data-resize]') as HTMLElement | null
      if (handleEl) {
        const sized = liveSize && liveSize.id === node.id ? { ...node, ...liveSize } : node
        const size = nodeSize(sizedNode(map.nodes, sized))
        const origin = toWorld(e.clientX, e.clientY)
        resize.current = {
          id,
          handle: handleEl.dataset.resize as ResizeHandle,
          startW: size.w,
          startH: size.h,
          startX: node.x,
          startY: node.y,
          originX: origin.x,
          originY: origin.y,
        }
        select(id)
        ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
        return
      }
      const w = toWorld(e.clientX, e.clientY)
      drag.current = { id, dx: node.x - w.x, dy: node.y - w.y, moved: false }
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      return
    }

    if (editingId) stopEdit()
    select(null)
    blankPan.current = { x: e.clientX, y: e.clientY, moved: false }
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

    if (resize.current) {
      const r = resize.current
      const node = byId(map.nodes, r.id)
      if (!node) return
      const pos = toWorld(e.clientX, e.clientY)
      const next = applyResize(r, pos.x - r.originX, pos.y - r.originY, sizedNode(map.nodes, node))
      setLiveSize({ id: r.id, ...next })
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
      if (blankPan.current) {
        const dist = Math.hypot(e.clientX - blankPan.current.x, e.clientY - blankPan.current.y)
        if (dist > 6) blankPan.current.moved = true
      }
      const next = { x: panRef.current.x + e.movementX, y: panRef.current.y + e.movementY }
      panRef.current = next
      setPan(next)
    }
  }

  const onPointerUp = (e: PE<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null

    if (resize.current) {
      if (liveSize && liveSize.id === resize.current.id) {
        resizeNode(liveSize.id, liveSize)
      }
      resize.current = null
      setLiveSize(null)
    }

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
      blankPan.current = null
      setPanning(false)
      return
    }

    const blank = blankPan.current
    blankPan.current = null
    if (blank && !blank.moved && !resize.current) {
      const now = Date.now()
      const prev = lastBlankTap.current
      if (prev && now - prev.t < 350 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 28) {
        spawnFreeAt(e.clientX, e.clientY)
        lastBlankTap.current = null
      } else {
        lastBlankTap.current = { x: e.clientX, y: e.clientY, t: now }
      }
    }

    setPanning(false)
  }

  const nodes = map.nodes.map((n) => {
    if (liveSize && n.id === liveSize.id) return { ...n, ...liveSize }
    if (dragPos && n.id === dragPos.id) return { ...n, x: dragPos.x, y: dragPos.y }
    return n
  })

  const clouds = rootsOf(nodes).flatMap((treeRoot) =>
    childrenOf(nodes, treeRoot.id).map((child, i) => {
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
    }),
  )

  const links = nodes.flatMap((n) => {
    if (!n.parentId) return []
    const p = byId(nodes, n.parentId)
    if (!p) return []
    const pw = nodeSize(sizedNode(nodes, p)).w
    const nw = nodeSize(sizedNode(nodes, n)).w
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
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('[data-node]')) return
          spawnFreeAt(e.clientX, e.clientY)
        }}
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
            const isRoot = isPrimaryRoot(nodes, n.id)
            const isFree = !n.parentId && !isRoot
            const idx = firstLevelIndex(nodes, n.id)
            const color = BRANCH_COLORS[Math.max(0, idx) % BRANCH_COLORS.length]
            const selected = n.id === selectedId
            const editing = n.id === editingId
            const size = nodeSize(sizedNode(nodes, n))
            return (
              <div
                key={n.id}
                data-node={n.id}
                className={`node${isRoot ? ' root' : ''}${isFree ? ' free' : ''}${selected ? ' selected' : ''}`}
                style={{
                  left: n.x,
                  top: n.y,
                  borderColor: isRoot ? 'transparent' : color.line,
                  width: size.w,
                  height: size.h,
                  ['--zoom' as string]: String(zoom),
                }}
              >
                {editing ? (
                  <textarea
                    className="node-input"
                    autoFocus
                    rows={2}
                    value={n.title}
                    onChange={(e) => updateNode(n.id, { title: e.target.value })}
                    onBlur={() => stopEdit()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        stopEdit()
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
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
                {selected
                  ? (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((handle) => (
                      <span
                        key={handle}
                        role="slider"
                        aria-label={`노드 크기 ${handle}`}
                        aria-valuemin={96}
                        aria-valuemax={720}
                        aria-valuenow={Math.round(size.w)}
                        className={`node-handle node-handle-${handle}`}
                        data-resize={handle}
                        draggable
                        onDragStart={(e) => e.preventDefault()}
                      />
                    ))
                  : null}
                {selected && !isRoot ? (
                  <button
                    type="button"
                    className="node-delete"
                    title={childrenOf(nodes, n.id).length ? '이 노드와 하위 가지 삭제' : '이 노드 삭제'}
                    aria-label={`${n.title || '이름 없음'} 삭제`}
                    data-delete-node={n.id}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNode(n.id)
                    }}
                  >
                    <IconX />
                  </button>
                ) : null}
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
        <button
          className="icon-btn"
          title="독립 노드 (빈 곳 더블클릭)"
          onClick={() => {
            const rect = wrapRef.current?.getBoundingClientRect()
            if (!rect) {
              addFreeNode()
              return
            }
            const world = toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
            addFreeNode(world.x, world.y)
          }}
        >
          <IconFree />
        </button>
        <button
          className="icon-btn"
          title="선택한 노드 삭제"
          disabled={!selectedId || isPrimaryRoot(map.nodes, selectedId)}
          onClick={() => selectedId && deleteNode(selectedId)}
        >
          <IconTrash />
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
