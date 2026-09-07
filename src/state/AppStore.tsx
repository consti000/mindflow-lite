import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { EditorMode, FolderId, MapMeta, MapNode, MindMap } from '../types'
import { createBlankMap, deleteMap as dbDelete, getMap, listMaps, saveMap } from '../lib/db'
import { uid } from '../lib/id'
import { autoLayout } from '../lib/layout'
import { TEMPLATES, welcomeMap } from '../lib/templates'
import { byId, childrenOf, descendants, rootOf } from '../lib/tree'

type Screen = 'home' | 'editor'

type Snapshot = { nodes: MapNode[]; title: string }

type AppApi = {
  ready: boolean
  screen: Screen
  metas: MapMeta[]
  folderFilter: FolderId | 'all'
  setFolderFilter: (f: FolderId | 'all') => void
  map: MindMap | null
  selectedId: string | null
  editingId: string | null
  mode: EditorMode
  setMode: (m: EditorMode) => void
  canUndo: boolean
  canRedo: boolean
  searchOpen: boolean
  setSearchOpen: (v: boolean) => void
  exportOpen: boolean
  setExportOpen: (v: boolean) => void
  goHome: () => void
  openMap: (id: string) => Promise<void>
  createMap: (title?: string, folder?: FolderId) => Promise<void>
  createFromTemplate: (id: (typeof TEMPLATES)[number]['id']) => Promise<void>
  importMap: (map: MindMap) => Promise<void>
  removeMap: (id: string) => Promise<void>
  setFolder: (id: string, folder: FolderId) => Promise<void>
  setTitle: (title: string) => void
  select: (id: string | null) => void
  startEdit: (id: string) => void
  stopEdit: () => void
  updateNode: (id: string, patch: Partial<Pick<MapNode, 'title' | 'note' | 'x' | 'y'>>) => void
  moveNode: (id: string, x: number, y: number) => void
  addChild: (parentId?: string) => void
  addSibling: (id?: string) => void
  deleteNode: (id?: string) => void
  align: () => void
  undo: () => void
  redo: () => void
  setViewport: (viewport: MindMap['viewport']) => void
}

const Ctx = createContext<AppApi | null>(null)

let seedLock: Promise<MapMeta[]> | null = null

