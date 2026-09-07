import type { FolderId, MapMeta, MapNode, MindMap } from '../types'

const DB_NAME = 'mindflow-lite-app'
const DB_VER = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('maps')) {
        db.createObjectStore('maps', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function listMaps(): Promise<MapMeta[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('maps', 'readonly')
    const req = tx.objectStore('maps').getAll()
    req.onsuccess = () => {
      const maps = (req.result as MindMap[]).map(toMeta)
      maps.sort((a, b) => b.updatedAt - a.updatedAt)
      resolve(maps)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getMap(id: string): Promise<MindMap | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction('maps', 'readonly').objectStore('maps').get(id)
    req.onsuccess = () => resolve(req.result as MindMap | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function saveMap(map: MindMap): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('maps', 'readwrite')
  tx.objectStore('maps').put(map)
  await txDone(tx)
}

export async function deleteMap(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('maps', 'readwrite')
  tx.objectStore('maps').delete(id)
  await txDone(tx)
}

export function toMeta(map: MindMap): MapMeta {
  return {
    id: map.id,
    title: map.title || '제목 없는 마인드맵',
    folder: map.folder ?? 'inbox',
    updatedAt: map.updatedAt ?? map.createdAt ?? Date.now(),
    createdAt: map.createdAt ?? Date.now(),
    nodeCount: Array.isArray(map.nodes) ? map.nodes.length : 0,
  }
}

export function emptyRoot(title = '중심 주제'): MapNode {
  return {
    id: uidSafe(),
    parentId: null,
    title,
    note: '',
    x: 0,
    y: 0,
    createdAt: Date.now(),
  }
}

function uidSafe(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createBlankMap(title = '새 마인드맵', folder: FolderId = 'drafts'): MindMap {
  const now = Date.now()
  return {
    id: uidSafe(),
    title,
    folder,
    nodes: [emptyRoot(title)],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    updatedAt: now,
  }
}
