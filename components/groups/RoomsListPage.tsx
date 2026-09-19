"use client";

import { invalidateRooms } from "@/hooks/useRooms";
import { useEffect, useMemo, useRef, useState } from "react";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import RoomModal from "./RoomModal";
import type { Room } from "@/lib/rooms";
import type { Equipment } from "@/lib/equipment";
import { roomEquipmentStats, conditionStats, brokenCount, totalValue } from "@/lib/roomAnalytics";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Guruh → Xonalar (crm-akademiya #view-groups-rooms, sidebar: Guruh > Xonalar,
// href /groups-rooms). Ma'lumot /api/rooms dan (constants/rooms.js ROOM_SEED
// asosida seed qilingan). "Xona qo'shish"/tahrirlash — RoomModal, o'chirish —
// pastdagi oddiy tasdiqlash oynasi (Ha/Yo'q).

const HEADERS = ["№", "Sarlavha", "O'quvchi sig'imi", "Izoh"];

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RoomsListPage() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Referensda sahifa ikki tabga bo'lingan: "Xonalar" (jadval) va "Analitika".
  const [tab, setTab] = useState<"rooms" | "analytics">("rooms");
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRooms(d.rooms); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Analitika jihozlar ro'yxatidan hisoblanadi — faqat tab ochilganda yuklanadi.
  useEffect(() => {
    if (tab !== "analytics") return;
    let cancelled = false;
    fetch("/api/equipment")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setEquipment(d.equipment ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => r.name.toLowerCase().includes(q) || r.note.toLowerCase().includes(q));
  }, [rooms, search]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  function exportRows() {
    return filtered.map((r, i) => [i + 1, r.name, r.capacity, r.note]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "xonalar.csv");
    showSuccess(t("CSV yuklab olindi — {filtered} ta", { filtered: filtered.length }));
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const rows = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${rows}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "xonalar.xls");
    showSuccess(t("Excel yuklab olindi — {filtered} ta", { filtered: filtered.length }));
    setMoreOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const r = deleteTarget;
    setDeleting(true);
    try {
      const res = await fetch(`/api/rooms/${r.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "O'chirilmadi"));
        setDeleting(false);
        return;
      }
      invalidateRooms();
      setRooms((prev) => prev.filter((x) => x.id !== r.id));
      showSuccess(t("Xona o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Tab almashtirgich — referensdagi "Xonalar / Analitika" */}
      <div className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border p-1.5">
        {([["rooms", "Xonalar"], ["analytics", "Analitika"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`h-8 px-3.5 rounded-lg text-[13px] font-medium transition-colors ${
              tab === k ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Amallar qatori */}
      <div className={`items-center justify-between gap-2 flex-wrap ${tab === "rooms" ? "flex" : "hidden"}`}>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <Plus className="icon icon-sm" />
          <span>{t("Xona qo'shish")}</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
            <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
            <span className="font-bold tabular-nums">{filtered.length}</span>
          </div>
          <div className="relative">
            <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} type="text" placeholder={t("Qidirish")} className="w-56 h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="relative" ref={moreRef}>
            <button onClick={() => setMoreOpen((o) => !o)} className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary" title={t("Amallar")}>
              <MoreVertical className="icon icon-sm" />
            </button>
            {moreOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
                <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                  <span>{t("CSV faylini yuklab olish")}</span>
                </button>
                <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                  <span>{t("EXCEL faylini yuklab olish")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
            {[
              { t: "JAMI XONALAR", v: `${rooms.length} xona` },
              { t: "JAMI JIHOZLAR SONI", v: `${equipment.length} dona` },
              { t: "TA'MIRTALAB & SINGAN", v: `${brokenCount(equipment)} dona` },
              { t: "UMUMIY QIYMATI", v: `${totalValue(equipment).toLocaleString("ru-RU")} UZS` },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl bg-card border border-border p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{c.t}</div>
                <div className="text-[20px] font-semibold tabular-nums">{c.v}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-[15px] font-semibold mb-3">{t("Texnik holati bo'yicha")}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("Texnik holati")}</th>
                  <th className="px-3 py-2 font-medium">{t("Soni")}</th>
                  <th className="px-3 py-2 font-medium">{t("Taxminiy qiymati")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {conditionStats(equipment).map((s) => (
                  <tr key={s.condition}>
                    <td className="px-3 py-2.5 text-[13px]">{s.condition}</td>
                    <td className="px-3 py-2.5 text-[13px] tabular-nums">{s.count} dona</td>
                    <td className="px-3 py-2.5 text-[13px] tabular-nums">{s.value.toLocaleString("ru-RU")} UZS</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-[15px] font-semibold mb-3">{t("Xonalar bo'yicha")}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("Xonalar")}</th>
                  <th className="px-3 py-2 font-medium">{t("Jihozlar soni")}</th>
                  <th className="px-3 py-2 font-medium">{t("Taxminiy qiymati")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roomEquipmentStats(equipment, rooms).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      {t("Jihozlar mavjud emas")}
                    </td>
                  </tr>
                ) : (
                  roomEquipmentStats(equipment, rooms).map((s) => (
                    <tr key={s.room}>
                      <td className="px-3 py-2.5 text-[13px]">{s.room}</td>
                      <td className="px-3 py-2.5 text-[13px] tabular-nums">{s.count} dona</td>
                      <td className="px-3 py-2.5 text-[13px] tabular-nums">{s.value.toLocaleString("ru-RU")} UZS</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Jadval */}
      {/* `hidden` yordam bermaydi — .table-frame ning o'z `display` i uni
          bosib ketadi, shuning uchun inline uslub. */}
      <div
        style={tab === "rooms" ? undefined : { display: "none" }}
        className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm"
      >
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Sarlavha")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("O'quvchi sig'imi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Izoh")}</th>
                <th className="px-3 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => (
                <tr key={r.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px] font-medium">{r.name}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{r.capacity}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{r.note || "—"}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => setEditRoom(r)} className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground" title={t("Tahrirlash")}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(r)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500" title={t("O'chirish")}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Xona topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {addOpen && (
        <RoomModal onClose={() => setAddOpen(false)} onSaved={(r) => setRooms((prev) => [r, ...prev])} />
      )}
      {editRoom && (
        <RoomModal room={editRoom} onClose={() => setEditRoom(null)} onSaved={(r) => setRooms((prev) => prev.map((x) => (x.id === r.id ? r : x)))} />
      )}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} locked={deleting} bare size="sm" zIndex={110} panelClassName="p-6">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">{t("Rostdan ham o'chirmoqchimisiz?")}</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={modal.close} disabled={deleting} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
                {t("Yo'q")}
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
                {deleting ? t("O'chirilmoqda…") : t("Ha")}
              </button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