async function loadOrSeed(): Promise<MapMeta[]> {
  if (!seedLock) {
    seedLock = (async () => {
      let items = await listMaps()
      if (items.length === 0) {
        await saveMap(welcomeMap())
        items = await listMaps()
      }
      return items
    })()
  }
  return seedLock
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')
  const [metas, setMetas] = useState<MapMeta[]>([])
  const [folderFilter, setFolderFilter] = useState<FolderId | 'all'>('all')
  const [map, setMap] = useState<MindMap | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mode, setMode] = useState<EditorMode>('map')
  const [searchOpen, setSearchOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const past = useRef<Snapshot[]>([])
  const future = useRef<Snapshot[]>([])
  const [ticks, setTicks] = useState(0)
  const saveTimer = useRef<number | null>(null)
  const mapRef = useRef<MindMap | null>(null)
  mapRef.current = map

  const refreshMetas = useCallback(async () => {
    setMetas(await listMaps())
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadOrSeed().then((items) => {
      if (!cancelled) {
        setMetas(items)
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!map) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveMap(map).then(refreshMetas)
    }, 350)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [map, refreshMetas])

  const pushHistory = (current: MindMap) => {
    past.current.push({
      nodes: current.nodes.map((n) => ({ ...n })),
      title: current.title,
    })
    if (past.current.length > 80) past.current.shift()
    future.current = []
  }

  const mutate = (fn: (m: MindMap) => MindMap, record = true) => {
    const cur = mapRef.current
    if (!cur) return
    if (record) pushHistory(cur)
    setMap({ ...fn(cur), updatedAt: Date.now() })
    setTicks((t) => t + 1)
  }

  const openMap = async (id: string) => {
    const found = await getMap(id)
    if (!found) return
    past.current = []
    future.current = []
    setMap(found)
    const root = rootOf(found.nodes)
    setSelectedId(root?.id ?? found.nodes[0]?.id ?? null)
    setEditingId(null)
    setMode('map')
    setScreen('editor')
  }

  const persistNew = async (created: MindMap) => {
    await saveMap(created)
    await refreshMetas()
    past.current = []
    future.current = []
    setMap(created)
    setSelectedId(rootOf(created.nodes)?.id ?? null)
    setEditingId(rootOf(created.nodes)?.id ?? null)
    setMode('map')
    setScreen('editor')
  }

  const api: AppApi = useMemo(
    () => ({
      ready,
      screen,
      metas,
      folderFilter,
      setFolderFilter,
      map,
      selectedId,
      editingId,
      mode,
      setMode,
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
      searchOpen,
      setSearchOpen,
      exportOpen,
      setExportOpen,
      goHome: () => {
        const current = mapRef.current
        if (current) void saveMap(current).then(refreshMetas)
        setScreen('home')
        setSearchOpen(false)
        setExportOpen(false)
        setEditingId(null)
      },
      openMap,
      createMap: async (title = '새 마인드맵', folder: FolderId = 'drafts') => {
        await persistNew(autoLayoutMap(createBlankMap(title, folder)))
      },
      createFromTemplate: async (id) => {
        const t = TEMPLATES.find((x) => x.id === id)
        if (t) await persistNew(t.create())
      },
      importMap: async (incoming) => {
        await persistNew(incoming)
      },
      removeMap: async (id) => {
        await dbDelete(id)
        if (mapRef.current?.id === id) {
          setMap(null)
          setScreen('home')
        }
        await refreshMetas()
      },
      setFolder: async (id, folder) => {
        const found = await getMap(id)
        if (!found) return
        await saveMap({ ...found, folder, updatedAt: Date.now() })
        if (mapRef.current?.id === id) {
          setMap((m) => (m ? { ...m, folder } : m))
        }
        await refreshMetas()
      },
      setTitle: (title) => mutate((m) => ({ ...m, title })),
      select: (id) => {
        setSelectedId(id)
        if (id !== editingId) setEditingId(null)
      },
      startEdit: (id) => {
        const current = mapRef.current
        if (current) pushHistory(current)
        setSelectedId(id)
        setEditingId(id)
        setTicks((t) => t + 1)
      },
      stopEdit: () => setEditingId(null),
      updateNode: (id, patch) => {
        mutate(
          (m) => ({
            ...m,
            nodes: m.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
          }),
          false,
        )
      },
      moveNode: (id, x, y) => {
        mutate(
          (m) => ({
            ...m,
            nodes: m.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
          }),
          true,
        )
      },
      addChild: (parentId) => {
        const current = mapRef.current
        if (!current) return
        const parent = parentId ?? selectedId ?? rootOf(current.nodes)?.id
        if (!parent) return
        const n = newNode(parent, current.nodes)
        mutate((m) => ({ ...m, nodes: autoLayout([...m.nodes, n]) }))
        setSelectedId(n.id)
        setEditingId(n.id)
      },
      addSibling: (id) => {
        const current = mapRef.current
        if (!current) return
        const targetId = id ?? selectedId
        if (!targetId) return
        const target = byId(current.nodes, targetId)
        if (!target) return
        if (!target.parentId) {
          const child = newNode(target.id, current.nodes)
          mutate((m) => ({ ...m, nodes: autoLayout([...m.nodes, child]) }))
          setSelectedId(child.id)
          setEditingId(child.id)
          return
        }
        const n = newNode(target.parentId, current.nodes)
        mutate((m) => ({ ...m, nodes: autoLayout([...m.nodes, n]) }))
        setSelectedId(n.id)
        setEditingId(n.id)
      },
      deleteNode: (id) => {
        const current = mapRef.current
        if (!current) return
        const targetId = id ?? selectedId
        if (!targetId) return
        const target = byId(current.nodes, targetId)
        if (!target || !target.parentId) return
        const drop = new Set([targetId, ...descendants(current.nodes, targetId).map((n) => n.id)])
        mutate((m) => ({
          ...m,
          nodes: autoLayout(m.nodes.filter((n) => !drop.has(n.id))),
        }))
        setSelectedId(target.parentId)
        setEditingId(null)
      },
      align: () => mutate((m) => ({ ...m, nodes: autoLayout(m.nodes) })),
      undo: () => {
        const current = mapRef.current
        if (!current || past.current.length === 0) return
        const snap = past.current.pop()!
        future.current.push({ nodes: current.nodes.map((n) => ({ ...n })), title: current.title })
        setMap({ ...current, nodes: snap.nodes, title: snap.title, updatedAt: Date.now() })
        setTicks((t) => t + 1)
      },
      redo: () => {
        const current = mapRef.current
        if (!current || future.current.length === 0) return
        const snap = future.current.pop()!
        past.current.push({ nodes: current.nodes.map((n) => ({ ...n })), title: current.title })
        setMap({ ...current, nodes: snap.nodes, title: snap.title, updatedAt: Date.now() })
        setTicks((t) => t + 1)
      },
      setViewport: (viewport) => {
        setMap((m) => (m ? { ...m, viewport } : m))
      },
    }),
    // ticks keeps canUndo/canRedo fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, screen, metas, folderFilter, map, selectedId, editingId, mode, searchOpen, exportOpen, ticks],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('AppProvider 필요')
  return ctx
}

function newNode(parentId: string, nodes: MapNode[]): MapNode {
  const n = childrenOf(nodes, parentId).length
  return {
    id: uid(),
    parentId,
    title: n === 0 ? '새 가지' : '새 노드',
    note: '',
    x: 0,
    y: 0,
    createdAt: Date.now(),
  }
}

function autoLayoutMap(map: MindMap): MindMap {
  return { ...map, nodes: autoLayout(map.nodes) }
}
