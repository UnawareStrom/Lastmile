import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import KpiCard from '../components/KpiCard';

export default function Dashboard() {
  const { inventory, clinics, fetchInventory, fetchClinics, calcTrueExcess, getClinicName,
          config, simulateTransfer, addLog } = useApp();

  const [simLoading, setSimLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);
  const [requestedAmt, setRequestedAmt] = useState('');

  const [selectedClinicId, setSelectedClinicId] = useState(() => localStorage.getItem('myClinicId') || '');
  const [selectedMasterCode, setSelectedMasterCode] = useState(() => localStorage.getItem('myMedCode') || '');

  useEffect(() => { fetchInventory(); fetchClinics(); }, []);

  useEffect(() => {
    if (clinics.length && !selectedClinicId) setSelectedClinicId(clinics[0].id);
  }, [clinics]);

  const uniqueMeds = useMemo(() => {
    const seen = new Map();
    inventory.forEach(i => { if (!seen.has(i.masterCode)) seen.set(i.masterCode, i.name); });
    return Array.from(seen, ([code, name]) => ({ code, name }));
  }, [inventory]);

  useEffect(() => {
    if (uniqueMeds.length && !selectedMasterCode) setSelectedMasterCode(uniqueMeds[0].code);
  }, [uniqueMeds]);

  const nearExpiry = inventory.filter(i => i.expiryDays <= config.expiryThresholdDays).length;
  const surplus    = inventory.filter(i => calcTrueExcess(i) > 0).length;
  const lowStock   = inventory.filter(i => i.stock < i.avgMonthlyUsage).length;
  const previewRows = inventory.slice(0, 5);

  const requestingClinic = clinics.find(c => c.id === selectedClinicId);

  async function handleRequest() {
    if (!selectedClinicId || !selectedMasterCode) return;
    setSimLoading(true);
    setRequestStatus(null);

    const result = await simulateTransfer(selectedClinicId, selectedMasterCode);

    if (result.success) {
      setRequestStatus({ success: true, message: `Request broadcasted to ${result.matches.length} clinics.`, matches: result.matches });
      addLog(`Broadcasted request for ${selectedMasterCode} on behalf of ${requestingClinic?.name}`, true);
    } else {
      setRequestStatus({ success: false, message: result.message, matches: [] });
      addLog(result.message, false);
    }
    setSimLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted">Real-time inventory &amp; redistribution overview</p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard icon="fa-boxes-stacked"        label="Total SKUs"    value={inventory.length}       subtitle="Tracked medicines" />
        <KpiCard icon="fa-triangle-exclamation" label="Near Expiry"   value={`${nearExpiry} items`}  color="var(--danger)"  subtitle={`≤${config.expiryThresholdDays} days`} />
        <KpiCard icon="fa-arrow-up-wide-short"  label="Surplus Items" value={`${surplus} items`}     color="var(--warning)" />
        <KpiCard icon="fa-arrow-down-wide-short" label="Low Stock"    value={`${lowStock} items`}    color="var(--success)" />
      </div>

      <div className="layout-grid">
        {/* Inventory Snapshot */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Inventory Snapshot</h2>
            {lowStock > 0 && (
              <span className="badge badge-danger">
                <i className="fa-solid fa-triangle-exclamation"></i> {lowStock} items low on stock
              </span>
            )}
          </div>
          {lowStock > 0 && (
            <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', fontSize: '0.85rem' }}>
              <strong>Action Required:</strong> You have {lowStock} medicine(s) across your network currently below their average monthly usage. Please use the Request Engine below to coordinate restocks.
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Master Code</th><th>Medicine</th><th>Clinic</th>
                  <th>Stock</th><th>True Excess</th><th>Avg</th><th>Expiry</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map(item => {
                  const excess = calcTrueExcess(item);
                  const nearEx = item.stock > 0 && item.expiryDays <= config.expiryThresholdDays;
                  const isLowStock = item.stock < item.avgMonthlyUsage;
                  
                  let badge = <span className="badge badge-success">Optimal</span>;
                  if (item.stock === 0) badge = <span className="badge badge-danger">Out of Stock</span>;
                  else if (nearEx) badge = <span className="badge badge-danger">Near Expiry</span>;
                  else if (excess > 0) badge = <span className="badge badge-warning">Surplus</span>;
                  else if (isLowStock) badge = <span className="badge badge-danger">Low Stock</span>;
                  
                  return (
                    <tr key={item.id} style={{ backgroundColor: isLowStock ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                      <td><strong>{item.masterCode}</strong></td>
                      <td>{item.name}</td>
                      <td>{getClinicName(item.clinicId)}</td>
                      <td style={{ color: isLowStock ? 'var(--danger)' : 'inherit', fontWeight: isLowStock ? 700 : 400 }}>
                        {isLowStock && <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '0.4rem' }}></i>}
                        {item.stock}
                      </td>
                      <td style={{ color: excess > 0 ? 'var(--warning)' : 'inherit' }}><strong>{excess}</strong></td>
                      <td>{item.avgMonthlyUsage}</td>
                      <td style={{ color: nearEx ? 'var(--danger)' : 'inherit', fontWeight: nearEx ? 700 : 400 }}>
                        {item.stock === 0 ? '—' : `${item.expiryDays} days`}
                      </td>
                      <td>{badge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Request Engine */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <h2><i className="fa-solid fa-paper-plane" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i>Request Engine</h2>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {/* Request Form */}
              <div className="sim-form">
                <p className="sim-form-label">Requesting Clinic</p>
                <select value={selectedClinicId}
                  onChange={e => { setSelectedClinicId(e.target.value); setRequestStatus(null); }}>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <p className="sim-form-label" style={{ marginTop: '0.75rem' }}>Medicine Needed</p>
                <select value={selectedMasterCode}
                  onChange={e => { setSelectedMasterCode(e.target.value); setRequestStatus(null); }}>
                  {uniqueMeds.map(m => <option key={m.code} value={m.code}>{m.code} — {m.name}</option>)}
                </select>

                <p className="sim-form-label" style={{ marginTop: '0.75rem' }}>Amount Needed <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(units, optional)</span></p>
                <input
                  type="number"
                  min="1"
                  placeholder="Leave blank to let the system decide"
                  value={requestedAmt}
                  onChange={e => setRequestedAmt(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
                  onClick={handleRequest}
                  disabled={simLoading || !selectedClinicId || !selectedMasterCode}
                >
                  {simLoading
                    ? <><i className="fa-solid fa-spinner fa-spin"></i> Broadcasting Request...</>
                    : <><i className="fa-solid fa-paper-plane"></i> Broadcast Request</>}
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.25rem 0' }}></div>

              {/* Empty state */}
              {!simLoading && !requestStatus && (
                <div className="allocation-placeholder">
                  <i className="fa-solid fa-satellite-dish"></i>
                  <p>Select a clinic and medicine, then click <strong>Broadcast Request</strong> to alert providers.</p>
                </div>
              )}

              {/* Loading */}
              {simLoading && (
                <div className="allocation-placeholder">
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <p>Broadcasting to all eligible clinics...</p>
                </div>
              )}

              {/* Result */}
              {requestStatus && !simLoading && (
                <div>
                  <div className="match-card" style={{ borderColor: requestStatus.success ? 'var(--success)' : 'var(--danger)', marginBottom: requestStatus.matches?.length ? '1rem' : 0 }}>
                    <div className="match-header">
                      <h4 style={{ color: requestStatus.success ? 'var(--success)' : 'var(--danger)' }}>
                        {requestStatus.success ? <><i className="fa-solid fa-circle-check"></i> Broadcast Sent!</> : <><i className="fa-solid fa-circle-xmark"></i> No Clinics Available</>}
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {requestStatus.message}
                    </p>
                    {requestStatus.success && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--primary)', margin: 0 }}>
                        <i className="fa-solid fa-arrow-left"></i> Check the <strong>Provider Portal</strong> tab to see offers from clinics.
                      </p>
                    )}
                  </div>

                  {/* Per-match amount panels */}
                  {requestStatus.matches?.map((m, i) => (
                    <div key={i} style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.75rem',
                      padding: '0.9rem 1rem',
                      marginBottom: '0.6rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{m.providerClinic.name}</p>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {m.distanceKm != null ? `${m.distanceKm} km away` : 'Distance N/A'}
                          {m.nearExpiry && <span style={{ color: 'var(--danger)', marginLeft: '0.5rem' }}>• Near Expiry</span>}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '1.6rem', fontWeight: 800,
                          color: 'var(--success)',
                          lineHeight: 1
                        }}>
                          {m.transferAmt}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>units available</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Master Code Reference Panel */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <h2><i className="fa-solid fa-book-medical" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i>Master Codes Reference</h2>
            </div>
            <div style={{ padding: '0', maxHeight: '300px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Medicine Name</th>
                  </tr>
                </thead>
                <tbody>
                  {uniqueMeds.map(m => (
                    <tr key={m.code}>
                      <td><strong>{m.code}</strong></td>
                      <td>{m.name}</td>
                    </tr>
                  ))}
                  {uniqueMeds.length === 0 && (
                    <tr>
                      <td colSpan="2" style={{ textAlign: 'center', padding: '1.5rem' }}>No medicines found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
