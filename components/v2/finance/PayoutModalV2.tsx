"use client";

import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown, Crown, Info, Loader2, Wallet, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import type { PayrollState } from "@/components/finance/usePayroll";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { payrollCashLeg, payrollDue, payrollPayout, payrollPlastikLeg, payrollTax, type EmployeePayroll } from "@/lib/salary";

// YANGI VERSIYA — «OYLIKNI CHIQARISH» OYNASI (rasm «Oylikni chiqarish oynasi»,
// yorug'/qorong'i, 19.10.2026): davr va hisoblangan vaqt, brend fonda
// chiqariladigan summa, kimga qancha (kartaga · naqd · soliq), «Qaysi
// kassadan» (bosh kassada toj, ostida qoldiq), «To'lov turi» (plastik / naqd
// oyoqlari, ostida kassadagi summa), ixtiyoriy izoh, nima bo'lishi va
// «Tasdiqlash va chiqarish».
//
// Hisob, chegara va so'rov — components/finance/usePayroll.ts (eski oyna bilan
// bitta): tugma eskisidagi `canPayout` / `canKarta` bilan yoqiladi va o'chiq
// bo'lsa sababi doim yoziladi. «Faqat kartani chiqarish» ham shu oyna
// (`mode="karta"`). Qobiq — eski ui/Modal (portal); ichki blok `data-ui="v2"`.

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Tarjima qilingan gapdagi `{token}` o'rniga element (masalan qalin summa). */
function withNode(text: string, token: string, node: ReactNode): ReactNode {
  const mark = `{${token}}`;
  const i = text.indexOf(mark);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      {node}
      {text.slice(i + mark.length)}
    </>
  );
}

/** ActionMenu'da belgisiz bandlar ham bir chiziqda tursin — bo'sh ikonka. */
function Blank({ className }: { className?: string }) {
  return <span className={className} aria-hidden />;
}

interface Row {
  e: EmployeePayroll;
  amount: number;
  parts: string[];
}

interface View {
  rows: Row[];
  total: number;
  plastik: number;
  naqd: number;
  tax: number;
}

