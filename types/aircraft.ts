export type Aircraft = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  squawk?: string;
  category?: string;
  dbFlags?: number;
  desc?: string;
  ownOp?: string;
  seen?: number;
  rssi?: number;
  dst?: number;
  dir?: number;
};

export type AircraftTrackPoint = {
  lat: number;
  lon: number;
  altitude: number | 'ground' | null;
};

export type PollStatus = 'idle' | 'loading' | 'ok' | 'error' | 'rate_limited';
