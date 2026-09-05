import { useApp } from '../context/AppContext';

export default function Sidebar({ activeView, setActiveView }) {
  const { theme, toggleTheme } = useApp();

  const navItems = [
    { id: 'clinic', icon: 'fa-hospital', label: 'Clinic Portal' },
    { id: 'provider', icon: 'fa-hospital-user', label: 'Provider Portal' },
    { id: 'inventory', icon: 'fa-boxes-stacked', label: 'Inventory' },
    { id: 'map', icon: 'fa-map-location-dot', label: 'Live Map' },
  ];

  const handleClick = (item) => {
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
        <img src="https://ui-avatars.com/api/?name=Client+User&background=0D8ABC&color=fff" alt="User" id="sidebar-avatar" />
        <div>
          <h4 id="sidebar-name">Client User</h4>
          <p id="sidebar-role">Standard Access</p>
        </div>
      </div>
    </aside>
  );
}
