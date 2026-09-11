"use client";

import { useState } from "react";
import Link from "@/components/ui/Link";
import { useRouter } from "next/navigation";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useBranches } from "@/hooks/useBranches";
import OfflineCoursesIcons from "./OfflineCoursesIcons";
import { useOfflineCourses, type OfflineCourse } from "./OfflineCoursesProvider";

// Kurs qo'shish / tahrirlash formasi (crm-akademiya #view-add-course).
// Tashqi komponent — kontekst yuklanishini kutadi; ichki `CourseFormBody`
// faqat ma'lumot tayyor bo'lgach mount bo'ladi (shuning uchun useState boshlang'ich
// qiymatlari to'g'ri — to'g'ridan-to'g'ri URL/reload'da ham).
export default function CourseForm({ courseId, initialName }: { courseId?: number; initialName?: string }) {
  const { loading, getCourse } = useOfflineCourses();
  const editing = courseId != null ? getCourse(courseId) : undefined;

  if (courseId != null) {
    if (loading) {
      return <div className="container mx-auto max-w-[1600px] p-4 md:p-5"><SpinnerBlock /></div>;
    }
    if (!editing) {
      return (
        <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
          <p className="text-sm text-muted-foreground">Kurs topilmadi.</p>
          <Link href="/offline-courses" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">Orqaga</Link>
        </div>
      );
    }
  }

  return <CourseFormBody key={editing?.id ?? "new"} editing={editing} initialName={initialName} />;
}

interface BranchRow {
  enabled: boolean;
  price: string;
}

const EMPTY_ROW: BranchRow = { enabled: false, price: "" };

// Qatorlar filial ID'si bo'yicha kalitlanadi (indeks bo'yicha emas) — filiallar
// ro'yxati /api/branches dan ASINXRON keladi va foydalanuvchi filial qo'shishi/
// o'chirishi mumkin, shuning uchun indeks barqaror kalit emas.
function initialRows(existing?: { id: number; enabled: boolean; price: number }[]): Record<number, BranchRow> {
  return Object.fromEntries(
    (existing ?? []).map((b) => [b.id, { enabled: b.enabled, price: b.price ? String(b.price) : "" }]),
  );
}

// `initialName` — yangi kurs uchun oldindan to'ldiriladigan nom. Buyurtma
// detalidagi fan hali kurslar ro'yxatida bo'lmasa, o'sha nom bilan ochiladi
// va "Saqlash" uni bazaga yozadi.
function CourseFormBody({ editing, initialName }: { editing?: OfflineCourse; initialName?: string }) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { addCourse, updateCourse } = useOfflineCourses();

  const [name, setName] = useState(editing?.name ?? initialName ?? "");
  const [color, setColor] = useState(editing?.color ?? "#000000");
  const { branches, loading: branchesLoading } = useBranches();
  const [rows, setRows] = useState<Record<number, BranchRow>>(() => initialRows(editing?.branches));
  const [saving, setSaving] = useState(false);

  function setBranch(id: number, patch: Partial<BranchRow>) {
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_ROW), ...patch } }));
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Kurs nomini kiriting");
      return;
    }
    setSaving(true);
    const data = {
      name: trimmed,
      color,
      branches: branches.map((b) => {
        const row = rows[b.id] ?? EMPTY_ROW;
        return { id: b.id, name: b.name, enabled: row.enabled, price: parseInt(row.price, 10) || 0 };
      }),
    };
    const ok = editing ? await updateCourse(editing.id, data) : await addCourse(data);
    setSaving(false);
    if (!ok) {
      showError("Saqlashda xatolik yuz berdi");
      return;
    }
    showSuccess(editing ? `Kurs yangilandi — ${trimmed}` : `Kurs qo'shildi — ${trimmed}`);
    router.push("/offline-courses");
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <OfflineCoursesIcons />

      {/* Name + Color */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[14px] font-semibold text-foreground">Kurs nomi</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              className="w-full h-12 mt-2 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-[14px] font-semibold text-foreground">Rang</label>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              type="color"
              className="w-full h-12 mt-2 rounded-xl border border-border bg-card cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Branch availability */}
      <h3 className="text-base font-semibold mt-2">Shu dars o&apos;qitiladigan filiallarni tanlang va bitta dars narxini kiriting</h3>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-foreground/70">
              <th className="text-left px-6 py-4 font-semibold text-[14px] w-40">Mavjudligi</th>
              <th className="text-left px-6 py-4 font-semibold text-[14px]">Filiallar</th>
              <th className="text-left px-6 py-4 font-semibold text-[14px] w-72">Bitta dars narxi</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => {
              const row = rows[b.id] ?? EMPTY_ROW;
              return (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => setBranch(b.id, { enabled: e.target.checked })}
                      className="rounded border-border w-5 h-5"
                    />
                  </td>
                  <td className="px-6 py-4 text-foreground/80">{b.name}</td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={row.price}
                      onChange={(e) => setBranch(b.id, { price: e.target.value })}
                      className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </td>
                </tr>
              );
            })}
            {branches.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  {branchesLoading ? <SpinnerBlock size={22} /> : "Filial topilmadi"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button onClick={() => router.push("/offline-courses")} className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm">
          Orqaga
        </button>
        <button onClick={save} disabled={saving} className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}
