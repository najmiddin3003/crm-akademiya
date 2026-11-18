"use client";

import { useState } from "react";
import { Users, type LucideIcon } from "lucide-react";
import { MoneyField } from "@/components/v2/form/fields";

// 39-qism — Moliya sozlamalari sahifalarining umumiy bo'laklari (Bonus va KPI, Chegirmalar, Hamkorlar):
// tugmacha, fokusdan chiqqanda saqlanadigan summa/foiz maydoni, qoida qatori, karta, «Tez orada» belgisi.

type Wallet = LucideIcon;

export function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-v2-brand" : "bg-v2-border-strong"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Summa/foiz maydoni — o'zgarish fokusdan chiqqanda saqlanadi. `key` saqlangan qiymat bilan — qayta yuklanganda yangilanadi. */
export function AmountEditor({ initial, label, percent, onSave, disabled, wide }: { initial: number; label: string; percent?: boolean; onSave: (n: number) => void; disabled?: boolean; wide?: boolean }) {
  const [v, setV] = useState(initial ? String(initial) : "");
  const commit = () => {
    const n = Number(v || 0);
    if (n !== initial) onSave(n);
  };
  if (percent)
    return (
      <div className="flex items-center gap-1.5">
        <input aria-label={label} inputMode="numeric" disabled={disabled} value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 3))} onBlur={commit} className="h-9 w-16 rounded-v2-md border border-v2-border bg-v2-surface px-2 text-right font-medium tabular-nums text-v2-text outline-none focus:border-v2-brand" />
        <span className="text-v2-small text-v2-text-3">%</span>
      </div>
    );
  return (
    <div className={wide ? "w-44" : "w-40"}>
      <MoneyField compact value={v} onChange={setV} onBlur={commit} ariaLabel={label} disabled={disabled} />
    </div>
  );
}

export function Rule({ icon: Icon, tone, title, sub, badge, children }: { icon: Wallet; tone: string; title: string; sub: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-v2-md ${tone}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-[180px] flex-1">
        <div className="text-v2-small font-semibold text-v2-text">
          {title} {badge}
        </div>
        <div className="text-v2-small text-v2-text-2">{sub}</div>
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </li>
  );
}

export function Card({ icon: Icon, title, sub, chips, children }: { icon: Wallet; title: string; sub: string; chips?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-v2-text">{title}</h2>
          <p className="text-v2-small text-v2-text-2">{sub}</p>
        </div>
      </div>
      {chips && <div className="mt-3 flex flex-wrap gap-2">{chips}</div>}
      <ul className="mt-1 divide-y divide-v2-border">{children}</ul>
    </section>
  );
}

export const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-v2-border px-2.5 py-1 text-v2-caption text-v2-text-2">
    <Users className="size-3.5" aria-hidden /> {children}
  </span>
);
export const Soon = ({ label }: { label: string }) => <span className="ml-1 rounded-v2-sm bg-v2-info-bg px-1.5 text-v2-caption font-semibold text-v2-info">{label}</span>;

