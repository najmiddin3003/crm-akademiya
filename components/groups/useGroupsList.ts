"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { GROUP_DAYS } from "@/constants/groups";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { useRooms } from "@/hooks/useRooms";
import { useStudents } from "@/hooks/useStudents";
import { useTeachers } from "@/hooks/useTeachers";
import type { Group } from "@/lib/groups";
import { importRowsFromCsv } from "@/lib/groupsExport";
import { unionWithGroups } from "@/lib/groupsList";
import { pupilStatusOf, type PupilListItem } from "@/lib/pupilsData";

// GURUHLAR RO'YXATI — eski va yangi sahifaning UMUMIY ma'lumoti: guruhlar,
// filtr variantlari, muzlatilgan o'quvchilar, CSV import. Filtrlash va
// sanash — lib/groupsList.ts, eksport — lib/groupsExport.ts. Ikkala versiya
// shulardan o'qiydi: almashtirgan xodim bir xil ro'yxat va sonlarni ko'radi.

/** SERVERDA olingan boshlang'ich ro'yxatlar — app/(app)/groups/page.tsx. */
export interface GroupsListInitial {
  initialGroups?: Group[];
  /** Muzlatilgan o'quvchilar — "Muzlatilgan" soni uchun. */
  initialFrozenPupils?: PupilListItem[];
}

export function useGroupsList({ initialGroups, initialFrozenPupils }: GroupsListInitial = {}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  // Filtr ro'yxatlari bazadan — ilgari constants'dagi qattiq ro'yxatlar
  // edi, ya'ni haqiqiy o'qituvchi/kurs/xona bo'yicha filtrlab bo'lmasdi.
  const { names: dbTeachers } = useTeachers();
  const { names: dbCourses } = useOfflineCourseList();
  const { names: dbRooms } = useRooms();
  // O'quvchilar HOLATI (Aktiv/Muzlatilgan/Arxiv) faqat `pupils` da bor —
  // guruh hujjatida yo'q. SERVERDA filtrlanadi: bu yerdan faqat
  // MUZLATILGANLAR kerak. Ilgari 6 747 o'quvchi tortilib, deyarli hammasi
  // tashlab yuborilardi.
  const { pupils, loading: pupilsLoading } = useStudents({ status: "Muzlatilgan", initial: initialFrozenPupils });
  // `initialGroups` berilsa jadval birinchi renderdayoq to'la chiziladi va
  // quyidagi effekt so'rov yubormaydi.
  const [groups, setGroups] = useState<Group[]>(initialGroups ?? []);
  const [loading, setLoading] = useState(!initialGroups);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (initialGroups) return; // ro'yxat sahifa bilan birga keldi
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setGroups(d.groups); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initialGroups]);

  // Filtr variantlari: bazadagi ro'yxat + guruhlarda AMALDA uchraydigan
  // qiymatlar. Ikkinchisi kerak, chunki xonalar ro'yxati bo'sh bo'lishi
  // mumkin (seed yo'q), guruhlarda esa xona yozilgan bo'lishi mumkin.
  // Kun ham BAZADAGI qiymatlar bilan birlashtiriladi: filtr aniq tenglik
  // bilan solishtiradi, qo'lda "Du,Se,Pa" deb yozilgan guruh qattiq ro'yxat
  // orqali HECH QACHON topilmasdi.
  const options = useMemo(
    () => ({
      teacher: unionWithGroups(dbTeachers, groups, (g) => g.teacher),
      course: unionWithGroups(dbCourses, groups, (g) => g.course),
      room: unionWithGroups(dbRooms, groups, (g) => g.room),
      day: unionWithGroups(GROUP_DAYS, groups, (g) => g.day),
    }),
    [dbTeachers, dbCourses, dbRooms, groups],
  );

  /** Muzlatilgan o'quvchilar — HAQIQIY holat bo'yicha (lib/pupilsData.ts → pupilStatusOf). */
  const frozenIds = useMemo(
    () => new Set(pupils.filter((p) => pupilStatusOf(p) === "Muzlatilgan").map((p) => p.id)),
    [pupils],
  );

  /** Qo'shilgan yoki tahrirlangan guruh (GroupFormModal → onSaved). */
  function upsert(g: Group) {
    setGroups((prev) => (prev.some((x) => x.id === g.id) ? prev.map((x) => (x.id === g.id ? g : x)) : [...prev, g]));
  }

  // Import — eksport bilan bir xil ustunlar (eksport → tahrir → import).
  async function importCsv(file: File) {
    setImporting(true);
    try {
      const body = importRowsFromCsv(await file.text());
      if (!body) {
        showError(t("Faylda sarlavhadan boshqa qator yo'q"));
        return;
      }
      const res = await fetch("/api/groups/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: body }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Import qilinmadi"));
        return;
      }
      const fresh = await fetch("/api/groups").then((r) => r.json());
      if (fresh.ok) setGroups(fresh.groups);
      const skipped = (data.skipped as { reason: string }[]).length;
      showSuccess(
        skipped > 0
          ? t("{created} ta guruh qo'shildi, {skipped} tasi o'tkazib yuborildi", { created: data.created, skipped })
          : t("{created} ta guruh qo'shildi", { created: data.created }),
      );
    } catch {
      showError(t("Faylni o'qib bo'lmadi"));
    } finally {
      setImporting(false);
    }
  }

  return { groups, loading, pupilsLoading, options, frozenIds, upsert, importing, importCsv };
}
