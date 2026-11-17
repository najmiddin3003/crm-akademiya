"use client";

import { useState } from "react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import V2Select from "@/components/v2/ui/V2Select";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import type { ReportDef } from "@/lib/reportsCatalog";
import type { RoomBlock, RoomsReport } from "@/lib/reportResources";
import { WORK_FROM, WORK_TO } from "@/lib/roomsHours";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { Panel } from "./report35";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → «XONALAR BANDLIGI» (35-qism, rasm «Xonalar bandligi»). Filial; «Toq kunlar ·
// Du, Ch, Ju | Juft kunlar · Se, Pa, Sh»; 4 ko'rsatkich (Haftalik bandlik, Eng band soat, Xona to'liqligi, Kam
// ishlatiladi); vaqt jadvali — har qator xona, bloklar guruh darslari (fan rangi, «o'quvchi / sig'im · vaqt»),
// eng band soat ustuni `warning-bg`; o'ngda «haftasiga · to'liqlik». Pastda uchta maslahat kartasi.
// Server: /api/reports/rooms (lib/reportResources.ts).

type Resp = RoomsReport & { ok: true };
type Day = "odd" | "even";
const HOURS = Array.from({ length: WORK_TO - WORK_FROM }, (_, i) => WORK_FROM + i);
const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const leftPct = (hm: string) => ((toMin(hm) - WORK_FROM * 60) / ((WORK_TO - WORK_FROM) * 60)) * 100;

