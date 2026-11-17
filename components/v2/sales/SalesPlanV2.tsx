"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { fieldCls } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2MonthNav from "@/components/v2/ui/V2MonthNav";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import {
  NoticeBar,
  PageHead,
  PageShell,
  TH,
  downloadCsv,
} from "@/components/v2/students/lists/listKit";
import { useBranchOptions } from "@/components/v2/reports/reportHooks";
import type { AdminPlanRow, SalesPlanReport } from "@/lib/salesTargets";

// YANGI VERSIYA — SOTUV VA MARKETING → «SAVDO PLANI» (36-qism, rasmlar «Savdo plani», «Rejani sozlash»). Oy,
// filial, Excel, «Rejani sozlash»; 4 ko'rsatkich (Yangi o'quvchilar reja/bajarilish, Oy oxiriga prognoz, Liddan
// o'quvchiga, Rejadan orqada); «Adminlar bo'yicha» jadvali (bajarilish chizig'i va bugungi kutilgan joy belgisi),
// «Kunma-kun» grafigi (jamlanma ustunlar + reja chizig'i); orqada qolgan filial ogohlantirishi.
// Server: /api/sales-targets (lib/salesTargets.ts).

const cur = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function SalesPlanV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const branchOptions = useBranchOptions();
  const [month, setMonth] = useState(cur());
  const [branch, setBranch] = useState("");
  const [d, setD] = useState<SalesPlanReport | null>(null);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState(0);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    let off = false;
    void fetch(
      `/api/sales-targets?${new URLSearchParams({ month, ...(branch ? { branch } : {}) })}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((j) => {
        if (off) return;
        if (j?.ok) {
          setD(j);
          setErr("");
        } else setErr(String(j?.error || "Ma'lumot olinmadi"));
      })
      .catch(() => !off && setErr("Tarmoq xatosi"));
    return () => {
      off = true;
    };
  }, [month, branch, ver]);

  const k = d?.total;
  const behind = (d?.rows ?? []).filter((r) => r.behind);
  const weakBranch = (d?.branches ?? [])
    .filter(
      (b) =>
        b.target &&
        b.done < ((b.target * (d?.day ?? 0)) / (d?.days || 1)) * 0.85,
    )
    .sort((a, b) => a.done / a.target - b.done / b.target)[0];

  function exportCsv() {
    if (!d) return;
    downloadCsv(
      `savdo-plani-${month}.csv`,
      ["Admin", "Reja", "Bajarildi", "Lid", "Konversiya %", "Prognoz"],
      d.rows.map((r) => [
        r.admin,
        r.target,
        r.done,
        r.leads,
        r.convPct ?? "",
        r.forecast,
      ]),
    );
  }

  return (
    <PageShell flow>
      <PageHead
        title={t("Savdo plani")}
        subtitle={t(
          "Har admin uchun oylik yangi o'quvchi rejasi va uning kunma-kun bajarilishi",
        )}
        actions={
          <>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!d}
              className={`${secondaryBtn} disabled:opacity-50`}
            >
              <Download className="size-4" strokeWidth={1.75} aria-hidden />
              Excel
            </button>
            <button
              type="button"
              onClick={() => setEdit(true)}
              disabled={!d}
              className={`${primaryBtn} disabled:opacity-50`}
            >
              {t("Rejani sozlash")}
            </button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <V2MonthNav value={month} onChange={setMonth} current={cur()} />
        {branchOptions.length > 1 && (
          <V2Select
            variant="value"
            label={t("Filial")}
            emptyLabel="Barchasi"
            value={branch}
            onChange={setBranch}
            options={branchOptions}
            searchable={false}
          />
        )}
        {d && d.day > 0 && !d.closed && (
          <span className="ml-auto text-v2-small text-v2-text-2">
            {t("{d} · oyning {a} / {b} kuni o'tdi", {
              d: fmt.dayMonth(d.today),
              a: d.day,
              b: d.days,
            })}
          </span>
        )}
      </div>
      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!d && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden />{" "}
          {t("Yuklanmoqda…")}
        </div>
      )}

      {d && k && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label={t("Yangi o'quvchilar")}
              value={`${k.done} / ${k.target || "—"}`}
              badge={k.target ? `${pct(k.done, k.target)}%` : undefined}
              sub={t("reja · oyning {p}% i o'tdi", { p: pct(d.day, d.days) })}
            />
            <Kpi
              label={t("Oy oxiriga prognoz")}
              value={d.closed ? String(k.done) : String(k.forecast)}
              badge={
                k.target
                  ? `${pct(d.closed ? k.done : k.forecast, k.target)}%`
                  : undefined
              }
              sub={d.closed ? t("oy yopildi") : t("bugungi sur'at bo'yicha")}
            />
            <Kpi
              label={t("Liddan o'quvchiga")}
              value={k.convPct === null ? "—" : `${k.convPct}%`}
              sub={t("{a} lid · {b} admin", { a: k.leads, b: d.rows.length })}
            />
            <Kpi
              label={t("Rejadan orqada")}
              value={t("{n} admin", { n: behind.length })}
              tone={behind.length ? "danger" : "success"}
              sub={
                behind.length
                  ? behind.map((b) => b.admin).join(", ")
                  : t("hamma rejada")
              }
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div>
                  <h2 className="font-semibold text-v2-text">
                    {t("Adminlar bo'yicha")}
                  </h2>
                  <p className="text-v2-small text-v2-text-2">
                    {t("yangi o'quvchi — birinchi to'lovni qilgan lid")}
                  </p>
                </div>
                {!d.closed && d.day > 0 && (
                  <span className="flex items-center gap-1.5 text-v2-small text-v2-text-2">
                    <span className="h-3 w-0.5 bg-v2-text" aria-hidden />{" "}
                    {t("bugungi kutilgan joy · {p}%", {
                      p: pct(d.day, d.days),
                    })}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto border-t border-v2-border">
                <table className="w-full min-w-[760px] border-collapse text-v2-body">
                  <thead>
                    <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                      <th className={`${TH} pl-4`}>{t("Admin")}</th>
                      <th className={`${TH} text-right`}>{t("Reja")}</th>
                      <th className={TH}>{t("Bajarilishi")}</th>
                      <th className={`${TH} text-right`}>{t("Lid")}</th>
                      <th className={`${TH} text-right`}>{t("Konversiya")}</th>
                      <th className={`${TH} text-right`}>{t("Prognoz")}</th>
                      <th className={`${TH} pr-4`}>{t("Holat")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <Row key={r.admin} r={r} d={d} />
                    ))}
                    {!d.rows.length && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-v2-small text-v2-text-3"
                        >
                          {t("Admin yo'q")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">
                {t(
                  "Prognoz — bugungi sur'at bo'yicha oy oxiriga · konversiya — shu oy yozilgan lidlardan",
                )}
              </p>
            </section>

            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
              <h2 className="font-semibold text-v2-text">{t("Kunma-kun")}</h2>
              <p className="text-v2-small text-v2-text-2">
                {t("jami yangi o'quvchilar va reja chizig'i")}
              </p>
              <DailyChart d={d} />
              <div className="mt-2 flex gap-3 text-v2-caption text-v2-text-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px] bg-v2-info" />{" "}
                  {t("jami bajarildi")}
                </span>
                {k.target > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 border-t border-dashed border-v2-text-2" />{" "}
                    {t("reja · oy oxirida {n}", { n: k.target })}
                  </span>
                )}
              </div>
              {k.target > 0 && !d.closed && d.day > 0 && (
                <p
                  className={`mt-2 text-v2-small font-semibold ${k.done >= k.expected ? "text-v2-success" : "text-v2-danger"}`}
                >
                  {k.done >= k.expected
                    ? t("bugun rejadan +{n} oldinda", {
                        n: (
                          Math.round((k.done - k.expected) * 10) / 10
                        ).toLocaleString("ru-RU"),
                      })
                    : t("bugun rejadan {n} orqada", {
                        n: (
                          Math.round((k.expected - k.done) * 10) / 10
                        ).toLocaleString("ru-RU"),
                      })}
                </p>
              )}
              {!k.target && (
                <p className="mt-2 text-v2-small text-v2-warning">
                  {t("Bu oy uchun reja kiritilmagan — «Rejani sozlash»")}
                </p>
              )}
            </section>
          </div>

          {weakBranch && (
            <section className="flex flex-wrap items-center gap-3 rounded-v2-lg border border-v2-warning/40 bg-v2-warning-bg px-4 py-3">
              <AlertTriangle className="size-5 text-v2-warning" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-v2-text">
                  {t("{b} rejadan orqada: {t} dan {d} ta ({p}%)", {
                    b: weakBranch.name,
                    t: weakBranch.target,
                    d: weakBranch.done,
                    p: pct(weakBranch.done, weakBranch.target),
                  })}
                </div>
                <div className="text-v2-small text-v2-text-2">
                  {t(
                    "Lid {l} ta. Birinchi darsga kelgan {c} kishidan {p} tasi to'ladi.",
                    {
                      l: weakBranch.leads,
                      c: weakBranch.came,
                      p: weakBranch.paidOfCame,
                    },
                  )}
                </div>
              </div>
              <Link
                href="/reports/sotuv-voronkasi"
                className="text-v2-small font-semibold text-v2-brand"
              >
                {t("Sotuv voronkasi")} →
              </Link>
            </section>
          )}
        </>
      )}
      {edit && d && (
        <TargetsDialog
          d={d}
          onClose={() => setEdit(false)}
          onDone={() => setVer((v) => v + 1)}
        />
      )}
    </PageShell>
  );
}

function Kpi({
  label,
  value,
  badge,
  sub,
  tone,
}: {
  label: string;
  value: string;
  badge?: string;
  sub: string;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="text-v2-small text-v2-text-2">{label}</div>
      <div
        className={`mt-1 text-[24px] font-semibold leading-8 tabular-nums ${tone === "danger" ? "text-v2-danger" : "text-v2-text"}`}
      >
        {value}{" "}
        {badge && (
          <span className="text-v2-small font-semibold text-v2-success">
            {badge}
          </span>
        )}
      </div>
      <div className="truncate text-v2-small text-v2-text-2">{sub}</div>
    </div>
  );
}

function Row({ r, d }: { r: AdminPlanRow; d: SalesPlanReport }) {
  const { t } = useT();
  const p = pct(r.done, r.target);
  const marker = pct(d.day, d.days);
  const status = !r.target
    ? ["bg-v2-surface-2 text-v2-text-2", t("Reja yo'q")]
    : r.behind
      ? ["bg-v2-danger-bg text-v2-danger", t("Orqada")]
      : r.done >= r.expected
        ? [
            "bg-v2-success-bg text-v2-success",
            d.closed
              ? r.done >= r.target
                ? t("Bajarildi")
                : t("Bajarilmadi")
              : t("Rejada"),
          ]
        : ["bg-v2-warning-bg text-v2-warning", t("Biroz orqada")];
  return (
    <tr className="border-b border-v2-border last:border-b-0">
      <td className="py-2.5 pl-4 pr-3 font-semibold text-v2-text">{r.admin}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">
        {r.target || "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative block h-2 w-32 overflow-hidden rounded-full bg-v2-surface-2">
            <span
              className={`block h-full rounded-full ${r.behind ? "bg-v2-danger" : "bg-v2-success"}`}
              style={{ width: `${Math.min(100, p)}%` }}
            />
            {r.target > 0 && !d.closed && (
              <span
                className="absolute inset-y-0 w-0.5 bg-v2-text"
                style={{ left: `${marker}%` }}
                aria-hidden
              />
            )}
          </span>
          <span className="tabular-nums text-v2-text">
            <b>{r.done}</b>
            {r.target ? ` · ${p}%` : ""}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">
        {r.leads}
      </td>
      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">
        {r.convPct === null ? "—" : `${r.convPct}%`}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">
        {d.closed ? r.done : r.forecast}
        {r.target ? (
          <span className="text-v2-text-2"> / {r.target}</span>
        ) : null}
      </td>
      <td className="py-2.5 pl-3 pr-4">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-v2-small font-semibold ${status[0]}`}
        >
          {status[1]}
        </span>
      </td>
    </tr>
  );
}

