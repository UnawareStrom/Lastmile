import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import './App.css';

function LoginScreen() {
  const { login } = useApp();
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (login(pwd)) {
      // logged in — App will re-render and show dashboard
    } else {
      setError('Incorrect password');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      fontFamily: 'var(--font-family)',
    }}>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '1.25rem',
          padding: '2.5rem 2rem',
          width: '100%',
          maxWidth: '380px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          animation: shake ? 'shake 0.4s ease' : undefined,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 24px rgba(45,212,191,0.25)',
          }}>
            <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.5rem', color: '#fff' }}></i>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)' }}>Admin Portal</h1>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Enter your credentials to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem',
            }}>
              Password
            </label>
            <input
              type="password"
              value={pwd}
              onChange={e => { setPwd(e.target.value); setError(''); }}
              autoFocus
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: `1px solid ${error ? 'var(--danger)' : 'var(--border-color)'}`,
                background: 'var(--bg-elevated)',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
                fontFamily: 'var(--font-family)',
              }}
            />
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '0.4rem 0 0' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.3rem' }}></i>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-right-to-bracket" style={{ marginRight: '0.5rem' }}></i>
            Sign In
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}

function App() {
  const initialView = new URLSearchParams(window.location.search).get('view') || 'dashboard';
  const [activeView, setActiveView] = useState(initialView);
  const { isAdminLoggedIn } = useApp();

  // If not logged in, show ONLY the login screen — nothing else
  if (!isAdminLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="main-content">
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'inventory' && <Inventory />}
        {activeView === 'settings' && <Settings />}
        {activeView === 'admin' && <AdminPanel />}
      </main>
    </div>
  );
}

export default function Root() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
