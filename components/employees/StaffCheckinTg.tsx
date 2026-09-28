"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/shared/Language";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useTelegramWebApp } from "./useTelegramWebApp";

// XODIMLAR BOTI — «📷 Ishga keldim» / «🏁 Ishdan ketdim» Mini App'i
// (28.09.2026). Ochilishi bilan Telegram'ning o'z QR skanerini ochadi,
// skanerlangan matnni /api/xodim/davomat ga yuboradi va natijani ko'rsatadi.
//
// Xodim kimligi — `initData` dan, filial — QR tokenidan (server tekshiradi).
// `kind` faqat qaysi tugma bosilganini aytadi: boshqa turdagi kod
// skanerlansa server rad etadi (ekranda ikkala kod yonma-yon turadi).

interface CheckinResult {
  kind: "in" | "out";
  fresh: boolean;
  branchName: string;
  enterTime: string | null;
  exitTime: string | null;
  lateMinutes: number;
  expected: string | null;
  expectedWhy: string | null;
}

export default function StaffCheckinTg({ kind }: { kind: "in" | "out" }) {
  const { t } = useT();
  const { app, initData, error: sdkError } = useTelegramWebApp();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const autoOpened = useRef(false);

  const submit = useCallback(
    async (code: string) => {
      setBusy(true);
      setError("");
      setResult(null);
      try {
        const r = await fetch("/api/xodim/davomat", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-telegram-init-data": initData ?? "" },
          body: JSON.stringify({ code, kind }),
        });
        const d = await r.json();
        if (d?.ok) {
          setResult(d as CheckinResult);
          app?.HapticFeedback?.notificationOccurred?.(d.lateMinutes > 0 ? "warning" : "success");
        } else {
          setError(t(d?.error || "Belgilanmadi — qayta urinib ko'ring"));
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

  const scan = useCallback(() => {
    if (!app?.showScanQrPopup) {
      setError(t("QR skaner telefondagi Telegram ilovasida ishlaydi"));
      return;
    }
    try {
      app.showScanQrPopup(
        { text: kind === "out" ? t("«Ishdan ketdim» QR kodini skanerlang") : t("Filial ekranidagi QR kodni skanerlang") },
        (text) => {
          void submit(text);
          return true; // skaner yopilsin
        },
      );
    } catch {
      setError(t("QR skaner telefondagi Telegram ilovasida ishlaydi"));
    }
  }, [app, kind, submit, t]);

  // Ochilishi bilan skaner — bitta bosish kamroq. Bayroq taymer ICHIDA
  // qo'yiladi: dev'dagi StrictMode effektni ikki marta yurgizadi va birinchi
  // taymer tozalanadi.
  useEffect(() => {
    if (!initData || autoOpened.current) return;
    const id = window.setTimeout(() => {
      autoOpened.current = true;
      scan();
    }, 300);
    return () => window.clearTimeout(id);
  }, [initData, scan]);

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
  const tone = error
    ? "border-rose-500/30 bg-rose-500/10"
    : !result
      ? "border-border bg-card"
      : late
        ? "border-amber-500/30 bg-amber-500/10"
        : result.fresh
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-sky-500/30 bg-sky-500/10";

  return (
    <div className="mx-auto max-w-md p-5 space-y-4">
      <h1 className="text-center text-[18px] font-bold">{kind === "out" ? "🏁" : "📷"} {title}</h1>

      <div className={`rounded-2xl border p-5 text-center ${tone}`}>
        {busy ? (
          <SpinnerBlock />
        ) : error ? (
          <p className="text-[15px] font-semibold text-rose-700 dark:text-rose-300">❌ {error}</p>
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
            {result.branchName && <p className="text-[13px] text-muted-foreground">{result.branchName}</p>}
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
          <p className="text-[14px] text-muted-foreground">{t("Filial ekranidagi QR kodni skanerlang")}</p>
        )}
      </div>

      <button
        type="button"
        onClick={scan}
        disabled={busy}
        className="h-12 w-full rounded-xl bg-primary text-white text-[15px] font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {result || error ? t("📷 Qayta skanerlash") : t("📷 QR kodni skanerlash")}
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
