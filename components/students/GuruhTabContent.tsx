"use client";

import { useMemo } from "react";
import Link from "@/components/ui/Link";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useGroups } from "@/hooks/useGroups";
import { useProfilePupilId } from "@/hooks/useProfilePupil";

// O'quvchi profili → "Guruh".
//
// ILGARI NIMA NOTO'G'RI EDI: bu tab sarlavha va "Guruhlar topilmadi"
// degan QOTIB QOLGAN matndan iborat edi — na propi, na holati, na bitta
// so'rovi bor edi. Ya'ni o'quvchi bazada guruhga qo'shilgan bo'lsa ham,
// tab HECH QACHON hech narsa ko'rsata olmasdi va "guruh yo'q" deb yolg'on
// aytardi.
//
// Endi guruhlar /api/groups dan olinadi va o'quvchiga tegishlilari
// `studentIds` bo'yicha ajratiladi — bu loyihadagi guruh a'zoligining
// YAGONA haqiqiy manbasi (`Group.students` — hech qachon yangilanmaydigan
// o'lik hisoblagich, undan foydalanilmaydi).
//
// O'quvchi id'si: hozircha URL segmentidan olinadi (hooks/useProfilePupil.ts),
// chunki StudentEditPage tabga id uzatmaydi. Sahifa uzata boshlasa,
// `pupilId` propi ustun turadi.

// Bazadagi qiymat ("active"/"frozen"/"archive") — foydalanuvchi ko'radigan
// yozuv (Guruhlar ro'yxatidagi tanlov bilan bir xil).
const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  frozen: "Muzlatilgan",
  archive: "Arxiv",
};

export default function GuruhTabContent({ pupilId: pupilIdProp }: { pupilId?: number }) {
  // Faqat id kerak — o'quvchi yozuvining o'zi bu tabda ishlatilmaydi.
  const pupilId = useProfilePupilId(pupilIdProp);
  const { groups, loading } = useGroups();

  const myGroups = useMemo(
    () => (pupilId === undefined ? [] : groups.filter((g) => (g.studentIds ?? []).includes(pupilId))),
    [groups, pupilId],
  );

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="p-4 border-l-4 border-primary flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold">Guruhlar</h3>
        {!loading && pupilId !== undefined && (
          <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">
            Umumiy soni: {myGroups.length}
          </span>
        )}
      </div>

      {/* Javob kelmaguncha "topilmadi" deb ayta olmaymiz. */}
      {loading ? (
        <SpinnerBlock />
      ) : pupilId === undefined ? (
        <div className="px-4 pb-8 pt-2 text-center text-muted-foreground text-[14px]">
          O&apos;quvchi aniqlanmadi — guruhlarni ko&apos;rsatib bo&apos;lmaydi.
        </div>
      ) : myGroups.length === 0 ? (
        <div className="px-4 pb-8 pt-2 text-center text-muted-foreground text-[14px]">
          O&apos;quvchi hech qanday guruhga qo&apos;shilmagan
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[12px] text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium">№</th>
                <th className="px-4 py-3 text-left font-medium">Guruh</th>
                <th className="px-4 py-3 text-left font-medium">Kurs</th>
                <th className="px-4 py-3 text-left font-medium">O&apos;qituvchi</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Dars kuni</th>
                <th className="px-4 py-3 text-left font-medium">Vaqti</th>
                <th className="px-4 py-3 text-left font-medium">Xona</th>
                <th className="px-4 py-3 text-left font-medium">Davri</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Guruh holati</th>
              </tr>
            </thead>
            <tbody>
              {myGroups.map((g, i) => (
                <tr key={g.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3 text-[13px] font-medium tabular-nums">
                    <Link href={`/groups/${g.id}`} className="text-primary hover:underline">
                      {g.name || g.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[13px]">{g.course || "—"}</td>
                  <td className="px-4 py-3 text-[13px]">{g.teacher || "—"}</td>
                  <td className="px-4 py-3 text-[13px]">{g.day || "—"}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{g.time || "—"}</td>
                  <td className="px-4 py-3 text-[13px] text-muted-foreground">{g.room || "—"}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap text-muted-foreground">{g.period || "—"}</td>
                  <td className="px-4 py-3 text-[12px]">{STATUS_LABELS[g.status] ?? (g.status || "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
