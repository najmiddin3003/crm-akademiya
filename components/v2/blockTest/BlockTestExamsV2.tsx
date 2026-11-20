"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Plus, RefreshCw } from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { B, Badge, PageHead, PageShell, SearchBox, SegmentPills, SummaryLine, type BadgeTone } from "@/components/v2/students/lists/listKit";
import StaffName from "@/components/v2/ui/StaffName";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { ROW_TINT } from "@/components/v2/ui/table";
import { csvCell, downloadBlob, excelHtml } from "@/components/blockTest/BlockTestTypesPage";
import { HEADERS, examStatus, fmtDate } from "@/components/blockTest/BlockTestExamsPage";
import type { BlockTestExam } from "@/lib/blockTestExams";
import type { BlockTestType } from "@/lib/blockTestTypes";
import type { Group } from "@/lib/groups";
import type { HrEmployee } from "@/lib/hrEmployees";
import { BT_TD, BT_TH, CreatedAt, EmptyCell, ExportMenu, RowActions, SkeletonBody, UzbmbNotice } from "./blockTestKit";
import BlockTestExamDialogV2 from "./BlockTestExamDialogV2";

// YANGI VERSIYA — BLOK TEST → «BLOK TESTLAR» (/blok-testlar, 54-qism, rasmsiz, 20.11.2026; O'quvchilar ro'yxati /
// Bonus qolipida). Eski versiyada — components/blockTest/BlockTestExamsPage.tsx, o'zgarmagan.
//
// Ma'lumot va amallar eski sahifa bilan BITTA: GET /api/block-test-exams, /api/block-test-types, /api/groups,
// /api/hr-employees (bir vaqtda, eskisidagidek); qo'shish POST va tahrirlash PATCH (./BlockTestExamDialogV2.tsx),
// o'chirish DELETE /api/block-test-exams/:id. Holat sanadan hisoblanadi — eski `examStatus` (Tugagan / Bugun /
// Rejalashtirilgan / Noma'lum). Qidiruv (nomi yoki turi) va sahifalash brauzerda. Eksport (Excel .xls / CSV) — eski fayl
// bilan AYNAN bir xil. Qo'shimcha: holat tabletkalari (soni bilan); «Sana va vaqt» bitta katakda (sana, boshlanishi,
// davomiyligi), «Turi» — nomi ostida; guruhlar — fan nuqtali tabletkalar, guruh sahifasiga havola.

type StatusKey = "all" | "Rejalashtirilgan" | "Bugun" | "Tugagan";

const STATUS_TONE: Record<string, BadgeTone> = {
  Tugagan: "danger",
  Bugun: "success",
  Rejalashtirilgan: "info",
};

