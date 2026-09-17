'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';

import { AircraftTable } from '@/components/AircraftTable';
import { StatusBar } from '@/components/StatusBar';
import { ZipPrompt } from '@/components/ZipPrompt';
import { getAircraftClass, getAircraftId } from '@/lib/aircraftDisplay';
import type { AircraftClass } from '@/lib/aircraftDisplay';
import { geocodeZip } from '@/lib/geocode';
import type { Aircraft, AircraftTrackPoint, PollStatus } from '@/types/aircraft';

const AircraftMap = dynamic(() => import('@/components/AircraftMap').then((mod) => mod.AircraftMap), {
  ssr: false,
  loading: () => <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', background: '#020817' }}>Loading map…</Box>,
});

const DEFAULT_RADIUS_NM = 50;
const RADIUS_OPTIONS_NM = [5, 10, 50, 100, 150, 250];
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
  const [radiusNm, setRadiusNm] = useState(() => {
    const configuredRadius = Number(process.env.NEXT_PUBLIC_RADIUS_NM ?? DEFAULT_RADIUS_NM);
    return RADIUS_OPTIONS_NM.includes(configuredRadius) ? configuredRadius : DEFAULT_RADIUS_NM;
  });
  const [locationMessage, setLocationMessage] = useState('Resolving your location...');
  const [visibleClasses, setVisibleClasses] = useState<AircraftClass[]>(['commercial', 'general', 'military']);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [trackHistory, setTrackHistory] = useState<Record<string, AircraftTrackPoint[]>>({});

  const visibleAircraft = useMemo(
    () => aircraft.filter((item) => visibleClasses.includes(getAircraftClass(item))),
    [aircraft, visibleClasses]
  );

  const fetchAircraft = useCallback(async (nextCoordinates: Coordinates) => {
    setStatus('loading');

    const url = `/api/aircraft?lat=${nextCoordinates.lat}&lon=${nextCoordinates.lon}&dist=${radiusNm}`;

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
  }, [radiusNm]);

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
    if (selectedAircraftId && !visibleAircraft.some((item) => getAircraftId(item) === selectedAircraftId)) {
      setSelectedAircraftId(null);
    }
  }, [selectedAircraftId, visibleAircraft]);

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
          Maximum Overhead v1.01
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
            aircraft={visibleAircraft}
            userLocation={coordinates}
            radiusNm={radiusNm}
            selectedAircraftId={selectedAircraftId}
            selectedTrack={selectedAircraftId ? trackHistory[selectedAircraftId] ?? [] : []}
            onSelectAircraft={setSelectedAircraftId}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', zIndex: 1, background: '#020617' }}>
          <AircraftTable
            aircraft={visibleAircraft}
            totalAircraftCount={aircraft.length}
            radiusNm={radiusNm}
            onRadiusChange={setRadiusNm}
            loading={status === 'loading'}
            visibleClasses={visibleClasses}
            onVisibleClassesChange={setVisibleClasses}
            selectedAircraftId={selectedAircraftId}
            onSelectAircraft={setSelectedAircraftId}
          />
        </Box>
      </Box>

      <ZipPrompt open={showZipPrompt} onSubmit={handleZipSubmit} />
    </Box>
  );
}
