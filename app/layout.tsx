import type { Metadata } from "next";
import "./globals.css";
import NavigationHistoryProvider from "@/components/shared/NavigationHistory";

export const metadata: Metadata = {
  title: "Tizimli",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz">
      <body>
        <NavigationHistoryProvider>{children}</NavigationHistoryProvider>
      </body>
    </html>
  );
}
