"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/shared/Language";
import { SpinnerBlock } from "@/components/ui/Spinner";
import FaceCapture, { type FaceCaptureResult } from "./FaceCapture";
import { readLocation, useTelegramWebApp, type LocationResult } from "./useTelegramWebApp";

// XODIMLAR BOTI — «📷 Ishga keldim» / «🏁 Ishdan ketdim» Mini App'i
// (28.09.2026). Avval qurilma JOYLASHUVINI oladi (29.09.2026 dan — filialdan
// uzoqda yoki ruxsatsiz skanerlash qabul qilinmaydi), keyin Telegram'ning
// o'z QR skanerini ochadi, kod va joylashuvni /api/xodim/davomat ga yuboradi.
//
// FACE ID (30.10.2026, lib/staffFace.ts): admin yoqgan bo'lsa ENG AVVAL yuz —
// old kamerada tasdiqlanadi (FaceCapture), /api/xodim/yuz ruxsat (pass)
// beradi, u QR kod bilan birga yuboriladi. Birinchi marta yuz ro'yxatga
// olinadi (rozilik matni bilan). Tartib: yuz → joylashuv → QR.
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
/** Yuz ruxsati serverda 5 daqiqa amal qiladi — biroz oldinroq yangilanadi. */
const FACE_PASS_FRESH_MS = 4 * 60_000;

/** Yuz qadami holati. */
type FaceGate =
  | { s: "checking" }
  | { s: "off" }
  | { s: "intro" }
  | { s: "capture"; enroll: boolean; attempt: number }
  | { s: "sending"; enroll: boolean }
  | { s: "failed"; enroll: boolean; message: string; attempt: number }
  | { s: "passed"; enrolled: boolean }
  | { s: "error"; message: string };

