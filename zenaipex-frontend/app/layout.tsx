import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZeniaOne - Enterprise AI Voice & Chat Agents",
  description: "Deploy intelligent, zero-latency conversational AI voice and chat agents powered by your company knowledge base.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body suppressHydrationWarning className={cn(plusJakartaSans.className, "min-h-screen bg-[#FAF8F5] text-[#191614] antialiased")}>
        {children}
      </body>
    </html>
  );
}