export default function XonalarReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const branchOptions = useBranchOptions();
  const [branch, setBranch] = useState(branchOptions[0]?.value ?? "");
  const [day, setDay] = useState<Day>("odd");
  const { data, loading, stale, error, reload } = useReportData<Resp>(`/api/reports/rooms?${new URLSearchParams(branch ? { branch } : {})}`);
  const branchName = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? "") : t("Barcha filiallar");
  const peak = data?.peak[day] ?? null;
  const dayLabel = day === "odd" ? t("Toq kunlar · Du, Ch, Ju") : t("Juft kunlar · Se, Pa, Sh");

  function getDoc(): ExportDoc | null {
    if (!data) return null;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${today}`,
      center: t(CENTER_NAME),
      branchLabel: branchName,
      dateLabel: f.fullDate(today),
      author,
      filters: [branchName, t("ish vaqti {a}:00–{b}:00", { a: WORK_FROM, b: WORK_TO })].join(" · "),
      kpis: [
        { label: t("Haftalik bandlik"), value: `${data.totals.occupancy}% · ${data.totals.weeklyHours} / ${data.totals.capacityHours}` },
        { label: t("Xona to'liqligi"), value: data.totals.fill === null ? "—" : `${data.totals.fill}%` },
      ],
      sections: [
        {
          columns: [{ label: t("Xona") }, { label: t("O'rin"), numeric: true }, { label: t("Toq kunlar") }, { label: t("Juft kunlar") }, { label: t("Haftasiga, soat"), numeric: true }, { label: t("Bandlik, %"), numeric: true }, { label: t("To'liqlik, %"), numeric: true }],
          rows: data.rooms.map((r) => [r.room, r.capacity, r.blocks.odd.map((b) => `${b.start}–${b.end} ${b.label}`).join("; "), r.blocks.even.map((b) => `${b.start}–${b.end} ${b.label}`).join("; "), r.weeklyHours, r.occupancy, r.fill]),
        },
      ],
      footer: DOC_FOOTER,
    };
  }

  return (
    <ReportShell
      report={report}
      subtitle={`${t(report.subtitle)} · ${branchName} · ${t("ish vaqti {a}:00–{b}:00", { a: `0${WORK_FROM}`.slice(-2), b: WORK_TO })}`}
      getDoc={getDoc}
      exportReady={!!data && !stale}
      filters={<V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />}
      filtersEnd={
        <div role="tablist" className="flex rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
          {(
            [
              ["odd", t("Toq kunlar · Du, Ch, Ju")],
              ["even", t("Juft kunlar · Se, Pa, Sh")],
            ] as [Day, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={day === k} onClick={() => setDay(k)} className={`h-8 rounded-[6px] px-3 text-v2-small font-semibold ${day === k ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
              {l}
            </button>
          ))}
        </div>
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}
      <div className={stale ? "opacity-60" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "o", label: t("Haftalik bandlik"), value: data ? `${data.totals.occupancy}%` : null, sub: data ? t("{a} / {b} soat · {n} xona × {h} ish soati", { a: data.totals.weeklyHours, b: data.totals.capacityHours, n: data.rooms.length, h: (WORK_TO - WORK_FROM) * 6 }) : "" },
            { key: "p", label: t("Eng band soat"), value: peak ? `${peak.hour}:00–${peak.hour + 1}:00` : "—", sub: peak ? t("{d} · {n} xonadan {b} tasi band", { d: day === "odd" ? t("toq kunlar") : t("juft kunlar"), n: data!.rooms.length, b: peak.busy }) : "" },
            { key: "f", label: t("Xona to'liqligi"), value: data?.totals.fill === null || !data ? "—" : `${data.totals.fill}%`, sub: data ? t("{a} o'quvchi · darslardagi {b} o'rin", { a: data.totals.pupils, b: data.totals.seats }) : "" },
            { key: "l", label: t("Kam ishlatiladi"), value: data ? t("{n} xona", { n: data.low.length }) : null, tone: data?.low.length ? "danger" : undefined, sub: data?.low.length ? t("{r} — haftasiga 6 soatdan kam", { r: data.low.join(", ") }) : t("hamma xona ishlatiladi") },
          ]}
        />
      </div>

      <Panel
        title={dayLabel}
        sub={t("har qator — bitta xona; blok — guruh darsi")}
        right={
          <span className="flex items-center gap-3 text-v2-caption text-v2-text-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] bg-v2-warning-bg ring-1 ring-v2-warning" /> {t("eng band soat")}
            </span>
          </span>
        }
        className={stale ? "opacity-60" : ""}
      >
        <div className="overflow-x-auto border-t border-v2-border">
          <div className="min-w-[980px] px-4 py-2">
            <div className="grid grid-cols-[110px_minmax(0,1fr)_120px] items-end gap-3 pb-1 text-v2-caption text-v2-text-3">
              <span>{t("Xona")}</span>
              <span className="relative h-4">
                {HOURS.filter((h) => h % 2 === 0).map((h) => (
                  <span key={h} className={`absolute -translate-x-1/2 ${peak?.hour === h ? "font-semibold text-v2-warning" : ""}`} style={{ left: `${((h - WORK_FROM) / (WORK_TO - WORK_FROM)) * 100}%` }}>
                    {h}
                  </span>
                ))}
              </span>
              <span className="text-right">{t("haftasiga · to'liqlik")}</span>
            </div>
            {(data?.rooms ?? []).map((r) => {
              const blocks = r.blocks[day];
              return (
                <div key={r.room} className="grid grid-cols-[110px_minmax(0,1fr)_120px] items-center gap-3 border-t border-v2-border py-2">
                  <div>
                    <div className="font-semibold text-v2-text">{t("{n}-xona", { n: r.room })}</div>
                    <div className="text-v2-caption text-v2-text-2">{r.capacity ? t("{n} o'rin", { n: r.capacity }) : "—"}</div>
                  </div>
                  <div className="relative h-11 rounded-v2-md bg-v2-surface-2">
                    {peak && <span className="absolute inset-y-0 bg-v2-warning-bg" style={{ left: `${((peak.hour - WORK_FROM) / (WORK_TO - WORK_FROM)) * 100}%`, width: `${100 / (WORK_TO - WORK_FROM)}%` }} aria-hidden />}
                    {blocks.length === 0 && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-v2-caption text-v2-text-3">{day === "odd" ? t("toq kunlarda dars yo'q") : t("juft kunlarda dars yo'q")}</span>}
                    {blocks.map((b) => (
                      <Block key={`${b.groupId}-${b.start}`} b={b} />
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums text-v2-text">
                      {t("{h} soat", { h: fmtNum(r.weeklyHours) })} · {r.occupancy}%
                    </div>
                    <div className={`text-v2-caption ${r.fill !== null && r.fill >= 100 ? "font-semibold text-v2-danger" : "text-v2-text-2"}`}>{r.fill === null ? "—" : t("{p}% to'la", { p: r.fill })}</div>
                  </div>
                </div>
              );
            })}
            {loading && <div className="h-40 animate-pulse rounded-v2-md bg-v2-skeleton" aria-hidden />}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">
          <span>{t("Bandlik = dars soatlari ÷ {h} ish soati (Du–Sha, {a}:00–{b}:00) · to'liqlik = xonadagi eng katta guruh ÷ xona sig'imi", { h: (WORK_TO - WORK_FROM) * 6, a: `0${WORK_FROM}`.slice(-2), b: WORK_TO })}</span>
          <Link href="/groups-schedule" className="font-semibold text-v2-brand">
            {t("Dars jadvali")} →
          </Link>
        </div>
      </Panel>

      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Tip dot="bg-v2-success" title={t("Yangi guruh uchun bo'sh vaqt")} link={{ href: "/groups", label: t("Guruh ochish") }}>
            {data.freeSlots[day].map((s) => (
              <div key={s}>{s}</div>
            ))}
          </Tip>
          <Tip dot="bg-v2-warning" title={t("Kam ishlatilayotgan xonalar")} link={{ href: "/groups-schedule", label: t("Jadvalni ko'rish") }}>
            {data.low.length ? t("{r} — haftasiga 6 soatdan kam band. Darslarni bitta xonaga jamlasa, bittasi bo'shaydi.", { r: data.low.join(", ") }) : t("Hamma xona yetarli ishlatiladi.")}
          </Tip>
          <Tip dot="bg-v2-danger" title={t("Sig'imga yetgan guruhlar")} link={{ href: "/groups-rooms", label: t("Xonalar") }}>
            {data.full.length ? data.full.map((x) => `${x.room}: ${x.label} ${x.pupils}/${x.capacity}`).join("; ") : t("Sig'imga yetgan guruh yo'q.")}
          </Tip>
        </div>
      )}
      <NoteLine>{t("Faol guruhlar jadvali (kunlari, vaqti va xonasi) bo'yicha. Xonasi yoki vaqti yozilmagan guruh jadvalga tushmaydi.")}</NoteLine>
    </ReportShell>
  );
}

