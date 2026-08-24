"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, FileText, Info } from "lucide-react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import Spinner from "@/components/ui/Spinner";
import DvaBarChart, { type DvaDay, type DvaSeries } from "@/components/nazorat/DvaBarChart";
import { downloadTableCsv } from "@/lib/exportTable";
import { ATTENDANCE_COLOR, ATTENDANCE_OPTIONS, type AttendanceStatus } from "@/lib/attendance";
import { dateToIso, isoToLabel, useNazoratAttendance } from "./useNazoratAttendance";

// Nazorat > Davomat analitikasi (/nazorat-davomat-analytics).
//
// ILGARI: har bir ustun va har bir KPI `lib/davomatAnalytics.ts` dagi
// generatordan chiqardi — `15 + ((dayIndex * 37) % 55)` kabi kun indeksidan
// yasalgan sonlar. Kurs/Guruh/O'qituvchi/Holati tanlovlari state'ni
// o'zgartirar-u hech narsani filtrlamas, panelning yig'ish tugmasi esa
// umuman ishlamas edi. "PDF faylini yuklab olish" tugmasi CSV yuklardi.
// HOZIR: barcha sonlar `attendance` kolleksiyasidagi HAQIQIY belgilardan
// (/api/groups/:id/attendance), guruh/kurs/o'qituvchi ma'lumoti /api/groups
// dan. To'rtala tanlov ham haqiqatan filtrlaydi, yig'ish tugmasi panelni
// yopib-ochadi, tugma nomi esa u haqiqatda yuklaydigan formatga (CSV) mos.
//
// OLIB TASHLANGAN QATOR — "Davomat qilinmagan":
// u har kun uchun `missedStudents += (g.studentIds ?? []).length` bilan
// hisoblanardi va IKKI xil o'ylab topilgan ma'lumot berardi.
//   1) Guruhning faoliyat muddati tekshiruvi ishlamas edi: `groupBounds()`
//      null qaytarganda shart o'tkazib yuborilardi, bazadagi guruhlarda esa
//      period="", startDate="", endDate="" — ya'ni HECH BIR guruh uchun
//      chegara yo'q. Natijada guruh hali ochilmagan kunlar ham "dars
//      qoldirilgan" deb sanalardi.
//   2) Undan ham jiddiyrog'i: `studentIds` — guruhning BUGUNGI ro'yxati.
//      O'quvchi guruhga qachon qo'shilgani bazada saqlanmaydi (pupils'da
//      ham, groups'da ham qo'shilish sanasi maydoni yo'q), shuning uchun
//      o'tgan haftadagi ro'yxatni tiklab bo'lmaydi. Bugun kelgan o'quvchi
//      bir oy oldingi darsni "qoldirgan" deb ko'rsatilardi.
// Ikkinchi muammoni to'g'rilash imkoni yo'q — manba maydonning o'zi yo'q.
// Shuning uchun qator grafikdan, izohdan va CSV dan olib tashlandi, KPI
// o'rnida esa CHIZIQCHA turadi (0 yozish "hech qanday dars qoldirilmagan"
// degan yolg'on da'vo bo'lardi). Dars qoldirilgani haqidagi HAQIQIY hisobot
// — "Davomat qilinmagan guruhlar" sahifasi: u o'quvchi sonini emas,
// guruh-dars faktini sanaydi va faqat muddati ma'lum guruhlarni oladi.

const selectCls =
  "w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

// Grafikdagi qatorlar — davomat holatlarining O'ZI (ranglar lib/attendance dan,
// ya'ni guruh davomati jadvalidagi doirachalar bilan bir xil). Har bir qator
// bazadagi haqiqiy belgilarni sanaydi, boshqa manba yo'q.
const SERIES: (DvaSeries & { status: AttendanceStatus })[] = [
  { key: "keldi", status: "keldi", label: "Kelgan o'quvchilar", color: ATTENDANCE_COLOR.keldi },
  { key: "birinchi", status: "birinchi", label: "Birinchi darsga kelganlar", color: ATTENDANCE_COLOR.birinchi },
  { key: "sababli", status: "sababli", label: "Sababli o'quvchilar", color: ATTENDANCE_COLOR.sababli },
  { key: "sababsiz", status: "sababsiz", label: "Sababsiz o'quvchilar", color: ATTENDANCE_COLOR.sababsiz },
];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtCount(n: number): string {
  return n.toLocaleString("ru-RU").replace(/,/g, " ");
}

