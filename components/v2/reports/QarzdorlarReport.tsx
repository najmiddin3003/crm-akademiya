"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronDown, CircleAlert, MessageSquare, TriangleAlert, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useBranch } from "@/components/shared/BranchContext";
import { useT } from "@/components/shared/Language";
import SmsModal from "@/components/orders/SmsModal";
import StudentPaymentModalV2 from "@/components/v2/finance/StudentPaymentModalV2";
import V2DateField from "@/components/v2/form/V2DateField";
import { Segmented } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { panelTriggerCls } from "@/components/v2/ui/buttons";
import type { DebtorRow, DebtorsReport } from "@/lib/debtorsTypes";
import type { ReportDef } from "@/lib/reportsCatalog";
import type { StudentRow } from "@/lib/studentsData";
import { CENTER_NAME, DOC_FOOTER, useBranchOptions, useReportData, useReportFmt, useToday } from "./reportHooks";
import { dateOfIso, fileSafe, fmtNum, fmtPhone, initialsOf, isoOf } from "./reportFormat";
import type { ExportDoc } from "./reportExport";
import { ErrorBanner, KpiStrip, NoteLine, ReportShell, ReportTable, type TableCol } from "./reportUi";

// YANGI VERSIYA — HISOBOTLAR → «QARZDORLAR» (rasmlar «Qarzdorlar · namuna», «Qarzdorlar → PDF»,
// yorug'/qorong'i, 25.10.2026): «12-oktabr holatiga», Filial, Guruh, o'ngda Hammasi / 1 oy /
// 2+ oy; Jami qarz · Qarzdorlar · 2 oy va undan ko'p; jadval: O'quvchi (bosh harflar),
// Guruh, Qaysi oylar uchun (+ «3 oy»), Qarz, Oxirgi to'lov, Ota-ona telefoni, amallar (SMS,
// to'lov). Hisob — lib/debtors.ts (20.09.2026 kelishuvi: o'tgan darslar × dars narxi −
// to'langan; Bosh sahifadagi «Qarzdorlar» bilan bir xil), oylar — FIFO (lib/debtorsTypes.ts →
// unpaidMonths). Rasm izohidagi «oylar bo'yicha» qoida — SAVOLLAR 149 (qaror kutilmoqda).

type Resp = DebtorsReport & { ok: true; branchId: number };
type Term = "all" | "one" | "many";

export interface RowPerms {
  canPay: boolean;
  canSms: boolean;
  canOpenStudent: boolean;
}

const groupText = (g: DebtorRow["groups"][number]) => [g.course, g.level].filter(Boolean).join(" · ") || g.group;

