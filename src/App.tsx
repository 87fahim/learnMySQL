import { QueryWorkspace } from './components/QueryWorkspace'

import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Learn MySQL</h1>
        <p className="app-tagline">
          Write SQL, run it against your practice API, and read results in the table below.
        </p>
      </header>
      <main className="app-main">
        <QueryWorkspace />
      </main>
    </div>
  )
}

export default App
