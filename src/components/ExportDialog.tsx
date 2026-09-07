import { useRef } from 'react'
import { exportJson, exportPng, parseImportedJson } from '../lib/export'
import { useApp } from '../state/AppStore'

export function ExportDialog() {
  const { map, exportOpen, setExportOpen, importMap } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  if (!exportOpen) return null

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      const incoming = parseImportedJson(text)
      await importMap(incoming)
      setExportOpen(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : '가져오기에 실패했습니다.')
    }
  }

  return (
    <div className="overlay" onMouseDown={() => setExportOpen(false)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>가져오기 / 내보내기</h3>
        <p className="hint">클라우드 동기화 대신 JSON 파일로 노트북과 갤럭시 탭 사이를 옮깁니다.</p>
        <div className="export-actions">
          {map ? (
            <>
              <button className="primary-btn" onClick={() => exportJson(map)}>
                JSON 내보내기
              </button>
              <button className="ghost-btn" onClick={() => void exportPng(map)}>
                PNG 내보내기
              </button>
            </>
          ) : null}
          <button className="ghost-btn" onClick={() => fileRef.current?.click()}>
            JSON 가져오기
          </button>
          <button className="ghost-btn" onClick={() => setExportOpen(false)}>
            닫기
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}
