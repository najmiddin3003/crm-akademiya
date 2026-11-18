"use client";

import { useState } from "react";
import { Clock, Info, Plus } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import StudentSearchField from "@/components/v2/form/StudentSearchField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, MoneyField, Segmented, fieldCls } from "@/components/v2/form/fields";
import V2MonthNav from "@/components/v2/ui/V2MonthNav";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { ReportDef } from "@/lib/reportsCatalog";
import { APPROVAL_PERCENT, APPROVAL_SUM, EXCEPTION_LABELS, EXCEPTION_TYPES, type ExceptionRow, type ExceptionType, type ExceptionsReport } from "@/lib/priceExceptionTypes";
import type { ExceptionPrefill } from "@/lib/priceExceptions";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { fileSafe, fmtNum } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { Meter } from "./report35";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, type TableCol } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → «CHEGIRMA VA ISTISNOLAR» (35-qism, rasmlar «Chegirma va istisnolar», «Qarzni
// kechirish so'rovi»). Oy, Filial, «Kim ruxsat bergan»; o'ngda jami va hisoblangan to'lovlardan ulushi.
// 4 ko'rsatkich (Chegirmalar, Alohida narx, Kechirilgan qarz, Bekor qilingan dars haqi); `warning-bg` banner —
// direktor tasdig'ini kutayotganlar («Ko'rib chiqish»); «Kim ruxsat bergan» qatori; turlar tablari va jadval
// (O'quvchi, Turi, Farq, Sabab, Kim · qachon, Holat). «+ Imtiyoz» oynasi va tasdiqlash oynasi.
// Server: /api/reports/exceptions (lib/priceExceptions.ts).

type Resp = ExceptionsReport & { branch: "all" | number };
const TYPE_PILL: Record<ExceptionType, string> = {
  chegirma: "bg-v2-violet-bg text-v2-violet",
  narx: "bg-v2-info-bg text-v2-info",
  qarz: "bg-v2-danger-bg text-v2-danger",
  dars: "bg-v2-surface-2 text-v2-text-2",
};
const STATUS_PILL: Record<ExceptionRow["status"], string> = {
  pending: "bg-v2-warning-bg text-v2-warning",
  active: "bg-v2-success-bg text-v2-success",
  open: "bg-v2-warning-bg text-v2-warning",
  done: "bg-v2-surface-2 text-v2-text-2",
  approved: "bg-v2-success-bg text-v2-success",
  rejected: "bg-v2-danger-bg text-v2-danger",
  coin: "bg-v2-violet-bg text-v2-violet",
};

export default function ChegirmalarReport({ report, author }: { report: ReportDef; author: string }) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const cur = today.slice(0, 7);
  const branchOptions = useBranchOptions();
  const [month, setMonth] = useState(cur);
  const [branch, setBranch] = useState("");
  const [by, setBy] = useState("");
  const [tab, setTab] = useState<"all" | ExceptionType>("all");
  const [add, setAdd] = useState(false);
  const [review, setReview] = useState<number | null>(null);
  const url = `/api/reports/exceptions?${new URLSearchParams({ month, ...(branch ? { branch } : {}), ...(by ? { by } : {}) })}`;
  const { data, loading, stale, error, reload } = useReportData<Resp>(url);
  const branchName = branch ? (branchOptions.find((b) => b.value === branch)?.label ?? "") : t("Barcha filiallar");
  const rows = (data?.rows ?? []).filter((r) => tab === "all" || r.type === tab);
  const k = data?.kpi;
  const reviewing = data?.pending.find((p) => p.id === review) ?? null;

  const cols: TableCol<ExceptionRow>[] = [
    { key: "p", label: t("O'quvchi"), render: (r) => (<><div className="font-semibold text-v2-text">{r.pupilName}</div><div className="text-v2-caption text-v2-text-2">{[r.groupLabel, r.branch].filter(Boolean).join(" · ")}</div></>) },
    { key: "t", label: t("Turi"), render: (r) => <span className={`inline-flex rounded-full px-2 py-0.5 text-v2-small font-semibold ${TYPE_PILL[r.type]}`}>{t(EXCEPTION_LABELS[r.type])}</span> },
    { key: "a", label: t("Farq"), align: "right", render: (r) => (<><div className="font-semibold tabular-nums text-v2-text">−{fmtNum(r.monthAmount)}</div><div className="text-v2-caption text-v2-text-2">{t(r.amountLabel)}</div></>) },
    { key: "r", label: t("Sabab"), render: (r) => (<><div className="text-v2-text">{t(r.reason)}</div><div className="text-v2-caption text-v2-text-2">{t(r.reasonSub)}</div></>) },
    { key: "w", label: t("Kim · qachon"), render: (r) => (<><div className="text-v2-text">{r.who}</div><div className="text-v2-caption text-v2-text-2">{r.at ? `${f.dayMonth(r.at.slice(0, 10))} | ${r.at.slice(11, 16)}` : ""}</div></>) },
    {
      key: "s",
      label: t("Holat"),
      render: (r) =>
        r.status === "pending" && data?.canApprove && r.id ? (
          <button type="button" onClick={() => setReview(r.id)} className={`inline-flex rounded-full px-2 py-0.5 text-v2-small font-semibold ${STATUS_PILL[r.status]} underline-offset-2 hover:underline`}>
            {t(r.statusLabel)}
          </button>
        ) : (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-v2-small font-semibold ${STATUS_PILL[r.status]}`}>{r.status === "active" && r.until ? t("Faol · {m}gacha", { m: f.monthLower(r.until) }) : t(r.statusLabel)}</span>
        ),
    },
  ];

  function getDoc(): ExportDoc | null {
    if (!data || !k) return null;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${month}`,
      center: t(CENTER_NAME),
      branchLabel: branchName,
      dateLabel: f.fullDate(today),
      author,
      filters: [f.monthTitle(month), branchName, by || t("Hamma ruxsat berganlar")].join(" · "),
      kpis: EXCEPTION_TYPES.map((x) => ({ label: t(EXCEPTION_LABELS[x]), value: `−${fmtNum(k[x].sum)} · ${k[x].pupils}` })),
      sections: [
        {
          columns: [{ label: t("O'quvchi") }, { label: t("Guruh") }, { label: t("Turi") }, { label: t("Farq"), numeric: true }, { label: t("Sabab") }, { label: t("Kim") }, { label: t("Sana") }, { label: t("Holat") }],
          rows: rows.map((r) => [r.pupilName, r.groupLabel, t(EXCEPTION_LABELS[r.type]), r.monthAmount, t(r.reason), r.who, r.at.slice(0, 10), t(r.statusLabel)]),
        },
      ],
      footer: DOC_FOOTER,
    };
  }

  return (
    <ReportShell
      report={report}
      subtitle={`${t(report.subtitle)} · ${branchName.toLowerCase()}`}
      getDoc={getDoc}
      exportReady={!!data && !stale}
      filters={
        <>
          <V2MonthNav value={month} onChange={setMonth} current={cur} />
          <V2Select variant="value" label={t("Filial")} emptyLabel="Barchasi" value={branch} onChange={setBranch} options={branchOptions} searchable={false} />
          <V2Select variant="value" label={t("Kim ruxsat bergan")} emptyLabel="Hammasi" value={by} onChange={setBy} options={(data?.givers ?? []).map((g) => ({ value: g.who, label: g.who }))} />
          <button type="button" onClick={() => setAdd(true)} className={`${secondaryBtn} h-9`}>
            <Plus className="size-4" aria-hidden /> {t("Imtiyoz")}
          </button>
        </>
      }
      filtersEnd={
        data && (
          <span className="text-v2-small text-v2-text-2">
            {t("Jami")} <b className="text-v2-text">−{fmtNum(data.total)} {t("so'm")}</b> · {t("hisoblangan to'lovlarning {p}%", { p: data.revenue ? (Math.round((data.total / data.revenue) * 1000) / 10).toLocaleString("ru-RU") : 0 })}
          </span>
        )
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}
      <div className={stale ? "opacity-60" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            { key: "c", label: t("Chegirmalar"), value: k ? `−${fmtNum(k.chegirma.sum)}` : null, unit: k ? t("{n} o'quvchi", { n: k.chegirma.pupils }) : undefined, sub: t("sertifikat, aka-uka, tanga chegirmasi") },
            { key: "n", label: t("Alohida narx"), value: k ? `−${fmtNum(k.narx.sum)}` : null, unit: k ? t("{n} o'quvchi", { n: k.narx.pupils }) : undefined, sub: t("kurs narxidan farqli to'lov") },
            { key: "q", label: t("Kechirilgan qarz"), value: k ? `−${fmtNum(k.qarz.sum)}` : null, unit: k ? t("{n} o'quvchi", { n: k.qarz.pupils }) : undefined, sub: t("guruhdan ketganlar qarzi") },
            { key: "d", label: t("Bekor qilingan dars haqi"), value: k ? `−${fmtNum(k.dars.sum)}` : null, unit: k ? t("{n} ta", { n: k.dars.count }) : undefined, sub: t("sababli qoldirilgan darslar") },
          ]}
        />
      </div>

      {data && data.pending.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-v2-lg border border-v2-warning/40 bg-v2-warning-bg px-4 py-3">
          <Clock className="size-5 text-v2-warning" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-v2-text">{t("{n} ta imtiyoz direktor tasdig'ini kutmoqda", { n: data.pending.length })}</div>
            <div className="text-v2-small text-v2-text-2">
              {data.pending.map((p) => `${p.pupilName} — ${fmtNum(p.amount)} (${t(EXCEPTION_LABELS[p.type]).toLowerCase()})`).join(", ")}.{" "}
              {t("Qoida: {p}% dan ortiq yoki {s} so'mdan katta imtiyoz tasdiqsiz kuchga kirmaydi.", { p: data.limits.percent, s: fmtNum(data.limits.sum) })}
            </div>
          </div>
          {data.canApprove && (
            <button type="button" onClick={() => setReview(data.pending[0].id)} className={primaryBtn}>
              {t("Ko'rib chiqish")}
            </button>
          )}
        </section>
      )}

      {data && data.givers.length > 0 && (
        <section className="overflow-x-auto rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className="flex min-w-max divide-x divide-v2-border">
            <div className="flex w-44 shrink-0 flex-col justify-center bg-v2-surface-2 px-4 py-3">
              <div className="font-semibold text-v2-text">{t("Kim ruxsat bergan")}</div>
              <div className="text-v2-caption text-v2-text-2">{t("{m} · {n} ta", { m: f.monthLower(month), n: data.givers.reduce((a, g) => a + g.count, 0) })}</div>
            </div>
            {data.givers.map((g) => (
              <button key={g.who} type="button" onClick={() => setBy(by === g.who ? "" : g.who)} className={`w-64 px-4 py-3 text-left hover:bg-v2-hover ${by === g.who ? "bg-v2-brand-bg" : ""}`}>
                <div className="truncate font-semibold text-v2-text">{g.who}</div>
                <div className="flex justify-between gap-2 whitespace-nowrap text-v2-caption text-v2-text-2">
                  <span className="truncate">{t("{n} ta · {b}", { n: g.count, b: g.branch })}</span>
                  <b className="text-v2-text">−{fmtNum(g.sum)}</b>
                </div>
                <Meter pct={(g.sum / Math.max(1, data.givers[0].sum)) * 100} tone="bg-v2-warning" />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex flex-wrap rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
          {(["all", ...EXCEPTION_TYPES] as ("all" | ExceptionType)[]).map((x) => (
            <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={`h-8 rounded-[6px] px-3 text-v2-small font-semibold ${tab === x ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
              {x === "all" ? t("Hammasi · {n}", { n: data?.rows.length ?? 0 }) : `${t(EXCEPTION_LABELS[x])} · ${data?.rows.filter((r) => r.type === x).length ?? 0}`}
            </button>
          ))}
        </div>
        <span className="text-v2-small text-v2-text-2">{t("yangisi tepada")}</span>
      </div>
      <div className={stale ? "opacity-60" : ""}>
        <ReportTable cols={cols} rows={rows} rowKey={(r) => r.key} loading={loading} empty={t("Bu oyda imtiyoz yo'q — «+ Imtiyoz» bilan qo'shing")} minWidth={1000} />
      </div>
      <NoteLine>{t("Har bir imtiyozda sabab va kim ruxsat bergani majburiy. Tasdiqlangan imtiyoz qarzdorlar hisobida to'langan hisoblanadi (tanga chegirmasi kabi).")}</NoteLine>

      {add && <AddDialog limits={data?.limits ?? { percent: APPROVAL_PERCENT, sum: APPROVAL_SUM }} onClose={() => setAdd(false)} onDone={reload} />}
      {reviewing && <ReviewDialog e={reviewing} onClose={() => setReview(null)} onDone={reload} />}
    </ReportShell>
  );
}

async function post(body: Record<string, unknown>) {
  return fetch("/api/reports/exceptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch(() => null);
}

function nextMonths(n: number): string[] {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
}

function AddDialog({ limits, onClose, onDone }: { limits: { percent: number; sum: number }; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const f = useReportFmt();
  const { showSuccess, showError } = useToast();
  const [pre, setPre] = useState<ExceptionPrefill | null>(null);
  const [type, setType] = useState<ExceptionType>("chegirma");
  const [groupId, setGroupId] = useState("");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [lessons, setLessons] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const g = pre?.groups.find((x) => String(x.id) === groupId) ?? null;
  const est = type === "chegirma" ? (percent && g?.price ? Math.round((g.price * Number(percent)) / 100) : Number(amount) || 0) : type === "narx" ? (g?.price && price ? g.price - Number(price) : 0) : type === "dars" ? (g?.lessonPrice ?? 0) * (Number(lessons) || 0) : Number(amount) || 0;
  const big = est >= limits.sum || (g?.price ? (est / g.price) * 100 >= limits.percent : false);

  async function pick(id: number) {
    const r = (await fetch(`/api/reports/exceptions?prefill=${id}`)
      .then((x) => x.json())
      .catch(() => null)) as ExceptionPrefill | null;
    if (!r?.ok) return showError(t("O'quvchi topilmadi"));
    setPre(r);
    setGroupId(r.groups[0] ? String(r.groups[0].id) : "");
  }
  async function save(close: () => void) {
    if (!pre) return;
    setSaving(true);
    const r = await post({ action: "create", type, pupilId: pre.pupil.id, groupId: Number(groupId) || null, percent: Number(percent) || null, amount: Number(amount) || 0, price: Number(price) || 0, lessons: Number(lessons) || 0, to: toMonth || null, reason, note });
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(r.exception.status === "pending" ? t("Direktor tasdig'iga yuborildi") : t("Imtiyoz yozildi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("Imtiyoz qo'shish")}
      subtitle={t("chegirma, alohida narx, kechirilgan qarz yoki dars haqi")}
      onClose={onClose}
      saving={saving}
      dirty={!!pre}
      width={560}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving || !pre || !reason.trim()} className={`${primaryBtn} disabled:opacity-50`}>
            {big ? t("Tasdiqqa yuborish") : t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("O'quvchi")}>
          {pre ? (
            <div className="flex items-center justify-between rounded-v2-md border border-v2-border-strong px-3 py-2">
              <span className="font-semibold text-v2-text">{pre.pupil.name}</span>
              <button type="button" onClick={() => setPre(null)} className="text-v2-small font-semibold text-v2-brand">
                {t("O'zgartirish")}
              </button>
            </div>
          ) : (
            <StudentSearchField onPick={(s) => void pick(s.id)} placeholder={t("Ism yoki telefon")} />
          )}
        </Field>
        {pre && (
          <>
            <Field label={t("Turi")}>
              <Segmented label={t("Turi")} value={type} onChange={(v) => setType(v as ExceptionType)} options={EXCEPTION_TYPES.map((x) => ({ value: x, label: t(EXCEPTION_LABELS[x]) }))} />
            </Field>
            <Field label={t("Guruh")}>
              <V2Select label={t("Guruh")} value={groupId} onChange={setGroupId} placeholder={t("Tanlang")} options={pre.groups.map((x) => ({ value: String(x.id), label: `${x.label}${x.price ? ` · ${fmtNum(x.price)}` : ""}` }))} />
            </Field>
            {type === "chegirma" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("Foiz")} optional>
                  <input value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={fieldCls()} placeholder="15" />
                </Field>
                <Field label={t("yoki summa, oyiga")} optional>
                  <MoneyField value={amount} onChange={setAmount} />
                </Field>
              </div>
            )}
            {type === "narx" && (
              <Field label={t("Kelishilgan oylik narx")}>
                <MoneyField value={price} onChange={setPrice} />
              </Field>
            )}
            {type === "dars" && (
              <Field label={t("Bekor qilingan darslar soni")}>
                <input value={lessons} onChange={(e) => setLessons(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={fieldCls()} />
              </Field>
            )}
            {type === "qarz" && (
              <Field label={t("Kechiriladigan summa")}>
                <MoneyField value={amount} onChange={setAmount} />
              </Field>
            )}
            {(type === "chegirma" || type === "narx") && (
              <Field label={t("Qaysi oygacha")} optional>
                <V2Select label={t("Qaysi oygacha")} value={toMonth} onChange={setToMonth} clearable placeholder={t("Muddatsiz")} options={nextMonths(12).map((m) => ({ value: m, label: f.monthTitle(m) }))} />
              </Field>
            )}
            <Field label={t("Sabab")}>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className={fieldCls()} placeholder={t("Masalan: Rag'bat sertifikati, aka-uka chegirmasi")} />
            </Field>
            <Field label={t("Izoh")} optional>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={fieldCls("default", "h-auto! py-2 leading-5")} />
            </Field>
            <p className={`flex items-start gap-2 rounded-v2-md px-3 py-2.5 text-v2-small ${big ? "bg-v2-warning-bg text-v2-text" : "bg-v2-info-bg text-v2-text"}`}>
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("Imtiyoz: {n} so'm", { n: fmtNum(est) })}
              {type === "chegirma" || type === "narx" ? ` ${t("oyiga")}` : ""}.{" "}
              {big ? t("{p}% yoki {s} so'mdan katta — direktor tasdiqlagach kuchga kiradi.", { p: limits.percent, s: fmtNum(limits.sum) }) : t("Darhol kuchga kiradi va qarzdan ayiriladi.")}
            </p>
          </>
        )}
      </div>
    </V2Dialog>
  );
}

function ReviewDialog({ e, onClose, onDone }: { e: ExceptionsReport["pending"][number]; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const f = useReportFmt();
  const { showSuccess, showError } = useToast();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  async function decide(approve: boolean, close: () => void) {
    setSaving(true);
    const r = await post({ action: "decide", id: e.id, approve, note });
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(approve ? t("Tasdiqlandi") : t("Rad etildi"));
    close();
    onDone();
  }
  const title = { chegirma: "Chegirma so'rovi", narx: "Alohida narx so'rovi", qarz: "Qarzni kechirish so'rovi", dars: "Dars haqini bekor qilish so'rovi" }[e.type];
  return (
    <V2Dialog
      title={t(title)}
      subtitle={`${t("{who} yubordi", { who: e.createdBy })} · ${f.dayMonth(e.createdAt.slice(0, 10))} | ${e.createdAt.slice(11, 16)} · ${e.branch}`}
      onClose={onClose}
      saving={saving}
      width={520}
      footerStart={
        <button type="button" onClick={onClose} className="text-v2-small font-semibold text-v2-text-2">
          {t("Bekor qilish")}
        </button>
      }
      footer={(api) => (
        <>
          <button type="button" onClick={() => void decide(false, api.close)} disabled={saving || !note.trim()} className="inline-flex h-10 items-center rounded-v2-md border border-v2-danger px-4 font-semibold text-v2-danger disabled:opacity-50">
            {t("Rad etish")}
          </button>
          <button type="button" onClick={() => void decide(true, api.close)} disabled={saving} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Tasdiqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-v2-text">{e.pupilName}</div>
            <div className="text-v2-small text-v2-text-2">{e.groupLabel}</div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-v2-small font-semibold ${TYPE_PILL[e.type]}`}>{t(EXCEPTION_LABELS[e.type])}</span>
        </div>
        <dl className="divide-y divide-v2-border rounded-v2-md border border-v2-border bg-v2-surface-2 text-v2-small">
          {e.basePrice !== null && (
            <div className="flex justify-between px-3 py-2">
              <dt className="text-v2-text-2">{t("Guruh oylik narxi")}</dt>
              <dd className="font-semibold text-v2-text">{fmtNum(e.basePrice)}</dd>
            </div>
          )}
          {e.lessons !== null && (
            <div className="flex justify-between px-3 py-2">
              <dt className="text-v2-text-2">{t("Darslar")}</dt>
              <dd className="font-semibold text-v2-text">{e.lessons}</dd>
            </div>
          )}
          <div className="flex justify-between px-3 py-2">
            <dt className="font-semibold text-v2-text">{e.monthly ? t("Imtiyoz, oyiga") : t("Imtiyoz summasi")}</dt>
            <dd className="text-[16px] font-semibold text-v2-text">{fmtNum(e.amount)} {t("so'm")}</dd>
          </div>
        </dl>
        <div>
          <div className="mb-1 text-v2-small font-semibold text-v2-text">{t("Sabab va izoh")}</div>
          <p className="rounded-v2-md bg-v2-surface-2 px-3 py-2 text-v2-body text-v2-text">{[e.reason, e.note].filter(Boolean).join(" — ")}</p>
        </div>
        <p className="flex items-start gap-2 text-v2-small text-v2-text-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("{who} bu oyda {n} ta imtiyoz yozgan — jami {s} so'm.", { who: e.createdBy, n: e.givenBy.count, s: fmtNum(e.givenBy.sum) })}
        </p>
        <Field label={t("Izoh")} optional>
          <textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={2} className={fieldCls("default", "h-auto! py-2 leading-5")} placeholder={t("Masalan: yarmini to'lash taklif qilinsin")} />
        </Field>
      </div>
    </V2Dialog>
  );
}
