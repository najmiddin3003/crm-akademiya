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

/** O'qish qayerdan kelgani — urinishlar jurnaliga yoziladi (lib/attendanceAttempts.ts). */
export type LocationSource = "telegram" | "network" | "gps";

export type LocationFix = {
  ok: true;
  lat: number;
  lng: number;
  acc: number | null;
  at: number;
  source: LocationSource;
  /** Qurilma o'lchagandan beri o'tgan vaqt, ms; Telegram aytmaydi — null. */
  ageMs: number | null;
};
export type LocationFailure = { ok: false; reason: "denied" | "unavailable" | "timeout" };
export type LocationResult = LocationFix | LocationFailure;

/** Birinchi so'rovda Telegram ruxsat oynasini ochishi mumkin — shu bois uzunroq. */
const TELEGRAM_FIRST_MS = 20_000;
const TELEGRAM_AGAIN_MS = 8_000;
/** Tarmoq (Wi-Fi, minora) — tez, lekin ba'zan yetarlicha aniq emas. */
const NETWORK_FIX_MS = 7_000;
/** GPS — aniq, lekin bino ichida sekin yoki umuman chiqmaydi. */
const GPS_FIX_MS = 12_000;
/** Brauzer `timeout`i ruxsat oynasi vaqtini sanamaydi: oyna ochiq qolsa sahifa osilib qolmasin. */
const PROMPT_GRACE_MS = 30_000;
/** Birinchi o'qishdan keyin telefon joylashuvni yangilab ulgurishi uchun. */
const RETRY_GAP_MS = 2_000;

const timedOut = (ms: number) =>
  new Promise<LocationFailure>((resolve) => window.setTimeout(() => resolve({ ok: false, reason: "timeout" }), ms));

/** Brauzer geolokatsiyasi — KESHSIZ (`maximumAge: 0`). `high` — GPS, aks holda tarmoq. */
function browserLocation(high: boolean, timeoutMs: number): Promise<LocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve({ ok: false, reason: "unavailable" });
  const read = new Promise<LocationResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          ok: true,
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: p.coords.accuracy ?? null,
          at: Date.now(),
          source: high ? "gps" : "network",
          ageMs: Math.max(0, Date.now() - p.timestamp),
        }),
      (e) => resolve({ ok: false, reason: e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: high, timeout: timeoutMs, maximumAge: 0 },
    );
  });
  return Promise.race([read, timedOut(timeoutMs + PROMPT_GRACE_MS)]);
}

/** Telegram'ning LocationManager'i (Bot API 8.0+); ruxsatni Telegram o'zi so'raydi. */
function telegramLocation(app: TelegramWebApp | null, timeoutMs: number): Promise<LocationResult> {
  const lm = app?.LocationManager;
  if (!lm || app?.isVersionAtLeast?.("8.0") === false) return Promise.resolve({ ok: false, reason: "unavailable" });
  const read = new Promise<LocationResult>((resolve) => {
    const ask = () => {
      if (lm.isLocationAvailable === false) {
        resolve({ ok: false, reason: "unavailable" });
        return;
      }
      lm.getLocation((d) =>
        resolve(
          d && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
            ? { ok: true, lat: d.latitude, lng: d.longitude, acc: d.horizontal_accuracy ?? null, at: Date.now(), source: "telegram", ageMs: null }
            : { ok: false, reason: "denied" },
        ),
      );
    };
    if (lm.isInited) ask();
    else lm.init(ask);
  });
  return Promise.race([read, timedOut(timeoutMs)]);
}

/**
 * Belgilash uchun joylashuv O'QISHLARI, eng ishonchlisi birinchi. Chaqiruvchi
 * har birini serverga yuboradi va qabul qilingach to'xtaydi (StaffCheckinTg).
 *
 * NEGA BITTA O'QISH YETMAYDI (06.11.2026, «tizim bittada aniqlay olmayapti»):
 * Telegram ANDROID'da LocationManager GPS so'ramaydi — `getLastKnownLocation`
 * bilan telefon xotirasidagi oxirgi nuqtani, yoshini tekshirmay beradi (ochiq
 * kodi: ui/bots/BotLocation.java → requestObject). Yo'lda qolgan nuqta bilan
 * filial ichida «uzoqdasiz» chiqardi; teskarisi ham mumkin edi: kecha ishda
 * qolgan nuqta bilan uydan belgilanardi. Shuning uchun Android'da brauzer
 * geolokatsiyasi KESHSIZ: avval tarmoq (tez), rad etilsa GPS. Telegram buning
 * uchun har sahifada bir marta ruxsat so'raydi (BotWebViewContainer: retain =
 * false). Telegram keshiga faqat yangi o'qish umuman kelmasa qaytiladi — yangi
 * o'qish rad etilgan bo'lsa eski nuqta unga qarshi ishlatilmaydi.
 *
 * iPhone'da Telegram jonli oqimning birinchi qiymatini beradi: odatda yangi,
 * lekin oldingi nuqta bo'lishi ham mumkin. Rad etilsa biroz kutib yana so'raladi,
 * keyin brauzer GPS'i.
 *
 * Ruxsat rad etilsa (`denied`) davom etilmaydi: keshga qaytish «rad etish»
 * tugmasi bilan tekshiruvni chetlab o'tish yo'li bo'lardi.
 *
 * Kamera ruxsati bilan bir vaqtda SO'RALMAYDI: Telegram'da yangi ruxsat oynasi
 * ochiq turganini yopib yuboradi (onPermissionRequest), shu bois yuzdan keyin.
 */
export async function* locationReadings(app: TelegramWebApp | null): AsyncGenerator<LocationResult, void, void> {
  if (app?.platform === "android") {
    const net = await browserLocation(false, NETWORK_FIX_MS);
    yield net;
    if (!net.ok && net.reason === "denied") return;
    const gps = await browserLocation(true, GPS_FIX_MS);
    yield gps;
    if (!gps.ok && gps.reason === "denied") return;
    if (!net.ok && !gps.ok) yield await telegramLocation(app, TELEGRAM_AGAIN_MS);
    return;
  }
  const first = await telegramLocation(app, TELEGRAM_FIRST_MS);
  yield first;
  if (!first.ok && first.reason === "denied") return;
  if (first.ok) {
    await new Promise((resolve) => window.setTimeout(resolve, RETRY_GAP_MS));
    yield await telegramLocation(app, TELEGRAM_AGAIN_MS);
  }
  yield await browserLocation(true, GPS_FIX_MS);
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
