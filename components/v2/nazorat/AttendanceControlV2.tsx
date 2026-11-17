"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarDays, Download, Loader2, Phone } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, fieldCls } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, PageHead, PageShell, SearchBox, SimplePager, TH, downloadCsv } from "@/components/v2/students/lists/listKit";
import { ABSENCE_REASONS } from "@/lib/attendance";
import {
  ADMIN_EDIT_DAYS,
  DEFAULT_MARK_PENALTY,
  MARK_DEADLINE_MIN,
  type AcOverview,
  type AcRecord,
  type AcRecords,
  type AcStatus,
  type AcUnmarked,
} from "@/lib/attendanceControlTypes";

// YANGI VERSIYA — NAZORAT → «DAVOMAT NAZORATI» (34-qism, rasmlar «Davomat nazorati · Belgilanmagan darslar» va
// «… · Yozuvlar»). Tablar: Bugun (bugungi darslar va belgilanish holati), Yozuvlar (holat tabletkalari, kunlar
// bo'yicha grafik, sababli sabablari, filtrlar, jadval, «Sababli qilish»), Belgilanmagan darslar (ko'rsatkichlar,
// hisobotga kirmagan guruhlar, «Eslatma yuborish» / «Jarima yozish» / «Belgilash», kechikib belgilanganlar).
// Server: GET/POST /api/attendance-control (lib/attendanceControl.ts); «Sababli qilish» — POST
// /api/groups/:id/attendance (davomat tarixi, gamifikatsiya bilan bir xil yo'l).

