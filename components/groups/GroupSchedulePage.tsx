"use client";

// Guruh → Dars jadvali (crm-akademiya sidebar: Guruh > Dars jadvali, href
// /groups-schedule). Guruhlar /api/groups dan keladi (constants/groups.js
// GROUP_SEED asosida seed qilingan — Guruh ro'yxati bilan bir xil ma'lumot).
// Har guruhning "kun" maydoni ("Toq kunlar" kabi) constants/groupsSchedule.js
// dagi qoida bo'yicha haftaning aniq kuniga moslanadi, "vaqt" maydoni esa
// 30 daqiqalik slotlarga bo'linib xona/o'qituvchi ustunida joylashtiriladi.
// Filtr (o'qituvchi/kurs/xona/kun turi) va Export (CSV) tepadagi tugmalar
// orqali ishlaydi; ko'rinish xona yoki o'qituvchi bo'yicha, ustun yoki qator
// layoutda tanlanadi.
//
// STATISTIKA FAQAT BOSH SAHIFADA. Referensda (akademiya.edutizim.uz/home)
// jadval ustida 12 ta KPI kartasi turadi, "Guruh > Dars jadvali" da esa
// ular kerak emas (foydalanuvchi so'rovi). Ikkala manzil bitta komponentni
// ko'rsatgani uchun farq `showStats` proplari orqali: /home uni beradi,
// /groups-schedule bermaydi.
//
// Sonlar SERVERDA sanaladi — /api/home-stats (lib/homeStats.ts). Ilgari bu
// sahifa /api/orders va /api/pupils ni to'liq tortib olib (6 732 o'quvchi,
// ~2.7 MB) brauzerda sanardi.

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/Link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, DoorOpen, Download, Filter, LayoutGrid, Maximize2, Minimize2, Rows3, User, Users, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { SpinnerBlock } from "@/components/ui/Spinner";
import PersonLink from "@/components/shared/PersonDirectory";
import { useToast } from "@/components/ui/Toast";
import type { Group } from "@/lib/groups";
import type { HomeKpi } from "@/lib/homeStats";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useRooms } from "@/hooks/useRooms";
import { GROUP_DAYS } from "@/constants/groups";
import {
  SCHEDULE_DAY_LABELS,
  SCHEDULE_DAY_LONG,
  SCHEDULE_DAY_ORDER,
  SCHEDULE_TIME_SLOTS,
  courseColor,
  parseTimeRange,
  weekdaysForDayPattern,
} from "@/constants/groupsSchedule";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";

type GroupBy = "room" | "teacher";
type Layout = "grid" | "row";

interface Filters {
  teacher: string;
  course: string;
  room: string;
  dayType: string;
}
const EMPTY_FILTERS: Filters = { teacher: "", course: "", room: "", dayType: "" };

interface Placed {
  group: Group;
  startSlot: number;
  span: number;
  color: string;
  col: number;
}

/** Blok ustiga sichqoncha kelgani/ketgani — panel shu orqali boshqariladi. */
type HoverFn = (g: Group | null, rect: DOMRect | null) => void;


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

