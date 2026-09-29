"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/shared/Language";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { readLocation, useTelegramWebApp, type LocationResult } from "./useTelegramWebApp";

// XODIMLAR BOTI — «📷 Ishga keldim» / «🏁 Ishdan ketdim» Mini App'i
// (28.09.2026). Avval qurilma JOYLASHUVINI oladi (29.09.2026 dan — filialdan
// uzoqda yoki ruxsatsiz skanerlash qabul qilinmaydi), keyin Telegram'ning
// o'z QR skanerini ochadi, kod va joylashuvni /api/xodim/davomat ga yuboradi.
//
// Xodim kimligi — `initData` dan, filial — QR tokenidan, masofa — serverda
// (lib/attendanceCheck.ts). `kind` faqat qaysi tugma bosilganini aytadi:
// boshqa turdagi kod skanerlansa server rad etadi.

interface CheckinResult {
  kind: "in" | "out";
  fresh: boolean;
  branchName: string;
  enterTime: string | null;
  exitTime: string | null;
  lateMinutes: number;
  expected: string | null;
  expectedWhy: string | null;
  locationText: string | null;
}

type LocationError = "location_required" | "location_inaccurate" | "too_far";

/** Joylashuv shuncha eskirsa skanerlashdan oldin qayta o'qiladi. */
const LOCATION_FRESH_MS = 60_000;

