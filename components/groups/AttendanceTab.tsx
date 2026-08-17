"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, Download, MessageSquare, Send, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import {
  ABSENCE_REASONS,
  ATTENDANCE_COLOR,
  ATTENDANCE_GLYPH,
  ATTENDANCE_OPTIONS,
  GRADES,
  GRADE_COLOR,
  lessonDates,
  parsePeriod,
  type AttendanceGlyph,
  type AttendanceGrade,
  type AttendanceHistoryEntry,
  type AttendanceMark,
  type AttendanceStatus,
  type LessonDate,
} from "@/lib/attendance";
import { useLang } from "@/components/shared/Language";
import { MONTHS } from "@/lib/i18n";
import type { Group } from "@/lib/groups";
import type { GroupNote } from "@/lib/groupNotes";
import type { Pupil } from "@/lib/pupilsData";

// Guruh → Davomat tabi (referens: akademiya.edutizim.uz/group/groups/details/
// <id>?status=attendance).
//
// Ustunlar QATTIQ YOZILMAGAN: ular guruhning dars kunlaridan (`group.day`)
// tanlangan yil+oy ichida hisoblanadi. Masalan "Toq kunlar" → Dushanba,
// Chorshanba, Juma; 2026-yil avgustda bu 03.08, 05.08, 07.08, 10.08 ... —
// referensdagi bilan aynan bir xil.
//
// Katakcha bosilganda chiqadigan ro'yxat (referensga mos):
//   - holatlar: Keldi / Birinchi dars / Sababli / Sababsiz
//   - HOZIRGI holat ro'yxatda KO'RSATILMAYDI (yashil tanlangan bo'lsa, qayta
//     bosganda faqat qolgan uchtasi chiqadi)
//   - pastida 1..5 baho tugmalari
//   - holat qo'yilgan bo'lsa "Bekor qilish"
// "Sababli" tanlansa — "Izoh qoldiring" oynasi ochiladi (sabab + izoh matni).

export interface AttendanceTabProps {
  group: Group;
  members: Pupil[];
  membersLoading: boolean;
}

type SortMode = "name" | "joined";

