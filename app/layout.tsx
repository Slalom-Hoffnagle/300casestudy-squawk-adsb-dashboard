import 'leaflet/dist/leaflet.css';
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ADSB Dashboard',
  description: 'Overhead aircraft dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
