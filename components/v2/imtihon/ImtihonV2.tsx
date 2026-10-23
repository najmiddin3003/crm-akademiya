"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStudents } from "@/hooks/useStudents";
import UzbmbView from "@/components/imtihon/UzbmbView";
import { useGroupExams } from "@/components/imtihon/sarhisobCore";
import { uzDateIso } from "@/lib/uzTime";
import type { GroupExam } from "@/lib/imtihon";
import ExamEntryV2 from "./ExamEntryV2";
import SarhisobListV2 from "./SarhisobListV2";
import { ImtihonHeader, type ImtihonTab } from "./examBits";

// YANGI VERSIYA — IMTIHON (/imtihon). Manzil:
//   /imtihon                — Sarhisob ro'yxati (SarhisobListV2; rasmi kelmagan);
//   /imtihon?kiritish=1     — «Natija kiritish» (ExamEntryV2; rasm «Sarhisob · Natija
//                             kiritish», 23.10.2026), `&oy=YYYY-MM` — qaysi oy uchun;
//   /imtihon?tab=uzbmb      — UzBMB (eski ko'rinish, rasmi kelmagan).
// Sarhisob qismi UzBMB ga o'tganda ham DOM'da qoladi (yashirin) — kiritilayotgan
// natijalar yo'qolmaydi; UzBMB birinchi ochilganda yuklanadi va keyin qoladi.
// Saqlangan sarhisoblar ikkala ko'rinishga bitta manbadan (sarhisobCore.useGroupExams).

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** UzBMB — o'quvchi ismlari faqat shu tab ochilganda yuklanadi. */
function UzbmbTab() {
  const { names } = useStudents({ light: true });
  return <UzbmbView pupilNames={names} />;
}

export default function ImtihonV2() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tab: ImtihonTab = sp.get("tab") === "uzbmb" ? "uzbmb" : "sarhisob";
  const entry = sp.get("kiritish") === "1";
  const oy = sp.get("oy");
  const month = oy && MONTH_RE.test(oy) ? oy : null;

  const { exams, setExams, loading } = useGroupExams();

  // UzBMB bir marta ochilgach DOM'da qoladi (filtr va kiritish holati saqlansin).
  const [uzbmbSeen, setUzbmbSeen] = useState(tab === "uzbmb");
  if (tab === "uzbmb" && !uzbmbSeen) setUzbmbSeen(true);

  const goList = (m?: string | null) => router.replace(m ? `${pathname}?oy=${m}` : pathname, { scroll: false });
  const goEntry = (m: string) => router.push(`${pathname}?kiritish=1&oy=${m}`, { scroll: false });

  const onSaved = (exam: GroupExam) => {
    setExams((prev) => [exam, ...prev]);
    goList(exam.month);
  };

  return (
    <div data-ui="v2" className="relative flex min-h-full flex-col bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      <div className={tab === "sarhisob" ? "flex flex-col" : "hidden"}>
        {entry ? (
          <ExamEntryV2 exams={exams} initialMonth={month ?? uzDateIso().slice(0, 7)} onSaved={onSaved} onLeave={() => goList(month)} />
        ) : (
          <SarhisobListV2 key={month ?? "-"} exams={exams} loading={loading} initialMonth={month} onAdd={goEntry} />
        )}
      </div>
      {uzbmbSeen && (
        <div className={tab === "uzbmb" ? "flex flex-col gap-4" : "hidden"}>
          <ImtihonHeader tab="uzbmb" />
          <UzbmbTab />
        </div>
      )}
    </div>
  );
}