function pupilName(p: Pupil): string {
  return `${p.firstName} ${p.lastName || ""}`.trim();
}
function demoBalance(p: Pupil): number {
  return ((p.id * 137) % 6000) * 1000;
}
function nf(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const thCls =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap";

/** Doiracha + ichidagi belgi. Referensda ikonka 19x19. */
function StatusDot({ status }: { status: AttendanceStatus | null }) {
  if (!status) {
    return (
      <span
        className="inline-block h-[19px] w-[19px] rounded-full border-2 align-middle"
        style={{ borderColor: "hsl(var(--border))" }}
      />
    );
  }
  const color = ATTENDANCE_COLOR[status];
  const glyph: AttendanceGlyph = ATTENDANCE_GLYPH[status];
  return (
    <span
      className="inline-flex h-[19px] w-[19px] items-center justify-center rounded-full align-middle"
      style={{ backgroundColor: color }}
    >
      <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        {glyph === "check" && <polyline points="20 6 9 17 4 12" />}
        {glyph === "minus" && <line x1="6" y1="12" x2="18" y2="12" />}
        {glyph === "bang" && (
          <>
            <line x1="12" y1="6" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12" y2="17.01" />
          </>
        )}
      </svg>
    </span>
  );
}

export default function AttendanceTab({ group, members, membersLoading }: AttendanceTabProps) {
  const { showError } = useToast();
  const [lang] = useLang();
  const monthNames = MONTHS[lang];
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [sortMode, setSortMode] = useState<SortMode>("joined");
  // Kalit: `${pupilId}|${iso}` → to'liq belgi (holat + baho + sabab + izoh).
  const [marks, setMarks] = useState<Map<string, AttendanceMark>>(new Map());
  const [loading, setLoading] = useState(true);
  // Tanlov ro'yxati jadval ichida emas, `position: fixed` bilan chiziladi:
  // `.table-scroll` da `overflow: auto` bor va oddiy absolute menyu kesilib
  // qolardi (4 ta variantdan faqat 2 tasi ko'rinardi).
  // `pendingGrade` — menyu ochiq turganda tanlangan baho. Raqam bosilganda
  // menyu YOPILMAYDI: avval baho, keyin tepadagi holat tanlanadi.
  const [menu, setMenu] = useState<
    { key: string; pupilId: number; iso: string; x: number; y: number; pendingGrade: AttendanceGrade | null } | null
  >(null);
  // "Tarixi" bo'limi — o'sha katakcha bo'yicha o'zgarishlar. Bir vaqtda bitta
  // yozuv ko'rsatiladi, oldinga/orqaga strelkalar bilan varaqlanadi.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<AttendanceHistoryEntry[] | null>(null);
  const [historyIdx, setHistoryIdx] = useState(0);
  // "Sababli" tanlanganda ochiladigan "Izoh qoldiring" oynasi.
  const [reasonModal, setReasonModal] = useState<
    { pupilId: number; iso: string; reason: string; note: string; grade: AttendanceGrade | null } | null
  >(null);
  // "Izoh" ustunidagi tugma — o'quvchiga xabar yozadigan panel (o'ngdan chiqadi).
  const [notesFor, setNotesFor] = useState<Pupil | null>(null);
  const [notes, setNotes] = useState<GroupNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [sending, setSending] = useState(false);
  const notesEndRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const bounds = useMemo(() => parsePeriod(group.period), [group.period]);
  const lessons: LessonDate[] = useMemo(
    () => lessonDates(group.day, year, month, bounds),
    [group.day, year, month, bounds],
  );

  const cellKey = (pupilId: number, iso: string) => `${pupilId}|${iso}`;

  // Tanlangan oy uchun belgilarni yuklash. Barcha setState chaqiruvlari
  // promise callback'lari ichida — effekt tanasida sinxron setState
  // "cascading render" ga olib keladi (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/groups/${group.id}/attendance?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) throw new Error(data.error || "Yuklab bo'lmadi");
        const next = new Map<string, AttendanceMark>();
        for (const m of data.marks as AttendanceMark[]) next.set(cellKey(m.pupilId, m.date), m);
        setMarks(next);
      })
      .catch((e: unknown) => {
        if (!cancelled) showError(e instanceof Error ? e.message : "Davomatni yuklab bo'lmadi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [group.id, year, month, showError]);

  // Tashqariga bosilganda / scroll qilinganda / Esc bosilganda yopish.
  useEffect(() => {
    if (!menu) return;
    const close = () => { setMenu(null); setHistoryOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.("[data-att-menu]")) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Menyu fixed bo'lgani uchun jadval siljisa u joyida qolib ketadi — yopamiz.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  // Panel ochilganda o'quvchining xabarlarini yuklash.
  useEffect(() => {
    if (!notesFor) return;
    let cancelled = false;
    const pupilId = notesFor.id;
    fetch(`/api/groups/${group.id}/notes?pupilId=${pupilId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) throw new Error(data.error || "Yuklab bo'lmadi");
        setNotes(data.notes as GroupNote[]);
      })
      .catch((e: unknown) => {
        if (!cancelled) showError(e instanceof Error ? e.message : "Xabarlarni yuklab bo'lmadi");
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false);
      });
    return () => { cancelled = true; };
  }, [notesFor, group.id, showError]);

  /** "Tarixi" bosilganda — o'sha katakcha bo'yicha o'zgarishlarni yuklaydi. */
  const openHistory = async () => {
    if (!menu) return;
    setHistoryOpen(true);
    setHistory(null);
    setHistoryIdx(0);
    try {
      const res = await fetch(
        `/api/groups/${group.id}/attendance/history?pupilId=${menu.pupilId}&date=${menu.iso}`,
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Yuklab bo'lmadi");
      setHistory(data.entries as AttendanceHistoryEntry[]);
    } catch (e) {
      setHistory([]);
      showError(e instanceof Error ? e.message : "Tarixni yuklab bo'lmadi");
    }
  };

  const sendNote = async () => {
    const text = noteText.trim();
    if (!notesFor || !text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pupilId: notesFor.id, text }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Yuborilmadi");
      setNotes((n) => [...n, data.note as GroupNote]);
      setNoteText("");
      // Yangi xabar ko'rinib turishi uchun pastga suramiz.
      requestAnimationFrame(() => notesEndRef.current?.scrollIntoView({ block: "end" }));
    } catch (e) {
      showError(e instanceof Error ? e.message : "Xabar yuborilmadi");
    } finally {
      setSending(false);
    }
  };

  /** Serverga yozadi. Optimistik: darhol ko'rsatamiz, xato bo'lsa qaytaramiz. */
  const save = async (
    pupilId: number,
    iso: string,
    next: { status: AttendanceStatus | null; grade?: AttendanceGrade | null; reason?: string | null; note?: string | null },
  ) => {
    const key = cellKey(pupilId, iso);
    const prev = marks.get(key) ?? null;
    setMarks((m) => {
      const copy = new Map(m);
      if (next.status === null) copy.delete(key);
      else {
        copy.set(key, {
          groupId: group.id,
          pupilId,
          date: iso,
          status: next.status,
          grade: next.grade ?? null,
          reason: next.reason ?? null,
          note: next.note ?? null,
        });
      }
      return copy;
    });
    try {
      const res = await fetch(`/api/groups/${group.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pupilId, date: iso, ...next }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Saqlanmadi");
    } catch (e) {
      setMarks((m) => {
        const copy = new Map(m);
        if (prev === null) copy.delete(key);
        else copy.set(key, prev);
        return copy;
      });
      showError(e instanceof Error ? e.message : "Davomat saqlanmadi");
    }
  };

  const chooseStatus = (pupilId: number, iso: string, status: AttendanceStatus) => {
    const cur = marks.get(cellKey(pupilId, iso)) ?? null;
    // Menyuda tanlangan baho holat bilan birga saqlanadi.
    const grade = menu?.pendingGrade ?? cur?.grade ?? null;
    setMenu(null);
    if (status === "sababli") {
      // Sabab va izoh alohida oynada so'raladi.
      setReasonModal({ pupilId, iso, reason: cur?.reason ?? "", note: cur?.note ?? "", grade });
      return;
    }
    void save(pupilId, iso, { status, grade });
  };

  /**
   * Baho tanlash. Menyu OCHIQ qoladi — foydalanuvchi keyin tepadagi holatni
   * ham tanlashi mumkin. Qayta bosilsa baho olib tashlanadi.
   *
   * Holat allaqachon qo'yilgan bo'lsa baho darhol saqlanadi; holat hali
   * tanlanmagan bo'lsa baho kutib turadi va holat tanlangan payt birga
   * yoziladi (baho o'zi holatni "Keldi" qilib qo'ymaydi).
   */
  const chooseGrade = (pupilId: number, iso: string, grade: AttendanceGrade) => {
    const cur = marks.get(cellKey(pupilId, iso)) ?? null;
    const next = menu?.pendingGrade === grade ? null : grade;
    setMenu((m) => (m ? { ...m, pendingGrade: next } : m));
    if (cur?.status) {
      void save(pupilId, iso, {
        status: cur.status,
        grade: next,
        reason: cur.reason ?? null,
        note: cur.note ?? null,
      });
    }
  };

  const clearPupil = async (pupilId: number) => {
    if (!confirm("Shu o'quvchining joriy oydagi davomati bekor qilinsinmi?")) return;
    try {
      const res = await fetch(
        `/api/groups/${group.id}/attendance?pupilId=${pupilId}&year=${year}&month=${month}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Bekor qilinmadi");
      setMarks((m) => {
        const copy = new Map(m);
        for (const l of lessons) copy.delete(cellKey(pupilId, l.iso));
        return copy;
      });
    } catch (e) {
      showError(e instanceof Error ? e.message : "Bekor qilib bo'lmadi");
    }
  };

  const rows = useMemo(() => {
    const list = [...members];
    if (sortMode === "name") list.sort((a, b) => pupilName(a).localeCompare(pupilName(b), "uz"));
    return list;
  }, [members, sortMode]);

  /** O'quvchining shu oydagi o'rtacha bahosi. */
  const avgGrade = (pupilId: number): string => {
    const gs = lessons
      .map((l) => marks.get(cellKey(pupilId, l.iso))?.grade)
      .filter((g): g is AttendanceGrade => typeof g === "number");
    if (gs.length === 0) return "—";
    return (gs.reduce((a, b) => a + b, 0) / gs.length).toFixed(1);
  };

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now]);

  const exportCsv = () => {
    const head = ["№", "Ism", ...lessons.map((l) => `${l.index}-dars ${l.short}`), "O'rtacha baho"];
    const body = rows.map((p, i) => [
      String(i + 1),
      pupilName(p),
      ...lessons.map((l) => {
        const m = marks.get(cellKey(p.id, l.iso));
        if (!m) return "";
        const label = ATTENDANCE_OPTIONS.find((o) => o.key === m.status)?.label ?? "";
        return m.grade ? `${label} (${m.grade})` : label;
      }),
      avgGrade(p.id),
    ]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `davomat-${group.name || group.id}-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div ref={rootRef}>
      {/* ---- Boshqaruv qatori ---- */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-border">
        <div className="text-[13px]">
          <span className="text-muted-foreground">Guruh nomi</span>{" "}
          <span className="font-semibold">{group.name}</span>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        <div className="flex-1" />

        <div className="inline-flex items-center h-9 rounded-lg border border-border bg-card p-0.5 gap-0.5 text-[13px]">
          <button
            onClick={() => setSortMode("name")}
            className={`h-8 px-3 rounded-md ${sortMode === "name" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
          >
            Ism bo&apos;yicha
          </button>
          <button
            onClick={() => setSortMode("joined")}
            className={`h-8 px-3 rounded-md ${sortMode === "joined" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
          >
            Qo&apos;shilgan sana bo&apos;yicha
          </button>
        </div>

        <select
          value={year}
          onChange={(e) => { setLoading(true); setYear(Number(e.target.value)); }}
          className="h-9 rounded-lg border border-border bg-card px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={month}
          onChange={(e) => { setLoading(true); setMonth(Number(e.target.value)); }}
          className="h-9 rounded-lg border border-border bg-card px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </div>

      <div className="px-4 py-2 flex items-center gap-2">
        <span className="text-primary font-semibold text-[14px]">Aktiv o&apos;quvchi</span>
        <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-primary/10 text-primary text-[12px] font-bold tabular-nums">
          {members.length}
        </span>
        {loading && <span className="text-[12px] text-muted-foreground">yuklanmoqda…</span>}
      </div>

      {/* Guruh jadvali yo'q bo'lsa ustunlarni to'qib chiqarmaymiz — sababni aytamiz. */}
      {lessons.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          {group.day
            ? `${monthNames[month - 1]} ${year} da bu guruh uchun dars kuni yo'q (dars kunlari: ${group.day}).`
            : "Guruhga dars kunlari belgilanmagan — davomat ustunlari shundan hosil bo'ladi."}
        </div>
      ) : (
        <div className="table-scroll" style={{ maxHeight: "58vh" }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={`${thCls} w-10`}>№</th>
                <th className={thCls}>Ism</th>
                <th className={thCls}>Balans</th>
                <th className={`${thCls} text-center`}>Davomatni bekor qilish</th>
                {lessons.map((l) => (
                  <th key={l.iso} className="px-2 py-2 text-center whitespace-nowrap">
                    <span className="block text-[10px] font-semibold text-primary">{l.index}-dars</span>
                    <span className="block text-[12px] font-bold tabular-nums">{l.short}</span>
                  </th>
                ))}
                <th className={`${thCls} text-center`}>O&apos;rtacha baho</th>
                <th className={`${thCls} text-center`}>Izoh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p, i) => {
                return (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 text-[13px] font-medium whitespace-nowrap">{pupilName(p)}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{nf(demoBalance(p))}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => clearPupil(p.id)}
                        className="h-7 w-7 rounded-md hover:bg-rose-500/10 inline-flex items-center justify-center"
                        style={{ color: "#e34a29" }}
                        title="Davomatni bekor qilish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                    {lessons.map((l) => {
                      const key = cellKey(p.id, l.iso);
                      const mark = marks.get(key) ?? null;
                      return (
                        <td key={l.iso} className="px-2 py-3 text-center">
                          <button
                            data-att-menu=""
                            onClick={(e) => {
                              if (menu?.key === key) { setMenu(null); return; }
                              const r = e.currentTarget.getBoundingClientRect();
                              setMenu({
                                key, pupilId: p.id, iso: l.iso,
                                x: r.left + r.width / 2, y: r.bottom + 6,
                                pendingGrade: mark?.grade ?? null,
                              });
                            }}
                            title={
                              mark
                                ? [
                                    ATTENDANCE_OPTIONS.find((o) => o.key === mark.status)?.label,
                                    mark.grade ? `baho: ${mark.grade}` : null,
                                    mark.reason,
                                  ].filter(Boolean).join(" · ")
                                : "Davomat belgilash"
                            }
                            className="leading-none"
                          >
                            <StatusDot status={mark?.status ?? null} />
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center text-[13px] tabular-nums font-semibold">{avgGrade(p.id)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setNotesFor(p)}
                        title="Izoh qoldirish"
                        className="h-7 w-7 rounded-md inline-flex items-center justify-center text-primary hover:bg-secondary"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6 + lessons.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {membersLoading ? <SpinnerBlock size={22} /> : "Guruhga o'quvchi qo'shilmagan"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tanlov ro'yxati — jadvaldan TASHQARIDA va `position: fixed`, shuning
          uchun `.table-scroll` ning overflow'i uni kesmaydi. */}
      {menu && (() => {
        const mark = marks.get(menu.key) ?? null;
        // Referens: hozirgi holat ro'yxatda ko'rsatilmaydi.
        const options = ATTENDANCE_OPTIONS.filter((o) => o.key !== mark?.status);
        const W = 190;
        const half = W / 2;
        const left = Math.min(Math.max(menu.x, half + 8), window.innerWidth - half - 8);
        const needed = options.length * 38 + 52 + (mark ? 42 : 0) + 16;
        const flipUp = menu.y + needed > window.innerHeight - 8;
        const top = flipUp ? Math.max(8, menu.y - needed - 30) : menu.y;
        return (
          <div
            data-att-menu=""
            className="fixed z-[120] rounded-xl border border-border bg-card p-1 shadow-xl text-left"
            style={{ left, top, width: W, transform: "translateX(-50%)" }}
          >
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => chooseStatus(menu.pupilId, menu.iso, o.key)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] hover:bg-secondary"
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />
                <span>{o.label}</span>
              </button>
            ))}

            {/* 1..5 baho tugmalari */}
            <div className="mt-1 flex items-center justify-between gap-1 border-t border-border px-1.5 pt-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => chooseGrade(menu.pupilId, menu.iso, g)}
                  title={menu.pendingGrade === g ? `Baho ${g} — olib tashlash` : `Baho ${g}`}
                  className={`h-7 w-7 rounded-md text-[13px] font-bold text-white transition-transform hover:scale-110 ${
                    menu.pendingGrade === g ? "ring-2 ring-offset-1 ring-primary" : ""
                  }`}
                  style={{ backgroundColor: GRADE_COLOR[g] }}
                >
                  {g}
                </button>
              ))}
            </div>

            {mark && (
              <button
                onClick={() => { setMenu(null); void save(menu.pupilId, menu.iso, { status: null }); }}
                className="mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-border px-2.5 py-2 text-[13px] hover:bg-secondary"
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: "#fc0707" }} />
                <span>Bekor qilish</span>
              </button>
            )}

            <button
              onClick={() => void openHistory()}
              className="mt-1 w-full rounded-lg border-t border-border px-2.5 py-2 text-left text-[13px] font-medium text-primary hover:bg-secondary"
            >
              Tarixi
            </button>
          </div>
        );
      })()}

      {/* "Tarixi" — katakcha bo'yicha o'zgarishlar. Bir vaqtda bitta yozuv,
          oldinga/orqaga strelkalar bilan varaqlanadi. */}
      {menu && historyOpen && (() => {
        const W = 300;
        const half = W / 2;
        const left = Math.min(Math.max(menu.x, half + 8), window.innerWidth - half - 8);
        const top = Math.min(menu.y, Math.max(8, window.innerHeight - 260));
        const entry = history?.[historyIdx] ?? null;
        return (
          <div
            data-att-menu=""
            className="fixed z-[130] rounded-xl border border-border bg-card p-3 shadow-xl"
            style={{ left, top, width: W, transform: "translateX(-50%)" }}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <button
                onClick={() => setHistoryOpen(false)}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:text-primary"
              >
                <ChevronLeft className="h-4 w-4" />
                Ortga
              </button>
              <div className="flex flex-col items-end gap-0.5">
                <button
                  onClick={() => setHistoryIdx((i) => Math.max(0, i - 1))}
                  disabled={!history || historyIdx === 0}
                  title="Yangiroq"
                  className="text-muted-foreground hover:text-primary disabled:opacity-30"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setHistoryIdx((i) => Math.min((history?.length ?? 1) - 1, i + 1))}
                  disabled={!history || historyIdx >= history.length - 1}
                  title="Eskiroq"
                  className="text-muted-foreground hover:text-primary disabled:opacity-30"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {history === null && <div className="py-6 text-center text-[13px] text-muted-foreground">yuklanmoqda…</div>}
            {history !== null && history.length === 0 && (
              <div className="py-6 text-center text-[13px] text-muted-foreground">Tarix yo&apos;q</div>
            )}
            {entry && (
              <div className="space-y-3 text-[13px]">
                <div className="font-medium">{entry.author}</div>
                <div className="text-muted-foreground tabular-nums">{entry.createdAt}</div>
                <div>
                  <div className="text-muted-foreground">Baho o&apos;zgartirildi:</div>
                  <div className="mt-0.5">{entry.grade ?? "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Sharh qoldirildi:</div>
                  <div className="mt-0.5">{[entry.reason, entry.note].filter(Boolean).join(" — ") || "-"}</div>
                </div>
                {history && history.length > 1 && (
                  <div className="pt-1 text-right text-[11px] text-muted-foreground tabular-nums">
                    {historyIdx + 1} / {history.length}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* "Izoh qoldiring" — Sababli tanlanganda */}
      {reasonModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setReasonModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-center text-lg font-semibold">Izoh qoldiring</h3>

            <label className="mb-1.5 block text-[13px] font-medium">Sababi</label>
            <select
              value={reasonModal.reason}
              onChange={(e) => setReasonModal({ ...reasonModal, reason: e.target.value })}
              className="mb-4 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Tanlang</option>
              {ABSENCE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <label className="mb-1.5 block text-[13px] font-medium">Izoh</label>
            <textarea
              value={reasonModal.note}
              onChange={(e) => setReasonModal({ ...reasonModal, note: e.target.value })}
              rows={4}
              placeholder="Qo'shimcha izoh…"
              className="mb-4 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setReasonModal(null)}
                className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary"
              >
                Yopish
              </button>
              <button
                onClick={() => {
                  if (!reasonModal.reason) { showError("Sababni tanlang"); return; }
                  void save(reasonModal.pupilId, reasonModal.iso, {
                    status: "sababli",
                    grade: reasonModal.grade,
                    reason: reasonModal.reason,
                    note: reasonModal.note.trim() || null,
                  });
                  setReasonModal(null);
                }}
                className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90"
              >
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "Izoh" ustuni — o'quvchiga xabar yozish paneli (referensda o'ngdan chiqadi) */}
      {notesFor && (
        <div className="fixed inset-0 z-[200]" onClick={() => setNotesFor(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="absolute right-0 top-0 flex h-full w-full max-w-[380px] flex-col border-l border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <button
                onClick={() => setNotesFor(null)}
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-secondary inline-flex items-center justify-center"
                title="Yopish"
              >
                <X className="h-4 w-4" />
              </button>
              <h3 className="truncate text-right text-[15px] font-semibold">{pupilName(notesFor)}</h3>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {notesLoading && <div className="text-center text-[13px] text-muted-foreground">yuklanmoqda…</div>}

              {notes.map((n) => (
                <div key={n.id} className="mb-2 rounded-xl bg-primary/10 px-3 py-2">
                  <div className="whitespace-pre-wrap text-[13px]">{n.text}</div>
                  <div className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">{n.createdAt}</div>
                </div>
              ))}

              {!notesLoading && notes.length === 0 && (
                <div className="py-10 text-center text-[13px] text-muted-foreground">Hozircha izoh yo&apos;q</div>
              )}
              <div ref={notesEndRef} />
            </div>

            <div className="flex items-end gap-2 border-t border-border p-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  // Enter — yuborish, Shift+Enter — yangi qator.
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendNote(); }
                }}
                rows={1}
                placeholder="Izoh qoldirish"
                className="max-h-28 min-h-[38px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={() => void sendNote()}
                disabled={!noteText.trim() || sending}
                title="Yuborish"
                className="h-[38px] w-[38px] shrink-0 rounded-lg bg-primary text-white inline-flex items-center justify-center hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