export default function PayoutModalV2({ mode, p, onClose }: { mode: "all" | "karta"; p: PayrollState; onClose: () => void }) {
  const { t, months } = useT();
  const noteId = useId();
  const [note, setNote] = useState("");
  // Yuborilgan paytdagi ko'rinish — muvaffaqiyatdan keyin tanlov tozalanadi va
  // oyna yopilish animatsiyasida «0 xodim» bo'lib miltillamasin.
  const [snapshot, setSnapshot] = useState<View | null>(null);
  const karta = mode === "karta";
  const { period, monthLabel, loadedAt, isPastMonth, saving } = p;

  /* ---- Kimga qancha (o'z hisobi — lib/salary.ts) ---- */
  const live: View = (() => {
    if (karta) {
      const rows = p.kartaRows.map(({ e, amount }) => ({ e, amount, parts: [t("kartaga {amount}", { amount: fmtNum(amount) })] }));
      return { rows, total: p.kartaTotal, plastik: p.kartaTotal, naqd: 0, tax: 0 };
    }
    let tax = 0;
    const rows = p.employees
      .filter((e) => e.configured && p.selected.has(e.id))
      .map((e) => {
        const amount = payrollPayout(e, period);
        const plastik = payrollPlastikLeg(e, period);
        const naqd = payrollCashLeg(e, period);
        const eTax = payrollTax(e, period);
        tax += eTax;
        const parts: string[] = [];
        if (amount <= 0) {
          const due = payrollDue(e, period);
          parts.push(due < 0 ? t("qarzdor {amount}", { amount: fmtNum(-due) }) : t("to'lanadigan qoldiq yo'q"));
        } else {
          if (plastik > 0) parts.push(t("kartaga {amount}", { amount: fmtNum(plastik) }));
          if (naqd > 0) parts.push(t("naqd {amount}", { amount: fmtNum(naqd) }));
        }
        if (eTax > 0) parts.push(t("soliq {amount}", { amount: fmtNum(eTax) }));
        if (e.plastikSalary <= 0) parts.push(t("kartasiz"));
        return { e, amount, parts };
      });
    return { rows, total: p.payoutTotal, plastik: p.plastikTotal, naqd: p.naqdTotal, tax };
  })();
  const view = snapshot ?? live;

  /* ---- Davr ---- */
  const monthLower = (months[period.month] ?? "").toLowerCase();
  const range = t("1-{month}dan {day}-{month}", { month: monthLower, day: period.day });
  const subtitle = isPastMonth
    ? `${range} | ${t("to'liq oy")}`
    : loadedAt ? `${range} | ${t("{time} gacha hisoblandi", { time: loadedAt })}` : range;

  /* ---- Kassa va to'lov turlari ---- */
  const box = p.activeCashbox;
  const methodName = (key: string) => p.paymentMethods.find((m) => m.key === key)?.name ?? key;
  const inBox = (key: string) => Number(box?.methodTotals?.[key]) || 0;
  const showPlastik = karta || view.plastik > 0;
  const showNaqd = !karta && (view.naqd > 0 || view.plastik === 0);
  const short = karta ? p.kartaShort > 0 : p.notEnough;
  const canSubmit = karta ? p.canKarta : p.canPayout;

  const cashboxItems: ActionMenuEntry[] = p.cashboxes.map((c) => ({
    key: String(c.id),
    label: c.name,
    icon: c.isPrimary ? Crown : Wallet,
    hint: fmtNum(c.balance),
    onSelect: () => p.setCashboxId(String(c.id)),
  }));
  const methodItems = (current: string, pick: (key: string) => void): ActionMenuEntry[] =>
    p.paymentMethods.map((m) => ({
      key: m.key,
      label: m.name,
      icon: m.key === current ? Check : Blank,
      hint: fmtNum(inBox(m.key)),
      onSelect: () => pick(m.key),
    }));

  function methodRow(kind: "plastik" | "naqd") {
    const isPl = kind === "plastik";
    const key = isPl ? p.plastikMethodKey : p.methodKey;
    const amount = isPl ? view.plastik : view.naqd;
    return (
      <ActionMenu
        key={kind}
        items={methodItems(key, isPl ? p.setPlastikMethod : p.setMethod)}
        label={isPl ? t("Plastik qismi uchun to'lov turi") : t("Naqd qismi uchun to'lov turi")}
        align="start"
        width={260}
      >
        {(trigger, open) => (
          <button
            type="button"
            {...trigger}
            disabled={saving || p.methodsLoading}
            title={t("To'lov turini almashtirish")}
            className="group/m flex w-full items-center gap-2 rounded-v2-sm py-1 text-left text-v2-small focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-default"
          >
            <span className={`size-2 shrink-0 rounded-[2px] ${isPl ? "bg-v2-violet" : "bg-v2-success"}`} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-v2-text">
              {key ? methodName(key) : t("Tanlang")}
              {isPl && <span className="text-v2-text-2"> · {t("kartaga")}</span>}
            </span>
            <ChevronDown
              className={`size-3.5 shrink-0 text-v2-text-3 transition-opacity ${open ? "opacity-100" : "opacity-0 group-hover/m:opacity-100 group-focus-visible/m:opacity-100"}`}
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="shrink-0 font-semibold tabular-nums text-v2-text">{fmtNum(amount)}</span>
          </button>
        )}
      </ActionMenu>
    );
  }

  // Kassadagi summa — rasmdagidek bitta qator (naqd oyog'i; faqat karta bo'lsa —
  // plastik). Ikkinchi oyoq YETMASA u ham alohida qizil qatorda aytiladi; boshqa
  // turlardagi summa — to'lov turi menyusida, kassaning umumiy qoldig'i — chapda.
  const mainLeg = showNaqd ? { key: p.methodKey, have: p.available, need: view.naqd } : { key: p.plastikMethodKey, have: p.plastikAvailable, need: view.plastik };
  const otherLeg = showNaqd && showPlastik ? { key: p.plastikMethodKey, have: p.plastikAvailable, need: view.plastik } : null;
  const legLine = (leg: { key: string; have: number }) => t("Kassada {method}: {amount} so'm", { method: methodName(leg.key), amount: fmtNum(leg.have) });
  const sameBucket = otherLeg !== null && otherLeg.key === mainLeg.key;
  const mainShort = !snapshot && (sameBucket ? mainLeg.have < view.total : mainLeg.have < mainLeg.need);
  const otherShort = !snapshot && otherLeg !== null && !sameBucket && otherLeg.have < otherLeg.need;

  /* ---- Ogohlantirishlar (eski oynadagi bilan bir xil) — tugma o'chiq bo'lsa sababi doim ko'rinadi ---- */
  const issues: ReactNode[] = [];
  const line = (key: string, text: string, tone: "warning" | "danger" = "danger") =>
    issues.push(
      <p key={key} className={`text-v2-small ${tone === "danger" ? "text-v2-danger" : "text-v2-warning"}`}>
        {text}
      </p>,
    );
  if (!snapshot) {
    if (p.payoutBlockedReason) line("blocked", p.payoutBlockedReason);
    if (!karta && p.sameMethod) line("same", t("Plastik va naqd uchun bir xil to'lov turi tanlangan — birini o'zgartiring, aks holda jurnalda ikki qism ajralmay qoladi."));
    if (!karta && p.payoutTotal === 0) line("zero", t("Tanlangan xodimlarda to'lanadigan qoldiq yo'q — oylik allaqachon chiqarilgan yoki qarzdorlik bor."), "warning");
    // O'TGAN OYLARDA TO'LANMAGAN qoldiq bu chiqarishga KIRMAYDI (04.10.2026, «faqat o'z oyidan»).
    if (!karta && p.selectedPendingTotal > 0) {
      line(
        "pending",
        t("Tanlanganlarning o'tgan oylardan to'lanmagan {amount} qoldig'i bu summaga kirmaydi — u {months} sahifasidan chiqariladi.", {
          amount: `${fmtNum(p.selectedPendingTotal)} ${t("so'm")}`,
          months: p.selectedPending.map((pm) => p.pendingMonthLabel(pm.month)).join(", "),
        }),
        "warning",
      );
    }
    // O'TGAN OY sahifasi: bu oy puli joriy oyda allaqachon berilgan bo'lishi mumkin.
    if (!karta && p.selectedMaybePaid.length > 0) {
      issues.push(
        <div key="maybe" className="rounded-v2-md bg-v2-danger-bg px-3 py-2 text-v2-small text-v2-danger">
          {t("{count} ta tanlangan xodimda bu oy puli keyingi oyda allaqachon berilgan bo'lishi mumkin: {list}. Qayta chiqarilsa ikki marta to'lanadi — avval o'sha yozuvlarning oyini tekshiring.", {
            count: p.selectedMaybePaid.length,
            list: p.selectedMaybePaid.map((e) => `${e.name} — ${fmtNum(e.maybePaidIn!.amount)} (${p.pendingMonthLabel(e.maybePaidIn!.month)})`).join(", "),
          })}{" "}
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              p.setSelected((prev) => {
                const next = new Set(prev);
                for (const e of p.selectedMaybePaid) next.delete(e.id);
                return next;
              })
            }
            className="font-semibold underline underline-offset-2 hover:no-underline disabled:opacity-50"
          >
            {t("Ularni tanlovdan chiqarish")}
          </button>
        </div>,
      );
    }
    if (short) {
      line("short", t("Mablag' yetarli emas — {available} kam. Boshqa kassa yoki to'lov turini tanlang.", { available: `${fmtNum(karta ? p.kartaShort : p.shortfall)} ${t("so'm")}` }));
    }
    if (!p.cashboxesLoading && !p.cashboxId) line("box", t("Kassani tanlang"));
    if (!karta && !p.methodsLoading && !p.methodKey) line("method", t("To'lov turini tanlang"));
    if (karta ? !p.methodsLoading && !p.plastikMethodKey : p.needsPlastikMethod) line("pmethod", t("Plastik qismi uchun to'lov turini tanlang"));
  }

  /* ---- Nima bo'ladi ---- */
  const boxName = box?.name ?? t("tanlangan kassa");
  const info: ReactNode = karta ? (
    <>
      {withNode(t("Tasdiqlansa, {cashbox}dan {amount} yoziladi", { cashbox: boxName }), "amount", <b className="font-semibold">{t("{amount} so'm plastik chiqim", { amount: fmtNum(view.total) })}</b>)}
      {". "}
      {t("Naqd qismi «Qolgan oylik»da qoladi — keyin «Oylikni chiqarish» yoki kassadan beriladi.")}
    </>
  ) : (
    <>
      {withNode(t("Tasdiqlansa, {cashbox}dan {amount} yoziladi", { cashbox: boxName }), "amount", <b className="font-semibold">{t("{amount} so'm chiqim", { amount: fmtNum(view.total) })}</b>)}
      {view.plastik > 0 && view.naqd > 0
        ? t(": plastik {plastik}, naqd {naqd}.", { plastik: fmtNum(view.plastik), naqd: fmtNum(view.naqd) })
        : view.plastik > 0 ? t(": plastik {plastik}.", { plastik: fmtNum(view.plastik) }) : "."}
      {view.tax > 0 && ` ${t("Ushlangan {amount} so'm soliq chiqarishlar tarixida qayd etiladi.", { amount: fmtNum(view.tax) })}`}
      {` ${t("To'langan xodimlarning shu oy qolgan oyligi 0 bo'ladi.")}`}
    </>
  );

  async function confirm(close: () => void) {
    setSnapshot(live);
    if (await p.submitPayout(karta, note)) close();
    else setSnapshot(null);
  }

  return (
    <Modal
      onClose={onClose}
      locked={saving}
      bare
      size="xl"
      zIndex={110}
      panelClassName="bg-transparent! border-0! shadow-none! rounded-none! overflow-hidden"
    >
      {(modal) => (
        <div data-ui="v2" className="flex max-h-[90vh] min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface font-v2 text-v2-text shadow-v2-md">
          {/* Sarlavha */}
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0">
              <h2 className="text-v2-section text-v2-text">{karta ? t("Kartaga chiqarish") : t("Oylikni chiqarish")}</h2>
              <p className="mt-0.5 text-v2-small tabular-nums text-v2-text-2">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={modal.close}
              disabled={saving}
              aria-label={t("Yopish")}
              className="-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text disabled:opacity-50"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
            {/* Chiqariladigan summa */}
            <div className="flex items-end justify-between gap-4 rounded-v2-lg bg-v2-brand-bg px-4 py-3.5">
              <div className="min-w-0">
                <div className="text-v2-caption text-v2-brand-text">{karta ? t("Kartaga chiqariladigan summa") : t("Chiqariladigan summa")}</div>
                <div className="mt-1 whitespace-nowrap">
                  <span className="text-v2-number tabular-nums text-v2-text">{fmtNum(view.total)}</span>{" "}
                  <span className="text-v2-body text-v2-text-2">{t("so'm")}</span>
                </div>
              </div>
              <div className="shrink-0 pb-1 text-right text-v2-small">
                <div className="font-semibold text-v2-text">{t("{n} xodim", { n: view.rows.length })}</div>
                <div className="text-v2-text-2">{monthLabel}</div>
              </div>
            </div>
            {isPastMonth && (
              <p className="-mt-2 text-v2-caption font-normal text-v2-warning">{t("Chiqim yozuvi {monthLabel} oyining oxirgi kuni bilan qayd etiladi.", { monthLabel })}</p>
            )}

            {/* Kimga qancha */}
            {view.rows.length > 0 && (
              <ul className="max-h-[216px] divide-y divide-v2-border overflow-y-auto rounded-v2-lg border border-v2-border">
                {view.rows.map(({ e, amount, parts }) => (
                  <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full border border-v2-border bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
                      {initials(e.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-v2-small font-semibold text-v2-text">{e.name}</div>
                      <div className="truncate text-v2-caption font-normal tabular-nums text-v2-text-3">{parts.join(" · ")}</div>
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-right">
                      <span className="text-v2-small font-semibold tabular-nums text-v2-text">{fmtNum(amount)}</span>{" "}
                      <span className="text-v2-caption font-normal text-v2-text-2">{t("so'm")}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Kassa va to'lov turi */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-1.5 text-v2-caption text-v2-text">{t("Qaysi kassadan")}</div>
                <ActionMenu items={cashboxItems} label={t("Qaysi kassadan")} align="start" width={300}>
                  {(trigger, open) => (
                    <button
                      type="button"
                      {...trigger}
                      disabled={saving || p.cashboxesLoading || p.cashboxes.length === 0}
                      className={`flex h-10 w-full items-center gap-2 rounded-v2-md border bg-v2-surface px-2.5 text-left transition-[border-color,box-shadow] focus-visible:border-v2-brand focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-default disabled:bg-v2-surface-2 ${
                        open ? "border-v2-brand shadow-v2-focus" : "border-v2-border-field"
                      }`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-v2-sm ${box?.isPrimary ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-surface-2 text-v2-text-2"}`}
                        aria-hidden
                      >
                        {box?.isPrimary ? <Crown className="size-3.5" strokeWidth={1.75} /> : <Wallet className="size-3.5" strokeWidth={1.75} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-v2-small">
                        <span className="font-semibold text-v2-text">
                          {box?.name ?? (p.cashboxesLoading ? t("Yuklanmoqda…") : t("Kassa topilmadi"))}
                        </span>
                        {box?.isPrimary && <span className="text-v2-text-3"> · {t("Bosh kassa")}</span>}
                      </span>
                      <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
                    </button>
                  )}
                </ActionMenu>
                {box && <p className="mt-1.5 text-v2-caption font-normal tabular-nums text-v2-text-3">{t("Qoldiq: {amount} so'm", { amount: fmtNum(box.balance) })}</p>}
              </div>
              <div className="min-w-0">
                <div className="mb-1.5 text-v2-caption text-v2-text">{t("To'lov turi")}</div>
                <div className="rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-1.5">
                  {showPlastik && methodRow("plastik")}
                  {showNaqd && methodRow("naqd")}
                </div>
                {box && mainLeg.key && (
                  <p className={`mt-1.5 text-v2-caption font-normal tabular-nums ${mainShort ? "text-v2-danger" : "text-v2-text-3"}`}>{legLine(mainLeg)}</p>
                )}
                {box && otherLeg && otherShort && <p className="mt-0.5 text-v2-caption font-normal tabular-nums text-v2-danger">{legLine(otherLeg)}</p>}
              </div>
            </div>

            {/* Izoh */}
            <div>
              <label htmlFor={noteId} className="mb-1.5 block text-v2-caption text-v2-text">
                {t("Izoh")} <span className="font-normal text-v2-text-3">({t("ixtiyoriy")})</span>
              </label>
              <textarea
                id={noteId}
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
                rows={2}
                maxLength={200}
                disabled={saving}
                placeholder={t("Masalan: {month} oyi uchun oylikning birinchi qismi", { month: monthLower })}
                className="block w-full resize-none rounded-v2-md border border-v2-border-field bg-v2-surface! px-3 py-2 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none disabled:bg-v2-surface-2!"
              />
            </div>

            {issues.length > 0 && <div className="space-y-1.5">{issues}</div>}

            {/* Nima bo'ladi */}
            <div className="flex gap-2.5 rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
              <Info className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
              <p className="min-w-0">{info}</p>
            </div>
          </div>

          {/* Tugmalar */}
          {/* Telefonda ikkalasi to'liq kenglikda, asosiysi tepada (flex-col-reverse). */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-v2-border bg-v2-surface-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={modal.close} disabled={saving} className={`${secondaryBtn} justify-center disabled:opacity-60`}>
              {t("Bekor qilish")}
            </button>
            <button
              type="button"
              onClick={() => confirm(modal.close)}
              disabled={saving || !canSubmit}
              className={`${primaryBtn} justify-center disabled:cursor-not-allowed disabled:bg-v2-border-strong disabled:text-v2-text-3 disabled:hover:brightness-100`}
            >
              {saving ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Check className="size-4" strokeWidth={2.25} aria-hidden />}
              {saving ? t("Chiqarilmoqda…") : karta ? t("Tasdiqlash va kartaga chiqarish") : t("Tasdiqlash va chiqarish")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
