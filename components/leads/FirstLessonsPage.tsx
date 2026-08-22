"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell, CalendarCheck, CalendarClock, CalendarX2, CheckCircle2,
  MoreVertical, Phone, Printer, Send, StickyNote, TrendingUp, User, Users, XCircle,
} from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateField from "@/components/ui/DateField";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useTeachers } from "@/hooks/useTeachers";
import {
  FIRST_LESSON_STATUSES,
  firstLessonStatusLabel,
  type FirstLessonStatus,
  type Order,
} from "@/lib/ordersData";

// Lidlar → Birinchi darsga yozilganlar (referens: akademiya.edutizim.uz).
//
// Ma'lumot manbai — HAQIQIY buyurtmalar (MongoDB `orders` → /api/orders):
// "birinchi darsga kelish sanasi" belgilangan buyurtmalar shu sahifada
// ko'rinadi. Lidning bu sahifadagi holati (`firstLessonStatus`) buyurtmaning
// o'z `status`idan ALOHIDA: Yozildi → Eslatildi → Keldi / Kelmadi →
// Guruhga qo'shildi va h.k.
//
// Sahifa uch qismdan iborat (hammasi referensdagi kabi):
//   1) 6 ta KPI kartasi (Bugun, Kelganlar, Kelmaganlar, Guruhga qo'shildi,
//      Conversion, Aloqa kerak)
//   2) tez filtr tablari (Hammasi / Yozildi / Keldi / ... / Natija kiritilmagan)
//   3) jadval + har qatordagi "⋮" amallar menyusi
//
// CSS klasslari (fl-stat-card, fl-quick-tab, fl-action-menu…) globals.css da
// ilgari ko'chirilgan edi — bu yerda ular nihoyat ishlatilyapti.

const uniq = (values: (string | undefined)[]): string[] =>
  [...new Set(values.filter((v): v is string => Boolean(v)))].sort();

