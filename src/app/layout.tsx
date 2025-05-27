import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/themes/theme-provider";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { Provider as RollbarProvider } from '@rollbar/react';
import { clientConfig } from '@/rollbar';
import AuthHeader from '@/components/layout/AuthHeader'; // Import the new header
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zeitlist",
  description: "A simple Next.js Waitlist application with email validation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RollbarProvider config={clientConfig}>
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.className} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthHeader /> {/* Add the header here */}
            <main style={{ padding: '1rem' }}> {/* Add a main tag for content separation */}
              <Toaster position="bottom-center" />
              {children}
            </main>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
    </RollbarProvider>
  );
}
