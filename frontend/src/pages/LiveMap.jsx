import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
const API = `http://${window.location.hostname}:8000/api`;

// Fix Leaflet's default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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
  const hasActiveReqs = hospital.activeRequests > 0;
  let color = '#3ddc84';
  let glow = 'rgba(61,220,132,0.4)';

  if (hospital.status !== 'Active') {
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

// Compute bearing between two [lat, lng] points (degrees, 0=north, clockwise)
function bearing(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
            Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}



// Smooth ease-in-out function for natural vehicle movement
function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
  const [sidebarLimit, setSidebarLimit] = useState(50);

  // Vehicle animation refs
  const vehicleAnimRef = useRef(null);
  const vehicleMarkerRef = useRef(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [hospRes, reqRes] = await Promise.all([
        fetch(`${API}/hospitals`),
        fetch(`${API}/requests`),
      ]);
      setHospitals(await hospRes.json());
      setRequests(await reqRes.json());
    } catch (e) {
      console.error('Failed to fetch map data:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
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

    markersLayerRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      disableClusteringAtZoom: 16,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
    }).addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Invalidate map size when sidebar opens/closes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const timer = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [sidebarOpen]);

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

    const markers = [];
    hospitals.forEach(h => {
      const icon = createHospitalIcon(h);
      const marker = L.marker([h.lat, h.lng], { icon })
        .bindPopup(buildPopupContent(h), {
          className: 'map-custom-popup',
          maxWidth: 320,
          minWidth: 260,
        })
        .on('click', () => setSelectedHospitalId(h.id));
      // Instead of adding them one by one which triggers DOM updates, we add them in bulk for performance
      markers.push(marker);
    });
    markersLayerRef.current.addLayers(markers);
  }, [hospitals]);

  // Active in-transit requests
  const inTransitRequests = useMemo(() => {
    return requests.filter(r => r.status === 'In Transit' && r.provider_clinic_id && r.requesting_clinic_id);
  }, [requests]);

  // Auto-select the first in-transit route on load
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (hospitals.length > 0 && inTransitRequests.length > 0) {
      const active = inTransitRequests[0];
      setRouteFrom(active.provider_clinic_id);
      setRouteTo(active.requesting_clinic_id);
      autoSelectedRef.current = true;
    }
  }, [hospitals, inTransitRequests]);

  const hospitalsRef = useRef(hospitals);
  useEffect(() => {
    hospitalsRef.current = hospitals;
  }, [hospitals]);

  // ─── Draw route & animate vehicle (SLOW + SMOOTH) ───
  useEffect(() => {
    if (!routeFrom || !routeTo || !routeLayerRef.current) return;

    const fromH = hospitalsRef.current.find(h => h.id === routeFrom);
    const toH = hospitalsRef.current.find(h => h.id === routeTo);
    if (!fromH || !toH) return;

    setRouteLoading(true);
    setRouteInfo(null);
    routeLayerRef.current.clearLayers();

    // Cancel any running animation
    if (vehicleAnimRef.current) {
      cancelAnimationFrame(vehicleAnimRef.current);
      vehicleAnimRef.current = null;
    }

    fetch(`${API}/routes/geometry?from_lat=${fromH.lat}&from_lng=${fromH.lng}&to_lat=${toH.lat}&to_lng=${toH.lng}`)
      .then(r => r.json())
      .then(data => {
        const coords = (data?.success && data.geometry?.coordinates?.length)
          ? data.geometry.coordinates.map(c => [c[1], c[0]])
          : [
              [fromH.lat, fromH.lng],
              [(fromH.lat + toH.lat) / 2 + 0.003, (fromH.lng + toH.lng) / 2 + 0.003],
              [toH.lat, toH.lng],
            ];

        // ── Layer 1: Outer neon glow ──
        routeLayerRef.current.addLayer(
          L.polyline(coords, {
            color: '#06b6d4', weight: 16, opacity: 0.45,
            lineCap: 'round', lineJoin: 'round', className: 'route-glow',
          })
        );

        // ── Layer 2: Main solid route line ──
        const mainLine = L.polyline(coords, {
          color: '#0f766e', weight: 5, opacity: 0.9,
          lineCap: 'round', lineJoin: 'round', className: 'route-main',
        });
        routeLayerRef.current.addLayer(mainLine);

        // ── Layer 3: Animated ant trail (directional dashes) ──
        routeLayerRef.current.addLayer(
          L.polyline(coords, {
            color: '#ffffff', weight: 3, opacity: 0.85,
            dashArray: '8 16', lineCap: 'round', className: 'route-animated',
          })
        );

        // ── Directional arrow markers along the path ──
        const totalPts = coords.length;
        const arrowInterval = Math.max(1, Math.floor(totalPts / 7));
        for (let i = arrowInterval; i < totalPts - 1; i += arrowInterval) {
          const pt = coords[i];
          const nextPt = coords[Math.min(i + 1, totalPts - 1)];
          const angle = bearing(pt, nextPt);
          const arrowIcon = L.divIcon({
            className: 'route-direction-arrow',
            html: `
              <div style="background:rgba(15,23,42,0.85);border:1px solid #2dd4bf;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px #2dd4bf;">
                <i class="fa-solid fa-chevron-right" style="color:#2dd4bf;font-size:10px;transform:rotate(${angle - 90}deg);"></i>
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          routeLayerRef.current.addLayer(L.marker(pt, { icon: arrowIcon, interactive: false }));
        }

        // ── Origin endpoint pulsing marker ──
        const originIcon = L.divIcon({
          className: 'route-endpoint-marker',
          html: `<div class="route-endpoint-ring" style="--ring-color:#2dd4bf"><div class="ring-dot" style="background:#2dd4bf;box-shadow:0 0 12px #2dd4bf;"></div></div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        });
        routeLayerRef.current.addLayer(L.marker(coords[0], { icon: originIcon, interactive: false }));

        // ── Destination endpoint pulsing marker ──
        const destIcon = L.divIcon({
          className: 'route-endpoint-marker',
          html: `<div class="route-endpoint-ring" style="--ring-color:#f43f5e"><div class="ring-dot" style="background:#f43f5e;box-shadow:0 0 12px #f43f5e;"></div></div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        });
        routeLayerRef.current.addLayer(L.marker(coords[coords.length - 1], { icon: destIcon, interactive: false }));


        // ── Animated vehicle marker ──
        const vehicleIcon = L.divIcon({
          className: 'route-vehicle-marker',
          html: `
            <div class="route-vehicle-icon" style="background:#0f172a;border:2px solid #2dd4bf;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px #2dd4bf;">
              <i class="fa-solid fa-truck-fast" style="color:#2dd4bf;font-size:14px;"></i>
            </div>
          `,
          iconSize: [34, 34], iconAnchor: [17, 17],
        });
        const vMarker = L.marker(coords[0], { icon: vehicleIcon, interactive: false, zIndexOffset: 1000 });
        routeLayerRef.current.addLayer(vMarker);
        vehicleMarkerRef.current = vMarker;

        // ─── SLOW + SMOOTH vehicle animation ───
        // 30 seconds for a full trip, with ease-in-out for realistic acceleration/deceleration
        const TRAVEL_DURATION = 45000;
        let startTime = null;

        // Pre-compute cumulative distances for efficient trail slicing
        const cumDists = [0];
        for (let i = 1; i < coords.length; i++) {
          const d = Math.sqrt(
            Math.pow(coords[i][0] - coords[i - 1][0], 2) +
            Math.pow(coords[i][1] - coords[i - 1][1], 2)
          );
          cumDists.push(cumDists[i - 1] + d);
        }
        const totalDist = cumDists[cumDists.length - 1];

        function getVehiclePos(t) {
          if (totalDist === 0) return coords[0];
          const targetDist = t * totalDist;
          for (let i = 0; i < coords.length; i++) {
            if (cumDists[i] >= targetDist) {
              const prevDist = cumDists[i - 1] || 0;
              const segLen = cumDists[i] - prevDist;
              const segT = segLen > 0 ? (targetDist - prevDist) / segLen : 0;
              const p0 = coords[i - 1] || coords[0];
              return [
                p0[0] + (coords[i][0] - p0[0]) * segT,
                p0[1] + (coords[i][1] - p0[1]) * segT,
              ];
            }
          }
          return coords[coords.length - 1];
        }

        function animateVehicle(timestamp) {
          if (!startTime) startTime = timestamp;
          const elapsed = (timestamp - startTime) % TRAVEL_DURATION;
          const linearT = elapsed / TRAVEL_DURATION;
          // Apply smooth easing so the vehicle accelerates and decelerates naturally
          const easedT = easeInOutCubic(linearT);

          const pos = getVehiclePos(easedT);
          if (vehicleMarkerRef.current && pos && !isNaN(pos[0]) && !isNaN(pos[1])) {
            vehicleMarkerRef.current.setLatLng(pos);
          }


          vehicleAnimRef.current = requestAnimationFrame(animateVehicle);
        }
        vehicleAnimRef.current = requestAnimationFrame(animateVehicle);

        // Fit map to the route
        if (mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds(mainLine.getBounds(), { padding: [70, 70], maxZoom: 15 });
        }

        setRouteInfo({
          distance: data?.distance_km || Math.round(L.latLng(fromH.lat, fromH.lng).distanceTo(L.latLng(toH.lat, toH.lng)) / 100) / 10,
          duration: data?.duration_min || 12,
          from: fromH.name,
          to: toH.name,
        });
      })
      .catch(err => console.error('Route calculation error:', err))
      .finally(() => setRouteLoading(false));

    return () => {
      if (vehicleAnimRef.current) {
        cancelAnimationFrame(vehicleAnimRef.current);
        vehicleAnimRef.current = null;
      }
    };
  }, [routeFrom, routeTo]);

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
    if (vehicleAnimRef.current) {
      cancelAnimationFrame(vehicleAnimRef.current);
      vehicleAnimRef.current = null;
    }
    vehicleMarkerRef.current = null;
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
          <p className="text-muted">Interactive hospital network with real-time data &amp; road routing</p>
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
                  <input placeholder="Search hospitals..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="livemap-sidebar-filters">
                  {['all', 'active', 'issues'].map(f => (
                    <button key={f} className={`livemap-filter-btn ${filterStatus === f ? 'active' : ''}`} onClick={() => setFilterStatus(f)}>
                      {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Issues'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active In-Transit Deliveries */}
              {inTransitRequests.length > 0 && (
                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(45, 212, 191, 0.05)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <i className="fa-solid fa-truck-fast"></i> Active In-Transit Delivery
                  </div>
                  {inTransitRequests.map(req => {
                    const fH = hospitals.find(h => h.id === req.provider_clinic_id);
                    const tH = hospitals.find(h => h.id === req.requesting_clinic_id);
                    const isSelected = routeFrom === req.provider_clinic_id && routeTo === req.requesting_clinic_id;
                    return (
                      <div
                        key={req.id}
                        onClick={() => { setRouteFrom(req.provider_clinic_id); setRouteTo(req.requesting_clinic_id); }}
                        style={{
                          padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer',
                          background: isSelected ? 'rgba(45, 212, 191, 0.15)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                          marginBottom: '0.4rem', transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <strong style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>Request #{req.id}</strong>
                          <span style={{ fontSize: '0.65rem', background: '#2dd4bf', color: '#042f2e', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 800 }}>IN TRANSIT</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span>{fH?.name?.split(' ')[0] || req.provider_clinic_id}</span>
                          <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.6rem', color: 'var(--primary)' }}></i>
                          <span>{tH?.name?.split(' ')[0] || req.requesting_clinic_id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

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

              {/* Hospital list — paginated to handle 50k+ nodes */}
              <div className="livemap-sidebar-list">
                {filteredHospitals.slice(0, sidebarLimit).map(h => {
                  const isSelected = selectedHospitalId === h.id;
                  const hasIssues = h.lowStock > 0 || h.nearExpiry > 0;
                  return (
                    <div key={h.id} className={`livemap-hospital-card ${isSelected ? 'selected' : ''}`} onClick={() => flyToHospital(h.id)}>
                      <div className="livemap-hospital-card-top">
                        <div>
                          <div className="livemap-hospital-name">{h.name}</div>
                          <div className="livemap-hospital-id">{h.id}</div>
                        </div>
                        <button className="livemap-route-btn" title="Use for routing" onClick={(e) => { e.stopPropagation(); handleRouteSelect(h.id); }}>
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
                {sidebarLimit < filteredHospitals.length && (
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.78rem', marginTop: '0.25rem' }}
                    onClick={() => setSidebarLimit(prev => prev + 50)}
                  >
                    <i className="fa-solid fa-chevron-down"></i>
                    Load More ({Math.min(50, filteredHospitals.length - sidebarLimit)} of {filteredHospitals.length - sidebarLimit} remaining)
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Map */}
        <div className="livemap-map-area">
          {/* Active Deliveries Quick Bar */}
          {inTransitRequests.length > 0 && (
            <div className="livemap-active-routes-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 700, paddingRight: '0.5rem', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                <i className="fa-solid fa-truck-fast"></i>
                <span>ACTIVE DELIVERY:</span>
              </div>
              {inTransitRequests.map(req => {
                const fH = hospitals.find(h => h.id === req.provider_clinic_id);
                const tH = hospitals.find(h => h.id === req.requesting_clinic_id);
                const isSelected = routeFrom === req.provider_clinic_id && routeTo === req.requesting_clinic_id;
                return (
                  <button
                    key={req.id}
                    type="button"
                    className={`livemap-active-route-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => { setRouteFrom(req.provider_clinic_id); setRouteTo(req.requesting_clinic_id); }}
                  >
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>#{req.id}</span>
                    <span>{fH?.name?.split(' ')[0] || req.provider_clinic_id}</span>
                    <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.65rem' }}></i>
                    <span>{tH?.name?.split(' ')[0] || req.requesting_clinic_id}</span>
                    <span style={{ fontSize: '0.65rem', background: '#2dd4bf', color: '#042f2e', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 800 }}>
                      IN TRANSIT
                    </span>
                  </button>
                );
              })}
            </div>
          )}

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
