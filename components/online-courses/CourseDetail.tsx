"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/Link";
import { Archive, Edit, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useOnlineCourses } from "./OnlineCoursesProvider";
import BindCourseDrawer from "./BindCourseDrawer";
import type { EduCategory } from "@/lib/eduCategories";
import type { Group } from "@/lib/groups";
import { useT } from "@/components/shared/Language";

// Onlayn kurs detail sahifasi (crm-akademiya #view-online-course-detail).
//
// NIMA O'ZGARDI:
//  • "Sotib olganlar" va "Topshiriqlar" tablari ilgari ustun sarlavhalari
//    bilan JADVAL chizardi va tbody'sini doim bo'sh qoldirardi, pastida esa
//    "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring" deb yozardi —
//    go'yo qidiruv bo'lgan-u, natija chiqmagandek. Aslida komponent hech
//    narsa yuklamaydi va yuklaydigan joyi ham yo'q: bazada onlayn kurs
//    XARIDLARI (`online_course_purchases` kabi) va TOPSHIRIQ TOPSHIRISHLARI
//    uchun kolleksiya mavjud emas. Endi tablar shuni ochiq aytadi.
//  • "Umumiy soni" qattiq yozilgan 0 edi. 0 — bu "hech kim sotib olmagan"
//    degan tasdiq; biz buni bilmaymiz, shu bois "—" ko'rsatiladi.
//  • "Oraliqni tanlang" tugmasi onClick'siz va holatsiz edi (hech qachon
//    ochilmaydigan sana tanlagich). Filtrlaydigan ma'lumot yo'q — tugma
//    butunlay olib tashlandi.
//  • Yangi: "Biriktirilgan" bo'limi — "Kurs biriktirish" oynasi endi
//    haqiqatan saqlaydi, natija shu yerda ko'rinadi va bekor qilinadi.

export default function CourseDetail({ courseId }: { courseId: number }) {
  const { t } = useT();
  const { getCourse, loading, togglePublish, unbindCourse } = useOnlineCourses();
  const { showSuccess, showError } = useToast();
  const course = getCourse(courseId);
  const [tab, setTab] = useState<"clients" | "assignments">("clients");
  const [bindOpen, setBindOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Biriktirilgan guruh/kategoriya NOMINI ko'rsatish uchun — hujjatda faqat
  // id'lar saqlanadi.
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<EduCategory[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/groups").then((r) => r.json()).catch(() => null),
      fetch("/api/edu-categories").then((r) => r.json()).catch(() => null),
    ]).then(([g, c]) => {
      if (cancelled) return;
      if (g?.ok) setGroups(g.groups as Group[]);
      if (c?.ok) setCategories(c.categories as EduCategory[]);
    });
    return () => { cancelled = true; };
  }, []);

  // Kurslar API'dan kelguncha "topilmadi" deb xulosa qilmaymiz.
  if (loading) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <SpinnerBlock />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">{t("Kurs topilmadi.")}</p>
        <Link href="/online-courses" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">{t("Orqaga")}</Link>
      </div>
    );
  }

  const boundGroups = (course.groupIds ?? [])
    .map((id) => groups.find((g) => g.id === id) ?? ({ id, name: `#${id}` } as Group));
  const boundCategory = course.categoryId != null ? categories.find((c) => c.id === course.categoryId) : undefined;

  const removeBinding = async (groupId?: number) => {
    const error = await unbindCourse(course.id, groupId);
    if (error) showError(error);
    else showSuccess(t("Biriktirish bekor qilindi"));
  };

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{course.name}</h1>
        <Link href={`/online-courses/${course.id}/edit`} className="h-8 w-8 rounded-md hover:bg-primary/10 inline-flex items-center justify-center text-primary" title={t("Tahrirlash")}>
          <Edit className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTab("clients")}
          className={`inline-flex items-center px-4 h-9 rounded-full text-[13px] font-medium ${tab === "clients" ? "bg-secondary/80 text-foreground" : "bg-transparent text-muted-foreground hover:bg-secondary/50"}`}
        >
          {t("Sotib olganlar")}
        </button>
        <button
          onClick={() => setTab("assignments")}
          className={`inline-flex items-center px-4 h-9 rounded-full text-[13px] font-medium ${tab === "assignments" ? "bg-secondary/80 text-foreground" : "bg-transparent text-muted-foreground hover:bg-secondary/50"}`}
        >
          {t("Topshiriqlar")}
        </button>
        <div className="flex-1" />
        <button onClick={() => setBindOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <Plus className="icon icon-sm" />
          <span>{t("Kurs biriktirish")}</span>
        </button>
        <button
          disabled={publishing}
          onClick={async () => {
            setPublishing(true);
            const error = await togglePublish(course.id);
            setPublishing(false);
            if (error) showError(error);
          }}
          className={`inline-flex items-center h-9 px-4 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 ${course.published ? "bg-emerald-600" : "bg-primary"}`}
        >
          {course.published ? t("Published") : t("Unpublished")}
        </button>
      </div>

      {/* Biriktirilganlar — kurs hujjatidagi haqiqiy `groupIds`/`categoryId`. */}
      {(boundGroups.length > 0 || boundCategory) && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{t("Biriktirilgan")}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {boundCategory && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-1 text-[13px]">
                Kurs: {boundCategory.name}
                <button type="button" onClick={() => removeBinding()} title={t("Biriktirishni bekor qilish")} className="text-muted-foreground hover:text-rose-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {boundGroups.map((g) => (
              <span key={g.id} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-1 text-[13px]">
                Guruh: {g.name || `#${g.id}`}
                <button type="button" onClick={() => removeBinding(g.id)} title={t("Biriktirishni bekor qilish")} className="text-muted-foreground hover:text-rose-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
          {/* "—" ataylab: xaridlar/topshiriqlar kolleksiyasi yo'q, ya'ni son
              noma'lum. 0 yozish "hech kim yo'q" degan yolg'on tasdiq bo'lardi. */}
          <span className="font-bold tabular-nums">—</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="py-16 text-center">
          <Archive className="mx-auto mb-3" style={{ width: 48, height: 48, opacity: 0.3 }} />
          <p className="text-base font-medium text-muted-foreground">{t("Ma'lumot manbai yo'q")}</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            {tab === "clients"
              ? t("Onlayn kurs xaridlari bazada yuritilmaydi — bunday kolleksiya hali yo'q.")
              : t("Topshiriq topshirishlari bazada yuritilmaydi — bunday kolleksiya hali yo'q.")}
          </p>
        </div>
      </div>

      {bindOpen && <BindCourseDrawer courseId={course.id} onClose={() => setBindOpen(false)} />}
    </div>
  );
}
