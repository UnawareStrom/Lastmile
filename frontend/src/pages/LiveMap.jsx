import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API = `http://${window.location.hostname}:8000/api`;

// Fix Leaflet's default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Tile providers — plain OpenStreetMap (100% free, no API key ever)
// Dark mode uses CSS filter on the map container for dark appearance
const TILES = {
  dark: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

function createHospitalIcon(hospital) {
  const isInactive = hospital.status !== 'Active';
  const hasActiveReqs = hospital.activeRequests > 0;

  let color = '#3ddc84'; // green — healthy
  let glow = 'rgba(61,220,132,0.4)';
  if (isInactive) {
    color = '#545e6b';
    glow = 'rgba(84,94,107,0.3)';
  } else if (hospital.nearExpiry > 0 || hospital.outOfStock > 0) {
    color = '#f0575d';
    glow = 'rgba(240,87,93,0.4)';
  } else if (hospital.lowStock > 0) {
    color = '#f5a524';
    glow = 'rgba(245,165,36,0.4)';
  } else if (hasActiveReqs) {
    color = '#2dd4bf';
    glow = 'rgba(45,212,191,0.4)';
  }

  return L.divIcon({
    className: 'hospital-marker',
    html: `
      <div class="hospital-marker-inner" style="--marker-color:${color};--marker-glow:${glow}">
        <div class="hospital-marker-pulse"></div>
        <div class="hospital-marker-dot">
          <i class="fa-solid fa-hospital" style="font-size:12px;color:#fff"></i>
        </div>
        ${hasActiveReqs ? '<div class="hospital-marker-badge">' + hospital.activeRequests + '</div>' : ''}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
}

function buildPopupContent(hospital) {
  const meds = hospital.medicines || [];
  const medRows = meds.slice(0, 5).map(m => {
    const isLow = m.stock < m.avgMonthlyUsage;
    const isExpiring = m.stock > 0 && m.expiryDays <= 15;
    let statusDot = '<span style="color:#3ddc84">●</span>';
    if (m.stock === 0) statusDot = '<span style="color:#f0575d">●</span>';
    else if (isExpiring) statusDot = '<span style="color:#f0575d">●</span>';
    else if (isLow) statusDot = '<span style="color:#f5a524">●</span>';
    return `<tr>
      <td style="padding:3px 6px;font-size:11px;color:#8892a0">${statusDot} ${m.name}</td>
      <td style="padding:3px 6px;font-size:11px;color:#eef1f5;text-align:right;font-family:monospace">${m.stock}</td>
      <td style="padding:3px 6px;font-size:11px;color:${isExpiring ? '#f0575d' : '#545e6b'};text-align:right">${m.expiryDays}d</td>
    </tr>`;
  }).join('');

  return `
    <div class="map-popup-content">
      <div class="map-popup-header">
        <div class="map-popup-title">${hospital.name}</div>
        <span class="map-popup-id">${hospital.id}</span>
      </div>
      <div class="map-popup-stats">
        <div class="map-popup-stat">
          <span class="map-popup-stat-value">${hospital.totalStock}</span>
          <span class="map-popup-stat-label">Total Stock</span>
        </div>
        <div class="map-popup-stat">
          <span class="map-popup-stat-value" style="color:${hospital.lowStock > 0 ? '#f5a524' : '#3ddc84'}">${hospital.lowStock}</span>
          <span class="map-popup-stat-label">Low Stock</span>
        </div>
        <div class="map-popup-stat">
          <span class="map-popup-stat-value" style="color:${hospital.nearExpiry > 0 ? '#f0575d' : '#3ddc84'}">${hospital.nearExpiry}</span>
          <span class="map-popup-stat-label">Near Expiry</span>
        </div>
        <div class="map-popup-stat">
          <span class="map-popup-stat-value">${hospital.skuCount}</span>
          <span class="map-popup-stat-label">SKUs</span>
        </div>
      </div>
      ${meds.length > 0 ? `
        <div class="map-popup-meds">
          <div style="font-size:10px;color:#545e6b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;font-weight:600">Inventory</div>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th style="padding:2px 6px;font-size:9px;color:#545e6b;text-align:left;text-transform:uppercase">Medicine</th>
              <th style="padding:2px 6px;font-size:9px;color:#545e6b;text-align:right;text-transform:uppercase">Stock</th>
              <th style="padding:2px 6px;font-size:9px;color:#545e6b;text-align:right;text-transform:uppercase">Expiry</th>
            </tr></thead>
            <tbody>${medRows}</tbody>
          </table>
          ${meds.length > 5 ? '<div style="font-size:10px;color:#545e6b;margin-top:3px">+' + (meds.length - 5) + ' more...</div>' : ''}
        </div>
      ` : '<div style="font-size:11px;color:#545e6b;padding:6px 0">No inventory recorded</div>'}
      <div class="map-popup-actions">
        <span class="map-popup-status ${hospital.status === 'Active' ? 'active' : 'inactive'}">
          <i class="fa-solid fa-circle" style="font-size:6px"></i> ${hospital.status}
        </span>
        ${hospital.activeRequests > 0 ? `<span class="map-popup-reqs">${hospital.activeRequests} active request${hospital.activeRequests > 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>
  `;
}

export default function LiveMap() {
  const { theme } = useApp();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);

  const [hospitals, setHospitals] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [routeFrom, setRouteFrom] = useState(null);
  const [routeTo, setRouteTo] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [hospRes, reqRes] = await Promise.all([
        fetch(`${API}/hospitals`),
        fetch(`${API}/requests`),
      ]);
      const hospData = await hospRes.json();
      const reqData = await reqRes.json();
      setHospitals(hospData);
      setRequests(reqData);
    } catch (e) {
      console.error('Failed to fetch map data:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return;

    const map = L.map(mapRef.current, {
      center: [28.69, 77.12],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const tiles = TILES[theme] || TILES.dark;
    tileLayerRef.current = L.tileLayer(tiles.url, {
      attribution: tiles.attribution,
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch tiles on theme change
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const tiles = TILES[theme] || TILES.dark;
    tileLayerRef.current.setUrl(tiles.url);
  }, [theme]);

  // Update markers when hospitals change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    hospitals.forEach(h => {
      const icon = createHospitalIcon(h);
      const marker = L.marker([h.lat, h.lng], { icon })
        .bindPopup(buildPopupContent(h), {
          className: 'map-custom-popup',
          maxWidth: 320,
          minWidth: 260,
        })
        .on('click', () => {
          setSelectedHospitalId(h.id);
        });
      markersLayerRef.current.addLayer(marker);
    });
  }, [hospitals]);

  // Draw route between selected hospitals
  useEffect(() => {
    if (!routeFrom || !routeTo || !routeLayerRef.current) return;

    const fromH = hospitals.find(h => h.id === routeFrom);
    const toH = hospitals.find(h => h.id === routeTo);
    if (!fromH || !toH) return;

    setRouteLoading(true);
    setRouteInfo(null);
    routeLayerRef.current.clearLayers();

    fetch(`${API}/routes/geometry?from_lat=${fromH.lat}&from_lng=${fromH.lng}&to_lat=${toH.lat}&to_lng=${toH.lng}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.geometry) {
          const coords = data.geometry.coordinates.map(c => [c[1], c[0]]);

          // Glow effect
          const glowLine = L.polyline(coords, {
            color: '#2dd4bf',
            weight: 8,
            opacity: 0.15,
            lineCap: 'round',
            lineJoin: 'round',
          });
          routeLayerRef.current.addLayer(glowLine);

          // Main route line
          const routeLine = L.polyline(coords, {
            color: '#2dd4bf',
            weight: 3.5,
            opacity: 0.9,
            dashArray: '12 6',
            lineCap: 'round',
            lineJoin: 'round',
          });
          routeLayerRef.current.addLayer(routeLine);

          // Animated overlay
          const animLine = L.polyline(coords, {
            color: '#ffffff',
            weight: 2,
            opacity: 0.4,
            dashArray: '4 16',
            lineCap: 'round',
            className: 'route-animated',
          });
          routeLayerRef.current.addLayer(animLine);

          mapInstanceRef.current.fitBounds(routeLine.getBounds(), { padding: [60, 60] });

          setRouteInfo({
            distance: data.distance_km,
            duration: data.duration_min,
            from: fromH.name,
            to: toH.name,
          });
        }
      })
      .catch(console.error)
      .finally(() => setRouteLoading(false));
  }, [routeFrom, routeTo, hospitals]);

  // Filter hospitals for sidebar
  const filteredHospitals = useMemo(() => {
    return hospitals.filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' ||
        (filterStatus === 'active' && h.status === 'Active') ||
        (filterStatus === 'issues' && (h.lowStock > 0 || h.nearExpiry > 0));
      return matchesSearch && matchesFilter;
    });
  }, [hospitals, searchTerm, filterStatus]);

  function flyToHospital(hospitalId) {
    const h = hospitals.find(h => h.id === hospitalId);
    if (!h || !mapInstanceRef.current) return;
    setSelectedHospitalId(hospitalId);
    mapInstanceRef.current.flyTo([h.lat, h.lng], 16, { duration: 1.2 });
    markersLayerRef.current.eachLayer(layer => {
      if (layer.getLatLng && layer.getLatLng().lat === h.lat && layer.getLatLng().lng === h.lng) {
        layer.openPopup();
      }
    });
  }

  function clearRoute() {
    setRouteFrom(null);
    setRouteTo(null);
    setRouteInfo(null);
    if (routeLayerRef.current) routeLayerRef.current.clearLayers();
  }

  function handleRouteSelect(hospitalId) {
    if (!routeFrom) {
      setRouteFrom(hospitalId);
    } else if (!routeTo && hospitalId !== routeFrom) {
      setRouteTo(hospitalId);
    } else {
      clearRoute();
      setRouteFrom(hospitalId);
    }
  }

  function toggleFullscreen() {
    setIsFullscreen(prev => !prev);
    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 300);
  }

  const totalHospitals = hospitals.length;
  const activeHospitals = hospitals.filter(h => h.status === 'Active').length;
  const issueCount = hospitals.filter(h => h.lowStock > 0 || h.nearExpiry > 0).length;
  const inTransitCount = requests.filter(r => r.status === 'In Transit').length;

  return (
    <div className={`livemap-container ${isFullscreen ? 'livemap-fullscreen' : ''}`}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h1>Live Map</h1>
          <p className="text-muted">Interactive hospital network with real-time data & road routing</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={toggleFullscreen}>
            <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="livemap-stats-bar">
        <div className="livemap-stat-chip">
          <i className="fa-solid fa-hospital" style={{ color: 'var(--primary)' }}></i>
          <span><strong>{totalHospitals}</strong> Hospitals</span>
        </div>
        <div className="livemap-stat-chip">
          <i className="fa-solid fa-circle" style={{ color: 'var(--success)', fontSize: '0.5rem' }}></i>
          <span><strong>{activeHospitals}</strong> Active</span>
        </div>
        <div className="livemap-stat-chip">
          <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--warning)', fontSize: '0.7rem' }}></i>
          <span style={{ color: issueCount > 0 ? 'var(--warning)' : 'inherit' }}><strong>{issueCount}</strong> Issues</span>
        </div>
        <div className="livemap-stat-chip">
          <i className="fa-solid fa-truck-fast" style={{ color: 'var(--primary)', fontSize: '0.7rem' }}></i>
          <span><strong>{inTransitCount}</strong> In Transit</span>
        </div>
        <div style={{ flex: 1 }}></div>
        <div className="livemap-stat-chip livemap-stat-chip--live">
          <i className="fa-solid fa-circle" style={{ color: 'var(--success)', fontSize: '0.4rem', animation: 'pulse-dot 2.4s ease-in-out infinite' }}></i>
          <span style={{ fontSize: '0.72rem' }}>Live Data</span>
        </div>
      </div>

      {/* Map wrapper */}
      <div className="livemap-wrapper">
        {/* Sidebar */}
        <div className={`livemap-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <button className="livemap-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <i className={`fa-solid ${sidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
          </button>
          {sidebarOpen && (
            <>
              <div className="livemap-sidebar-header">
                <h3><i className="fa-solid fa-list-ul"></i> Hospitals</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{filteredHospitals.length} found</span>
              </div>

              <div className="livemap-sidebar-search">
                <div className="search-bar" style={{ margin: 0 }}>
                  <i className="fa-solid fa-search"></i>
                  <input
                    placeholder="Search hospitals..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="livemap-sidebar-filters">
                  {['all', 'active', 'issues'].map(f => (
                    <button
                      key={f}
                      className={`livemap-filter-btn ${filterStatus === f ? 'active' : ''}`}
                      onClick={() => setFilterStatus(f)}
                    >
                      {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Issues'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Route builder */}
              <div className="livemap-route-builder">
                <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.4rem' }}>
                  <i className="fa-solid fa-route" style={{ marginRight: '0.3rem' }}></i> Route Builder
                </div>
                <div className="livemap-route-fields">
                  <div className="livemap-route-field">
                    <span className="livemap-route-dot" style={{ background: 'var(--primary)' }}></span>
                    <span>{routeFrom ? hospitals.find(h => h.id === routeFrom)?.name || routeFrom : 'Click hospital for origin'}</span>
                  </div>
                  <div className="livemap-route-field">
                    <span className="livemap-route-dot" style={{ background: 'var(--danger)' }}></span>
                    <span>{routeTo ? hospitals.find(h => h.id === routeTo)?.name || routeTo : 'Click hospital for destination'}</span>
                  </div>
                </div>
                {(routeFrom || routeTo) && (
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '0.4rem', fontSize: '0.75rem', marginTop: '0.4rem' }} onClick={clearRoute}>
                    <i className="fa-solid fa-xmark"></i> Clear Route
                  </button>
                )}
              </div>

              {/* Hospital list */}
              <div className="livemap-sidebar-list">
                {filteredHospitals.map(h => {
                  const isSelected = selectedHospitalId === h.id;
                  const hasIssues = h.lowStock > 0 || h.nearExpiry > 0;
                  return (
                    <div
                      key={h.id}
                      className={`livemap-hospital-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => flyToHospital(h.id)}
                    >
                      <div className="livemap-hospital-card-top">
                        <div>
                          <div className="livemap-hospital-name">{h.name}</div>
                          <div className="livemap-hospital-id">{h.id}</div>
                        </div>
                        <button
                          className="livemap-route-btn"
                          title="Use for routing"
                          onClick={(e) => { e.stopPropagation(); handleRouteSelect(h.id); }}
                        >
                          <i className="fa-solid fa-route"></i>
                        </button>
                      </div>
                      <div className="livemap-hospital-card-stats">
                        <span>
                          <i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--primary)', fontSize: '0.6rem' }}></i>
                          {h.totalStock}
                        </span>
                        <span style={{ color: h.lowStock > 0 ? 'var(--warning)' : 'inherit' }}>
                          <i className="fa-solid fa-arrow-down" style={{ fontSize: '0.6rem' }}></i>
                          {h.lowStock} low
                        </span>
                        <span style={{ color: h.nearExpiry > 0 ? 'var(--danger)' : 'inherit' }}>
                          <i className="fa-solid fa-clock" style={{ fontSize: '0.6rem' }}></i>
                          {h.nearExpiry} exp
                        </span>
                      </div>
                      {hasIssues && (
                        <div className="livemap-hospital-alert">
                          <i className="fa-solid fa-triangle-exclamation"></i>
                          {h.nearExpiry > 0 ? 'Near-expiry items' : 'Low stock alert'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Map */}
        <div className="livemap-map-area">
          <div ref={mapRef} className="livemap-map" id="live-map"></div>

          {/* Route info overlay */}
          {routeInfo && (
            <div className="livemap-route-info">
              <div className="livemap-route-info-header">
                <i className="fa-solid fa-route" style={{ color: 'var(--primary)' }}></i>
                <span>Route Details</span>
                <button className="btn-icon" onClick={clearRoute} style={{ marginLeft: 'auto' }}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div className="livemap-route-info-body">
                <div className="livemap-route-info-endpoints">
                  <div><span className="livemap-route-dot" style={{ background: 'var(--primary)' }}></span> {routeInfo.from}</div>
                  <i className="fa-solid fa-arrow-right" style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}></i>
                  <div><span className="livemap-route-dot" style={{ background: 'var(--danger)' }}></span> {routeInfo.to}</div>
                </div>
                <div className="livemap-route-info-stats">
                  <div>
                    <span className="livemap-route-info-value">{routeInfo.distance}</span>
                    <span className="livemap-route-info-label">km</span>
                  </div>
                  <div className="livemap-route-info-divider"></div>
                  <div>
                    <span className="livemap-route-info-value">{routeInfo.duration}</span>
                    <span className="livemap-route-info-label">min</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Route loading overlay */}
          {routeLoading && (
            <div className="livemap-route-loading">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <span>Calculating route...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
