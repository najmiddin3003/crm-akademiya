"use client";

import { useState } from "react";
import Link from "next/link";
import { DollarSign, Monitor, Pencil, Plus, Trash2 } from "lucide-react";
import DeleteConfirmModal from "@/components/offline-courses/DeleteConfirmModal";
import { useToast } from "@/components/ui/Toast";
import CourseCover from "./CourseCover";
import OnlineCoursesIcons from "./OnlineCoursesIcons";
import { useOnlineCourses } from "./OnlineCoursesProvider";

// O'quv bo'limi → Onlayn kurs (crm-akademiya #view-online-courses). Manbada
// jadval emas — KARTA GRID (grid-cols-1 md:grid-cols-2 lg:grid-cols-3).
// "Aktiv kurslar"/"Yakunlanmagan kurslar" — c.published bool bo'yicha oddiy
// filtr. Karta o'zi: muqova (bosilsa detail'ga), nomi+tahrirlash qalami
// (bosilsa detail'ga), o'chirish (chelak), pastda ikkita SOF DEKORATIV
// belgi ($ va monitor) — manbada ham narx/o'quvchilar soni ko'rinmaydi,
// shu holicha ko'chirildi (yangi narsa qo'shilmadi).

const TABS = [
  { key: "active" as const, label: "Aktiv kurslar" },
  { key: "incomplete" as const, label: "Yakunlanmagan kurslar" },
];

export default function OnlineCoursesList() {
  const { courses, deleteCourse } = useOnlineCourses();
  const { showSuccess } = useToast();
  const [tab, setTab] = useState<"active" | "incomplete">("active");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = courses.filter((c) => (tab === "active" ? c.published : !c.published));
  const deleting = deletingId != null ? courses.find((c) => c.id === deletingId) : undefined;

  function confirmDelete() {
    if (!deleting) return;
    deleteCourse(deleting.id);
    showSuccess(`Onlayn kurs o'chirildi — ${deleting.name}`);
    setDeletingId(null);
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <OnlineCoursesIcons />

      <div>
        <Link href="/online-courses/add" className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <Plus className="icon icon-sm" />
          <span>Kurs qo&apos;shish</span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center px-4 h-9 rounded-full text-[13px] font-medium ${
              tab === t.key ? "bg-secondary/80 text-foreground" : "bg-transparent text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-16">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center text-2xl md:text-3xl font-bold text-primary py-16">
            <span>Afsuski kurs mavjud emas</span>
            <span className="ml-3" style={{ fontSize: "1.1em" }}>😞</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                <Link href={`/online-courses/${c.id}`} className="cursor-pointer aspect-[750/422] bg-secondary/30 flex items-center justify-center relative overflow-hidden">
                  <CourseCover cover={c.cover} />
                </Link>
                <div className="px-4 pt-3 flex items-center justify-between">
                  <Link href={`/online-courses/${c.id}`} className="flex items-center gap-2 group min-w-0">
                    <h3 className="font-semibold text-[15px] truncate group-hover:text-primary">{c.name}</h3>
                    <Pencil className="h-3.5 w-3.5 text-primary shrink-0" />
                  </Link>
                  <button onClick={() => setDeletingId(c.id)} className="h-8 w-8 rounded-md hover:bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0" title="O'chirish">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-4 pb-3 pt-2 flex items-center justify-between border-t border-border mt-2">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-secondary/40 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                  </span>
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-secondary/40 text-rose-500">
                    <Monitor className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleting && (
        <DeleteConfirmModal
          title="Kursni o'chirish"
          message="Rostdan ham o'chirmoqchimisiz:"
          name={deleting.name}
          onCancel={() => setDeletingId(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
