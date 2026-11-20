"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Info, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useLang, useT } from "@/components/shared/Language";
import V2Confirm from "@/components/v2/form/V2Confirm";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, FieldWarning, MoneyField, TextInput } from "@/components/v2/form/fields";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import { Badge, PageHead, PageShell, SearchBox, SegmentPills, fmtNum } from "@/components/v2/students/lists/listKit";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { EXPENSE_STATUSES, EXPENSE_TYPES } from "@/constants/plannedExpenses";
import type { PlannedExpense } from "@/lib/plannedExpenses";

// YANGI VERSIYA — MOLIYA → «REJALASHTIRILGAN XARAJATLAR» (/finance-planned, rasmsiz — Kassalar /
// Kirim-chiqim toifalari ro'yxatlari qolipida, 20.11.2026). Eski versiyada —
// components/finance/PlannedExpensesPage.tsx, o'zgarmagan.
//
// Ma'lumot va so'rovlar eski sahifa bilan BITTA: GET /api/planned-expenses, POST /api/planned-expenses,
// PATCH / DELETE /api/planned-expenses/:id. Saqlash tanasi aynan eski paneldagi
// (components/finance/PlannedExpenseDrawer.tsx): { name, amount, type, status, startDate, endDate } —
// sanalar MAHALLIY «YYYY-MM-DD», bo'sh — null; yangi yozuvda «Holati» sukut bo'yicha bo'sh (eski kabi).
//
// Bu ro'yxat «Moliyaviy reja → Xarajat» rejasiga tushadi (lib/financialPlan.ts → monthlyOf): nomi
// kassadagi chiqim turi nomi bilan bog'lanadi, «Nofaol»lar va sanasi oyga tushmaganlar kirmaydi.
// «Faol N» tabletkasi — eski sahifadagi «Umumiy soni» (u ham faqat «Faol»larni sanardi).

type PexTab = "all" | "active" | "inactive";

function pexToIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function pexFromIso(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Turi → Moliyaviy rejada oyga qanday keltiriladi (lib/financialPlan.ts → monthlyOf). */
const PEX_TYPE_HINT: Record<string, string> = {
  Kunlik: "Rejada: summa × oydagi kunlar soni",
  Haftalik: "Rejada: summa × oydagi kunlar ÷ 7",
  Oylik: "Rejada: summa o'zi — oyiga",
  Yillik: "Rejada: summa ÷ 12",
};

const TH = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 px-2.5 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
const TD = "px-2.5 py-2.5 align-middle";
const COLS = 8;
const ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";

export default function PlannedExpensesV2() {
  const { t } = useT();
  const [lang] = useLang();
  const { showSuccess, showError } = useToast();
  const canPlan = useCanOpen("/finance-revenue-plan");

  const [expenses, setExpenses] = useState<PlannedExpense[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<PexTab>("all");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ expense: PlannedExpense | null } | null>(null);
  const [delTarget, setDelTarget] = useState<PlannedExpense | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Ikki marta bosilsa ikkinchi DELETE ketmasin (eski oynada tugma o'chiq turardi).
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/planned-expenses")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setExpenses(d.expenses);
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

  const all = useMemo(() => expenses ?? [], [expenses]);
  const activeCount = useMemo(() => all.filter((e) => e.status === "Faol").length, [all]);
  const inactiveCount = useMemo(() => all.filter((e) => e.status === "Nofaol").length, [all]);
  const needle = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      all.filter(
        (e) =>
          (tab === "all" || (tab === "active" ? e.status === "Faol" : e.status === "Nofaol")) &&
          (!needle || e.name.toLowerCase().includes(needle)),
      ),
    [all, tab, needle],
  );
  const filtered = tab !== "all" || !!needle;

  const fmtDay = (iso: string | null) => {
    const d = pexFromIso(iso);
    return d ? dayMonthLabel(d, lang) : null;
  };

  async function confirmDelete() {
    if (!delTarget || busyRef.current) return;
    const e = delTarget;
    busyRef.current = true;
    setDeleting(true);
    try {
      const res = await fetch(`/api/planned-expenses/${e.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      setExpenses((prev) => (prev ? prev.filter((x) => x.id !== e.id) : prev));
      showSuccess(t("Xarajat o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      busyRef.current = false;
      setDeleting(false);
      setDelTarget(null);
    }
  }

  return (
    <PageShell>
      <PageHead
        title={t("Rejalashtirilgan xarajatlar")}
        subtitle={t("Doimiy xarajatlar — «Moliyaviy reja → Xarajat» rejasi shu ro'yxatdan oyga keltirib hisoblanadi")}
        actions={
          <>
            {canPlan && (
              <Link href="/finance-revenue-plan" className={secondaryBtn}>
                {t("Moliyaviy reja")}
              </Link>
            )}
            <button type="button" onClick={() => setDialog({ expense: null })} disabled={!expenses} className={`${primaryBtn} disabled:opacity-60`}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Xarajat qo'shish")}
            </button>
          </>
        }
      />

      {/* Holat tabletkalari + qidiruv */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentPills<PexTab>
          items={[
            { key: "all", label: t("Hammasi"), count: all.length },
            { key: "active", label: t("Faol"), count: activeCount },
            { key: "inactive", label: t("Nofaol"), count: inactiveCount },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="ml-auto w-full sm:w-auto">
          <SearchBox value={q} onChange={setQ} placeholder={t("Xarajat nomi")} width={240} />
        </div>
      </div>

      {/* Jadval */}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[860px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${TH} w-14 pl-4`}>№</th>
                <th className={TH}>{t("Nomi")}</th>
                <th className={`${TH} text-right`}>{t("Miqdori, so'm")}</th>
                <th className={TH}>{t("Turi")}</th>
                <th className={TH}>{t("Boshlanish sanasi")}</th>
                <th className={TH}>{t("Tugash sanasi")}</th>
                <th className={TH}>{t("Holati")}</th>
                <th className={`${TH} w-24 pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!expenses &&
                !failed &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-14 border-b border-v2-border" aria-hidden>
                    <td className={`${TD} pl-4`}><div className="h-3 w-6 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-40 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="ml-auto h-3 w-20 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-16 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-20 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-3 w-20 rounded bg-v2-skeleton" /></td>
                    <td className={TD}><div className="h-5 w-14 rounded-v2-full bg-v2-skeleton" /></td>
                    <td className={`${TD} pr-4`} />
                  </tr>
                ))}

              {(failed && !expenses) || (expenses && visible.length === 0) ? (
                <tr>
                  <td colSpan={COLS} className="p-5">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                        <CalendarClock className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {failed && !expenses ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Ma'lumotni yuklab bo'lmadi")}</div>
                          <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-2`}>
                            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                            {t("Qayta urinish")}
                          </button>
                        </>
                      ) : filtered ? (
                        <div className="text-v2-section text-v2-text">{t("Topilmadi")}</div>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Rejalashtirilgan xarajat hali yo'q")}</div>
                          <p className="max-w-[28rem] text-v2-small text-v2-text-2">{t("Ijara, kommunal, internet kabi doimiy xarajatlarni qo'shing — Moliyaviy reja ularni har oy hisobga oladi.")}</p>
                          <button type="button" onClick={() => setDialog({ expense: null })} className={`${primaryBtn} mt-2`}>
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                            {t("Xarajat qo'shish")}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}

              {visible.map((e, i) => {
                const inactive = e.status === "Nofaol";
                const from = fmtDay(e.startDate);
                const to = fmtDay(e.endDate);
                return (
                  <tr key={e.id} className={`h-14 border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                    <td className={`${TD} pl-4 tabular-nums text-v2-text-3`}>{i + 1}</td>
                    <td className={`${TD} max-w-[280px]`}>
                      <button
                        type="button"
                        onClick={() => setDialog({ expense: e })}
                        title={e.name}
                        className={`block max-w-full truncate text-left font-semibold underline-offset-2 hover:text-v2-brand-text hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus ${inactive ? "text-v2-text-2" : "text-v2-text"}`}
                      >
                        {e.name}
                      </button>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right font-semibold tabular-nums ${inactive ? "text-v2-text-2" : "text-v2-text"}`}>{fmtNum(e.amount)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{e.type ? <span className="text-v2-text">{t(e.type)}</span> : <span className="text-v2-text-3">—</span>}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums text-v2-text-2`}>{from ?? <span className="text-v2-text-3">—</span>}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums text-v2-text-2`}>{to ?? <span className="text-v2-text-3">—</span>}</td>
                    <td className={TD}>
                      {e.status === "Faol" ? (
                        <Badge tone="success">{t("Faol")}</Badge>
                      ) : inactive ? (
                        <Badge tone="neutral">{t("Nofaol")}</Badge>
                      ) : e.status ? (
                        <span className="text-v2-text-2">{t(e.status)}</span>
                      ) : (
                        <span className="text-v2-text-3">—</span>
                      )}
                    </td>
                    <td className={`${TD} pr-4`}>
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" onClick={() => setDialog({ expense: e })} title={t("Tahrirlash")} aria-label={`${e.name} — ${t("Tahrirlash")}`} className={ICON_BTN}>
                          <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDelTarget(e)}
                          title={t("O'chirish")}
                          aria-label={`${e.name} — ${t("O'chirish")}`}
                          className={`${ICON_BTN} hover:bg-v2-danger-bg hover:text-v2-danger`}
                        >
                          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-1.5 text-v2-caption text-v2-text-2">
        <p className="flex items-start gap-2">
          <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <span>{t("Moliyaviy rejada xarajat kassadagi chiqim bilan tranzaksiya turi NOMI bo'yicha bog'lanadi — nomini o'sha tur nomi bilan bir xil yozing.")}</span>
        </p>
        <p className="flex items-start gap-2">
          <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <span>{t("Rejaga «Nofaol»lar va sanasi o'sha oyga tushmaganlar kirmaydi. Kunlik — oydagi kunlarga ko'paytiriladi, Haftalik — kunlar ÷ 7, Yillik — 12 ga bo'linadi.")}</span>
        </p>
      </div>

      {dialog && (
        <PlannedExpenseDialogV2
          expense={dialog.expense}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            const editing = !!dialog?.expense;
            setExpenses((prev) => {
              const list = prev ?? [];
              // Eski sahifa kabi: yangi — boshiga, tahrirlangan — o'z o'rnida.
              return editing ? list.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...list];
            });
          }}
        />
      )}
      {delTarget && (
        <V2Confirm
          title={t("Xarajatni o'chirasizmi?")}
          body={t("«{n}» ro'yxatdan va Moliyaviy rejadagi xarajat rejasidan olib tashlanadi.", { n: delTarget.name })}
          confirmLabel={deleting ? t("O'chirilmoqda…") : t("O'chirish")}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </PageShell>
  );
}

/* ───────────────────────── Qo'shish / tahrirlash oynasi ───────────────────────── */

function PlannedExpenseDialogV2({
  expense,
  onClose,
  onSaved,
}: {
  expense: PlannedExpense | null;
  onClose: () => void;
  onSaved: (e: PlannedExpense) => void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");
  const [name, setName] = useState(expense?.name || "");
  const [amount, setAmount] = useState(expense?.amount ? String(expense.amount) : "");
  const [type, setType] = useState(expense?.type || "");
  const [status, setStatus] = useState(expense?.status || "");
  const [startDate, setStartDate] = useState<Date | null>(() => pexFromIso(expense?.startDate ?? null));
  const [endDate, setEndDate] = useState<Date | null>(() => pexFromIso(expense?.endDate ?? null));
  const [nameErr, setNameErr] = useState("");
  const [saving, setSaving] = useState(false);

  const init = {
    name: expense?.name || "",
    amount: expense?.amount ? String(expense.amount) : "",
    type: expense?.type || "",
    status: expense?.status || "",
    start: expense?.startDate ?? null,
    end: expense?.endDate ?? null,
  };
  const startIso = startDate ? pexToIso(startDate) : null;
  const endIso = endDate ? pexToIso(endDate) : null;
  const dirty =
    name !== init.name || amount !== init.amount || type !== init.type || status !== init.status || startIso !== init.start || endIso !== init.end;
  const rangeBackwards = !!(startIso && endIso && endIso < startIso);
  const typeHint = t(PEX_TYPE_HINT[type || "Oylik"] ?? PEX_TYPE_HINT.Oylik);

  async function save() {
    if (saving) return;
    if (!name.trim()) {
      setNameErr(t("Nomini kiriting"));
      return;
    }
    setSaving(true);
    const url = expense ? `/api/planned-expenses/${expense.id}` : "/api/planned-expenses";
    try {
      const res = await fetch(url, {
        method: expense ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          amount: amount ? Number(amount) : 0,
          type,
          status,
          startDate: startIso,
          endDate: endIso,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data.expense as PlannedExpense);
      showSuccess(expense ? t("Xarajat yangilandi") : t("Xarajat qo'shildi"));
      setSaving(false);
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const dateRow = (id: string, value: Date | null, set: (d: Date | null) => void) => (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <V2DateField id={id} value={value} onChange={set} />
      </div>
      {value && (
        <button type="button" onClick={() => set(null)} title={t("Tozalash")} aria-label={t("Tozalash")} className={secondaryIcon}>
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </div>
  );

  return (
    <V2Dialog
      title={expense ? t("Xarajatni tahrirlash") : t("Xarajat qo'shish")}
      subtitle={t("Moliyaviy rejaning xarajat qismiga tushadi")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void save()}
      width={520}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")} htmlFor="pex-name" error={nameErr || undefined} hint={nameErr ? undefined : t("Kassadagi chiqim turi nomi bilan bir xil bo'lsin")}>
          <TextInput
            id="pex-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameErr("");
            }}
            state={nameErr ? "error" : "default"}
            autoComplete="off"
            placeholder={t("Masalan: Ijara")}
          />
        </Field>

        <Field label={t("Miqdori")} htmlFor="pex-amount">
          <MoneyField id="pex-amount" compact value={amount} onChange={setAmount} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Turi")} hint={typeHint}>
            <V2Select
              label={t("Turi")}
              value={type}
              onChange={setType}
              options={EXPENSE_TYPES.map((tv: string) => ({ value: tv, label: tv }))}
              placeholder="Tanlang"
              searchable={false}
            />
          </Field>
          <Field label={t("Holati")}>
            <V2Select
              label={t("Holati")}
              value={status}
              onChange={setStatus}
              options={EXPENSE_STATUSES.map((s: string) => ({ value: s, label: s }))}
              placeholder="Tanlang"
              searchable={false}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Boshlanish sanasi")} optional htmlFor="pex-start">
            {dateRow("pex-start", startDate, setStartDate)}
          </Field>
          <Field label={t("Tugash sanasi")} optional htmlFor="pex-end">
            {dateRow("pex-end", endDate, setEndDate)}
          </Field>
        </div>
        {rangeBackwards && <FieldWarning>{t("Tugash sanasi boshlanishidan oldin — bu xarajat rejaga hech qachon tushmaydi.")}</FieldWarning>}
      </div>
    </V2Dialog>
  );
}
