import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ChatVista - Enterprise Video Conferencing',
  description: 'AI-powered video conferencing with real-time transcription, automatic meeting minutes, and seamless collaboration.',
  keywords: ['video conferencing', 'meeting minutes', 'transcription', 'collaboration'],
  authors: [{ name: 'ChatVista' }],
  openGraph: {
    title: 'ChatVista - Enterprise Video Conferencing',
    description: 'AI-powered video conferencing with real-time transcription and automatic meeting minutes.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
