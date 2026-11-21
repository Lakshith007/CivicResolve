import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CivicResolve — AI-Powered Civic Issue Reporting & Management',
  description:
    'Report local infrastructure issues, classify urgency with Google Gemini AI, route to municipal departments, and track transparent resolution.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
