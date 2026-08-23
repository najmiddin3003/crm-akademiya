"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MoreVertical, Archive, ArchiveRestore, MessageSquare } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { useToast } from "@/components/ui/Toast";
import { downloadTableCsv, downloadTableExcel, type Cell } from "@/lib/exportTable";
import { normHeader, readFileRows } from "@/components/imtihon/importUtils";
import DavomatCommentModal from "./DavomatCommentModal";
import {
  DAVOMAT_STUDENTS,
  DAVOMAT_DAYS,
  DAVOMAT_STATES,
  DAVOMAT_MODERATORS,
  DAVOMAT_TEACHERS,
  DAVOMAT_REASONS,
  DAVOMAT_GROUPS,
  DAVOMAT_GROUP_STATUSES,
} from "@/constants/davomat";
import { davomatMissedCount, formatDavomatBalance, type DavomatStudent } from "@/lib/davomat";

// Nazorat > Davomat (crm-akademiya #view-nazorat-davomat, app.js renderDavomat()
// ~line 28324). "O'quvchilarni davomatini ko'rish" tugmasi/qatorga bosish
// /nazorat-davomat/viewing sahifasini ochadi (#view-nazorat-davomat-view).
// Manba kabi Holat va Qidirish filtri haqiqiy filtrlaydi — Kun, Ranglar
// bo'yicha, Moderator, O'qituvchi, Sababi, Guruh va sanalar manbada ham
// `renderDavomat()`ni qayta chaqiradi-yu, natijaga ta'sir qilmaydi (ataylab
// shunday qoldirilgan — ko'rinishi uchun saqlandi).
//
// AMALLAR. Referensda (akademiya.edutizim.uz/students/attendance) o'ng
// yuqoridagi "⋮" menyusi: Import / CSV faylini yuklab olish / EXCEL faylini
// yuklab olish. Qator ikonkalari: Arxivlash va Sharh.
//   * Arxivlash — qatorni ro'yxatdan olib qo'yadi; "O'quvchini guruhdagi
//     holati" filtri "Arxiv" qilinsa arxivlanganlar ko'rinadi va o'sha
//     yerdan qaytarib olinadi.
//   * Sharh — davomat bo'yicha eslatma, "Sababi" ustunida ko'rinadi.
// Ikkalasi ham `settings` kolleksiyasida `nazorat.davomat` kaliti ostida
// saqlanadi: bu sahifaning qatorlari statik demo ma'lumot (DAVOMAT_STUDENTS)
// bo'lgani uchun ular uchun alohida kolleksiya ochish mantiqsiz bo'lardi.

const SETTINGS_KEY = "nazorat.davomat";

const HEADERS = ["№", "ID", "O'quvchini ismi", "Telefon raqam", "Balans", "Guruh", "O'qituvchi", "Moderator", "Sababi", "Sharh"];

const selectCls = "filter-select h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
    </div>
  );
}

