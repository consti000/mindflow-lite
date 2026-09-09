import { useEffect, useState } from 'react'
import { byId, childrenOf, rootOf } from '../lib/tree'
import { useApp } from '../state/AppStore'
import { ExportDialog } from './ExportDialog'
import {
  IconBack,
  IconChild,
  IconExport,
  IconFree,
  IconRedo,
  IconSearch,
  IconSibling,
  IconTrash,
  IconUndo,
} from './Icons'
import { MindCanvas } from './MindCanvas'
import { NodePanel } from './NodePanel'
import { OutlineView } from './OutlineView'
import { SearchOverlay } from './SearchOverlay'

export function EditorScreen() {
  const app = useApp()
  const {
    map,
    selectedId,
    editingId,
    mode,
    setMode,
    goHome,
    setTitle,
    canUndo,
    canRedo,
    undo,
    redo,
    addChild,
    addSibling,
    addFreeNode,
    deleteNode,
    select,
    startEdit,
    stopEdit,
    setSearchOpen,
    setExportOpen,
  } = app
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const field = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      const meta = e.ctrlKey || e.metaKey

      if (e.key === 'Escape') {
        stopEdit()
        setSearchOpen(false)
        setExportOpen(false)
        return
      }

      if (meta && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }

      if (field) return
      if (!map) return

      if (e.key === 'Enter') {
        e.preventDefault()
        addSibling()
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          const cur = selectedId ? byId(map.nodes, selectedId) : undefined
          if (cur?.parentId) select(cur.parentId)
        } else {
          addChild()
        }
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteNode()
        return
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (selectedId) select(selectedId)
        else select(rootOf(map.nodes)?.id ?? null)
        return
      }
      if (e.key === 'F2' && selectedId) {
        e.preventDefault()
        startEdit(selectedId)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const cur = selectedId ? byId(map.nodes, selectedId) : rootOf(map.nodes)
        if (!cur) return
        const sibs = childrenOf(map.nodes, cur.parentId)
        const i = sibs.findIndex((s) => s.id === cur.id)
        const next = e.key === 'ArrowDown' ? sibs[i + 1] ?? sibs[0] : sibs[i - 1] ?? sibs[sibs.length - 1]
        if (next) select(next.id)
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const cur = selectedId ? byId(map.nodes, selectedId) : undefined
        if (!cur) return
        const kids = childrenOf(map.nodes, cur.id)
        if (e.key === 'ArrowRight' && kids[0]) select(kids[0].id)
        if (e.key === 'ArrowLeft' && cur.parentId) select(cur.parentId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    map,
    selectedId,
    editingId,
    addChild,
    addSibling,
    addFreeNode,
    deleteNode,
    undo,
    redo,
    select,
    startEdit,
    stopEdit,
    setSearchOpen,
    setExportOpen,
  ])

  if (!map) return null

  return (
    <div className="editor">
      <header className="topbar">
        <button className="icon-btn" onClick={goHome} title="홈">
          <IconBack />
        </button>
        <input className="title-input" value={map.title} onChange={(e) => setTitle(e.target.value)} />
        <div className="top-actions">
          <button className="icon-btn" disabled={!canUndo} onClick={undo} title="실행 취소">
            <IconUndo />
          </button>
          <button className="icon-btn" disabled={!canRedo} onClick={redo} title="다시 실행">
            <IconRedo />
          </button>
          <div className="seg">
            <button className={mode === 'map' ? 'on' : ''} onClick={() => setMode('map')}>
              맵
            </button>
            <button className={mode === 'outline' ? 'on' : ''} onClick={() => setMode('outline')}>
              아웃라인
            </button>
          </div>
          <button className="icon-btn" onClick={() => setSearchOpen(true)} title="검색">
            <IconSearch />
          </button>
          <button className="icon-btn" onClick={() => setExportOpen(true)} title="가져오기/내보내기">
            <IconExport />
          </button>
        </div>
      </header>

      <div className={`workspace${panelOpen ? ' show-panel' : ''}`}>
        {mode === 'map' ? <MindCanvas /> : <OutlineView />}
        <NodePanel />
      </div>

      <div className="bottom-bar">
        <button onClick={goHome}>홈</button>
        <button onClick={() => addChild()}>
          <IconChild /> 자식
        </button>
        <button onClick={() => addSibling()}>
          <IconSibling /> 형제
        </button>
        <button onClick={() => addFreeNode()}>
          <IconFree /> 독립
        </button>
        <button onClick={() => deleteNode()}>
          <IconTrash /> 삭제
        </button>
        <button onClick={() => setPanelOpen((v) => !v)}>메모</button>
        <button onClick={() => setMode(mode === 'map' ? 'outline' : 'map')}>
          {mode === 'map' ? '아웃라인' : '맵'}
        </button>
      </div>

      <SearchOverlay />
      <ExportDialog />
    </div>
  )
}
