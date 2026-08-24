"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";

// O'quvchi profilidagi (/student-edit/[id]) tablar uchun umumiy yordamchi:
// tab QAYSI o'quvchi haqida ekanini aniqlaydi va uning BAZADAGI yozuvini
// oladi.
//
// NEGA KERAK: profil sahifasi (components/students/StudentEditPage.tsx)
// "Guruh", "Vazifa" va "Shartnoma biriktirish" tablariga o'quvchi id'sini
// uzatmaydi, bu tablar esa aynan shu id'siz haqiqiy ma'lumot ko'rsata
// olmaydi (guruh a'zoligi `groups.studentIds` da, shartnoma esa
// `finance_contracts.studentOrderId` da id bo'yicha bog'lanadi).
// Id URL segmentida bor va StudentEditPage ham o'z yozuvini AYNAN SHU id
// bilan oladi (`/api/pupils/${order.id}`), shuning uchun uni useParams
// orqali o'qiymiz. Sahifa keyinchalik id'ni prop qilib uzatsa —
// `pupilIdProp` ustun turadi va hech narsa buzilmaydi.
export function useProfilePupilId(pupilIdProp?: number): number | undefined {
  const params = useParams<{ id: string }>();
  const routeId = Number(params.id);
  return pupilIdProp ?? (Number.isFinite(routeId) ? routeId : undefined);
}

/** Yuqoridagi id + o'quvchining bazadagi yozuvi (faqat id kerak bo'lsa
 *  `useProfilePupilId` ishlatiladi — u ortiqcha so'rov yubormaydi). */
export function useProfilePupil(pupilIdProp?: number) {
  const pupilId = useProfilePupilId(pupilIdProp);

  const [pupil, setPupil] = useState<Pupil | null>(null);
  // Id bo'lmasa so'rov ham yuborilmaydi — u holda darhol "yuklanmadi".
  const [loading, setLoading] = useState(pupilId !== undefined);

  useEffect(() => {
    if (pupilId === undefined) return;
    let cancelled = false;
    fetch(`/api/pupils/${pupilId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setPupil(d.pupil as Pupil); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pupilId]);

  // Yozuv topilmagan bo'lishi mumkin: profil demo buyurtmalar ro'yxatidan
  // ham ochiladi (app/(app)/student-edit/[id]/page.tsx), u holda bazada
  // bunday o'quvchi yo'q. Chaqiruvchi `pupil === null` ni ko'rib
  // saqlash tugmalarini o'chiradi — soxta yozuv yaratmaydi.
  return { pupilId, pupil, fullName: pupil ? pupilFullName(pupil) : "", loading };
}
