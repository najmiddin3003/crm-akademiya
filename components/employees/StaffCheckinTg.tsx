"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/shared/Language";
import { SpinnerBlock } from "@/components/ui/Spinner";
import FaceCapture, { type FaceCaptureResult } from "./FaceCapture";
import FaceGuide from "./FaceGuide";
import { faceVoiceNeedsTap, sayFaceCue, unlockFaceVoice } from "./faceVoice";
import { locationReadings, useTelegramWebApp, type LocationFailure, type LocationFix, type LocationResult } from "./useTelegramWebApp";

// XODIMLAR BOTI — «📷 Ishga keldim» / «🏁 Ishdan ketdim» Mini App'i
// (28.09.2026). 31.10.2026 dan QR YO'Q (foydalanuvchi: "yuz scaner qilinsa
// bo'ldi ... lokatsiya va face id bo'lsa bo'ldi"): ochilishi bilan qurilma
// JOYLASHUVINI oladi va darhol /api/xodim/davomat ga yuboradi — filial
// joylashuvdan aniqlanadi (lib/attendanceCheck.ts → locateBranch; koordinatasiz
// filialda — xodimning o'z filiali, joylashuv faqat yoziladi). Koordinatali
// filialdan uzoqda yoki joylashuvga ruxsatsiz — belgilanmaydi.
//
// FACE ID (30.10.2026, lib/staffFace.ts): admin yoqgan bo'lsa ENG AVVAL yuz —
// old kamerada tasdiqlanadi (FaceCapture), /api/xodim/yuz ruxsat (pass)
// beradi, u joylashuv bilan birga yuboriladi. Birinchi marta yuz ro'yxatga
// olinadi (rozilik matni bilan). Tartib: yuz → joylashuv → belgilash.
//
// BIR NECHA O'QISH (06.11.2026): joylashuv bitta o'qish bilan hal qilinmaydi —
// telefon eski nuqtani berishi mumkin (locationReadings izohi). Server rad etsa,
// xato ko'rsatilmay keyingi, aniqroq o'qish yuboriladi; xato faqat oxirida chiqadi.
//
// Xodim kimligi — `initData` dan, filial va masofa — serverda. `kind` —
// qaysi tugma bosilgani.

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

type LocationError = "location_required" | "location_inaccurate" | "too_far" | "no_branch_geo";

/** Yuborish natijasi: `rejected` — joylashuv rad etildi, boshqa o'qish yuborsa bo'ladi. */
type SendOutcome = { s: "done" } | { s: "rejected"; message: string; code: LocationError | null };

/** Keyingi o'qish yordam beradigan rad kodlari (filialda koordinata yo'qligiga yordam bermaydi). */
const RETRY_CODES: readonly (LocationError | null)[] = ["too_far", "location_inaccurate"];

/** Yuz ruxsati serverda 5 daqiqa amal qiladi — biroz oldinroq yangilanadi. */
const FACE_PASS_FRESH_MS = 4 * 60_000;

/** Yuz qadami holati. */
type FaceGate =
  | { s: "checking" }
  | { s: "off" }
  | { s: "intro" }
  /** Har kungi tekshiruv: telefon ovozni faqat bosish ichida ochadi (faceVoice). */
  | { s: "ready" }
  | { s: "capture"; enroll: boolean; attempt: number }
  | { s: "sending"; enroll: boolean }
  | { s: "failed"; enroll: boolean; message: string; attempt: number }
  | { s: "passed"; enrolled: boolean }
  | { s: "error"; message: string };

