'use client';

import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { getAircraftId, getAircraftStateColor, getAircraftVisualState, getAltitudeColor } from '@/lib/aircraftDisplay';
import type { AltitudeVisualState } from '@/lib/aircraftDisplay';
import type { Aircraft, AircraftTrackPoint } from '@/types/aircraft';

const DEFAULT_MAP_CENTER: [number, number] = [39.7588, -104.919];
const ALTITUDE_LEGEND: { state: AltitudeVisualState; label: string }[] = [
  { state: 'ground', label: 'Ground / unknown' },
  { state: 'altitude-0', label: '0–4,999 ft' },
  { state: 'altitude-5', label: '5,000–9,999 ft' },
  { state: 'altitude-10', label: '10,000–14,999 ft' },
  { state: 'altitude-15', label: '15,000–19,999 ft' },
  { state: 'altitude-20', label: '20,000–24,999 ft' },
  { state: 'altitude-25', label: '25,000–29,999 ft' },
  { state: 'altitude-30', label: '30,000–34,999 ft' },
  { state: 'altitude-35', label: '35,000–39,999 ft' },
  { state: 'altitude-40', label: '40,000+ ft' },
];
const TRACK_GRADIENT_STEPS = 6;

function mixColors(start: string, end: string, amount: number) {
  const startValue = Number.parseInt(start.slice(1), 16);
  const endValue = Number.parseInt(end.slice(1), 16);
  const channel = (shift: number) => Math.round(((startValue >> shift) & 255) + (((endValue >> shift) & 255) - ((startValue >> shift) & 255)) * amount);
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
}

