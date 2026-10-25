import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import NavBar from "@/components/layout/navBar";
import { getCurrentUserId } from "@/utils/user_cookie";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Fluence",
  description: "A personal knowledge base for language study.",
  icons: { icon: "/fluence-mark.svg" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUserId = await getCurrentUserId();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased`}
      >
        <NavBar currentUserId={currentUserId} />
        {children}
      </body>
    </html>
  );
}
