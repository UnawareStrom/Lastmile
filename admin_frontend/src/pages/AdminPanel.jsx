import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';

export default function AdminPanel() {
  const { clinics, fetchClinics, activityLogs, addClinic } = useApp();

  useEffect(() => {
    fetchClinics();
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', lat: '', lng: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    const newId = `C00${clinics.length + 1}`;
    
    await addClinic({
      id: newId,
      name: form.name,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      status: 'Active'
    });
    
    setShowModal(false);
    setForm({ name: '', lat: '', lng: '' });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1><i className="fa-solid fa-shield-halved" style={{ color: 'var(--primary)' }}></i> Admin Panel</h1>
          <p className="text-muted">Manage clinic nodes and review system activity</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Clinic Registry */}
        <div className="card">
          <div className="card-header">
            <h2>Clinic Registry</h2>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
              <i className="fa-solid fa-plus"></i> Add Node
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Clinic Name</th>
                  <th>Coordinates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map(clinic => (
                  <tr key={clinic.id}>
                    <td><strong>{clinic.id}</strong></td>
                    <td>{clinic.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{clinic.lat}, {clinic.lng}</td>
                    <td><span className="badge badge-success">{clinic.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Log */}
        <div className="card">
          <div className="card-header">
            <h2>Global Activity Log</h2>
          </div>
          <div style={{ padding: '1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {activityLogs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                No recent activities. Run a simulation or change settings to log events.
              </p>
            ) : (
              <div className="activity-timeline">
                {activityLogs.map((log, i) => (
                  <div key={i} className={`timeline-item ${log.isSuccess ? 'success' : ''}`}>
                    <div className="time">{log.time}</div>
                    <div className="content" dangerouslySetInnerHTML={{ __html: log.message }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <Modal title="Register New Clinic Node" onClose={() => setShowModal(false)}>
          <form className="form-layout" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Clinic Name</label>
              <input
                type="text"
                required
                placeholder="e.g. City Hospital North"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Latitude</label>
                <input
                  type="number" step="any"
                  required
                  placeholder="e.g. 28.7041"
                  value={form.lat}
                  onChange={e => setForm({ ...form, lat: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input
                  type="number" step="any"
                  required
                  placeholder="e.g. 77.1025"
                  value={form.lng}
                  onChange={e => setForm({ ...form, lng: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Register Node</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
