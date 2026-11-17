"use client";

import { useState } from "react";
import { ArrowRight, Loader2, MapPin, ShieldCheck } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Select from "@/components/v2/ui/V2Select";
import { Avatar, NoticeBar } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";

// YANGI VERSIYA — SOZLAMALAR → «XODIM ILOVASI» (38-qism, rasm «Sozlamalar · Xodim ilovasi»). Ilovani ishlatayotgan
// xodimlar, yuz namunasi borlar, bugun ilovadan kelganlar; «Ishga kelish — Keldim» (usul, filial radiuslari, ishdan
// ketishni belgilash) va bugungi kelganlar ro'yxati. Server: /api/staff-app (lib/staffAppSettings.ts).

type Data = {
  ok: true;
  today: string;
  mode: "geo" | "geo_face";
  checkoutEnabled: boolean;
  employees: number;
  linked: number;
  faces: number;
  todayCount: number;
  branches: { id: number; name: string; radius: number; geoSet: boolean }[];
  arrivals: { name: string; time: string; place: string; face: boolean }[];
};

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-v2-brand" : "bg-v2-border-strong"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function Kpi({ label, value, total, sub }: { label: string; value: number; total?: number; sub: React.ReactNode }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="text-v2-small text-v2-text-2">{label}</div>
      <div className="mt-1 text-[24px] font-semibold tabular-nums text-v2-text">
        {value}
        {total !== undefined && <span className="text-v2-text-2"> / {total}</span>}
      </div>
      {total !== undefined && (
        <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
          <div className="h-full rounded-full bg-v2-brand" style={{ width: `${total ? Math.min(100, (value / total) * 100) : 0}%` }} />
        </div>
      )}
      <div className="text-v2-small text-v2-text-2">{sub}</div>
    </div>
  );
}

const RADII = [50, 100, 150, 200, 300, 500];

export default function StaffAppV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<Data>("/api/staff-app");
  const [busy, setBusy] = useState(false);
  async function save(body: Record<string, unknown>) {
    setBusy(true);
    const r = await fetch("/api/staff-app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Saqlandi"));
    reload();
  }
  if (error) return <div className="p-6"><NoticeBar>{t("Faqat direktor uchun")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div>
        <div className="text-v2-small text-v2-text-2">{t("Ilovalar")}</div>
        <h1 className="text-v2-page text-v2-text">{t("Xodim ilovasi")}</h1>
        <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("Ustoz, admin va boshqa xodimlar telefonidagi Tizimli ilovasi (Telegram'dagi xodim boti). O'zgarish ilovaga keyingi ochilishda yetib boradi.")}</p>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi label={t("Ilovaga kirgan")} value={d.linked} total={d.employees} sub={t("{n} xodim hali kirmagan", { n: Math.max(0, d.employees - d.linked) })} />
        <Kpi label={t("Yuzi ro'yxatda")} value={d.faces} total={d.employees} sub={t("qolganlar birinchi «Keldim»da o'tkazadi")} />
        <Kpi label={t("Bugun ilovadan kelgan")} value={d.todayCount} sub={fmt.dayMonth(d.today)} />
      </section>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand">
              <MapPin className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold text-v2-text">{t("Ishga kelish — «Keldim»")}</h2>
              <p className="text-v2-small text-v2-text-2">{t("Xodim ilovada «Keldim»ni bosganda nima tekshiriladi")}</p>
            </div>
          </div>
          <div role="radiogroup" aria-label={t("Usul")} className="inline-flex gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
            {(
              [
                ["geo", t("Joylashuv")],
                ["geo_face", t("Joylashuv + Face ID")],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={d.mode === k} disabled={busy} onClick={() => void save({ mode: k })} className={`h-8 rounded-v2-sm px-3 text-v2-small font-semibold ${d.mode === k ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-v2-small text-v2-text-2">{d.mode === "geo_face" ? t("Xodim filial hududida bo'lishi va yuzi ro'yxatdagi namunaga mos kelishi kerak. Ikkalasi ham bir necha soniya oladi.") : t("Xodim filial hududida bo'lishi kerak. Yuz tekshirilmaydi.")}</p>
          <ul className="mt-3 divide-y divide-v2-border rounded-v2-md border border-v2-border">
            {d.branches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <MapPin className="size-4 text-v2-success" aria-hidden />
                <span className="min-w-0 flex-1 font-semibold text-v2-text">{b.name}</span>
                <span className="text-v2-small text-v2-text-2">{t("radius")}</span>
                <div className="w-28">
                  <V2Select label={t("radius")} value={String(b.radius)} onChange={(v) => void save({ radius: { id: b.id, m: Number(v) } })} options={[...new Set([...RADII, b.radius])].sort((x, y) => x - y).map((m) => ({ value: String(m), label: `${m} m` }))} searchable={false} />
                </div>
                {b.geoSet ? (
                  <span className="rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-success">{t("xaritada belgilangan")}</span>
                ) : (
                  <Link href="/management-filiallar" className="rounded-full bg-v2-warning-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-warning">
                    {t("nuqta belgilanmagan")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <ul className="mt-3 divide-y divide-v2-border">
            <li className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-v2-text">{t("Ishdan ketishni ham belgilash")}</div>
                <div className="text-v2-small text-v2-text-2">{t("Kun oxirida «Ketdim» tugmasi — ish soati hisobi uchun")}</div>
              </div>
              <Switch on={d.checkoutEnabled} label={t("Ishdan ketishni ham belgilash")} onChange={(v) => void save({ checkoutEnabled: v })} />
            </li>
            <li className="flex items-center gap-3 py-3 opacity-60">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-v2-text">
                  {t("Yuz mos kelmasa — admin tasdiqlaydi")} <span className="ml-1 rounded-v2-sm bg-v2-info-bg px-1.5 text-v2-caption text-v2-info">{t("Tez orada")}</span>
                </div>
                <div className="text-v2-small text-v2-text-2">{t("Hozir yuz mos kelmasa «Keldim» qabul qilinmaydi — xodim QR kiosk orqali belgilanadi")}</div>
              </div>
            </li>
          </ul>
          <div className="mt-2 flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Yuz namunasi faqat raqamli izi bilan saqlanadi; uni xodimning o'zi yangilaydi. Joylashuv faqat «Keldim» bosilgan paytda olinadi — kun bo'yi kuzatilmaydi. QR kiosk — doim zaxira usul.")}
          </div>
        </section>
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
          <h2 className="font-semibold text-v2-text">{t("Bugun ilovadan kelganlar")}</h2>
          <p className="text-v2-small text-v2-text-2">{fmt.dayMonth(d.today)}</p>
          <ul className="mt-2 divide-y divide-v2-border">
            {d.arrivals.map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <Avatar name={a.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-v2-text">{a.name}</div>
                  <div className="truncate text-v2-small text-v2-text-2">{[a.time, a.place].filter(Boolean).join(" · ")}</div>
                </div>
                {a.face && <span className="rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-success">Face ID</span>}
              </li>
            ))}
            {!d.arrivals.length && <li className="py-6 text-center text-v2-small text-v2-text-3">{t("Bugun hali hech kim ilovadan kelmagan")}</li>}
          </ul>
          <Link href="/nazorat-qr" className="mt-2 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
            {t("Xodimlar davomati")} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  );
}
