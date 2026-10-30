"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { LocationChip } from "@/components/shared/AttendanceLocation";
import type { TurnstileLocation } from "@/lib/turnstileIo";
import { useBranch } from "@/components/shared/BranchContext";
import { branchBuildingLabel, branchPool, buildingNo } from "@/lib/branchPools";

/**
 * Kiosk QAYSI BINODA turgani (10.10.2026): 1+2 «Akademiya Chortoq» navbarda
 * bitta qator, xodim davomati esa bino bo'yicha — har kompyuter o'z binosini
 * eslab qoladi (shu brauzer uchun qulaylik; bo'lmasa navbar filiali).
 */
const QR_BUILDING_KEY = "crm:qrBuilding";

// Nazorat → «Ishga keldim (QR)» (sidebar: Nazorat > Amallar, href /nazorat-qr).
//
// Filial qabulxonasidagi ekran (planshet/monitor) shu sahifani ochiq tutadi:
// navbardagi filialning QR kodi har 30 soniyada yangilanadi (rasmga olib
// uydan skanerlab bo'lmasin — lib/attendanceQr.ts), yonida bugun kelganlar.
// Xodim kodni xodimlar botidagi «📷 Ishga keldim» tugmasi yoki telefon
// kamerasi bilan skanerlaydi. Yozuvlar Nazorat → Turniket sahifasida va
// xodim profilidagi «Ish soati» tabida ham ko'rinadi.
//
// «Ishdan ketdim» (28.09.2026: kodi tayyor, hozircha O'CHIQ) — admin shu
// yerdagi tugma bilan yoqadi; yoqilganda ekranda ikkinchi kod chiqadi.

interface Arrival {
  id: number;
  personName: string;
  enterTime: string | null;
  exitTime: string | null;
  status: "kelgan" | "kechikkan";
  lateMinutes: number;
  expected: string | null;
  location?: TurnstileLocation | null;
}

interface QrData {
  branch: { id: number; name: string; geoSet: boolean; radiusM: number };
  date: string;
  qr: { in: string; out: string | null };
  refreshInMs: number;
  bot: string;
  checkoutEnabled: boolean;
  /** Face ID — skanerlashdan oldin yuz tekshiruvi (lib/staffFace.ts). */
  faceRequired: boolean;
  canConfigure: boolean;
  arrivals: Arrival[];
  /** Klient soatida keyingi kod vaqti (so'rov kelgan payt + refreshInMs). */
  expiresAt: number;
}

const SLOT_MS = 30_000;

