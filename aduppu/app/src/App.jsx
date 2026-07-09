import React, { useState } from 'react';

const TABS = ['Today', 'Plan', 'Cook', 'Track'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Today');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header style={{
        padding: '12px 16px',
        backgroundColor: '#e2d6ba',
        fontFamily: '"Saira Condensed", sans-serif',
        fontWeight: 800,
        fontSize: '1.5rem',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        Aduppu
      </header>

      {/* Tab bar */}
      <nav style={{
        display: 'flex',
        borderBottom: '1px solid #ddd',
        backgroundColor: '#fff',
      }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#333' : '#888',
              borderBottom: activeTab === tab ? '2px solid #333' : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Main content area */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888',
        fontSize: '1rem',
      }}>
        Tab content here
      </main>
    </div>
  );
}