/** "29.08.2026 | 10:00" → "2026-08-29" (date maydonlari bilan solishtirish uchun). */
function firstLessonIso(firstLesson: string): string {
  const m = (firstLesson || "").match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
/** "22.08.2026 | 06:44" → "2026-08-22" (yaratilgan sana). */
function createdIso(created: string): string {
  const m = (created || "").match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Buyurtmadagi dars kunlari naqshi ("Toq kunlar", "Du,Ch") bo'yicha. */
function oddEvenOf(day: string): "toq" | "juft" | "boshqa" {
  const d = (day || "").toLowerCase();
  if (d.includes("toq")) return "toq";
  if (d.includes("juft")) return "juft";
  return "boshqa";
}

/** Telefonni xalqaro ko'rinishga: "94 408 57 97" → "+998944085797". */
function telHref(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits.length === 9 ? `998${digits}` : digits}`;
}

type TabKey = "all" | FirstLessonStatus | "none";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "YOZILDI", label: "Yozildi" },
  { key: "KELDI", label: "Keldi" },
  { key: "KELMADI", label: "Kelmadi" },
  { key: "GURUHGA_QOSHILDI", label: "Guruhga qo'shildi" },
  { key: "ALOQA_KERAK", label: "Aloqa kerak" },
  { key: "none", label: "Natija kiritilmagan" },
];

export default function FirstLessonsPage() {
  const { showSuccess, showError } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [range, setRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [courseFilter, setCourseFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [oddEvenFilter, setOddEvenFilter] = useState("");
  const [moderatorFilter, setModeratorFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // "⋮" menyusi va u ochadigan oynalar
  const [menuFor, setMenuFor] = useState<{ order: Order; top: number; left: number } | null>(null);
  const [statusFor, setStatusFor] = useState<Order | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Order | null>(null);
  const [noteFor, setNoteFor] = useState<Order | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setOrders(d.orders); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuFor]);

  /** Buyurtmani yangilaydi (server + mahalliy ro'yxat). */
  const patchOrder = useCallback(async (id: number, patch: Partial<Order>): Promise<boolean> => {
    try {
      const d = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then((r) => r.json());
      if (!d.ok) return false;
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
      return true;
    } catch {
      return false;
    }
  }, []);

  // Birinchi darsga YOZILGANLAR — sanasi belgilangan buyurtmalar.
  const rows = useMemo(() => orders.filter((o) => (o.firstLesson || "").trim()), [orders]);

  const { names: allTeachers } = useTeachers();
  const courseOptions = useMemo(() => uniq(rows.map((o) => o.course)), [rows]);
  const levelOptions = useMemo(() => uniq(rows.map((o) => o.level)), [rows]);
  const dayOptions = useMemo(() => uniq(rows.map((o) => o.lessonDay)), [rows]);
  const moderatorOptions = useMemo(() => uniq(rows.map((o) => o.moderator)), [rows]);
  const teacherOptions = useMemo(
    () => uniq([...allTeachers, ...rows.map((o) => o.teacher)]),
    [allTeachers, rows],
  );

  /** Tab'dan tashqari barcha filtrlar — tab sonlari shu asosda hisoblanadi. */
  const beforeTab = useMemo(() => {
    const q = search.trim().toLowerCase();
    const startIso = range.start ? toIso(range.start) : "";
    const endIso = range.end ? toIso(range.end) : "";
    return rows.filter((o) => {
      const lessonIso = firstLessonIso(o.firstLesson);
      if (dateFilter && lessonIso !== dateFilter) return false;
      if (startIso || endIso) {
        const c = createdIso(o.created);
        if (!c) return false;
        if (startIso && c < startIso) return false;
        if (endIso && c > endIso) return false;
      }
      if (courseFilter && o.course !== courseFilter) return false;
      if (levelFilter && o.level !== levelFilter) return false;
      if (dayFilter && o.lessonDay !== dayFilter) return false;
      if (oddEvenFilter && oddEvenOf(o.lessonDay) !== oddEvenFilter) return false;
      if (moderatorFilter && o.moderator !== moderatorFilter) return false;
      if (teacherFilter && o.teacher !== teacherFilter) return false;
      if (statusFilter && o.firstLessonStatus !== statusFilter) return false;
      if (q) {
        const hay = [o.name, o.phone, o.id, o.course, o.level, o.teacher, o.moderator, o.note]
          .join(" ").toLowerCase();
        const digits = search.replace(/\D/g, "");
        if (!hay.includes(q) && !(digits.length >= 3 && hay.replace(/\D/g, "").includes(digits))) return false;
      }
      return true;
    });
  }, [rows, dateFilter, range, courseFilter, levelFilter, dayFilter, oddEvenFilter, moderatorFilter, teacherFilter, statusFilter, search]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: beforeTab.length, none: 0 };
    for (const t of FIRST_LESSON_STATUSES) counts[t.value] = 0;
    for (const o of beforeTab) {
      if (o.firstLessonStatus) counts[o.firstLessonStatus] = (counts[o.firstLessonStatus] ?? 0) + 1;
      else counts.none += 1;
    }
    return counts;
  }, [beforeTab]);

  const filtered = useMemo(() => {
    if (tab === "all") return beforeTab;
    if (tab === "none") return beforeTab.filter((o) => !o.firstLessonStatus);
    return beforeTab.filter((o) => o.firstLessonStatus === tab);
  }, [beforeTab, tab]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  // --- KPI kartalari ---
  const stats = useMemo(() => {
    const today = todayIso();
    const count = (s: FirstLessonStatus) => beforeTab.filter((o) => o.firstLessonStatus === s).length;
    const joined = count("GURUHGA_QOSHILDI");
    return {
      today: beforeTab.filter((o) => firstLessonIso(o.firstLesson) === today).length,
      came: count("KELDI"),
      missed: count("KELMADI"),
      joined,
      conversion: beforeTab.length ? (joined / beforeTab.length) * 100 : 0,
      needsContact: count("ALOQA_KERAK"),
    };
  }, [beforeTab]);

  const STAT_CARDS = [
    { key: "today", label: "Bugun", value: stats.today, icon: CalendarClock, bg: "#dbeafe", fg: "#2563eb" },
    { key: "came", label: "Kelganlar", value: stats.came, icon: CheckCircle2, bg: "#dcfce7", fg: "#16a34a" },
    { key: "missed", label: "Kelmaganlar", value: stats.missed, icon: XCircle, bg: "#fee2e2", fg: "#dc2626" },
    { key: "joined", label: "Guruhga qo'shildi", value: stats.joined, icon: Users, bg: "#dcfce7", fg: "#059669" },
    { key: "conv", label: "Conversion", value: `${stats.conversion.toFixed(1)}`, sub: "%", icon: TrendingUp, bg: "#ede9fe", fg: "#7c3aed" },
    { key: "contact", label: "Aloqa kerak", value: stats.needsContact, icon: Phone, bg: "#ffedd5", fg: "#ea580c" },
  ];

  const selectCls =
    "w-full h-9 appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Birinchi darsga yozilganlar</h1>
      </div>

      {/* 1) KPI kartalari */}
      <div className="fl-dashboard-grid">
        {STAT_CARDS.map((c) => (
          <div key={c.key} className="fl-stat-card">
            <span className="fl-stat-icon" style={{ background: c.bg, color: c.fg }}>
              <c.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="fl-stat-label block">{c.label}</span>
              <span className="fl-stat-value tabular-nums">
                {c.value}
                {c.sub && <span className="fl-stat-value-sub">{c.sub}</span>}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* 2) Tez filtr tablari */}
      <div className="fl-quick-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`fl-quick-tab${tab === t.key ? " active" : ""}`}
          >
            {t.label}
            <span className="fl-quick-tab-count tabular-nums">{tabCounts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Filtrlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <DateField value={dateFilter} onChange={(iso) => { setDateFilter(iso); setPage(1); }} placeholder="Birinchi dars sanasi" />
        <DateRangePicker
          placeholder="Oraliqni tanlang"
          value={range}
          onChange={(r) => { setRange(r); setPage(1); }}
        />
        <select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Kurs</option>
          {courseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Daraja</option>
          {levelOptions.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Status bo&apos;yicha</option>
          {FIRST_LESSON_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select value={dayFilter} onChange={(e) => { setDayFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Kun</option>
          {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={oddEvenFilter} onChange={(e) => { setOddEvenFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Toq/Juft kunlar</option>
          <option value="toq">Toq kunlar (Du-Ch-Ju)</option>
          <option value="juft">Juft kunlar (Se-Pa-Sh)</option>
          <option value="boshqa">Boshqa kunlar</option>
        </select>
        <select value={moderatorFilter} onChange={(e) => { setModeratorFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Moderator</option>
          {moderatorOptions.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={teacherFilter} onChange={(e) => { setTeacherFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">O&apos;qituvchi</option>
          {teacherOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          type="text"
          placeholder="Qidirish ..."
          className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length}</span>
        </div>
      </div>

      {/* 3) Jadval */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap w-8">
                  <input type="checkbox" className="rounded border-border" />
                </th>
                <th className="text-left px-3 py-3 whitespace-nowrap">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">ID</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchini ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Yaratilgan sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Birinchi dars kuni</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;qituvchi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kurs</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kurs darajasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Izoh</th>
                <th className="text-right px-3 py-3 whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {slice.map((o, i) => (
                <tr
                  key={o.id}
                  /* Qator foni holatga qarab (globals.css): natija kiritilmagan —
                     sarg'ish, kelmagan/rad etgan — pushti, qolganlari oddiy. */
                  className={`border-b border-border/50 transition-colors hover:bg-secondary/30 ${
                    !o.firstLessonStatus
                      ? "lessons-row fl-needs-result"
                      : o.firstLessonStatus === "KELMADI" || o.firstLessonStatus === "RAD_ETDI"
                        ? "lessons-row"
                        : ""
                  }`}
                >
                  <td className="px-3 py-3"><input type="checkbox" className="rounded border-border" /></td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 tabular-nums font-medium text-[13px]">{o.id}</td>
                  <td className="px-3 py-3 text-[13px]">
                    <Link href={`/orders-list/${o.id}`} className="text-foreground hover:text-primary hover:underline">
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-md bg-secondary/60 text-xs font-medium tabular-nums">{o.phone || "—"}</span>
                  </td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{o.created}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{o.firstLesson}</td>
                  <td className="px-3 py-3 text-[13px]">{o.teacher || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{o.course || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{o.level || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{o.moderator || "—"}</td>
                  <td className="px-3 py-3">
                    {o.firstLessonStatus ? (
                      <span className={`fl-status fl-status-${o.firstLessonStatus}`}>
                        {firstLessonStatusLabel(o.firstLessonStatus)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">Natija kiritilmagan</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground max-w-[220px] truncate">{o.note || "—"}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="fl-row-actions-btn"
                      title="Amallar"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setMenuFor({ order: o, top: r.bottom + 6, left: Math.max(8, r.right - 220) });
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Yuklanmoqda…" : "Birinchi darsga yozilgan o'quvchi yo'q"}
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
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>

      {/* "⋮" amallar menyusi */}
      {menuFor && (
        <div
          className="fl-action-menu"
          style={{ top: menuFor.top, left: menuFor.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <a className="fl-action-btn-row" href={telHref(menuFor.order.phone) ? `tel:${telHref(menuFor.order.phone)}` : undefined} onClick={() => setMenuFor(null)}>
            <Phone /> Telefon qilish
          </a>
          <a
            className="fl-action-btn-row"
            href={telHref(menuFor.order.phone) ? `https://t.me/${telHref(menuFor.order.phone)}` : undefined}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuFor(null)}
          >
            <Send /> Telegram yozish
          </a>
          <button
            type="button"
            className="fl-action-btn-row"
            onClick={async () => {
              const o = menuFor.order;
              setMenuFor(null);
              const ok = await patchOrder(o.id, { firstLessonStatus: "ESLATILDI" });
              if (ok) showSuccess(`${o.name} — eslatma yuborildi deb belgilandi`);
              else showError("Belgilab bo'lmadi");
            }}
          >
            <Bell /> Eslatma yuborish
          </button>

          <div className="fl-action-divider" />

          <button type="button" className="fl-action-btn-row" onClick={() => { setStatusFor(menuFor.order); setMenuFor(null); }}>
            <CalendarCheck /> Status o&apos;zgartirish
          </button>
          <button type="button" className="fl-action-btn-row" onClick={() => { setRescheduleFor(menuFor.order); setMenuFor(null); }}>
            <CalendarX2 /> Qayta dars belgilash
          </button>

          <div className="fl-action-divider" />

          <Link className="fl-action-btn-row" href={`/orders-list/${menuFor.order.id}`} onClick={() => setMenuFor(null)}>
            <User /> Profilni ochish
          </Link>
          <button type="button" className="fl-action-btn-row" onClick={() => { setNoteFor(menuFor.order); setMenuFor(null); }}>
            <StickyNote /> Izoh qo&apos;shish
          </button>
          <button type="button" className="fl-action-btn-row" onClick={() => { setMenuFor(null); window.print(); }}>
            <Printer /> Chop etish
          </button>
        </div>
      )}

      {statusFor && (
        <StatusModal
          order={statusFor}
          onClose={() => setStatusFor(null)}
          onPick={async (s) => {
            const ok = await patchOrder(statusFor.id, { firstLessonStatus: s });
            setStatusFor(null);
            if (ok) showSuccess("Status o'zgartirildi");
            else showError("Statusni o'zgartirib bo'lmadi");
          }}
        />
      )}

      {rescheduleFor && (
        <RescheduleModal
          order={rescheduleFor}
          onClose={() => setRescheduleFor(null)}
          onSave={async (firstLesson) => {
            const ok = await patchOrder(rescheduleFor.id, { firstLesson, firstLessonStatus: "QAYTA_BELGILANDI" });
            setRescheduleFor(null);
            if (ok) showSuccess("Dars qayta belgilandi");
            else showError("Saqlab bo'lmadi");
          }}
        />
      )}

      {noteFor && (
        <NoteModal
          order={noteFor}
          onClose={() => setNoteFor(null)}
          onSave={async (note) => {
            const ok = await patchOrder(noteFor.id, { note });
            setNoteFor(null);
            if (ok) showSuccess("Izoh saqlandi");
            else showError("Izohni saqlab bo'lmadi");
          }}
        />
      )}
    </div>
  );
}

