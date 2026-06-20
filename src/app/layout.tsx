import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { League_Spartan } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const leagueSpartan = League_Spartan({
  variable: "--font-league-spartan",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FGA Melbourne | HR Portal",
  description: "FGA Melbourne Staff HR Portal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FGA HR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow pinch-zoom for accessibility (WCAG 1.4.4). Do not disable user scaling.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${leagueSpartan.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
