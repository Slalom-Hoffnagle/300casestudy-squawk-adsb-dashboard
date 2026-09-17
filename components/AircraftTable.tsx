'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';

import type { Aircraft } from '@/types/aircraft';
import { getAircraftId, getAircraftVisualState } from '@/lib/aircraftDisplay';

type SortDirection = 'asc' | 'desc';
type SortField = 'flight' | 'r' | 't' | 'altitude' | 'gs' | 'track' | 'dst' | 'dir' | 'baro_rate' | 'squawk';

type SortState = {
  key: SortField;
  direction: SortDirection;
};

type Props = {
  aircraft: Aircraft[];
  radiusNm: number;
  loading: boolean;
  selectedAircraftId: string | null;
  onSelectAircraft: (aircraftId: string | null) => void;
};

function getAltitudeValue(aircraft: Aircraft) {
  if (aircraft.alt_baro === 'ground') return 0;
  return aircraft.alt_baro ?? aircraft.alt_geom ?? 0;
}

function getComparableValue(aircraft: Aircraft, key: SortField) {
  switch (key) {
    case 'flight':
      return aircraft.flight ?? '';
    case 'r':
      return aircraft.r ?? '';
    case 't':
      return aircraft.t ?? '';
    case 'altitude':
      return getAltitudeValue(aircraft);
    case 'gs':
      return aircraft.gs ?? 0;
    case 'track':
      return aircraft.track ?? 0;
    case 'dst':
      return aircraft.dst ?? 0;
    case 'dir':
      return aircraft.dir ?? 0;
    case 'baro_rate':
      return aircraft.baro_rate ?? 0;
    case 'squawk':
      return aircraft.squawk ?? '';
    default:
      return 0;
  }
}

export function AircraftTable({ aircraft, radiusNm, loading, selectedAircraftId, onSelectAircraft }: Props) {
  const [sortState, setSortState] = useState<SortState>({ key: 'dst', direction: 'asc' });

  const sortedAircraft = useMemo(() => {
    const next = [...aircraft];
    next.sort((left, right) => {
      const leftValue = getComparableValue(left, sortState.key);
      const rightValue = getComparableValue(right, sortState.key);

      const compare =
        typeof leftValue === 'string' && typeof rightValue === 'string'
          ? leftValue.localeCompare(rightValue)
          : Number(leftValue) - Number(rightValue);

      return sortState.direction === 'asc' ? compare : -compare;
    });

    return next;
  }, [aircraft, sortState]);

  const handleSort = (key: SortField) => {
    setSortState((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid #1f2937' }}>
        <Typography variant="subtitle2" sx={{ color: '#e2e8f0', letterSpacing: 1.2, textTransform: 'uppercase' }}>
          Showing {aircraft.length} aircraft within {radiusNm} NM
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ flex: 1, minHeight: 0, background: '#020817', boxShadow: 'none', borderRadius: 0, overflow: 'auto' }}>
        <Table stickyHeader size="small" sx={{ minWidth: 900, borderCollapse: 'collapse' }}>
          <TableHead>
            <TableRow>
              {[
                { key: 'flight', label: 'Callsign' },
                { key: 't', label: 'Type' },
                { key: 'gs', label: 'Speed (kts)' },
                { key: 'altitude', label: 'Altitude (ft)' },
                { key: 'r', label: 'Registration' },
                { key: 'track', label: 'Heading (°)' },
                { key: 'dst', label: 'Distance (NM)' },
                { key: 'dir', label: 'Bearing (°)' },
                { key: 'baro_rate', label: 'Vertical Rate (fpm)' },
                { key: 'squawk', label: 'Squawk' },
              ].map((column) => (
                <TableCell
                  key={column.key}
                  sx={{
                    background: '#07111d',
                    color: '#e2e8f0',
                    borderColor: '#1f2937',
                    fontWeight: 700,
                    letterSpacing: 1.1,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <TableSortLabel
                    active={sortState.key === column.key}
                    direction={sortState.key === column.key ? sortState.direction : 'asc'}
                    onClick={() => handleSort(column.key as SortField)}
                    sx={{
                      color: '#e2e8f0',
                      '&:hover': { color: '#ffffff' },
                      '&.Mui-active': { color: '#00ffff' },
                      '&.Mui-active:hover': { color: '#00ffff' },
                      '& .MuiTableSortLabel-icon': { color: '#00d4d4 !important' },
                    }}
                  >
                    {column.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {sortedAircraft.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} sx={{ color: '#94a3b8', textAlign: 'center', py: 4, borderColor: '#1f2937' }}>
                  {loading ? '↻ Acquiring aircraft data...' : 'No aircraft are currently in range.'}
                </TableCell>
              </TableRow>
            ) : (
              sortedAircraft.map((aircraft) => {
                const aircraftId = getAircraftId(aircraft);
                const selected = aircraftId === selectedAircraftId;
                const visualState = getAircraftVisualState(aircraft, selected);

                return (
                <TableRow
                  key={aircraftId}
                  hover
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelectAircraft(selected ? null : aircraftId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectAircraft(selected ? null : aircraftId);
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: selected ? 'rgba(255, 0, 255, 0.1)' : 'transparent',
                    '&:hover': { backgroundColor: selected ? 'rgba(255, 0, 255, 0.16)' : '#0b1322' },
                    '&:focus-visible': { outline: '2px solid #00ffff', outlineOffset: '-2px' },
                  }}
                >
                  <TableCell sx={{ color: visualState === 'stale' ? '#ffb300' : '#f8fafc', borderColor: '#1f2937', borderLeft: visualState === 'selected' ? '3px solid #ff00ff' : visualState === 'stale' ? '3px dashed #ffb300' : '3px solid transparent' }}>
                    {visualState === 'stale' ? '⚠ ' : visualState === 'selected' ? '◆ ' : ''}{aircraft.flight || '—'}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc', borderColor: '#1f2937' }}>{aircraft.t || '—'}</TableCell>
                  <TableCell sx={{ color: '#f8fafc', borderColor: '#1f2937' }}>{aircraft.gs !== undefined ? aircraft.gs.toFixed(0) : '—'}</TableCell>
                  <TableCell sx={{ color: '#f8fafc', borderColor: '#1f2937' }}>{getAltitudeValue(aircraft) ? getAltitudeValue(aircraft).toLocaleString() : '—'}</TableCell>
                  <TableCell sx={{ color: '#f8fafc', borderColor: '#1f2937' }}>{aircraft.r || '—'}</TableCell>
                  <TableCell sx={{ color: '#f8fafc', borderColor: '#1f2937' }}>{aircraft.track !== undefined ? aircraft.track.toFixed(0) : '—'}</TableCell>
                  <TableCell sx={{ color: '#f8fafc', borderColor: '#1f2937' }}>{aircraft.dst !== undefined ? aircraft.dst.toFixed(1) : '—'}</TableCell>
                  <TableCell sx={{ color: '#f8fafc', borderColor: '#1f2937' }}>{aircraft.dir !== undefined ? aircraft.dir.toFixed(0) : '—'}</TableCell>
                  <TableCell sx={{ color: '#f8fafc', borderColor: '#1f2937' }}>{aircraft.baro_rate !== undefined ? aircraft.baro_rate.toLocaleString() : '—'}</TableCell>
                  <TableCell sx={{ color: '#f8fafc', borderColor: '#1f2937' }}>{aircraft.squawk || '—'}</TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