export default function NazoratDavomatAnalyticsPage() {
  const { groups, marks, loading } = useNazoratAttendance();

  const [dateRange, setDateRange] = useState<DateRange>(() => ({ start: startOfMonth(new Date()), end: new Date() }));
  const [kurs, setKurs] = useState("");
  const [group, setGroup] = useState("");
  const [teacher, setTeacher] = useState("");
  const [holati, setHolati] = useState("");
  const [filterOpen, setFilterOpen] = useState(true);

  // Tanlov ro'yxatlari bazadagi guruhlardan yig'iladi.
  const kursOptions = useMemo(() => [...new Set(groups.map((g) => g.course).filter(Boolean))].sort(), [groups]);
  const groupOptions = useMemo(() => [...new Set(groups.map((g) => g.name).filter(Boolean))].sort(), [groups]);
  const teacherOptions = useMemo(() => [...new Set(groups.map((g) => g.teacher).filter(Boolean))].sort(), [groups]);

  /** Kurs/Guruh/O'qituvchi filtrlaridan o'tgan guruhlar. */
  const visibleGroups = useMemo(
    () => groups.filter((g) => {
      if (kurs && g.course !== kurs) return false;
      if (group && g.name !== group) return false;
      if (teacher && g.teacher !== teacher) return false;
      return true;
    }),
    [groups, kurs, group, teacher],
  );
  const visibleGroupIds = useMemo(() => new Set(visibleGroups.map((g) => g.id)), [visibleGroups]);

  const days = useMemo<DvaDay[]>(() => {
    const start = dateRange.start ?? startOfMonth(new Date());
    const end = dateRange.end ?? new Date();

    // Sana → holat → son. Faqat ko'rinadigan guruhlarning HAQIQIY belgilari;
    // belgi bo'lmagan kun uchun hech narsa o'ylab topilmaydi.
    const perDay = new Map<string, number[]>();
    for (const m of marks) {
      if (!visibleGroupIds.has(m.groupId)) continue;
      if (holati && m.status !== holati) continue;
      const idx = SERIES.findIndex((s) => s.status === m.status);
      if (idx < 0) continue;
      let vals = perDay.get(m.date);
      if (!vals) { vals = SERIES.map(() => 0); perDay.set(m.date, vals); }
      vals[idx] += 1;
    }

    const out: DvaDay[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cur.getTime() <= last.getTime()) {
      const iso = dateToIso(cur);
      out.push({ iso, label: isoToLabel(iso), vals: perDay.get(iso) ?? SERIES.map(() => 0) });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [marks, visibleGroupIds, dateRange, holati]);

  const totals = useMemo(() => {
    const t = SERIES.map(() => 0);
    for (const d of days) for (let k = 0; k < t.length; k++) t[k] += d.vals[k];
    return t;
  }, [days]);

  function exportCsv() {
    downloadTableCsv(
      ["Sana", ...SERIES.map((s) => s.label), "Jami"],
      days.map((d) => [d.label, ...d.vals, d.vals.reduce((s, v) => s + v, 0)]),
      "davomat-analitikasi.csv",
    );
  }

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div>
        {/* Tugma nomi u haqiqatda yuklaydigan formatga mos: PDF eksporti yo'q. */}
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <FileText className="icon icon-sm" />
          <span>CSV faylini yuklab olish</span>
        </button>
      </div>

      {/* KPI chiplar */}
      <div className="flex flex-wrap items-center gap-2">
        {SERIES.map((s, k) => (
          <div key={s.key} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px]">
            <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-bold tabular-nums">{fmtCount(totals[k])}</span>
          </div>
        ))}
        {/* "Davomat qilinmagan" — qoldirilgan darsdagi O'QUVCHI sonini
            hisoblash uchun o'sha kungi guruh ro'yxati kerak, bazada esa
            faqat BUGUNGI ro'yxat bor (guruhga qo'shilish sanasi maydoni
            yo'q). Shu sabab son o'ylab topilmaydi — chiziqcha turadi. */}
        <div
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px]"
          title="O'quvchining guruhga qachon qo'shilgani bazada saqlanmaydi, shuning uchun o'tgan kunlardagi guruh ro'yxatini tiklab bo'lmaydi."
        >
          <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: "#f97316" }} />
          <span className="text-muted-foreground">Davomat qilinmagan</span>
          <span className="font-bold tabular-nums">—</span>
        </div>
        {/* "Muzlatilgan" — o'quvchining holati (pupils.status) KUNLIK emas,
            joriy holat: qaysi kuni muzlatilgani tarixi bazada saqlanmaydi.
            Shuning uchun kunlik grafikka qo'shilmaydi va bu yerda son
            o'ylab topilmaydi — chiziqcha turadi. */}
        <div
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px]"
          title="Muzlatilgan o'quvchilarning kunlik tarixi bazada yuritilmaydi (pupils.status faqat joriy holatni saqlaydi)."
        >
          <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: "#bae6fd" }} />
          <span className="text-muted-foreground">Muzlatilgan</span>
          <span className="font-bold tabular-nums">—</span>
        </div>
      </div>

      {/* Nega ikki ko'rsatkich chiziqcha — tooltipni hamma ham ochmaydi. */}
      <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-[13px] text-muted-foreground">
        <Info className="icon icon-sm shrink-0 mt-0.5" />
        <p>
          Grafik faqat qo&apos;yilgan davomat belgilarini ko&apos;rsatadi.
          &laquo;Davomat qilinmagan&raquo; va &laquo;Muzlatilgan&raquo; kunlik son sifatida
          hisoblanmaydi: o&apos;quvchining guruhga qo&apos;shilgan sanasi ham, muzlatilgan
          sanasi ham bazada saqlanmaydi, shuning uchun o&apos;tgan kunlardagi guruh
          ro&apos;yxatini tiklab bo&apos;lmaydi. Qoldirilgan darslar ro&apos;yxati{" "}
          <Link href="/nazorat-missed-groups" className="text-primary hover:underline">
            Davomat qilinmagan guruhlar
          </Link>{" "}
          sahifasida — u o&apos;quvchi sonini emas, guruh-dars faktini sanaydi.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Filtr paneli */}
        <div className="rounded-2xl bg-card border border-border p-5 self-start" style={{ alignSelf: "start" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold">Filtr</h3>
            {/* Yig'ish tugmasi endi haqiqatan panelni yopadi/ochadi. */}
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
              title={filterOpen ? "Yig'ish" : "Yoyish"}
              aria-expanded={filterOpen}
            >
              {filterOpen ? <ChevronUp className="icon icon-sm" /> : <ChevronDown className="icon icon-sm" />}
            </button>
          </div>
          {filterOpen && (
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium mb-1.5">Sana</label>
                <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5">Kurs</label>
                <div className="relative">
                  <select value={kurs} onChange={(e) => setKurs(e.target.value)} className={selectCls}>
                    <option value="">Tanlang</option>
                    {kursOptions.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5">Guruh</label>
                <div className="relative">
                  <select value={group} onChange={(e) => setGroup(e.target.value)} className={selectCls}>
                    <option value="">Tanlang</option>
                    {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5">O&apos;qituvchi</label>
                <div className="relative">
                  <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className={selectCls}>
                    <option value="">Tanlang</option>
                    {teacherOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5">Holati</label>
                <div className="relative">
                  <select value={holati} onChange={(e) => setHolati(e.target.value)} className={selectCls}>
                    <option value="">Tanlang</option>
                    {ATTENDANCE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Grafik */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-center gap-4 flex-wrap mb-3 text-[11px]">
            {SERIES.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 h-3 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-24"><Spinner size={28} /></div>
          ) : (
            <DvaBarChart days={days} series={SERIES} />
          )}
        </div>
      </div>
    </div>
  );
}
