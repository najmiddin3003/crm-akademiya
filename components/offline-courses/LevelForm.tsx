"use client";

import { useState } from "react";
import Link from "@/components/ui/Link";
import { useRouter } from "next/navigation";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useBranches } from "@/hooks/useBranches";
import OfflineCoursesIcons from "./OfflineCoursesIcons";
import { useOfflineCourses, type CourseLevel } from "./OfflineCoursesProvider";
import { useT } from "@/components/shared/Language";

// Daraja qo'shish / tahrirlash formasi. Tashqi komponent kontekst yuklanishini
// kutadi; ichki `LevelFormBody` faqat ma'lumot tayyor bo'lgach mount bo'ladi.
export default function LevelForm({ courseId, levelId }: { courseId: number; levelId?: number }) {
  const { t } = useT();
  const { loading, getCourse } = useOfflineCourses();
  const course = getCourse(courseId);
  const editing = levelId != null ? course?.levels.find((l) => l.id === levelId) : undefined;

  if (loading) {
    return <div className="container mx-auto max-w-[1600px] p-4 md:p-5"><SpinnerBlock /></div>;
  }
  if (!course) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">{t("Kurs topilmadi.")}</p>
        <Link href="/offline-courses" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">{t("Orqaga")}</Link>
      </div>
    );
  }
  if (levelId != null && !editing) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">{t("Daraja topilmadi.")}</p>
        <Link href={`/offline-courses/${courseId}`} className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">{t("Orqaga")}</Link>
      </div>
    );
  }

  return <LevelFormBody key={editing?.id ?? "new"} courseId={courseId} editing={editing} />;
}

interface BranchRow {
  enabled: boolean;
  summa: string;
}

const EMPTY_ROW: BranchRow = { enabled: false, summa: "" };

// Qatorlar filial ID'si bo'yicha kalitlanadi — CourseForm.tsx dagi bilan bir
// xil sabab: filiallar /api/branches dan asinxron keladi va o'zgarishi mumkin.
function initialRows(existing?: { id: number; enabled: boolean; summa: number }[]): Record<number, BranchRow> {
  return Object.fromEntries(
    (existing ?? []).map((b) => [b.id, { enabled: b.enabled, summa: b.summa ? String(b.summa) : "" }]),
  );
}

function LevelFormBody({ courseId, editing }: { courseId: number; editing?: CourseLevel }) {
  const { t } = useT();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { addLevel, updateLevel } = useOfflineCourses();

  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? "#000000");
  const { branches, loading: branchesLoading } = useBranches();
  const [rows, setRows] = useState<Record<number, BranchRow>>(() => initialRows(editing?.branches));
  const [saving, setSaving] = useState(false);

  const detailHref = `/offline-courses/${courseId}`;

  function setBranch(id: number, patch: Partial<BranchRow>) {
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_ROW), ...patch } }));
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError(t("Daraja nomini kiriting"));
      return;
    }
    setSaving(true);
    const data = {
      name: trimmed,
      color,
      branches: branches.map((b) => {
        const row = rows[b.id] ?? EMPTY_ROW;
        return { id: b.id, name: b.name, enabled: row.enabled, summa: parseInt(row.summa, 10) || 0 };
      }),
    };
    const ok = editing ? await updateLevel(courseId, editing.id, data) : await addLevel(courseId, data);
    setSaving(false);
    if (!ok) {
      showError(t("Saqlashda xatolik yuz berdi"));
      return;
    }
    showSuccess(editing ? t("Daraja yangilandi — {trimmed}", { trimmed }) : t("Daraja qo'shildi — {trimmed}", { trimmed }));
    router.push(detailHref);
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <OfflineCoursesIcons />

      {/* Name + Color */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[14px] font-semibold text-foreground">{t("Daraja nomini kiriting")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              className="w-full h-12 mt-2 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-[14px] font-semibold text-foreground">{t("Rang")}</label>
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
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-foreground/70">
              <th className="text-left px-6 py-4 font-semibold text-[14px] w-40">{t("Mavjudligi")}</th>
              <th className="text-left px-6 py-4 font-semibold text-[14px]">{t("Filiallar")}</th>
              <th className="text-left px-6 py-4 font-semibold text-[14px] w-72">{t("Summa")}</th>
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
                      value={row.summa}
                      onChange={(e) => setBranch(b.id, { summa: e.target.value })}
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
        <button onClick={() => router.push(detailHref)} className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm">
          {t("Orqaga")}
        </button>
        <button onClick={save} disabled={saving} className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
          {saving ? t("Saqlanmoqda…") : t("Saqlash")}
        </button>
      </div>
    </div>
  );
}
