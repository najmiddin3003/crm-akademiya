"use client";

import { useMemo, useState } from "react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { groupWeekdays, parsePeriod } from "@/lib/attendance";
import { useGroups } from "@/hooks/useGroups";
import { useRooms } from "@/hooks/useRooms";
import type { Group } from "@/lib/groups";

// Hisobotlar → Xonalar analitikasi (href /reports-rooms).
//
// ILGARI: butun sahifa `constants/groups.js` dagi DEMO massivlardan
// (GROUP_SEED / GROUP_ROOMS / GROUP_TIMES) hisoblanardi. Ya'ni bazadagi
// haqiqiy xonalar umuman ko'rinmasdi, foydalanuvchi qo'shgan xona hech qachon
// jadvalga tushmasdi, "sig'im" esa GROUP_TIMES.length × 5 × (1|7|30) degan
// o'ylab topilgan formuladan chiqardi — hech bir maydonga tayanmagan son.
// "Kun / Hafta / Oy" tugmalari ham shu ko'paytmani o'zgartirardi, ya'ni bir
// bosishda bandlik 30 barobar "oshib" ketardi. Bunday raqamning ma'nosi yo'q,
// shuning uchun tugmalar ham olib tashlandi.
//
// HOZIR: hamma son ikkita haqiqiy manbadan:
//   /api/rooms  → xona nomi va O'QUVCHI SIG'IMI (Room.capacity)
//   /api/groups → xonaga biriktirilgan guruhlar, ularning o'quvchilari
//                 (`studentIds` — ro'yxatga qo'shilgan haqiqiy pupils.id lar),
//                 dars kunlari (`day`) va faoliyat muddati (startDate/endDate
//                 yoki `period` satri)
//
// Kartadagi asosiy nisbat — ENG KATTA GURUH / XONA SIG'IMI. Yig'indi emas,
// aynan maksimum: bitta xonada bir vaqtning o'zida bitta guruh o'tiradi,
// shuning uchun uch guruhning o'quvchilarini qo'shish 300% kabi ma'nosiz
// natija berardi. Maksimum esa haqiqiy savolga javob beradi: eng to'la dars
// shu xonaga sig'adimi?

