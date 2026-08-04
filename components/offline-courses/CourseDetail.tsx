"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import OfflineCoursesIcons from "./OfflineCoursesIcons";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { useOfflineCourses, type CourseLevel } from "./OfflineCoursesProvider";

// Kurs tafsiloti — yuqorida tablar, standart "Darajalar" tabi ochiq.
// Faqat "Darajalar" tabi to'liq ishlaydi (ro'yxat + qo'shish/tahrirlash/o'chirish);
// qolgan tablar hozircha bo'sh ("Ma'lumot yo'q") — keyin to'ldiriladi.
const TABS = [
  { key: "darajalar", label: "Darajalar" },
  { key: "hafta", label: "Hafta kunlari" },
  { key: "vaqtlar", label: "Kurs vaqtlari" },
  { key: "oqituvchilar", label: "O'qituvchilar" },
  { key: "kitoblar", label: "Kitoblar" },
  { key: "mavzular", label: "Mavzular" },
] as const;

export default function CourseDetail({ id }: { id: number }) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { loading, getCourse, deleteLevel } = useOfflineCourses();
  const [activeTab, setActiveTab] = useState<string>("darajalar");
  const [deleteTarget, setDeleteTarget] = useState<CourseLevel | null>(null);

  const course = getCourse(id);

  if (loading && !course) {
    return <div className="container mx-auto max-w-[1600px] p-4 md:p-5 text-sm text-muted-foreground">Yuklanmoqda…</div>;
  }

  if (!course) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">Kurs topilmadi.</p>
        <button onClick={() => router.push("/offline-courses")} className="mt-3 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm">
          Orqaga
        </button>
      </div>
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    const ok = await deleteLevel(id, deleteTarget.id);
    setDeleteTarget(null);
    if (ok) showSuccess(`Daraja o'chirildi — ${name}`);
    else showError("O'chirishda xatolik yuz berdi");
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <OfflineCoursesIcons />

      {/* Tab bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-white shadow-sm"
                : "bg-secondary/60 text-foreground hover:bg-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "darajalar" ? (
        <>
          <div className="flex items-center justify-start">
            <Link
              href={`/offline-courses/${course.id}/level-add`}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
            >
              <svg className="icon icon-sm"><use href="#i-plus" /></svg>
              <span>Daraja qo&apos;shish</span>
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left px-4 py-3 w-16">№</th>
                    <th className="text-left px-4 py-3">Turlari</th>
                    <th className="text-left px-4 py-3 w-48">Rang</th>
                    <th className="text-right px-4 py-3 w-24">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {course.levels.map((lvl, i) => (
                    <tr key={lvl.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 text-[14px] font-medium">{lvl.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block w-8 h-8 rounded-md" style={{ background: lvl.color }} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={`/offline-courses/${course.id}/level-edit/${lvl.id}`}
                            className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-primary"
                            title="Tahrirlash"
                          >
                            <svg className="icon icon-xs"><use href="#i-edit" /></svg>
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(lvl)}
                            className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                            title="O'chirish"
                          >
                            <svg className="icon icon-xs"><use href="#i-trash" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {course.levels.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Daraja qo&apos;shilmagan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm px-4 py-16 text-center text-sm text-muted-foreground">
          Ma&apos;lumot yo&apos;q
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="Darajani o'chirish"
          message="Quyidagi darajani o'chirmoqchimisiz:"
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
