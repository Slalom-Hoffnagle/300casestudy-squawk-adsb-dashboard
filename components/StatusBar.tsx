'use client';

import { Box, Link, Typography } from '@mui/material';

import type { PollStatus } from '@/types/aircraft';

type Props = {
  status: PollStatus;
  lastPoll: string | null;
  aircraftCount: number;
  cacheAgeSec: number | null;
};

const statusStyle: Record<PollStatus, { label: string; color: string; symbol: string }> = {
  idle: { label: 'WAITING', color: '#8b949e', symbol: 'Ⅱ' },
  loading: { label: 'REFRESHING', color: '#ffb300', symbol: '↻' },
  ok: { label: 'LIVE', color: '#39ff14', symbol: '✓' },
  error: { label: 'FEED OFFLINE', color: '#ff2200', symbol: '!' },
  rate_limited: { label: 'RATE LIMITED — RETRYING', color: '#ffb300', symbol: '↻' },
};

export function StatusBar({ status, lastPoll, aircraftCount, cacheAgeSec }: Props) {
  const visibleStatus = statusStyle[status];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        px: 2,
        py: 1.25,
        borderTop: '1px solid #1f2937',
        background: '#050816',
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Box
          className={status === 'loading' ? 'status-refreshing' : undefined}
          aria-hidden="true"
          sx={{
            width: 18,
            color: visibleStatus.color,
            fontFamily: 'var(--font-b612-mono), monospace',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {visibleStatus.symbol}
        </Box>
        <Typography variant="caption" sx={{ color: '#e2e8f0', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase' }}>
          {visibleStatus.label}
        </Typography>
      </Box>

      <Typography variant="caption" sx={{ color: '#cbd5e1', letterSpacing: 1.1, textTransform: 'uppercase' }}>
        {lastPoll ? `Last poll: ${new Date(lastPoll).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Last poll: waiting'}
      </Typography>

      <Typography variant="caption" sx={{ color: '#cbd5e1', letterSpacing: 1.1, textTransform: 'uppercase' }}>
        Aircraft: {aircraftCount}
      </Typography>

      {cacheAgeSec !== null && (
        <Typography variant="caption" sx={{ color: '#cbd5e1', letterSpacing: 1.1, textTransform: 'uppercase' }}>
          Cache age: {cacheAgeSec}s
        </Typography>
      )}

      <Typography variant="caption" sx={{ color: '#cbd5e1', letterSpacing: 0.6 }}>
        Data:{' '}
        <Link href="https://adsb.fi" target="_blank" rel="noreferrer" sx={{ color: '#00d4d4', textDecoration: 'none' }}>
          adsb.fi
        </Link>
      </Typography>
    </Box>
  );
}
