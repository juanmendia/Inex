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
      <body className="min-h-full flex flex-col">
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