/* ---------- "⋮" menyusi ochadigan kichik oynalar ---------- */

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEscapeClose(onClose);
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function StatusModal({ order, onClose, onPick }: { order: Order; onClose: () => void; onPick: (s: FirstLessonStatus) => void }) {
  return (
    <ModalShell title={`Status — ${order.name}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {FIRST_LESSON_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onPick(s.value)}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary ${
              order.firstLessonStatus === s.value ? "border-primary bg-primary/10 font-medium text-primary" : "border-border"
            }`}
          >
            <span className={`fl-status fl-status-${s.value}`}>{s.label}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
          Yopish
        </button>
      </div>
    </ModalShell>
  );
}

function RescheduleModal({ order, onClose, onSave }: { order: Order; onClose: () => void; onSave: (firstLesson: string) => void }) {
  const parsed = (order.firstLesson || "").split("|").map((s) => s.trim());
  const [date, setDate] = useState(() => firstLessonIso(order.firstLesson));
  const [time, setTime] = useState(() => (parsed[1] || "").slice(0, 5));
  const canSave = Boolean(date);
  return (
    <ModalShell title={`Qayta dars belgilash — ${order.name}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Sana</label>
          <DateField value={date} onChange={setDate} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Vaqt</label>
          <input
            type="time"
            step={60}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
          Bekor qilish
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            const [y, m, d] = date.split("-");
            onSave(`${d}.${m}.${y}${time ? ` | ${time}` : ""}`);
          }}
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none hover:opacity-90"
        >
          Saqlash
        </button>
      </div>
    </ModalShell>
  );
}

function NoteModal({ order, onClose, onSave }: { order: Order; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState(order.note || "");
  return (
    <ModalShell title={`Izoh — ${order.name}`} onClose={onClose}>
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
        placeholder="Izoh"
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
          Bekor qilish
        </button>
        <button type="button" onClick={() => onSave(note.trim())} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90">
          Saqlash
        </button>
      </div>
    </ModalShell>
  );
}
