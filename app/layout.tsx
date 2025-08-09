import type { Metadata, Viewport } from "next";
import { Suspense } from 'react';
import { Geist, Geist_Mono } from "next/font/google";
import localFont from 'next/font/local';
import Navigation from "./components/Navigation";
import PageBackground from "./components/PageBackground";
import "./globals.css";

const gilroy = localFont({
  src: [
    {
      path: '../public/fonts/Gilroy-ExtraBold.ttf',
      weight: '800',
      style: 'normal',
    },
  ],
  variable: '--font-gilroy',
  display: 'swap',
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Torrents",
  description: "Gestion et téléchargement de torrents",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Torrents",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${gilroy.variable} ${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen`}>
        <PageBackground>
          <Suspense fallback={null}>
            <Navigation />
          </Suspense>
          <main className="pt-14">
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </main>
        </PageBackground>
      </body>
    </html>
  );
}
