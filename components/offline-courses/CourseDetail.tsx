"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/Link";
import { useRouter } from "next/navigation";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import OfflineCoursesIcons from "./OfflineCoursesIcons";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { useOfflineCourses, type CourseLevel, type CourseListItem, type CourseListKind } from "./OfflineCoursesProvider";
import type { Group } from "@/lib/groups";
import { useT } from "@/components/shared/Language";

// Kurs tafsiloti — yuqorida tablar, standart "Darajalar" tabi ochiq.
//
// ILGARI: oltita tabdan FAQAT "Darajalar" ishlardi; qolgan beshtasi bir xil
// statik "Ma'lumot yo'q" panelini chizardi va hech qanday so'rov yubormasdi.
// Ya'ni tablar bosiladigan, lekin hech qachon hech narsa ko'rsatmaydigan
// bezak edi.
//
// HOZIR har bir tabning HAQIQIY manbasi bor:
//   • Hafta kunlari / Kurs vaqtlari / O'qituvchilar — /api/groups dan
//     hisoblanadi: shu kurs bo'yicha ochilgan guruhlarning `day` / `time` /
//     `teacher` maydonlari. Bu o'ylab topilgan qiymat emas — kurs qaysi
//     kunlarda, qaysi vaqtda va kim tomonidan o'qitilayotgani aynan shu
//     guruhlarda yozilgan.
//   • Kitoblar / Mavzular — kurs hujjatidagi `books` / `topics` ro'yxatlari
//     (app/api/offline-courses/[id]/lists/route.ts), darajalar kabi CRUD.
const TABS = [
  { key: "darajalar", label: "Darajalar" },
  { key: "hafta", label: "Hafta kunlari" },
  { key: "vaqtlar", label: "Kurs vaqtlari" },
  { key: "oqituvchilar", label: "O'qituvchilar" },
  { key: "kitoblar", label: "Kitoblar" },
  { key: "mavzular", label: "Mavzular" },
] as const;