type Tab = "bugun" | "yozuvlar" | "belgilanmagan";
const STATUSES: AcStatus[] = ["keldi", "kechikdi", "birinchi", "sababli", "sababsiz"];
const STATUS_LABEL: Record<AcStatus, string> = { keldi: "Keldi", kechikdi: "Kechikdi", birinchi: "Birinchi dars", sababli: "Sababli", sababsiz: "Sababsiz" };
const STATUS_DOT: Record<AcStatus, string> = { keldi: "bg-v2-success", kechikdi: "bg-v2-warning", birinchi: "bg-v2-info", sababli: "bg-v2-text-3", sababsiz: "bg-v2-danger" };
const STATUS_PILL: Record<AcStatus, string> = {
  keldi: "bg-v2-success-bg text-v2-success",
  kechikdi: "bg-v2-warning-bg text-v2-warning",
  birinchi: "bg-v2-info-bg text-v2-info",
  sababli: "bg-v2-surface-2 text-v2-text-2",
  sababsiz: "bg-v2-danger-bg text-v2-danger",
};
const som = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AttendanceControlV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>("belgilanmagan");
  const [range, setRange] = useState("month");
  const [branch, setBranch] = useState("all");
  const [ov, setOv] = useState<AcOverview | null>(null);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [pen, setPen] = useState<AcUnmarked | null>(null);

  const today = useMemo(() => isoOf(new Date()), []);
  const ranges = useMemo(() => {
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const pFirst = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const pLast = new Date(d.getFullYear(), d.getMonth(), 0);
    const w = new Date(d);
    w.setDate(d.getDate() - 6);
    return {
      month: { from: isoOf(first), to: today, label: `1–${d.getDate()}-${fmt.monthLower(today.slice(0, 7))}` },
      week: { from: isoOf(w), to: today, label: t("Oxirgi 7 kun") },
      prev: { from: isoOf(pFirst), to: isoOf(pLast), label: `${fmt.monthName(isoOf(pFirst).slice(0, 7))}` },
    } as Record<string, { from: string; to: string; label: string }>;
  }, [today, fmt, t]);
  const r = ranges[range] ?? ranges.month;
  const qs = `from=${r.from}&to=${r.to}${branch !== "all" ? `&branchId=${branch}` : ""}`;

  useEffect(() => {
    let off = false;
    void fetch(`/api/attendance-control?${qs}`, { cache: "no-store" })
      .then((x) => x.json())
      .then((j) => {
        if (off) return;
        if (j?.ok) {
          setOv(j);
          setErr("");
        } else setErr(String(j?.error || "Ma'lumot olinmadi"));
      })
      .catch(() => !off && setErr("Tarmoq xatosi"));
    return () => {
      off = true;
    };
  }, [qs, ver]);

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key);
    const res = await fetch("/api/attendance-control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      showError(t(res?.error || "Saqlab bo'lmadi"));
      return null;
    }
    setVer((v) => v + 1);
    return res;
  }

  async function remind(u: AcUnmarked) {
    const res = await act({ action: "remind", groupId: u.groupId, date: u.date }, `r${u.groupId}${u.date}`);
    if (!res) return;
    if (res.sent > 0) showSuccess(t("{name} ga eslatma yuborildi", { name: u.teacher }));
    else showError(t("Eslatma qayd etildi, lekin o'qituvchi xodimlar botiga ulanmagan"));
  }

  function exportCsv() {
    if (!ov) return;
    downloadCsv(
      `davomat-nazorati-${r.from}_${r.to}.csv`,
      [t("Turi"), t("Sana"), t("Guruh"), t("O'qituvchi"), t("Filial"), t("Holat")],
      [
        ...ov.unmarked.map((u) => [t("Belgilanmagan"), u.date, u.label, u.teacher, u.branchName, u.penalty ? t("Jarima yozilgan") : u.reminded ? t("Eslatma yuborilgan") : ""]),
        ...ov.late.map((l) => [t("Kechikib belgilangan"), l.date, l.label, l.teacher, "", `${l.delayMin} ${t("daq.")}`]),
      ],
    );
  }

  const head = (
    <PageHead
      title={t("Davomat nazorati")}
      subtitle={`${t("O'quvchilar davomati o'z vaqtida belgilanyaptimi va kim dars qoldiryapti")} · ${branch === "all" ? t("barcha filiallar") : (ov?.branches.find((b) => String(b.id) === branch)?.name ?? "")}`}
      actions={
        <>
          <div className="w-48">
            <V2Select label={t("Davr")} icon={CalendarDays} value={range} onChange={setRange} options={Object.entries(ranges).map(([k, v]) => ({ value: k, label: v.label }))} />
          </div>
          {(ov?.branches.length ?? 0) > 1 && (
            <div className="w-56">
              <V2Select
                variant="value"
                label={t("Filial")}
                value={branch}
                onChange={setBranch}
                options={[{ value: "all", label: t("Barchasi") }, ...(ov?.branches ?? []).map((b) => ({ value: String(b.id), label: b.name }))]}
              />
            </div>
          )}
          <button type="button" onClick={() => exportCsv()} disabled={!ov} className={`${secondaryBtn} disabled:opacity-50`}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            Excel
          </button>
        </>
      }
    />
  );

  const tabs: { key: Tab; label: string; badge: ReactNode }[] = [
    { key: "bugun", label: t("Bugun"), badge: ov && ov.today_.filter((x) => x.state === "overdue").length > 0 ? <Count n={ov.today_.filter((x) => x.state === "overdue").length} danger /> : null },
    { key: "yozuvlar", label: t("Yozuvlar"), badge: null },
    { key: "belgilanmagan", label: t("Belgilanmagan darslar"), badge: ov && ov.unmarked.length > 0 ? <Count n={ov.unmarked.length} danger /> : null },
  ];

  return (
    <PageShell flow>
      {head}
      <div role="tablist" aria-label={t("Davomat nazorati")} className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--v2-border)]">
        {tabs.map((x) => {
          const on = tab === x.key;
          return (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(x.key)}
              className={`relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-v2-body ${on ? "font-semibold text-v2-text" : "text-v2-text-2 hover:text-v2-text"}`}
            >
              {x.label}
              {x.badge}
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-v2-brand" aria-hidden />}
            </button>
          );
        })}
      </div>

      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!ov && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {ov && tab === "belgilanmagan" && (
        <UnmarkedTab ov={ov} rangeLabel={r.label} busy={busy} onRemind={(u) => void remind(u)} onPenalty={setPen} />
      )}
      {ov && tab === "bugun" && <TodayTab ov={ov} />}
      {tab === "yozuvlar" && <RecordsTab qs={qs} ver={ver} onChanged={() => setVer((v) => v + 1)} />}

      {pen && (
        <PenaltyDialog
          u={pen}
          onClose={() => setPen(null)}
          onSave={async (amount, note) => {
            const res = await act({ action: "penalty", groupId: pen.groupId, date: pen.date, amount, note }, `p${pen.groupId}${pen.date}`);
            if (res) showSuccess(t("{name}: {n} so'm jarima yozildi (Moliya → Jarima)", { name: pen.teacher, n: som(amount) }));
            return !!res;
          }}
        />
      )}
    </PageShell>
  );
}

