"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import Spinner from "@/components/ui/Spinner";
import { groupWeekdays, parsePeriod } from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import { dateToIso, isoToDate, isoToLabel, useNazoratAttendance } from "./useNazoratAttendance";

// Nazorat > Davomat qilinmagan guruhlar (/nazorat-missed-groups).
//
// ILGARI: sahifa `lib/missedGroups.ts` dagi LCG (seed = (idx+1)*9301+49297)
// bilan 503 ta SOXTA qator yasardi — guruh nomi, o'qituvchi va hatto
// "Jami summa" pul ko'rsatkichi ham o'sha generatordan chiqardi.
// HOZIR: qatorlar HAQIQIY ma'lumotdan hisoblanadi — /api/groups dagi guruh
// jadvali (dars kunlari + faoliyat muddati) bo'yicha o'tgan dars sanalari
// olinadi va `attendance` kolleksiyasida o'sha sana uchun birorta belgi
// bo'lmagan guruhlar "davomat qilinmagan" deb ko'rsatiladi. Bu — /api/groups
// dagi `highlighted` bayrog'i bilan bir xil qoida, faqat butun oraliq uchun.
//
// TUZATILDI (faoliyat muddati noma'lum guruhlar):
// avvalgi variant har bir guruh uchun `groupBounds()` ni hisoblab, chegara
// null bo'lsa TEKSHIRUVNI O'TKAZIB YUBORARDI ("if (b?.start && ...)"), ya'ni
// chegarasi yo'q guruh butun tanlangan oraliqda "mavjud" deb qabul qilinardi.
// Bazadagi guruhlarda esa period="", startDate="", endDate="" — hammasi bo'sh,
// demak IKKALA chegara ham null va tanlangan oraliqdagi guruh jadvaliga mos
// har bir hafta kuni avtomatik "qoldirilgan dars" qatoriga aylanardi. Bu —
// o'ylab topilgan tarix: guruh o'sha kuni umuman mavjud bo'lganmi, buni baza
// aytmaydi. ENDI: boshlanish chegarasi (startDate yoki period) yo'q guruh
// hisobotga UMUMAN kirmaydi va qaysi maydon yetishmayotgani ochiq yoziladi.
//
// "Jami summa" — CHIZIQCHA: qoldirilgan dars uchun yo'qotilgan tushumni
// hisoblash uchun dars narxi kerak, bazada esa bunday maydon yo'q
// (`groups` da narx yo'q, `transaction_entries` esa faqat to'langan pulni
// biladi). Nol yozish "yo'qotish bo'lmagan" degan yolg'on da'vo bo'lardi.

interface MissedLesson {
  key: string;
  groupName: string;
  /** "YYYY-MM-DD" */
  date: string;
  teacher: string;
}

/** Boshlanish sanasi ANIQ bo'lgan guruh — faqat shular baholanadi. */
interface BoundedGroup {
  group: Group;
  start: Date;
  /** Tugash sanasi bo'lmasligi mumkin: guruh hali davom etyapti. */
  end: Date | null;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Guruhning faoliyat muddati — avval startDate/endDate, bo'lmasa `period` satri. */
function groupBounds(g: Group): { start: Date | null; end: Date | null } {
  const p = parsePeriod(g.period);
  return {
    start: g.startDate ? isoToDate(g.startDate) : p.start,
    end: g.endDate ? isoToDate(g.endDate) : p.end,
  };
}

export default function NazoratMissedGroupsPage() {
  const { groups, marks, loading } = useNazoratAttendance();
  const [dateRange, setDateRange] = useState<DateRange>(() => ({ start: startOfMonth(new Date()), end: new Date() }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  /** "sana|groupId" — o'sha darsda kamida bitta belgi qo'yilgan. */
  const markedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const m of marks) set.add(`${m.date}|${m.groupId}`);
    return set;
  }, [marks]);

  // Guruhlar ikkiga ajratiladi: faoliyat boshlanishi ANIQ bo'lganlar (baholash
  // mumkin) va chegarasi umuman yo'qlar (baholab bo'lmaydi — ular haqida
  // "dars qoldirdi" degan da'vo qilinmaydi, faqat izohda aytiladi).
  const { bounded, unbounded } = useMemo(() => {
    const b: BoundedGroup[] = [];
    const u: Group[] = [];
    for (const g of groups) {
      const bb = groupBounds(g);
      if (bb.start) b.push({ group: g, start: bb.start, end: bb.end });
      else u.push(g);
    }
    return { bounded: b, unbounded: u };
  }, [groups]);

