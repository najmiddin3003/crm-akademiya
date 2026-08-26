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
import { useModerators } from "@/hooks/useModerators";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import StagePickerPopover, { STAGE_COLORS } from "@/components/orders/StagePickerPopover";
import GroupPickerModal from "@/components/orders/GroupPickerModal";
import PanelDaysField from "@/components/orders/PanelDaysField";
import SmsModal from "@/components/orders/SmsModal";
import { enrollOrderInGroup, findPupilForOrder } from "@/lib/enrollStudent";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import {
  FIRST_LESSON_STATUSES,
  LESSON_DAYS,
  ORDER_STAGES,
  firstLessonStatusLabel,
  parseLessonDays,
  type FirstLessonStatus,
  type Order,
  type OrderStageKey,
} from "@/lib/ordersData";
import PersonLink from "@/components/shared/PersonDirectory";

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
/**
 * "24.08.2026 | 10:00" → Date. Vaqt ko'rsatilmagan bo'lsa kunning oxiri
 * olinadi — ya'ni sana bugun bo'lsa kun tugagunicha "o'tgan" sanalmaydi.
 */
function firstLessonAt(firstLesson: string): Date | null {
  const m = (firstLesson || "").match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, hh, mm] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), hh ? Number(hh) : 23, mm ? Number(mm) : 59);
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
  // "Ranglar bo'yicha" — lid voronkasidagi bosqich (ORDER_STAGES). Bu
  // yuqoridagi tablardagi "birinchi dars holati"dan ALOHIDA narsa.
  const [stageFilter, setStageFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [oddEvenFilter, setOddEvenFilter] = useState("");
  const [moderatorFilter, setModeratorFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Jadvaldagi belgilash katakchalari. Ilgari ular boshqarilmaydigan
  // (uncontrolled) edi va ortida hech qanday ommaviy amal yo'q edi — bosish
  // mumkin, lekin hech narsa bo'lmasdi. Endi tanlov haqiqiy va uning ustida
  // haqiqatan mavjud amal bajariladi: tanlangan lidlarning birinchi dars
  // holatini birdaniga o'zgartirish (PATCH /api/orders/:id).
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // "⋮" menyusi va u ochadigan oynalar
  const [menuFor, setMenuFor] = useState<{ order: Order; top: number; left: number } | null>(null);
  const [statusFor, setStatusFor] = useState<Order | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<Order | null>(null);
  const [noteFor, setNoteFor] = useState<Order | null>(null);
  // Telefon raqam bosilganda ochiladigan bosqich ("rang") tanlagichi —
  // Buyurtmalar ro'yxatidagi bilan bir xil.
  const [stagePickerFor, setStagePickerFor] = useState<number | null>(null);
  // "⋮" menyusidagi qolgan amallar
  const [reminderFor, setReminderFor] = useState<Order | null>(null);
  const [groupPickerFor, setGroupPickerFor] = useState<Order | null>(null);
  const [printFor, setPrintFor] = useState<Order | null>(null);

  // "Guruhga qo'shish" va "Profilni ochish" uchun o'quvchilar ro'yxati.
  const [pupils, setPupils] = useState<Pupil[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/pupils")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setPupils(d.pupils); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // "Hozir" holatda saqlanadi va daqiqada bir yangilanadi — shunda vaqt
  // o'tishi bilan qator sahifani yangilamasdan ham o'zi qizarib qoladi.
  // (Render ichida to'g'ridan-to'g'ri Date.now() chaqirish mumkin emas —
  // React compiler uni "nopok" deb rad etadi.)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  /**
   * "Profilni ochish" manzili — o'quvchi bazada topilsa uning profili,
   * aks holda buyurtma detali.
   */
  const profileHref = (o: Order): string => {
    const pupil = findPupilForOrder(o, pupils);
    return pupil ? `/student-edit/${pupil.id}?src=list` : `/orders-list/${o.id}`;
  };

  /** "⋮ → Guruhga qo'shish": o'quvchini tanlangan guruhga yozadi. */
  const handleAddToGroup = useCallback(async (order: Order, group: Group) => {
    const label = group.name || String(group.id);
    const res = await enrollOrderInGroup(order, group.id, pupils);
    if (!res.ok) {
      showError(res.error || "Guruhga qo'shishda xatolik yuz berdi");
      return;
    }
    const ok = await patchOrder(order.id, {
      firstLessonStatus: "GURUHGA_QOSHILDI",
      status: "Qabul qilindi",
      group: label,
      groupId: group.id,
    });
    setGroupPickerFor(null);
    if (ok) showSuccess(`O'quvchi "${label}" guruhiga qo'shildi`);
    else showError("Buyurtma holatini saqlashda xatolik yuz berdi");
  }, [pupils, patchOrder, showSuccess, showError]);

  /** Telefon raqamdagi bosqich ("rang") tanlagichidan chaqiriladi. */
  const setOrderStage = useCallback(async (orderId: number, stage: OrderStageKey) => {
    setStagePickerFor(null);
    const ok = await patchOrder(orderId, { stage });
    if (ok) showSuccess("Bosqich o'zgartirildi");
    else showError("Bosqichni o'zgartirib bo'lmadi");
  }, [patchOrder, showSuccess, showError]);

  // Birinchi darsga YOZILGANLAR — sanasi belgilangan buyurtmalar.
  const rows = useMemo(() => orders.filter((o) => (o.firstLesson || "").trim()), [orders]);

  const { names: allTeachers } = useTeachers();
  const courseOptions = useMemo(() => uniq(rows.map((o) => o.course)), [rows]);
  const levelOptions = useMemo(() => uniq(rows.map((o) => o.level)), [rows]);
  // Moderatorlar ro'yxati BAZADAN (/api/moderators) — ilgari buyurtmalarda
  // uchragan har qanday nom chiqardi.
  const { names: moderatorOptions } = useModerators();
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
      // Kun filtri to'liq nom bo'yicha ("Dushanba"), buyurtmada esa
      // qisqartma turadi ("Du,Ch,Ju") — parseLessonDays ikkalasini ham
      // tushunadi.
      if (dayFilter && !parseLessonDays(o.lessonDay).includes(dayFilter)) return false;
      if (oddEvenFilter && oddEvenOf(o.lessonDay) !== oddEvenFilter) return false;
      if (moderatorFilter && o.moderator !== moderatorFilter) return false;
      if (teacherFilter && o.teacher !== teacherFilter) return false;
      if (stageFilter && o.stage !== stageFilter) return false;
      if (q) {
        const hay = [o.name, o.phone, o.id, o.course, o.level, o.teacher, o.moderator, o.note]
          .join(" ").toLowerCase();
        const digits = search.replace(/\D/g, "");
        if (!hay.includes(q) && !(digits.length >= 3 && hay.replace(/\D/g, "").includes(digits))) return false;
      }
      return true;
    });
  }, [rows, dateFilter, range, courseFilter, levelFilter, dayFilter, oddEvenFilter, moderatorFilter, teacherFilter, stageFilter, search]);

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

  // Tanlov filtrdan tashqarida qolgan qatorlarni HISOBGA OLMAYDI — filtr
  // o'zgarganda ko'rinmaydigan qatorlar ustida amal bajarilib qolmasin.
  const selectedVisible = useMemo(
    () => filtered.filter((o) => selectedIds.includes(o.id)),
    [filtered, selectedIds],
  );
  const allOnPageSelected = slice.length > 0 && slice.every((o) => selectedIds.includes(o.id));

  const toggleRow = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const togglePage = () => {
    const pageIds = slice.map((o) => o.id);
    setSelectedIds((prev) =>
      allOnPageSelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])],
    );
  };

  /** Tanlangan lidlarning birinchi dars holatini birdaniga o'zgartiradi. */
  const applyBulkStatus = async (status: FirstLessonStatus) => {
    setBulkBusy(true);
    const targets = selectedVisible.map((o) => o.id);
    const results = await Promise.all(targets.map((id) => patchOrder(id, { firstLessonStatus: status })));
    setBulkBusy(false);
    setBulkStatusOpen(false);
    const okCount = results.filter(Boolean).length;
    if (okCount === targets.length) {
      setSelectedIds([]);
      showSuccess(`${okCount} ta lid holati o'zgartirildi`);
    } else {
      showError(`${okCount}/${targets.length} ta lid holati o'zgartirildi`);
    }
  };

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
        {/* Kurs va Moderator ro'yxatlari uzun bo'lishi mumkin — nativ
            <select> emas, qidiruvli tanlov (referensdagidek). */}
        <StudentSearchSelect
          label=""
          variant="compact"
          value={courseFilter}
          onChange={(v) => { setCourseFilter(v); setPage(1); }}
          options={courseOptions}
          placeholder="Kurs"
          searchPlaceholder="Qidirish"
        />
        <select value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Daraja</option>
          {levelOptions.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        {/* "Ranglar bo'yicha" — lid voronkasi bosqichlari, emoji bilan
            (referens). Birinchi dars holati yuqoridagi tablarda. */}
        <select value={stageFilter} onChange={(e) => { setStageFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Ranglar bo&apos;yicha</option>
          {ORDER_STAGES.map((st) => (
            <option key={st.key} value={st.key}>{st.emoji} {st.label}</option>
          ))}
        </select>

        {/* Hafta kunlari to'liq nom bilan (referens), buyurtmadagi
            qisqartmaga filtrlashda moslashtiriladi. */}
        <select value={dayFilter} onChange={(e) => { setDayFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Kun</option>
          {LESSON_DAYS.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
        </select>
        <select value={oddEvenFilter} onChange={(e) => { setOddEvenFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">Toq/Juft kunlar</option>
          <option value="toq">Toq kunlar (Du-Ch-Ju)</option>
          <option value="juft">Juft kunlar (Se-Pa-Sh)</option>
          <option value="boshqa">Boshqa kunlar</option>
        </select>
        <StudentSearchSelect
          label=""
          variant="compact"
          value={moderatorFilter}
          onChange={(v) => { setModeratorFilter(v); setPage(1); }}
          options={moderatorOptions}
          placeholder="Moderator"
          searchPlaceholder="Qidirish"
        />
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

      {/* Ommaviy amal paneli — faqat tanlov bo'lganda ko'rinadi. */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {selectedVisible.length > 0 ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <span className="text-[13px] font-medium tabular-nums">{selectedVisible.length} ta tanlandi</span>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => setBulkStatusOpen(true)}
              className="h-8 rounded-lg bg-primary px-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            >
              Status o&apos;zgartirish
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="h-8 rounded-lg border border-border px-3 text-[13px] hover:bg-secondary"
            >
              Tanlovni bekor qilish
            </button>
          </div>
        ) : (
          <span />
        )}
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
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    aria-label="Sahifadagi hammasini tanlash"
                    checked={allOnPageSelected}
                    onChange={togglePage}
                    // Sahifaning bir qismi tanlangan bo'lsa — "aralash" holat.
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPageSelected && slice.some((o) => selectedIds.includes(o.id));
                    }}
                  />
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
              {slice.map((o, i) => {
                // Birinchi dars vaqti o'tib ketgan bo'lsa qator qizil bo'ladi.
                const at = firstLessonAt(o.firstLesson);
                const overdue = at !== null && at.getTime() < now;
                return (
                <tr
                  key={o.id}
                  /* Qator foni holatga qarab (globals.css): natija kiritilmagan —
                     sarg'ish, kelmagan/rad etgan — pushti, qolganlari oddiy. */
                  className={`border-b border-border/50 transition-colors hover:bg-secondary/30 ${
                    overdue
                      ? "fl-overdue"
                      : !o.firstLessonStatus
                        ? "lessons-row fl-needs-result"
                        : o.firstLessonStatus === "KELMADI" || o.firstLessonStatus === "RAD_ETDI"
                          ? "lessons-row"
                          : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      aria-label={`${o.name} — tanlash`}
                      checked={selectedIds.includes(o.id)}
                      onChange={() => toggleRow(o.id)}
                    />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 tabular-nums font-medium text-[13px]">{o.id}</td>
                  <td className="px-3 py-3 text-[13px]">
                    <Link href={`/orders-list/${o.id}`} className="text-foreground hover:text-primary hover:underline">
                      {o.name}
                    </Link>
                  </td>
                  {/* Telefon raqam bosilsa lid bosqichi ("rang") tanlanadi —
                      Buyurtmalar ro'yxatidagi bilan bir xil xatti-harakat. */}
                  <td className="px-3 py-3 relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagePickerFor(stagePickerFor === o.id ? null : o.id);
                      }}
                      className="rounded-md"
                    >
                      {o.phone ? (
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-medium tabular-nums transition-opacity hover:opacity-90 ${
                            o.stage ? "text-white" : "bg-secondary text-foreground"
                          }`}
                          style={o.stage ? { backgroundColor: STAGE_COLORS[o.stage] } : undefined}
                        >
                          {o.phone}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-secondary/60 text-xs font-medium">—</span>
                      )}
                    </button>
                    {stagePickerFor === o.id && (
                      <StagePickerPopover
                        value={o.stage}
                        onChange={(stage) => setOrderStage(o.id, stage)}
                        onClose={() => setStagePickerFor(null)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{o.created}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{o.firstLesson}</td>
                  <td className="px-3 py-3 text-[13px]"><PersonLink name={o.teacher} kind="staff" /></td>
                  <td className="px-3 py-3 text-[13px]">{o.course || "—"}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{o.level || "—"}</td>
                  <td className="px-3 py-3 text-[13px]"><PersonLink name={o.moderator} kind="staff" /></td>
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
                );
              })}
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
          <button type="button" className="fl-action-btn-row" onClick={() => { setReminderFor(menuFor.order); setMenuFor(null); }}>
            <Bell /> Eslatma yuborish
          </button>

          <div className="fl-action-divider" />

          <button type="button" className="fl-action-btn-row" onClick={() => { setStatusFor(menuFor.order); setMenuFor(null); }}>
            <CalendarCheck /> Status o&apos;zgartirish
          </button>
          <button type="button" className="fl-action-btn-row" onClick={() => { setRescheduleFor(menuFor.order); setMenuFor(null); }}>
            <CalendarX2 /> Qayta dars belgilash
          </button>
          <button type="button" className="fl-action-btn-row" onClick={() => { setGroupPickerFor(menuFor.order); setMenuFor(null); }}>
            <Users /> Guruhga qo&apos;shish
          </button>

          <div className="fl-action-divider" />

          {/* O'quvchi bazada bo'lsa uning profiliga, bo'lmasa buyurtma
              detaliga o'tiladi (buyurtma va o'quvchi id fazolari boshqacha —
              shu bois ?src=list qo'shiladi, app/(app)/student-edit izohiga q.). */}
          <Link className="fl-action-btn-row" href={profileHref(menuFor.order)} onClick={() => setMenuFor(null)}>
            <User /> Profilni ochish
          </Link>
          <button type="button" className="fl-action-btn-row" onClick={() => { setNoteFor(menuFor.order); setMenuFor(null); }}>
            <StickyNote /> Izoh qo&apos;shish
          </button>
          <button type="button" className="fl-action-btn-row" onClick={() => { setPrintFor(menuFor.order); setMenuFor(null); }}>
            <Printer /> Chop etish
          </button>
        </div>
      )}

      {statusFor && (
        <StatusModal
          title={`Status — ${statusFor.name}`}
          current={statusFor.firstLessonStatus}
          onClose={() => setStatusFor(null)}
          onPick={async (s) => {
            const ok = await patchOrder(statusFor.id, { firstLessonStatus: s });
            setStatusFor(null);
            if (ok) showSuccess("Status o'zgartirildi");
            else showError("Statusni o'zgartirib bo'lmadi");
          }}
        />
      )}

      {bulkStatusOpen && (
        <StatusModal
          title={`Status — ${selectedVisible.length} ta lid`}
          onClose={() => setBulkStatusOpen(false)}
          onPick={applyBulkStatus}
        />
      )}

      {rescheduleFor && (
        <RescheduleModal
          order={rescheduleFor}
          teachers={allTeachers}
          onClose={() => setRescheduleFor(null)}
          onSave={async (patch) => {
            const ok = await patchOrder(rescheduleFor.id, { ...patch, firstLessonStatus: "QAYTA_BELGILANDI" });
            setRescheduleFor(null);
            if (ok) showSuccess("Dars qayta belgilandi");
            else showError("Saqlab bo'lmadi");
          }}
        />
      )}

      {noteFor && (
        <NotePanel
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

      {/* "Eslatma yuborish" — loyihadagi YAGONA haqiqiy xabar yo'li orqali:
          SmsModal → POST /api/sms-messages (Eskiz + `sms_messages` jurnali),
          Buyurtma detali va O'quvchilar ro'yxatidagi "SMS yuborish" bilan
          aynan bir xil. Ilgari bu yerda o'z ichiga yopiq ReminderModal bor
          edi: qattiq yozilgan 4 ta matndan birini tanlatib "yuborildi" deb
          xabar berardi, ammo hech qanday so'rov yubormasdi. */}
      {reminderFor && (
        <SmsModal
          studentName={reminderFor.name}
          phone={reminderFor.phone}
          onClose={() => setReminderFor(null)}
          onSent={async ({ simulated }) => {
            const o = reminderFor;
            setReminderFor(null);
            // `simulated` = Eskiz sozlanmagan (ESKIZ_EMAIL/ESKIZ_PASSWORD
            // yo'q), ya'ni /api/sms-messages xabarni faqat jurnalga yozdi —
            // tizimdan HECH QANDAY SMS chiqmadi. Ilgari holat shu holatda ham
            // "ESLATILDI" deb belgilanardi: operatorga "jo'natilmadi" deb
            // aytilar, lid esa bazada eslatilgan bo'lib qolardi va keyin hech
            // kim unga qayta qo'ng'iroq qilmasdi. Endi xabar haqiqatan
            // ketmagan bo'lsa holatga TEGILMAYDI.
            if (simulated) {
              showError("SMS jo'natilmadi: Eskiz sozlanmagan (faqat jurnalga yozildi) — holat \"Eslatildi\" ga o'zgartirilmadi");
              return;
            }
            const ok = await patchOrder(o.id, { firstLessonStatus: "ESLATILDI" });
            if (ok) showSuccess(`${o.name} — eslatma yuborildi`);
            else showError("Eslatma yuborildi, ammo holatni belgilab bo'lmadi");
          }}
          onError={showError}
        />
      )}

      {groupPickerFor && (
        <GroupPickerModal
          onClose={() => setGroupPickerFor(null)}
          onSelect={(group) => handleAddToGroup(groupPickerFor, group)}
        />
      )}

      {printFor && <PrintPreviewModal order={printFor} onClose={() => setPrintFor(null)} />}
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

/**
 * Bitta lid uchun ham, tanlangan bir nechta lid uchun ham ishlatiladi —
 * shu bois `order` emas, sarlavha va joriy holat alohida beriladi (ommaviy
 * o'zgartirishda "joriy holat" degan yagona qiymat yo'q).
 */
function StatusModal({
  title,
  current,
  onClose,
  onPick,
}: {
  title: string;
  current?: FirstLessonStatus;
  onClose: () => void;
  onPick: (s: FirstLessonStatus) => void;
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {FIRST_LESSON_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onPick(s.value)}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary ${
              current === s.value ? "border-primary bg-primary/10 font-medium text-primary" : "border-border"
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

/**
 * "Qayta dars belgilash" — birinchi dars sanasi/vaqtidan tashqari darsning
 * o'zini ham qayta belgilash mumkin: o'qituvchi, dars kunlari va darsning
 * boshlanish vaqti.
 */
function RescheduleModal({
  order,
  teachers,
  onClose,
  onSave,
}: {
  order: Order;
  teachers: string[];
  onClose: () => void;
  onSave: (patch: Partial<Order>) => void;
}) {
  const parsed = (order.firstLesson || "").split("|").map((s) => s.trim());
  const [date, setDate] = useState(() => firstLessonIso(order.firstLesson));
  const [time, setTime] = useState(() => (parsed[1] || "").slice(0, 5));
  const [teacher, setTeacher] = useState(order.teacher || "");
  const [lessonDay, setLessonDay] = useState(order.lessonDay || "");
  const [lessonStartTime, setLessonStartTime] = useState((order.lessonStartTime || "").slice(0, 5));
  const canSave = Boolean(date);

  // Buyurtmada bo'lgan, ammo ro'yxatda yo'q o'qituvchi ham ko'rinsin.
  const teacherOptions = teacher && !teachers.includes(teacher) ? [teacher, ...teachers] : teachers;

  return (
    <ModalShell title={`Qayta dars belgilash — ${order.name}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Birinchi dars sanasi</label>
          <DateField value={date} onChange={setDate} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Birinchi dars vaqti</label>
          <input
            type="time"
            step={60}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <StudentSearchSelect
        variant="compact"
        label="O'qituvchi"
        value={teacher}
        onChange={setTeacher}
        options={teacherOptions}
        placeholder="Ustozni tanlang"
        searchPlaceholder="Ustozni qidirish"
      />

      <PanelDaysField label="Dars kunlari" value={lessonDay} onChange={setLessonDay} />

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Darsning boshlanish vaqti</label>
        <input
          type="time"
          step={60}
          value={lessonStartTime}
          onChange={(e) => setLessonStartTime(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
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
            onSave({
              firstLesson: `${d}.${m}.${y}${time ? ` | ${time}` : ""}`,
              teacher,
              lessonDay,
              lessonStartTime,
            });
          }}
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none hover:opacity-90"
        >
          Saqlash
        </button>
      </div>
    </ModalShell>
  );
}

/**
 * "Izoh qo'shish" — markazdagi modal emas, EKRANNING O'NG PASTKI BURCHAGIDAN
 * ochiladigan panel (o'lchamlari OrderMessagePanel bilan bir xil). Izoh
 * buyurtmaning `note` maydoniga saqlanadi.
 *
 * O'lcham/joylashuv inline style bilan — globals.css dagi tayyor Tailwind
 * blobida w-80/h-96/bottom-5 kabi utilitylar yo'q.
 */
function NotePanel({ order, onClose, onSave }: { order: Order; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState(order.note || "");
  useEscapeClose(onClose);
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      style={{ position: "fixed", bottom: 20, right: 20, width: 340, maxWidth: "calc(100vw - 40px)", zIndex: 300 }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="truncate text-sm font-semibold">Izoh — {order.name}</span>
        <button type="button" onClick={onClose} title="Yopish" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary">
          <svg className="icon icon-sm"><use href="#i-x-circle" /></svg>
        </button>
      </div>
      <div className="p-3">
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={6}
          placeholder="Izoh qoldirish"
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border p-3">
        <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
          Bekor qilish
        </button>
        <button type="button" onClick={() => onSave(note.trim())} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90">
          Saqlash
        </button>
      </div>
    </div>
  );
}

// OLIB TASHLANDI: ReminderModal va REMINDER_TEMPLATES. Shablonlar qattiq
// yozilgan 4 ta matn edi va "Yuborish" hech qanday so'rov yubormasdi —
// endi bu amal SmsModal orqali haqiqiy SMS yo'liga ulangan (yuqoriga qarang),
// shablonlar esa /api/sms-templates va Sozlamalar → Avto sms dan keladi.

/* ---------- "Chop etish" — avval ko'rib chiqish, keyin bosma ---------- */

function escHtml(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return s.replace(/[&<>"]/g, (c) => map[c]);
}

/** Chekda ko'rsatiladigan barcha maydonlar — oynada ham, bosmada ham shu. */
function receiptRows(order: Order): [string, string][] {
  const rows: [string, string][] = [
    ["ID", String(order.id)],
    ["O'quvchi", order.name || "—"],
    ["Telefon", order.phone || "—"],
    ["Yaratilgan", order.created || "—"],
    ["Birinchi dars", order.firstLesson || "—"],
    ["Dars kunlari", order.lessonDay || "—"],
    ["Dars vaqti", order.lessonStartTime || "—"],
    ["O'qituvchi", order.teacher || "—"],
    ["Kurs", order.course || "—"],
    ["Kurs darajasi", order.level || "—"],
    ["Guruh", order.group || "—"],
    ["Moderator", order.moderator || "—"],
    ["Status", order.firstLessonStatus ? firstLessonStatusLabel(order.firstLessonStatus) : "Natija kiritilmagan"],
  ];
  if (order.note) rows.push(["Izoh", order.note]);
  return rows;
}

/** Yashirin iframe orqali bosmaga yuboradi (CashboxesPage bilan bir xil naqsh). */
function printReceipt(order: Order) {
  const rows = receiptRows(order);
  const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Birinchi dars #${order.id}</title><style>
    @page{size:58mm auto;margin:3mm}
    html,body{margin:0;padding:0}
    body{font:11px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;display:flex;justify-content:center}
    .wrap{width:52mm}
    .brand{text-align:center;font-size:12px;font-weight:700;letter-spacing:.15em}
    .title{text-align:center;font-size:13px;font-weight:700;letter-spacing:.05em;margin-top:8px}
    .divider{border-top:1px dashed #94a3b8;margin:8px 0}
    .r{display:flex;justify-content:space-between;gap:6px;padding:2px 0}
    .r span:first-child{color:#64748b}
    .r span:last-child{text-align:right;font-weight:500;word-break:break-word}
    .thanks{text-align:center;font-style:italic;color:#64748b;font-size:10px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
    <div class="wrap">
      <div class="brand">TIZIMLI</div>
      <div class="title">BIRINCHI DARSGA YOZILISH</div>
      <div class="divider"></div>
      ${rows.map(([k, v]) => `<div class="r"><span>${escHtml(k)}</span><span>${escHtml(v)}</span></div>`).join("")}
      <div class="divider"></div>
      <div class="thanks">Xizmatingizdamiz. Rahmat!</div>
    </div>
  </body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 1000);
}

// "Chop etish" bosilganda AVVAL shu oyna chiqadi — foydalanuvchi barcha
// ma'lumotni ko'rib "Chop etish" bosgandagina brauzerning bosma oynasi
// ochiladi.
function PrintPreviewModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const rows = receiptRows(order);
  return (
    <ModalShell title="Chek — ko'rib chiqish" onClose={onClose}>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-center text-[13px] font-bold tracking-[0.15em]">TIZIMLI</div>
        <div className="mt-1 text-center text-sm font-bold">BIRINCHI DARSGA YOZILISH</div>
        <div className="my-3 border-t border-dashed border-border" />
        <div className="max-h-72 overflow-y-auto">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-1 text-[13px]">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right font-medium break-words">{v}</span>
            </div>
          ))}
        </div>
        <div className="my-3 border-t border-dashed border-border" />
        <div className="text-center text-xs italic text-muted-foreground">Xizmatingizdamiz. Rahmat!</div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
          Bekor qilish
        </button>
        <button
          type="button"
          onClick={() => { printReceipt(order); onClose(); }}
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Chop etish
        </button>
      </div>
    </ModalShell>
  );
}
