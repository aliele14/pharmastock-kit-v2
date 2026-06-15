import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/app-shell';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://pharmastock-kit-v2.vercel.app'),
  title: {
    template: '%s — PharmaStock',
    default: 'PharmaStock — Supply Chain Analytics',
  },
  description:
    'Pharmaceutical inventory tracker with batch/lot tracking, FEFO expiry risk, reorder intelligence, and demand anomaly detection. Deterministic, rules-based analytics — zero AI at runtime.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: 'PharmaStock — Supply Chain Analytics',
    description:
      'Pharma inventory tracker with FEFO expiry risk, reorder intelligence, and a deterministic rules-based supply briefing. Built as a portfolio demo with zero AI at runtime.',
    type: 'website',
    siteName: 'PharmaStock',
  },
};

// Set the theme class before first paint to avoid a flash of the wrong theme.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (stored === null && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0f766e" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
