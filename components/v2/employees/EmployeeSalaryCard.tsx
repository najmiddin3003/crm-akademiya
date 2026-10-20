"use client";

import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Settings2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import {
  payrollFoizPart,
  payrollHasFoiz,
  payrollHasOklad,
  payrollOkladDays,
  payrollOkladPart,
  payrollOwedTotal,
  payrollCashLeg,
  payrollPlastikLeg,
  payrollTax,
  type EmployeePayroll,
  type PayrollPeriod,
} from "@/lib/salary";
import { fmtSum } from "./employeeBits";

// YANGI VERSIYA — XODIM PROFILI → «OYLIK · OKTABR 2026» (rasm «Xodim profili», 20.10.2026):
// «1–12-oktabr hisobi (12/31 kun)»; qatorlar Oklad («1 000 000 × 12/31 kun»), Foiz · 30%
// («0 so'm tushum × 30%»), Bonus, Jarima, Avans, O'tgan oydan; `brand-bg` blokda
// «Qolgan oylik 387 097 so'm»; «Oylik chiqarishda ochish →».
//
// Raqamlar Oylik chiqarish bilan BITTA manbadan (/api/salary-runs/employees-payroll →
// lib/salary.ts), bu yerda hisob yo'q — faqat ko'rsatish. Qatorlar yig'indisi «Qolgan
// oylik»ka teng: rasmdagidan tashqari faqat qiymati bo'lganda Soliq va «Berilgan oylik»
// ham chiqadi; «O'tgan oydan» = shu oyda to'lanadigan + o'z oyidan chiqariladigan qoldiq
// (`payrollOwedTotal`, eski profil va ro'yxatdagi bilan bir xil).

export type SalaryCardState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "row"; row: EmployeePayroll }
  /** Xodim shu filialning oylik ro'yxatida yo'q — `branch` — u qaysi filial ro'yxatida. */
  | { kind: "elsewhere"; branch: string }
  | { kind: "archived" };

