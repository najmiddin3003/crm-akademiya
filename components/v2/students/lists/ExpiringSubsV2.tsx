"use client";

import { useMemo, useState } from "react";
import { Clock, Download, MessageSquare, Send } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import StudentPaymentModalV2 from "@/components/v2/finance/StudentPaymentModalV2";
import { emitMoneyChanged } from "@/components/v2/shell/v2Events";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";
import { ROW_TINT } from "@/components/v2/ui/table";
import { daysBetween, isExpiring, monthOf, type StudentListRow } from "@/lib/studentListsTypes";
import BulkSmsDialogV2, { type SmsRecipient } from "./BulkSmsDialogV2";
import {
  B,
  Badge,
  EmptyRow,
  GroupCell,
  PageHead,
  PageShell,
  PersonCell,
  SearchBox,
  SimplePager,
  SkeletonRows,
  SortHead,
  SummaryLine,
  TableCard,
  TH,
  dayMonth,
  dayMonthShort,
  downloadCsv,
  fmtNum,
  fmtPhone,
  matchQuery,
} from "./listKit";
import { useStudentLists } from "./useStudentLists";
import { toStudentRow } from "./rowAdapters";

// YANGI VERSIYA — O'QUVCHILAR → JORIY OYDA OBUNASI TUGAYDIGANLAR (30-qism, rasm, yorug'/qorong'i).
//
// «To'langan davri bugundan oy oxirigacha tugaydi, keyingi to'lov hali qilinmagan»: oldingi oylardan
// qarz yo'q, joriy oy hali yopilmagan, to'lov kuni bugun yoki keyinroq (lib/studentListsTypes.ts →
// isExpiring). «Keyingi to'lov» — joriy oyni yopish uchun kerak summa (oylik − balansdagi ortiqcha).
// Eslatma — shu oyda o'quvchi yoki ota-ona raqamiga ketgan SMS (SMS jurnali). Avtomatik SMS eslatma
// tizimda yo'q (SAVOLLAR 414) — rasmdagi «3 kun oldin SMS ketadi» qatori o'rniga bor narsa yozilgan:
// botdagi Telegram eslatmasi. Eski sahifa — `?classic=1`.

type ColKey = "student" | "group" | "ends" | "next" | "reminder";
type SortKey = "name" | "ends" | "next";

const COLUMNS: ColumnDef<ColKey>[] = [
  { key: "student", label: "O'quvchi", on: true, locked: true },
  { key: "group", label: "Guruh", on: true },
  { key: "ends", label: "Obuna tugaydi", on: true },
  { key: "next", label: "Keyingi to'lov", on: true, align: "right" },
  { key: "reminder", label: "Eslatma", on: true },
];

const SLACK = 1000;
/** Balansdagi ortiqcha (bugungi hisob bo'yicha oldindan to'langani). */
const creditOf = (r: StudentListRow) => (-r.debt > SLACK ? Math.round(-r.debt) : 0);
/**
 * Keyingi to'lov — rasmdagidek «oylik − balansdagi ortiqcha» («300 000 − 40 000 balansda»).
 * Narx noma'lum bo'lsa — joriy oyni yopish uchun kerak summa (oy oxirigacha hisob).
 */
const nextPayOf = (r: StudentListRow) =>
  r.monthlyTotal !== null ? Math.max(0, r.monthlyTotal - creditOf(r)) : Math.max(0, Math.round(r.debtMonthEnd));
const parentPhoneOf = (r: StudentListRow) => r.fatherPhone || r.motherPhone;

