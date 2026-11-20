"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Gift, Plus, RefreshCw, Trash2, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import type { DateRange } from "@/components/ui/DateRangePicker";
import { useLang, useT } from "@/components/shared/Language";
import { usePersonHref, type PersonKind } from "@/components/shared/PersonDirectory";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { B, Badge, PageHead, PageShell, SummaryLine, fmtNum } from "@/components/v2/students/lists/listKit";
import ActionMenu from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import { DENSITY_CELL, DENSITY_ROW, useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";
import V2DateRange, { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { BONUS_TYPES } from "@/constants/bonuses";
import type { Bonus } from "@/lib/bonuses";
import { BonusCreateDialogV2 } from "./finAwardDialogV2";

// YANGI VERSIYA — MOLIYA → «BONUS» (/finance-bonus, rasmsiz — O'quvchilar ro'yxati / Xodimlar
// qolipida, 20.11.2026). Eski versiyada — components/finance/BonusesPage.tsx, o'zgarmagan.
//
// Ma'lumot va amallar eski sahifa bilan BITTA: GET /api/bonuses, DELETE /api/bonuses/:id,
// yaratish — POST /api/bonuses (./finAwardDialogV2). Filtrlar (Bonus turi, Kimga, sana oralig'i —
// `createdAt` kuni bo'yicha) va sahifalash brauzerda, eski kabi. Eksport (Excel / CSV) — eski
// sahifadagi bilan AYNAN bir xil fayl: o'sha ustunlar, o'sha nom (bonuslar-YYYY-MM-DD), filtrlangan
// qatorlar. Ustunlarni yashirish — v2 «Ustunlar» oynasi (eski ustunlar to'liq; doim bo'sh turadigan
// «Sababi», «Holat», «To'lov tranzaksiyasi» sukutda yashirin).
//
// XODIM bonusi oylikka qo'shiladi (lib/payrollSources.ts — type "employee", ism va yozilgan oy
// bo'yicha), shuning uchun o'chirish tasdig'ida shu aytiladi.

// /api/bonuses qaytaradigan qator — eski sahifadagi kengaytirilgan tur (balans manbasi yo'q — null).
type BonusRow = Omit<Bonus, "before" | "after" | "givenBy"> & {
  before: number | null;
  after: number | null;
  givenBy?: string | null;
};

const TYPE_LABEL: Record<string, string> = Object.fromEntries(BONUS_TYPES.map((tv: { value: string; tableLabel: string }) => [tv.value, tv.tableLabel]));

type BonKey = "recipient" | "type" | "before" | "amount" | "after" | "givenBy" | "note" | "date" | "reason" | "status" | "paymentTx";

const BON_COLUMNS: ColumnDef<BonKey>[] = [
  { key: "recipient", label: "To'liq ismi", on: true, locked: true },
  { key: "type", label: "Bonus turi", on: true },
  { key: "before", label: "Oldingi miqdor", on: true, align: "right" },
  { key: "amount", label: "Miqdor", on: true, align: "right" },
  { key: "after", label: "Keyingi miqdor", on: true, align: "right" },
  { key: "givenBy", label: "Kim tomonidan", on: true },
  { key: "note", label: "Izoh", on: true },
  { key: "date", label: "Sana", on: true },
  // Bonus formasi bu maydonlarni to'ldirmaydi (lib/bonuses.ts) — sukutda yashirin, kerak bo'lsa yoqiladi.
  { key: "reason", label: "Sababi", on: false },
  { key: "status", label: "Holat", on: false },
  { key: "paymentTx", label: "To'lov tranzaksiyasi", on: false },
];

/** "DD.MM.YYYY HH:mm" → kun (eski sahifadagi bilan bir xil — sana filtri shu bilan). */
function bonParseCreatedAt(s: string): Date | null {
  const [datePart] = (s || "").split(" ");
  const [d, m, y] = (datePart || "").split(".").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function bonNum(n: number | null | undefined): string {
  return n == null ? "—" : fmtNum(n);
}

function BonPerson({ name, kind, strong = false }: { name: string; kind?: PersonKind; strong?: boolean }) {
  const text = (name || "").trim();
  const href = usePersonHref(text, kind);
  if (!text) return <span className="text-v2-text-3">—</span>;
  const cls = `block truncate ${strong ? "font-semibold text-v2-text" : "text-v2-text"}`;
  if (!href) return <span className={cls} title={text}>{text}</span>;
  return (
    <Link href={href} title={text} className={`${cls} underline-offset-2 hover:text-v2-brand-text hover:underline`}>
      {text}
    </Link>
  );
}

const TH = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 px-2.5 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
const ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-danger-bg hover:text-v2-danger focus-visible:outline-none focus-visible:shadow-v2-focus";

export default function BonusesV2() {
  const { t } = useT();
  const [lang] = useLang();
  const { showSuccess, showError } = useToast();
  const prefs = useColumnPrefs("v2:finance-bonus:columns:1", BON_COLUMNS);

  const [rows, setRows] = useState<BonusRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const [typeFilter, setTypeFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [addOpen, setAddOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<BonusRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bonuses")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setRows(d.bonuses);
          setFailed(false);
        } else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const all = useMemo(() => rows ?? [], [rows]);
  const recipientOptions = useMemo(
    () =>
      Array.from(new Set(all.map((r) => r.recipientName)))
        .filter(Boolean)
        .sort()
        .map((n) => ({ value: n, label: n })),
    [all],
  );

  // Filtr — eski sahifadagi bilan bir xil.
  const filtered = useMemo(() => {
    return all.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (recipientFilter && r.recipientName !== recipientFilter) return false;
      if (dateRange.start || dateRange.end) {
        const d = bonParseCreatedAt(r.createdAt);
        if (!d) return false;
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
      }
      return true;
    });
  }, [all, typeFilter, recipientFilter, dateRange]);

  const totalAmount = useMemo(() => filtered.reduce((sum, r) => sum + r.amount, 0), [filtered]);
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const anyFilter = !!(typeFilter || recipientFilter || dateRange.start || dateRange.end);
  const clearAll = () => {
    setTypeFilter("");
    setRecipientFilter("");
    setDateRange({ start: null, end: null });
    setPage(1);
  };
  const on = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  // ── Eksport — eski sahifadagi bilan AYNAN bir xil (ustunlar, qiymatlar, fayl nomi, xabarlar). ──
  const exportCols: { label: string; get: (b: BonusRow) => string | number }[] = [
    { label: t("Bonus turi"), get: (b) => TYPE_LABEL[b.type] || b.type },
    { label: t("To'liq ismi"), get: (b) => b.recipientName },
    { label: t("Kim tomonidan"), get: (b) => b.givenBy || "—" },
    { label: t("Oldingi miqdor"), get: (b) => b.before ?? "—" },
    { label: t("Miqdor"), get: (b) => b.amount },
    { label: t("Keyingi miqdor"), get: (b) => b.after ?? "—" },
    { label: t("Izoh"), get: (b) => b.note || "" },
    { label: t("Sababi"), get: (b) => b.reason || "" },
    { label: t("Holat"), get: (b) => b.status || "" },
    { label: t("Sana"), get: (b) => b.createdAt },
  ];

  function exportCsv() {
    try {
      const csvRows = [
        exportCols.map((c) => c.label).join(","),
        ...filtered.map((b) => exportCols.map((c) => `"${String(c.get(b)).replace(/"/g, '""')}"`).join(",")),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `bonuslar-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess(t("CSV fayl yuklab olindi"));
    } catch {
      showError(t("CSV faylni yuklab bo'lmadi"));
    }
  }

  async function exportExcel() {
    try {
      // xlsx (SheetJS) faqat bosilganda yuklanadi — sahifaning boshlang'ich to'plamiga kirmaydi.
      const XLSX = await import("xlsx");
      const data = filtered.map((b) => Object.fromEntries(exportCols.map((c) => [c.label, c.get(b)])));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Bonuslar");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `bonuslar-${date}.xlsx`);
      showSuccess(t("Excel fayl yuklab olindi"));
    } catch {
      showError(t("Excel faylni yuklab bo'lmadi"));
    }
  }

  async function confirmDelete() {
    if (!delTarget || busyRef.current) return;
    const b = delTarget;
    busyRef.current = true;
    setDeleting(true);
    try {
      const res = await fetch(`/api/bonuses/${b.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      setRows((prev) => (prev ? prev.filter((x) => x.id !== b.id) : prev));
      showSuccess(t("Bonus o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      busyRef.current = false;
      setDeleting(false);
      setDelTarget(null);
    }
  }

  const cols = [...prefs.locked, ...prefs.shown];
  const rowH = DENSITY_ROW[prefs.density];
  const TD = `px-2.5 ${DENSITY_CELL[prefs.density]} align-middle`;
  const colCount = cols.length + 2;

  function cell(key: BonKey, b: BonusRow) {
    switch (key) {
      case "recipient":
        return (
          <td key={key} className={`${TD} max-w-[240px]`}>
            <BonPerson name={b.recipientName} kind={b.type === "employee" ? "staff" : b.type === "student" ? "student" : undefined} strong />
          </td>
        );
      case "type":
        return (
          <td key={key} className={`${TD} whitespace-nowrap`}>
            <Badge tone={b.type === "employee" ? "info" : "success"}>{t(TYPE_LABEL[b.type] || b.type)}</Badge>
          </td>
        );
      case "before":
        return <td key={key} className={`${TD} whitespace-nowrap text-right tabular-nums text-v2-text-2`}>{bonNum(b.before)}</td>;
      case "amount":
        return (
          <td key={key} className={`${TD} whitespace-nowrap text-right font-semibold tabular-nums text-v2-success`}>
            {b.amount > 0 ? "+" : ""}
            {fmtNum(b.amount)}
          </td>
        );
      case "after":
        return <td key={key} className={`${TD} whitespace-nowrap text-right tabular-nums text-v2-text-2`}>{bonNum(b.after)}</td>;
      case "givenBy":
        return (
          <td key={key} className={`${TD} max-w-[200px]`}>
            <BonPerson name={b.givenBy || ""} kind="staff" />
          </td>
        );
      case "note":
      case "reason":
      case "status": {
        const v = key === "note" ? b.note : key === "reason" ? b.reason : b.status;
        return (
          <td key={key} className={`${TD} max-w-[240px]`}>
            {v ? (
              <span className="block truncate text-v2-text-2" title={v}>
                {v}
              </span>
            ) : (
              <span className="text-v2-text-3">—</span>
            )}
          </td>
        );
      }
      case "date": {
        const d = bonParseCreatedAt(b.createdAt);
        const time = (b.createdAt || "").split(" ")[1] ?? "";
        return (
          <td key={key} className={`${TD} whitespace-nowrap tabular-nums text-v2-text-2`} title={b.createdAt}>
            {d ? dayMonthLabel(d, lang) : b.createdAt || "—"}
            {d && time && (
              <>
                {" "}
                <span className="text-v2-text-3">|</span> {time}
              </>
            )}
          </td>
        );
      }
      case "paymentTx":
        return (
          <td key={key} className={`${TD} text-v2-text-3`}>
            —
          </td>
        );
    }
  }

  return (
    <PageShell>
      <PageHead
        title={t("Bonuslar")}
        subtitle={t("Xodim bonusi shu oy oyligiga qo'shiladi; o'quvchiga bonus — markaz hisobidan")}
        actions={
          <>
            <ActionMenu
              label={t("Yuklab olish")}
              width={248}
              items={[
                { key: "xlsx", label: t("Excel faylini yuklab olish"), icon: FileSpreadsheet, hint: "XLSX", disabled: !rows, onSelect: () => void exportExcel() },
                { key: "csv", label: t("CSV faylini yuklab olish"), icon: FileText, hint: "CSV", disabled: !rows, onSelect: exportCsv },
              ]}
            >
              {(trigger) => (
                <button type="button" {...trigger} className={secondaryBtn}>
                  <Download className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("Yuklab olish")}
                </button>
              )}
            </ActionMenu>
            <button type="button" onClick={() => setAddOpen(true)} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Bonus yaratish")}
            </button>
          </>
        }
      />

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <V2Select
          variant="chip"
          label={t("Bonus turi")}
          value={typeFilter}
          onChange={on(setTypeFilter)}
          options={BONUS_TYPES.map((tv: { value: string; tableLabel: string }) => ({ value: tv.value, label: tv.tableLabel }))}
          searchable={false}
        />
        <V2Select variant="chip" label={t("Kimga")} value={recipientFilter} onChange={on(setRecipientFilter)} options={recipientOptions} searchable />
        <V2DateRange value={dateRange} onChange={on(setDateRange)} align="start" />
        {anyFilter && (
          <button type="button" onClick={clearAll} className="inline-flex h-9 items-center gap-1 rounded-v2-md px-2 text-v2-small text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
            <X className="size-3.5" strokeWidth={2} aria-hidden />
            {t("Tozalash")}
          </button>
        )}
        <div className="ml-auto">
          <ColumnsControl prefs={prefs} />
        </div>
      </div>

      <SummaryLine
        items={[
          <span key="n">
            {t("Umumiy soni:")} <B>{rows ? fmtNum(filtered.length) : "—"}</B>
          </span>,
          <span key="s">
            {t("Umumiy bonuslar")}: <B tone="success">{rows ? `${fmtNum(totalAmount)} ${t("so'm")}` : "—"}</B>
          </span>,
        ]}
      />

      {/* Jadval */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full border-collapse text-v2-body" style={{ minWidth: 120 + cols.length * 140 }}>
            <thead>
              <tr>
                <th className={`${TH} w-14 pl-4`}>№</th>
                {cols.map((c) => (
                  <th key={c.key} className={`${TH} ${c.align === "right" ? "text-right" : ""}`}>
                    {t(c.label)}
                  </th>
                ))}
                <th className={`${TH} w-14 pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!rows &&
                !failed &&
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={`sk${i}`} className={`${rowH} border-b border-v2-border`} aria-hidden>
                    <td className={`${TD} pl-4`}><div className="h-3 w-6 rounded bg-v2-skeleton" /></td>
                    {cols.map((c) => (
                      <td key={c.key} className={TD}>
                        <div className={`h-3 rounded bg-v2-skeleton ${c.align === "right" ? "ml-auto w-16" : "w-28"}`} />
                      </td>
                    ))}
                    <td className={`${TD} pr-4`} />
                  </tr>
                ))}

              {((failed && !rows) || (rows && slice.length === 0)) && (
                <tr>
                  <td colSpan={colCount} className="p-5">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <Gift className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {failed && !rows ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotni yuklab bo'lmadi")}</div>
                          <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-2`}>
                            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                            {t("Qayta urinish")}
                          </button>
                        </>
                      ) : anyFilter ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Bonus topilmadi")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}</p>
                          <button type="button" onClick={clearAll} className={`${secondaryBtn} mt-2`}>
                            {t("Filtrlarni tozalash")}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Hali bonus yozilmagan")}</div>
                          <button type="button" onClick={() => setAddOpen(true)} className={`${primaryBtn} mt-2`}>
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                            {t("Bonus yaratish")}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {slice.map((b, i) => (
                <tr key={b.id} className={`${rowH} border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                  <td className={`${TD} pl-4 tabular-nums text-v2-text-3`}>{start + i + 1}</td>
                  {cols.map((c) => cell(c.key, b))}
                  <td className={`${TD} pr-4 text-right`}>
                    <button
                      type="button"
                      onClick={() => setDelTarget(b)}
                      title={t("O'chirish")}
                      aria-label={`${b.recipientName} — ${t("O'chirish")}`}
                      className={ICON_BTN}
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <V2Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>

      {addOpen && (
        <BonusCreateDialogV2
          onClose={() => setAddOpen(false)}
          onSaved={(b) => setRows((prev) => [b as BonusRow, ...(prev ?? [])])}
        />
      )}
      {delTarget && (
        <V2Confirm
          title={t("Bonusni o'chirasizmi?")}
          body={
            delTarget.type === "employee"
              ? t("{name} — {sum} so'm. Xodim bonusi oylik hisobidan ham chiqadi.", { name: delTarget.recipientName, sum: fmtNum(delTarget.amount) })
              : t("{name} — {sum} so'm bonus ro'yxatdan olib tashlanadi.", { name: delTarget.recipientName, sum: fmtNum(delTarget.amount) })
          }
          confirmLabel={deleting ? t("O'chirilmoqda…") : t("O'chirish")}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </PageShell>
  );
}
