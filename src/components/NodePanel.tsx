import { byId, childrenOf, isPrimaryRoot } from '../lib/tree'
import { useApp } from '../state/AppStore'
import { IconTrash } from './Icons'

export function NodePanel() {
  const { map, selectedId, updateNode, deleteNode } = useApp()
  const node = map && selectedId ? byId(map.nodes, selectedId) : undefined

  if (!map || !node) {
    return (
      <aside className="panel">
        <h2>노드 상세</h2>
        <p className="panel-empty">
          노드를 선택하면 제목과 메모를 여기서 적을 수 있습니다. 노트북은 키보드, 태블릿은 더블 탭으로 빠르게 편집하세요.
        </p>
      </aside>
    )
  }

  const canDelete = !isPrimaryRoot(map.nodes, node.id)
  const hasKids = childrenOf(map.nodes, node.id).length > 0

  return (
    <aside className="panel">
      <h2>노드 상세</h2>
      <input
        className="panel-title"
        value={node.title}
        onChange={(e) => updateNode(node.id, { title: e.target.value })}
        placeholder="제목"
      />
      <textarea
        className="panel-note"
        value={node.note}
        onChange={(e) => updateNode(node.id, { note: e.target.value })}
        placeholder="간단한 메모"
      />
      <button
        type="button"
        className="ghost-btn panel-delete"
        disabled={!canDelete}
        title={canDelete ? undefined : '중심 노드는 삭제할 수 없습니다'}
        onClick={() => deleteNode(node.id)}
      >
        <IconTrash />
        {canDelete ? (hasKids ? '이 노드와 하위 가지 삭제' : '이 노드 삭제') : '중심 노드는 삭제할 수 없음'}
      </button>
    </aside>
  )
}
