"use client";

import { ArrowLeftRight, BriefcaseBusiness, CalendarCheck, ChevronUp, LogIn, LogOut, Megaphone, Settings2, ShieldAlert, Trash2, User, Users, Wallet, type LucideIcon } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { LOG_CATEGORIES, type LogCategory } from "@/lib/actionLogLabels";
import type { LogDiffRow, LogIcon, LogText, LogView } from "@/lib/actionLogView";

// YANGI VERSIYA — «AMALLAR JURNALI» BO'LAKLARI (rasm «Amallar jurnali», 25.10.2026, 14-qism):
// qator (vaqt, toifa ikonkasi va ulovchi chiziq, «Ism fe'l — obyekt», meta, o'ngda summa / belgi /
// «Yopish ⌃»), «oldin → keyin» jadvali, «Davr bo'yicha» va «Nima yoziladi» kartalari.

export type FeedRow = Omit<LogView, "search">;

const ICONS: Record<LogIcon, { icon: LucideIcon; cls: string }> = {
  login: { icon: LogIn, cls: "border border-v2-border bg-v2-surface-2 text-v2-text-2" },
  logout: { icon: LogOut, cls: "border border-v2-border bg-v2-surface-2 text-v2-text-2" },
  in: { icon: Wallet, cls: "bg-v2-success-bg text-v2-success" },
  out: { icon: Wallet, cls: "bg-v2-danger-bg text-v2-danger" },
  move: { icon: ArrowLeftRight, cls: "bg-v2-info-bg text-v2-info" },
  pupil: { icon: User, cls: "bg-v2-info-bg text-v2-info" },
  group: { icon: Users, cls: "bg-v2-info-bg text-v2-info" },
  lead: { icon: Megaphone, cls: "bg-v2-violet-bg text-v2-violet" },
  attendance: { icon: CalendarCheck, cls: "bg-v2-success-bg text-v2-success" },
  staff: { icon: BriefcaseBusiness, cls: "bg-v2-brand-bg text-v2-brand-text" },
  delete: { icon: Trash2, cls: "bg-v2-danger-bg text-v2-danger" },
  other: { icon: Settings2, cls: "border border-v2-border bg-v2-surface-2 text-v2-text-2" },
  denied: { icon: ShieldAlert, cls: "bg-v2-warning-bg text-v2-warning" },
};

/** Matn bo'lagi: kalit — `t()`, ma'lumot — o'zi; `pk` o'rinbosarlari ham o'giriladi (kichik harf). */
export function useLogText() {
  const { t, lang } = useT();
  return (x: LogText): string => {
    if ("v" in x) return x.v;
    const pk = Object.fromEntries(
      Object.entries(x.pk ?? {}).map(([k, v]) => {
        const s = t(v);
        return [k, lang === "en" ? s.charAt(0).toLowerCase() + s.slice(1) : s.charAt(0).toLocaleLowerCase("uz") + s.slice(1)];
      }),
    );
    return t(x.k, { ...(x.p ?? {}), ...pk });
  };
}

export function fmtSom(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/\s|,/g, " ");
}

