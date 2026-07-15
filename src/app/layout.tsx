import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Mitra PLKK — BPJS Ketenagakerjaan",
  description: "Platform terpadu pengelolaan kerjasama BPJS Ketenagakerjaan dengan Faskes Pusat Layanan Kecelakaan Kerja (PLKK)",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
        <Toaster />
        <SonnerToaster position="top-right" richColors />
      </body>
    </html>
  );
}
