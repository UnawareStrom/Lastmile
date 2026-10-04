import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

const API = `http://${window.location.hostname}:8000/api`;

export default function ProviderPortal() {
  const { clinics, fetchClinics, inventory } = useApp();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myClinicId, setMyClinicId] = useState('');
  const [confirmMatch, setConfirmMatch] = useState(null);
  const [otpInputs, setOtpInputs] = useState({});
  const [otpError, setOtpError] = useState({});
  const [otpSuccess, setOtpSuccess] = useState({});
  const [acceptedOtp, setAcceptedOtp] = useState({});
  const [tabFilter, setTabFilter] = useState('active');
  const [offerAmts, setOfferAmts] = useState({});
  const [showOtp, setShowOtp] = useState({});
  const [copiedOtp, setCopiedOtp] = useState({});
  const copiedTimersRef = useRef({});

  useEffect(() => {
    if (clinics.length === 0) fetchClinics();
  }, []);

  useEffect(() => {
    if (clinics.length > 0 && !myClinicId) {
      setMyClinicId(clinics[0].id);
    }
  }, [clinics]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRequests() {
    try {
      const res = await fetch(`${API}/requests`);
      const data = await res.json();
      setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(reqId, providerId, customAmt) {
    try {
      const res = await fetch(`${API}/requests/${reqId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_clinic_id: providerId, custom_transfer_amt: customAmt || null })
      });
      const data = await res.json();
      if (data.success) {
        setAcceptedOtp(prev => ({ ...prev, [reqId]: data.otp }));
        setConfirmMatch(null);
        fetchRequests();
      } else {
        alert(data.detail || data.message);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleVerifyOtp(reqId) {
    const otp = otpInputs[reqId] || '';
    setOtpError(prev => ({ ...prev, [reqId]: null }));
    try {
      const res = await fetch(`${API}/requests/${reqId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp })
      });
      const data = await res.json();
      if (data.success) {
        setOtpSuccess(prev => ({ ...prev, [reqId]: true }));
        fetchRequests();
      } else {
        setOtpError(prev => ({ ...prev, [reqId]: data.detail || 'Incorrect OTP' }));
      }
    } catch (e) {
      setOtpError(prev => ({ ...prev, [reqId]: 'Network error' }));
    }
  }

  async function handleCancel(reqId) {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    try {
      const res = await fetch(`${API}/requests/${reqId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        fetchRequests();
      } else {
        alert(data.detail || data.message);
      }
    } catch (e) {
      alert('Network error. Could not cancel request.');
    }
  }

  const statusBadge = (status) => {
    if (status === 'Pending') return 'badge-warning';
    if (status === 'In Transit') return 'badge-primary';
    if (status === 'Delivered') return 'badge-success';
    if (status === 'Cancelled') return 'badge-danger';
    return '';
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Provider Portal</h1>
          <p className="text-muted">Live Request Feed</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Viewing As:</label>
          <select
            value={myClinicId}
            onChange={e => setMyClinicId(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
          >
            {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

        {/* Tab Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            className={`btn ${tabFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setTabFilter('active')}
          >
            <i className="fa-solid fa-bolt"></i> Active
            <span style={{ marginLeft: '0.4rem', background: 'rgba(255,255,255,0.2)', borderRadius: '999px', padding: '0 0.4rem', fontSize: '0.75rem' }}>
              {requests.filter(r => r.status === 'Pending' || r.status === 'In Transit').length}
            </span>
          </button>
          <button
            className={`btn ${tabFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setTabFilter('all')}
          >
            <i className="fa-solid fa-clock-rotate-left"></i> All History ({requests.length})
          </button>
        </div>

        {loading && <p>Loading requests...</p>}
        {!loading && requests.length === 0 && (
          <div className="allocation-placeholder">
            <i className="fa-solid fa-inbox" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}></i>
            <p>No requests yet. Go to the Dashboard to broadcast one.</p>
          </div>
        )}

        <div className="layout-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {requests
            .filter(req => tabFilter === 'all' || req.status === 'Pending' || req.status === 'In Transit')
            .map(req => {
            const isCancelled = req.status === 'Cancelled';
            const matches = req.matches_json ? JSON.parse(req.matches_json) : [];
            const isPending = req.status === 'Pending';
            const isInTransit = req.status === 'In Transit';
            const isDelivered = req.status === 'Delivered';
            const isMyRequest = req.requesting_clinic_id === myClinicId;
            const myMatch = matches.find(m => m.providerClinic.id === myClinicId);
            const iAmProvider = req.provider_clinic_id === myClinicId;
            const rawOtp = req.otp || acceptedOtp[req.id];
            const isRevealed = showOtp[req.id] ?? true;
            const displayOtp = isRevealed ? (rawOtp || '••••••') : '••••••';

            return (
              <div key={req.id} className="card" style={{
                opacity: isDelivered ? 0.6 : 1,
                border: `1px solid ${isMyRequest ? 'var(--primary)' : 'var(--border-color)'}`,
                transition: 'all 0.3s'
              }}>
                {/* Header */}
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>
                    {isDelivered && <i className="fa-solid fa-circle-check" style={{ color: 'var(--success)', marginRight: '0.4rem' }}></i>}
                    {isInTransit && <i className="fa-solid fa-truck-fast" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i>}
                    Request #{req.id}
                  </h3>
                  <span className={`badge ${statusBadge(req.status)}`}>{req.status}</span>
                </div>

                {/* Info */}
                <div style={{ padding: '1rem 1.25rem' }}>
                  <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.9rem' }}><strong>Medicine:</strong> {req.medicine_code}</p>
                  <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.9rem' }}><strong>Requested By:</strong> {req.requesting_clinic_id}</p>
                  {(() => {
                    const invItem = inventory.find(item => item.masterCode === req.medicine_code);
                    return invItem ? (
                      <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        <strong>Avg Monthly Usage:</strong> {invItem.avgMonthlyUsage} units
                      </p>
                    ) : null;
                  })()}
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(req.created_at).toLocaleTimeString()}</p>
                </div>

                {/* PENDING: Show accept / sent / not eligible */}
                {isPending && (
                  <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    {isMyRequest ? (
                      <div>
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--primary)' }}>
                          <i className="fa-solid fa-paper-plane"></i> You sent this request. Waiting for a provider to accept.
                        </p>
                        <button
                          className="btn btn-danger"
                          style={{ width: '100%', justifyContent: 'center', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}
                          onClick={() => handleCancel(req.id)}
                        >
                          <i className="fa-solid fa-circle-xmark"></i> Cancel Request
                        </button>
                      </div>
                    ) : myMatch && myMatch.transferAmt > 0 ? (
                      <div>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                          <i className="fa-solid fa-circle-check"></i> You have <strong>{myMatch.stock} units</strong> in stock. System suggests offering <strong>{myMatch.transferAmt} units</strong>.
                        </p>
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <strong>Avg Monthly Usage:</strong> {myMatch.avgMonthlyUsage} units
                        </p>
                        <p className="sim-form-label" style={{ marginBottom: '0.3rem' }}>Units you are willing to give</p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <input
                            type="number"
                            min="1"
                            max={myMatch.stock}
                            placeholder={`Max ${myMatch.stock}`}
                            value={offerAmts[req.id] ?? myMatch.transferAmt}
                            onChange={e => setOfferAmts(prev => ({ ...prev, [req.id]: parseInt(e.target.value) || '' }))}
                            style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '0.4rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                          />
                          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ {myMatch.stock} available</span>
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => setConfirmMatch({ reqId: req.id, match: myMatch, customAmt: offerAmts[req.id] ?? myMatch.transferAmt })}
                        >
                          <i className="fa-solid fa-handshake"></i> Accept & Dispatch
                        </button>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-circle-xmark"></i> You are not eligible to fulfill this request.
                      </p>
                    )}
                  </div>
                )}

                {/* CANCELLED */}
                {isCancelled && (
                  <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--danger)' }}>
                      <i className="fa-solid fa-circle-xmark"></i> This request was cancelled.
                    </p>
                  </div>
                )}

                {/* IN TRANSIT */}
                {isInTransit && (
                  <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    {iAmProvider ? (
                      /* Provider sees the OTP to hand over */
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
                          Give this OTP to the receiving clinic upon delivery:
                        </p>
                        <div style={{
                          fontSize: '2rem', fontWeight: 800, letterSpacing: '0.4rem',
                          color: 'var(--primary)', background: 'rgba(99,102,241,0.12)',
                          borderRadius: '0.75rem', padding: '0.75rem 1rem',
                          border: '2px dashed var(--primary)', marginBottom: '0.5rem',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {displayOtp}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            onClick={() => setShowOtp(prev => ({ ...prev, [req.id]: !(prev[req.id] ?? true) }))}
                          >
                            <i className={`fa-solid ${isRevealed ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            {isRevealed ? 'Hide OTP' : 'See OTP'}
                          </button>
                          {rawOtp && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                              onClick={() => {
                                navigator.clipboard.writeText(rawOtp);
                                setCopiedOtp(prev => ({ ...prev, [req.id]: true }));
                                // Clear any existing timer for this request
                                if (copiedTimersRef.current[req.id]) clearTimeout(copiedTimersRef.current[req.id]);
                                copiedTimersRef.current[req.id] = setTimeout(() => setCopiedOtp(prev => ({ ...prev, [req.id]: false })), 2000);
                              }}
                            >
                              <i className={`fa-solid ${copiedOtp[req.id] ? 'fa-check' : 'fa-copy'}`}></i>
                              {copiedOtp[req.id] ? 'Copied!' : 'Copy OTP'}
                            </button>
                          )}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                          {rawOtp ? 'Keep this code secure until handover' : 'Waiting for code generation'}
                        </p>
                      </div>
                    ) : isMyRequest ? (
                      /* Requester enters OTP to confirm delivery */
                      <div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
                          <i className="fa-solid fa-truck-fast"></i> Medicine is on the way. Enter the OTP from the provider to confirm delivery:
                        </p>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="Enter 6-digit OTP"
                            value={otpInputs[req.id] || ''}
                            onChange={e => setOtpInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                            style={{
                              flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                              background: 'rgba(0,0,0,0.25)', border: `1px solid ${otpError[req.id] ? 'var(--danger)' : 'var(--border-color)'}`,
                              color: 'var(--text-main)', fontSize: '1rem', letterSpacing: '0.2rem', fontWeight: 700
                            }}
                          />
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.5rem 0.9rem', whiteSpace: 'nowrap' }}
                            onClick={() => handleVerifyOtp(req.id)}
                          >
                            <i className="fa-solid fa-shield-check"></i> Verify
                          </button>
                        </div>
                        {otpError[req.id] && (
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--danger)' }}>
                            <i className="fa-solid fa-triangle-exclamation"></i> {otpError[req.id]}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <i className="fa-solid fa-truck-fast"></i> In transit from <strong>{req.provider_clinic_id}</strong> → <strong>{req.requesting_clinic_id}</strong>
                        </p>
                        {rawOtp && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', marginTop: '0.3rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OTP:</span>
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)', letterSpacing: '0.1em' }}>
                              {showOtp[req.id] ? rawOtp : '••••••'}
                            </strong>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                              onClick={() => setShowOtp(prev => ({ ...prev, [req.id]: !prev[req.id] }))}
                            >
                              <i className={`fa-solid ${showOtp[req.id] ? 'fa-eye-slash' : 'fa-eye'}`}></i> {showOtp[req.id] ? 'Hide' : 'See OTP'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* DELIVERED */}
                {isDelivered && (
                  <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--success)' }}>
                      <i className="fa-solid fa-circle-check"></i> Delivery confirmed! Inventory has been updated.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      {/* Confirmation Modal */}
      {confirmMatch && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', margin: '1rem' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Confirm & Dispatch</h3>
              <button onClick={() => setConfirmMatch(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                You are about to dispatch medicine for <strong>Request #{confirmMatch.reqId}</strong>.
                An OTP will be generated — share it with the receiving clinic upon delivery.
              </p>
              <div style={{ background: 'var(--bg-sidebar, rgba(0,0,0,0.2))', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Your Current Stock</span>
                  <strong>{confirmMatch.match.stock} units</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Avg Monthly Usage</span>
                  <strong>{confirmMatch.match.avgMonthlyUsage} units / mo</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Transfer Amount</span>
                  <strong style={{ color: 'var(--danger)' }}>- {confirmMatch.match.transferAmt} units</strong>
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Stock After Dispatch</span>
                  <strong style={{ color: 'var(--success)' }}>{confirmMatch.match.stock - confirmMatch.customAmt} units</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => handleAccept(confirmMatch.reqId, confirmMatch.match.providerClinic.id, confirmMatch.customAmt)}
                >
                  <i className="fa-solid fa-truck-fast"></i> Confirm & Dispatch
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setConfirmMatch(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
