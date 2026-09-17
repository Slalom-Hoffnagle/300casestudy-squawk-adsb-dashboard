import type { Aircraft } from '@/types/aircraft';

export const AIRCRAFT_STALE_THRESHOLD_SEC = 30;

export type AircraftVisualState = 'stale' | 'selected' | 'ground' | 'low' | 'cruise' | 'high' | 'upper' | 'maximum' | 'muted';

export function getAircraftId(aircraft: Aircraft) {
  return aircraft.hex ?? `${aircraft.flight ?? 'unknown'}-${aircraft.lat ?? 'x'}-${aircraft.lon ?? 'x'}`;
}

export function getAircraftVisualState(aircraft: Aircraft, selected: boolean): AircraftVisualState {
  if ((aircraft.seen ?? 0) > AIRCRAFT_STALE_THRESHOLD_SEC) return 'stale';
  if (selected) return 'selected';

  if (aircraft.alt_baro === 'ground') return 'ground';

  const altitude = aircraft.alt_baro ?? aircraft.alt_geom;
  if (altitude == null) return 'muted';
  if (altitude < 1000) return 'ground';
  if (altitude < 10000) return 'low';
  if (altitude < 25000) return 'cruise';
  if (altitude < 30000) return 'high';
  if (altitude < 35000) return 'upper';
  return 'maximum';
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
    case 'low':
      return '#ffb300';
    case 'cruise':
      return '#39ff14';
    case 'high':
      return '#00ffff';
    case 'upper':
      return '#00a6ff';
    case 'maximum':
      return '#8b5cf6';
  }
}