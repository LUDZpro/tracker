import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import SwRegistrar from '@/components/pwa/SwRegistrar';
import '@/styles/tokens.css';
import '@/styles/global.css';

// Nonce-based CSP requires per-request rendering.
export const dynamic = 'force-dynamic';

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex',
});

export const metadata: Metadata = {
  title: 'Floor Logger',
  description: 'One-tap personal event logging',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Floor Logger',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0E1116',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plex.variable}>
      <body>
        {children}
        <SwRegistrar />
      </body>
    </html>
  );
}
