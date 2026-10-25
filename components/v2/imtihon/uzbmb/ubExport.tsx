"use client";

import { useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { panelTriggerCls } from "@/components/v2/ui/buttons";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { UB_MAJ_SHORT, rankOf, schemeMax, type UbResult } from "@/lib/uzbmb";
import type { UbTestData } from "@/lib/uzbmbServer";
import { isoToDate, type SheetRow } from "./ubCore";

// YANGI VERSIYA — «EKSPORT» (rasm «UzBMB · Excel eksport», 25.10.2026): «Natijalarni yuklab olish» —
// Shu guruh (guruh nomi · N o'quvchi) yoki Barcha guruhlar (shu test bo'yicha · filial); «Fanlar
// bo'yicha to'g'ri javoblar», «Sertifikat belgilari»; «Excel (.xlsx) yuklab olish». Faqat SAQLANGAN
// natijalar (kiritilayotgan, saqlanmaganlari kirmaydi).

type Scope = "group" | "all";

export default function UbExportButton({ data, groupId, groupLabel, rows }: { data: UbTestData | null; groupId: number | null; groupLabel: string; rows: SheetRow[] }) {
  const { t, lang } = useT();
  const { showSuccess, showError } = useToast();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("group");
  const [counts, setCounts] = useState(true);
  const [cert, setCert] = useState(true);
  const [busy, setBusy] = useState(false);
  const canGroup = groupId !== null && rows.length > 0;
  const eff: Scope = canGroup ? scope : "all";

  async function download() {
    if (!data) return;
    const { test, prev, results, prevResults, groupLabels } = data;
    const max = schemeMax(test.scheme);
    const prevBy = new Map(prevResults.filter((r) => r.complete).map((r) => [r.pupilId, r.total]));
    type Item = { name: string; group: string; r: UbResult | null };
    const items: Item[] =
      eff === "group"
        ? rows.map((x) => ({ name: x.name, group: groupLabel, r: x.saved }))
        : results.map((r) => ({ name: r.student, group: groupLabels[r.groupId] ?? `#${r.groupId}`, r }));
    if (!items.length) {
      showError(t("Yuklab olinadigan natija yo'q"));
      return;
    }
    const done = items.filter((x) => x.r?.complete).map((x) => x.r!.total);
    items.sort((a, b) => {
      const ca = a.r?.complete ? 1 : 0;
      const cb = b.r?.complete ? 1 : 0;
      if (ca !== cb) return cb - ca;
      if (ca && cb) return b.r!.total - a.r!.total || a.name.localeCompare(b.name, "uz");
      return a.name.localeCompare(b.name, "uz");
    });

    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : v);
      const head: string[] = [t("O'rin"), t("O'quvchi")];
      if (eff === "all") head.push(t("Guruh"));
      head.push(t("1-blok fani"));
      if (counts) head.push(t("1-blok to'g'ri"));
      head.push(`${t("1-blok ball")} / ${max.b1}`, t("2-blok fani"));
      if (counts) head.push(t("2-blok to'g'ri"));
      head.push(`${t("2-blok ball")} / ${max.b2}`);
      if (counts) head.push(t(UB_MAJ_SHORT.m1), t(UB_MAJ_SHORT.m2), t(UB_MAJ_SHORT.m3));
      head.push(`${t("Majburiy ball")} / ${max.maj}`, `${t("Jami ball")} / ${max.total}`);
      if (cert) head.push(t("Sertifikat"));
      if (prev) head.push(t("№{no} testdan", { no: prev.no }));

      const body = items.map((x) => {
        const r = x.r;
        const row: (string | number)[] = [r?.complete ? rankOf(r.total, done) : "—", x.name];
        if (eff === "all") row.push(x.group);
        row.push(r?.b1s ?? "");
        if (counts) row.push(r ? (r.b1cert ? t("sertifikat") : n(r.b1c)) : "");
        row.push(r && (r.b1cert ? r.b1m !== null : r.b1c !== null) ? r.b1 : "", r?.b2s ?? "");
        if (counts) row.push(r ? (r.b2cert ? t("sertifikat") : n(r.b2c)) : "");
        row.push(r && (r.b2cert ? r.b2m !== null : r.b2c !== null) ? r.b2 : "");
        if (counts) row.push(n(r?.m1), n(r?.m2), n(r?.m3));
        row.push(r && (r.m1 !== null || r.m2 !== null || r.m3 !== null) ? r.maj : "", r?.complete ? r.total : r ? t("to'liq emas") : t("kiritilmagan"));
        if (cert) row.push(r ? [r.b1cert ? r.b1s : "", r.b2cert ? r.b2s : ""].filter(Boolean).join(", ") : "");
        if (prev) {
          const p = r?.complete ? prevBy.get(r.pupilId) : undefined;
          row.push(p === undefined || !r ? "" : Math.round((r.total - p) * 10) / 10);
        }
        return row;
      });

      const d = isoToDate(test.date);
      const title = [test.name, d ? dayMonthLabel(d, lang) : test.date, eff === "group" ? groupLabel : t("Barcha guruhlar")].join(" · ");
      const ws = XLSX.utils.aoa_to_sheet([[title], [], head, ...body]);
      ws["!cols"] = head.map((h, i) => ({ wch: i === 1 ? 28 : i === 2 && eff === "all" ? 30 : Math.max(8, Math.min(22, h.length + 2)) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "UzBMB");
      const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s*·\s*/g, "_").replace(/\s+/g, "_").slice(0, 60);
      XLSX.writeFile(wb, `UzBMB_${test.no}-test_${safe(eff === "group" ? groupLabel : t("barcha"))}_${test.date}.xlsx`);
      showSuccess(t("Yuklab olindi — {n} ta o'quvchi", { n: items.length }));
      setOpen(false);
    } catch {
      showError(t("Fayl tayyorlanmadi"));
    }
    setBusy(false);
  }

  const radio = (value: Scope, title: string, sub: string, disabled: boolean) => {
    const on = eff === value;
    return (
      <label
        className={`flex cursor-pointer items-start gap-2.5 rounded-v2-md border px-3 py-2.5 transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border hover:bg-v2-surface-2"
        }`}
      >
        <input type="radio" name="ub-export-scope" className="sr-only" checked={on} disabled={disabled} onChange={() => setScope(value)} />
        <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${on ? "border-v2-brand" : "border-v2-border-field"}`} aria-hidden>
          {on && <span className="size-2 rounded-full bg-v2-brand" />}
        </span>
        <span className="min-w-0">
          <span className="block text-v2-small font-semibold text-v2-text">{title}</span>
          <span className="block truncate text-v2-caption font-normal text-v2-text-2">{sub}</span>
        </span>
      </label>
    );
  };

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} disabled={!data} className={`${panelTriggerCls(open)} disabled:cursor-not-allowed disabled:opacity-50`}>
        <Download className="size-4" strokeWidth={1.75} aria-hidden />
        {t("Eksport")}
        <ChevronDown className={`size-4 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>
      <FloatingPanel open={open} anchorRef={btnRef} onClose={() => setOpen(false)} align="end" width={340} maxHeight={420} role="dialog" ariaLabel={t("Natijalarni yuklab olish")}>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-v2-body font-semibold text-v2-text">{t("Natijalarni yuklab olish")}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("Yopish")} className="inline-flex size-7 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-text">
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
          <div className="space-y-2" role="radiogroup" aria-label={t("Natijalarni yuklab olish")}>
            {radio("group", t("Shu guruh"), canGroup ? `${groupLabel} · ${t("{n} o'quvchi", { n: rows.length })}` : t("Guruh tanlanmagan"), !canGroup)}
            {radio("all", t("Barcha guruhlar"), t("shu test bo'yicha · filial"), false)}
          </div>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2.5 text-v2-small text-v2-text">
              <V2Checkbox checked={counts} onChange={setCounts} label={t("Fanlar bo'yicha to'g'ri javoblar")} />
              {t("Fanlar bo'yicha to'g'ri javoblar")}
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-v2-small text-v2-text">
              <V2Checkbox checked={cert} onChange={setCert} label={t("Sertifikat belgilari")} />
              {t("Sertifikat belgilari")}
            </label>
          </div>
          <button
            type="button"
            onClick={() => void download()}
            disabled={busy || !data}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-v2-md bg-v2-brand px-4 text-v2-body font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4" strokeWidth={1.75} aria-hidden />}
            {t("Excel (.xlsx) yuklab olish")}
          </button>
        </div>
      </FloatingPanel>
    </>
  );
}
