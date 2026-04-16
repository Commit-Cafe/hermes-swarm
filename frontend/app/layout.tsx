import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SSEProvider } from "@/lib/hooks";
import { LayoutInner } from "@/components/layout-inner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hermes Swarm",
  description: "Multi-Hermes-Agent orchestration dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning translate="no">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <SSEProvider>
            <LayoutInner>{children}</LayoutInner>
          </SSEProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
