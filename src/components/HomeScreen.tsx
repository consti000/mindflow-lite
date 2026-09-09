import { FOLDERS } from '../types'
import { TEMPLATES } from '../lib/templates'
import { useApp } from '../state/AppStore'
import { BrandMark, IconPlus } from './Icons'

function formatTime(ts: number) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)
}

export function HomeScreen() {
  const {
    metas,
    folderFilter,
    setFolderFilter,
    openMap,
    createMap,
    createFromTemplate,
    removeMap,
    setFolder,
    setSearchOpen,
    setExportOpen,
  } = useApp()

  const visible = metas.filter((m) => folderFilter === 'all' || m.folder === folderFilter)

  return (
    <div className="home">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">MindFlow Lite</div>
            <div className="brand-sub">개인용 생각 구조화</div>
          </div>
        </div>
        <nav className="nav">
          <button className={folderFilter === 'all' ? 'active' : ''} onClick={() => setFolderFilter('all')}>
            홈
          </button>
          <button onClick={() => setSearchOpen(true)}>검색</button>
          <button onClick={() => setExportOpen(true)}>가져오기 / 내보내기</button>
        </nav>
        <div>
          <div className="section-label">폴더</div>
          {FOLDERS.map((f) => (
            <button
              key={f.id}
              className={`folder-btn${folderFilter === f.id ? ' active' : ''}`}
              onClick={() => setFolderFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sidebar-foot">서버·로그인 없이 이 기기에 저장됩니다. 월 운영비 0원을 목표로 한 로컬 PWA입니다.</div>
      </aside>

      <main className="home-main">
        <div className="home-head">
          <div>
            <h1>생각을 적고, 구조로 남기기</h1>
            <p>빠르게 적고, 가지를 치고, 나중에 다시 꺼내는 개인용 마인드맵 노트</p>
          </div>
          <button className="primary-btn" onClick={() => void createMap()}>
            <IconPlus /> 새 마인드맵
          </button>
        </div>

        <h2 className="block-title">최근 맵</h2>
        <div className="card-grid">
          {visible.map((m) => (
            <article key={m.id} className="map-card">
              <button className="map-preview" onClick={() => void openMap(m.id)} aria-label={`${m.title} 열기`} />
              <h3>{m.title}</h3>
              <p className="meta">
                {m.nodeCount}개 노드 · {formatTime(m.updatedAt)}
              </p>
              <div className="card-actions">
                <button className="ghost-btn" onClick={() => void openMap(m.id)}>
                  열기
                </button>
                <select value={m.folder} onChange={(e) => void setFolder(m.id, e.target.value as typeof m.folder)}>
                  {FOLDERS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <button className="danger" onClick={() => void removeMap(m.id)}>
                  삭제
                </button>
              </div>
            </article>
          ))}
        </div>

        <h2 className="block-title">추천 템플릿</h2>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.id} className="template-card" onClick={() => void createFromTemplate(t.id)}>
              <div className="template-dot" style={{ background: t.color }} />
              <h3>{t.label}</h3>
              <p>{t.desc}</p>
            </button>
          ))}
        </div>
      </main>

      <nav className="home-mobile-nav">
        <button className={folderFilter === 'all' ? 'active' : ''} onClick={() => setFolderFilter('all')}>
          홈
        </button>
        <button onClick={() => setSearchOpen(true)}>검색</button>
        <button className="primary-btn" onClick={() => void createMap()}>
          <IconPlus /> 새 맵
        </button>
        <button onClick={() => setFolderFilter('drafts')}>초안</button>
      </nav>
    </div>
  )
}
