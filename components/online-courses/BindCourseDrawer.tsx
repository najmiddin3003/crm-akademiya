"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useOnlineCourses } from "./OnlineCoursesProvider";
import type { EduCategory } from "@/lib/eduCategories";
import type { Group } from "@/lib/groups";

// "Kurs biriktirish" — o'ngdan chiquvchi drawer (crm-akademiya
// #bind-course-drawer). Guruh/Kurs rejimlari orasida almashadi.
//
// ILGARI BU OYNA IKKI MARTA YOLG'ON GAPIRARDI:
//   1) "Guruh" va "Kurs" tanlovlari qattiq yozilgan matn massivlari edi
//      (GROUPS = ["1-guruh A1", ...], SUBJECTS = ["Tarix", ...]) — bazadagi
//      birorta ham haqiqiy guruh yoki kategoriya u yerda yo'q edi;
//   2) "Saqlash" hech qanday so'rov yubormasdi, faqat "Biriktirildi" toastini
//      ko'rsatib oynani yopardi.
//
// Endi ro'yxatlar HAQIQIY manbadan keladi — /api/groups (Guruhlar) va
// /api/edu-categories (O'quv bo'limi → Kategoriya) — va "Saqlash"
// POST /api/online-courses/:id/bind orqali kurs hujjatiga yozadi.

export default function BindCourseDrawer({ courseId, onClose }: { courseId: number; onClose: () => void }) {
  const [mode, setMode] = useState<"group" | "course">("group");
  const [value, setValue] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<EduCategory[]>([]);
  // Ro'yxatlar hali kelmaganda "yo'q" deyish YOLG'ON bo'lardi: birinchi
  // renderda ikkala massiv ham bo'sh, ya'ni oyna har ochilganda javob
  // kelgunicha "Guruh yo'q" / "Kategoriya yo'q" deb turardi. Yuklanish
  // bayrog'i naqshi hooks/useOfflineCourseList.ts dagi kabi.
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { bindCourse } = useOnlineCourses();
  const { showSuccess, showError } = useToast();
  useEscapeClose(onClose);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/groups").then((r) => r.json()).catch(() => null),
      fetch("/api/edu-categories").then((r) => r.json()).catch(() => null),
    ])
      .then(([g, c]) => {
        if (cancelled) return;
        if (g?.ok) setGroups(g.groups as Group[]);
        if (c?.ok) setCategories(c.categories as EduCategory[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    if (!value) {
      showError(mode === "group" ? "Guruh tanlang" : "Kurs tanlang");
      return;
    }
    setSaving(true);
    const id = Number(value);
    const error = await bindCourse(courseId, mode === "group" ? { groupId: id } : { categoryId: id });
    setSaving(false);
    if (error) {
      showError(error);
      return;
    }
    const label =
      mode === "group"
        ? groups.find((g) => g.id === id)?.name || String(id)
        : categories.find((c) => c.id === id)?.name || String(id);
    showSuccess(`Biriktirildi — ${label}`);
    onClose();
  }

  const selectCls =
    "filter-select w-full h-10 mt-2 appearance-none rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <>
      <div className="fixed inset-0 z-[110]" style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-[120] w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold tracking-tight">Kurs biriktirish</h2>
        </div>
        <div className="px-6">
          <div className="grid grid-cols-2 gap-0 rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => { setMode("group"); setValue(""); }}
              className={`h-10 text-sm font-medium ${mode === "group" ? "bg-primary text-white" : "bg-card text-foreground hover:bg-secondary"}`}
            >
              Guruh
            </button>
            <button
              onClick={() => { setMode("course"); setValue(""); }}
              className={`h-10 text-sm font-medium ${mode === "course" ? "bg-primary text-white" : "bg-card text-foreground hover:bg-secondary"}`}
            >
              Kurs
            </button>
          </div>

          {mode === "group" ? (
            <div className="mt-6">
              <label className="text-[13px] font-medium">Guruh</label>
              <select value={value} onChange={(e) => setValue(e.target.value)} className={selectCls} disabled={loading}>
                {/* Bo'sh ro'yxat "hech narsa yo'q" deb ochiq aytadi — ilgari
                    o'sha holatda ham beshta o'ylab topilgan guruh chiqardi.
                    "Yo'q" degan xulosa esa faqat javob KELGANDAN keyin
                    chiqariladi, aks holda yuklanish paytidagi bo'sh massiv
                    "guruh yo'q" deb da'vo qilib turardi. */}
                <option value="">{loading ? "Yuklanmoqda…" : groups.length ? "Guruh" : "Guruh yo'q"}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name || `#${g.id}`}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mt-6">
              <label className="text-[13px] font-medium">Kurs</label>
              <select value={value} onChange={(e) => setValue(e.target.value)} className={selectCls} disabled={loading}>
                <option value="">{loading ? "Yuklanmoqda…" : categories.length ? "Kurs" : "Kategoriya yo'q"}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex-1" />
        <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Orqaga</button>
          <button
            onClick={save}
            disabled={saving}
            className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:pointer-events-none"
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </>
  );
}
