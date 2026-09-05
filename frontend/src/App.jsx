import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import ProviderPortal from './pages/ProviderPortal';
import ClinicPortal from './pages/ClinicPortal';
import Inventory from './pages/Inventory';
import LiveMap from './pages/LiveMap';
import './App.css';

function App() {
  const initialView = new URLSearchParams(window.location.search).get('view') || 'clinic';
  const [activeView, setActiveView] = useState(initialView);

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="main-content">
        {activeView === 'clinic' && <ClinicPortal />}
        {activeView === 'provider' && <ProviderPortal />}
        {activeView === 'inventory' && <Inventory />}
        {activeView === 'map' && <LiveMap />}
      </main>
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