function DailyChart({ d }: { d: SalesPlanReport }) {
  const { t } = useT();
  const max = Math.max(d.total.target, ...d.daily.map((x) => x.cum), 1);
  const H = 150;
  return (
    <div className="relative mt-4" style={{ height: H + 24 }}>
      <div
        className="absolute inset-x-0 top-0 flex items-end gap-px"
        style={{ height: H }}
      >
        {Array.from({ length: d.days }, (_, i) => {
          const v = d.daily[i]?.cum;
          const isToday = i + 1 === d.day && !d.closed;
          return (
            <div
              key={i}
              className="flex flex-1 flex-col items-center justify-end"
              style={{ height: H }}
            >
              {isToday && v !== undefined && (
                <span className="mb-0.5 text-[11px] font-semibold text-v2-brand">
                  {v}
                </span>
              )}
              {v !== undefined ? (
                <span
                  className={`w-full rounded-t-[2px] ${isToday ? "bg-v2-brand" : "bg-v2-info"}`}
                  style={{ height: `${(v / max) * (H - 16)}px` }}
                />
              ) : (
                <span className="h-0.5 w-full bg-v2-surface-2" />
              )}
            </div>
          );
        })}
      </div>
      {d.total.target > 0 && (
        <svg
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: H }}
          width="100%"
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <line
            x1="0"
            y1={H}
            x2="100"
            y2={H - (d.total.target / max) * (H - 16)}
            stroke="currentColor"
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
            className="text-v2-text-2"
          />
        </svg>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-between text-[11px] text-v2-text-3">
        <span>1</span>
        {!d.closed && d.day > 0 && (
          <span>{t("{d} · bugun", { d: d.day })}</span>
        )}
        <span>{d.days}</span>
      </div>
    </div>
  );
}

