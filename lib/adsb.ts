export type Aircraft = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number;
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  squawk?: string;
  category?: string;
  seen?: number;
  rssi?: number;
  dst?: number;
  dir?: number;
};

export type AircraftResponse = {
  timestamp: string;
  cache_age_sec: number | null;
  status: 'ok' | 'error';
  query?: {
    lat: number;
    lon: number;
    radius_nm: number;
  };
  aircraft_count?: number;
  aircraft?: Aircraft[];
  error?: string;
  retry_after_seconds?: number;
};

const DEFAULT_RADIUS_NM = 50;
const MAX_RADIUS_NM = 250;

export function normalizeCoordinates(lat: number | string, lon: number | string) {
  const latitude = Number(lat);
  const longitude = Number(lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Latitude and longitude must be valid numbers');
  }

  return {
    lat: Number(latitude.toFixed(2)),
    lon: Number(longitude.toFixed(2)),
  };
}

export function buildAdsbUrl(lat: number | string, lon: number | string, dist?: number | string) {
  const { lat: roundedLat, lon: roundedLon } = normalizeCoordinates(lat, lon);
  const radius = Math.min(Math.max(Number(dist ?? DEFAULT_RADIUS_NM), 1), MAX_RADIUS_NM);
  return `https://opendata.adsb.fi/api/v3/lat/${roundedLat}/lon/${roundedLon}/dist/${radius}`;
}
