"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/shared/Language";

// Xodimlar botining Mini App'lari («👤 Profilim», «📷 Ishga keldim») uchun
// umumiy qobiq: Telegram SDK'ni yuklaydi, `initData` ni oladi va Telegram
// mavzusiga (tungi/kunduzgi) moslashadi. Telegram tashqarisida ochilsa —
// xato matni (sahifa ma'lumot so'ramaydi).

const TG_SDK = "https://telegram.org/js/telegram-web-app.js";

/** Bot API 8.0+ — qurilma joylashuvi (Telegram o'zi ruxsat so'raydi). */
interface TelegramLocationData {
  latitude: number;
  longitude: number;
  horizontal_accuracy?: number | null;
}

interface TelegramLocationManager {
  isInited?: boolean;
  isLocationAvailable?: boolean;
  isAccessGranted?: boolean;
  init: (callback?: () => void) => void;
  getLocation: (callback: (data: TelegramLocationData | null) => void) => void;
  /** Bot uchun joylashuv ruxsati sozlamasi — faqat tugma bosilganda chaqiriladi. */
  openSettings?: () => void;
}

export interface TelegramWebApp {
  initData: string;
  colorScheme?: string;
  /** "android" | "ios" | "tdesktop" | "weba" | "macos" … */
  platform?: string;
  ready: () => void;
  expand: () => void;
  close?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  /** Bot API 6.4+: Telegram'ning o'z QR skaneri (telefonda). */
  showScanQrPopup?: (params: { text?: string }, callback?: (text: string) => boolean | void) => void;
  closeScanQrPopup?: () => void;
  LocationManager?: TelegramLocationManager;
  HapticFeedback?: { notificationOccurred?: (type: "success" | "error" | "warning") => void };
}

export type LocationResult =
  | { ok: true; lat: number; lng: number; acc: number | null; at: number }
  | { ok: false; reason: "denied" | "unavailable" | "timeout" };

const LOCATION_TIMEOUT_MS = 20_000;

function browserLocation(): Promise<LocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve({ ok: false, reason: "unavailable" });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ok: true, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy ?? null, at: Date.now() }),
      (e) => resolve({ ok: false, reason: e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}

/**
 * Qurilma joylashuvi. Avval Telegram'ning LocationManager'i (Bot API 8.0+ —
 * GPS, ruxsatni Telegram o'zi so'raydi), bo'lmasa brauzer geolokatsiyasi.
 * Hech qachon otilmaydi; javob kelmasa 20 soniyada `timeout`.
 */
export function readLocation(app: TelegramWebApp | null): Promise<LocationResult> {
  const lm = app?.LocationManager;
  const viaTelegram = new Promise<LocationResult>((resolve) => {
    if (!lm || app?.isVersionAtLeast?.("8.0") === false) {
      void browserLocation().then(resolve);
      return;
    }
    const ask = () => {
      if (lm.isLocationAvailable === false) {
        void browserLocation().then(resolve);
        return;
      }
      lm.getLocation((d) =>
        resolve(
          d && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
            ? { ok: true, lat: d.latitude, lng: d.longitude, acc: d.horizontal_accuracy ?? null, at: Date.now() }
            : { ok: false, reason: "denied" },
        ),
      );
    };
    if (lm.isInited) ask();
    else lm.init(ask);
  });
  const timeout = new Promise<LocationResult>((resolve) =>
    window.setTimeout(() => resolve({ ok: false, reason: "timeout" }), LOCATION_TIMEOUT_MS),
  );
  return Promise.race([viaTelegram, timeout]);
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