export default function EmployeeSalaryCard({
  state,
  period,
  canPayroll,
  canConfigure,
  onConfigure,
}: {
  state: SalaryCardState;
  period: PayrollPeriod;
  canPayroll: boolean;
  canConfigure: boolean;
  onConfigure: () => void;
}) {
  const { t, months } = useT();
  const month = (months[period.month] ?? "").toLowerCase();
  const title = `${t("Oylik")} · ${month} ${period.year}`;

  const shell = (body: ReactNode, sub?: string) => (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm" aria-label={title}>
      <h2 className="text-v2-section text-v2-text">{title}</h2>
      {sub && <p className="mt-0.5 text-v2-small text-v2-text-2">{sub}</p>}
      {body}
    </section>
  );
  const periodSub = t("1–{day}-{month} hisobi ({day}/{daysIn} kun)", { day: period.day, month, daysIn: period.daysIn });

  if (state.kind === "loading") {
    return shell(
      <div className="mt-4 space-y-3" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-24 rounded bg-v2-skeleton" />
            <div className="h-3 w-16 rounded bg-v2-skeleton" />
          </div>
        ))}
        <div className="h-12 rounded-v2-md bg-v2-skeleton" />
      </div>,
      periodSub,
    );
  }
  const note = (text: string, action?: ReactNode) =>
    shell(
      <div className="mt-4 flex items-start gap-2 rounded-v2-md bg-v2-surface-2 px-3 py-3 text-v2-small text-v2-text-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
        <div className="min-w-0">
          <p>{text}</p>
          {action}
        </div>
      </div>,
      periodSub,
    );
  if (state.kind === "error") return note(t("Oylik ma'lumotini olib bo'lmadi. Sahifani yangilab ko'ring."));
  if (state.kind === "archived") return note(t("Xodim arxivda — oylik hisoblanmaydi."));
  if (state.kind === "elsewhere") {
    return note(
      state.branch
        ? t("Shu filial oylik ro'yxatida yo'q — oyligi «{branch}» ro'yxatida hisoblanadi.", { branch: state.branch })
        : t("Shu filial oylik ro'yxatida yo'q — oyligi boshqa filial ro'yxatida hisoblanadi."),
    );
  }

  const e = state.row;
  if (!e.configured) {
    return note(
      t("Ish haqi sozlanmagan — oylik hisoblanmaydi."),
      canConfigure ? (
        <button type="button" onClick={onConfigure} className="mt-2 inline-flex items-center gap-1.5 font-medium text-v2-brand-text underline-offset-2 hover:underline">
          <Settings2 className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Ish haqini sozlash")}
        </button>
      ) : undefined,
    );
  }

  const tax = payrollTax(e, period);
  const carry = e.carryOver + (e.carryPending ?? 0);
  const owed = payrollOwedTotal(e, period);
  const karta = payrollPlastikLeg(e, period);
  const naqd = payrollCashLeg(e, period);
  const pending = (e.carryPendingMonths ?? []).filter((pm) => pm.amount > 0);
  const monthLabel = (key: string) => {
    const i = Number(key.slice(5, 7)) - 1;
    return i >= 0 && i < 12 ? `${(months[i] ?? "").toLowerCase()} ${key.slice(0, 4)}` : key;
  };

  type Line = { key: string; label: string; sub?: string; value: number; minus?: boolean; tone?: string };
  const lines: Line[] = [];
  if (payrollHasOklad(e)) {
    lines.push({
      key: "oklad",
      label: t("Oklad"),
      sub: t("{fixedSalary} × {day}/{daysIn} kun", { fixedSalary: fmtSum(e.fixedSalary), day: payrollOkladDays(e, period), daysIn: period.daysIn }),
      value: payrollOkladPart(e, period),
    });
  }
  if (payrollHasFoiz(e)) {
    lines.push({
      key: "foiz",
      label: `${t("Foiz")} · ${e.percent}%`,
      sub: t("{amount} so'm tushum × {percent}%", { amount: fmtSum(e.collected), percent: e.percent }),
      value: payrollFoizPart(e),
    });
  }
  lines.push({ key: "bonus", label: t("Bonus"), value: e.bonus });
  lines.push({ key: "jarima", label: t("Jarima"), value: e.jarima, minus: true, tone: "text-v2-danger" });
  if (tax > 0) lines.push({ key: "soliq", label: t("Soliq"), value: tax, minus: true, tone: "text-v2-danger" });
  lines.push({ key: "avans", label: t("Avans"), value: e.paidAvans, minus: true, tone: "text-v2-warning" });
  if (e.paidOylik > 0) lines.push({ key: "oylik", label: t("Berilgan oylik"), value: e.paidOylik, minus: true, tone: "text-v2-warning" });
  lines.push({
    key: "carry",
    label: t("O'tgan oydan"),
    sub: pending.length > 0 ? t("o'z oyidan chiqariladi: {months}", { months: pending.map((pm) => `${monthLabel(pm.month)} — ${fmtSum(pm.amount)}`).join(", ") }) : e.carryNote || undefined,
    value: carry,
  });

  return shell(
    <>
      <dl className="mt-3 divide-y divide-v2-border">
        {lines.map((l) => (
          <div key={l.key} className="flex items-start justify-between gap-3 py-2.5">
            <dt className="min-w-0">
              <div className="text-v2-body text-v2-text">{l.label}</div>
              {l.sub && <div className="mt-0.5 text-v2-caption font-normal tabular-nums text-v2-text-3">{l.sub}</div>}
            </dt>
            <dd className={`shrink-0 font-semibold tabular-nums ${l.value !== 0 && l.tone ? l.tone : l.value < 0 ? "text-v2-danger" : "text-v2-text"}`}>
              {l.minus && l.value > 0 ? `−${fmtSum(l.value)}` : fmtSum(l.value)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-v2-md bg-v2-brand-bg px-4 py-3">
        <span className="text-v2-body font-medium text-v2-text">{t("Qolgan oylik")}</span>
        <span className="whitespace-nowrap">
          <b className={`text-[22px] font-semibold leading-7 tabular-nums ${owed < 0 ? "text-v2-danger" : "text-v2-text"}`}>{fmtSum(owed)}</b>{" "}
          <span className="text-v2-small text-v2-text-2">{t("so'm")}</span>
        </span>
      </div>
      {karta > 0 && (
        <p className="mt-1.5 text-v2-caption tabular-nums text-v2-text-3">{t("kartaga {kartaga} · naqd {naqd}", { kartaga: fmtSum(karta), naqd: fmtSum(naqd) })}</p>
      )}
      {canPayroll && (
        <Link href="/finance-payroll" className="mt-3 inline-flex items-center gap-1.5 text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline">
          {t("Oylik chiqarishda ochish")}
          <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
        </Link>
      )}
    </>,
    periodSub,
  );
}
