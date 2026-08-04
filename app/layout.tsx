import type { Metadata } from "next";
import "./globals.css";
import NavigationHistoryProvider from "@/components/shared/NavigationHistory";
import { ToastProvider } from "@/components/ui/Toast";

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
        <ToastProvider>
          <NavigationHistoryProvider>{children}</NavigationHistoryProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
