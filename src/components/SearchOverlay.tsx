import { useEffect, useMemo, useRef, useState } from 'react'
import { pathTo } from '../lib/tree'
import { searchNodes } from '../lib/export'
import { useApp } from '../state/AppStore'

export function SearchOverlay() {
  const { map, metas, screen, searchOpen, setSearchOpen, select, setMode, openMap } = useApp()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) {
      setQ('')
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [searchOpen])

  const nodeHits = useMemo(() => (map && q.trim() && screen === 'editor' ? searchNodes(map, q) : []), [map, q, screen])
  const mapHits = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query || screen !== 'home') return []
    return metas.filter((m) => m.title.toLowerCase().includes(query))
  }, [metas, q, screen])

  if (!searchOpen) return null

  return (
    <div className="overlay" onMouseDown={() => setSearchOpen(false)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>검색</h3>
        <input
          ref={inputRef}
          className="search-input"
          placeholder={screen === 'home' ? '맵 제목' : '제목 또는 메모'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {screen === 'home'
          ? mapHits.map((m) => (
              <button
                key={m.id}
                className="search-hit"
                onClick={() => {
                  void openMap(m.id)
                  setSearchOpen(false)
                }}
              >
                <b>{m.title}</b>
                <span>{m.nodeCount}개 노드</span>
              </button>
            ))
          : nodeHits.map((n) => {
              const path = map
                ? pathTo(map.nodes, n.id)
                    .map((p) => p.title)
                    .join(' / ')
                : ''
              return (
                <button
                  key={n.id}
                  className="search-hit"
                  onClick={() => {
                    select(n.id)
                    setMode('map')
                    setSearchOpen(false)
                  }}
                >
                  <b>{n.title || '이름 없음'}</b>
                  <span>{path}</span>
                  {n.note ? <span>{n.note}</span> : null}
                </button>
              )
            })}
        {q.trim() && (screen === 'home' ? mapHits.length === 0 : nodeHits.length === 0) ? (
          <p className="hint">일치하는 항목이 없습니다.</p>
        ) : null}
      </div>
    </div>
  )
}