function TargetsDialog({
  d,
  onClose,
  onDone,
}: {
  d: SalesPlanReport;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      d.rows.map((r) => [
        r.admin,
        r.target ? String(r.target) : String(d.prev.target[r.admin] ?? ""),
      ]),
    ),
  );
  const [alsoNext, setAlsoNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const admins = d.rows.filter((r) => r.admin !== "Biriktirilmagan");
  const sum = admins.reduce((a, r) => a + (Number(vals[r.admin]) || 0), 0);
  async function save(close: () => void) {
    setSaving(true);
    const res = await fetch("/api/sales-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: d.month,
        alsoNext,
        targets: Object.fromEntries(
          admins.map((r) => [r.admin, Number(vals[r.admin]) || 0]),
        ),
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Reja saqlandi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("Rejani sozlash")}
      subtitle={t("{m} · har admin uchun yangi o'quvchilar soni", {
        m: `${fmt.monthName(d.month)} ${d.month.slice(0, 4)}`,
      })}
      onClose={onClose}
      saving={saving}
      width={520}
      footerStart={
        <span className="text-v2-small text-v2-text-2">
          {t("Jami: {n} o'quvchi", { n: sum })}
        </span>
      }
      footer={(api) => (
        <>
          <button
            type="button"
            onClick={api.requestClose}
            className={secondaryBtn}
          >
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            onClick={() => void save(api.close)}
            disabled={saving}
            className={`${primaryBtn} disabled:opacity-50`}
          >
            {t("Saqlash")}
          </button>
        </>
      )}
    >
      <ul className="divide-y divide-v2-border rounded-v2-md border border-v2-border">
        {admins.map((r) => (
          <li
            key={r.admin}
            className="flex items-center justify-between gap-3 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-v2-text">
                {r.admin}
              </div>
              <div className="text-v2-caption text-v2-text-2">
                {t("{m}: {a} o'quvchi · reja {b}", {
                  m: fmt.monthName(d.prev.month),
                  a: d.prev.done[r.admin] ?? 0,
                  b: d.prev.target[r.admin] ?? "—",
                })}
              </div>
            </div>
            <div className="w-20 shrink-0">
              <input
                value={vals[r.admin] ?? ""}
                onChange={(e) =>
                  setVals((v) => ({
                    ...v,
                    [r.admin]: e.target.value.replace(/\D/g, "").slice(0, 3),
                  }))
                }
                inputMode="numeric"
                aria-label={r.admin}
                className={fieldCls("default", "text-right")}
              />
            </div>
          </li>
        ))}
      </ul>
      <label className="mt-3 flex items-center gap-2 text-v2-small text-v2-text">
        <V2Checkbox
          checked={alsoNext}
          onChange={setAlsoNext}
          label={t("Keyingi oyga ham qo'llash")}
        />
        {t("Keyingi oyga ham qo'llash")}
      </label>
      <p className="mt-2 text-v2-caption text-v2-text-2">
        {t(
          "Reja joriy filial uchun saqlanadi. Yangi o'quvchi — admin lidi bo'lib, birinchi to'lovni shu oyda qilgan o'quvchi.",
        )}
      </p>
    </V2Dialog>
  );
}
