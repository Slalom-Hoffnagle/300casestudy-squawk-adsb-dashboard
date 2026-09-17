import 'leaflet/dist/leaflet.css';
import './globals.css';
import type { Metadata } from 'next';
import { B612, B612_Mono } from 'next/font/google';

const b612 = B612({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-b612',
});

const b612Mono = B612_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-b612-mono',
});

export const metadata: Metadata = {
  title: 'ADSB Dashboard',
  description: 'Overhead aircraft dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${b612.variable} ${b612Mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
