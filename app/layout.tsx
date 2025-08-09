import type { Metadata } from "next";
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
  themeColor: "#000000",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${gilroy.variable} ${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen`}>
        <PageBackground>
          <Navigation />
          <main className="pt-14">
            {children}
          </main>
        </PageBackground>
      </body>
    </html>
  );
}