  const filtered = useMemo<MissedLesson[]>(() => {
    const start = dateRange.start ?? startOfMonth(new Date());
    const end = dateRange.end ?? new Date();
    const todayIso = dateToIso(new Date());

    const out: MissedLesson[] = [];

    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cur.getTime() <= last.getTime()) {
      const iso = dateToIso(cur);
      // Kelajakdagi darsni "qilinmagan" deb atash mumkin emas — u hali bo'lmagan.
      if (iso <= todayIso) {
        const weekday = cur.getDay();
        for (const { group: g, start: gStart, end: gEnd } of bounded) {
          if (!groupWeekdays(g.day).includes(weekday)) continue;
          // Chegaralar endi MAJBURIY: guruh boshlanmasidan oldingi (yoki
          // tugaganidan keyingi) kun uchun qator chiqarilmaydi.
          if (cur < gStart) continue;
          if (gEnd && cur > gEnd) continue;
          if (markedKeys.has(`${iso}|${g.id}`)) continue;
          out.push({ key: `${g.id}-${iso}`, groupName: g.name, date: iso, teacher: g.teacher });
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
    // Eng yangi kun yuqorida.
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.groupName.localeCompare(b.groupName)));
  }, [bounded, markedKeys, dateRange]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  // Izohda guruh nomlari ko'rsatiladi — qaysi yozuvni to'ldirish kerakligi
  // darrov ko'rinsin (juda ko'p bo'lsa faqat birinchi 8 tasi).
  const unboundedNames = unbounded.slice(0, 8).map((g) => g.name || `#${g.id}`).join(", ");

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Sana filtri + jami summa */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} placeholder="Oraliqni tanlang" />
        <div
          className="text-[14px]"
          title="Qoldirilgan dars uchun yo'qotilgan tushumni hisoblab bo'lmaydi: bazada dars narxi maydoni yo'q."
        >
          <span className="font-semibold">Jami summa:</span>{" "}
          <span className="tabular-nums text-muted-foreground">—</span>
        </div>
      </div>

      {/* Faoliyat muddati yozilmagan guruhlar — ular haqida hech qanday
          da'vo qilinmasligini ochiq aytamiz. */}
      {!loading && unbounded.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-[13px] text-muted-foreground">
          <Info className="icon icon-sm shrink-0 mt-0.5" />
          <p>
            {unbounded.length} ta guruh bu hisobotdan tashqarida qoldi: ularda faoliyat
            boshlanish sanasi yo&apos;q — <code className="font-mono">groups.startDate</code> maydoni
            bo&apos;sh va zaxira manba bo&apos;lgan <code className="font-mono">groups.period</code>{" "}
            ham bo&apos;sh. Guruh tanlangan sanada mavjud bo&apos;lgan-bo&apos;lmaganini baza
            aytmagani uchun ularga &laquo;dars qoldirildi&raquo; deb qator yozilmaydi. Guruh
            sahifasida boshlanish sanasini to&apos;ldirsangiz, ular shu zahoti hisobotga qo&apos;shiladi.
            {unboundedNames && <> Guruhlar: {unboundedNames}{unbounded.length > 8 ? " …" : ""}.</>}
          </p>
        </div>
      )}

      {/* Jadval */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          {/* Baholash mumkin bo'lgan guruh umuman bo'lmasa, "0" yozish
              "hech kim dars qoldirmagan" degan yolg'on da'vo bo'lardi. */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium"
            title={bounded.length === 0 ? "Faoliyat muddati ma'lum bo'lgan guruh yo'q — sanani baholab bo'lmaydi." : undefined}
          >
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{bounded.length === 0 ? "—" : filtered.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-16">№</th>
                <th className="px-5 py-3 text-left">Nomi</th>
                <th className="px-5 py-3 text-left">Sana</th>
                <th className="px-5 py-3 text-left pr-5">O&apos;qituvchi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((g, i) => (
                <tr key={g.key} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium tabular-nums">{g.groupName || "—"}</td>
                  <td className="px-5 py-3 tabular-nums text-[13px] text-muted-foreground">{isoToLabel(g.date)}</td>
                  <td className="px-5 py-3 pr-5 text-[13px]">{g.teacher || "—"}</td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-muted-foreground">
                    {loading
                      ? <Spinner size={22} />
                      : bounded.length === 0
                        ? "Faoliyat muddati ma'lum bo'lgan guruh yo'q — hisobotni tuzib bo'lmaydi"
                        : "Ma'lumotlar topilmadi"}
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
    </div>
  );
}
