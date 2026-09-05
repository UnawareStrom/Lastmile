import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';

const API = `http://${window.location.hostname}:8000/api`;

export default function ClinicPortal() {
  const { clinics, inventory, fetchClinics, fetchInventory, simulateTransfer, config, calcTrueExcess, addInventoryItem } = useApp();

  const [myClinicId, setMyClinicId] = useState(() => localStorage.getItem('cp_clinicId') || '');
  const [requests, setRequests] = useState([]);
  const [loadingReqs, setLoadingReqs] = useState(true);

  // Request engine
  const [selectedMed, setSelectedMed] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [reqResult, setReqResult] = useState(null);

  // OTP verification
  const [otpInputs, setOtpInputs] = useState({});
  const [otpError, setOtpError] = useState({});
  const [otpSuccess, setOtpSuccess] = useState({});

  // Provider accept
  const [acceptedOtp, setAcceptedOtp] = useState({});

  useEffect(() => {
    fetchClinics();
    fetchInventory();
  }, []);

  useEffect(() => {
    if (clinics.length && !myClinicId) {
      const saved = localStorage.getItem('cp_clinicId');
      setMyClinicId(saved || clinics[0].id);
    }
  }, [clinics]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 4000);
    return () => clearInterval(interval);
  }, []);

  function handleClinicChange(id) {
    setMyClinicId(id);
    localStorage.setItem('cp_clinicId', id);
    setReqResult(null);
  }

  async function fetchRequests() {
    try {
      const res = await fetch(`${API}/requests`);
      const data = await res.json();
      setRequests(data);
    } catch (e) { /* silent */ } finally { setLoadingReqs(false); }
  }

  // My clinic's inventory
  const myInventory = useMemo(() =>
    inventory.filter(i => i.clinicId === myClinicId),
    [inventory, myClinicId]
  );

  const uniqueMeds = useMemo(() => {
    const seen = new Map();
    inventory.forEach(i => { if (!seen.has(i.masterCode)) seen.set(i.masterCode, i.name); });
    return Array.from(seen, ([code, name]) => ({ code, name }));
  }, [inventory]);

  // My clinic's requests (as requester)
  const myRequests = useMemo(() =>
    requests.filter(r => r.requesting_clinic_id === myClinicId),
    [requests, myClinicId]
  );

  // Pending requests where MY clinic is an eligible provider (matches_json contains my id)
  const incomingRequests = useMemo(() =>
    requests.filter(r =>
      r.status === 'Pending' &&
      r.requesting_clinic_id !== myClinicId &&
      (() => { try { return JSON.parse(r.matches_json || '[]').some(m => m.providerClinic?.id === myClinicId); } catch { return false; } })()
    ),
    [requests, myClinicId]
  );

  const myClinic = clinics.find(c => c.id === myClinicId);

  // Stats
  const lowStock   = myInventory.filter(i => i.stock < i.avgMonthlyUsage).length;
  const nearExpiry = myInventory.filter(i => i.stock > 0 && i.expiryDays <= config.expiryThresholdDays).length;
  const surplus    = myInventory.filter(i => calcTrueExcess(i) > 0).length;

  async function handleRequest() {
    if (!myClinicId || !selectedMed) return;
    setSimLoading(true);
    setReqResult(null);
    const result = await simulateTransfer(myClinicId, selectedMed);
    setReqResult(result);
    setSimLoading(false);
    fetchRequests();
  }

  async function handleAccept(reqId, providerId) {
    try {
      const res = await fetch(`${API}/requests/${reqId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_clinic_id: providerId }),
      });
      const data = await res.json();
      if (data.success) {
        setAcceptedOtp(prev => ({ ...prev, [reqId]: data.otp }));
        fetchRequests();
      } else alert(data.detail || data.message);
    } catch (e) { alert('Network error.'); }
  }

  async function handleVerifyOtp(reqId) {
    const otp = otpInputs[reqId] || '';
    setOtpError(prev => ({ ...prev, [reqId]: null }));
    try {
      const res = await fetch(`${API}/requests/${reqId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSuccess(prev => ({ ...prev, [reqId]: true }));
        fetchRequests();
        fetchInventory();
      } else setOtpError(prev => ({ ...prev, [reqId]: data.detail || 'Incorrect OTP' }));
    } catch { setOtpError(prev => ({ ...prev, [reqId]: 'Network error' })); }
  }

  function statusBadge(status) {
    const map = {
      Pending:   'badge-warning',
      'In Transit': 'badge-primary',
      Delivered: 'badge-success',
      Cancelled: 'badge-danger',
    };
    return <span className={`badge ${map[status] || 'badge-warning'}`}>{status}</span>;
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Clinic Portal</h1>
          <p className="text-muted">Your clinic's live inventory, requests & deliveries</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Clinic:
          </span>
          <select
            value={myClinicId}
            onChange={e => handleClinicChange(e.target.value)}
            style={{ minWidth: '220px' }}
          >
            {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Non-admin notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.18)',
        borderRadius: '0.75rem', padding: '0.85rem 1.25rem', marginBottom: '1.5rem',
      }}>
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary)', fontSize: '1.1rem' }}></i>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          You are viewing as <strong style={{ color: 'var(--text-main)' }}>{myClinic?.name || '—'}</strong>.
          You can request medicines and confirm deliveries. Admin features are not available in this portal.
        </p>
      </div>

      {/* KPI row */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <div className="kpi-label">Low Stock</div>
            <div className="kpi-value" style={{ color: lowStock > 0 ? 'var(--danger)' : 'var(--text-main)' }}>{lowStock}</div>
            <div className="kpi-subtitle">medicines below monthly usage</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(240,87,93,0.12)', color: 'var(--danger)' }}>
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div>
            <div className="kpi-label">Near Expiry</div>
            <div className="kpi-value" style={{ color: nearExpiry > 0 ? 'var(--danger)' : 'var(--text-main)' }}>{nearExpiry}</div>
            <div className="kpi-subtitle">expiring within {config.expiryThresholdDays} days</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245,165,36,0.12)', color: 'var(--warning)' }}>
            <i className="fa-solid fa-arrow-up-wide-short"></i>
          </div>
          <div>
            <div className="kpi-label">Surplus</div>
            <div className="kpi-value" style={{ color: surplus > 0 ? 'var(--warning)' : 'var(--text-main)' }}>{surplus}</div>
            <div className="kpi-subtitle">medicines with true excess</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* My Inventory */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <h2><i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i>My Inventory</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{myInventory.length} SKUs</span>
            </div>
            {myInventory.length === 0 ? (
              <div className="allocation-placeholder">
                <i className="fa-solid fa-box-open"></i>
                <p>No inventory recorded for this clinic yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Stock</th>
                      <th>Avg/Mo</th>
                      <th>Expiry</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myInventory.map(item => {
                      const excess  = calcTrueExcess(item);
                      const nearEx  = item.stock > 0 && item.expiryDays <= config.expiryThresholdDays;
                      const lowSt   = item.stock < item.avgMonthlyUsage;
                      let badge = <span className="badge badge-success">Optimal</span>;
                      if (item.stock === 0)  badge = <span className="badge badge-danger">Out of Stock</span>;
                      else if (nearEx)       badge = <span className="badge badge-danger">Near Expiry</span>;
                      else if (excess > 0)   badge = <span className="badge badge-warning">Surplus</span>;
                      else if (lowSt)        badge = <span className="badge badge-danger">Low Stock</span>;
                      return (
                        <tr key={item.id} style={{ background: lowSt ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{item.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{item.masterCode}</div>
                          </td>
                          <td style={{ color: lowSt ? 'var(--danger)' : 'inherit', fontWeight: lowSt ? 700 : 400 }}>
                            {lowSt && <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '0.3rem' }}></i>}
                            {item.stock}
                          </td>
                          <td>{item.avgMonthlyUsage}</td>
                          <td style={{ color: nearEx ? 'var(--danger)' : 'inherit', fontWeight: nearEx ? 700 : 400 }}>
                            {item.stock === 0 ? '—' : `${item.expiryDays}d`}
                          </td>
                          <td>{badge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* My Requests */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-header">
              <h2><i className="fa-solid fa-list-check" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i>My Requests</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <i className="fa-solid fa-circle" style={{ color: 'var(--success)', fontSize: '0.45rem' }}></i>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Live</span>
              </div>
            </div>
            {loadingReqs ? (
              <div className="allocation-placeholder"><i className="fa-solid fa-spinner fa-spin"></i><p>Loading...</p></div>
            ) : myRequests.length === 0 ? (
              <div className="allocation-placeholder">
                <i className="fa-solid fa-satellite-dish"></i>
                <p>No requests made yet. Use the Request Engine to request medicine.</p>
              </div>
            ) : (
              <div style={{ padding: '1rem' }}>
                {myRequests.map(req => {
                  const inTransit  = req.status === 'In Transit';
                  const delivered  = req.status === 'Delivered';
                  const alreadyVerified = otpSuccess[req.id];
                  const otpToShow  = acceptedOtp[req.id];

                  return (
                    <div key={req.id} style={{
                      background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                      borderRadius: '0.7rem', padding: '1rem', marginBottom: '0.75rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{req.medicine_code}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginLeft: '0.5rem' }}>#{req.id}</span>
                        </div>
                        {statusBadge(req.status)}
                      </div>

                      {/* In Transit: OTP verification */}
                      {inTransit && !delivered && (
                        <div style={{ marginTop: '0.75rem' }}>
                          {otpToShow && (
                            <div style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(45,212,191,0.08)', borderRadius: '0.5rem', border: '1px solid rgba(45,212,191,0.2)' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>OTP for provider: </span>
                              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)', letterSpacing: '0.12em' }}>{otpToShow}</strong>
                            </div>
                          )}
                          {alreadyVerified ? (
                            <div style={{ color: 'var(--success)', fontSize: '0.82rem' }}><i className="fa-solid fa-check-circle"></i> Delivery confirmed!</div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                              <input
                                type="text" maxLength={6}
                                placeholder="Enter OTP to confirm delivery"
                                value={otpInputs[req.id] || ''}
                                onChange={e => setOtpInputs(p => ({ ...p, [req.id]: e.target.value }))}
                                style={{ flex: 1, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}
                              />
                              <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => handleVerifyOtp(req.id)}>
                                <i className="fa-solid fa-check"></i> Confirm
                              </button>
                            </div>
                          )}
                          {otpError[req.id] && (
                            <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
                              <i className="fa-solid fa-circle-xmark"></i> {otpError[req.id]}
                            </p>
                          )}
                        </div>
                      )}

                      {delivered && (
                        <div style={{ marginTop: '0.5rem', color: 'var(--success)', fontSize: '0.82rem' }}>
                          <i className="fa-solid fa-circle-check"></i> Medicine received and inventory updated.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incoming offers (where I'm a provider) */}
          {incomingRequests.length > 0 && (
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <h2><i className="fa-solid fa-truck-fast" style={{ color: 'var(--warning)', marginRight: '0.4rem' }}></i>Incoming Requests (You're a Provider)</h2>
                <span className="badge badge-warning">{incomingRequests.length}</span>
              </div>
              <div style={{ padding: '1rem' }}>
                {incomingRequests.map(req => {
                  const matches = (() => { try { return JSON.parse(req.matches_json || '[]'); } catch { return []; } })();
                  const myMatch = matches.find(m => m.providerClinic?.id === myClinicId);
                  if (!myMatch) return null;
                  const alreadyAccepted = acceptedOtp[req.id];
                  return (
                    <div key={req.id} style={{
                      background: 'rgba(245,165,36,0.06)', border: '1px solid rgba(245,165,36,0.2)',
                      borderRadius: '0.7rem', padding: '1rem', marginBottom: '0.75rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{req.medicine_code}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginLeft: '0.5rem' }}>
                            requested by <strong style={{ color: 'var(--text-muted)' }}>{req.requesting_clinic_id}</strong>
                          </span>
                        </div>
                        <span className="badge badge-warning">Pending</span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        You can offer <strong style={{ color: 'var(--text-main)' }}>{myMatch.transferAmt} units</strong>
                        {myMatch.nearExpiry && <span style={{ color: 'var(--danger)', marginLeft: '0.4rem' }}>· Near Expiry</span>}
                      </p>
                      {alreadyAccepted ? (
                        <div style={{ color: 'var(--success)', fontSize: '0.82rem' }}>
                          <i className="fa-solid fa-check-circle"></i> Accepted! Share OTP <strong style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>{alreadyAccepted}</strong> with the requester.
                        </div>
                      ) : (
                        <button className="btn btn-primary" onClick={() => handleAccept(req.id, myClinicId)}>
                          <i className="fa-solid fa-handshake"></i> Accept & Dispatch
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column – Request Engine */}
        <div className="card" style={{ marginBottom: 0, position: 'sticky', top: '1rem' }}>
          <div className="card-header">
            <h2><i className="fa-solid fa-paper-plane" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i>Request Medicine</h2>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <div className="sim-form">
              <p className="sim-form-label">Medicine Needed</p>
              <select value={selectedMed} onChange={e => { setSelectedMed(e.target.value); setReqResult(null); }}>
                <option value="">Select medicine...</option>
                {uniqueMeds.map(m => <option key={m.code} value={m.code}>{m.code} — {m.name}</option>)}
              </select>

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
                onClick={handleRequest}
                disabled={simLoading || !myClinicId || !selectedMed}
              >
                {simLoading
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Broadcasting...</>
                  : <><i className="fa-solid fa-paper-plane"></i> Broadcast Request</>}
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.25rem 0' }}></div>

            {!simLoading && !reqResult && (
              <div className="allocation-placeholder">
                <i className="fa-solid fa-satellite-dish"></i>
                <p>Select a medicine and broadcast to alert nearby clinics with surplus stock.</p>
              </div>
            )}

            {simLoading && (
              <div className="allocation-placeholder">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <p>Scanning network for providers...</p>
              </div>
            )}

            {reqResult && !simLoading && (
              <div className="allocation-result">
                <div className="match-card" style={{ borderColor: reqResult.success ? 'var(--success)' : 'var(--danger)', marginBottom: reqResult.matches?.length ? '1rem' : 0 }}>
                  <div className="match-header">
                    <h4 style={{ color: reqResult.success ? 'var(--success)' : 'var(--danger)' }}>
                      {reqResult.success
                        ? <><i className="fa-solid fa-circle-check"></i> Broadcast Sent!</>
                        : <><i className="fa-solid fa-circle-xmark"></i> No Providers Found</>}
                    </h4>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>{reqResult.message}</p>
                  {reqResult.success && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.5rem' }}>
                      Check <strong>My Requests</strong> below to track status and confirm delivery.
                    </p>
                  )}
                </div>

                {reqResult.matches?.map((m, i) => (
                  <div key={i} style={{
                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                    borderRadius: '0.65rem', padding: '0.85rem 1rem', marginBottom: '0.5rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{m.providerClinic.name}</p>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        {m.distanceKm != null ? `${m.distanceKm} km away` : 'Distance N/A'}
                        {m.nearExpiry && <span style={{ color: 'var(--danger)', marginLeft: '0.5rem' }}>· Near Expiry</span>}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)', lineHeight: 1 }}>{m.transferAmt}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>units</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