export default function QarzdorlarReport({ report, author, perms }: { report: ReportDef; author: string; perms: RowPerms }) {
  const { t } = useT();
  const f = useReportFmt();
  const today = useToday();
  const { showError, showSuccess } = useToast();
  const branchCtx = useBranch();
  const branchOptions = useBranchOptions();
  const [asOf, setAsOf] = useState(today);
  const [branch, setBranch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [term, setTerm] = useState<Term>("all");
  const [smsFor, setSmsFor] = useState<{ name: string; phone: string } | null>(null);
  const [payFor, setPayFor] = useState<DebtorRow | null>(null);

  // Sukut — navbar filiali (tanlov ro'yxatidagi qatori: 1+2 hovuzi bitta).
  const navRow = branchOptions.find((b) => branchCtx.branchId !== null && (b.value === String(branchCtx.branchId) || (b.value === "1" && branchCtx.branchId === 2)))?.value ?? branchOptions[0]?.value ?? "";
  const branchId = branch || navRow;
  const url = branchId ? `/api/reports/debtors?${new URLSearchParams({ to: asOf, branch: branchId })}` : null;
  const { data, loading, stale, error, reload } = useReportData<Resp>(url);
  const branchName = branchOptions.find((b) => b.value === branchId)?.label ?? "";

  const debtors = useMemo(() => (data?.rows ?? []).filter((r) => r.debt > 0), [data?.rows]);
  const groupOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const r of debtors) for (const g of r.groups) if (!seen.has(g.groupId)) seen.set(g.groupId, `${groupText(g)}${g.teacher ? ` · ${g.teacher}` : ""}`);
    return [...seen.entries()].map(([id, label]) => ({ value: String(id), label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [debtors]);
  const byGroup = groupId ? debtors.filter((r) => r.groups.some((g) => String(g.groupId) === groupId)) : debtors;
  const months = (r: DebtorRow) => r.unpaid?.count ?? 1;
  const rows = byGroup.filter((r) => (term === "one" ? months(r) === 1 : term === "many" ? months(r) >= 2 : true));

  const total = rows.reduce((s, r) => s + r.debt, 0);
  const many = rows.filter((r) => months(r) >= 2);
  const manySum = many.reduce((s, r) => s + r.debt, 0);
  const groupName = groupId ? (groupOptions.find((g) => g.value === groupId)?.label ?? "") : t("Barcha guruhlar");
  const termName = term === "one" ? t("1 oy") : term === "many" ? t("2+ oy") : t("Barcha muddatlar");
  const asOfText = t("{date} holatiga", { date: f.dayMonth(asOf) });

  const monthsText = (r: DebtorRow) => {
    const u = r.unpaid;
    if (!u) return "—";
    const range = u.from === u.to ? f.monthName(u.to) : `${f.monthName(u.from)} – ${f.monthName(u.to)}`;
    return u.count === 1 && u.partial ? `${range} (${t("qisman")})` : range;
  };
  const phoneOf = (r: DebtorRow) => r.parentPhone || r.phone || "";
  const lastPay = (r: DebtorRow) => (r.lastPayment ? f.stamp(r.lastPayment.date, r.lastPayment.time || undefined) : "—");

  const cols: TableCol<DebtorRow>[] = [
    {
      key: "name",
      label: t("O'quvchi"),
      render: (r) => {
        const inner = (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
              {initialsOf(r.name)}
            </span>
            <span className="truncate font-semibold text-v2-text">{r.name}</span>
          </span>
        );
        return perms.canOpenStudent ? (
          <Link href={`/student-edit/${r.id}`} className="block min-w-0 rounded-v2-sm hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
            {inner}
          </Link>
        ) : (
          inner
        );
      },
    },
    {
      key: "group",
      label: t("Guruh"),
      render: (r) => (
        <span className="block text-v2-small text-v2-text-2">
          {r.groups.map((g) => (
            <span key={g.groupId} className="block truncate" title={`${g.group}${g.teacher ? ` · ${g.teacher}` : ""}`}>
              {groupText(g)}
            </span>
          ))}
        </span>
      ),
    },
    {
      key: "months",
      label: t("Qaysi oylar uchun"),
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1.5 text-v2-text">
          {monthsText(r)}
          {(r.unpaid?.count ?? 0) >= 2 && (
            <span className="inline-flex h-5 items-center rounded-v2-full bg-v2-danger-bg px-1.5 text-[11px] font-semibold text-v2-danger">{t("{n} oy", { n: r.unpaid?.count ?? 0 })}</span>
          )}
        </span>
      ),
    },
    {
      key: "debt",
      label: t("Qarz, so'm"),
      align: "right",
      render: (r) => (
        <span className="inline-flex items-center justify-end gap-1 font-semibold text-v2-text">
          {r.incomplete && (
            <span title={t("Hisob to'liq emas: ba'zi guruhda narx yoki jadval kiritilmagan")}>
              <TriangleAlert className="size-3.5 text-v2-warning" strokeWidth={2} aria-label={t("Hisob to'liq emas")} />
            </span>
          )}
          {fmtNum(r.debt)}
        </span>
      ),
    },
    { key: "last", label: t("Oxirgi to'lov"), render: (r) => <span className="whitespace-nowrap text-v2-text-2">{lastPay(r)}</span> },
    { key: "phone", label: t("Ota-ona telefoni"), render: (r) => <span className="whitespace-nowrap tabular-nums text-v2-text">{phoneOf(r) ? fmtPhone(phoneOf(r)) : "—"}</span> },
    {
      key: "act",
      label: <span className="sr-only">{t("Amallar")}</span>,
      align: "right",
      className: "w-[84px]",
      render: (r) => (
        <span className="inline-flex items-center gap-1">
          {perms.canSms && (
            <button
              type="button"
              onClick={() => setSmsFor({ name: r.name, phone: phoneOf(r) })}
              disabled={!phoneOf(r)}
              title={phoneOf(r) ? t("SMS yuborish") : t("Telefon raqam yo'q")}
              aria-label={t("SMS yuborish")}
              className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-hover hover:text-v2-text disabled:opacity-40 focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              <MessageSquare className="size-4" strokeWidth={1.75} />
            </button>
          )}
          {perms.canPay && (
            <button
              type="button"
              onClick={() => setPayFor(r)}
              title={t("To'lov qabul qilish")}
              aria-label={t("To'lov qabul qilish")}
              className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-hover hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              <Wallet className="size-4" strokeWidth={1.75} />
            </button>
          )}
        </span>
      ),
    },
  ];

  function getDoc(): ExportDoc | null {
    if (!data) return null;
    return {
      title: t("{name} hisoboti", { name: t(report.title) }),
      fileBase: `${fileSafe(t(report.title))}-${asOf}`,
      center: t(CENTER_NAME),
      branchLabel: branchName,
      dateLabel: f.fullDate(asOf),
      author,
      filters: [asOfText, branchName, groupName, termName].join(" · "),
      kpis: [
        { label: t("Jami qarz"), value: `${fmtNum(total)} ${t("so'm")}` },
        { label: t("Qarzdorlar"), value: t("{n} o'quvchi", { n: rows.length }) },
        { label: t("2+ oy"), value: t("{n} o'quvchi", { n: many.length }) },
      ],
      sections: [
        {
          columns: [
            { label: "№", numeric: false },
            { label: t("O'quvchi") },
            { label: t("Guruh") },
            { label: t("Oylar") },
            { label: t("Qarz"), numeric: true },
            { label: t("Oxirgi to'lov") },
            { label: t("Telefon"), key: "phone" },
          ],
          rows: rows.map((r, i) => [i + 1, r.name, r.groups.map(groupText).join(", "), monthsText(r), r.debt, lastPay(r), phoneOf(r) ? fmtPhone(phoneOf(r)) : null]),
          total: [null, t("Jami"), null, null, total, null, null],
        },
      ],
      notes: [t("Qarz o'tgan darslar bo'yicha: darslar × dars narxi − to'langan (Bosh sahifadagi «Qarzdorlar» bilan bir xil). Oylar — to'lovlar eng eski oydan yopiladi.")],
      footer: DOC_FOOTER,
    };
  }

  const studentRow = (r: DebtorRow): StudentRow => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    balance: r.paid,
    coin: 0,
    createdAt: "",
    moderator: "",
    source: "",
    groups: r.groups.map((g) => g.group).join(", "),
    category: "",
    status: r.status,
    statusReason: "",
    statusChangedAt: "",
  });

  return (
    <ReportShell
      report={report}
      getDoc={getDoc}
      exportReady={!!data && !stale}
      pdfToggles={[{ key: "phone", label: "Ota-ona telefonlari" }]}
      filters={
        <>
          <V2DateField
            value={dateOfIso(asOf)}
            onChange={(d) => setAsOf(isoOf(d) > today ? today : isoOf(d))}
            trigger={(p, open) => (
              <button type="button" {...p} className={panelTriggerCls(open)}>
                <Calendar className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                <span className="whitespace-nowrap font-semibold">{asOfText}</span>
                <ChevronDown className={`size-4 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
              </button>
            )}
          />
          <V2Select variant="value" label={t("Filial")} value={branchId} onChange={(v) => { setBranch(v); setGroupId(""); }} options={branchOptions} searchable={false} />
          <V2Select variant="value" label={t("Guruh")} emptyLabel="Hammasi" value={groupId} onChange={setGroupId} options={groupOptions} />
        </>
      }
      filtersEnd={
        <div className="w-[264px] max-w-full">
          <Segmented
            value={term}
            onChange={(v) => setTerm(v as Term)}
            label={t("Muddat")}
            options={[
              { value: "all", label: t("Hammasi") },
              { value: "one", label: t("1 oy") },
              { value: "many", label: t("2+ oy") },
            ]}
          />
        </div>
      }
    >
      {error && <ErrorBanner message="Hisobot yuklanmadi" onRetry={reload} />}

      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <KpiStrip
          loading={loading}
          cells={[
            {
              key: "sum",
              label: t("Jami qarz"),
              icon: <CircleAlert className="size-3.5 text-v2-danger" strokeWidth={2} aria-hidden />,
              value: fmtNum(total),
              unit: t("so'm"),
              sub: asOfText,
            },
            { key: "n", label: t("Qarzdorlar"), value: fmtNum(rows.length), unit: t("o'quvchi"), sub: branchName },
            {
              key: "many",
              label: t("2 oy va undan ko'p"),
              value: fmtNum(many.length),
              unit: t("o'quvchi"),
              sub: many.length ? t("{sum} so'm · birinchi navbatda", { sum: fmtNum(manySum) }) : t("yo'q"),
            },
          ]}
        />
      </div>

      <div className={stale ? "opacity-60 transition-opacity" : ""}>
        <ReportTable
          cols={cols}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          empty={debtors.length === 0 ? t("{date} holatiga qarzdor o'quvchi yo'q", { date: f.dayMonth(asOf) }) : t("Bu filtr bo'yicha qarzdor yo'q")}
          caption={t(report.title)}
          minWidth={960}
          total={[
            <span key="t" className="text-v2-text">
              {t("Jami · {n} o'quvchi", { n: rows.length })}
            </span>,
            null,
            null,
            fmtNum(total),
            null,
            null,
            null,
          ]}
        />
      </div>

      <NoteLine>{t("Qarz o'tgan darslar bo'yicha: darslar × dars narxi − to'langan (Bosh sahifadagi «Qarzdorlar» bilan bir xil). Oylar — to'lovlar eng eski oydan yopiladi.")}</NoteLine>

      {smsFor && (
        <SmsModal
          studentName={smsFor.name}
          phone={smsFor.phone}
          onClose={() => setSmsFor(null)}
          onSent={({ simulated }) => {
            if (simulated) showError("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)");
            else showSuccess("SMS yuborildi");
            setSmsFor(null);
          }}
          onError={showError}
        />
      )}
      {payFor && (
        <StudentPaymentModalV2
          student={studentRow(payFor)}
          initialMonth={payFor.unpaid?.from}
          summary={{ balance: -payFor.debt, statusLabel: payFor.status }}
          onClose={() => setPayFor(null)}
          onSaved={() => reload()}
        />
      )}
    </ReportShell>
  );
}
