import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import NavigationHistoryProvider from "@/components/shared/NavigationHistory";
import { ToastProvider } from "@/components/ui/Toast";

// Referens sayt (akademiya.edutizim.uz) Nunito ishlatadi. globals.css dagi
// `body { font-family: var(--font-nunito), ... }` shu o'zgaruvchini o'qiydi.
const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tizimli",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" className={nunito.variable}>
      <body>
        <ToastProvider>
          <NavigationHistoryProvider>{children}</NavigationHistoryProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
