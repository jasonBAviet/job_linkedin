import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "LinkedIn BA/DA Job Hunter | Senior HCM & Đồng Nai",
  description: "Hệ thống săn việc làm và chấm điểm độ khớp JD cho Senior Business Analyst và Data Analyst tại TP.HCM & Đồng Nai.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: extension đặt data-jh-extension lên <html> ở document_start
    <html lang="vi" className="dark" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-slate-950 text-slate-100 antialiased selection:bg-indigo-600 selection:text-white">
        <Navbar />
        <main className="flex-1 w-full">{children}</main>
      </body>
    </html>
  );
}
