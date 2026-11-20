"use client";

import type { ReactNode } from "react";
import { ArrowRight, Download, FileSpreadsheet, FileText, Pencil, Trash2, type LucideIcon } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import ActionMenu from "@/components/v2/ui/ActionMenu";
import { secondaryBtn } from "@/components/v2/ui/buttons";

// YANGI VERSIYA — «BLOK TEST» BO'LIMINING UMUMIY BO'LAKLARI (54-qism, rasmsiz, 20.11.2026): Blok test turlari
// (./BlockTestTypesV2.tsx) va Blok testlar (./BlockTestExamsV2.tsx). Jadval katagi, qator amallari, «Yuklab olish»
// menyusi, bo'sh holat va UzBMB bo'limiga yo'llovchi izoh qatori. Eksport faylining o'zi eski sahifa bilan bitta
// (components/blockTest/BlockTestTypesPage.tsx → csvCell, excelHtml, downloadBlob).

export const BT_TH =
  "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 px-2.5 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
export const BT_TD = "px-2.5 py-3 align-middle";

const ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus";

/** Qator oxiridagi ikki tugma: tahrirlash va o'chirish (eskisidagidek doim ko'rinadi). */
export function RowActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  const { t } = useT();
  return (
    <div className="inline-flex items-center gap-0.5">
      <button type="button" onClick={onEdit} title={t("Tahrirlash")} aria-label={`${name} — ${t("Tahrirlash")}`} className={`${ICON_BTN} hover:bg-v2-surface-2 hover:text-v2-text`}>
        <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
      <button type="button" onClick={onDelete} title={t("O'chirish")} aria-label={`${name} — ${t("O'chirish")}`} className={`${ICON_BTN} hover:bg-v2-danger-bg hover:text-v2-danger`}>
        <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

/** «Yuklab olish» — Excel (.xls) va CSV, eski «⋮» menyusidagi ikki band. */
export function ExportMenu({ disabled, onExcel, onCsv }: { disabled: boolean; onExcel: () => void; onCsv: () => void }) {
  const { t } = useT();
  return (
    <ActionMenu
      label={t("Yuklab olish")}
      width={248}
      items={[
        { key: "xls", label: t("EXCEL faylini yuklab olish"), icon: FileSpreadsheet, hint: "XLS", disabled, onSelect: onExcel },
        { key: "csv", label: t("CSV faylini yuklab olish"), icon: FileText, hint: "CSV", disabled, onSelect: onCsv },
      ]}
    >
      {(trigger) => (
        <button type="button" {...trigger} className={secondaryBtn}>
          <Download className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Yuklab olish")}
        </button>
      )}
    </ActionMenu>
  );
}

/** Jadval ichidagi bo'sh holat (ikonka, sarlavha, izoh, amal). */
export function EmptyCell({ cols, icon: Icon, title, hint, children }: { cols: number; icon: LucideIcon; title: string; hint?: string; children?: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="p-5">
        <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
            <Icon className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="text-v2-section text-v2-text">{title}</div>
          {hint && <p className="max-w-md text-v2-small text-v2-text-2">{hint}</p>}
          {children}
        </div>
      </td>
    </tr>
  );
}

/** Yuklanish qatorlari (skelet). */
export function SkeletonBody({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={`sk${i}`} className="border-b border-v2-border" aria-hidden>
          {Array.from({ length: cols }, (_, j) => (
            <td key={j} className={BT_TD}>
              <div className={`h-3 rounded bg-v2-skeleton ${j === 0 ? "w-6" : j === 1 ? "w-36" : "w-20"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Yangi versiyadagi o'xshash bo'limga izoh (SAVOLLAR 583: «Blok testlar» → Imtihon → UzBMB, «Blok test turlari» →
 * Sozlamalar → Imtihon fanlari). Havola faqat o'sha bo'lim ruxsati bo'lsa.
 */
export function UzbmbNotice({ children, href, linkLabel, permPath }: { children: ReactNode; href: string; linkLabel: string; permPath: string }) {
  const can = useCanOpen(permPath);
  return (
    <NoticeBar
      action={
        can ? (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 font-semibold text-v2-brand-text underline-offset-2 hover:underline">
            {linkLabel}
            <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
          </Link>
        ) : undefined
      }
    >
      {children}
    </NoticeBar>
  );
}

/** "DD.MM.YYYY | HH:mm" → sana va vaqt alohida (jadval katagida vaqt kulrang). */
export function CreatedAt({ value }: { value: string }) {
  const [date, time] = (value || "").split("|").map((s) => s.trim());
  if (!date) return <span className="text-v2-text-3">—</span>;
  return (
    <span className="whitespace-nowrap tabular-nums text-v2-text-2">
      {date}
      {time && <span className="text-v2-text-3"> · {time}</span>}
    </span>
  );
}