export default function StaffCheckinTg({ kind }: { kind: "in" | "out" }) {
  const { t, lang } = useT();
  const { app, initData, error: sdkError } = useTelegramWebApp();
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  /** Birinchi o'qish rad etildi — aniqroq joylashuv kutilmoqda. */
  const [refining, setRefining] = useState(false);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<LocationError | null>(null);
  const [gate, setGate] = useState<FaceGate>({ s: "checking" });
  const passRef = useRef<{ pass: string; at: number } | null>(null);
  const autoStarted = useRef(false);

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
      } else if (!d.enrolled) setGate({ s: "intro" });
      else if (faceVoiceNeedsTap(lang)) setGate({ s: "ready" });
      else setGate({ s: "capture", enroll: false, attempt: 0 });
    } catch {
      setGate({ s: "error", message: t("Tarmoq xatosi — qayta urinib ko'ring") });
    }
  }, [initData, lang, t]);

  /** Bitta o'qishni yuboradi. Rad etilsa xatoni ko'rsatmaydi — hal qilish `start` da. */
  const submit = useCallback(
    async (loc: LocationFix, tryNo: number): Promise<SendOutcome> => {
      setBusy(true);
      try {
        const r = await fetch("/api/xodim/davomat", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-telegram-init-data": initData ?? "" },
          body: JSON.stringify({
            kind,
            loc: { lat: loc.lat, lng: loc.lng, acc: loc.acc },
            facePass: passRef.current?.pass ?? null,
            source: loc.source,
            ageMs: loc.ageMs,
            tryNo,
            platform: app?.platform ?? null,
          }),
        });
        const d = await r.json();
        if (d?.ok) {
          setResult(d as CheckinResult);
          app?.HapticFeedback?.notificationOccurred?.(d.lateMinutes > 0 ? "warning" : "success");
          return { s: "done" };
        }
        if (d?.code === "face_required") {
          // Ruxsat eskirgan yoki admin hozirgina yoqqan — yuz qadamiga qaytiladi.
          passRef.current = null;
          app?.HapticFeedback?.notificationOccurred?.("error");
          void checkFace();
          return { s: "done" };
        }
        return { s: "rejected", message: t(d?.error || "Belgilanmadi — qayta urinib ko'ring"), code: (d?.code as LocationError | null) ?? null };
      } catch {
        return { s: "rejected", message: t("Tarmoq xatosi — qayta urinib ko'ring"), code: null };
      } finally {
        setBusy(false);
      }
    },
    [app, initData, kind, t, checkFace],
  );

  /** Telefonda joylashuv olinmadi: serverga hech narsa bormasdi — sababi jurnalga yoziladi. */
  const reportNoLocation = useCallback(
    (reason: LocationFailure["reason"]) => {
      void fetch("/api/xodim/davomat", {
        method: "POST",
        // Xodim oynani darhol yopsa ham yetib borsin.
        keepalive: true,
        headers: { "Content-Type": "application/json", "x-telegram-init-data": initData ?? "" },
        body: JSON.stringify({ kind, loc: null, facePass: passRef.current?.pass ?? null, locError: reason, platform: app?.platform ?? null }),
      }).catch(() => {});
    },
    [app, initData, kind],
  );

  /** Joylashuv → belgilash: o'qishlar navbat bilan, server qabul qilguncha. */
  const start = useCallback(async () => {
    setError("");
    setErrorCode(null);
    setResult(null);
    setLocating(true);
    let rejected: Extract<SendOutcome, { s: "rejected" }> | null = null;
    let failure: LocationFailure | null = null;
    let last: LocationFix | null = null;
    let tryNo = 0;
    try {
      for await (const loc of locationReadings(app)) {
        if (!loc.ok) {
          failure = loc;
          if (loc.reason === "denied") break;
          continue;
        }
        // Telefon o'sha nuqtani qaytargan — yuborishdan foyda yo'q.
        if (last && last.lat === loc.lat && last.lng === loc.lng && last.acc === loc.acc) continue;
        last = loc;
        setLocation(loc);
        tryNo += 1;
        const out = await submit(loc, tryNo);
        if (out.s === "done") return;
        rejected = out;
        if (!RETRY_CODES.includes(out.code)) break;
        setRefining(true);
      }
    } finally {
      setLocating(false);
      setRefining(false);
    }
    app?.HapticFeedback?.notificationOccurred?.("error");
    if (rejected) {
      setError(rejected.message);
      setErrorCode(rejected.code);
      return;
    }
    const reason = failure?.reason ?? "unavailable";
    reportNoLocation(reason);
    setError(
      reason === "denied"
        ? t("Joylashuvga ruxsat berilmagan")
        : t("Joylashuv aniqlanmadi — telefonda joylashuv (GPS) yoqilganini tekshiring"),
    );
    setErrorCode("location_required");
  }, [app, reportNoLocation, submit, t]);

  /** Qayta urinish: yuz ruxsati eskirgan bo'lsa — avval yuz. */
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
          body: JSON.stringify({ descriptors: r.descriptors, photo: r.photo, stats: r.stats }),
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
          sayFaceCue("done");
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
          onClick={() => {
            unlockFaceVoice(lang);
            setGate({ s: "capture", enroll: true, attempt: 0 });
          }}
          className="h-12 w-full rounded-xl bg-primary text-white text-[15px] font-semibold hover:opacity-90"
        >
          {t("Roziman, boshlash")}
        </button>
        {closeButton}
      </div>
    );
  }
  if (gate.s === "ready") {
    return (
      <div className="mx-auto max-w-md p-5 space-y-4">
        {header}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 text-center">
          <FaceGuide demo={null} className="relative mx-auto w-28" />
          <p className="text-[16px] font-bold">{t("Yuzingizni tasdiqlang")}</p>
          <p className="text-[13px] text-muted-foreground">{t("Ovozni tinglang, rasmga qarab takrorlang.")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            unlockFaceVoice(lang);
            setGate({ s: "capture", enroll: false, attempt: 0 });
          }}
          className="h-12 w-full rounded-xl bg-primary text-white text-[15px] font-semibold hover:opacity-90"
        >
          {t("Boshlash")}
        </button>
        {closeButton}
      </div>
    );
  }
  if (gate.s === "capture" || gate.s === "failed") {
    const retry = () => {
      unlockFaceVoice(lang);
      setGate({ s: "capture", enroll: gate.enroll, attempt: gate.attempt + 1 });
    };
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

  // ── Joylashuv va belgilash (yuz o'tgan yoki kerak emas) ──
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
            <p className="text-[13px] text-muted-foreground">
              {refining ? t("Joylashuv aniqlashtirilmoqda — bir necha soniya kuting") : locating ? t("Joylashuv aniqlanmoqda…") : t("Tekshirilmoqda…")}
            </p>
          </div>
        ) : error ? (
          <div className="space-y-2">
            {locationProblem && <p className="text-[34px] leading-none">📍</p>}
            <p className={`text-[15px] font-semibold ${locationProblem ? "text-amber-800 dark:text-amber-200" : "text-rose-700 dark:text-rose-300"}`}>
              {locationProblem ? "" : "❌ "}{error}
            </p>
            {locationProblem && (
              <p className="text-[13px] text-muted-foreground">
                {/* Android'da ruxsatni WebView sahifa yopilguncha eslab turadi: rad etilsa «Qayta urinish» ham rad bo'ladi. */}
                {app?.platform === "android"
                  ? t("Telegram joylashuvni so'raganda ruxsat bering. So'ramasa, bu oynani yopib, botdan qayta oching.")
                  : t("Ishga kelganingizni tasdiqlash uchun Telegram'ga joylashuvingizni ko'rishga ruxsat bering — faqat belgilash paytida olinadi.")}
              </p>
            )}
            {errorCode === "too_far" && (
              <p className="text-[13px] text-muted-foreground">
                {t("Filial ichida bo'lsangiz: deraza yoniga yoki ochiq joyga o'ting, keyin qayta urining.")}
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
            <p className="text-[14px] text-muted-foreground">{t("Joylashuvingiz tekshiriladi va belgilanadi")}</p>
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
      {/* Belgilangandan keyin qayta bosish kerak emas — faqat «Yopish». */}
      {!result && (
        <button
          type="button"
          onClick={restart}
          disabled={busy || locating}
          className="h-12 w-full rounded-xl bg-primary text-white text-[15px] font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {error ? t("🔄 Qayta urinish") : t("📍 Belgilash")}
        </button>
      )}
      {closeButton}
    </div>
  );
}
