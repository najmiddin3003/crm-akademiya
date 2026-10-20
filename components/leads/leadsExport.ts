"use client";

import type { LeadSettings } from "@/lib/leadSettings";
import { orderNo, type Order } from "@/lib/ordersData";
import { uzDateOf } from "@/lib/staffTasks";
import type { ReceiptRow } from "./LeadReceipt";
import { guruhText, levelText, sinovText, type LeadFmt, type LeadRow } from "./leadsCommon";

// LIDLAR EKSPORTI VA CHEKI — eski (LeadsPage) va yangi (components/v2/leads/
// LeadsV2.tsx) sahifa uchun BITTA (20.10.2026, eski sahifadan aynan ko'chirildi):
// CSV/Excel ustunlari, so'rovnoma havolasini nusxalash, lid chekidagi qatorlar.

interface Notify {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

// ── Eksport ──
export function leadExportCols(r: LeadRow, settings: LeadSettings | null, fmt: LeadFmt, branchName: (r: LeadRow | null) => string): [string, string][] {
  const { t } = fmt;
  return [
    ["ID", String(orderNo(r.o))],
    [t("Ism familiya"), r.o.name || ""],
    [t("Telefon"), r.o.phone || ""],
    [t("Kurs"), r.o.course || ""],
    [t("Daraja / sinf"), levelText(r.o, settings, fmt).text],
    [t("Filial"), branchName(r)],
    [t("Manba"), r.o.source || ""],
    [t("Qayerdan bildi"), r.o.heardFrom || ""],
    [t("Holat"), fmt.holatNom(r.holat)],
    [t("Kelgan vaqti"), r.o.created || ""],
    [t("Moderator"), r.o.moderator || ""],
    [t("Sinov darsi"), sinovText(r.o, fmt)],
    [t("Guruh"), guruhText(r.o)],
    [t("Rad sababi"), r.o.radSabab || ""],
    [t("Izoh"), r.o.note || ""],
  ];
}

const fileDate = () => uzDateOf(Date.now());

export function exportLeadsCsv(list: LeadRow[], settings: LeadSettings | null, fmt: LeadFmt, branchName: (r: LeadRow | null) => string, { showSuccess, showError }: Notify) {
  const { t } = fmt;
  const exportCols = (r: LeadRow) => leadExportCols(r, settings, fmt, branchName);
  try {
    const data = list.map(exportCols);
    const head = (data[0] ?? exportCols({ o: {} as Order, holat: "yangi", at: NaN, yon: "", dupOf: null, dupCount: 1 })).map((c) => c[0]);
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = [head.map(esc).join(","), ...data.map((cols) => cols.map((c) => esc(c[1])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lidlar-${fileDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess(t("CSV fayl yuklab olindi"));
  } catch {
    showError(t("CSV faylni yuklab bo'lmadi"));
  }
}

export async function exportLeadsExcel(list: LeadRow[], settings: LeadSettings | null, fmt: LeadFmt, branchName: (r: LeadRow | null) => string, { showSuccess, showError }: Notify) {
  const { t } = fmt;
  const exportCols = (r: LeadRow) => leadExportCols(r, settings, fmt, branchName);
  try {
    // xlsx (SheetJS) faqat bosilganda yuklanadi — sahifa to'plamiga kirmasin.
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(list.map((r) => Object.fromEntries(exportCols(r))));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Lidlar");
    XLSX.writeFile(book, `lidlar-${fileDate()}.xlsx`);
    showSuccess(t("Excel fayl yuklab olindi"));
  } catch {
    showError(t("Excel faylni yuklab bo'lmadi"));
  }
}

export async function copySurveyLink(t: LeadFmt["t"], { showSuccess, showError }: Notify) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/sorovnoma`);
    showSuccess(t("So'rovnoma havolasi nusxalandi"));
  } catch {
    showError(t("Havolani nusxalab bo'lmadi"));
  }
}

/**
 * Lid chekidagi qatorlar. Bo'sh maydon "—" (qator tushib qolmaydi —
 * moderator qo'lda to'ldirishi mumkin), faqat izoh bo'lmasa yozilmaydi.
 * EMOJISIZ: 58mm chek printerlari emoji shriftini bilmaydi.
 */
export function leadReceiptRows(o: Order, row: LeadRow | null, settings: LeadSettings | null, fmt: LeadFmt, branch: string): ReceiptRow[] {
  const rows: ReceiptRow[] = [
    ["ID", String(orderNo(o))],
    ["O'quvchi", o.name || "—"],
    ["Telefon", o.phone || "—"],
    ["Yaratilgan", o.created || "—"],
    ["Kurs", o.course || "—"],
    ["Daraja / sinf", levelText(o, settings, fmt).text || "—"],
    ["Filial", branch || "—"],
    ["Holat", row ? fmt.holatNom(row.holat) : "—"],
    ["Sinov darsi", sinovText(o, fmt) || "—"],
    ["Guruh", guruhText(o) || "—"],
    ["Moderator", o.moderator || "—"],
    ["Manba", o.source || "—"],
  ];
  if (o.note) rows.push(["Izoh", o.note]);
  return rows;
}
