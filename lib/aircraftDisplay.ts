import type { Aircraft } from '@/types/aircraft';

export const AIRCRAFT_STALE_THRESHOLD_SEC = 30;

export type AltitudeVisualState = 'ground' | 'altitude-0' | 'altitude-5' | 'altitude-10' | 'altitude-15' | 'altitude-20' | 'altitude-25' | 'altitude-30' | 'altitude-35' | 'altitude-40' | 'muted';
export type AircraftVisualState = 'stale' | 'selected' | AltitudeVisualState;

export function getAircraftId(aircraft: Aircraft) {
  return aircraft.hex ?? `${aircraft.flight ?? 'unknown'}-${aircraft.lat ?? 'x'}-${aircraft.lon ?? 'x'}`;
}

export function getAltitudeVisualState(altitude: Aircraft['alt_baro'] | null): AltitudeVisualState {
  if (altitude === 'ground') return 'ground';
  if (altitude == null) return 'muted';
  if (altitude < 5000) return 'altitude-0';
  if (altitude < 10000) return 'altitude-5';
  if (altitude < 15000) return 'altitude-10';
  if (altitude < 20000) return 'altitude-15';
  if (altitude < 25000) return 'altitude-20';
  if (altitude < 30000) return 'altitude-25';
  if (altitude < 35000) return 'altitude-30';
  if (altitude < 40000) return 'altitude-35';
  return 'altitude-40';
}

export function getAircraftVisualState(aircraft: Aircraft, selected: boolean): AircraftVisualState {
  if ((aircraft.seen ?? 0) > AIRCRAFT_STALE_THRESHOLD_SEC) return 'stale';
  if (selected) return 'selected';

  const altitude = aircraft.alt_baro ?? aircraft.alt_geom;
  return getAltitudeVisualState(altitude);
}

export function getAircraftStateColor(state: AircraftVisualState) {
  switch (state) {
    case 'stale':
      return '#ffb300';
    case 'selected':
      return '#ff00ff';
    case 'ground':
    case 'muted':
      return '#777777';
    case 'altitude-0':
      return '#ffb300';
    case 'altitude-5':
      return '#ffe600';
    case 'altitude-10':
      return '#a3ff12';
    case 'altitude-15':
      return '#39ff14';
    case 'altitude-20':
      return '#00e5a8';
    case 'altitude-25':
      return '#00ffff';
    case 'altitude-30':
      return '#00a6ff';
    case 'altitude-35':
      return '#6366f1';
    case 'altitude-40':
      return '#8b5cf6';
  }
}

export function getAltitudeColor(altitude: Aircraft['alt_baro'] | null) {
  return getAircraftStateColor(getAltitudeVisualState(altitude));
}