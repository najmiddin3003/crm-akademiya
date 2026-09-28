"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/shared/Language";

// Xodimlar botining Mini App'lari («👤 Profilim», «📷 Ishga keldim») uchun
// umumiy qobiq: Telegram SDK'ni yuklaydi, `initData` ni oladi va Telegram
// mavzusiga (tungi/kunduzgi) moslashadi. Telegram tashqarisida ochilsa —
// xato matni (sahifa ma'lumot so'ramaydi).

const TG_SDK = "https://telegram.org/js/telegram-web-app.js";

export interface TelegramWebApp {
  initData: string;
  colorScheme?: string;
  /** "android" | "ios" | "tdesktop" | "weba" | "macos" … */
  platform?: string;
  ready: () => void;
  expand: () => void;
  close?: () => void;
  /** Bot API 6.4+: Telegram'ning o'z QR skaneri (telefonda). */
  showScanQrPopup?: (params: { text?: string }, callback?: (text: string) => boolean | void) => void;
  closeScanQrPopup?: () => void;
  HapticFeedback?: { notificationOccurred?: (type: "success" | "error" | "warning") => void };
}

function tgApp(): TelegramWebApp | null {
  const w = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
  return w.Telegram?.WebApp ?? null;
}

export function useTelegramWebApp(): { app: TelegramWebApp | null; initData: string | null; error: string } {
  const { t } = useT();
  const [app, setApp] = useState<TelegramWebApp | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const start = () => {
      const a = tgApp();
      if (!a || !a.initData) {
        setError(t("Bu sahifa Telegram boti orqali ochiladi"));
        return;
      }
      a.ready();
      a.expand();
      // Telegram mavzusiga moslashadi (o'quvchilar Mini App'idagi bilan bir xil).
      if (a.colorScheme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      setApp(a);
    };
    if (tgApp()) {
      const id = window.setTimeout(start, 0);
      return () => window.clearTimeout(id);
    }
    const s = document.createElement("script");
    s.src = TG_SDK;
    s.onload = start;
    s.onerror = () => setError(t("Telegram bilan aloqa o'rnatilmadi"));
    document.head.appendChild(s);
  }, [t]);

  return { app, initData: app?.initData ?? null, error };
}
