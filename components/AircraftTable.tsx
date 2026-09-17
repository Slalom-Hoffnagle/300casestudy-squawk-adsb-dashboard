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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Plane, Radar } from 'lucide-react';

import type { Aircraft } from '@/types/aircraft';
import { getAircraftId, getAircraftVisualState } from '@/lib/aircraftDisplay';
import type { AircraftClass } from '@/lib/aircraftDisplay';

type SortDirection = 'asc' | 'desc';
type SortField = 'flight' | 'r' | 't' | 'altitude' | 'gs' | 'track' | 'dst' | 'dir' | 'baro_rate' | 'squawk';

type SortState = {
  key: SortField;
  direction: SortDirection;
};

type Props = {
  aircraft: Aircraft[];
  totalAircraftCount: number;
  radiusNm: number;
  loading: boolean;
  visibleClasses: AircraftClass[];
  onVisibleClassesChange: (classes: AircraftClass[]) => void;
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

export function AircraftTable({ aircraft, totalAircraftCount, radiusNm, loading, visibleClasses, onVisibleClassesChange, selectedAircraftId, onSelectAircraft }: Props) {
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, px: 2, py: 1.5, borderBottom: '1px solid #1f2937' }}>
        <ToggleButtonGroup
          value={visibleClasses}
          onChange={(_, nextClasses: AircraftClass[]) => onVisibleClassesChange(nextClasses)}
          aria-label="Aircraft class filters"
          size="small"
          fullWidth
          sx={{
            '& .MuiToggleButton-root': {
              minWidth: 0,
              borderColor: '#334155',
              color: '#94a3b8',
              fontFamily: 'var(--font-b612-mono), monospace',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.7,
              lineHeight: 1.2,
              px: 1,
              py: 0.75,
              whiteSpace: 'nowrap',
              '&:hover': { borderColor: '#00d4d4', color: '#f8fafc', background: 'rgba(0, 212, 212, 0.08)' },
              '&.Mui-selected': { borderColor: '#00d4d4', color: '#00ffff', background: 'rgba(0, 212, 212, 0.14)' },
              '&.Mui-selected:hover': { background: 'rgba(0, 212, 212, 0.2)' },
            },
          }}
        >
          <ToggleButton value="commercial">Commercial</ToggleButton>
          <ToggleButton value="general">General Aviation</ToggleButton>
          <ToggleButton value="military">Military</ToggleButton>
        </ToggleButtonGroup>
        <Box
          role="group"
          aria-label={`${sortedAircraft.length} of ${totalAircraftCount} aircraft within ${radiusNm} nautical miles`}
          sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', width: '100%', borderTop: '1px solid #1f2937', borderBottom: '1px solid #1f2937' }}
        >
          <Box sx={{ minWidth: 0, py: 1, pr: 2, borderRight: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box aria-hidden="true" sx={{ width: 28, height: 28, display: 'grid', placeItems: 'center', flexShrink: 0, color: '#00d4d4' }}>
              <Plane size={24} strokeWidth={1.75} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ display: 'block', color: '#94a3b8', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Aircraft
              </Typography>
              <Typography component="div" sx={{ color: '#00ffff', fontFamily: 'var(--font-b612-mono), monospace', fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>
                {sortedAircraft.length}
                {sortedAircraft.length !== totalAircraftCount ? (
                  <Box component="span" sx={{ ml: 0.75, color: '#94a3b8', fontSize: 12, fontWeight: 400 }}>
                    of {totalAircraftCount}
                  </Box>
                ) : null}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ minWidth: 0, py: 1, pl: 2, display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box aria-hidden="true" sx={{ width: 28, height: 28, display: 'grid', placeItems: 'center', flexShrink: 0, color: '#00d4d4' }}>
              <Radar size={24} strokeWidth={1.75} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ display: 'block', color: '#94a3b8', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Radius
              </Typography>
              <Typography component="div" sx={{ color: '#00ffff', fontFamily: 'var(--font-b612-mono), monospace', fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>
                {radiusNm}
                <Box component="span" sx={{ ml: 0.75, color: '#94a3b8', fontSize: 12, fontWeight: 400, textTransform: 'uppercase' }}>
                  NM
                </Box>
              </Typography>
            </Box>
          </Box>
        </Box>
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
                  {loading ? '↻ Acquiring aircraft data...' : totalAircraftCount ? 'No aircraft match the selected filters.' : 'No aircraft are currently in range.'}
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