export default function GroupSchedulePage({ showStats = false }: { showStats?: boolean }) {
  const { t, weekdaysShort } = useT();
  const { showSuccess } = useToast();
  const { names: roomNames } = useRooms();
  const { names: courseNames } = useOfflineCourseList();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(() => SCHEDULE_DAY_ORDER[new Date().getDay()]);
  const [groupBy, setGroupBy] = useState<GroupBy>("room");
  const [layout, setLayout] = useState<Layout>("grid");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [fullscreen, setFullscreen] = useState(false);
  // Referensda KPI kartalari boshlang'ich holatda ochiq turadi.
  const [statsVisible, setStatsVisible] = useState(true);
  // Xodim ko'ra oladigan kartalar — ruxsat SERVERDA kesiladi
  // (app/api/home-stats). Ro'yxat bo'sh bo'lsa qator umuman chizilmaydi.
  const [kpis, setKpis] = useState<HomeKpi[]>([]);
  // Sichqoncha turgan blok — ustidagi ma'lumot paneli uchun.
  const [hovered, setHovered] = useState<{ group: Group; rect: DOMRect } | null>(null);

  // Panel BLOKDAN CHIQQANDA DARHOL YOPILMAYDI.
  //
  // Blok bilan panel orasida 8px bo'shliq bor va panelning o'zi endi
  // sichqonchani qabul qiladi (ichidagi havolalar bosilsin). Yopish
  // kechiktirilmasa, o'sha bo'shliqni kesib o'tishning O'ZI `mouseleave`
  // berardi va panel foydalanuvchi unga yetib bormasidan yo'qolardi.
  const closeTimer = useRef<number | null>(null);
  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  // `useCallback` — sof optimallashtirish emas, SHART: `GridLayout`/`RowLayout`
  // `memo` bilan o'ralgan va bu funksiya har renderda yangidan tug'ilsa,
  // sichqoncha har tekkanda butun setka (yuzlab katak) qayta chizilardi —
  // aynan shu narsa blokning `transform` animatsiyasini yutib yuborardi.
  const setHover: HoverFn = useCallback((g, rect) => {
    cancelClose();
    if (g && rect) setHovered({ group: g, rect });
    else closeTimer.current = window.setTimeout(() => setHovered(null), 160);
  }, [cancelClose]);
  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setGroups(d.groups); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // KPI kartalari — faqat bosh sahifada so'raladi.
  useEffect(() => {
    if (!showStats) return;
    let cancelled = false;
    fetch("/api/home-stats")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setKpis(d.cards as HomeKpi[]); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showStats]);

  // To'liq ekran — body klassi orqali (globals.css: body.fullscreen-mode ...)
  useEffect(() => {
    document.body.classList.toggle("fullscreen-mode", fullscreen);
    return () => document.body.classList.remove("fullscreen-mode");
  }, [fullscreen]);

  // Shu hafta kunida darsi bo'lgan guruhlar (day pattern → weekday)
  const dayGroups = useMemo(
    () => groups.filter((g) => weekdaysForDayPattern(g.day).includes(day)),
    [groups, day],
  );

  // Kun turi filtri: tayyor variantlar + guruhlarda uchraydigan istalgan
  // kunlar ("Du,Ch,Sh" — formadagi kun tugmalari, 28.09.2026).
  const dayTypeOptions = useMemo(
    () => [...new Set([...GROUP_DAYS, ...groups.map((g) => g.day).filter(Boolean)])],
    [groups],
  );

  const filterOptions = useMemo(() => {
    const teachers = [...new Set(dayGroups.map((g) => g.teacher).filter(Boolean))].sort();
    const rooms = [...new Set(dayGroups.map((g) => g.room).filter(Boolean))].sort();
    return { teachers, rooms };
  }, [dayGroups]);

  const filtered = useMemo(() => {
    return dayGroups.filter((g) => {
      if (filters.teacher && g.teacher !== filters.teacher) return false;
      if (filters.course && g.course !== filters.course) return false;
      if (filters.room && g.room !== filters.room) return false;
      if (filters.dayType && g.day !== filters.dayType) return false;
      return true;
    });
  }, [dayGroups, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Ustunlar: xona (doim to'liq ro'yxat) yoki o'qituvchi (shu kunda darsi borlar)
  const columns = useMemo(() => {
    if (groupBy === "teacher") {
      const seen: string[] = [];
      for (const g of filtered) if (g.teacher && !seen.includes(g.teacher)) seen.push(g.teacher);
      return seen;
    }
    // Xona ustunlari BAZADAN (/api/rooms). Ilgari constants'dagi
    // "201 - xona … 219 - xona" ro'yxati edi va foydalanuvchi yaratgan
    // xonadagi guruh jadvalda UMUMAN ko'rinmasdi (indexOf → -1 → continue).
    // Ro'yxatda yo'q, lekin guruhlarda uchraydigan xonalar ham qo'shiladi.
    const extra = filtered
      .map((g) => g.room)
      .filter((r): r is string => Boolean(r) && !roomNames.includes(r));
    return [...roomNames, ...new Set(extra)];
  }, [filtered, groupBy, roomNames]);

  const placed: Placed[] = useMemo(() => {
    const out: Placed[] = [];
    for (const g of filtered) {
      const col = columns.indexOf(groupBy === "teacher" ? g.teacher : g.room);
      if (col < 0) continue;
      const { startSlot, span } = parseTimeRange(g.time);
      if (startSlot < 0) continue;
      out.push({ group: g, startSlot, span, color: courseColor(g.course), col });
    }
    return out;
  }, [filtered, groupBy, columns]);

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  function exportCSV() {
    const headers = ["Guruh", "Kurs", "Kun", "Vaqt", "Xona", "O'qituvchi", "O'quvchilar"];
    const rows = filtered.map((g) => [g.name, g.course, g.day, g.time, g.room, g.teacher, g.students]);
    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const dayIdx = SCHEDULE_DAY_ORDER.indexOf(day);
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `dars-jadvali-${SCHEDULE_DAY_LONG[dayIdx] || day}.csv`);
    showSuccess(t("CSV yuklab olindi — {filtered} ta", { filtered: filtered.length }));
  }

  return (
    <div id="view-groups-schedule" className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Sarlavha + Export/Filtr */}
      <div className="flex items-center justify-between non-fullscreen">
        <h1 className="text-lg font-semibold tracking-tight">{t("Dars jadvali")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" lucideIcon={Download} onClick={exportCSV}>
            {t("Export")}
          </Button>
          {/* Tugma FAQAT kartalar bo'lganda: xodim bironta ham kartani
              ko'ra olmasa (server bo'sh ro'yxat qaytaradi) u hech narsani
              yashirmaydigan tugma bo'lib qolardi. */}
          {showStats && kpis.length > 0 && (
            <button
              onClick={() => setStatsVisible((v) => !v)}
              title={t("Statistika kartalarini ko'rsatish/yashirish")}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium transition-colors ${
                statsVisible ? "bg-primary text-white hover:opacity-90" : "border border-border bg-card hover:bg-secondary"
              }`}
            >
              <BarChart3 className="icon icon-sm" />
              <span>{t("Statistika")}</span>
            </button>
          )}
          <button
            onClick={() => setFiltersVisible((v) => !v)}
            className={`relative inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-shadow${
              filtersVisible ? " ring-2 ring-blue-300" : ""
            }`}
          >
            <Filter className="icon icon-sm" />
            <span>{t("Filtr")}</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* KPI kartalari — referensda jadval ustida, ikki qatorda. */}
      {showStats && statsVisible && kpis.length > 0 && (
        <div className="kpi-grid non-fullscreen">
          {kpis.map((k) => {
            const body = (
              <>
                <span className="kpi-icon" style={{ backgroundColor: k.bg, color: k.fg }}>
                  <svg className="icon"><use href={`#${k.icon}`} /></svg>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] leading-tight text-muted-foreground">{t(k.label)}</span>
                  <span className="block text-[17px] font-bold tabular-nums leading-tight">
                    {k.value === null ? "—" : k.value.toLocaleString("ru-RU").replace(/,/g, " ")}
                  </span>
                </span>
              </>
            );
            // Manbasi yo'q ko'rsatkich "—" bilan chiziladi va BOSILMAYDI:
            // bosilsa foydalanuvchi kartadagi son bilan hech qanday aloqasi
            // yo'q sahifaga tushardi. globals.css'da hover faqat `a.kpi-card`
            // uchun yozilgan — shu bois <div> bir xil ko'rinadi, lekin
            // bosiladigandek tuyulmaydi.
            return k.value === null ? (
              <div key={k.key} className="kpi-card" title={k.note}>{body}</div>
            ) : (
              <Link key={k.key} href={k.href} className="kpi-card">{body}</Link>
            );
          })}
        </div>
      )}

      {/* Filtr paneli */}
      {filtersVisible && (
        <div className="non-fullscreen flex flex-wrap items-center justify-end gap-2">
          <FilterSelect
            value={filters.teacher}
            onChange={(v) => setFilters((f) => ({ ...f, teacher: v }))}
            placeholder={t("O'qituvchi")}
            width="w-40"
            options={filterOptions.teachers.map((tv) => [tv, tv] as [string, string])}
          />
          <FilterSelect
            value={filters.course}
            onChange={(v) => setFilters((f) => ({ ...f, course: v }))}
            placeholder={t("Kurs")}
            width="w-36"
            options={courseNames.map((c) => [c, c] as [string, string])}
          />
          <FilterSelect
            value={filters.room}
            onChange={(v) => setFilters((f) => ({ ...f, room: v }))}
            placeholder={t("Xona")}
            width="w-32"
            options={filterOptions.rooms.map((r) => [r, r] as [string, string])}
          />
          <FilterSelect
            value={filters.dayType}
            onChange={(v) => setFilters((f) => ({ ...f, dayType: v }))}
            placeholder={t("Kun turi")}
            width="w-36"
            options={dayTypeOptions.map((d) => [d, d] as [string, string])}
          />
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <X className="icon icon-xs" />{" "}{t("Tozalash")}
          </button>
        </div>
      )}

      {/* Kun tablari + ko'rinish tugmalari */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-card border border-border p-1 non-fullscreen">
          {SCHEDULE_DAY_ORDER.map((d, i) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${d === day ? "bg-primary text-white" : "hover:bg-secondary"}`}
            >
              {weekdaysShort[i] ?? SCHEDULE_DAY_LABELS[i]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-0.5 non-fullscreen">
            <ToggleBtn active={groupBy === "room"} onClick={() => setGroupBy("room")} title={t("Xona bo'yicha")} Icon={DoorOpen} />
            <ToggleBtn active={groupBy === "teacher"} onClick={() => setGroupBy("teacher")} title={t("O'qituvchi bo'yicha")} Icon={User} />
          </div>
          <div className="flex rounded-lg border border-border bg-card p-0.5 non-fullscreen">
            <ToggleBtn active={layout === "grid"} onClick={() => setLayout("grid")} title={t("Ustun ko'rinishi")} Icon={LayoutGrid} />
            <ToggleBtn active={layout === "row"} onClick={() => setLayout("row")} title={t("Qator ko'rinishi")} Icon={Rows3} />
          </div>
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? t("Kichik xolatda ko'rish") : t("To'liq ekran")}
            className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-card hover:bg-secondary"
          >
            {fullscreen ? <Minimize2 className="icon icon-sm" /> : <Maximize2 className="icon icon-sm" />}
            {fullscreen && <span className="text-sm font-medium">{t("Kichik xolatda ko'rish")}</span>}
          </button>
        </div>
      </div>

      {/* Jadval */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground"><SpinnerBlock /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {t("{day} kuni uchun dars topilmadi.", { day: t(SCHEDULE_DAY_LONG[SCHEDULE_DAY_ORDER.indexOf(day)]) })}
        </div>
      ) : layout === "row" ? (
        <RowLayout columns={columns} lessons={placed} groupBy={groupBy} onHover={setHover} />
      ) : (
        <GridLayout columns={columns} lessons={placed} groupBy={groupBy} onHover={setHover} />
      )}

      {/* `key` — har yangi blokda panel qaytadan tug'ilsin, ya'ni chiqish
          animatsiyasi (globals.css: .sch-hover-panel) qayta o'ynasin.
          Kalitsiz panel bir blokdan ikkinchisiga jimgina "sakrab" o'tardi. */}
      {hovered && (
        <LessonHoverPanel
          key={hovered.group.id}
          g={hovered.group}
          rect={hovered.rect}
          onEnter={cancelClose}
          onLeave={() => setHover(null, null)}
        />
      )}
    </div>
  );
}

/* ============================ Joylashtirish (rowspan) ============================ */

function buildMatrices(colCount: number, lessons: Placed[], byRow: boolean) {
  const rows = SCHEDULE_TIME_SLOTS.length;
  const outer = byRow ? colCount : rows;
  const inner = byRow ? rows : colCount;
  const skip: boolean[][] = Array.from({ length: outer }, () => Array(inner).fill(false));
  const start: (Placed | null)[][] = Array.from({ length: outer }, () => Array(inner).fill(null));
  for (const L of lessons) {
    if (L.startSlot < 0 || L.startSlot >= rows) continue;
    if (byRow) {
      if (start[L.col][L.startSlot] || skip[L.col][L.startSlot]) continue;
      start[L.col][L.startSlot] = L;
      for (let i = 1; i < L.span; i++) {
        const s = L.startSlot + i;
        if (s < rows) skip[L.col][s] = true;
      }
    } else {
      if (start[L.startSlot][L.col] || skip[L.startSlot][L.col]) continue;
      start[L.startSlot][L.col] = L;
      for (let i = 1; i < L.span; i++) {
        const s = L.startSlot + i;
        if (s < rows) skip[s][L.col] = true;
      }
    }
  }
  return { skip, start };
}

function colLabel(c: string): string {
  return c.length > 18 ? c.slice(0, 18) + "…" : c;
}

/**
 * Blok ustiga sichqoncha kelganda chiqadigan panel.
 *
 * `position: fixed` — jadval endi 70vh li aylantiriladigan quti ichida,
 * oddiy `absolute` panel uning chekkasida kesilib qolardi. Joylashuv
 * blokning ekrandagi o'rnidan hisoblanadi va ekran chetiga siqiladi.
 */
function PanelRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[12px]">
      <span className="text-muted-foreground shrink-0">{k}</span>
      <span className="text-right font-medium min-w-0 break-words">{v}</span>
    </div>
  );
}

function LessonHoverPanel({
  g,
  rect,
  onEnter,
  onLeave,
}: {
  g: Group;
  rect: DOMRect;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { t } = useT();
  const W = 280;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - W - 8));
  const below = rect.bottom + 8;
  const top = below + 210 > window.innerHeight ? Math.max(8, rect.top - 218) : below;
  return (
    <div
      style={{ position: "fixed", top, left, width: W, zIndex: 80 }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="sch-hover-panel rounded-xl border border-border bg-card shadow-2xl p-3 space-y-1.5"
    >
      <div className="flex items-center gap-2 pb-1.5 border-b border-border">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: courseColor(g.course) }} />
        <span className="text-[13px] font-semibold truncate">№{g.name} · {g.course}</span>
      </div>
      <PanelRow k="O'qituvchi" v={g.teacher || "—"} />
      <PanelRow k="Xona" v={g.room || "—"} />
      <PanelRow k="Vaqti" v={<span className="tabular-nums">{g.time}</span>} />
      <PanelRow k="Kunlari" v={g.day || "—"} />
      <PanelRow k="Daraja" v={g.level || "—"} />
      <PanelRow k="O'quvchilar" v={<span className="tabular-nums">{g.students}</span>} />
      <PanelRow k="Davri" v={<span className={g.periodExpired ? "text-rose-600" : ""}>{g.period || "—"}</span>} />
      {/* Panel SICHQONCHANI QABUL QILADI. Ilgari unda `pointer-events: none`
          turardi — sichqoncha ustiga o'tishi bilan blokdan `mouseleave`
          kelib panel yo'qolardi, ya'ni ichidagi hech narsani bosib
          bo'lmasdi. Endi ochiq qoladi (yopilish chaqiruvchida
          kechiktirilgan) va guruh sahifasi shu yerdan ham ochiladi. */}
      <Link
        href={`/groups/${g.id}`}
        className="mt-1 pt-1.5 border-t border-border block text-[11px] font-medium text-primary hover:underline"
      >
        {t("Guruh sahifasini ochish →")}
      </Link>
    </div>
  );
}

function LessonCard({
  p,
  groupBy,
  row,
  onHover,
}: {
  p: Placed;
  groupBy: GroupBy;
  row?: boolean;
  onHover: (g: Group | null, rect: DOMRect | null) => void;
}) {
  const { t } = useT();
  const g = p.group;
  const tip = `№${g.name} · ${g.teacher} · ${g.room}`;
  const router = useRouter();
  // Blokning o'zi guruh sahifasiga olib boradi; ichidagi o'qituvchi ismi
  // esa uning profiliga. Ism <Link> bo'lgani uchun blokdagi bosishni
  // to'xtatish kerak — aks holda ikkalasi birdan ishlab, guruh sahifasi
  // profilni bosib ketardi.
  const handlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => onHover(g, e.currentTarget.getBoundingClientRect()),
    onMouseLeave: () => onHover(null, null),
    onClick: (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) return;
      router.push(`/groups/${g.id}`);
    },
  };

  if (row) {
    return (
      <div className="sch-lesson-row" style={{ background: p.color, gridColumn: `span ${p.span}` }} title={tip} {...handlers}>
        <span className="gnum sch-gname">{g.name}</span>
        <div className="info">
          <span className="tname">{g.course}</span>
          <span className="room">
            •{" "}
            {groupBy === "room" ? <PersonLink name={g.teacher} kind="staff" className="underline-offset-2 hover:underline" /> : g.room}
          </span>
        </div>
        <div className="meta">
          <span className="tabular-nums">{g.time}</span>
          <span className="flex items-center gap-1">
            <Users className="icon icon-xs" />
            {g.students}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="sch-lesson" style={{ background: p.color, gridRow: `span ${p.span}` }} title={tip} {...handlers}>
      <div>
        <div className="text-[10px] font-semibold opacity-90 tabular-nums leading-tight">{g.time}</div>
        <div className="text-[13px] font-bold leading-tight mt-0.5">{g.course}</div>
        {/* Ism uning profiliga olib boradi; PersonLink bosishni blokdan
            to'sadi, ya'ni guruh sahifasi ochilib ketmaydi. */}
        <div className="tname"><PersonLink name={g.teacher} kind="staff" className="underline-offset-2 hover:underline" /></div>
        <div className="room">{groupBy === "room" ? `Xona: ${g.room}` : g.room}</div>
        <div className="text-[10px] opacity-80 mt-0.5">{t(g.day)}</div>
      </div>
      {/* Guruh nomi kerak bo'lsa so'z ichidan ham bo'linadi (ko'pi bilan 2
          qator, globals.css → .sch-gname): uzun nom karta chetidan toshib
          kesilmasin, o'quvchilar soni ko'rinib tursin. */}
      <div className="meta">
        <span className="gnum sch-gname">№{g.name}</span>
        <span className="sch-count flex items-center gap-0.5">
          <Users className="icon icon-xs" />
          {g.students}
        </span>
      </div>
    </div>
  );
}

/**
 * SETKA SICHQONCHA HARAKATIDA QAYTA CHIZILMAYDI.
 *
 * Blok ustiga sichqoncha kelishi ota komponentda holatni o'zgartiradi
 * (`hovered`) va `memo` bo'lmasa har tegishda BUTUN setka — 20 ta xona x 33
 * ta slot, ya'ni yuz-yuzlab katak — qaytadan chizilardi. Blokning
 * ko'tarilish animatsiyasi (globals.css: .sch-lesson:hover) shu paytda
 * boshlanishi kerak edi va o'sha qayta chizish uni yutib yuborardi: effekt
 * "sakrab" o'tar yoki umuman ko'rinmasdi.
 *
 * `memo` ISHLASHI UCHUN proplar barqaror bo'lishi shart: `columns` va
 * `lessons` allaqachon `useMemo` da, `onHover` esa `useCallback` da.
 */
const GridLayout = memo(GridLayoutInner);
const RowLayout = memo(RowLayoutInner);

function GridLayoutInner({ columns, lessons, groupBy, onHover }: { columns: string[]; lessons: Placed[]; groupBy: GroupBy; onHover: HoverFn }) {
  const { skip, start } = buildMatrices(columns.length, lessons, false);
  const cols = `110px repeat(${columns.length}, minmax(140px, 1fr))`;
  const minWidth = 110 + columns.length * 140;

  return (
    <div className="schedule-scroll">
      <div className="schedule" style={{ gridTemplateColumns: cols, minWidth }}>
        <div className="sch-room sch-corner" />
        {columns.map((c, i) => (
          <div key={`h${i}`} className="sch-room" title={c}>
            {colLabel(c)}
          </div>
        ))}
        {SCHEDULE_TIME_SLOTS.map((ts, s) => (
          <Fragment key={`r${s}`}>
            <div className="sch-time">{ts}</div>
            {columns.map((_, c) => {
              if (skip[s][c]) return null;
              const L = start[s][c];
              if (L) return <LessonCard key={`c${s}-${c}`} p={L} groupBy={groupBy} onHover={onHover} />;
              return (
                <div key={`c${s}-${c}`} className="sch-empty">
                  —
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function RowLayoutInner({ columns, lessons, groupBy, onHover }: { columns: string[]; lessons: Placed[]; groupBy: GroupBy; onHover: HoverFn }) {
  const { skip, start } = buildMatrices(columns.length, lessons, true);
  const cols = `150px repeat(${SCHEDULE_TIME_SLOTS.length}, minmax(140px, 1fr))`;
  const minWidth = 150 + SCHEDULE_TIME_SLOTS.length * 140;

  return (
    <div className="schedule-scroll">
      <div className="schedule-row" style={{ gridTemplateColumns: cols, minWidth }}>
        <div className="sch-time-h sch-corner" />
        {SCHEDULE_TIME_SLOTS.map((tv, i) => (
          <div key={`th${i}`} className="sch-time-h">
            {tv}
          </div>
        ))}
        {columns.map((c, r) => (
          <Fragment key={`row${r}`}>
            <div className="sch-room-side" title={c}>
              {colLabel(c)}
            </div>
            {SCHEDULE_TIME_SLOTS.map((_, s) => {
              if (skip[r][s]) return null;
              const L = start[r][s];
              if (L) return <LessonCard key={`rc${r}-${s}`} p={L} groupBy={groupBy} onHover={onHover} row />;
              return (
                <div key={`rc${r}-${s}`} className="sch-empty">
                  —
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ============================ Kichik komponentlar ============================ */

function FilterSelect({
  value,
  onChange,
  placeholder,
  width,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width: string;
  options: [string, string][];
}) {
  return (
    <Select value={value} onChange={(v) => onChange(v)} options={options.map(([v, lbl]) => ({ value: v, label: lbl }))} placeholder={placeholder} clearable size="sm" className={`${width}`} />
  );
}

function ToggleBtn({ active, onClick, title, Icon }: { active: boolean; onClick: () => void; title: string; Icon: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-8 w-8 flex items-center justify-center rounded-md ${active ? "bg-primary text-white" : "hover:bg-secondary"}`}
    >
      <Icon className="icon icon-sm" />
    </button>
  );
}
