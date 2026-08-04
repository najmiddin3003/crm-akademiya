"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Calendar, Edit, Plus } from "lucide-react";
import { useOnlineCourses } from "./OnlineCoursesProvider";
import BindCourseDrawer from "./BindCourseDrawer";

// Onlayn kurs detail sahifasi (crm-akademiya #view-online-course-detail).
// Manbada 2 tab bor: "Sotib olganlar"/"Topshiriqlar" — ikkalasi ham HAR DOIM
// bo'sh render qilinadi (tbody.innerHTML='' shartsiz) — Oflayn kurslar'ning
// "6 tab, faqat Darajalar ishlaydi" chuqurligidan farqli, bu yerda hech
// qaysi tab haqiqiy ma'lumot ko'rsatmaydi (manbaning o'zida ham shunday).

const CLIENT_COLS = ["№", "O'quvchi ismi", "Sotib olgan vaqti", "Yakunlagan qismi"];
const ASSIGNMENT_COLS = ["№", "O'quvchi ismi", "Topshirilgan vaqti", "Bo'lim nomi", "Topshiriq nomi"];

export default function CourseDetail({ courseId }: { courseId: number }) {
  const { getCourse, togglePublish } = useOnlineCourses();
  const course = getCourse(courseId);
  const [tab, setTab] = useState<"clients" | "assignments">("clients");
  const [bindOpen, setBindOpen] = useState(false);

  if (!course) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">Kurs topilmadi.</p>
        <Link href="/online-courses" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">Orqaga</Link>
      </div>
    );
  }

  const cols = tab === "clients" ? CLIENT_COLS : ASSIGNMENT_COLS;

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{course.name}</h1>
        <Link href={`/online-courses/${course.id}/edit`} className="h-8 w-8 rounded-md hover:bg-primary/10 inline-flex items-center justify-center text-primary" title="Tahrirlash">
          <Edit className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setTab("clients")}
          className={`inline-flex items-center px-4 h-9 rounded-full text-[13px] font-medium ${tab === "clients" ? "bg-secondary/80 text-foreground" : "bg-transparent text-muted-foreground hover:bg-secondary/50"}`}
        >
          Sotib olganlar
        </button>
        <button
          onClick={() => setTab("assignments")}
          className={`inline-flex items-center px-4 h-9 rounded-full text-[13px] font-medium ${tab === "assignments" ? "bg-secondary/80 text-foreground" : "bg-transparent text-muted-foreground hover:bg-secondary/50"}`}
        >
          Topshiriqlar
        </button>
        <div className="flex-1" />
        <button onClick={() => setBindOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <Plus className="icon icon-sm" />
          <span>Kurs biriktirish</span>
        </button>
        <button type="button" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm">
          <Calendar className="icon icon-sm text-muted-foreground" />
          <span className="text-muted-foreground">Oraliqni tanlang</span>
        </button>
        <button
          onClick={() => togglePublish(course.id)}
          className={`inline-flex items-center h-9 px-4 rounded-lg text-white text-sm font-medium hover:opacity-90 ${course.published ? "bg-emerald-600" : "bg-primary"}`}
        >
          {course.published ? "Published" : "Unpublished"}
        </button>
      </div>

      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">0</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                {cols.map((c, i) => <th key={c} className={`text-left px-3 py-3 ${i === 0 ? "w-16" : ""}`}>{c}</th>)}
              </tr>
            </thead>
            <tbody />
          </table>
        </div>
        <div className="py-16 text-center">
          <Archive className="mx-auto mb-3" style={{ width: 48, height: 48, opacity: 0.3 }} />
          <p className="text-base font-medium text-muted-foreground">Ma&apos;lumotlar topilmadi</p>
          <p className="text-[12px] text-muted-foreground mt-1">Ma&apos;lumotlar topilmadi. Filterni o&apos;zgartirib ko&apos;ring.</p>
        </div>
      </div>

      {bindOpen && <BindCourseDrawer onClose={() => setBindOpen(false)} />}
    </div>
  );
}
