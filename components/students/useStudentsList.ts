"use client";

import { useEffect, useMemo, useState } from "react";
import { usePupils } from "@/components/orders/PupilsContext";
import { loadBalancesByIdCached } from "@/lib/balancesClient";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import { enrichStudents, studentRowFromPupil, uniqueSorted, type EnrichedStudent } from "@/lib/studentsData";

// O'QUVCHILAR RO'YXATINING MA'LUMOT QATLAMI — ikkala versiya uchun BITTA
// (eski components/students/StudentsListPage.tsx va yangi
// components/v2/students/StudentsListV2.tsx). Ko'rinish har xil, qatorlar,
// filtr variantlari va holat o'zgarishi bir xil bo'lishi shart: xodim
// versiyani almashtirsa ham ro'yxat o'sha-o'sha qoladi (design/v2/DESIGN.md).
//
// Manbalar:
//   • o'quvchilar — PupilsContext (app/(app)/students-list/layout.tsx);
//   • guruhlar — /api/groups: kurs, o'qituvchi, dars kunlari o'quvchining
//     o'zida emas, u a'zo bo'lgan GURUHdan keladi (lib/studentsData.ts);
//   • balans — /api/students/balances (transaction_entries bo'yicha HAQIQIY
//     to'lovlar). `pupils.balance` maydonini hech bir API yangilamaydi — u
//     faqat seed qiymatlarini saqlaydi, ya'ni ustunda ham, Qarzdor/Haqdor
//     jamida ham, eksportda ham soxta son ko'rinardi.

/** Guruh filtri: qiymat — guruh ID'si, ko'rinadigan matn — "(nom, o'qituvchi) raqam". */
export interface GroupFilterOption {
  value: string;
  label: string;
}

export interface StudentsListData {
  rows: EnrichedStudent[];
  groups: Group[];
  loading: boolean;
  options: {
    moderator: string[];
    source: string[];
    course: string[];
    teacher: string[];
    day: string[];
    subcourse: string[];
    group: GroupFilterOption[];
  };
  /** PATCH /api/pupils/:id/status dan qaytgan o'quvchi — jadval darhol yangilanadi. */
  applyStatusSaved: (pupil: Pupil) => void;
  /** Guruhlarni qayta o'qish — masalan o'quvchi guruhga qo'shilgandan keyin. */
  reloadGroups: () => void;
  reloadBalances: () => void;
}

export function useStudentsList(): StudentsListData {
  const { pupils, loading } = usePupils();
  const [groups, setGroups] = useState<Group[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setGroups(d.groups); });
    loadBalancesByIdCached()
      .then((b) => { if (!cancelled) setBalances(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Holat o'zgarishlarining mahalliy ustma-usti. PupilsContext faqat
  // `createPupil` ni biladi — bazadagi o'quvchini YANGILASH usuli unda yo'q,
  // shuning uchun PATCH .../status dan qaytgan hujjatni shu yerda ustiga
  // qo'yamiz. Aks holda holat bazada o'zgargani bilan jadval sahifa qayta
  // yuklanmaguncha eski holatni ko'rsatib turardi.
  const [statusPatch, setStatusPatch] = useState<
    Record<number, Pick<Pupil, "status" | "statusReason" | "statusChangedAt">>
  >({});

  const rows = useMemo(
    () =>
      enrichStudents(
        pupils.map((p) => {
          const row = studentRowFromPupil(statusPatch[p.id] ? { ...p, ...statusPatch[p.id] } : p);
          // Balans ID bo'yicha — ismdoshlarning puli qo'shilib
          // ketmasin (lib/pupilEntries.ts).
          return { ...row, balance: balances[row.id] ?? 0 };
        }),
        groups,
      ),
    // `statusPatch` ham bog'liqlikda: u o'zgarganda qatorlar (va ular ustidan
    // ishlaydigan "Holati" filtri) qayta hisoblanishi kerak.
    [pupils, groups, statusPatch, balances],
  );

  // Filtr tanlovlari — faqat ma'lumotda HAQIQATDA uchraydigan qiymatlar.
  const options = useMemo(
    () => ({
      moderator: uniqueSorted(rows.map((r) => r.moderator)),
      source: uniqueSorted(rows.map((r) => r.source)),
      course: uniqueSorted(groups.map((g) => g.course)),
      teacher: uniqueSorted(groups.map((g) => g.teacher)),
      day: uniqueSorted(groups.map((g) => g.day)),
      subcourse: uniqueSorted(groups.map((g) => g.level)),
      // Quruq raqamdan qaysi guruh ekanini bilib bo'lmasdi. `name` ko'pincha
      // id'ning o'zi, shuning uchun u takrorlansa qavs ichida faqat o'qituvchi qoladi.
      group: groups.map((g) => {
        const nom = (g.name || "").trim();
        const ustoz = (g.teacher || "").trim() || "o'qituvchisiz";
        const ichi = nom && nom !== String(g.id) ? `${nom}, ${ustoz}` : ustoz;
        return { value: String(g.id), label: `(${ichi}) ${g.id}` };
      }),
    }),
    [rows, groups],
  );

  function applyStatusSaved(pupil: Pupil) {
    setStatusPatch((prev) => ({
      ...prev,
      [pupil.id]: {
        status: pupil.status,
        statusReason: pupil.statusReason,
        statusChangedAt: pupil.statusChangedAt,
      },
    }));
    // Arxivlashda API o'quvchini `groups.studentIds` dan ham chiqaradi.
    // Mahalliy `groups` nusxasi bir marta yuklanadi va o'z-o'zidan
    // yangilanmaydi, shuning uchun uni ham qo'lda tozalaymiz — aks holda
    // "Guruhlar" ustuni hamda "Guruh"/"Guruhlar soni"/"Kurs" filtrlari
    // allaqachon uzilgan a'zolikni ko'rsatib turardi.
    if (pupil.status === "Arxiv") {
      setGroups((prev) =>
        prev.map((g) =>
          g.studentIds?.includes(pupil.id)
            ? { ...g, studentIds: g.studentIds.filter((sid) => sid !== pupil.id) }
            : g,
        ),
      );
    }
  }

  function reloadGroups() {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setGroups(d.groups); })
      .catch(() => {});
  }

  /** Balanslarni qayta o'qish — to'lov qabul qilingandan keyin (kesh avval bekor qilingan bo'ladi). */
  function reloadBalances() {
    loadBalancesByIdCached()
      .then((b) => setBalances(b))
      .catch(() => {});
  }

  return { rows, groups, loading, options, applyStatusSaved, reloadGroups, reloadBalances };
}
