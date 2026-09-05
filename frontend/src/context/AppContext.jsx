import React, { createContext, useContext, useState, useCallback } from 'react';

const API_BASE = '/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [config, setConfig] = useState({ expiryThresholdDays: 15, safetyBufferMultiplier: 1.2 });
  const [activityLogs, setActivityLogs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState({ inventory: false, clinics: false });
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const addLog = useCallback((message, isSuccess = false) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setActivityLogs(prev => [{ time, message, isSuccess }, ...prev]);
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(l => ({ ...l, inventory: true }));
    try {
      const res = await fetch(`${API_BASE}/inventory`);
      const data = await res.json();
      setInventory(data);
    } catch (e) {
      console.error('Failed to fetch inventory', e);
    } finally {
      setLoading(l => ({ ...l, inventory: false }));
    }
  }, []);

  const fetchClinics = useCallback(async () => {
    setLoading(l => ({ ...l, clinics: true }));
    try {
      const res = await fetch(`${API_BASE}/clinics`);
      const data = await res.json();
      setClinics(data);
    } catch (e) {
      console.error('Failed to fetch clinics', e);
    } finally {
      setLoading(l => ({ ...l, clinics: false }));
    }
  }, []);

  const addInventoryItem = useCallback(async (item) => {
    const res = await fetch(`${API_BASE}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (res.ok) {
      const saved = await res.json();
      setInventory(prev => [saved, ...prev]);
      addLog(`Added ${item.stock} units of ${item.name} to clinic ${item.clinicId}`);
    }
  }, [addLog]);

  const useStock = useCallback(async (itemId, quantity) => {
    const res = await fetch(`${API_BASE}/inventory/${itemId}/use`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setInventory(prev => prev.map(i => i.id === itemId ? { ...i, stock: data.stock } : i));
      addLog(`Used ${quantity} units from inventory item #${itemId}. Remaining: ${data.stock}.`, true);
      return { success: true };
    }
    return { success: false, error: data.detail || 'Failed to deduct stock' };
  }, [addLog]);

  const removeStock = useCallback(async (itemId) => {
    const item = inventory.find(i => i.id === itemId);
    const res = await fetch(`${API_BASE}/inventory/${itemId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      setInventory(prev => prev.filter(i => i.id !== itemId));
      addLog(`Removed inventory record #${itemId}${item ? ` (${item.name} @ ${item.clinicId})` : ''}.`, false);
      return { success: true };
    }
    return { success: false, error: data.detail || 'Failed to remove item' };
  }, [inventory, addLog]);

  const addClinic = useCallback(async (clinic) => {
    const res = await fetch(`${API_BASE}/clinics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clinic),
    });
    if (res.ok) {
      const saved = await res.json();
      setClinics(prev => [...prev, saved]);
      addLog(`New Clinic Registered: ${saved.id} — ${saved.name} at (${saved.lat}, ${saved.lng})`, true);
      return { success: true, data: saved };
    }
    return { success: false };
  }, [addLog]);

  const simulateTransfer = useCallback(async (requestingClinicId, requestedMedicineCode) => {
    const res = await fetch(`${API_BASE}/simulate-transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestingClinicId,
        requestedMedicineCode,
        expiryThresholdDays: config.expiryThresholdDays,
        safetyBufferMultiplier: config.safetyBufferMultiplier,
      }),
    });
    return res.json();
  }, [config]);

  const login = useCallback((password) => {
    if (password === 'admin') {
      setIsAdminLoggedIn(true);
      addLog('Admin logged in successfully', true);
      return true;
    }
    return false;
  }, [addLog]);

  const calcTrueExcess = (item) => {
    const buffer = item.avgMonthlyUsage * config.safetyBufferMultiplier;
    const excess = item.stock - buffer;
    return excess > 0 ? Math.floor(excess) : 0;
  };

  const getClinicName = (id) => {
    const c = clinics.find(c => c.id === id);
    return c ? c.name : id;
  };

  return (
    <AppContext.Provider value={{
      theme, toggleTheme,
      isAdminLoggedIn, login,
      config, setConfig,
      activityLogs, addLog,
      inventory, fetchInventory, addInventoryItem, useStock, removeStock,
      clinics, fetchClinics,
      addClinic,
      calcTrueExcess, getClinicName,
      simulateTransfer,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
