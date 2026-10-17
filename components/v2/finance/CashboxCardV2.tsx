"use client";

import type { MouseEvent } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChartNoAxesCombined, ClipboardList, Coins, Crown, Download, Eye, EyeOff, MoreHorizontal, Pencil, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useLang, useT } from "@/components/shared/Language";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import type { Cashbox } from "@/lib/cashboxes";

// YANGI VERSIYA: KASSA KARTOCHKASI (rasm «Kassalar», 18.10.2026).
//
//   tepada: kassa ikonka, nomi, mas'ul · oxirgi QABUL QILINGAN topshiruv vaqti
//           (bugun — soat, aks holda kun); o'ngda QOLDIQ va «ko'z» (shu kassa
//           summasini yashirish — har kassada alohida);
//   ostida: «Oxirgi topshiruvdan beri tushum» (chiqim — izohda); bosh kassada
//           o'rniga «Kutilayotgan ko'chirma» (filiallar topshirgani, ✓ kutadi);
//   pastda: Kirim, Chiqim, Ko'chirish; bosh kassada «Kunlik topshiruv»;
//           hisobot (faqat admin) va «⋯» — to'lov turlari bo'yicha qoldiq
//           (bosilsa — turlar orasida ko'chirish), Dividend, Sarmoya, admin
//           uchun Tahrirlash va «Bosh kassa qilish».
//
// Kartochka bosilsa — o'ngdagi tranzaksiyalar shu kassaga filtrlanadi.
// Raqamlarning MA'NOSI eski sahifadagidek (memory: kassa-kartochka-qatorlari):
// qoldiq va to'lov turlari — «hozir kassada qancha bor», tushum emas.

function fmtNum(n: number): string {
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return n < 0 ? `−${s}` : s;
}

const MASK = "••••••";

/** Topshiruv lahzasi: bugun bo'lsa «11:41», aks holda «11-oktyabr». */
function sinceShort(since: string | null | undefined, lang: Parameters<typeof dayMonthLabel>[1]): string {
  if (!since) return "";
  const d = new Date(since);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) return `${p(d.getHours())}:${p(d.getMinutes())}`;
  return dayMonthLabel(d, lang);
}

/** Eski sahifadagi izoh — chegara qachon edi. */
function sinceTitle(since: string | null | undefined): string {
  if (!since) return "Hali qabul qilingan topshiruv yo'q — boshidan beri hisoblanadi";
  const d = new Date(since);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `Rahbar oxirgi topshiruvni ${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())} da qabul qilgan`;
}

const actBtn =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-2 text-v2-small font-semibold text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus";
const iconBtn =
  "relative inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";

export interface CashboxCardV2Props {
  c: Cashbox;
  selected: boolean;
  hidden: boolean;
  isAdmin: boolean;
  /** To'lov turlari — foydalanuvchi tartibida (nofaol bo'lgani ham: eski summa ko'rinsin). */
  methods: { key: string; name: string }[];
  moderatorHref?: string;
  /** Hisobot menyusi sarlavhasi uchun («Bugun, 12-oktyabr»). */
  rangeText: string;
  onSelect: () => void;
  onToggleHidden: () => void;
  onKirim: () => void;
  onChiqim: () => void;
  onTransferTo: () => void;
  onTransferMethod: (from: string) => void;
  onDividend: () => void;
  onInvestment: () => void;
  onEdit: () => void;
  onSetPrimary: () => void;
  onHandover: () => void;
  onExport: (kind: "xls" | "csv") => void;
}

