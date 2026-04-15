import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TD Color Mixing — Flat-Top 3MF Generator",
  description:
    "Generate multi-material 3MF files using Transmission Distance color mixing with a flat top surface",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="border-b border-gray-200 bg-white">
          <nav className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              TD Color Mixing
            </Link>
            <div className="flex gap-4 text-sm">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Generator
              </Link>
              <Link
                href="/filaments"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Filament Library
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
