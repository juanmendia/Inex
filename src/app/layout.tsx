import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConfirmProvider } from "@/components/confirm-dialog";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inex",
  description: "Plataforma de Recursos Humanos",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Inex" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" type="image/png" href="/favicon.png?v=4" sizes="32x32" />
        <link rel="icon" type="image/png" href="/icon.png?v=4" sizes="512x512" />
        <link rel="shortcut icon" href="/favicon.ico?v=4" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=4" />
      </head>
      <body className="min-h-full flex flex-col">
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
