import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';

export default function Inventory() {
  const { inventory, clinics, fetchInventory, fetchClinics, addInventoryItem, useStock, calcTrueExcess, getClinicName, config, isAdminLoggedIn } = useApp();
  const [search, setSearch] = useState('');
  const [viewingAs, setViewingAs] = useState('ADMIN');
  const [filterMed, setFilterMed] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [showCodesModal, setShowCodesModal] = useState(false);
  const [searchCodes, setSearchCodes] = useState('');
  const [form, setForm] = useState({ masterCode: '', name: '', clinicId: '', stock: '', avgMonthlyUsage: '', expiryDays: '' });
  const [saving, setSaving] = useState(false);

  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [addStockForm, setAddStockForm] = useState({ masterCode: '', clinicId: '', stock: '', expiryDays: '' });
  const [addingStock, setAddingStock] = useState(false);
  const [expandedMedicine, setExpandedMedicine] = useState(null);

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null); // { id, name, stock, clinicId }
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [removeConfirmCode, setRemoveConfirmCode] = useState('');

  useEffect(() => {
    fetchInventory();
    fetchClinics();
    // Auto-refresh every 5 seconds to pick up inventory changes from transfers
    const interval = setInterval(async () => {
      await fetchInventory();
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);


  async function handleManualRefresh() {
    setRefreshing(true);
    await fetchInventory();
    setLastRefresh(new Date());
    setRefreshing(false);
  }

  const uniqueMeds = [...new Map(inventory.map(i => [i.masterCode, i])).values()];

  const filtered = inventory.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.masterCode.toLowerCase().includes(search.toLowerCase());
    const matchClinic = viewingAs === 'ADMIN' ? true : i.clinicId === viewingAs;
    const matchMed = filterMed === 'ALL' || i.masterCode === filterMed;
    return matchSearch && matchClinic && matchMed;
  });

  const medicineGroups = Object.values(filtered.reduce((groups, item) => {
    if (!groups[item.masterCode]) {
      groups[item.masterCode] = { masterCode: item.masterCode, name: item.name, variants: [] };
    }
    groups[item.masterCode].variants.push(item);
    return groups;
  }, {}));

  medicineGroups.forEach(group => {
    group.variants.sort((a, b) => a.expiryDays - b.expiryDays);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await addInventoryItem({
      masterCode: form.masterCode,
      name: form.name,
      clinicId: form.clinicId,
      stock: parseInt(form.stock),
      avgMonthlyUsage: parseInt(form.avgMonthlyUsage),
      expiryDays: parseInt(form.expiryDays),
    });
    setSaving(false);
    setShowModal(false);
    setForm({ masterCode: '', name: '', clinicId: '', stock: '', avgMonthlyUsage: '', expiryDays: '' });
  }

  async function handleAddStockSubmit(e) {
    e.preventDefault();
    setAddingStock(true);
    const medName = uniqueMeds.find(m => m.masterCode === addStockForm.masterCode)?.name || 'Unknown Medicine';

    await addInventoryItem({
      masterCode: addStockForm.masterCode,
      name: medName,
      clinicId: addStockForm.clinicId,
      stock: parseInt(addStockForm.stock),
      avgMonthlyUsage: 50, // Default for now
      expiryDays: parseInt(addStockForm.expiryDays),
    });

    setAddingStock(false);
    setShowAddStockModal(false);
    setAddStockForm({ masterCode: '', clinicId: '', stock: '', expiryDays: '' });
    fetchInventory();
  }

  function openRemoveModal(item) {
    setRemoveTarget(item);
    setRemoveError('');
    setRemoveConfirmCode('');
    setShowRemoveModal(true);
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError('');
    const result = await useStock(removeTarget.id, 1);
    setRemoving(false);
    if (result.success) {
      setShowRemoveModal(false);
      setRemoveTarget(null);
      setRemoveConfirmCode('');
    } else {
      setRemoveError(result.error || 'Failed to remove unit.');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p className="text-muted">Full medicine stock across all clinic nodes</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', marginRight: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Viewing As:</label>
            <select
              value={viewingAs}
              onChange={e => setViewingAs(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.85rem' }}
            >
              <option value="ADMIN">All Clinics (Network View)</option>
              {clinics.slice(0, 100).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-circle" style={{ color: 'var(--success)', fontSize: '0.5rem', marginRight: '0.3rem' }}></i>
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button className="btn btn-secondary" onClick={handleManualRefresh} disabled={refreshing} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            <i className={`fa-solid fa-rotate-right ${refreshing ? 'fa-spin' : ''}`}></i> Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCodesModal(true)}>
            <i className="fa-solid fa-book-medical"></i> Master Codes
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddStockModal(true)}>
            <i className="fa-solid fa-plus"></i> Add Stock
          </button>
          <button className="btn btn-secondary" onClick={() => setShowModal(true)}>
            <i className="fa-solid fa-plus"></i> Add New Medicine
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
          <div>
            <p className="sim-form-label">Filter by Medicine</p>
            <select value={filterMed} onChange={e => setFilterMed(e.target.value)} style={{ width: '100%' }}>
              <option value="ALL">All Medicines</option>
              {uniqueMeds.map(m => <option key={m.masterCode} value={m.masterCode}>{m.masterCode} — {m.name}</option>)}
            </select>
          </div>
          <div>
            <p className="sim-form-label">Search</p>
            <div className="search-bar">
              <i className="fa-solid fa-search"></i>
              <input type="text" placeholder="Search medicine or code..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Stock Results <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>({filtered.length} items)</span></h2>
        </div>
        {filtered.some(i => i.stock < i.avgMonthlyUsage) && (
          <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--danger)' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1.2rem' }}></i>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              Warning: {filtered.filter(i => i.stock < i.avgMonthlyUsage).length} medicine(s) in this view are below their average monthly usage. Consider broadcasting a request.
            </span>
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Master Code</th>
                <th>Medicine Name</th>
                <th>Clinic</th>
                <th>Stock</th>
                <th>Avg/Mo</th>
                <th>True Excess</th>
                <th>Expiry (Days)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {medicineGroups.map(group => {
                const item = group.variants[0];
                const excess = calcTrueExcess(item);
                const nearEx = item.stock > 0 && item.expiryDays <= config.expiryThresholdDays;
                const isLowStock = item.stock < item.avgMonthlyUsage;
                const showExpiryDropdown = group.variants.length > 1;
                const isExpanded = expandedMedicine === group.masterCode;

                let badge = <span className="badge badge-success">Optimal</span>;
                if (item.stock === 0) badge = <span className="badge badge-danger">Out of Stock</span>;
                else if (nearEx) badge = <span className="badge badge-danger">Near Expiry</span>;
                else if (excess > 0) badge = <span className="badge badge-warning">Surplus</span>;
                else if (isLowStock) badge = <span className="badge badge-danger">Low Stock</span>;

                return (
                  <>
                    <tr key={group.masterCode} style={{ backgroundColor: isLowStock ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {showExpiryDropdown && (
                            <button
                              type="button"
                              onClick={() => setExpandedMedicine(isExpanded ? null : group.masterCode)}
                              style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', padding: 0 }}
                            >
                              <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                            </button>
                          )}
                          <strong>{item.masterCode}</strong>
                        </div>
                      </td>
                      <td>{item.name}</td>
                      <td>{getClinicName(item.clinicId)}</td>
                      <td style={{ color: isLowStock ? 'var(--danger)' : 'inherit', fontWeight: isLowStock ? 700 : 400 }}>
                        {isLowStock && <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '0.4rem' }}></i>}
                        {item.stock}
                      </td>
                      <td>{item.avgMonthlyUsage}</td>
                      <td style={{ color: excess > 0 ? 'var(--warning)' : 'inherit' }}><strong>{excess}</strong></td>
                      <td style={{ color: nearEx ? 'var(--danger)' : 'inherit', fontWeight: nearEx ? 700 : 400 }}>
                        {item.stock === 0 ? '—' : item.expiryDays}
                      </td>
                      <td>{badge}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.4)' }}
                          onClick={() => openRemoveModal({ id: item.id, name: item.name, stock: item.stock, clinicId: item.clinicId, masterCode: item.masterCode })}
                        >
                          <i className="fa-solid fa-trash-can"></i> Remove
                        </button>
                      </td>
                    </tr>
                    {showExpiryDropdown && isExpanded && (
                      <tr>
                        <td colSpan="8" style={{ padding: '0 1.25rem 1rem' }}>
                          <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Expiry options for this medicine
                            </div>
                            {group.variants.map(variant => (
                              <div key={variant.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span>
                                  <strong>{getClinicName(variant.clinicId)}</strong> • {variant.stock} units • {variant.expiryDays} days
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{variant.masterCode}</span>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.4)' }}
                                    onClick={() => openRemoveModal({ id: variant.id, name: variant.name, stock: variant.stock, clinicId: variant.clinicId, masterCode: variant.masterCode })}
                                  >
                                    <i className="fa-solid fa-trash-can"></i> Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No results found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title="Add Medicine to Inventory" onClose={() => setShowModal(false)}>
          <form className="form-layout" onSubmit={handleSubmit}>
            <div className="form-group-row">
              <div className="form-group">
                <label>Master Code</label>
                <input required value={form.masterCode} onChange={e => setForm({ ...form, masterCode: e.target.value })} placeholder="M-XXX-000" />
              </div>
              <div className="form-group">
                <label>Clinic</label>
                <select required value={form.clinicId} onChange={e => setForm({ ...form, clinicId: e.target.value })}>
                  <option value="">Select clinic...</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Medicine Name</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amoxicillin 500mg" />
            </div>
            <div className="form-group-row">
              <div className="form-group">
                <label>Current Stock (units)</label>
                <input required type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Avg Monthly Usage</label>
                <input required type="number" min="1" value={form.avgMonthlyUsage} onChange={e => setForm({ ...form, avgMonthlyUsage: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Days Until Expiry</label>
              <input required type="number" min="1" value={form.expiryDays} onChange={e => setForm({ ...form, expiryDays: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Add to Database'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Master Codes Modal */}
      {showCodesModal && (
        <Modal title="Master Codes Reference" onClose={() => setShowCodesModal(false)}>
          <div style={{ marginBottom: '1rem' }}>
            <div className="search-bar">
              <i className="fa-solid fa-search"></i>
              <input
                type="text"
                placeholder="Search by code or medicine name..."
                value={searchCodes}
                onChange={e => setSearchCodes(e.target.value)}
              />
            </div>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Medicine Name</th>
                </tr>
              </thead>
              <tbody>
                {uniqueMeds
                  .filter(m => m.masterCode.toLowerCase().includes(searchCodes.toLowerCase()) || m.name.toLowerCase().includes(searchCodes.toLowerCase()))
                  .map(m => (
                    <tr key={m.masterCode}>
                      <td><strong>{m.masterCode}</strong></td>
                      <td>{m.name}</td>
                    </tr>
                  ))}
                {uniqueMeds.filter(m => m.masterCode.toLowerCase().includes(searchCodes.toLowerCase()) || m.name.toLowerCase().includes(searchCodes.toLowerCase())).length === 0 && (
                  <tr>
                    <td colSpan="2" style={{ textAlign: 'center', padding: '1.5rem' }}>No medicines found matching your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && (
        <Modal title="Add Inventory Stock" onClose={() => setShowAddStockModal(false)}>
          <form className="form-layout" onSubmit={handleAddStockSubmit}>
            <div className="form-group-row">
              <div className="form-group">
                <label>Medicine Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. M-PAR-110"
                  value={addStockForm.masterCode}
                  onChange={e => setAddStockForm({ ...addStockForm, masterCode: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label>Target Clinic</label>
                <select
                  required
                  value={addStockForm.clinicId}
                  onChange={e => setAddStockForm({ ...addStockForm, clinicId: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-inset)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '0.4rem' }}
                >
                  <option value="">Select Clinic...</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label>Quantity to Add</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Number of units"
                  value={addStockForm.stock}
                  onChange={e => setAddStockForm({ ...addStockForm, stock: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Days to Expiry</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Days remaining"
                  value={addStockForm.expiryDays}
                  onChange={e => setAddStockForm({ ...addStockForm, expiryDays: e.target.value })}
                />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={addingStock}>
                {addingStock ? 'Adding...' : 'Save Stock'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddStockModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Remove Stock Confirmation Modal */}
      {showRemoveModal && removeTarget && (
        <Modal title="Remove Stock" onClose={() => { setShowRemoveModal(false); setRemoveTarget(null); setRemoveError(''); setRemoveConfirmCode(''); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Warning banner */}
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.6rem', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', color: 'var(--danger)' }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
                <strong>Confirm Removal</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                You are about to permanently remove this inventory record. This action cannot be undone.
              </p>
            </div>

            {/* Item details */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '0.6rem', padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Medicine:</span><br /><strong>{removeTarget.name}</strong></div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Code:</span><br />
                <strong style={{ fontFamily: 'monospace', letterSpacing: '0.05em', color: 'var(--accent)' }}>{removeTarget.masterCode}</strong>
              </div>
              <div><span style={{ color: 'var(--text-muted)' }}>Clinic:</span><br /><strong>{getClinicName(removeTarget.clinicId)}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Stock:</span><br /><strong style={{ color: 'var(--danger)' }}>{removeTarget.stock} units</strong></div>
            </div>

            {/* Code confirmation input */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>
                Enter the code printed on the medicine package:
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Enter printed code"
                value={removeConfirmCode}
                onChange={e => { setRemoveConfirmCode(e.target.value); setRemoveError(''); }}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  letterSpacing: '0.2em',
                  fontSize: '1.1rem',
                  textAlign: 'center',
                  borderColor: removeConfirmCode.length > 0
                    ? removeConfirmCode === '1234'
                      ? 'var(--success)'
                      : 'var(--danger)'
                    : undefined,
                  boxShadow: removeConfirmCode === '1234' ? '0 0 0 2px rgba(34,197,94,0.2)' : undefined,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onKeyDown={e => { if (e.key === 'Enter' && removeConfirmCode === '1234') handleRemoveConfirm(); }}
              />
              {removeConfirmCode.length > 0 && removeConfirmCode !== '1234' && (
                <p style={{ color: 'var(--danger)', fontSize: '0.78rem', margin: '0.3rem 0 0' }}>
                  <i className="fa-solid fa-xmark"></i> Invalid code — check the label on the package
                </p>
              )}
              {removeConfirmCode === '1234' && (
                <p style={{ color: 'var(--success)', fontSize: '0.78rem', margin: '0.3rem 0 0' }}>
                  <i className="fa-solid fa-check"></i> Code accepted — 1 unit will be removed
                </p>
              )}
            </div>

            {removeError && (
              <p style={{ color: 'var(--danger)', margin: 0, fontSize: '0.875rem' }}><i className="fa-solid fa-circle-exclamation"></i> {removeError}</p>
            )}

            <div className="form-actions" style={{ marginTop: '0.25rem' }}>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)', opacity: removeConfirmCode !== '1234' ? 0.45 : 1, cursor: removeConfirmCode !== '1234' ? 'not-allowed' : 'pointer' }}
                onClick={handleRemoveConfirm}
                disabled={removing || removeConfirmCode !== '1234'}
              >
                {removing ? <><i className="fa-solid fa-spinner fa-spin"></i> Removing...</> : <><i className="fa-solid fa-trash-can"></i> Yes, Remove</>}
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowRemoveModal(false); setRemoveTarget(null); setRemoveError(''); setRemoveConfirmCode(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