export default function StaffCheckinTg({ kind }: { kind: "in" | "out" }) {
  const { t } = useT();
  const { app, initData, error: sdkError } = useTelegramWebApp();
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<LocationError | null>(null);
  const autoStarted = useRef(false);

  const locate = useCallback(async (): Promise<LocationResult> => {
    setLocating(true);
    try {
      const loc = await readLocation(app);
      setLocation(loc);
      return loc;
    } finally {
      setLocating(false);
    }
  }, [app]);

  const submit = useCallback(
    async (code: string, loc: LocationResult) => {
      setBusy(true);
      setError("");
      setErrorCode(null);
      setResult(null);
      try {
        const r = await fetch("/api/xodim/davomat", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-telegram-init-data": initData ?? "" },
          body: JSON.stringify({ code, kind, loc: loc.ok ? { lat: loc.lat, lng: loc.lng, acc: loc.acc } : null }),
        });
        const d = await r.json();
        if (d?.ok) {
          setResult(d as CheckinResult);
          app?.HapticFeedback?.notificationOccurred?.(d.lateMinutes > 0 ? "warning" : "success");
        } else {
          setError(t(d?.error || "Belgilanmadi — qayta urinib ko'ring"));
          setErrorCode((d?.code as LocationError | null) ?? null);
          app?.HapticFeedback?.notificationOccurred?.("error");
        }
      } catch {
        setError(t("Tarmoq xatosi — qayta urinib ko'ring"));
      } finally {
        setBusy(false);
      }
    },
    [app, initData, kind, t],
  );

  const openScanner = useCallback(
    (loc: LocationResult) => {
      if (!app?.showScanQrPopup) {
        setError(t("QR skaner telefondagi Telegram ilovasida ishlaydi"));
        return;
      }
      try {
        app.showScanQrPopup(
          { text: kind === "out" ? t("«Ishdan ketdim» QR kodini skanerlang") : t("Filial ekranidagi QR kodni skanerlang") },
          (text) => {
            // Skaner uzoq ochiq turgan bo'lsa — joylashuv yangilanadi.
            const fresh = loc.ok && Date.now() - loc.at < LOCATION_FRESH_MS;
            void (fresh ? Promise.resolve(loc) : readLocation(app)).then((l) => submit(text, l));
            return true; // skaner yopilsin
          },
        );
      } catch {
        setError(t("QR skaner telefondagi Telegram ilovasida ishlaydi"));
      }
    },
    [app, kind, submit, t],
  );

  /** Joylashuv → skaner. Joylashuv olinmasa skaner ochilmaydi (qoida baribir rad etadi). */
  const start = useCallback(async () => {
    setError("");
    setErrorCode(null);
    setResult(null);
    const loc = await locate();
    if (!loc.ok) {
      setError(
        loc.reason === "denied"
          ? t("Joylashuvga ruxsat berilmagan")
          : t("Joylashuv aniqlanmadi — telefonda joylashuv (GPS) yoqilganini tekshiring"),
      );
      setErrorCode("location_required");
      return;
    }
    openScanner(loc);
  }, [locate, openScanner, t]);

  // Ochilishi bilan — bitta bosish kamroq. Bayroq taymer ICHIDA qo'yiladi:
  // dev'dagi StrictMode effektni ikki marta yurgizadi, birinchi taymer tozalanadi.
  useEffect(() => {
    if (!initData || autoStarted.current) return;
    const id = window.setTimeout(() => {
      autoStarted.current = true;
      void start();
    }, 300);
    return () => window.clearTimeout(id);
  }, [initData, start]);

  if (sdkError) {
    return (
      <div className="mx-auto max-w-md p-5">
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold">{sdkError}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{t("Botga qayting va «📷 Ishga keldim» tugmasini bosing.")}</p>
        </div>
      </div>
    );
  }
  if (!initData) return <SpinnerBlock />;

  const title = kind === "out" ? t("Ishdan ketdim") : t("Ishga keldim");
  const late = result && result.kind === "in" && result.lateMinutes > 0;
  const locationProblem = errorCode === "location_required";
  const tone = error
    ? locationProblem
      ? "border-amber-500/30 bg-amber-500/10"
      : "border-rose-500/30 bg-rose-500/10"
    : !result
      ? "border-border bg-card"
      : late
        ? "border-amber-500/30 bg-amber-500/10"
        : result.fresh
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-sky-500/30 bg-sky-500/10";
  const canOpenSettings = Boolean(app?.LocationManager?.openSettings);

  return (
    <div className="mx-auto max-w-md p-5 space-y-4">
      <h1 className="text-center text-[18px] font-bold">{kind === "out" ? "🏁" : "📷"} {title}</h1>

      <div className={`rounded-2xl border p-5 text-center ${tone}`}>
        {busy || locating ? (
          <div className="space-y-2">
            <SpinnerBlock />
            <p className="text-[13px] text-muted-foreground">{locating ? t("Joylashuv aniqlanmoqda…") : t("Tekshirilmoqda…")}</p>
          </div>
        ) : error ? (
          <div className="space-y-2">
            {locationProblem && <p className="text-[34px] leading-none">📍</p>}
            <p className={`text-[15px] font-semibold ${locationProblem ? "text-amber-800 dark:text-amber-200" : "text-rose-700 dark:text-rose-300"}`}>
              {locationProblem ? "" : "❌ "}{error}
            </p>
            {locationProblem && (
              <p className="text-[13px] text-muted-foreground">
                {t("Ishga kelganingizni tasdiqlash uchun Telegram'ga joylashuvingizni ko'rishga ruxsat bering — faqat skanerlash paytida olinadi.")}
              </p>
            )}
          </div>
        ) : result ? (
          <div className="space-y-1.5">
            <p className="text-[16px] font-bold">
              {result.kind === "out"
                ? t("Ishdan ketdingiz")
                : !result.fresh
                  ? t("Bugun allaqachon belgilangansiz")
                  : late
                    ? t("{n} daqiqa kechikdingiz", { n: result.lateMinutes })
                    : t("Ishga keldingiz")}
            </p>
            <p className="text-[28px] font-extrabold tabular-nums">
              {result.kind === "out" ? result.exitTime : result.enterTime}
            </p>
            {result.branchName && <p className="text-[13px] font-medium">{result.branchName}</p>}
            {result.locationText && (
              <p className="mx-auto max-w-[300px] text-[12px] text-muted-foreground">📍 {result.locationText}</p>
            )}
            {result.kind === "in" && result.expected && (
              <p className="text-[13px] text-muted-foreground">
                {t("Kerak edi: {time}", { time: result.expected })}
                {result.expectedWhy ? ` · ${t(result.expectedWhy)}` : ""}
              </p>
            )}
            {result.kind === "out" && result.enterTime && (
              <p className="text-[13px] text-muted-foreground">{t("Kelgan: {time}", { time: result.enterTime })}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[14px] text-muted-foreground">{t("Filial ekranidagi QR kodni skanerlang")}</p>
            {location?.ok && (
              <p className="text-[12px] text-emerald-700 dark:text-emerald-300">
                {t("📍 Joylashuv aniqlandi (±{m} m)", { m: Math.round(location.acc ?? 0) })}
              </p>
            )}
          </div>
        )}
      </div>

      {locationProblem && canOpenSettings && (
        <button
          type="button"
          onClick={() => app?.LocationManager?.openSettings?.()}
          className="h-12 w-full rounded-xl bg-amber-500 text-white text-[15px] font-semibold hover:opacity-90"
        >
          {t("⚙️ Joylashuvga ruxsat berish")}
        </button>
      )}
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy || locating}
        className="h-12 w-full rounded-xl bg-primary text-white text-[15px] font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {locationProblem ? t("🔄 Qayta urinish") : result || error ? t("📷 Qayta skanerlash") : t("📷 QR kodni skanerlash")}
      </button>
      {app?.close && (
        <button
          type="button"
          onClick={() => app.close?.()}
          className="h-11 w-full rounded-xl border border-border bg-card text-[14px] font-medium hover:bg-secondary"
        >
          {t("Yopish")}
        </button>
      )}
    </div>
  );
}