function Count({ n, danger = false }: { n: number; danger?: boolean }) {
  return <span className={`rounded-full px-1.5 py-px text-v2-caption font-semibold tabular-nums ${danger ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-surface-2 text-v2-text-2"}`}>{n}</span>;
}

function Kpi({ dot, label, value, sub }: { dot: string; label: string; value: ReactNode; sub: string }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <span className="flex items-center gap-2 text-v2-small font-semibold text-v2-text-2">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        {label}
      </span>
      <b className="mt-1 block text-[28px] font-semibold tabular-nums text-v2-text">{value}</b>
      <span className="text-v2-small text-v2-text-2">{sub}</span>
    </div>
  );
}

function fanDot(course: string) {
  return <span className={`size-2.5 shrink-0 rounded-[3px] ${FAN_DOT[fanOf(course)]}`} aria-hidden />;
}

/* ── Belgilanmagan darslar ── */
function UnmarkedTab({ ov, rangeLabel, busy, onRemind, onPenalty }: { ov: AcOverview; rangeLabel: string; busy: string | null; onRemind: (u: AcUnmarked) => void; onPenalty: (u: AcUnmarked) => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const k = ov.kpi;
  const pct = k.lessons ? Math.round(((k.onTime / k.lessons) * 1000)) / 10 : 0;
  const passedText = (u: AcUnmarked) => {
    if (u.daysPassed === 0) {
      const h = Math.floor(u.passedMin / 60);
      const m = u.passedMin % 60;
      return h > 0 ? t("{h} soat {m} daqiqa o'tdi", { h, m }) : t("{m} daqiqa o'tdi", { m });
    }
    return t("{n} kun o'tdi", { n: u.daysPassed });
  };
  const subText = (u: AcUnmarked) =>
    u.penalty
      ? t("jarima {date}da yozildi", { date: fmt.dayMonth(u.penalty.date) })
      : u.daysPassed >= ADMIN_EDIT_DAYS
        ? t("muddat o'tdi — endi faqat direktor belgilaydi")
        : u.daysPassed === ADMIN_EDIT_DAYS - 1
          ? t("ertaga muddat tugaydi — keyin faqat direktor")
          : u.reminded
            ? t("o'qituvchiga eslatma {time} da ketdi", { time: new Date(u.reminded.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" }) })
            : t("admin {n} kungacha belgilay oladi", { n: ADMIN_EDIT_DAYS });

  const delayText = (min: number) => {
    if (min >= 24 * 60) return t("{n} soat", { n: Math.round(min / 60) });
    if (min >= 60) return t("{h} soat {m} daq.", { h: Math.floor(min / 60), m: min % 60 });
    return t("{m} daq.", { m: min });
  };

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi dot="bg-v2-danger" label={t("Belgilanmagan")} value={k.unmarked} sub={t("{n} darsdan · {range}", { n: k.lessons, range: rangeLabel })} />
        <Kpi dot="bg-v2-warning" label={t("Kechikib belgilangan")} value={k.late} sub={t("dars tugagach {n} daqiqadan keyin", { n: MARK_DEADLINE_MIN })} />
        <Kpi dot="bg-v2-success" label={t("O'z vaqtida")} value={k.onTime} sub={t("{p}% darslar", { p: String(pct).replace(".", ",") })} />
        <Kpi dot="bg-v2-text-3" label={t("Jarima yozilgan")} value={k.penalties} sub={k.penalties ? t("{n} so'm · oylikdan ushlanadi", { n: som(k.penaltySum) }) : t("bu davrda jarima yo'q")} />
      </section>

      {ov.excluded.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-v2-lg bg-v2-warning-bg px-4 py-3 text-v2-small text-v2-text">
          <AlertTriangle className="size-5 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1">
            <b className="font-semibold">{t("{n} ta guruh hisobotga kirmadi:", { n: ov.excluded.length })}</b>{" "}
            {ov.excluded
              .slice(0, 3)
              .map((g) => `«${g.label}» (${g.branchName})`)
              .join(", ")}
            {ov.excluded.length > 3 ? ` +${ov.excluded.length - 3}` : ""} — {t("boshlanish sanasi kiritilmagan, shuning uchun qaysi kunlari dars bo'lishi kerakligi noma'lum.")}
          </span>
          <Link href={`/groups/${ov.excluded[0].groupId}`} className="shrink-0 font-semibold text-v2-brand hover:underline">
            {t("Sanani kiritish")} →
          </Link>
        </div>
      )}

      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
          <h2 className="text-v2-h3 font-semibold text-v2-text">
            {t("Belgilanmagan darslar")} <span className="font-normal text-v2-text-3">· {ov.unmarked.length}</span>
          </h2>
          <span className="text-v2-small text-v2-text-2">{t("dars tugagach {m} daqiqa ichida belgilanishi kerak · {d} kundan keyin faqat direktor", { m: MARK_DEADLINE_MIN, d: ADMIN_EDIT_DAYS })}</span>
        </div>
        {ov.unmarked.length === 0 ? (
          <p className="border-t border-v2-border px-5 py-8 text-center text-v2-small text-v2-text-3">{t("Bu davrda belgilanmagan dars yo'q")}</p>
        ) : (
          ov.unmarked.map((u) => {
            const hot = u.daysPassed === 0;
            const red = hot || u.daysPassed >= ADMIN_EDIT_DAYS - 1;
            return (
              <div key={`${u.groupId}${u.date}`} className={`flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-v2-border px-5 py-3.5 ${hot ? "bg-v2-danger-bg" : ""}`}>
                <div className="w-28 shrink-0">
                  <div className="font-semibold text-v2-text">{fmt.dayMonth(u.date)}</div>
                  <div className="text-v2-small tabular-nums text-v2-text-2">{u.time.replace(/\s*-\s*/, "–")}</div>
                </div>
                <div className="min-w-[14rem] flex-1">
                  <div className="flex items-center gap-2 font-semibold text-v2-text">
                    {fanDot(u.course)}
                    {u.label}
                  </div>
                  <div className="text-v2-small text-v2-text-2">{[u.teacher, u.branchName, u.room ? (/^\d+$/.test(u.room) ? `${u.room}-xona` : u.room) : ""].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="min-w-[13rem]">
                  <div className={`font-semibold ${red ? "text-v2-danger" : "text-v2-warning"}`}>{passedText(u)}</div>
                  <div className="text-v2-small text-v2-text-2">{subText(u)}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {u.penalty ? (
                    <span className="inline-flex h-9 items-center rounded-v2-md bg-v2-surface-2 px-3 text-v2-small font-semibold text-v2-text-2">
                      {t("Jarima yozilgan · {n}", { n: som(u.penalty.amount) })}
                    </span>
                  ) : hot || !ov.isAdmin ? (
                    <button type="button" disabled={busy !== null} onClick={() => onRemind(u)} className={`${secondaryBtn} disabled:opacity-50`}>
                      {t("Eslatma yuborish")}
                    </button>
                  ) : (
                    <button type="button" disabled={busy !== null} onClick={() => onPenalty(u)} className={`${secondaryBtn} disabled:opacity-50`}>
                      {t("Jarima yozish")}
                    </button>
                  )}
                  <Link href={u.daysPassed === 0 ? `/groups/${u.groupId}` : `/groups/${u.groupId}?tab=jurnal`} className={primaryBtn}>
                    {t("Belgilash")}
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="px-5 py-4">
          <h2 className="text-v2-h3 font-semibold text-v2-text">
            {t("Kechikib belgilangan")} <span className="font-normal text-v2-text-3">· {ov.late.length}</span>
          </h2>
        </div>
        {ov.late.length === 0 ? (
          <p className="border-t border-v2-border px-5 py-6 text-center text-v2-small text-v2-text-3">{t("Kechikib belgilangan dars yo'q")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-v2-body">
              <thead>
                <tr className="border-y border-v2-border bg-v2-surface-2 text-left">
                  <th className={`${TH} pl-5`}>{t("Guruh")}</th>
                  <th className={TH}>{t("O'qituvchi")}</th>
                  <th className={TH}>{t("Dars tugadi")}</th>
                  <th className={TH}>{t("Belgilandi")}</th>
                  <th className={`${TH} text-right`}>{t("Kechikish")}</th>
                  <th className={`${TH} pr-5`}>{t("Kim belgiladi")}</th>
                </tr>
              </thead>
              <tbody>
                {ov.late.map((l) => (
                  <tr key={`${l.groupId}${l.date}`} className="border-b border-v2-border last:border-b-0">
                    <td className="py-3 pl-5 pr-3">
                      <span className="flex items-center gap-2 font-semibold text-v2-text">
                        {fanDot(l.course)}
                        {l.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-v2-text-2">{l.teacher}</td>
                    <td className="px-3 py-3 tabular-nums text-v2-text-2">
                      {fmt.dayMonth(l.date)} | {l.endTime}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-v2-text-2">
                      {fmt.dayMonth(l.markedDate)} | {l.markedTime}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-v2-warning">{delayText(l.delayMin)}</td>
                    <td className="py-3 pl-3 pr-5 text-v2-text-2">{l.self ? t("o'zi") : `${t("admin")} ${l.byName}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ── Bugun ── */
function TodayTab({ ov }: { ov: AcOverview }) {
  const { t } = useT();
  const STATE: Record<string, { label: string; cls: string }> = {
    done: { label: "Belgilangan", cls: "bg-v2-success-bg text-v2-success" },
    waiting: { label: "Dars davom etmoqda / hali boshlanmagan", cls: "bg-v2-surface-2 text-v2-text-2" },
    due: { label: "Belgilash vaqti", cls: "bg-v2-warning-bg text-v2-warning" },
    overdue: { label: "Muddat o'tdi", cls: "bg-v2-danger-bg text-v2-danger" },
  };
  const n = (s: string) => ov.today_.filter((x) => x.state === s).length;
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi dot="bg-v2-brand" label={t("Bugungi darslar")} value={ov.today_.length} sub={t("jadval bo'yicha")} />
        <Kpi dot="bg-v2-success" label={t("Belgilangan")} value={n("done")} sub={t("davomat kiritilgan")} />
        <Kpi dot="bg-v2-warning" label={t("Belgilash vaqti")} value={n("due")} sub={t("dars tugagach {n} daqiqa ichida", { n: MARK_DEADLINE_MIN })} />
        <Kpi dot="bg-v2-danger" label={t("Muddat o'tdi")} value={n("overdue")} sub={t("hali belgilanmagan")} />
      </section>
      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        {ov.today_.length === 0 ? (
          <p className="px-5 py-8 text-center text-v2-small text-v2-text-3">{t("Bugun jadvalda dars yo'q")}</p>
        ) : (
          <table className="w-full border-collapse text-v2-body">
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                <th className={`${TH} pl-5`}>{t("Vaqt")}</th>
                <th className={TH}>{t("Guruh")}</th>
                <th className={TH}>{t("O'qituvchi")}</th>
                <th className={TH}>{t("Belgilangan")}</th>
                <th className={`${TH} pr-5`}>{t("Holat")}</th>
              </tr>
            </thead>
            <tbody>
              {ov.today_.map((x) => (
                <tr key={x.groupId} className="border-b border-v2-border last:border-b-0">
                  <td className="py-3 pl-5 pr-3 tabular-nums text-v2-text">{x.time.replace(/\s*-\s*/, "–")}</td>
                  <td className="px-3 py-3">
                    <Link href={`/groups/${x.groupId}`} className="flex items-center gap-2 font-semibold text-v2-text hover:underline">
                      {fanDot(x.course)}
                      {x.label}
                    </Link>
                    <span className="text-v2-small text-v2-text-2">{[x.branchName, x.room ? (/^\d+$/.test(x.room) ? `${x.room}-xona` : x.room) : ""].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="px-3 py-3 text-v2-text-2">{x.teacher}</td>
                  <td className="px-3 py-3 tabular-nums text-v2-text-2">
                    {x.marked} / {x.members}
                    {x.markedAt ? ` · ${x.markedAt}` : ""}
                  </td>
                  <td className="py-3 pl-3 pr-5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-v2-small font-semibold ${STATE[x.state].cls}`}>{t(STATE[x.state].label)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ── Yozuvlar ── */
function RecordsTab({ qs, ver, onChanged }: { qs: string; ver: number; onChanged: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [statuses, setStatuses] = useState<AcStatus[]>(["kechikdi", "birinchi", "sababli", "sababsiz"]);
  const [q, setQ] = useState("");
  const [groupId, setGroupId] = useState("");
  const [teacher, setTeacher] = useState("");
  const [marker, setMarker] = useState("");
  const [reason, setReason] = useState("");
  const [active, setActive] = useState("1");
  const [most, setMost] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [data, setData] = useState<AcRecords | null>(null);
  const [excuse, setExcuse] = useState<AcRecord | null>(null);

  const url = `/api/attendance-control?part=records&${qs}&statuses=${statuses.join(",")}&q=${encodeURIComponent(q)}&groupId=${groupId}&teacher=${encodeURIComponent(teacher)}&marker=${encodeURIComponent(marker)}&reason=${encodeURIComponent(reason)}&active=${active}&sort=${most ? "absent" : ""}&page=${page}&size=${size}`;
  useEffect(() => {
    let off = false;
    const h = window.setTimeout(() => {
      void fetch(url, { cache: "no-store" })
        .then((x) => x.json())
        .then((j) => !off && j?.ok && setData(j));
    }, 200);
    return () => {
      off = true;
      window.clearTimeout(h);
    };
  }, [url, ver]);

  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };
  const toggle = (s: AcStatus) => {
    setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
    setPage(1);
  };

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  }
  const maxDay = Math.max(1, ...data.days.map((d) => d.kechikdi + d.birinchi + d.sababli + d.sababsiz));
  const sababliTotal = data.reasons.reduce((a, r) => a + r.count, 0);
  const maxReason = Math.max(1, ...data.reasons.map((r) => r.count));
  const SEG: { k: "kechikdi" | "birinchi" | "sababli" | "sababsiz"; cls: string }[] = [
    { k: "kechikdi", cls: "bg-v2-warning" },
    { k: "birinchi", cls: "bg-v2-info" },
    { k: "sababli", cls: "bg-v2-text-3" },
    { k: "sababsiz", cls: "bg-v2-danger" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => {
          const on = statuses.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s)}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-v2-small font-semibold transition-colors ${on ? "border-v2-brand bg-v2-brand-bg text-v2-text" : "border-v2-border text-v2-text-2 hover:bg-v2-hover"}`}
            >
              <span className={`size-2.5 rounded-[3px] ${STATUS_DOT[s]}`} aria-hidden />
              {t(STATUS_LABEL[s])} <span className="tabular-nums text-v2-text-2">{data.counts[s]}</span>
            </button>
          );
        })}
        <span className="ml-auto text-v2-small text-v2-text-2">
          <b className="font-semibold text-v2-text">{data.total}</b> {t("ta yozuv")}
          {!statuses.includes("keldi") ? ` · ${t("«Keldi» dan boshqalari")}` : ""}
        </span>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-v2-h3 font-semibold text-v2-text">
              {t("Kunlar bo'yicha")} <span className="font-normal text-v2-text-2">· {t("tanlangan holatlar")}</span>
            </h2>
            <span className="text-v2-small text-v2-text-3">{t("ustun ustida — yozuvlar soni, pastda — kunlik davomat")}</span>
          </div>
          {data.days.length === 0 ? (
            <p className="py-8 text-center text-v2-small text-v2-text-3">{t("Bu davrda davomat yozuvi yo'q")}</p>
          ) : (
            <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-1">
              {data.days.map((d) => {
                const sum = d.kechikdi + d.birinchi + d.sababli + d.sababsiz;
                return (
                  <div key={d.date} className="flex min-w-[2.75rem] flex-1 flex-col items-center">
                    <span className="mb-1 text-v2-caption tabular-nums text-v2-text-2">{sum || ""}</span>
                    <div className="flex h-40 w-8 flex-col-reverse overflow-hidden rounded-t-[4px]">
                      {SEG.map((s) => (d[s.k] > 0 ? <span key={s.k} className={s.cls} style={{ height: `${(d[s.k] / maxDay) * 100}%` }} /> : null))}
                    </div>
                    <span className="mt-2 text-v2-caption font-semibold tabular-nums text-v2-text">{Number(d.date.slice(8, 10))}</span>
                    <span className="text-v2-caption text-v2-text-3">{fmt.weekday(d.date).charAt(0).toUpperCase() + fmt.weekday(d.date).slice(1, 2)}</span>
                    <span className={`text-v2-caption font-semibold tabular-nums ${d.pct < 88 ? "text-v2-warning" : "text-v2-text-2"}`}>{d.pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-v2-small text-v2-text-2">
            {SEG.map((s) => (
              <span key={s.k} className="inline-flex items-center gap-1.5">
                <span className={`size-2.5 rounded-[3px] ${s.cls}`} aria-hidden />
                {t(STATUS_LABEL[s.k])}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
          <h2 className="text-v2-h3 font-semibold text-v2-text">
            {t("Sababli")} · {sababliTotal} <span className="font-normal text-v2-text-2">{t("qaysi sabab bilan")}</span>
          </h2>
          <div className="mt-3 space-y-3">
            {data.reasons.length === 0 && <p className="text-v2-small text-v2-text-3">{t("Sababli yozuv yo'q")}</p>}
            {data.reasons.map((r) => (
              <div key={r.reason}>
                <div className="flex justify-between text-v2-body">
                  <span className="text-v2-text">{t(r.reason)}</span>
                  <b className="font-semibold tabular-nums text-v2-text">{r.count}</b>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
                  <div className="h-full rounded-full bg-v2-text-2" style={{ width: `${(r.count / maxReason) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          {data.streakPupils > 0 && (
            <div className="mt-4 flex gap-2.5 rounded-v2-md bg-v2-danger-bg px-3 py-2.5 text-v2-small text-v2-text">
              <Phone className="mt-0.5 size-4 shrink-0 text-v2-danger" strokeWidth={1.75} aria-hidden />
              <span>
                <b className="font-semibold">{t("{n} o'quvchi", { n: data.streakPupils })}</b> {t("ketma-ket 2+ dars sababsiz qoldirdi — ota-onasiga qo'ng'iroq")}
              </span>
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={reset(setQ)} placeholder={t("O'quvchi ismi")} />
        <V2Select variant="chip" label={t("Guruh")} value={groupId} onChange={reset(setGroupId)} searchable="auto" options={data.groups.map((g) => ({ value: String(g.id), label: g.label }))} />
        <V2Select variant="chip" label={t("O'qituvchi")} value={teacher} onChange={reset(setTeacher)} searchable="auto" options={data.teachers.map((x) => ({ value: x, label: x }))} />
        <V2Select variant="chip" label={t("Belgilagan")} value={marker} onChange={reset(setMarker)} options={data.markers.map((x) => ({ value: x, label: x }))} />
        <V2Select variant="chip" label={t("Sabab")} value={reason} onChange={reset(setReason)} options={ABSENCE_REASONS.map((x) => ({ value: x, label: t(x) }))} />
        <div className="w-44">
          <V2Select variant="value" label={t("O'quvchi")} value={active} onChange={reset(setActive)} options={[{ value: "1", label: t("Aktiv") }, { value: "0", label: t("Hammasi") }]} />
        </div>
        <label className="ml-auto inline-flex h-10 items-center gap-2 rounded-v2-md border border-v2-border px-3 text-v2-small text-v2-text">
          <V2Checkbox
            checked={most}
            onChange={(v) => {
              setMost(v);
              setPage(1);
            }}
            label={t("Eng ko'p qoldirganlar")}
          />
          {t("Eng ko'p qoldirganlar")}
        </label>
      </div>

      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-v2-body">
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                <th className={`${TH} pl-5`}>{t("O'quvchi")}</th>
                <th className={TH}>{t("Guruh · o'qituvchi")}</th>
                <th className={TH}>{t("Dars")}</th>
                <th className={TH}>{t("Holat")}</th>
                <th className={TH}>{t("Sabab · izoh")}</th>
                <th className={TH}>{t("Belgiladi")}</th>
                <th className={`${TH} pr-5`} aria-label={t("Amallar")} />
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                    {t("Mos yozuv topilmadi")}
                  </td>
                </tr>
              )}
              {data.rows.map((r) => (
                <tr key={r.key} className="border-b border-v2-border last:border-b-0 hover:bg-v2-hover">
                  <td className="py-3 pl-5 pr-3">
                    <Link href={`/student-edit/${r.pupilId}`} className="font-semibold text-v2-text hover:underline">
                      {r.pupilName}
                    </Link>
                    {r.streak >= 2 && <div className="text-v2-small font-semibold text-v2-danger">{t("ketma-ket {n} dars", { n: r.streak })}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2 text-v2-text">
                      {fanDot(r.course)}
                      {r.groupLabel}
                    </span>
                    <span className="text-v2-small text-v2-text-2">{r.teacher}</span>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-v2-text-2">
                    {fmt.dayMonth(r.date)}
                    {r.time ? ` | ${r.time}` : ""}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-v2-small font-semibold ${STATUS_PILL[r.status]}`}>{t(STATUS_LABEL[r.status])}</span>
                  </td>
                  <td className="px-3 py-3 text-v2-text">
                    {r.reason ? t(r.reason) : r.status === "sababsiz" || r.status === "sababli" ? "—" : ""}
                    {r.note && <div className="text-v2-small text-v2-text-2">{r.note}</div>}
                  </td>
                  <td className="px-3 py-3 text-v2-small text-v2-text-2">{[r.byName, r.byAt].filter(Boolean).join(" · ")}</td>
                  <td className="py-3 pl-2 pr-5 text-right">
                    {r.status === "sababsiz" && (
                      <button type="button" onClick={() => setExcuse(r)} className={`${secondaryBtn} h-8`}>
                        {t("Sababli qilish")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SimplePager
          total={data.total}
          page={page}
          pageSize={size}
          onPage={setPage}
          onPageSize={(n) => {
            setSize(n);
            setPage(1);
          }}
          note={t("Sababni dars kunidan {n} kun ichida admin o'zgartira oladi — keyin faqat direktor", { n: ADMIN_EDIT_DAYS })}
        />
      </section>

      {excuse && (
        <ExcuseDialog
          r={excuse}
          onClose={() => setExcuse(null)}
          onDone={() => {
            setExcuse(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function ExcuseDialog({ r, onClose, onDone }: { r: AcRecord; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [reason, setReason] = useState<string>(ABSENCE_REASONS[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(close: () => void) {
    setSaving(true);
    const res = await fetch(`/api/groups/${r.groupId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pupilId: r.pupilId, date: r.date, status: "sababli", reason, note: note.trim() || null }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(t("{name}: «Sababli» qilindi", { name: r.pupilName }));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("Sababli qilish")}
      subtitle={`${r.pupilName} · ${r.groupLabel} · ${fmt.dayMonth(r.date)}`}
      onClose={onClose}
      saving={saving}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Sabab")}>
          <V2Select label={t("Sabab")} value={reason} onChange={setReason} options={ABSENCE_REASONS.map((x) => ({ value: x, label: t(x) }))} />
        </Field>
        <Field label={t("Izoh")} optional>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={fieldCls("default", "h-auto! py-2 leading-5")} />
        </Field>
      </div>
    </V2Dialog>
  );
}

function PenaltyDialog({ u, onClose, onSave }: { u: AcUnmarked; onClose: () => void; onSave: (amount: number, note: string) => Promise<boolean> }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [amount, setAmount] = useState(String(DEFAULT_MARK_PENALTY));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const n = Number(amount.replace(/\D/g, "")) || 0;
  return (
    <V2Dialog
      title={t("Jarima yozish")}
      subtitle={`${u.teacher} · ${u.label} · ${fmt.dayMonth(u.date)}`}
      onClose={onClose}
      saving={saving}
      width={480}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button
            type="button"
            disabled={saving || n <= 0}
            onClick={async () => {
              setSaving(true);
              const ok = await onSave(n, note);
              setSaving(false);
              if (ok) api.close();
            }}
            className={`${primaryBtn} disabled:opacity-50`}
          >
            {t("Jarima yozish · {n} so'm", { n: som(n) })}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Summa")} hint={t("Moliya → Jarima ro'yxatiga tushadi va oylikdan ushlanadi")}>
          <input value={n ? som(n) : ""} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={fieldCls("default", "tabular-nums")} />
        </Field>
        <Field label={t("Izoh")} optional>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t("Davomat belgilanmadi: {group}", { group: u.label })} className={fieldCls("default", "h-auto! py-2 leading-5")} />
        </Field>
      </div>
    </V2Dialog>
  );
}