export default function BlockTestExamsV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<BlockTestExam[] | null>(null);
  const [types, setTypes] = useState<BlockTestType[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusKey>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<BlockTestExam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlockTestExam | null>(null);
  const [deleting, setDeleting] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/block-test-exams").then((r) => r.json()),
      fetch("/api/block-test-types").then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/hr-employees").then((r) => r.json()),
    ])
      .then(([exams, ty, gr, emp]) => {
        if (cancelled) return;
        if (exams?.ok) {
          setItems(exams.exams);
          setFailed(false);
        } else setFailed(true);
        if (ty?.ok) setTypes(ty.types);
        if (gr?.ok) setGroups(gr.groups);
        if (emp?.ok) setEmployees(emp.employees);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setListsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const typeById = useMemo(() => new Map(types.map((x) => [x.id, x])), [types]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const typeName = (id: number | null) => (id ? typeById.get(id)?.name || "—" : "—");
  const employeeRaw = (id: number | null) => (id ? employees.find((e) => e.id === id)?.name || "" : "");
  const employeeName = (id: number | null) => employeeRaw(id) || "—";
  const groupNames = (ids: number[]) => (ids.length ? ids.map((id) => groupById.get(id)?.name).filter(Boolean).join(", ") : "—");

  const all = useMemo(() => items ?? [], [items]);

  // Qidiruv — eskisidagidek (nomi yoki turi nomi).
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.name.toLowerCase().includes(q) || (r.typeId ? typeById.get(r.typeId)?.name || "—" : "—").toLowerCase().includes(q));
  }, [all, search, typeById]);
  const filtered = useMemo(() => (status === "all" ? searched : searched.filter((r) => examStatus(r.date).label === status)), [searched, status]);
  const counts = useMemo(() => {
    const c = { all: searched.length, Rejalashtirilgan: 0, Bugun: 0, Tugagan: 0 } as Record<StatusKey, number>;
    for (const r of searched) {
      const l = examStatus(r.date).label as StatusKey;
      if (l in c) c[l] += 1;
    }
    return c;
  }, [searched]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const anyFilter = !!search.trim() || status !== "all";

  // ── Eksport — eski sahifadagi bilan AYNAN bir xil (ustunlar, qiymatlar, fayl nomi, xabarlar). ──
  function exportRows() {
    return filtered.map((r, i) => [
      i + 1, r.name, typeName(r.typeId), examStatus(r.date).label, fmtDate(r.date), r.startTime, r.durationMinutes, employeeName(r.responsibleEmployeeId), groupNames(r.groupIds), r.createdAt,
    ]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "blok-testlar.csv");
    showSuccess(t("CSV yuklab olindi — {filtered} ta", { filtered: filtered.length }));
  }
  function exportExcel() {
    downloadBlob(new Blob(["﻿" + excelHtml(HEADERS, exportRows())], { type: "application/vnd.ms-excel;charset=utf-8" }), "blok-testlar.xls");
    showSuccess(t("Excel yuklab olindi — {filtered} ta", { filtered: filtered.length }));
  }

  async function confirmDelete() {
    if (!deleteTarget || busyRef.current) return;
    const r = deleteTarget;
    busyRef.current = true;
    setDeleting(true);
    try {
      const res = await fetch(`/api/block-test-exams/${r.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        return;
      }
      setItems((prev) => (prev ? prev.filter((x) => x.id !== r.id) : prev));
      showSuccess(t("Blok test o'chirildi"));
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
        title={t("Blok testlar")}
        subtitle={t("Rejalashtirilgan va o'tgan blok testlar: sana, vaqt, guruhlar va mas'ul xodim")}
        actions={
          <>
            <ExportMenu disabled={!items} onExcel={exportExcel} onCsv={exportCSV} />
            <button type="button" onClick={() => setAddOpen(true)} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Blok test qo'shish")}
            </button>
          </>
        }
      />

      <UzbmbNotice href="/imtihon?tab=uzbmb" permPath="/imtihon" linkLabel={t("UzBMB")}>
        {t("UzBMB testlari natijalari — Imtihon → UzBMB bo'limida. Bu sahifa — blok testlar jadvali (natijasiz).")}
      </UzbmbNotice>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t("Nomi yoki turi")}
        />
        <SegmentPills<StatusKey>
          value={status}
          onChange={(k) => {
            setStatus(k);
            setPage(1);
          }}
          items={[
            { key: "all", label: t("Hammasi"), count: counts.all },
            { key: "Rejalashtirilgan", label: t("Rejalashtirilgan"), count: counts.Rejalashtirilgan },
            { key: "Bugun", label: t("Bugun"), count: counts.Bugun },
            { key: "Tugagan", label: t("Tugagan"), count: counts.Tugagan },
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
          <table className="w-full min-w-[1060px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${BT_TH} w-14 pl-4`}>№</th>
                <th className={BT_TH}>{t("Nomi")}</th>
                <th className={BT_TH}>{t("Holati")}</th>
                <th className={BT_TH}>{t("Sana va vaqt")}</th>
                <th className={BT_TH}>{t("Mas'ul xodim")}</th>
                <th className={BT_TH}>{t("Guruhlar")}</th>
                <th className={BT_TH}>{t("Qo'shilgan sana")}</th>
                <th className={`${BT_TH} w-24 pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!items && !failed && <SkeletonBody cols={COLS} />}

              {failed && !items && (
                <EmptyCell cols={COLS} icon={CalendarClock} title={t("Ma'lumotni yuklab bo'lmadi")}>
                  <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-2`}>
                    <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                    {t("Qayta urinish")}
                  </button>
                </EmptyCell>
              )}

              {items && slice.length === 0 &&
                (anyFilter ? (
                  <EmptyCell cols={COLS} icon={CalendarClock} title={t("Ma'lumotlar topilmadi")} hint={t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}>
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
                  <EmptyCell cols={COLS} icon={CalendarClock} title={t("Hali blok test yo'q")} hint={t("Blok test — sana va vaqti belgilangan sinov: turi, guruhlari va mas'ul xodimi bilan.")}>
                    <button type="button" onClick={() => setAddOpen(true)} className={`${primaryBtn} mt-2`}>
                      <Plus className="size-4" strokeWidth={2} aria-hidden />
                      {t("Blok test qo'shish")}
                    </button>
                  </EmptyCell>
                ))}

              {slice.map((r, i) => {
                const st = examStatus(r.date);
                const tone = STATUS_TONE[st.label] ?? "neutral";
                const type = r.typeId ? typeById.get(r.typeId) : undefined;
                const rowGroups = r.groupIds.map((id) => groupById.get(id)).filter((g): g is Group => Boolean(g));
                const shown = rowGroups.slice(0, 3);
                return (
                  <tr key={r.id} className={`border-b border-v2-border last:border-b-0 ${ROW_TINT.hover}`}>
                    <td className={`${BT_TD} pl-4 tabular-nums text-v2-text-3`}>{start + i + 1}</td>
                    <td className={`${BT_TD} max-w-[280px]`}>
                      <button type="button" onClick={() => setEditItem(r)} className="block max-w-full truncate text-left font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline">
                        {r.name}
                      </button>
                      <span className="block truncate text-v2-small text-v2-text-3" title={r.comment || undefined}>
                        {type ? type.name : r.typeId ? "—" : t("Turi tanlanmagan")}
                        {type?.code ? ` · ${type.code}` : ""}
                      </span>
                    </td>
                    <td className={BT_TD}>
                      <Badge tone={tone}>{t(st.label)}</Badge>
                    </td>
                    <td className={`${BT_TD} whitespace-nowrap`}>
                      <span className="block font-medium tabular-nums text-v2-text">{fmtDate(r.date)}</span>
                      <span className="block text-v2-small tabular-nums text-v2-text-3">
                        {[r.startTime || "", r.durationMinutes ? t("{n} daqiqa", { n: r.durationMinutes }) : ""].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </td>
                    <td className={`${BT_TD} max-w-[200px] truncate`}>
                      <StaffName name={employeeRaw(r.responsibleEmployeeId)} />
                    </td>
                    <td className={`${BT_TD} max-w-[300px]`}>
                      {rowGroups.length ? (
                        <div className="flex flex-wrap items-center gap-1" title={groupNames(r.groupIds)}>
                          {shown.map((g) => (
                            <Link
                              key={g.id}
                              href={`/groups/${g.id}`}
                              className="inline-flex max-w-[140px] items-center gap-1.5 rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1.5 py-0.5 text-v2-caption text-v2-text hover:border-v2-border-strong"
                            >
                              <span className={`size-1.5 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                              <span className="truncate">{g.name}</span>
                            </Link>
                          ))}
                          {rowGroups.length > shown.length && <span className="text-v2-caption text-v2-text-3">+{rowGroups.length - shown.length}</span>}
                        </div>
                      ) : (
                        <span className="text-v2-text-3">—</span>
                      )}
                    </td>
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

      {addOpen && (
        <BlockTestExamDialogV2
          types={types}
          groups={groups}
          employees={employees}
          listsLoading={listsLoading}
          onClose={() => setAddOpen(false)}
          onSaved={(r) => setItems((prev) => [r, ...(prev ?? [])])}
        />
      )}
      {editItem && (
        <BlockTestExamDialogV2
          exam={editItem}
          types={types}
          groups={groups}
          employees={employees}
          listsLoading={listsLoading}
          onClose={() => setEditItem(null)}
          onSaved={(r) => setItems((prev) => (prev ? prev.map((x) => (x.id === r.id ? r : x)) : prev))}
        />
      )}
      {deleteTarget && (
        <V2Confirm
          title={t("Blok testni o'chirasizmi?")}
          body={t("«{name}» ro'yxatdan olib tashlanadi.", { name: deleteTarget.name })}
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