function getMarkerIcon(color: string, heading: number, state: ReturnType<typeof getAircraftVisualState>) {
  const stateIndicator = state === 'stale'
    ? '<circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2" />'
    : state === 'selected'
      ? '<path d="M10 0.75 L19.25 10 L10 19.25 L0.75 10 Z" fill="none" stroke="currentColor" stroke-width="1.5" />'
      : '';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" style="color: ${color}; transform: rotate(${heading}deg); transform-origin: center;">
      ${stateIndicator}
      <path d="M10 1 L18 16 L10 12 L2 16 Z" fill="${color}" stroke="white" stroke-width="1"/>
    </svg>
  `;

  return L.divIcon({
    className: 'adsb-marker',
    html: svg,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
}

function getHomeLocationIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="#00ffff" stroke-width="1.5" />
      <path d="M12 1.5 V6 M12 18 V22.5 M1.5 12 H6 M18 12 H22.5" fill="none" stroke="#00ffff" stroke-width="1.5" />
      <circle cx="12" cy="12" r="2" fill="#00ffff" />
    </svg>
  `;

  return L.divIcon({
    className: 'home-location-marker',
    html: svg,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function MapSelection({ onClearSelection }: { onClearSelection: () => void }) {
  useMapEvents({ click: onClearSelection });
  return null;
}

function fitMapToRadius(map: L.Map, center: [number, number], radiusNm: number) {
  map.invalidateSize({ pan: false });
  const radiusBounds = L.latLng(center).toBounds(radiusNm * 1852 * 2);
  map.fitBounds(radiusBounds, { padding: [32, 32], animate: false });
}

function MapControls({ center, radiusNm }: { center: [number, number]; radiusNm: number }) {
  const map = useMap();

  return (
    <div className="map-controls leaflet-bar" onClick={(event) => event.stopPropagation()}>
      <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => map.zoomIn()}>+</button>
      <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => map.zoomOut()}>−</button>
      <button type="button" title="Reset map view" aria-label="Recenter and reset map zoom" onClick={() => fitMapToRadius(map, center, radiusNm)}>⌖</button>
    </div>
  );
}

function MapViewport({ center, radiusNm }: { center: [number, number]; radiusNm: number }) {
  const map = useMap();

  useEffect(() => {
    const invalidateSize = () => map.invalidateSize({ pan: false });
    const frame = requestAnimationFrame(() => fitMapToRadius(map, center, radiusNm));
    const resizeObserver = new ResizeObserver(invalidateSize);
    resizeObserver.observe(map.getContainer());

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [center, radiusNm, map]);

  return null;
}

export function AircraftMap({
  aircraft,
  userLocation,
  radiusNm,
  selectedAircraftId,
  selectedTrack,
  onSelectAircraft,
}: {
  aircraft: Aircraft[];
  userLocation: { lat: number; lon: number } | null;
  radiusNm: number;
  selectedAircraftId: string | null;
  selectedTrack: AircraftTrackPoint[];
  onSelectAircraft: (aircraftId: string | null) => void;
}) {
  const center = useMemo(() => {
    if (userLocation) {
      return [userLocation.lat, userLocation.lon] as [number, number];
    }
    return DEFAULT_MAP_CENTER;
  }, [userLocation]);

  const trackSegments = useMemo(() => selectedTrack.slice(1).flatMap((point, pointIndex) => {
    const previous = selectedTrack[pointIndex];
    const startColor = getAltitudeColor(previous.altitude);
    const endColor = getAltitudeColor(point.altitude);

    return Array.from({ length: TRACK_GRADIENT_STEPS }, (_, stepIndex) => {
      const startAmount = stepIndex / TRACK_GRADIENT_STEPS;
      const endAmount = (stepIndex + 1) / TRACK_GRADIENT_STEPS;
      const interpolate = (start: number, end: number, amount: number) => start + (end - start) * amount;

      return {
        key: `${pointIndex}-${stepIndex}`,
        color: mixColors(startColor, endColor, (startAmount + endAmount) / 2),
        positions: [
          [interpolate(previous.lat, point.lat, startAmount), interpolate(previous.lon, point.lon, startAmount)],
          [interpolate(previous.lat, point.lat, endAmount), interpolate(previous.lon, point.lon, endAmount)],
        ] as [[number, number], [number, number]],
      };
    });
  }), [selectedTrack]);

  return (
    <div style={{ height: '100%', minHeight: 0, width: '100%', background: '#020817', position: 'relative', zIndex: 0, overflow: 'hidden' }}>
      <MapContainer center={center} zoom={8} zoomControl={false} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <MapViewport center={center} radiusNm={radiusNm} />
        <MapSelection onClearSelection={() => onSelectAircraft(null)} />
        <MapControls center={center} radiusNm={radiusNm} />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_3o52_1_33333ae77fb1d0f08863d0d7"
        />

        {userLocation ? (
          <>
            <Circle center={[userLocation.lat, userLocation.lon]} radius={radiusNm * 1852} pathOptions={{ color: '#00d4d4', dashArray: '6 6', fill: false, opacity: 0.65 }} />
            <Marker position={[userLocation.lat, userLocation.lon]} icon={getHomeLocationIcon()} title="Home location" alt="Home location">
              <Popup className="adsb-popup">Home location</Popup>
            </Marker>
          </>
        ) : null}

        {trackSegments.map((segment) => (
          <Polyline
            key={segment.key}
            positions={segment.positions}
            pathOptions={{ color: segment.color, weight: 3, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            interactive={false}
          />
        ))}

        {aircraft.map((item) => {
          if (item.lat == null || item.lon == null) return null;
          const aircraftId = getAircraftId(item);
          const visualState = getAircraftVisualState(item, aircraftId === selectedAircraftId);
          const color = getAircraftStateColor(visualState);
          const label = item.flight?.trim() || item.r || 'Unknown aircraft';

          return (
            <Marker
              key={aircraftId}
              position={[item.lat, item.lon]}
              icon={getMarkerIcon(color, item.track ?? 0, visualState)}
              title={`${label}${visualState === 'stale' ? ', stale telemetry' : ''}`}
              alt={`${label}${visualState === 'stale' ? ', stale telemetry' : ''}`}
              eventHandlers={{
                click: (event) => {
                  L.DomEvent.stopPropagation(event.originalEvent);
                  onSelectAircraft(aircraftId);
                },
                mouseover: (event) => event.target.openPopup(),
                mouseout: (event) => {
                  if (aircraftId !== selectedAircraftId) event.target.closePopup();
                },
                keydown: (event) => {
                  const key = (event.originalEvent as KeyboardEvent).key;
                  if (key === 'Enter' || key === ' ') onSelectAircraft(aircraftId);
                },
              }}
            >
              <Popup className="adsb-popup">
                <div>
                  <strong>{item.flight || 'Unknown'}</strong><br />
                  {visualState === 'stale' ? <><span style={{ color: '#ffb300' }}>STALE TELEMETRY</span><br /></> : null}
                  {item.r || 'Unknown reg'}<br />
                  Type: {item.t || '—'}<br />
                  Alt: {item.alt_baro ?? item.alt_geom ?? '—'} ft<br />
                  Speed: {item.gs ?? '—'} kts<br />
                  Heading: {item.track ?? '—'}°<br />
                  Distance: {item.dst ?? '—'} NM<br />
                  Squawk: {item.squawk || '—'}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      <div
        role="note"
        aria-label="Aircraft altitude color key"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 700,
          padding: '8px 10px',
          border: '1px solid #333333',
          background: 'rgba(5, 8, 22, 0.92)',
          color: '#e0e0e0',
          fontFamily: 'var(--font-b612-mono), monospace',
          fontSize: 11,
          lineHeight: 1.4,
          pointerEvents: 'none',
        }}
      >
        <div style={{ marginBottom: 5, color: '#00d4d4', fontWeight: 700, letterSpacing: 1 }}>ALTITUDE</div>
        {ALTITUDE_LEGEND.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
            <span
              aria-hidden="true"
              style={{
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderBottom: `10px solid ${getAircraftStateColor(item.state)}`,
                flexShrink: 0,
              }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