export default function StaffCheckinTg({ kind }: { kind: "in" | "out" }) {
  const { t } = useT();
  const { app, initData, error: sdkError } = useTelegramWebApp();
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<LocationError | null>(null);
  const [gate, setGate] = useState<FaceGate>({ s: "checking" });
  const passRef = useRef<{ pass: string; at: number } | null>(null);
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

  /** Yuz kerakmi va xodim ro'yxatdan o'tganmi — ochilganda va ruxsat eskirganda. */
  const checkFace = useCallback(async () => {
    setGate({ s: "checking" });
    try {
      const r = await fetch("/api/xodim/yuz", { headers: { "x-telegram-init-data": initData ?? "" }, cache: "no-store" });
      const d = await r.json();
      if (!d?.ok) {
        setGate({ s: "error", message: t(d?.error || "Ma'lumot olinmadi — qayta urinib ko'ring") });
        return;
      }
      if (!d.required) {
        passRef.current = null;
        setGate({ s: "off" });
      } else if (d.enrolled) setGate({ s: "capture", enroll: false, attempt: 0 });
      else setGate({ s: "intro" });
    } catch {
      setGate({ s: "error", message: t("Tarmoq xatosi — qayta urinib ko'ring") });
    }
  }, [initData, t]);

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
          body: JSON.stringify({
            code,
            kind,
            loc: loc.ok ? { lat: loc.lat, lng: loc.lng, acc: loc.acc } : null,
            facePass: passRef.current?.pass ?? null,
          }),
        });
        const d = await r.json();
        if (d?.ok) {
          setResult(d as CheckinResult);
          app?.HapticFeedback?.notificationOccurred?.(d.lateMinutes > 0 ? "warning" : "success");
        } else if (d?.code === "face_required") {
          // Ruxsat eskirgan yoki admin hozirgina yoqqan — yuz qadamiga qaytiladi.
          passRef.current = null;
          app?.HapticFeedback?.notificationOccurred?.("error");
          void checkFace();
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
    [app, initData, kind, t, checkFace],
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

  /** Qayta skanerlash: yuz ruxsati eskirgan bo'lsa — avval yuz. */
  const restart = useCallback(() => {
    if (gate.s === "passed" && (!passRef.current || Date.now() - passRef.current.at > FACE_PASS_FRESH_MS)) {
      passRef.current = null;
      void checkFace();
      return;
    }
    void start();
  }, [gate.s, checkFace, start]);

  const sendFace = useCallback(
    async (r: FaceCaptureResult, enroll: boolean, attempt: number) => {
      setGate({ s: "sending", enroll });
      try {
        const res = await fetch("/api/xodim/yuz", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-telegram-init-data": initData ?? "" },
          body: JSON.stringify({ descriptors: r.descriptors, photo: r.photo }),
        });
        const d = await res.json();
        if (d?.ok && d.skipped) {
          passRef.current = null;
          setGate({ s: "off" });
          void start();
          return;
        }
        if (d?.ok && typeof d.pass === "string") {
          passRef.current = { pass: d.pass, at: Date.now() };
          setGate({ s: "passed", enrolled: d.enrolled === true });
          app?.HapticFeedback?.notificationOccurred?.("success");
          void start();
          return;
        }
        app?.HapticFeedback?.notificationOccurred?.("error");
        setGate({ s: "failed", enroll, attempt, message: t(d?.error || "Yuz tasdiqlanmadi — qayta urinib ko'ring") });
      } catch {
        setGate({ s: "failed", enroll, attempt, message: t("Tarmoq xatosi — qayta urinib ko'ring") });
      }
    },
    [app, initData, start, t],
  );

  // Ochilishi bilan — yuz kerakmi, so'raladi.
  useEffect(() => {
    if (!initData) return;
    const id = window.setTimeout(() => void checkFace(), 0);
    return () => window.clearTimeout(id);
  }, [initData, checkFace]);

  // Yuz kerak bo'lmasa — avvalgidek darhol joylashuv va skaner (bitta bosish kamroq).
  // Bayroq taymer ICHIDA qo'yiladi: dev'dagi StrictMode effektni ikki marta
  // yurgizadi, birinchi taymer tozalanadi.
  useEffect(() => {
    if (!initData || autoStarted.current || gate.s !== "off") return;
    const id = window.setTimeout(() => {
      autoStarted.current = true;
      void start();
    }, 300);
    return () => window.clearTimeout(id);
  }, [initData, gate.s, start]);

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
  const closeButton = app?.close && (
    <button
      type="button"
      onClick={() => app.close?.()}
      className="h-11 w-full rounded-xl border border-border bg-card text-[14px] font-medium hover:bg-secondary"
    >
      {t("Yopish")}
    </button>
  );
  const header = (
    <h1 className="text-center text-[18px] font-bold">
      {kind === "out" ? "🏁" : "📷"} {title}
    </h1>
  );

  // ── Yuz qadami ──
  if (gate.s === "checking" || gate.s === "sending") {
    return (
      <div className="mx-auto max-w-md p-5 space-y-4">
        {header}
        <div className="rounded-2xl border border-border bg-card p-5 text-center space-y-2">
          <SpinnerBlock />
          <p className="text-[13px] text-muted-foreground">{gate.s === "sending" ? t("Yuz tekshirilmoqda…") : t("Yuklanmoqda…")}</p>
        </div>
      </div>
    );
  }
  if (gate.s === "error") {
    return (
      <div className="mx-auto max-w-md p-5 space-y-4">
        {header}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-center">
          <p className="text-[15px] font-semibold text-rose-700 dark:text-rose-300">❌ {gate.message}</p>
        </div>
        <button
          type="button"
          onClick={() => void checkFace()}
          className="h-12 w-full rounded-xl bg-primary text-white text-[15px] font-semibold hover:opacity-90"
        >
          {t("🔄 Qayta urinish")}
        </button>
        {closeButton}
      </div>
    );
  }
  if (gate.s === "intro") {
    return (
      <div className="mx-auto max-w-md p-5 space-y-4">
        {header}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2 text-center">
          <p className="text-[34px] leading-none">🙂</p>
          <p className="text-[16px] font-bold">{t("Yuzingizni ro'yxatdan o'tkazing")}</p>
          <p className="text-[13px] text-muted-foreground">
            {t("Bu bir martalik: hozir yuzingiz saqlanadi, keyingi kunlari «Ishga keldim» da shu bilan tekshiriladi.")}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {t("Yuz rasmi va raqamli izi faqat ishga kelish-ketishni tasdiqlash uchun markaz serverida saqlanadi.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGate({ s: "capture", enroll: true, attempt: 0 })}
          className="h-12 w-full rounded-xl bg-primary text-white text-[15px] font-semibold hover:opacity-90"
        >
          {t("Roziman, boshlash")}
        </button>
        {closeButton}
      </div>
    );
  }
  if (gate.s === "capture" || gate.s === "failed") {
    const retry = () => setGate({ s: "capture", enroll: gate.enroll, attempt: gate.attempt + 1 });
    return (
      <div className="mx-auto max-w-md p-5 space-y-4">
        {header}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-center text-[15px] font-bold">
            {gate.enroll ? t("Yuzingizni ro'yxatdan o'tkazing") : t("Yuzingizni tasdiqlang")}
          </p>
          {gate.s === "capture" ? (
            <FaceCapture
              key={gate.attempt}
              purpose={gate.enroll ? "enroll" : "verify"}
              onCaptured={(r) => void sendFace(r, gate.enroll, gate.attempt)}
            />
          ) : (
            <p className="text-center text-[15px] font-semibold text-rose-700 dark:text-rose-300">❌ {gate.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={retry}
          className={
            gate.s === "failed"
              ? "h-12 w-full rounded-xl bg-primary text-white text-[15px] font-semibold hover:opacity-90"
              : "h-11 w-full rounded-xl border border-border bg-card text-[14px] font-medium hover:bg-secondary"
          }
        >
          {t("🔄 Qayta urinish")}
        </button>
        {closeButton}
      </div>
    );
  }

  // ── Joylashuv va QR (yuz o'tgan yoki kerak emas) ──
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
  const facePassed = gate.s === "passed";

  return (
    <div className="mx-auto max-w-md p-5 space-y-4">
      {header}

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
        {facePassed && !busy && !locating && (
          <p className="mt-2 text-[12px] text-emerald-700 dark:text-emerald-300">
            {gate.enrolled ? t("🙂 Yuzingiz ro'yxatga olindi") : t("🙂 Yuz tasdiqlandi")}
          </p>
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
        onClick={restart}
        disabled={busy || locating}
        className="h-12 w-full rounded-xl bg-primary text-white text-[15px] font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {locationProblem ? t("🔄 Qayta urinish") : result || error ? t("📷 Qayta skanerlash") : t("📷 QR kodni skanerlash")}
      </button>
      {closeButton}
    </div>
  );
}
