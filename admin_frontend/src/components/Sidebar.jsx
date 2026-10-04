import { useApp } from '../context/AppContext';

export default function Sidebar({ activeView, setActiveView, onAdminClick }) {
  const { isAdminLoggedIn, config, theme, toggleTheme } = useApp();

  const navItems = [
    { id: 'dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
    { id: 'inventory', icon: 'fa-boxes-stacked', label: 'Inventory' },
    { id: 'settings', icon: 'fa-sliders', label: 'Settings' },
    { id: 'admin', icon: 'fa-shield-halved', label: 'Admin Panel', adminOnly: true },
  ];

  const handleClick = (item) => {
    if (item.id === 'admin' && !isAdminLoggedIn) {
      onAdminClick();
      return;
    }
    setActiveView(item.id);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <i className="fa-solid fa-route"></i>
        <span>LastMile</span>
      </div>
      <nav>
        <ul>
          {navItems.map(item => (
            <li
              key={item.id}
              className={activeView === item.id ? 'active' : ''}
              onClick={() => handleClick(item)}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              <span>{item.label}</span>
              {item.adminOnly && (
                <i className={`fa-solid ${isAdminLoggedIn ? 'fa-lock-open' : 'fa-lock'} ms-auto`}
                   style={{ fontSize: '0.7rem', marginLeft: 'auto', opacity: 0.6 }}></i>
              )}
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="theme-toggle" style={{ padding: '0 1.5rem', marginTop: 'auto', marginBottom: '1rem' }}>
        <button 
          onClick={toggleTheme} 
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'background 0.2s',
            fontFamily: 'var(--font-family)',
            fontWeight: 500
          }}
        >
          <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>

      <div className="user-profile">
        <img src="https://ui-avatars.com/api/?name=District+Hub&background=0D8ABC&color=fff" alt="User" id="sidebar-avatar" />
        <div>
          <h4 id="sidebar-name">District Hub</h4>
          <p id="sidebar-role">{isAdminLoggedIn ? 'Admin (Unlocked)' : 'Viewer'}</p>
        </div>
      </div>
    </aside>
  );
}
