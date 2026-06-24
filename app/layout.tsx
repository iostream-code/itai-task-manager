import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Task Manager - Tim IT",
  description: "Aplikasi manajemen task sederhana untuk tim IT internal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
