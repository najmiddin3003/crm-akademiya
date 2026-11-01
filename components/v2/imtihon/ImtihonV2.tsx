"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { useStudents } from "@/hooks/useStudents";
import UzbmbView from "@/components/imtihon/UzbmbView";
import { upsertExam, useGroupExams } from "@/components/imtihon/sarhisobCore";
import { uzDateIso } from "@/lib/uzTime";
import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import ExamEntryV2 from "./ExamEntryV2";
import SarhisobListV2 from "./SarhisobListV2";
import { ImtihonHeader, type ImtihonTab } from "./examBits";
import UzbmbV2 from "./uzbmb/UzbmbV2";

// YANGI VERSIYA — IMTIHON (/imtihon). Manzil:
//   /imtihon                — Sarhisob ro'yxati (SarhisobListV2; rasmi kelmagan);
//   /imtihon?kiritish=1     — «Natija kiritish» (ExamEntryV2; rasm «Sarhisob · Natija
//                             kiritish», 23.10.2026), `&oy=YYYY-MM` — qaysi oy uchun;
//   /imtihon?tahrir=<id>    — shu ekran TAHRIR rejimida (01.11.2026; `&oy=` — qaytiladigan
//                             ro'yxat oyi, bo'lmasa sarhisobning o'z oyi); sarhisob topilmasa —
//                             xabar va ro'yxat;
//   /imtihon?tab=uzbmb      — UzBMB (uzbmb/UzbmbV2: natijalar, `&rejim=kiritish` — natija kiritish;
//                             12-qism, 25.10.2026); `&eski=1` — testga bog'lanmagan eski natijalar
//                             (25.10.2026 gacha oyma-oy yozilgan, eski ko'rinishda).
// Sarhisob qismi UzBMB ga o'tganda ham DOM'da qoladi (yashirin) — kiritilayotgan
// natijalar yo'qolmaydi; UzBMB birinchi ochilganda yuklanadi va keyin qoladi.
// Saqlangan sarhisoblar ikkala ko'rinishga bitta manbadan (sarhisobCore.useGroupExams).

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Eski UzBMB oynasi (testsiz yozuvlar) — o'quvchi ismlari faqat shu ochilganda yuklanadi. */
function UzbmbLegacy() {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { names } = useStudents({ light: true });
  const back = () => {
    const q = new URLSearchParams(sp.toString());
    q.delete("eski");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  return (
    <>
      <ImtihonHeader tab="uzbmb" crumbs={[{ label: "UzBMB", onClick: back }, { label: t("Eski natijalar") }]} />
      <UzbmbView pupilNames={names} />
    </>
  );
}

export default function ImtihonV2() {
  const { t } = useT();
  const { showError } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tab: ImtihonTab = sp.get("tab") === "uzbmb" ? "uzbmb" : "sarhisob";
  const legacy = sp.get("eski") === "1";
  const entry = sp.get("kiritish") === "1";
  const oy = sp.get("oy");
  const month = oy && MONTH_RE.test(oy) ? oy : null;
  const editRaw = sp.get("tahrir");
  const editId = editRaw && /^\d+$/.test(editRaw) ? Number(editRaw) : null;

  const { exams, setExams, loading, branchId } = useGroupExams();
  const editing = editId === null ? null : (exams.find((r) => r.id === editId) ?? null);

  // UzBMB bir marta ochilgach DOM'da qoladi (filtr va kiritish holati saqlansin).
  const [uzbmbSeen, setUzbmbSeen] = useState(tab === "uzbmb");
  if (tab === "uzbmb" && !uzbmbSeen) setUzbmbSeen(true);

  const goList = (m?: string | null) => router.replace(m ? `${pathname}?oy=${m}` : pathname, { scroll: false });
  const goEntry = (m: string) => router.push(`${pathname}?kiritish=1&oy=${m}`, { scroll: false });
  const goEdit = (exam: GroupExam, m: string) => router.push(`${pathname}?tahrir=${exam.id}${m ? `&oy=${m}` : ""}`, { scroll: false });

  // Qo'shilgani boshiga, tahrirlangani o'z o'rnida (sarhisobCore.upsertExam).
  const onSaved = (exam: GroupExam) => {
    setExams((prev) => upsertExam(prev, exam));
    goList(exam.month);
  };

  // Tahrirlanadigan sarhisob yo'q (o'chirilgan, boshqa filial yoki eski havola) — ro'yxatga.
  const missingEdit = editId !== null && !loading && !editing;
  useEffect(() => {
    if (!missingEdit) return;
    showError(t("Sarhisob topilmadi"));
    router.replace(month ? `${pathname}?oy=${month}` : pathname, { scroll: false });
  }, [missingEdit, month, pathname, router, showError, t]);

  return (
    <div data-ui="v2" className="relative flex min-h-full flex-col bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      <div className={tab === "sarhisob" ? "flex flex-col" : "hidden"}>
        {editId !== null ? (
          editing ? (
            <ExamEntryV2 key={editing.id} editing={editing} exams={exams} initialMonth={groupExamMonth(editing)} onSaved={onSaved} onLeave={() => goList(month ?? groupExamMonth(editing))} />
          ) : (
            <div className="flex flex-col gap-4" aria-busy="true">
              <ImtihonHeader tab="sarhisob" crumbs={[{ label: t("Sarhisob"), onClick: () => goList(month) }, { label: t("Natijani tahrirlash") }]} />
              <div className="h-24 rounded-v2-lg bg-v2-skeleton" />
              <div className="h-72 rounded-v2-lg bg-v2-skeleton" />
            </div>
          )
        ) : entry ? (
          <ExamEntryV2 exams={exams} initialMonth={month ?? uzDateIso().slice(0, 7)} onSaved={onSaved} onLeave={() => goList(month)} />
        ) : (
          <SarhisobListV2
            key={month ?? "-"}
            exams={exams}
            setExams={setExams}
            loading={loading}
            branchId={branchId}
            initialMonth={month}
            onAdd={goEntry}
            onEdit={goEdit}
          />
        )}
      </div>
      {uzbmbSeen && (
        <div className={tab === "uzbmb" ? "flex flex-col gap-4" : "hidden"}>{legacy ? <UzbmbLegacy /> : <UzbmbV2 />}</div>
      )}
    </div>
  );
}
