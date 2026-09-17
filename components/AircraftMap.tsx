'use client';

import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import { getAircraftId, getAircraftStateColor, getAircraftVisualState } from '@/lib/aircraftDisplay';
import type { Aircraft } from '@/types/aircraft';

const DEFAULT_MAP_CENTER: [number, number] = [39.7588, -104.919];

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

function MapSelection({ onClearSelection }: { onClearSelection: () => void }) {
  useMapEvents({ click: onClearSelection });
  return null;
}

function MapViewport({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
    const invalidateSize = () => map.invalidateSize({ pan: false });
    const frame = requestAnimationFrame(invalidateSize);
    const resizeObserver = new ResizeObserver(invalidateSize);
    resizeObserver.observe(map.getContainer());

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [center, zoom, map]);

  return null;
}

export function AircraftMap({
  aircraft,
  userLocation,
  radiusNm,
  selectedAircraftId,
  onSelectAircraft,
}: {
  aircraft: Aircraft[];
  userLocation: { lat: number; lon: number } | null;
  radiusNm: number;
  selectedAircraftId: string | null;
  onSelectAircraft: (aircraftId: string | null) => void;
}) {
  const center = useMemo(() => {
    if (userLocation) {
      return [userLocation.lat, userLocation.lon] as [number, number];
    }
    return DEFAULT_MAP_CENTER;
  }, [userLocation]);

  const mapHeight = 520;

  return (
    <div style={{ height: mapHeight, width: '100%', background: '#020817', position: 'relative', zIndex: 0, overflow: 'hidden' }}>
      <MapContainer center={center} zoom={8} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <MapViewport center={center} zoom={8} />
        <MapSelection onClearSelection={() => onSelectAircraft(null)} />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_3o52_1_33333ae77fb1d0f08863d0d7"
        />

        {userLocation ? (
          <>
            <Circle center={[userLocation.lat, userLocation.lon]} radius={radiusNm * 1852} pathOptions={{ color: '#00d4d4', dashArray: '6 6', fill: false, opacity: 0.65 }} />
            <Marker position={[userLocation.lat, userLocation.lon]} icon={getMarkerIcon('#00d4d4', 0, 'selected')} title="Home location" alt="Home location">
              <Popup className="adsb-popup">Home location</Popup>
            </Marker>
          </>
        ) : null}

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
    </div>
  );
}