/** "-500 000 so'm" / "1250000" → -500000 / 1250000. */
function parseBalance(raw: string): number {
  const n = Number(String(raw).replace(/[^\d]/g, "")) || 0;
  return /^\s*[-(]/.test(String(raw)) ? -n : n;
}

export default function NazoratDavomatPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [day, setDay] = useState("");
  const [state, setState] = useState("attended");
  const [moderator, setModerator] = useState("");
  const [teacher, setTeacher] = useState("");
  const [reason, setReason] = useState("");
  const [group, setGroup] = useState("");
  const [groupStatus, setGroupStatus] = useState("");
  const [date, setDate] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  // Referensdagi "Eng ko'p dars qoldirganlar bo'yicha" checkbox'i.
  const [byMostMissed, setByMostMissed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // "⋮" menyusi + import fayl tanlagichi.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Import qilingan qatorlar — faqat shu sahifa ochiq turganda (bazaga
  // yozilmaydi, chunki jadval manbasi statik).
  const [imported, setImported] = useState<DavomatStudent[]>([]);

  // Saqlanadigan holat.
  const [archived, setArchived] = useState<Set<number>>(new Set());
  const [comments, setComments] = useState<Record<number, string>>({});
  const [commentFor, setCommentFor] = useState<DavomatStudent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/settings?key=${SETTINGS_KEY}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.ok) return;
        const v = (d.values || {}) as { archived?: unknown; comments?: unknown };
        if (Array.isArray(v.archived)) setArchived(new Set(v.archived.map(Number)));
        if (v.comments && typeof v.comments === "object") setComments(v.comments as Record<number, string>);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    function onDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const source = useMemo(
    () => [...imported, ...(DAVOMAT_STUDENTS as DavomatStudent[])],
    [imported],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    // Bo'sh va "Aktiv" — arxivlanmaganlar, "Arxiv" — arxivlanganlar.
    const wantArchived = groupStatus === "Arxiv";
    const res = source.filter((s) => {
      if (archived.has(s.id) !== wantArchived) return false;
      if (s.state !== state) return false;
      if (q && !(s.name.toLowerCase().includes(q) || s.phone.includes(q) || s.ident.includes(q))) return false;
      return true;
    });
    if (!byMostMissed) return res;
    return [...res].sort((a, b) => davomatMissedCount(b.id) - davomatMissedCount(a.id));
  }, [source, state, search, byMostMissed, archived, groupStatus]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const pageIds = slice.map((s) => s.id);
  const allPageChecked = pageIds.length > 0 && pageIds.every((id) => checked.has(id));

  function toggleAll(v: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (v) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }
  function toggleRow(id: number, v: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /* ---------- Saqlash (settings) ---------- */

  async function persist(next: { archived?: number[]; comments?: Record<number, string> }): Promise<boolean> {
    const values = {
      archived: next.archived ?? [...archived],
      comments: next.comments ?? comments,
    };
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: SETTINGS_KEY, values }),
    })
      .then((r) => r.json())
      .catch(() => null);
    return Boolean(res?.ok);
  }

  async function toggleArchive(s: DavomatStudent) {
    const wasArchived = archived.has(s.id);
    const next = new Set(archived);
    if (wasArchived) next.delete(s.id);
    else next.add(s.id);
    setArchived(next);
    if (await persist({ archived: [...next] })) {
      showSuccess(wasArchived ? `${s.name} arxivdan chiqarildi` : `${s.name} arxivlandi`);
    } else {
      setArchived(archived);
      showError("Saqlashda xatolik yuz berdi");
    }
  }

  async function saveComment(text: string) {
    if (!commentFor) return;
    const t = text.trim();
    const next = { ...comments };
    if (t) next[commentFor.id] = t;
    else delete next[commentFor.id];
    setBusy(true);
    const ok = await persist({ comments: next });
    setBusy(false);
    if (!ok) {
      showError("Saqlashda xatolik yuz berdi");
      return;
    }
    setComments(next);
    showSuccess(t ? "Sharh saqlandi" : "Sharh o'chirildi");
    setCommentFor(null);
  }

  /* ---------- Import / eksport ---------- */

  function exportRows(): Cell[][] {
    return filtered.map((s, i) => [
      i + 1,
      s.ident,
      s.name,
      s.phone,
      formatDavomatBalance(s.balance),
      s.group,
      s.teacher,
      s.moderator,
      s.reason,
      comments[s.id] || "",
    ]);
  }

  function exportCSV() {
    downloadTableCsv(HEADERS, exportRows(), "davomat.csv");
    showSuccess(`CSV yuklab olindi — ${filtered.length} ta`);
    setMoreOpen(false);
  }

  function exportExcel() {
    downloadTableExcel(HEADERS, exportRows(), "davomat.xls");
    showSuccess(`Excel yuklab olindi — ${filtered.length} ta`);
    setMoreOpen(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    let rows: string[][];
    try {
      rows = await readFileRows(file);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Faylni o'qib bo'lmadi");
      return;
    }
    if (rows.length < 2) {
      showError("Faylda ma'lumot topilmadi");
      return;
    }

    // Ustunlarni sarlavha nomi bo'yicha topamiz — tartibi muhim emas.
    const head = rows[0].map(normHeader);
    const at = (...names: string[]) => {
      for (const n of names) {
        const i = head.indexOf(normHeader(n));
        if (i >= 0) return i;
      }
      return -1;
    };
    const cName = at("O'quvchini ismi", "Ism", "FIO");
    if (cName < 0) {
      showError("«O'quvchini ismi» ustuni topilmadi");
      return;
    }
    const cIdent = at("ID");
    const cPhone = at("Telefon raqam", "Telefon");
    const cBalance = at("Balans");
    const cGroup = at("Guruh");
    const cTeacher = at("O'qituvchi");
    const cModerator = at("Moderator");
    const cReason = at("Sababi");

    let nextId = source.reduce((m, s) => Math.max(m, s.id), 0);
    const parsed: DavomatStudent[] = [];
    for (const r of rows.slice(1)) {
      const name = String(r[cName] ?? "").trim();
      if (!name) continue;
      nextId += 1;
      parsed.push({
        id: nextId,
        ident: String(r[cIdent] ?? "").trim() || `imp-${nextId}`,
        name,
        phone: String(r[cPhone] ?? "").trim(),
        balance: cBalance >= 0 ? parseBalance(String(r[cBalance] ?? "")) : 0,
        group: String(r[cGroup] ?? "").trim(),
        teacher: String(r[cTeacher] ?? "").trim(),
        moderator: String(r[cModerator] ?? "").trim(),
        reason: String(r[cReason] ?? "").trim(),
        // Import qilingan qator joriy "Holat" filtri ostida ko'rinsin.
        state: state as DavomatStudent["state"],
      });
    }

    setMoreOpen(false);
    if (parsed.length === 0) {
      showError("Faylda o'quvchi topilmadi");
      return;
    }
    setImported((prev) => [...parsed, ...prev]);
    setPage(1);
    showSuccess(`${parsed.length} ta qator import qilindi (bazaga yozilmaydi)`);
  }

  const viewingArchive = groupStatus === "Arxiv";

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Header qatori */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/nazorat-davomat/viewing"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <Eye className="icon icon-sm" />
          <span>O&apos;quvchilarni davomatini ko&apos;rish</span>
        </Link>

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className="h-10 w-10 rounded-lg hover:bg-secondary inline-flex items-center justify-center"
            title="Amallar"
          >
            <MoreVertical className="icon icon-sm" />
          </button>
          {moreOpen && (
            <div className="absolute top-full right-0 mt-2 z-50 w-60 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
              <button onClick={() => fileRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-[10px] font-bold text-primary">IN</span>
                <span>Import</span>
              </button>
              <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                <span>CSV faylini yuklab olish</span>
              </button>
              <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                <span>EXCEL faylini yuklab olish</span>
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {/* Filtrlar 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <SelectWrap>
          <select value={day} onChange={(e) => setDay(e.target.value)} className={selectCls}>
            <option value="">Kun</option>
            {DAVOMAT_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={state} onChange={(e) => { setState(e.target.value); setPage(1); }} className={selectCls}>
            {DAVOMAT_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select className={selectCls} defaultValue="">
            <option value="">Ranglar bo&apos;yicha</option>
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={moderator} onChange={(e) => setModerator(e.target.value)} className={selectCls}>
            <option value="">Moderator</option>
            {DAVOMAT_MODERATORS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className={selectCls}>
            <option value="">O&apos;qituvchi</option>
            {DAVOMAT_TEACHERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </SelectWrap>
      </div>

      {/* Filtrlar 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <SelectWrap>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={selectCls}>
            <option value="">Sababi</option>
            {DAVOMAT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={selectCls}>
            <option value="">Guruh</option>
            {DAVOMAT_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={groupStatus} onChange={(e) => { setGroupStatus(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">O&apos;quvchini guruhdagi holati</option>
            {DAVOMAT_GROUP_STATUSES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </SelectWrap>
        <div className="relative">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <svg className="icon icon-xs pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-calendar" /></svg>
          {date && (
            <button type="button" onClick={() => setDate("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <svg className="icon icon-xs"><use href="#i-x-circle" /></svg>
            </button>
          )}
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />

        {/* Referensdagi checkbox — ro'yxatni qoldirilgan darslar soni bo'yicha
            kamayish tartibida saralaydi. */}
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={byMostMissed}
            onChange={(e) => { setByMostMissed(e.target.checked); setPage(1); }}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span>Eng ko&apos;p dars qoldirganlar bo&apos;yicha</span>
        </label>
      </div>

      {/* Qidirish */}
      <div className="relative max-w-md">
        <svg className="icon icon-sm pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-search" /></svg>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          type="text"
          placeholder="Qidirish"
          className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Jadval */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1300px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-10">
                  <input type="checkbox" checked={allPageChecked} onChange={(e) => toggleAll(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
                </th>
                <th className="px-3 py-3 text-left w-12">№</th>
                <th className="px-3 py-3 text-left">ID</th>
                <th className="px-3 py-3 text-left">O&apos;quvchini ismi</th>
                <th className="px-3 py-3 text-left">Telefon raqam</th>
                <th className="px-3 py-3 text-right">Balans</th>
                <th className="px-3 py-3 text-left">Guruh</th>
                <th className="px-3 py-3 text-left">O&apos;qituvchi</th>
                <th className="px-3 py-3 text-left">Moderator</th>
                <th className="px-3 py-3 text-left">Sababi</th>
                <th className="px-3 py-3 text-right pr-5">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={() => router.push(`/nazorat-davomat/viewing?studentId=${s.id}`)}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked.has(s.id)} onChange={(e) => toggleRow(s.id, e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[12px] font-mono text-muted-foreground">{s.ident}</td>
                  <td className="px-3 py-3 font-medium" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/student-edit/${s.id}`} className="hover:text-primary hover:underline">{s.name}</Link>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-[13px]">{s.phone}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${s.balance < 0 ? "text-rose-600" : s.balance > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {formatDavomatBalance(s.balance)}
                  </td>
                  <td className="px-3 py-3">{s.group}</td>
                  <td className="px-3 py-3">{s.teacher}</td>
                  <td className="px-3 py-3">{s.moderator}</td>
                  <td className="px-3 py-3 text-[13px]">
                    <div>{s.reason || "-"}</div>
                    {comments[s.id] && (
                      <div className="mt-0.5 text-[12px] text-muted-foreground">{comments[s.id]}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right pr-5" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleArchive(s)}
                        title={viewingArchive ? "Arxivdan chiqarish" : "Arxivlash"}
                        className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-primary"
                      >
                        {viewingArchive ? <ArchiveRestore className="icon icon-xs" /> : <Archive className="icon icon-xs" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommentFor(s)}
                        title={comments[s.id] ? "Sharhni tahrirlash" : "Sharh qo'shish"}
                        className={`h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center hover:text-primary ${comments[s.id] ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <MessageSquare className="icon icon-xs" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
                        <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
                      </div>
                      <h3 className="text-[15px] font-semibold mb-1">Ma&apos;lumotlar topilmadi</h3>
                      <p className="text-[13px] text-muted-foreground">Filterni o&apos;zgartirib ko&apos;ring</p>
                    </div>
                  </td>
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

      {commentFor && (
        <DavomatCommentModal
          studentName={commentFor.name}
          initialValue={comments[commentFor.id] || ""}
          busy={busy}
          onClose={() => setCommentFor(null)}
          onSave={saveComment}
        />
      )}
    </div>
  );
}
