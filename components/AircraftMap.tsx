'use client';

import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

import type { Aircraft } from '@/types/aircraft';

const DEFAULT_MAP_CENTER: [number, number] = [39.7588, -104.919];

function getAltitudeColor(aircraft: Aircraft) {
  const altitude = aircraft.alt_baro ?? aircraft.alt_geom ?? 0;

  if (altitude < 1000) return '#555555';
  if (altitude < 10000) return '#ffb300';
  if (altitude < 25000) return '#39ff14';
  return '#00ffff';
}

function getMarkerIcon(color: string, heading: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" style="transform: rotate(${heading}deg); transform-origin: center;">
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

function MapViewport({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
}

export function AircraftMap({
  aircraft,
  userLocation,
  radiusNm,
}: {
  aircraft: Aircraft[];
  userLocation: { lat: number; lon: number } | null;
  radiusNm: number;
}) {
  const center = useMemo(() => {
    if (userLocation) {
      return [userLocation.lat, userLocation.lon] as [number, number];
    }
    return DEFAULT_MAP_CENTER;
  }, [userLocation]);

  const mapHeight = 520;

  return (
    <div style={{ height: mapHeight, width: '100%', background: '#020817' }}>
      <MapContainer center={center} zoom={8} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <MapViewport center={center} zoom={8} />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_3o52_1_33333ae77fb1d0f08863d0d7"
        />

        {userLocation ? (
          <>
            <Circle center={[userLocation.lat, userLocation.lon]} radius={radiusNm * 1852} pathOptions={{ color: '#00d4d4', dashArray: '6 6', fill: false, opacity: 0.65 }} />
            <Marker position={[userLocation.lat, userLocation.lon]} icon={getMarkerIcon('#00d4d4', 0)}>
              <Popup>Home location</Popup>
            </Marker>
          </>
        ) : null}

        {aircraft.map((item) => {
          if (item.lat == null || item.lon == null) return null;
          const color = getAltitudeColor(item);

          return (
            <Marker
              key={item.hex ?? `${item.flight ?? 'unknown'}-${item.lat}-${item.lon}`}
              position={[item.lat, item.lon]}
              icon={getMarkerIcon(color, item.track ?? 0)}
            >
              <Popup>
                <div style={{ color: '#020817', fontFamily: 'sans-serif' }}>
                  <strong>{item.flight || 'Unknown'}</strong><br />
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
