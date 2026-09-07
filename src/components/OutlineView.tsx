import { outlineRows } from '../lib/tree'
import { useApp } from '../state/AppStore'

export function OutlineView() {
  const { map, selectedId, editingId, select, startEdit, stopEdit, updateNode } = useApp()
  if (!map) return null

  return (
    <div className="outline">
      {outlineRows(map.nodes).map(({ node, depth }) => {
        const selected = node.id === selectedId
        const editing = node.id === editingId
        return (
          <button
            key={node.id}
            className={`outline-row${selected ? ' selected' : ''}`}
            style={{ paddingLeft: 10 + depth * 22 }}
            onClick={() => select(node.id)}
            onDoubleClick={() => startEdit(node.id)}
          >
            <span className="outline-mark">{depth === 0 ? '●' : '○'}</span>
            {editing ? (
              <input
                autoFocus
                value={node.title}
                onChange={(e) => updateNode(node.id, { title: e.target.value })}
                onBlur={() => stopEdit()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || e.key === 'Enter') {
                    e.preventDefault()
                    stopEdit()
                  }
                  e.stopPropagation()
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span>{node.title || '이름 없음'}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
