import {Analytics} from '@vercel/analytics/next';
import type {Metadata} from 'next';
import {Inter, Space_Grotesk} from 'next/font/google';

import AmbientBackground from '@/componentsV2/bits/AmbientBackground';

import '@/app/globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Rocket · Managed Backend Hosting',
  description:
    'Deploy and manage your backend APIs without the complexity of managing infrastructure. Focus on building your product while Rocket takes care of deployment and hosting.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} antialiased dark`}
    >
      <body className="min-h-screen flex flex-col bg-[#08080D] text-[#F7F7FA] relative overflow-x-hidden">
        <AmbientBackground />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
