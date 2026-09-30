import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { Nav } from "@/components/Nav";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "جيران المحبة | إدارة خدمات البناية",
  description: "نظام إدارة اشتراكات ومصاريف خدمات البناية",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let buildingName = "جيران المحبة";
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "buildingName" },
    });
    if (setting?.value) buildingName = setting.value;
  } catch {
    // DB not ready yet
  }

  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <Nav buildingName={buildingName} />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
