export type FolderId = 'inbox' | 'drafts' | 'projects' | 'archive'

export type MapNode = {
  id: string
  parentId: string | null
  title: string
  note: string
  x: number
  y: number
  createdAt: number
}

export type Viewport = {
  x: number
  y: number
  zoom: number
}

export type MindMap = {
  id: string
  title: string
  folder: FolderId
  nodes: MapNode[]
  viewport: Viewport
  createdAt: number
  updatedAt: number
}

export type MapMeta = {
  id: string
  title: string
  folder: FolderId
  updatedAt: number
  createdAt: number
  nodeCount: number
}

export type EditorMode = 'map' | 'outline'

export const FOLDERS: { id: FolderId; label: string }[] = [
  { id: 'inbox', label: '최근' },
  { id: 'drafts', label: '초안' },
  { id: 'projects', label: '프로젝트' },
  { id: 'archive', label: '보관함' },
]

export const BRANCH_COLORS = [
  { line: '#7c4dff', fill: '#f3edff', cloud: 'rgba(124,77,255,0.10)' },
  { line: '#2aa8a0', fill: '#e7f7f5', cloud: 'rgba(42,168,160,0.12)' },
  { line: '#e09a2b', fill: '#fff4dd', cloud: 'rgba(224,154,43,0.14)' },
  { line: '#4b8adf', fill: '#e8f1fc', cloud: 'rgba(75,138,223,0.12)' },
  { line: '#d45d8c', fill: '#fdeef4', cloud: 'rgba(212,93,140,0.12)' },
  { line: '#6b8f3a', fill: '#eef6e3', cloud: 'rgba(107,143,58,0.14)' },
]
