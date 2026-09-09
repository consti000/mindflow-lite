import { isPrimaryRoot, outlineRows } from '../lib/tree'
import { useApp } from '../state/AppStore'
import { IconX } from './Icons'

export function OutlineView() {
  const { map, selectedId, editingId, select, startEdit, stopEdit, updateNode, deleteNode } = useApp()
  if (!map) return null

  return (
    <div className="outline">
      {outlineRows(map.nodes).map(({ node, depth }) => {
        const selected = node.id === selectedId
        const editing = node.id === editingId
        const canDelete = !isPrimaryRoot(map.nodes, node.id)
        return (
          <div key={node.id} className={`outline-row${selected ? ' selected' : ''}`}>
            <button
              type="button"
              className="outline-main"
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
            {canDelete ? (
              <button
                type="button"
                className="outline-delete"
                title={`${node.title || '이름 없음'} 삭제`}
                aria-label={`${node.title || '이름 없음'} 삭제`}
                onClick={(e) => {
                  e.stopPropagation()
                  deleteNode(node.id)
                }}
              >
                <IconX />
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
