import { AppProvider, useApp } from './state/AppStore'
import { EditorScreen } from './components/EditorScreen'
import { ExportDialog } from './components/ExportDialog'
import { HomeScreen } from './components/HomeScreen'
import { SearchOverlay } from './components/SearchOverlay'

function Shell() {
  const { ready, screen } = useApp()
  if (!ready) return <div className="app-boot">MindFlow Lite 준비 중…</div>
  return (
    <>
      {screen === 'home' ? <HomeScreen /> : <EditorScreen />}
      {screen === 'home' ? (
        <>
          <SearchOverlay />
          <ExportDialog />
        </>
      ) : null}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
