'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';

import { AircraftTable } from '@/components/AircraftTable';
import { StatusBar } from '@/components/StatusBar';
import { ZipPrompt } from '@/components/ZipPrompt';
import { getAircraftId } from '@/lib/aircraftDisplay';
import { geocodeZip } from '@/lib/geocode';
import type { Aircraft, AircraftTrackPoint, PollStatus } from '@/types/aircraft';

const AircraftMap = dynamic(() => import('@/components/AircraftMap').then((mod) => mod.AircraftMap), {
  ssr: false,
  loading: () => <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', background: '#020817' }}>Loading map…</Box>,
});

const DEFAULT_RADIUS_NM = Number(process.env.NEXT_PUBLIC_RADIUS_NM ?? 50);
const DEFAULT_POLL_INTERVAL_SEC = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_SEC ?? 10);
const MAX_TRACK_POINTS = Math.ceil(60 * 60 / DEFAULT_POLL_INTERVAL_SEC);

type Coordinates = {
  lat: number;
  lon: number;
};

export function LocationGate() {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [showZipPrompt, setShowZipPrompt] = useState(false);
  const [status, setStatus] = useState<PollStatus>('idle');
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [locationMessage, setLocationMessage] = useState('Resolving your location...');
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [trackHistory, setTrackHistory] = useState<Record<string, AircraftTrackPoint[]>>({});

  const fetchAircraft = useCallback(async (nextCoordinates: Coordinates) => {
    setStatus('loading');

    const url = `/api/aircraft?lat=${nextCoordinates.lat}&lon=${nextCoordinates.lon}&dist=${DEFAULT_RADIUS_NM}`;

    try {
      const response = await fetch(url, { cache: 'no-store' });
      const payload = (await response.json()) as {
        status?: 'ok' | 'error';
        aircraft?: Aircraft[];
        error?: string;
      };

      if (!response.ok || payload.status === 'error') {
        setStatus(payload.error === 'rate_limited' ? 'rate_limited' : 'error');
        setAircraft([]);
        setLocationMessage(payload.error === 'rate_limited' ? 'ADS-B rate limit reached. Retrying shortly.' : 'Unable to load aircraft data.');
        return;
      }

      const nextAircraft = Array.isArray(payload.aircraft) ? payload.aircraft : [];
      setAircraft(nextAircraft);
      setTrackHistory((currentHistory) => {
        const activeIds = new Set<string>();
        const nextHistory: Record<string, AircraftTrackPoint[]> = {};

        nextAircraft.forEach((item) => {
          if (item.lat == null || item.lon == null || (item.seen ?? 0) > 60) return;

          const aircraftId = getAircraftId(item);
          activeIds.add(aircraftId);
          const points = currentHistory[aircraftId] ?? [];
          const point: AircraftTrackPoint = {
            lat: item.lat,
            lon: item.lon,
            altitude: item.alt_baro ?? item.alt_geom ?? null,
          };
          const previous = points.at(-1);
          const unchanged = previous && previous.lat === point.lat && previous.lon === point.lon && previous.altitude === point.altitude;
          nextHistory[aircraftId] = unchanged ? points : [...points, point].slice(-MAX_TRACK_POINTS);
        });

        Object.keys(currentHistory).forEach((aircraftId) => {
          if (!activeIds.has(aircraftId)) delete nextHistory[aircraftId];
        });

        return nextHistory;
      });
      setStatus('ok');
    } catch (error) {
      setStatus('error');
      setAircraft([]);
      setLocationMessage('Unable to reach the aircraft feed.');
    }
  }, []);

  useEffect(() => {
    const startLocationLookup = () => {
      if (!('geolocation' in navigator)) {
        setShowZipPrompt(true);
        setLocationMessage('Browser geolocation is unavailable. Please enter your ZIP code.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextCoordinates = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          setCoordinates(nextCoordinates);
          setLocationMessage(`Using your detected position: ${nextCoordinates.lat.toFixed(3)}, ${nextCoordinates.lon.toFixed(3)}`);
        },
        () => {
          setShowZipPrompt(true);
          setLocationMessage('Geolocation permission was denied. Please enter your ZIP code.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    };

    startLocationLookup();
  }, []);

  useEffect(() => {
    if (!coordinates) {
      return;
    }

    void fetchAircraft(coordinates);
    const intervalId = window.setInterval(() => {
      void fetchAircraft(coordinates);
    }, DEFAULT_POLL_INTERVAL_SEC * 1000);

    return () => window.clearInterval(intervalId);
  }, [coordinates, fetchAircraft]);

  useEffect(() => {
    if (selectedAircraftId && !aircraft.some((item) => getAircraftId(item) === selectedAircraftId)) {
      setSelectedAircraftId(null);
    }
  }, [aircraft, selectedAircraftId]);

  const handleZipSubmit = async (zipCode: string) => {
    const matched = await geocodeZip(zipCode);
    setSelectedAircraftId(null);
    setTrackHistory({});
    setCoordinates({ lat: matched.lat, lon: matched.lon });
    setShowZipPrompt(false);
    setLocationMessage(`Using ZIP ${zipCode} as your location: ${matched.lat.toFixed(3)}, ${matched.lon.toFixed(3)}`);
  };

  if (!coordinates) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#020817', color: '#f8fafc', display: 'grid', placeItems: 'center', p: 3 }}>
        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ color: '#00d4d4' }} />
          <Typography variant="h6" sx={{ letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Location sync
          </Typography>
          <Typography color="text.secondary">{locationMessage}</Typography>
        </Stack>
        <ZipPrompt open={showZipPrompt} onSubmit={handleZipSubmit} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100dvh', overflow: 'hidden', background: '#020817', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: '1px solid #1f2937', px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography component="h1" variant="h6" sx={{ letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>
          OVERHEAD v1.00
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setShowZipPrompt(true)}
          sx={{ color: '#00d4d4', borderColor: '#00d4d4' }}
        >
          Update location
        </Button>
      </Box>

      <StatusBar status={status} />

      {status === 'error' || status === 'rate_limited' ? (
        <Alert severity={status === 'rate_limited' ? 'warning' : 'error'} sx={{ m: 2 }}>
          {status === 'rate_limited' ? 'The ADS-B feed is rate-limited. Retrying shortly.' : 'The ADS-B feed is currently unavailable.'}
        </Alert>
      ) : null}

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', borderTop: '1px solid #1f2937' }}>
        <Box sx={{ flex: 2, minWidth: 0, minHeight: 0, position: 'relative', zIndex: 0, borderRight: '1px solid #1f2937' }}>
          <AircraftMap
            aircraft={aircraft}
            userLocation={coordinates}
            radiusNm={DEFAULT_RADIUS_NM}
            selectedAircraftId={selectedAircraftId}
            selectedTrack={selectedAircraftId ? trackHistory[selectedAircraftId] ?? [] : []}
            onSelectAircraft={setSelectedAircraftId}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', zIndex: 1, background: '#020617' }}>
          <AircraftTable
            aircraft={aircraft}
            radiusNm={DEFAULT_RADIUS_NM}
            loading={status === 'loading'}
            selectedAircraftId={selectedAircraftId}
            onSelectAircraft={setSelectedAircraftId}
          />
        </Box>
      </Box>

      <ZipPrompt open={showZipPrompt} onSubmit={handleZipSubmit} />
    </Box>
  );
}