function DiffTable({ rows, beforeKnown }: { rows: LogDiffRow[]; beforeKnown: boolean }) {
  const { t } = useT();
  const th = "py-2 pr-3 text-left text-v2-caption font-medium text-v2-text-2";
  // fmtValue mantiqiy qiymatni «ha»/«yo'q» deb beradi — tilga o'giriladi.
  const tv = (s: string) => (s === "ha" || s === "yo'q" ? t(s) : s);
  return (
    <div className="mt-3 overflow-x-auto rounded-v2-md border border-v2-border bg-v2-surface">
      <table className="w-full min-w-[300px] border-collapse text-v2-small">
        <thead>
          <tr className="border-b border-v2-border">
            <th className={`${th} w-[34%] pl-3`}>{t("Maydon")}</th>
            {beforeKnown && <th className={th}>{t("Oldin")}</th>}
            <th className={th}>{beforeKnown ? t("Keyin") : t("Yuborilgan qiymat")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className="border-b border-v2-border last:border-b-0">
              <td className="py-2 pl-3 pr-3 align-top text-v2-text-2">{r.label ? t(r.label) : r.field}</td>
              {beforeKnown && (
                <td className="py-2 pr-3 align-top">
                  {r.before ? (
                    <span className="rounded-[5px] bg-v2-danger-bg px-1.5 py-0.5 tabular-nums text-v2-danger line-through decoration-1">{tv(r.before)}</span>
                  ) : (
                    <span className="text-v2-text-3">—</span>
                  )}
                </td>
              )}
              <td className="py-2 pr-3 align-top">
                {r.after ? (
                  <span className="rounded-[5px] bg-v2-success-bg px-1.5 py-0.5 font-semibold tabular-nums text-v2-text">{tv(r.after)}</span>
                ) : (
                  <span className="text-v2-text-3">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!beforeKnown && <p className="border-t border-v2-border px-3 py-2 text-v2-caption font-normal text-v2-text-3">{t("Eski qiymat yozilmagan — faqat yuborilgan qiymat ko'rsatilgan.")}</p>}
    </div>
  );
}

export function LogRowItem({ row, open, onToggle, last }: { row: FeedRow; open: boolean; onToggle: () => void; last: boolean }) {
  const { t } = useT();
  const text = useLogText();
  const ic = ICONS[row.icon] ?? ICONS.other;
  const Icon = ic.icon;
  const expandable = row.diff.length > 0;
  const metaParts = row.meta.map(text).filter(Boolean);

  const right = open ? (
    <span className="inline-flex h-7 items-center gap-1 rounded-v2-md bg-v2-surface px-2 text-v2-caption font-medium text-v2-text-2 shadow-v2-sm">
      {t("Yopish")}
      <ChevronUp className="size-3.5" strokeWidth={2} aria-hidden />
    </span>
  ) : row.badge === "deleted" ? (
    <span className="inline-flex h-6 items-center rounded-v2-full bg-v2-danger-bg px-2 text-v2-caption font-medium text-v2-danger">{t("O'chirilgan")}</span>
  ) : row.badge === "denied" ? (
    <span className="inline-flex h-6 items-center rounded-v2-full bg-v2-warning-bg px-2 text-v2-caption font-medium text-v2-warning">{t("Rad etildi")}</span>
  ) : row.amount !== null ? (
    <span className={`whitespace-nowrap text-v2-body font-semibold tabular-nums ${row.amountTone === "in" ? "text-v2-success" : row.amountTone === "out" ? "text-v2-danger" : "text-v2-text"}`}>
      {row.amountTone === "in" ? "+" : row.amountTone === "out" ? "−" : ""}
      {fmtSom(row.amount)} <span className="text-v2-caption font-normal text-v2-text-2">{t("so'm")}</span>
    </span>
  ) : null;

  const body = (
    <>
      <span className="w-11 shrink-0 pt-0.5 text-v2-small tabular-nums text-v2-text-2">{row.time}</span>
      <span className="relative flex w-7 shrink-0 justify-center">
        <span className={`relative z-[1] flex size-7 items-center justify-center rounded-full ${ic.cls}`} aria-hidden>
          <Icon className="size-3.5" strokeWidth={1.9} />
        </span>
        {!last && !open && <span className="absolute left-1/2 top-8 h-[calc(100%+4px)] w-px -translate-x-1/2 bg-v2-border" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-v2-body leading-5 text-v2-text">
          <span className="font-semibold">{text(row.actor)}</span> {t(row.verb)}
          {row.object && (
            <>
              {" — "}
              <span className="font-medium">{row.object}</span>
            </>
          )}
        </span>
        {metaParts.length > 0 && <span className="mt-0.5 block text-v2-caption font-normal text-v2-text-2 sm:truncate">{metaParts.join(" · ")}</span>}
        {/* Telefonda summa / belgi pastga tushadi — sarlavha butun kenglikni oladi. */}
        {right && <span className="mt-1.5 flex sm:hidden">{right}</span>}
      </span>
      {right && <span className="hidden shrink-0 pl-2 sm:block">{right}</span>}
    </>
  );

  if (!expandable) return <li className="flex items-start gap-2.5 px-4 py-2.5">{body}</li>;
  return (
    <li className={open ? "mx-2 my-1 rounded-v2-lg bg-v2-surface-2 px-2 py-2.5" : ""}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-start gap-2.5 text-left focus-visible:outline-none focus-visible:shadow-v2-focus ${open ? "rounded-v2-md px-2" : "rounded-v2-md px-4 py-2.5 hover:bg-v2-surface-2"}`}
      >
        {body}
      </button>
      {open && (
        <div className="mx-1 sm:ml-[94px] sm:mr-2">
          <DiffTable rows={row.diff} beforeKnown={row.beforeKnown} />
        </div>
      )}
    </li>
  );
}

/** «Davr bo'yicha» — toifalar sonlari (chiziqlar). `counts` hali kelmagan bo'lsa — skelet. */
export function PeriodCard({ counts }: { counts: Record<string, number> | null }) {
  const { t } = useT();
  const cats = LOG_CATEGORIES.filter((c) => (counts?.[c.key] ?? 0) > 0);
  const max = Math.max(1, ...cats.map((c) => counts?.[c.key] ?? 0));
  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-v2-body font-semibold text-v2-text">{t("Davr bo'yicha")}</h2>
        {counts && <span className="text-v2-caption font-normal text-v2-text-3">{t("{n} ta amal", { n: counts.all ?? 0 })}</span>}
      </div>
      {!counts ? (
        <div className="space-y-3" aria-hidden>
          {[70, 45, 30].map((w) => (
            <div key={w} className="flex items-center gap-2.5">
              <div className="h-2.5 w-20 rounded bg-v2-skeleton" />
              <div className="h-1.5 rounded-full bg-v2-skeleton" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : cats.length === 0 ? (
        <p className="text-v2-caption font-normal text-v2-text-3">{t("Bu davrda amal yo'q")}</p>
      ) : (
        <ul className="space-y-2.5">
          {cats.map((c) => {
            const n = counts?.[c.key] ?? 0;
            return (
              <li key={c.key} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2.5">
                <span className="truncate text-v2-small text-v2-text-2">{t(c.label)}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-v2-hover" aria-hidden>
                  <span className="block h-full rounded-full bg-v2-series-1" style={{ width: `${Math.max(6, (n / max) * 100)}%` }} />
                </span>
                <span className="min-w-6 text-right text-v2-small font-semibold tabular-nums text-v2-text">{n}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** «Nima yoziladi» — toifalar izohi (rasmdagidek). */
export function AboutCard({ shown }: { shown: LogCategory[] }) {
  const { t } = useT();
  const list = LOG_CATEGORIES.filter((c) => shown.includes(c.key));
  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <h2 className="mb-2.5 text-v2-body font-semibold text-v2-text">{t("Nima yoziladi")}</h2>
      <ul className="space-y-2 text-v2-caption font-normal leading-[18px] text-v2-text-2">
        {list.map((c) => (
          <li key={c.key}>
            <span className="text-v2-text">{t(c.label)}:</span> {t(c.about)}
          </li>
        ))}
        <li className="pt-1 text-v2-text-3">{t("Tahrirlangan yozuvni bosing — «oldin → keyin» farqi ochiladi.")}</li>
      </ul>
    </section>
  );
}
