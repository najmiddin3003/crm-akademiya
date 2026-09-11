"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useGroups } from "@/hooks/useGroups";
import { useTeachers } from "@/hooks/useTeachers";
import type { Group } from "@/lib/groups";
import Select from "@/components/ui/Select";

// Hisobotlar → O'quv markazga ishlab berilgan (href /reports-served).
// Referensdagi sarlavha: "O'qituvchilar oylik to'lov analitikasi".
//
// ILGARI: "Ishlab berilgan summa" ustuni SOXTA edi. U demo guruhlar massivi
// (constants/groups.js GROUP_SEED) va demo kurs narxlaridan
// (constants/offlineCourses.js) shunday chiqarilardi:
//     summa = guruh o'quvchilari × kursning eng qimmat filial narxi × (1|7|30)
// Har uch ko'paytuvchi ham asossiz edi: guruhlar bazadan emas demo massivdan
// olinardi; guruhning qaysi FILIALGA tegishli ekani hech qayerda saqlanmaydi,
// shuning uchun "eng yuqori narxni olamiz" degan tanlov o'ylab topilgan edi;
// "Kun / Hafta / Oy" tugmasi esa summani shunchaki 7 yoki 30 ga ko'paytirardi.
// Natijada sahifa hech qachon to'lanmagan pulni "ishlab berilgan" deb
// ko'rsatardi. O'qituvchilar ro'yxati ham qattiq yozilgan GROUP_TEACHERS dan
// kelardi.
//
// HOZIR: summa HAQIQATDA TO'LANGAN pul — `transaction_entries` dagi kirim
// yozuvlari, o'qituvchi bo'yicha yig'ilgan holda
// (/api/transaction-entries/served-summary — yig'indini Mongo hisoblaydi;
// ilgari bu yerga 18 757 ta to'liq hujjat, ~9.0 MB tushardi).
// Har bir kirim yozuvida `teacherName` bor — bu "shu to'lov qaysi
// o'qituvchining oyligiga tegishli" degani (lib/transactionEntries.ts;
// to'lov qabul qilinganda lib/teacherOfStudent.ts o'quvchining guruhi orqali
// aniqlaydi). Ya'ni o'qituvchi bo'yicha yig'indi — bu o'sha o'qituvchining
// o'quvchilari markazga to'lagan pul. Sana oralig'i yozuvning O'Z sanasi
// (`date`, "YYYY-MM-DD") bo'yicha filtrlaydi, ya'ni tanlagich haqiqiy ishlaydi.
//
// "Guruhlar" va "O'quvchilar" ustunlari /api/groups dan — BUGUNGI holat
// (guruhda sana kesimidagi tarix saqlanmaydi), summa esa oraliqqa bog'liq.
// O'quvchilar soni guruhning `studentIds` ro'yxatidan sanaladi (pastdagi
// rosterSize izohiga qarang).

const fmtUZS = (n: number) => Math.round(n).toLocaleString("ru-RU") + " UZS";

