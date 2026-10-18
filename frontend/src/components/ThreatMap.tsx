import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Alert } from '../types/alert';
import { TIER_CONFIG } from '../types/alert';
import { Globe, MapPin } from 'lucide-react';

interface ThreatMapProps {
  alerts: Alert[];
  selectedAlert: Alert | null;
  onSelectAlert: (alert: Alert) => void;
}

export const ThreatMap: React.FC<ThreatMapProps> = ({
  alerts,
  selectedAlert,
  onSelectAlert,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markersByMsgIdRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 10,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1.0,
      worldCopyJump: false,
      attributionControl: false,
    });

    // Standard OpenStreetMap tiles with noWrap and keepBuffer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      noWrap: true,
      keepBuffer: 4,
    }).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: '© OpenStreetMap contributors' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Invalidate size on next frame to prevent blank/gray tile rendering
    const frameId = requestAnimationFrame(() => {
      map.invalidateSize();
    });

    // ResizeObserver on map container to continuously fix dimensions
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers and fit bounds when alerts change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    markersByMsgIdRef.current.clear();

    const geoAlerts = alerts.filter(
      (a): a is Alert & { geolocation: NonNullable<Alert['geolocation']> } =>
        a.geolocation !== null &&
        typeof a.geolocation.lat === 'number' &&
        typeof a.geolocation.long === 'number'
    );

    if (geoAlerts.length === 0) {
      map.setView([20, 0], 2);
      return;
    }

    // Group alerts by lat,long key to spread duplicates
    const groups = new Map<string, typeof geoAlerts>();
    geoAlerts.forEach((alert) => {
      const key = `${alert.geolocation.lat.toFixed(5)},${alert.geolocation.long.toFixed(5)}`;
      const list = groups.get(key) || [];
      list.push(alert);
      groups.set(key, list);
    });

    const markerBounds = L.latLngBounds([]);

    groups.forEach((groupAlerts) => {
      const count = groupAlerts.length;
      groupAlerts.forEach((alert, index) => {
        const { lat, long, city, country } = alert.geolocation;
        let displayLat = lat;
        let displayLong = long;

        // If multiple alerts share identical coordinates, spread around small circle (~0.6 deg)
        if (count > 1) {
          const angle = (2 * Math.PI * index) / count;
          const radius = 0.6;
          displayLat = lat + radius * Math.sin(angle);
          displayLong = long + (radius * Math.cos(angle)) / Math.cos((lat * Math.PI) / 180 || 1);
        }

        markerBounds.extend([displayLat, displayLong]);

        const tierStyle = TIER_CONFIG[alert.risk_tier];

        // Light-themed pulse marker without colored glow
        const customIcon = L.divIcon({
          className: 'custom-threat-marker',
          html: `
            <div class="marker-pulse-wrapper" style="--marker-color: ${tierStyle.color}">
              <div class="marker-ring"></div>
              <div class="marker-core"></div>
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          popupAnchor: [0, -12],
        });

        const marker = L.marker([displayLat, displayLong], { icon: customIcon });

        const popupContent = document.createElement('div');
        popupContent.className = 'threat-popup-container';
        popupContent.innerHTML = `
          <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 220px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                padding: 2px 7px;
                border-radius: 4px;
                background-color: ${tierStyle.bg};
                color: ${tierStyle.color};
                border: 1px solid ${tierStyle.border};
              ">
                ${alert.risk_tier.toUpperCase()} TIER
              </span>
              <span style="font-size: 13px; font-weight: 700; color: #0B2545;">
                ${alert.risk_score.toFixed(1)} / 100
              </span>
            </div>
            <div style="font-size: 12px; font-weight: 600; color: #0B2545; margin-bottom: 4px; line-height: 1.35;">
              ${escapeHtml(alert.subject)}
            </div>
            <div style="font-size: 11px; color: #4A5D7C; margin-bottom: 6px; word-break: break-all;">
              From: <strong style="color: #0B2545;">${escapeHtml(alert.from)}</strong>
            </div>
            <div style="font-size: 11px; color: #7F8FA9; margin-bottom: 10px;">
              📍 ${escapeHtml(city ? `${city}, ${country}` : country)} (${lat.toFixed(2)}, ${long.toFixed(2)})
            </div>
            <button id="view-alert-${alert.message_id}" style="
              width: 100%;
              padding: 7px 10px;
              font-size: 11px;
              font-weight: 600;
              color: #ffffff;
              background-color: #1F4E9E;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              transition: background-color 0.15s;
            ">
              Inspect Threat Details →
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, { className: 'custom-popup', maxWidth: 280 });
        marker.on('popupopen', () => {
          const btn = document.getElementById(`view-alert-${alert.message_id}`);
          if (btn) {
            btn.onclick = () => {
              onSelectAlert(alert);
              marker.closePopup();
            };
          }
        });

        marker.addTo(markersLayer);
        markersByMsgIdRef.current.set(alert.message_id, marker);
      });
    });

    if (markerBounds.isValid()) {
      map.fitBounds(markerBounds, { padding: [50, 50], maxZoom: 5 });
    }
  }, [alerts, onSelectAlert]);

  // Handle selected alert pan / popup (zoom max 6)
  useEffect(() => {
    if (!selectedAlert || !mapInstanceRef.current) return;
    if (selectedAlert.geolocation) {
      const marker = markersByMsgIdRef.current.get(selectedAlert.message_id);
      const targetLatLng: L.LatLngExpression = marker
        ? marker.getLatLng()
        : [selectedAlert.geolocation.lat, selectedAlert.geolocation.long];
      mapInstanceRef.current.flyTo(targetLatLng, 6, { duration: 1.2 });
      if (marker) {
        marker.openPopup();
      }
    }
  }, [selectedAlert]);

  const geoCount = alerts.filter((a) => a.geolocation !== null).length;

  return (
    <div className="threat-map-wrapper">
      <div className="threat-map-header">
        <div className="map-title-group">
          <Globe className="icon-globe" size={18} />
          <span className="map-title">Global Threat Origin Map</span>
          <span className="geo-count-badge">
            <MapPin size={12} /> {geoCount} of {alerts.length} Flagged Senders Geocoded
          </span>
        </div>
        <div className="map-legend">
          <span className="legend-item"><span className="legend-dot critical"></span>Critical</span>
          <span className="legend-item"><span className="legend-dot high"></span>High</span>
          <span className="legend-item"><span className="legend-dot medium"></span>Medium</span>
          <span className="legend-item"><span className="legend-dot low"></span>Low</span>
        </div>
      </div>
      <div ref={mapContainerRef} className="threat-map-container" />
    </div>
  );
};

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
