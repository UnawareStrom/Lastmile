import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import './App.css';

function LoginModal({ onClose }) {
  const { login } = useApp();
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (login(pwd)) {
      onClose(true);
    } else {
      setError('Incorrect password. Hint: try "admin"');
    }
  }

  return (
    <Modal title="Admin Login Required" onClose={() => onClose(false)}>
      <form className="form-layout" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={pwd}
            onChange={e => { setPwd(e.target.value); setError(''); }}
            autoFocus
            placeholder="Enter admin password..."
          />
          {error && <small style={{ color: 'var(--danger)' }}>{error}</small>}
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Login</button>
          <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function App() {
  const initialView = new URLSearchParams(window.location.search).get('view') || 'dashboard';
  const [activeView, setActiveView] = useState(initialView);
  const [showLogin, setShowLogin] = useState(false);
  const { isAdminLoggedIn } = useApp();

  function handleAdminClick() {
    if (!isAdminLoggedIn) setShowLogin(true);
    else setActiveView('dashboard');
  }

  function handleLoginClose(success) {
    setShowLogin(false);
    if (success) setActiveView('dashboard');
  }

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} setActiveView={setActiveView} onAdminClick={handleAdminClick} />
      <main className="main-content">
        {activeView === 'dashboard' && isAdminLoggedIn && <Dashboard />}
        {activeView === 'dashboard' && !isAdminLoggedIn && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: '1rem', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-lock" style={{ fontSize: '3rem', opacity: 0.4 }} />
            <h2 style={{ margin: 0 }}>Dashboard Locked</h2>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Login as admin using the <strong>Admin Panel</strong> in the sidebar to view the dashboard.</p>
          </div>
        )}
        {activeView === 'settings' && <Settings />}
        {activeView === 'admin' && <AdminPanel />}
      </main>
      {showLogin && <LoginModal onClose={handleLoginClose} />}
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
