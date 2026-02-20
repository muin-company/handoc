import { useState } from 'react';
import { ViewerDemo } from './ViewerDemo';
import { EditorDemo } from './EditorDemo';
import './App.css';

type Tab = 'viewer' | 'editor';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('viewer');

  return (
    <div className="app">
      <header className="header">
        <h1>HanDoc Demo</h1>
        <p>HWPX Viewer & Editor — 100% 클라이언트 사이드 문서 처리</p>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === 'viewer' ? 'active' : ''}`}
          onClick={() => setActiveTab('viewer')}
        >
          📖 Viewer
        </button>
        <button
          className={`tab ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          ✏️ Editor
        </button>
      </nav>

      <main className="content">
        {activeTab === 'viewer' && <ViewerDemo />}
        {activeTab === 'editor' && <EditorDemo />}
      </main>
    </div>
  );
}

export default App;