function Block({ b }: { b: RoomBlock }) {
  const { t } = useT();
  const l = leftPct(b.start);
  const w = leftPct(b.end) - l;
  return (
    <span
      className="absolute inset-y-1 overflow-hidden rounded-[6px] border-l-[3px] border-v2-brand bg-v2-surface px-1.5 shadow-v2-sm"
      style={{ left: `${Math.max(0, l)}%`, width: `${Math.max(2, w)}%` }}
      title={`${b.label} · ${b.pupils}/${b.capacity} · ${b.start}–${b.end}`}
    >
      <span className="flex items-center gap-1 truncate text-[11px] font-semibold leading-4 text-v2-text">
        <span className={`size-1.5 shrink-0 rounded-[2px] ${FAN_DOT[fanOf(b.course)]}`} aria-hidden />
        {b.label}
      </span>
      <span className={`block truncate text-[10px] leading-3.5 ${b.capacity && b.pupils >= b.capacity ? "font-semibold text-v2-danger" : "text-v2-text-2"}`}>
        {b.pupils} / {b.capacity || "?"} · {b.start}–{b.end}
      </span>
      <span className="sr-only">{t("guruh darsi")}</span>
    </span>
  );
}

function Tip({ dot, title, children, link }: { dot: string; title: string; children: React.ReactNode; link: { href: string; label: string } }) {
  return (
    <section className="flex flex-col rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <h3 className="flex items-center gap-2 font-semibold text-v2-text">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        {title}
      </h3>
      <div className="mt-1 flex-1 text-v2-small text-v2-text-2">{children}</div>
      <Link href={link.href} className="mt-2 text-v2-small font-semibold text-v2-brand">
        {link.label} →
      </Link>
    </section>
  );
}