/** Sana oralig'i tanlanmaganda — joriy oy. */
function currentMonth(): DateRange {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

/** Amaldagi oraliqni ko'rsatish uchun — "DD.MM.YYYY". */
function fmtDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function isoToDate(iso: string): Date | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Guruhdagi o'quvchilar soni — `studentIds` massivining uzunligi.
 *
 * NEGA `g.students` EMAS: `Group.students` — hech kim yangilamaydigan
 * denormalizatsiya qilingan hisoblagich. Guruh yaratilganda
 * app/api/groups/route.ts va app/api/groups/import/route.ts uni `students: 0`
 * qilib yozadi, GroupFormModal esa uni hech qachon PATCH qilmaydi. Ya'ni UI
 * orqali yaratilgan har qanday guruh uchun u abadiy 0 bo'lib qoladi va
 * kartada bandlik "0/25" ko'rinardi — bu esa "bu xonaga hech kim kelmaydi"
 * degan yolg'on da'vo.
 *
 * `studentIds` esa haqiqatda yuritiladi: o'quvchi guruhga qo'shilganda
 * app/api/groups/[id]/students/route.ts $addToSet qiladi, guruhdan
 * chiqarilganda (o'quvchi o'chirilganda/arxivlanganda ham) $pull qiladi.
 * Massivning umuman yo'qligi ham haqiqiy fakt — hali birorta o'quvchi
 * qo'shilmagan, ya'ni 0 nafar.
 */
function rosterSize(g: Group): number {
  return g.studentIds?.length ?? 0;
}

/** Guruhning faoliyat muddati — avval startDate/endDate, bo'lmasa `period` satri. */
function groupBounds(g: Group): { start: Date | null; end: Date | null } {
  const p = parsePeriod(g.period);
  return {
    start: g.startDate ? isoToDate(g.startDate) : p.start,
    end: g.endDate ? isoToDate(g.endDate) : p.end,
  };
}

// Muzlatilgan, yakunlangan, ARXIVLANGAN va YIG'ILAYOTGAN guruh xonani band
// qilmaydi. Qolgan holatlar ("active" / "new" / "completing" / "problematic")
// dars o'tadigan guruhlar.
//
// "gathering" (18.09.2026): guruh hali tuzilyapti, dars boshlanmagan —
// xona jadvalda unga ajratilgan bo'lsa ham hozircha bo'sh turadi, ya'ni
// bandlik nisbatiga kirmaydi (bu HISOBOT — jadvaldagi to'qnashuv
// tekshiruvi esa uni band deb biladi, lib/groupRules.ts ROOM_HOLDING_STATUSES).
//
// NEGA "archive" QO'SHILDI: bu ro'yxat avval faqat constants/groups.js dagi
// GROUP_STATUSES bo'yicha yozilgan edi, "archive" esa o'sha massivda yo'q.
// Lekin u haqiqiy, foydalanuvchi o'rnatadigan holat: GroupDetailPage
// { status: "archive" } bilan PATCH qiladi, GroupFormModal da
// "Arxiv" varianti bor va GroupsListPage filtri ham shu kalitni ishlatadi.
// Ya'ni arxivga tushgan, endi dars o'tmaydigan guruh xonani band qilib
// turgandek sanalardi — bandlik nisbati oshib ketardi.
const IDLE_STATUSES = new Set(["gathering", "frozen", "finished", "archive"]);

/** Guruh tanlangan oraliqda umuman faolmi (muddati kesishadimi). */
function overlapsRange(g: Group, start: Date, end: Date): boolean {
  const b = groupBounds(g);
  if (b.start && b.start > end) return false;
  if (b.end && b.end < start) return false;
  return true;
}

/** Oraliq ichida shu guruhning necha marta darsi bor (dars kunlari bo'yicha). */
function lessonCountInRange(g: Group, start: Date, end: Date): number {
  const weekdays = groupWeekdays(g.day);
  // Jadvali kiritilmagan guruh — dars sanasi hisoblab bo'lmaydi, 0 ta dars.
  if (weekdays.length === 0) return 0;
  const b = groupBounds(g);
  let n = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur.getTime() <= last.getTime()) {
    if (weekdays.includes(cur.getDay()) && !(b.start && cur < b.start) && !(b.end && cur > b.end)) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

interface RoomStat {
  id: number;
  room: string;
  capacity: number;
  groups: number;
  lessons: number;
  /** Eng katta guruhdagi o'quvchilar soni. */
  peak: number;
  /** Sig'im kiritilmagan bo'lsa null — "—" chiziladi (0 yozish yolg'on bo'lardi). */
  percent: number | null;
}

export default function Page() {
  const { rooms, loading: roomsLoading } = useRooms();
  const { groups, loading: groupsLoading } = useGroups();
  const [dateRange, setDateRange] = useState<DateRange>(currentMonth);

  const loading = roomsLoading || groupsLoading;

  // Dars sanalarini sanash uchun oraliq HAR DOIM kerak (ochiq oraliqda "necha
  // dars bo'ldi" savolining javobi yo'q), shuning uchun tanlagich tozalansa
  // joriy oyga qaytiladi. Bu yashirin bo'lib qolmasligi uchun amaldagi oraliq
  // sarlavha ostida yozib turiladi.
  const { start, end } = useMemo(() => {
    const fallback = currentMonth();
    return {
      start: dateRange.start ?? fallback.start!,
      end: dateRange.end ?? dateRange.start ?? fallback.end!,
    };
  }, [dateRange]);

  const { stats, unassigned } = useMemo(() => {
    // Oraliqda faol bo'lgan guruhlarni xona nomi bo'yicha guruhlaymiz.
    const active = groups.filter(
      (g) => !IDLE_STATUSES.has(String(g.status ?? "")) && overlapsRange(g, start, end),
    );
    const byRoom = new Map<string, Group[]>();
    for (const g of active) {
      const room = String(g.room ?? "").trim();
      if (!room) continue;
      const list = byRoom.get(room) ?? [];
      list.push(g);
      byRoom.set(room, list);
    }

    const stats: RoomStat[] = rooms.map((r) => {
      const mine = byRoom.get(r.name) ?? [];
      const peak = mine.reduce((mx, g) => Math.max(mx, rosterSize(g)), 0);
      const lessons = mine.reduce((s, g) => s + lessonCountInRange(g, start, end), 0);
      return {
        id: r.id,
        room: r.name,
        capacity: r.capacity ?? 0,
        groups: mine.length,
        lessons,
        peak,
        percent: r.capacity > 0 ? (peak / r.capacity) * 100 : null,
      };
    });

    // Xonasi ko'rsatilmagan (yoki ro'yxatda yo'q xonaga yozilgan) guruhlar
    // hech bir kartaga tushmaydi — ularni yashirmasdan alohida aytamiz.
    const known = new Set(rooms.map((r) => r.name));
    const unassigned = active.filter((g) => !known.has(String(g.room ?? "").trim())).length;

    return { stats, unassigned };
  }, [rooms, groups, start, end]);

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-[18px] font-semibold tracking-tight">Xonalar analitikasi</h2>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
        </div>
      </div>

      <div className="text-[12px] text-muted-foreground">
        {fmtDay(start)} &ndash; {fmtDay(end)}. Nisbat — shu oraliqda xonada dars qiladigan ENG KATTA
        guruh / xona sig&apos;imi.
        {unassigned > 0 && ` Xonasi biriktirilmagan faol guruhlar: ${unassigned} ta.`}
      </div>

      {loading ? (
        <SpinnerBlock size={22} />
      ) : stats.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border py-12 text-center text-sm text-muted-foreground">
          Xonalar topilmadi — Guruh &rarr; Xonalar sahifasida qo&apos;shiladi.
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
          {stats.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-semibold tabular-nums">
                  {r.peak}/{r.capacity > 0 ? r.capacity : "—"}
                </span>
                <span className="text-[12px] text-muted-foreground tabular-nums">
                  {r.percent === null ? "—" : `${r.percent.toFixed(0)}%`}
                </span>
              </div>
              <div className="text-[13px] text-muted-foreground mt-0.5 truncate">{r.room}</div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full ${
                    r.percent === null ? "bg-transparent" : r.percent > 60 ? "bg-emerald-500" : r.percent > 0 ? "bg-primary" : "bg-transparent"
                  }`}
                  style={{ width: `${Math.min(100, r.percent ?? 0)}%` }}
                />
              </div>
              <div className="text-[12px] text-muted-foreground tabular-nums mt-2">
                {r.groups} guruh &middot; {r.lessons} dars
              </div>
              {/* Sig'im Guruh → Xonalar sahifasida kiritiladi; bo'sh bo'lsa
                  foiz hisoblab bo'lmaydi va 0% deb ko'rsatilmaydi. */}
              {r.capacity <= 0 && (
                <div className="text-[11px] text-muted-foreground mt-1">Sig&apos;im kiritilmagan</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