/** Standart oraliq — joriy oy (sarlavhadagi "oylik" shunga mos). */
function currentMonth(): DateRange {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const nameKey = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * Guruhdagi o'quvchilar soni — `studentIds` massivining uzunligi.
 *
 * NEGA `g.students` EMAS: `Group.students` — hech qaysi yozuv yo'li
 * yangilamaydigan denormalizatsiya qilingan hisoblagich. Guruh yaratilganda
 * app/api/groups/route.ts va app/api/groups/import/route.ts uni `students: 0`
 * qilib yozadi, EditGroupModal esa uni hech qachon PATCH qilmaydi. Shu bois
 * UI orqali yaratilgan guruhlar uchun "O'quvchilar" ustuni har bir
 * o'qituvchida 0 chiqardi, ya'ni "bu o'qituvchining o'quvchisi yo'q" degan
 * yolg'on da'vo qilardi.
 *
 * `studentIds` esa haqiqatda yuritiladi: guruhga o'quvchi qo'shilganda
 * app/api/groups/[id]/students/route.ts $addToSet, chiqarilganda $pull qiladi.
 * Massiv umuman bo'lmasa — bu ham haqiqiy fakt: guruhga hali birorta o'quvchi
 * qo'shilmagan, ya'ni 0 nafar.
 */
const rosterSize = (g: Group): number => g.studentIds?.length ?? 0;

/** /api/transaction-entries/served-summary javobidagi qator. */
interface ServedRow {
  teacherName: string;
  amount: number;
}

interface Row {
  name: string;
  groups: number;
  students: number;
  /** null — to'lovlarda o'qituvchi umuman ko'rsatilmagan, hisoblab bo'lmaydi. */
  earned: number | null;
}

export default function Page() {
  const { groups, loading: groupsLoading } = useGroups();
  const { names: teacherNames } = useTeachers();
  const [servedRows, setServedRows] = useState<ServedRow[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [teacher, setTeacher] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>(currentMonth);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Bekor qilingan yozuv tushumga qo'shilmaydi — /api/reports/balance va
  // /api/employee-salary-summary dagi bilan bir xil qoida (endi u shart
  // server tomonda, served-summary route'ida qo'llanadi).
  //
  // Sana oralig'i endi SERVERGA uzatiladi, ya'ni oraliq o'zgarganda yangi
  // so'rov ketadi. Bu arzon: javob ~45 qator (~2 KB), ilgari esa oraliq
  // brauzerdagi 18 757 qatorli massiv ustidan filtrlanardi.
  // Spinner FAQAT birinchi yuklashda: oraliq o'zgarganda jadval eski
  // raqamlarni ~180 ms ushlab turadi va joyida yangilanadi. Ilgari oraliq
  // almashtirish umuman so'rovsiz edi (brauzerdagi massiv filtrlanardi),
  // shuning uchun bu yerda spinner chaqnashi orqaga qadam bo'lardi.
  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams();
    if (dateRange.start) qs.set("from", toIso(dateRange.start));
    if (dateRange.end) qs.set("to", toIso(dateRange.end));
    fetch(`/api/transaction-entries/served-summary?${qs}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setServedRows(d.rows as ServedRow[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEntriesLoading(false); });
    return () => { cancelled = true; };
  }, [dateRange]);

  const loading = groupsLoading || entriesLoading;

  // `teacherName` — ixtiyoriy maydon: u qo'shilishidan oldingi yozuvlarda
  // yo'q. Agar oraliqdagi HECH BIR to'lovda o'qituvchi ko'rsatilmagan bo'lsa,
  // hech kimga 0 yozib bo'lmaydi — 0 "hech kim to'lamagan" degan da'vo,
  // haqiqat esa "bog'lanish saqlanmagan". Bunday holda ustun "—" bo'ladi.
  const attributed = useMemo(
    () => servedRows.filter((r) => nameKey(r.teacherName) !== ""),
    [servedRows],
  );
  const hasAttribution = attributed.length > 0;

  // Server XOM `teacherName` bo'yicha guruhladi; bu yerdagi fold katta-kichik
  // harf va ortiqcha bo'shliq farq qiladigan yozuvlarni birlashtiradi —
  // qoida guruhlar jadvalidagi ismlar bilan bir xil bo'lishi uchun shu yerda.
  const earnedByTeacher = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of attributed) {
      const k = nameKey(r.teacherName);
      map.set(k, (map.get(k) ?? 0) + (r.amount || 0));
    }
    return map;
  }, [attributed]);

  // O'qituvchisi ko'rsatilmagan kirimlar jadvalga tushmaydi — summani
  // yashirib qo'ymaslik uchun pastda alohida ko'rsatiladi.
  const unattributedTotal = useMemo(
    () => servedRows.filter((r) => nameKey(r.teacherName) === "").reduce((s, r) => s + (r.amount || 0), 0),
    [servedRows],
  );

  const rows = useMemo<Row[]>(() => {
    // Qatorlar: guruhi bor o'qituvchilar + to'lovi bog'langan o'qituvchilar.
    const byKey = new Map<string, Row>();
    const take = (name: string) => {
      const k = nameKey(name);
      if (!byKey.has(k)) byKey.set(k, { name: name.trim(), groups: 0, students: 0, earned: hasAttribution ? 0 : null });
      return byKey.get(k)!;
    };

    for (const g of groups) {
      const name = String(g.teacher ?? "").trim();
      if (!name) continue;
      const row = take(name);
      row.groups += 1;
      row.students += rosterSize(g);
    }
    for (const r of attributed) take(String(r.teacherName ?? ""));

    for (const [k, row] of byKey) {
      if (hasAttribution) row.earned = earnedByTeacher.get(k) ?? 0;
    }

    return Array.from(byKey.values())
      .filter((r) => !teacher || nameKey(r.name) === nameKey(teacher))
      .sort((a, b) => (b.earned ?? 0) - (a.earned ?? 0) || a.name.localeCompare(b.name));
  }, [groups, attributed, earnedByTeacher, hasAttribution, teacher]);

  const total = useMemo(
    () => (hasAttribution ? rows.reduce((s, r) => s + (r.earned ?? 0), 0) : null),
    [rows, hasAttribution],
  );

  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-[18px] font-semibold tracking-tight">O&apos;qituvchilar oylik to&apos;lov analitikasi</h2>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <DateRangePicker
            value={dateRange}
            onChange={(r) => { setDateRange(r); setPage(1); }}
            placeholder="Oraliqni tanlang"
          />
          {/* O'qituvchilar bazadan (/api/teachers), qattiq yozilgan
              GROUP_TEACHERS ro'yxatidan emas. */}
          <Select value={teacher} onChange={(v) => { setTeacher(v); setPage(1); }} options={teacherNames.map((t) => ({ value: t, label: t }))} placeholder="O'qituvchi" clearable className="w-52" />
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="text-[13px] text-muted-foreground">Jami ishlab berilgan</div>
        <div className="text-[22px] font-semibold tabular-nums">{total === null ? "—" : fmtUZS(total)}</div>
        {total === null ? (
          <div className="text-[12px] text-muted-foreground mt-1">
            Tanlangan oraliqdagi kirim yozuvlarida o&apos;qituvchi ko&apos;rsatilmagan
            (<code>transaction_entries.teacherName</code> bo&apos;sh) — summani o&apos;qituvchilarga
            taqsimlab bo&apos;lmaydi.
          </div>
        ) : unattributedTotal > 0 ? (
          <div className="text-[12px] text-muted-foreground mt-1">
            Bundan tashqari o&apos;qituvchisi ko&apos;rsatilmagan {fmtUZS(unattributedTotal)} kirim bor —
            u quyidagi jadvalga tushmaydi.
          </div>
        ) : null}
      </div>

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{rows.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">O&apos;qituvchi</th>
                <th className="px-5 py-3 text-right">Guruhlar</th>
                <th className="px-5 py-3 text-right">O&apos;quvchilar</th>
                <th className="px-5 py-3 text-right pr-5">Ishlab berilgan summa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <tr key={r.name} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.groups}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.students}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums font-medium">
                    {r.earned === null ? "—" : fmtUZS(r.earned)}
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Ma'lumot topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </div>
  );
}