/** Guruhlardan olingan noyob qiymatlar + har biriga nechta guruh to'g'ri kelishi. */
function countBy(groups: Group[], pick: (g: Group) => string | undefined): { value: string; count: number }[] {
  const map = new Map<string, number>();
  for (const g of groups) {
    const v = (pick(g) || "").trim();
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
}

export default function CourseDetail({ id }: { id: number }) {
  const { t } = useT();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { loading, getCourse, deleteLevel, addListItem, deleteListItem } = useOfflineCourses();
  const [activeTab, setActiveTab] = useState<string>("darajalar");
  const [deleteTarget, setDeleteTarget] = useState<CourseLevel | null>(null);

  // Shu kursning guruhlari — Hafta kunlari / Kurs vaqtlari / O'qituvchilar
  // tablarining manbai.
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setGroups(d.groups as Group[]); })
      .finally(() => { if (!cancelled) setGroupsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const course = getCourse(id);
  // useMemo ATAYLAB ishlatilmadi: React Compiler bu ifodani o'zi memoizatsiya
  // qiladi va qo'lda yozilgan useMemo uni butunlay o'chirib yuborardi
  // ("Compilation Skipped: Existing memoization could not be preserved").
  const courseName = (course?.name ?? "").trim();
  const courseGroups = groups.filter((g) => (g.course || "").trim() === courseName);

  if (loading && !course) {
    return <div className="container mx-auto max-w-[1600px] p-4 md:p-5"><SpinnerBlock /></div>;
  }

  if (!course) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">{t("Kurs topilmadi.")}</p>
        <button onClick={() => router.push("/offline-courses")} className="mt-3 h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm">
          {t("Orqaga")}
        </button>
      </div>
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    const ok = await deleteLevel(id, deleteTarget.id);
    setDeleteTarget(null);
    if (ok) showSuccess(t("Daraja o'chirildi — {name}", { name }));
    else showError(t("O'chirishda xatolik yuz berdi"));
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
            {t(tab.label)}
          </button>
        ))}
      </div>

      {activeTab === "darajalar" && (
        <>
          <div className="flex items-center justify-start">
            <Link
              href={`/offline-courses/${course.id}/level-add`}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
            >
              <svg className="icon icon-sm"><use href="#i-plus" /></svg>
              <span>{t("Daraja qo'shish")}</span>
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40">
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left px-4 py-3 w-16">№</th>
                    <th className="text-left px-4 py-3">{t("Turlari")}</th>
                    <th className="text-left px-4 py-3 w-48">{t("Rang")}</th>
                    <th className="text-right px-4 py-3 w-24">{t("Action")}</th>
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
                            title={t("Tahrirlash")}
                          >
                            <svg className="icon icon-xs"><use href="#i-edit" /></svg>
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(lvl)}
                            className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                            title={t("O'chirish")}
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
                        {t("Daraja qo'shilmagan")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "hafta" && (
        <GroupDerivedTable
          heading="Hafta kunlari"
          columnLabel="Dars kunlari"
          loading={groupsLoading}
          rows={countBy(courseGroups, (g) => g.day)}
          courseName={course.name}
        />
      )}

      {activeTab === "vaqtlar" && (
        <GroupDerivedTable
          heading="Kurs vaqtlari"
          columnLabel="Dars vaqti"
          loading={groupsLoading}
          rows={countBy(courseGroups, (g) => g.time)}
          courseName={course.name}
        />
      )}

      {activeTab === "oqituvchilar" && (
        <GroupDerivedTable
          heading="O'qituvchilar"
          columnLabel="O'qituvchi"
          loading={groupsLoading}
          rows={countBy(courseGroups, (g) => g.teacher)}
          courseName={course.name}
        />
      )}

      {activeTab === "kitoblar" && (
        <CourseListTab
          kind="books"
          columnLabel="Kitob nomi"
          extraLabel="Muallif"
          emptyText={t("Kitob qo'shilmagan")}
          items={course.books ?? []}
          onAdd={(data) => addListItem(course.id, "books", data)}
          onDelete={(itemId) => deleteListItem(course.id, "books", itemId)}
        />
      )}

      {activeTab === "mavzular" && (
        <CourseListTab
          kind="topics"
          columnLabel="Mavzu"
          extraLabel="Izoh"
          emptyText={t("Mavzu qo'shilmagan")}
          items={course.topics ?? []}
          onAdd={(data) => addListItem(course.id, "topics", data)}
          onDelete={(itemId) => deleteListItem(course.id, "topics", itemId)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title={t("Darajani o'chirish")}
          message="Quyidagi darajani o'chirmoqchimisiz:"
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

/**
 * Guruhlardan hisoblanadigan tab (Hafta kunlari / Kurs vaqtlari /
 * O'qituvchilar). Qator bo'lmasa "guruh ochilmagan" deb ochiq aytiladi —
 * bu taxmin emas, tekshirilgan holat: shu kurs bo'yicha guruh yo'q.
 */
function GroupDerivedTable({
  heading,
  columnLabel,
  loading,
  rows,
  courseName,
}: {
  heading: string;
  columnLabel: string;
  loading: boolean;
  rows: { value: string; count: number }[];
  courseName: string;
}) {
  const { t } = useT();
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold">{heading}</span>
        <span className="text-[12px] text-muted-foreground">
          Manba: &laquo;{courseName}&raquo; kursi bo&apos;yicha guruhlar
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left px-4 py-3 w-16">№</th>
              <th className="text-left px-4 py-3">{columnLabel}</th>
              <th className="text-right px-4 py-3 w-32">{t("Guruhlar soni")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.value} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 text-[14px] font-medium">{r.value}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.count}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {loading ? <SpinnerBlock size={22} /> : "Bu kurs bo'yicha guruh ochilmagan"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** "Kitoblar"/"Mavzular" — kurs hujjatidagi ro'yxat ustidan oddiy CRUD. */
function CourseListTab({
  kind,
  columnLabel,
  extraLabel,
  emptyText,
  items,
  onAdd,
  onDelete,
}: {
  kind: CourseListKind;
  columnLabel: string;
  extraLabel: string;
  emptyText: string;
  items: CourseListItem[];
  onAdd: (data: { name: string; extra: string }) => Promise<boolean>;
  onDelete: (itemId: number) => Promise<boolean>;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);

  const inputCls =
    "h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError(`${columnLabel}ni kiriting`);
      return;
    }
    setBusy(true);
    const ok = await onAdd({ name: trimmed, extra: extra.trim() });
    setBusy(false);
    if (!ok) {
      showError(t("Saqlashda xatolik yuz berdi"));
      return;
    }
    setName("");
    setExtra("");
    showSuccess(t("Qo'shildi — {trimmed}", { trimmed }));
  }

  async function remove(item: CourseListItem) {
    const ok = await onDelete(item.id);
    if (ok) showSuccess(t("O'chirildi — {name}", { name: item.name }));
    else showError(t("O'chirishda xatolik yuz berdi"));
  }

  return (
    <>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex flex-col">
          <label className="text-[12px] text-muted-foreground mb-1">{columnLabel}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            type="text"
            placeholder={columnLabel}
            className={`${inputCls} w-64`}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[12px] text-muted-foreground mb-1">{extraLabel}</label>
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            type="text"
            placeholder={extraLabel}
            className={`${inputCls} w-56`}
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm disabled:opacity-60 disabled:pointer-events-none"
        >
          <svg className="icon icon-sm"><use href="#i-plus" /></svg>
          <span>{busy ? t("Saqlanmoqda…") : t("Qo'shish")}</span>
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-3 w-16">№</th>
                <th className="text-left px-4 py-3">{columnLabel}</th>
                <th className="text-left px-4 py-3 w-64">{extraLabel}</th>
                <th className="text-right px-4 py-3 w-24">{t("Action")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={`${kind}-${it.id}`} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 text-[14px] font-medium">{it.name}</td>
                  {/* Bo'sh qoldirilgan maydon — "—" (0 yoki o'ylab topilgan matn emas). */}
                  <td className="px-4 py-3 text-muted-foreground">{it.extra || "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => remove(it)}
                      className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 inline-flex items-center justify-center text-rose-500"
                      title={t("O'chirish")}
                    >
                      <svg className="icon icon-xs"><use href="#i-trash" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