export default function CashboxCardV2(props: CashboxCardV2Props) {
  const { c, selected, hidden, isAdmin, methods, moderatorHref, rangeText } = props;
  const { t } = useT();
  const [lang] = useLang();
  const mask = (n: number) => (hidden ? MASK : fmtNum(n));
  const since = c.sinceHandover?.since ?? null;
  const when = c.isPrimary ? "" : sinceShort(since, lang);

  // To'lov turlari bo'yicha QOLDIQ (methodTotals) — faqat puli borlari.
  const methodRows = methods.map((m) => ({ ...m, val: c.methodTotals?.[m.key] ?? 0 })).filter((r) => r.val > 0);
  const balanceTitle = hidden
    ? undefined
    : methodRows.length > 0
      ? methodRows.map((r) => `${t(r.name)} — ${fmtNum(r.val)} ${t("so'm")}`).join(" · ")
      : t("Kassa bo'sh");

  const onCardClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a, [role='menu']")) return;
    props.onSelect();
  };

  const moreItems: ActionMenuEntry[] = c.archived
    ? isAdmin
      ? [{ key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: props.onEdit }]
      : []
    : [
        ...(methodRows.length > 0
          ? ([
              { key: "mh", heading: t("To'lov turlari — bosing: boshqa turga ko'chirish") },
              ...methodRows.map((r) => ({
                key: `m-${r.key}`,
                label: t(r.name),
                hint: `${mask(r.val)} ${t("so'm")}`,
                icon: ArrowLeftRight,
                onSelect: () => props.onTransferMethod(r.key),
              })),
              { key: "d1", divider: true },
            ] as ActionMenuEntry[])
          : []),
        { key: "div", label: t("Dividend"), icon: Coins, onSelect: props.onDividend },
        { key: "inv", label: t("Sarmoya"), icon: ChartNoAxesCombined, onSelect: props.onInvestment },
        ...(isAdmin
          ? ([
              { key: "d2", divider: true },
              { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: props.onEdit },
              ...(c.isPrimary ? [] : [{ key: "primary", label: t("Bosh kassa qilish"), icon: Crown, onSelect: props.onSetPrimary }]),
            ] as ActionMenuEntry[])
          : []),
      ];

  const exportItems: ActionMenuEntry[] = [
    { key: "h", heading: `${c.name} · ${rangeText}` },
    { key: "xls", label: t("Excel fayl"), hint: "XLSX", icon: Download, onSelect: () => props.onExport("xls") },
    { key: "csv", label: t("CSV fayl"), hint: "CSV", icon: Download, onSelect: () => props.onExport("csv") },
  ];

  return (
    <div
      onClick={onCardClick}
      aria-current={selected || undefined}
      className={`cursor-pointer overflow-hidden rounded-v2-lg border bg-v2-surface shadow-v2-sm transition-[border-color,box-shadow] ${
        selected ? "border-v2-brand shadow-v2-focus" : "border-v2-border hover:border-v2-border-strong"
      } ${c.archived ? "opacity-80" : ""}`}
    >
      <div className="px-4 pb-3 pt-3.5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface-2 text-v2-text-2" aria-hidden>
            {c.isPrimary ? <Crown className="size-4 text-v2-warning" strokeWidth={1.75} /> : <Wallet className="size-4" strokeWidth={1.75} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-v2-body font-semibold text-v2-text" title={c.name}>
              {c.name}
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-v2-caption text-v2-text-3">
              <span className="truncate" title={c.isPrimary ? undefined : t(sinceTitle(since))}>
                {/* Bosh kassada yorliq oldinda — katta qoldiq yonida mas'ul ismi qisqarsa ham u ko'rinsin. */}
                {c.isPrimary && <span className="font-medium text-v2-warning">{t("Bosh kassa")} · </span>}
                {c.moderator ? (
                  moderatorHref ? (
                    <Link href={moderatorHref} className="hover:text-v2-text-2 hover:underline underline-offset-2">
                      {c.moderator}
                    </Link>
                  ) : (
                    c.moderator
                  )
                ) : (
                  t("mas'ul belgilanmagan")
                )}
                {when && <> · {when}</>}
              </span>
              {c.archived && <span className="shrink-0 rounded-v2-full bg-v2-surface-2 px-1.5 py-px text-[11px] font-medium text-v2-text-2">{t("Arxiv")}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span title={balanceTitle} className={`whitespace-nowrap text-[16px] font-semibold leading-6 tabular-nums ${!hidden && c.balance < 0 ? "text-v2-danger" : "text-v2-text"}`}>
              {mask(c.balance)} <span className="text-v2-small font-normal text-v2-text-2">{t("so'm")}</span>
            </span>
            <button
              type="button"
              onClick={props.onToggleHidden}
              title={hidden ? t("Summani ko'rsatish") : t("Summani yashirish")}
              aria-label={hidden ? t("Summani ko'rsatish") : t("Summani yashirish")}
              aria-pressed={hidden}
              className="inline-flex size-7 items-center justify-center rounded-v2-md text-v2-text-3 hover:bg-v2-hover hover:text-v2-text-2"
            >
              {hidden ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {c.isPrimary ? (
          <div className="mt-2 flex flex-col items-start gap-1 text-v2-small text-v2-text-2">
            <p className="max-w-full truncate">
              {t("Kutilayotgan ko'chirma")}: <b className="font-semibold tabular-nums text-v2-text">{mask(c.pendingIn ?? 0)} {t("so'm")}</b>
              {(c.pendingInCount ?? 0) > 0 && <span className="text-v2-text-3"> · {t("{n} ta", { n: c.pendingInCount ?? 0 })}</span>}
            </p>
            {/* Rahbar kassa: kunlik topshiruv oynasi — filiallar bugun qancha yig'di/topshirdi. */}
            {!c.archived && (
              <button
                type="button"
                onClick={props.onHandover}
                title={t("Kunlik topshiruv — filiallar bugun qancha topshirdi")}
                className="inline-flex shrink-0 items-center gap-1 rounded-v2-sm font-medium text-v2-brand-text underline-offset-2 hover:underline"
              >
                <ClipboardList className="size-3.5" strokeWidth={1.75} aria-hidden />
                {t("Kunlik topshiruv")}
                {(c.pendingInCount ?? 0) > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-v2-full bg-v2-danger px-1 text-[10px] font-bold leading-none text-v2-on-danger">{c.pendingInCount}</span>
                )}
              </button>
            )}
          </div>
        ) : (
          <p
            className="mt-2 text-v2-small text-v2-text-2"
            title={hidden ? t(sinceTitle(since)) : `${t("Chiqim")}: ${fmtNum(c.sinceHandover?.expense ?? 0)} ${t("so'm")} · ${t(sinceTitle(since))}`}
          >
            {t("Oxirgi topshiruvdan beri tushum")}: <b className="font-semibold tabular-nums text-v2-text">{mask(c.sinceHandover?.income ?? 0)} {t("so'm")}</b>
          </p>
        )}
      </div>

      {(!c.archived || moreItems.length > 0) && (
        <div className="flex items-center gap-1 border-t border-v2-border bg-v2-surface-2 px-3 py-2">
          {!c.archived && (
            <>
              <button type="button" onClick={props.onKirim} className={actBtn}>
                <ArrowDownLeft className="size-4 text-v2-success" strokeWidth={2} aria-hidden />
                {t("Kirim")}
              </button>
              <button type="button" onClick={props.onChiqim} className={actBtn}>
                <ArrowUpRight className="size-4 text-v2-danger" strokeWidth={2} aria-hidden />
                {t("Chiqim")}
              </button>
              <button type="button" onClick={props.onTransferTo} className={actBtn}>
                <ArrowLeftRight className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                {t("Ko'chirish")}
              </button>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            {isAdmin && !c.archived && (
              <ActionMenu items={exportItems} label={t("Hisobot")} width={248}>
                {(trigger) => (
                  <button type="button" {...trigger} title={t("Hisobotni yuklab olish")} aria-label={t("Hisobotni yuklab olish")} className={iconBtn}>
                    <Download className="size-4" strokeWidth={1.75} />
                  </button>
                )}
              </ActionMenu>
            )}
            {moreItems.length > 0 && (
              <ActionMenu items={moreItems} label={t("{name} — amallar", { name: c.name })} width={268}>
                {(trigger) => (
                  <button type="button" {...trigger} title={t("Amallar")} aria-label={t("{name} — amallar", { name: c.name })} className={iconBtn}>
                    <MoreHorizontal className="size-4" strokeWidth={1.75} />
                  </button>
                )}
              </ActionMenu>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