export default function ExpiringSubsV2() {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const { rows: all, asOf, loading, reload } = useStudentLists();
  const columns = useColumnPrefs("v2:expiring-subs:columns:1", COLUMNS);

  const [q, setQ] = useState("");
  const [course, setCourse] = useState("");
  const [sent, setSent] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "ends", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [payFor, setPayFor] = useState<StudentListRow | null>(null);
  const [smsRows, setSmsRows] = useState<StudentListRow[] | null>(null);

  const rows = useMemo(() => all.filter((r) => isExpiring(r, asOf)), [all, asOf]);
  const courseOptions = useMemo(() => [...new Set(rows.flatMap((r) => r.groups.map((g) => g.course)).filter(Boolean))].sort().map((v) => ({ value: v, label: v })), [rows]);
  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (!matchQuery(q, r.name, r.phone, r.fatherPhone, r.motherPhone)) return false;
      if (course && !r.groups.some((g) => g.course === course)) return false;
      if (sent === "yes" && !r.lastSmsAt) return false;
      if (sent === "no" && r.lastSmsAt) return false;
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const c = sort.key === "name" ? a.name.localeCompare(b.name, "uz") : sort.key === "next" ? nextPayOf(a) - nextPayOf(b) : (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      return c !== 0 ? c * sign : a.id - b.id;
    });
  }, [rows, q, course, sent, sort]);

  const expected = filtered.reduce((s, r) => s + nextPayOf(r), 0);
  const remindedCount = filtered.filter((r) => r.lastSmsAt).length;
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageIds = slice.map((r) => r.id);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const monthEnd = asOf ? (() => {
    const [y, m] = asOf.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  })() : "";
  const rangeLabel = asOf ? `${Number(asOf.slice(8, 10))}–${dayMonth(monthEnd)}` : "";
  const colCount = columns.shown.length + 3;

  const onSort = (k: SortKey) => {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));
    setPage(1);
  };
  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  function cell(r: StudentListRow, k: ColKey) {
    switch (k) {
      case "student":
        return null;
      case "group":
        return <GroupCell groups={r.groups} />;
      case "ends": {
        const left = r.dueDate && asOf ? daysBetween(asOf, r.dueDate) : null;
        return (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="text-v2-text">{dayMonth(r.dueDate)}</span>
            {left !== null && (
              <span className={`rounded-v2-sm px-1.5 py-px text-v2-caption tabular-nums ${left <= 3 ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-surface-2 text-v2-text-2"}`}>
                {left === 0 ? t("bugun") : t("{n} kun", { n: left })}
              </span>
            )}
          </span>
        );
      }
      case "next": {
        const next = nextPayOf(r);
        const credit = creditOf(r);
        return (
          <div className="whitespace-nowrap">
            <span className="font-semibold tabular-nums text-v2-text">{fmtNum(next)} {t("so'm")}</span>
            {r.monthlyTotal !== null && credit > SLACK && (
              <span className="block text-v2-small tabular-nums text-v2-text-3">
                {fmtNum(r.monthlyTotal)} − {fmtNum(credit)} {t("balansda")}
              </span>
            )}
          </div>
        );
      }
      case "reminder":
        return r.lastSmsAt ? (
          <div>
            <Badge tone="success">{`${t("Yuborildi")} · ${dayMonthShort(r.lastSmsAt)}`}</Badge>
            <span className="block text-v2-small text-v2-text-3">{r.lastSmsBy ? `${t("qo'lda")} · ${r.lastSmsBy}` : t("avtomatik")}</span>
          </div>
        ) : (
          <span className="text-v2-text-2">{t("Yuborilmagan")}</span>
        );
    }
  }

  const head: Record<ColKey, React.ReactNode> = {
    student: null,
    group: t("Guruh"),
    ends: <SortHead label={t("Obuna tugaydi")} k="ends" sort={sort} onSort={onSort} />,
    next: <SortHead label={t("Keyingi to'lov")} k="next" sort={sort} onSort={onSort} align="right" />,
    reminder: t("Eslatma"),
  };

  const recipientsOf = (list: StudentListRow[]): SmsRecipient[] =>
    list.map((r) => ({
      key: String(r.id),
      label: parentPhoneOf(r) ? t("{name} — ota-onasi", { name: r.name }) : r.name,
      phone: parentPhoneOf(r) || r.phone,
      values: { name: r.name, amount: fmtNum(nextPayOf(r)), date: dayMonth(r.dueDate) },
    }));

  function exportCsv() {
    const list = selected.size ? filtered.filter((r) => selected.has(r.id)) : filtered;
    downloadCsv(
      "obunasi-tugaydiganlar.csv",
      ["ID", "O'quvchi", "Telefon", "Ota-ona telefoni", "Guruh", "Obuna tugaydi", "Keyingi to'lov", "Eslatma"],
      list.map((r) => [r.id, r.name, fmtPhone(r.phone), fmtPhone(parentPhoneOf(r)), r.groups.map((g) => g.course).join("; "), r.dueDate ?? "", nextPayOf(r), r.lastSmsAt ?? ""]),
    );
  }

  return (
    <PageShell>
      <PageHead
        title={t("Joriy oyda obunasi tugaydiganlar")}
        subtitle={[branchName, rangeLabel ? t("to'langan davri {range}da tugaydi, keyingi to'lov hali qilinmagan", { range: rangeLabel }) : ""].filter(Boolean).join(" · ")}
        actions={
          <button type="button" onClick={exportCsv} className={secondaryBtn}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Export")}
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-v2-lg border border-v2-border bg-v2-surface-2 px-3 py-2 text-v2-small text-v2-text">
        <Clock className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1">
          <b className="font-semibold">{t("Avtomatik eslatma:")}</b>{" "}
          {t("o'quvchilar botiga ulangan ota-onaga oyning 25-kuni va oxirgi kuni Telegram'da to'lov eslatmasi ketadi. SMS eslatmani shu yerdan yuborasiz.")}
        </span>
        <Link href="/settings-notifications" className="whitespace-nowrap font-semibold text-v2-brand-text hover:underline">
          {t("Sozlash")}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t("Ism yoki telefon")} />
        <V2Select variant="chip" label={t("Kurs")} value={course} onChange={(v) => { setCourse(v); setPage(1); }} options={courseOptions} />
        <V2Select
          variant="chip"
          label={t("Eslatma")}
          value={sent}
          onChange={(v) => { setSent(v); setPage(1); }}
          searchable={false}
          options={[
            { value: "no", label: t("Yuborilmagan") },
            { value: "yes", label: t("Yuborilgan") },
          ]}
        />
        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      <SummaryLine
        items={[
          <span key="n"><B>{filtered.length}</B> {t("ta o'quvchi")}</span>,
          <span key="e">{t("Kutilayotgan tushum")} <B>{fmtNum(expected)} {t("so'm")}</B></span>,
          <span key="r">{t("Eslatma yuborilgan")} <B>{remindedCount}</B></span>,
        ]}
      />

      <TableCard footer={<SimplePager total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}>
        <thead>
          {selected.size > 0 && (
            <tr>
              <th colSpan={colCount} className="sticky top-0 z-20 bg-v2-brand-bg px-4 py-2 text-left font-normal shadow-[inset_0_-1px_0_var(--v2-border)]">
                <div className="flex flex-wrap items-center gap-3 text-v2-small">
                  <b className="font-semibold text-v2-brand-text">{t("{n} ta tanlandi", { n: selected.size })}</b>
                  <span className="text-v2-text-2">{t("eslatma SMS ota-onaga, raqami bo'lmasa o'quvchiga ketadi")}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button type="button" onClick={() => setSelected(new Set())} className="h-8 rounded-v2-md px-2 font-medium text-v2-text-2 hover:text-v2-text">
                      {t("Bekor qilish")}
                    </button>
                    <button type="button" onClick={() => setSmsRows(filtered.filter((r) => selected.has(r.id)))} className={`${primaryBtn} h-8!`}>
                      <Send className="size-4" strokeWidth={2} aria-hidden />
                      {t("Eslatma yuborish · {n} SMS", { n: selected.size })}
                    </button>
                  </div>
                </div>
              </th>
            </tr>
          )}
          <tr>
            <th className={`${TH} w-10 pl-4 pr-2 ${selected.size > 0 ? "top-12!" : ""}`}>
              <V2Checkbox
                checked={pageIds.length > 0 && pageSelected === pageIds.length}
                indeterminate={pageSelected > 0 && pageSelected < pageIds.length}
                onChange={(on) => pageIds.forEach((id) => toggle(id, on))}
                label={t("Sahifadagilarni belgilash")}
              />
            </th>
            <th className={`${TH} ${selected.size > 0 ? "top-12!" : ""}`}><SortHead label={t("O'quvchi")} k="name" sort={sort} onSort={onSort} /></th>
            {columns.shown.map((c) => (
              <th key={c.key} className={`${TH} ${c.align === "right" ? "text-right" : ""} ${selected.size > 0 ? "top-12!" : ""}`}>{head[c.key]}</th>
            ))}
            <th className={`${TH} w-px ${selected.size > 0 ? "top-12!" : ""}`}><span className="sr-only">{t("Amallar")}</span></th>
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows cols={colCount} />}
          {!loading && slice.length === 0 && (
            <EmptyRow
              cols={colCount}
              title={rows.length === 0 ? t("Bu oyda obunasi tugaydigan o'quvchi yo'q") : t("Mos o'quvchi topilmadi")}
              hint={rows.length === 0 ? t("To'lov kuni oy oxirigacha keladigan va joriy oyni hali to'lamagan o'quvchilar shu yerda chiqadi.") : t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}
            />
          )}
          {!loading &&
            slice.map((r) => {
              const on = selected.has(r.id);
              const parent = parentPhoneOf(r);
              return (
                <tr key={r.id} className={`group border-b border-v2-border last:border-b-0 ${on ? ROW_TINT.brand : ROW_TINT.hover}`}>
                  <td className="py-2.5 pl-4 pr-2"><V2Checkbox checked={on} onChange={(v) => toggle(r.id, v)} label={t("{name} — belgilash", { name: r.name })} /></td>
                  <td className="px-2.5 py-2.5">
                    <PersonCell id={r.id} name={r.name} sub={parent ? `${t("ota-ona")}: ${fmtPhone(parent)}` : fmtPhone(r.phone) || "—"} />
                  </td>
                  {columns.shown.map((c) => (
                    <td key={c.key} className={`px-2.5 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>{cell(r, c.key)}</td>
                  ))}
                  <td className="py-2.5 pl-1 pr-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => setSmsRows([r])} title={t("Eslatma yuborish")} aria-label={t("{name} — eslatma yuborish", { name: r.name })} className={`${secondaryIcon} size-8! h-8!`}>
                        <MessageSquare className="size-4" strokeWidth={1.75} />
                      </button>
                      <button type="button" onClick={() => setPayFor(r)} className={`${secondaryBtn} h-8!`}>
                        {t("To'lov")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </TableCard>

      {smsRows && (
        <BulkSmsDialogV2
          title={t("To'lov eslatmasi")}
          subtitle={t("{n} ta o'quvchi — SMS ota-onaga, raqami bo'lmasa o'quvchiga", { n: smsRows.length })}
          recipients={recipientsOf(smsRows)}
          defaultText={t("Hurmatli ota-ona! {name}ning o'qish to'lovi muddati {date}. To'lov summasi: {amount} so'm.")}
          submitLabel={(n) => t("Eslatma yuborish · {n} SMS", { n })}
          onClose={() => setSmsRows(null)}
          onDone={(keys, simulated) => {
            if (simulated) showError(t("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)"));
            else showSuccess(t("{n} ta eslatma yuborildi", { n: keys.length }));
            setSelected(new Set());
            void reload();
          }}
        />
      )}
      {payFor && (
        <StudentPaymentModalV2
          student={toStudentRow(payFor)}
          initialGroupId={payFor.groups[0]?.id ?? null}
          initialMonth={asOf ? monthOf(asOf) : undefined}
          onClose={() => setPayFor(null)}
          onSaved={() => {
            emitMoneyChanged();
            void reload();
          }}
        />
      )}
    </PageShell>
  );
}
