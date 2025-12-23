import './globals.css';

import type { Metadata } from 'next';

import { geistMono, geistSans } from '@/core/next/fonts';

import { Footer } from './ui/shell/Footer';
import { Header } from './ui/shell/Header';

export const metadata: Metadata = {
  title: 'Conflux Data Lab | Портфолио инструментов для обработки данных',
  description: 'Коллекция инструментов для конвертации, трансформации и обработки данных',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
