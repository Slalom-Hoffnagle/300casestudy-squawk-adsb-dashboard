'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';

type Props = {
  open: boolean;
  onSubmit: (zipCode: string) => Promise<void> | void;
  onClose?: () => void;
};

export function ZipPrompt({ open, onSubmit, onClose }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    const normalized = value.trim();
    if (!/^\d{5}$/.test(normalized)) {
      setError('Enter a valid 5-digit U.S. ZIP code.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await onSubmit(normalized);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to resolve that ZIP code.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ background: '#020817', color: '#f8fafc', borderBottom: '1px solid #1f2937' }}>
        Enter your ZIP code
      </DialogTitle>
      <DialogContent sx={{ background: '#020817', pt: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
            Geolocation was unavailable or denied, so we need your ZIP code to estimate your location.
          </Typography>
          <TextField
            autoFocus
            label="ZIP code"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/\D/g, '').slice(0, 5))}
            inputProps={{ inputMode: 'numeric', maxLength: 5 }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#f8fafc',
                background: '#0b1322',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#334155',
              },
              '& .MuiInputLabel-root': {
                color: '#cbd5e1',
              },
            }}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ background: '#020817', borderTop: '1px solid #1f2937', px: 3, pb: 2 }}>
        {onClose ? (
          <Button onClick={onClose} sx={{ color: '#cbd5e1' }}>
            Cancel
          </Button>
        ) : null}
        <Button variant="contained" onClick={handleSubmit} disabled={busy} sx={{ background: '#00d4d4', color: '#020817', fontWeight: 700 }}>
          {busy ? 'Resolving...' : 'Use ZIP code'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
