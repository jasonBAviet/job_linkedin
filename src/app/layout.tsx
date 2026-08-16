import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "LinkedIn BA/DA Job Hunter | Senior HCM & Đồng Nai",
  description: "Hệ thống săn việc làm và chấm điểm độ khớp JD cho Senior Business Analyst và Data Analyst tại TP.HCM & Đồng Nai.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="flex min-h-screen flex-col bg-slate-950 text-slate-100 antialiased selection:bg-indigo-600 selection:text-white">
        <Navbar />
        <main className="flex-1 w-full">{children}</main>
      </body>
    </html>
  );
}
