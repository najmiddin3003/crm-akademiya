"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ListChecks, Plus, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { B, Badge, PageHead, PageShell, SearchBox, SegmentPills, SummaryLine } from "@/components/v2/students/lists/listKit";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { ROW_TINT } from "@/components/v2/ui/table";
import { HEADERS, csvCell, downloadBlob, excelHtml, kindLabel } from "@/components/blockTest/BlockTestTypesPage";
import type { BlockTestType } from "@/lib/blockTestTypes";
import { BT_TD, BT_TH, CreatedAt, EmptyCell, ExportMenu, RowActions, SkeletonBody, UzbmbNotice } from "./blockTestKit";
import BlockTestTypeDialogV2 from "./BlockTestTypeDialogV2";

// YANGI VERSIYA — BLOK TEST → «BLOK TEST TURLARI» (/blok-test-turlari, 54-qism, rasmsiz, 20.11.2026; O'quvchilar
// ro'yxati / Bonus qolipida). Eski versiyada — components/blockTest/BlockTestTypesPage.tsx, o'zgarmagan.
//
// Ma'lumot va amallar eski sahifa bilan BITTA: GET /api/block-test-types, qo'shish POST va tahrirlash PATCH
// (./BlockTestTypeDialogV2.tsx), o'chirish DELETE /api/block-test-types/:id. Qidiruv (nomi yoki kodi) va sahifalash
// brauzerda, eskisidagidek. Eksport (Excel .xls / CSV) — eski fayl bilan AYNAN bir xil (o'sha ustunlar, o'sha nom).
// Qo'shimcha: Hammasi / Faol / Nofaol tabletkalari (soni bilan), «Fanlar» katagida har fan — savollar × ball.

type StatusKey = "all" | "active" | "inactive";

