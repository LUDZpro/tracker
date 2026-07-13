import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import SwRegistrar from '@/components/pwa/SwRegistrar';
import '@/styles/tokens.css';
import '@/styles/global.css';

// Nonce-based CSP requires per-request rendering.
export const dynamic = 'force-dynamic';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Tracker',
  description: 'One-tap personal event logging',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tracker',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d0e15',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <SwRegistrar />
      </body>
    </html>
  );
}
