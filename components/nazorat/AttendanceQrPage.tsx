"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { LocationChip } from "@/components/shared/AttendanceLocation";
import type { TurnstileLocation } from "@/lib/turnstileIo";
import { useBranch } from "@/components/shared/BranchContext";
import { branchBuildingLabel, branchPool, buildingNo } from "@/lib/branchPools";

/**
 * Ro'yxat QAYSI BINO bo'yicha (10.10.2026): 1+2 «Akademiya Chortoq» navbarda
 * bitta qator, xodim davomati esa bino bo'yicha — har kompyuter tanlangan
 * binoni eslab qoladi (shu brauzer uchun qulaylik; bo'lmasa navbar filiali).
 */
const QR_BUILDING_KEY = "crm:qrBuilding";

// Nazorat → «Ishga keldim» (sidebar: Nazorat > Amallar, href /nazorat-qr —
// yo'l nomi tarixiy).
//
// 31.10.2026 dan QR YO'Q (foydalanuvchi: "qr code kerak emas endi ...
// lokatsiya va face id bo'lsa bo'ldi"): xodim xodimlar botidagi «📷 Ishga
// keldim» tugmasini bosadi — yuz (Face ID yoqilgan bo'lsa) va joylashuv
// tekshiriladi, filial joylashuvdan aniqlanadi (lib/attendanceCheck.ts →
// locateBranch). Bu sahifada: tanlangan binoda bugun kelganlar (har 30
// soniyada yangilanadi), sozlamalar (faqat admin) va koordinatasi
// kiritilmagan filiallar — ularda belgilab bo'lmaydi (Boshqaruv → Filiallar).
// Yozuvlar Nazorat → Turniket sahifasida va xodim profilidagi «Ish soati»
// tabida ham ko'rinadi.

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

interface PageData {
  branch: { id: number; name: string; geoSet: boolean; radiusM: number };
  /** Koordinatasi kiritilmagan filiallar — ularda «Ishga keldim» ishlamaydi. */
  missingGeo: { id: number; name: string }[];
  date: string;
  bot: string;
  checkoutEnabled: boolean;
  /** Face ID — belgilashdan oldin yuz tekshiruvi (lib/staffFace.ts). */
  faceRequired: boolean;
  canConfigure: boolean;
  arrivals: Arrival[];
}

const REFRESH_MS = 30_000;

export default function AttendanceQrPage() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const { branchId: navBranchId, branches: allowedBranches } = useBranch();
  const buildings = useMemo(
    () => (navBranchId === null ? [] : branchPool(navBranchId).filter((id) => allowedBranches.some((b) => b.id === id))),
    [navBranchId, allowedBranches],
  );
  // Boshlang'ich qiymat brauzer xotirasidan (serverda — yo'q). Birinchi
  // chizish unga bog'liq emas: so'rov effektda ketadi.
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

  // Ro'yxat har 30 soniyada yangilanadi (sahifa qabulxona ekranida ochiq turishi mumkin).
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const r = await fetch(effective !== null ? `/api/attendance-qr?building=${effective}` : "/api/attendance-qr", { cache: "no-store" });
        const d = await r.json();
        if (cancelled) return;
        if (d?.ok) {
          setData(d as PageData);
          setError("");
        } else {
          setError(t(d?.error || "Ma'lumot olinmadi"));
        }
      } catch {
        if (cancelled) return;
        setError(t("Tarmoq xatosi — qayta urinilmoqda…"));
      }
      if (!cancelled) timer = window.setTimeout(load, REFRESH_MS);
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [t, version, effective]);

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

  const late = data.arrivals.filter((a) => a.status === "kechikkan").length;

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight">{t("Ishga keldim")}</h2>
            <p className="text-[13px] text-muted-foreground">{branchBuildingLabel(data.branch, (n) => t("{n}-bino", { n }))}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.canConfigure && (
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
            {data.canConfigure && (
              <label
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px]"
                title={t("Xodim belgilashdan oldin telefonida yuzini tasdiqlaydi. Birinchi marta yuzi ro'yxatga olinadi.")}
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
            {buildings.length > 1 && (
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
          </div>
        </div>

        {error && <p className="text-[13px] text-rose-600">{error}</p>}

        {/* Filial joylashuvdan aniqlanadi — koordinatasiz filialda xodim belgilana olmaydi. */}
        {data.missingGeo.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200">
            <strong>{t("Joylashuvi kiritilmagan filiallar: {names}.", { names: data.missingGeo.map((b) => b.name).join(", ") })}</strong>{" "}
            {t("Ularda «Ishga keldim» ishlamaydi — xodim qaysi filialda ekani joylashuvdan aniqlanadi.")}{" "}
            <Link href="/management-filiallar" className="font-medium underline underline-offset-2">
              {t("Boshqaruv → Filiallar'da koordinatani kiriting")}
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
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
              <ul className="max-h-[70vh] divide-y divide-border overflow-auto">
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

          <div className="h-fit rounded-2xl border border-border bg-card p-5">
            <p className="text-[14px] font-semibold">{t("Qanday belgilanadi")}</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] text-muted-foreground">
              <li>{t("Xodim Telegram'da @{bot} botini ochib, «📷 Ishga keldim» tugmasini bosadi.", { bot: data.bot })}</li>
              {data.faceRequired && <li>{t("Yuzini telefon kamerasida tasdiqlaydi (birinchi marta yuzi ro'yxatga olinadi).")}</li>}
              <li>{t("Joylashuvi olinadi: filialdan {m} m ichida bo'lsa, eng yaqin filialga belgilanadi.", { m: data.branch.radiusM })}</li>
              <li>{t("Kechikish dars jadvali yoki filialning ish vaqti bo'yicha o'lchanadi.")}</li>
            </ol>
            <p className="mt-3 text-[12px] text-muted-foreground">{t("QR kod endi kerak emas.")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