function QrBox({ svg, label, tone }: { svg: string; label: string; tone: "in" | "out" }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* QR doim oq fonda — tungi rejimda ham skaner o'qisin. */}
      <div
        className="w-full max-w-[360px] rounded-2xl bg-white p-3 shadow-sm [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        // SVG o'z serverimizdan (qrcode kutubxonasi), foydalanuvchi matni yo'q.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span className={`rounded-full px-4 py-1.5 text-[15px] font-bold ${tone === "in" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300"}`}>
        {label}
      </span>
    </div>
  );
}

export default function AttendanceQrPage() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<QrData | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [full, setFull] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const { branchId: navBranchId, branches: allowedBranches } = useBranch();
  const buildings = useMemo(
    () => (navBranchId === null ? [] : branchPool(navBranchId).filter((id) => allowedBranches.some((b) => b.id === id))),
    [navBranchId, allowedBranches],
  );
  // Boshlang'ich qiymat brauzer xotirasidan (serverda — yo'q). Birinchi
  // chizish unga bog'liq emas: QR so'rovi effektda ketadi.
  const [building, setBuilding] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const v = Number(localStorage.getItem(QR_BUILDING_KEY));
      return Number.isInteger(v) && v > 0 ? v : null;
    } catch {
      return null; // saqlab bo'lmaydi — navbar filiali
    }
  });
  // Eslab qolingan bino hozirgi navbar hovuzida bo'lmasa — e'tiborsiz.
  const effective = building !== null && buildings.includes(building) ? building : null;
  function chooseBuilding(id: number) {
    setBuilding(id);
    try { localStorage.setItem(QR_BUILDING_KEY, String(id)); } catch { /* faqat shu sessiya */ }
  }

  // Kod aynan yangilangan paytda qayta so'raladi (server keyingi slotgacha
  // qolgan vaqtni aytadi — kompyuter soati noto'g'ri bo'lsa ham to'g'ri).
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const r = await fetch(effective !== null ? `/api/attendance-qr?building=${effective}` : "/api/attendance-qr", { cache: "no-store" });
        const d = await r.json();
        if (cancelled) return;
        if (d?.ok) {
          const at = Date.now();
          setData({ ...(d as Omit<QrData, "expiresAt">), expiresAt: at + Number(d.refreshInMs) });
          setNow(at);
          setError("");
          timer = window.setTimeout(load, Math.max(1_000, Number(d.refreshInMs) + 300));
        } else {
          setError(t(d?.error || "QR kod yuklanmadi"));
          timer = window.setTimeout(load, 5_000);
        }
      } catch {
        if (cancelled) return;
        setError(t("Tarmoq xatosi — qayta urinilmoqda…"));
        timer = window.setTimeout(load, 5_000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [t, version, effective]);

  // Sekundomer — yangilanishgacha qolgan vaqt chizig'i uchun.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen?.();
  }

  async function toggleSetting(key: "checkoutEnabled" | "faceRequired", next: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/attendance-qr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      }).then((r) => r.json());
      if (!res?.ok) {
        showError(t(res?.error || "Saqlanmadi"));
        return;
      }
      if (key === "faceRequired") showSuccess(next ? t("Face ID yoqildi") : t("Face ID o'chirildi"));
      else showSuccess(next ? t("«Ishdan ketdim» yoqildi") : t("«Ishdan ketdim» o'chirildi"));
      setVersion((v) => v + 1);
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        {error ? <p className="text-sm text-rose-600">{error}</p> : <SpinnerBlock />}
      </div>
    );
  }

  const left = Math.max(0, Math.ceil((data.expiresAt - now) / 1000));
  const pct = Math.min(100, Math.max(0, ((data.expiresAt - now) / SLOT_MS) * 100));
  const late = data.arrivals.filter((a) => a.status === "kechikkan").length;

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
      <div ref={frameRef} className={`space-y-4 ${full ? "h-screen overflow-auto bg-background p-6" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">{t("Ishga keldim")}</h2>
            <p className="text-[13px] text-muted-foreground">{branchBuildingLabel(data.branch, (n) => t("{n}-bino", { n }))}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.canConfigure && !full && (
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px]">
                <input
                  type="checkbox"
                  checked={data.checkoutEnabled}
                  disabled={saving}
                  onChange={(e) => void toggleSetting("checkoutEnabled", e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span>{t("«Ishdan ketdim» ham ishlasin")}</span>
              </label>
            )}
            {data.canConfigure && !full && (
              <label
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px]"
                title={t("Xodim skanerlashdan oldin telefonida yuzini tasdiqlaydi. Birinchi marta yuzi ro'yxatga olinadi.")}
              >
                <input
                  type="checkbox"
                  checked={data.faceRequired}
                  disabled={saving}
                  onChange={(e) => void toggleSetting("faceRequired", e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span>{t("Yuz tekshiruvi (Face ID)")}</span>
              </label>
            )}
            {buildings.length > 1 && !full && (
              <div className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 text-[13px]" role="tablist" aria-label={t("Bino")}>
                {buildings.map((id) => {
                  const on = data.branch.id === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => chooseBuilding(id)}
                      className={`h-8 rounded-md px-3 ${on ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
                    >
                      {t("{n}-bino", { n: buildingNo(id) ?? id })}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={toggleFull}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-medium hover:bg-secondary"
            >
              {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span>{full ? t("Chiqish") : t("To'liq ekran")}</span>
            </button>
          </div>
        </div>

        {error && <p className="text-[13px] text-rose-600">{error}</p>}

        {/* Joylashuv tekshiruvi shu filialda ishlamayapti — ekran oldidagilar
            buni bilsin (koordinata Boshqaruv → Filiallar'da kiritiladi). */}
        {!data.branch.geoSet && !full && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200">
            <strong>{t("Filial joylashuvi kiritilmagan.")}</strong>{" "}
            {t("Skanerlashda joylashuv yoziladi, lekin filialdan uzoqligi tekshirilmaydi — Boshqaruv → Filiallar'da filial koordinatasini kiriting.")}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className={`grid gap-6 ${data.qr.out ? "sm:grid-cols-2" : ""} justify-items-center`}>
              <QrBox svg={data.qr.in} label={t("Ishga keldim")} tone="in" />
              {data.qr.out && <QrBox svg={data.qr.out} label={t("Ishdan ketdim")} tone="out" />}
            </div>
            <div className="mx-auto mt-5 max-w-[420px]">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-center text-[12px] text-muted-foreground tabular-nums">
                {t("Kod {n} soniyadan keyin yangilanadi", { n: left })}
              </p>
            </div>
            <p className="mx-auto mt-4 max-w-[520px] text-center text-[13px] text-muted-foreground">
              {t("Telegram'da @{bot} botini oching va «📷 Ishga keldim» tugmasini bosing — yoki telefon kamerasi bilan skanerlang.", { bot: data.bot })}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-[14px] font-semibold">{t("Bugun kelganlar")}</span>
              <span className="text-[12px] text-muted-foreground tabular-nums">
                {data.arrivals.length}
                {late > 0 ? ` · ${t("kechikkan: {n}", { n: late })}` : ""}
              </span>
            </div>
            {data.arrivals.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">{t("Hali hech kim belgilanmagan")}</p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-border overflow-auto">
                {data.arrivals.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-12 shrink-0 text-[14px] font-semibold tabular-nums">{a.enterTime ?? "—"}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px]">{a.personName}</span>
                    {a.exitTime && <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">→ {a.exitTime}</span>}
                    {a.location && (
                      <span className="shrink-0">
                        <LocationChip loc={a.location} person={a.personName} when={`${data.date} · ${a.enterTime ?? ""}`} compact />
                      </span>
                    )}
                    {a.status === "kechikkan" ? (
                      <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        {t("{n} daq. kech", { n: a.lateMinutes })}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        {t("Vaqtida")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
