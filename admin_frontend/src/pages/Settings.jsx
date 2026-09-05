import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function Settings() {
  const { config, setConfig, isAdminLoggedIn, addLog, clinics, fetchClinics } = useApp();
  const [localConfig, setLocalConfig] = useState({ ...config });
  const [profileName, setProfileName] = useState('District Hub');
  const [profileRole, setProfileRole] = useState('Admin');
  const [saved, setSaved] = useState({ settings: false, profile: false });

  useEffect(() => {
    fetchClinics();
  }, []);


  function handleSaveSettings(e) {
    e.preventDefault();
    setConfig(localConfig);
    addLog(`System settings updated: Threshold=${localConfig.expiryThresholdDays} days, Buffer=${localConfig.safetyBufferMultiplier}x`);
    setSaved(s => ({ ...s, settings: true }));
    setTimeout(() => setSaved(s => ({ ...s, settings: false })), 2000);
  }

  function handleSaveProfile(e) {
    e.preventDefault();
    document.getElementById('sidebar-name').innerText = profileName;
    document.getElementById('sidebar-role').innerText = profileRole;
    const avatar = document.getElementById('sidebar-avatar');
    if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=0D8ABC&color=fff`;
    addLog(`Profile updated: Name=${profileName}, Role=${profileRole}`);
    setSaved(s => ({ ...s, profile: true }));
    setTimeout(() => setSaved(s => ({ ...s, profile: false })), 2000);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="text-muted">Configure algorithm parameters and your profile</p>
        </div>
      </div>

      {!isAdminLoggedIn && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderColor: 'var(--warning)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <i className="fa-solid fa-lock" style={{ color: 'var(--warning)', fontSize: '1.5rem' }}></i>
          <p style={{ color: 'var(--warning)' }}>Settings are locked. Log in as Admin via the Admin Panel tab to make changes.</p>
        </div>
      )}



      <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Algorithm Settings */}
        <div className="card">
          <div className="card-header">
            <h2>Algorithm Configuration</h2>
          </div>
          <div className="card-body">
            <form className="form-layout" onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>Near-Expiry Threshold (Days)</label>
                <input
                  type="number" min="1" max="180"
                  value={localConfig.expiryThresholdDays}
                  onChange={e => setLocalConfig(c => ({ ...c, expiryThresholdDays: parseInt(e.target.value) }))}
                  disabled={!isAdminLoggedIn}
                />
                <small>Items expiring within this period will be flagged.</small>
              </div>
              <div className="form-group">
                <label>Safety Buffer Multiplier</label>
                <input
                  type="number" step="0.1" min="1.0" max="3.0"
                  value={localConfig.safetyBufferMultiplier}
                  onChange={e => setLocalConfig(c => ({ ...c, safetyBufferMultiplier: parseFloat(e.target.value) }))}
                  disabled={!isAdminLoggedIn}
                />
                <small>Formula: True Excess = Stock − (Avg/Mo × Buffer)</small>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={!isAdminLoggedIn}>
                  {saved.settings ? <><i className="fa-solid fa-check"></i> Saved!</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="card">
          <div className="card-header">
            <h2>Profile Information</h2>
          </div>
          <div className="card-body">
            <form className="form-layout" onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label>Clinic / Node Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <input
                  type="text"
                  value={profileRole}
                  onChange={e => setProfileRole(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {saved.profile ? <><i className="fa-solid fa-check"></i> Saved!</> : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