function fmtScore(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

export default function BlockTestTypesV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<BlockTestType[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusKey>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<BlockTestType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlockTestType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/block-test-types")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) {
          setItems(d.types);
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

  const all = useMemo(() => items ?? [], [items]);

  // Qidiruv — eskisidagidek (nomi yoki kodi).
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  }, [all, search]);
  const filtered = useMemo(() => (status === "all" ? searched : searched.filter((r) => (status === "active" ? r.active : !r.active))), [searched, status]);
  const counts = useMemo(() => ({ all: searched.length, active: searched.filter((r) => r.active).length, inactive: searched.filter((r) => !r.active).length }), [searched]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const anyFilter = !!search.trim() || status !== "all";

  // ── Eksport — eski sahifadagi bilan AYNAN bir xil (ustunlar, qiymatlar, fayl nomi, xabarlar). ──
  function exportRows() {
    return filtered.map((r, i) => [i + 1, r.name, r.code, r.durationMinutes, r.subjects.length, r.active ? t("Faol") : t("Nofaol"), r.createdAt]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "blok-test-turlari.csv");
    showSuccess(t("CSV yuklab olindi — {filtered} ta", { filtered: filtered.length }));
  }
  function exportExcel() {
    downloadBlob(new Blob(["﻿" + excelHtml(HEADERS, exportRows())], { type: "application/vnd.ms-excel;charset=utf-8" }), "blok-test-turlari.xls");
    showSuccess(t("Excel yuklab olindi — {filtered} ta", { filtered: filtered.length }));
  }

  async function confirmDelete() {
    if (!deleteTarget || busyRef.current) return;
    const r = deleteTarget;
    busyRef.current = true;
    setDeleting(true);
    try {
      const res = await fetch(`/api/block-test-types/${r.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      setItems((prev) => (prev ? prev.filter((x) => x.id !== r.id) : prev));
      showSuccess(t("Tur o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      busyRef.current = false;
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const COLS = 8;

  return (
    <PageShell>
      <PageHead
        title={t("Blok test turlari")}
        subtitle={t("Blok test qoliplari: davomiyligi, fanlari, savollar soni va ballari")}
        actions={
          <>
            <ExportMenu disabled={!items} onExcel={exportExcel} onCsv={exportCSV} />
            <button type="button" onClick={() => setAddOpen(true)} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Tur qo'shish")}
            </button>
          </>
        }
      />

      <UzbmbNotice href="/settings-academic?tab=exam-subjects" permPath="/settings-academic" linkLabel={t("Imtihon fanlari")}>
        {t("UzBMB testlarining fanlari va ball tuzilishi — Sozlamalar → O'quv → Imtihon fanlari. Bu sahifa — alohida blok test turlari.")}
      </UzbmbNotice>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t("Nomi yoki kodi")}
        />
        <SegmentPills<StatusKey>
          value={status}
          onChange={(k) => {
            setStatus(k);
            setPage(1);
          }}
          items={[
            { key: "all", label: t("Hammasi"), count: counts.all },
            { key: "active", label: t("Faol"), count: counts.active },
            { key: "inactive", label: t("Nofaol"), count: counts.inactive },
          ]}
        />
      </div>

      <SummaryLine
        items={[
          <span key="n">
            {t("Umumiy soni:")} <B>{items ? filtered.length : "—"}</B>
          </span>,
        ]}
      />

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[980px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${BT_TH} w-14 pl-4`}>№</th>
                <th className={BT_TH}>{t("Nomi")}</th>
                <th className={BT_TH}>{t("Kodi")}</th>
                <th className={`${BT_TH} text-right`}>{t("Davomiyligi")}</th>
                <th className={BT_TH}>{t("Fanlar")}</th>
                <th className={BT_TH}>{t("Holati")}</th>
                <th className={BT_TH}>{t("Qo'shilgan sana")}</th>
                <th className={`${BT_TH} w-24 pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!items && !failed && <SkeletonBody cols={COLS} />}

              {failed && !items && (
                <EmptyCell cols={COLS} icon={ListChecks} title={t("Ma'lumotni yuklab bo'lmadi")}>
                  <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-2`}>
                    <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                    {t("Qayta urinish")}
                  </button>
                </EmptyCell>
              )}

              {items && slice.length === 0 &&
                (anyFilter ? (
                  <EmptyCell cols={COLS} icon={ListChecks} title={t("Ma'lumotlar topilmadi")} hint={t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setStatus("all");
                        setPage(1);
                      }}
                      className={`${secondaryBtn} mt-2`}
                    >
                      {t("Filtrlarni tozalash")}
                    </button>
                  </EmptyCell>
                ) : (
                  <EmptyCell cols={COLS} icon={ListChecks} title={t("Hali blok test turi yo'q")} hint={t("Tur — blok testning qolipi: davomiyligi va fanlari. Blok test qo'shishda shu turlardan tanlanadi.")}>
                    <button type="button" onClick={() => setAddOpen(true)} className={`${primaryBtn} mt-2`}>
                      <Plus className="size-4" strokeWidth={2} aria-hidden />
                      {t("Tur qo'shish")}
                    </button>
                  </EmptyCell>
                ))}

              {slice.map((r, i) => {
                const totalQ = r.subjects.reduce((s, x) => s + (x.questionsCount || 0), 0);
                const totalP = r.subjects.reduce((s, x) => s + (x.questionsCount || 0) * (x.pointsPerCorrect || 0), 0);
                return (
                  <tr key={r.id} className={`border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                    <td className={`${BT_TD} pl-4 tabular-nums text-v2-text-3`}>{start + i + 1}</td>
                    <td className={`${BT_TD} max-w-[260px]`}>
                      <button type="button" onClick={() => setEditItem(r)} className="block max-w-full truncate text-left font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline">
                        {r.name}
                      </button>
                      <span className="block truncate text-v2-small text-v2-text-3">{r.kind ? t(kindLabel(r.kind)) : t("Turi tanlanmagan")}</span>
                    </td>
                    <td className={BT_TD}>
                      <span className="inline-flex rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 py-0.5 text-v2-caption tabular-nums text-v2-text-2">{r.code || "—"}</span>
                    </td>
                    <td className={`${BT_TD} whitespace-nowrap text-right tabular-nums`}>
                      {r.durationMinutes ? (
                        <>
                          <b className="font-semibold text-v2-text">{r.durationMinutes}</b> <span className="text-v2-text-3">{t("daqiqa")}</span>
                        </>
                      ) : (
                        <span className="text-v2-text-3">—</span>
                      )}
                    </td>
                    <td className={`${BT_TD} max-w-[360px]`}>
                      {r.subjects.length ? (
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-1">
                            {r.subjects.map((s, k) => (
                              <span
                                key={k}
                                title={t("{q} savol × {p} ball", { q: s.questionsCount, p: fmtScore(s.pointsPerCorrect) })}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 py-0.5 text-v2-caption text-v2-text"
                              >
                                <span className={`size-1.5 shrink-0 rounded-full ${FAN_DOT[fanOf(s.subject)]}`} aria-hidden />
                                <span className="truncate">{s.subject}</span>
                                <span className="shrink-0 tabular-nums text-v2-text-3">
                                  {s.questionsCount}×{fmtScore(s.pointsPerCorrect)}
                                </span>
                              </span>
                            ))}
                          </div>
                          {r.subjects.length > 1 && (
                            <div className="mt-1 text-v2-caption text-v2-text-3">{t("Jami {q} savol · {p} ball", { q: totalQ, p: fmtScore(totalP) })}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-v2-text-3">—</span>
                      )}
                    </td>
                    <td className={BT_TD}>{r.active ? <Badge tone="success">{t("Faol")}</Badge> : <Badge tone="neutral">{t("Nofaol")}</Badge>}</td>
                    <td className={BT_TD}>
                      <CreatedAt value={r.createdAt} />
                    </td>
                    <td className={`${BT_TD} pr-4 text-right`}>
                      <RowActions name={r.name} onEdit={() => setEditItem(r)} onDelete={() => setDeleteTarget(r)} />
                    </td>
                  </tr>
                );
              })}
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

      {addOpen && <BlockTestTypeDialogV2 onClose={() => setAddOpen(false)} onSaved={(r) => setItems((prev) => [r, ...(prev ?? [])])} />}
      {editItem && (
        <BlockTestTypeDialogV2 type={editItem} onClose={() => setEditItem(null)} onSaved={(r) => setItems((prev) => (prev ? prev.map((x) => (x.id === r.id ? r : x)) : prev))} />
      )}
      {deleteTarget && (
        <V2Confirm
          title={t("Turni o'chirasizmi?")}
          body={t("«{name}» o'chiriladi. Shu turdagi blok testlarda «Turi» bo'sh («—») qoladi.", { name: deleteTarget.name })}
          confirmLabel={deleting ? t("O'chirilmoqda…") : t("O'chirish")}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            if (!busyRef.current) setDeleteTarget(null);
          }}
        />
      )}
    </PageShell>
  );
}
