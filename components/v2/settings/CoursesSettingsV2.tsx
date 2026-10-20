"use client";

import { Fragment, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, Download, FileSpreadsheet, Info, Layers, MoreHorizontal, Pencil, Plus, Power, Search, Trash2, Upload, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { useBranches } from "@/hooks/useBranches";
import { collapseBranchPools } from "@/lib/branchPools";
import { DEFAULT_COURSE_CATEGORIES, courseIsActive, normalizeCourseCategory } from "@/lib/courseCategories";
import { useOfflineCourses, type CoursePatch, type CourseRenameInfo, type OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";
import { courseExportHeaders, coursesCsvBlob, coursesXlsBlob, dateStamp, downloadBlob, importCoursesCsv } from "@/components/offline-courses/coursesExport";
import V2Confirm from "@/components/v2/form/V2Confirm";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import { fieldCls } from "@/components/v2/form/fields";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { CategoryBadge, CourseStatus, categoryDotCls } from "./courseBits";

// YANGI VERSIYA — SOZLAMALAR → O'QUV → KURSLAR (rasm «Sozlamalar · Kurslar», yorug'/
// qorong'i, 20.10.2026; ramka — ./SettingsFrameV2.tsx):
//
//   1. «O'quv» / «Kurslar» + «Lid, o'quvchi va guruh qo'shishdagi har bir «Kursni
//      tanlang» ro'yxati shu yerdan olinadi.»; o'ngda «+ Kurs qo'shish» (va «⋯» —
//      Excel/CSV/import, eski sahifadagi);
//   2. «Kurs nomi» qidiruvi + kategoriya chiplari «✓ Barchasi · 13», «Chet tillari · 4» …;
//   3. jadval: Kurs nomi · Kategoriya (rangli belgi) · Holat («● Faol») · ✎ ⋯;
//      ✎ — QATORNING O'ZIDA tahrir (nom + kategoriya, «Bekor» / «Saqlash», ostida
//      «Nom o'zgarsa, shu kursdagi barcha guruh va o'quvchilarda ham yangilanadi.»);
//      oxirgi qator «+ Yangi kurs qo'shish» (uzuq chegara) — o'sha tahrir yangi kurs uchun;
//   4. izoh: darajalar va narxlar qayerda.
//
// Ma'lumot va so'rovlar — eski sahifa bilan bitta do'kon (OfflineCoursesProvider,
// app/(app)/offline-courses/layout.tsx). Kategoriya va holat — 20.10.2026 dagi yangi
// maydonlar (lib/courseCategories.ts); nom o'zgarsa guruh/lid/o'qituvchi/imtihon
// yozuvlari ham ko'chadi (lib/courseRename.ts). Darajalar, filial narxlari, kitob va
// mavzular — eski kurs sahifasida («⋯ → Darajalar va narxlar»). Taxminlar: SAVOLLAR 111–118.

type CatFilter = null | string; // null — Barchasi; "" — kategoriyasiz

interface EditState {
  id: number | "new";
  name: string;
  category: string;
  /** Tahrir boshlangandagi qiymatlar — o'zgarish bormi (tashlab ketishda so'raladi). */
  name0: string;
  category0: string;
}

const MOVED_LABEL: Record<string, string> = {
  "groups.course": "{n} ta guruh",
  "orders.course": "{n} ta lid",
  "hr_employees.kurs": "{n} ta o'qituvchi",
  "group_exams.course": "{n} ta sarhisob",
  "monthly_exams.subject": "{n} ta oylik imtihon natijasi",
};

const catKey = (s: string | undefined) => normalizeCourseCategory(s).toLowerCase();

export default function CoursesSettingsV2() {
  const { t } = useT();
  const { showSuccess, showError, showToast } = useToast();
  const { courses, loading, createCourse, patchCourse, removeCourse, reload } = useOfflineCourses();
  const { branches } = useBranches();
  const shownBranches = useMemo(() => collapseBranchPools(branches), [branches]);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<CatFilter>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  // Tahrirda yozib qo'shilgan, hali hech bir kursga saqlanmagan kategoriyalar.
  const [extraCats, setExtraCats] = useState<string[]>([]);
  // O'zgarish saqlanmagan tahrirni tashlab ketish so'rovi — tasdiqlansa shu amal bajariladi.
  const [discardThen, setDiscardThen] = useState<null | (() => void)>(null);
  const [deleteFor, setDeleteFor] = useState<OfflineCourse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---- Kategoriyalar: rasmdagi uchtasi, keyin kurslarda ishlatilganlar (alifbo bo'yicha) ---- */
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    const add = (raw: string | undefined) => {
      const n = normalizeCourseCategory(raw);
      if (n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
    };
    DEFAULT_COURSE_CATEGORIES.forEach(add);
    const rest = [...courses.map((c) => c.category ?? ""), ...extraCats]
      .map((x) => normalizeCourseCategory(x))
      .filter((x) => x && !seen.has(x.toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "uz"));
    rest.forEach(add);
    return [...seen.values()];
  }, [courses, extraCats]);
  const catOrder = useMemo(() => new Map(categories.map((c, i) => [c.toLowerCase(), i])), [categories]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of courses) m.set(catKey(c.category), (m.get(catKey(c.category)) ?? 0) + 1);
    return m;
  }, [courses]);
  const uncategorized = counts.get("") ?? 0;

  /* ---- Ro'yxat: qidiruv + chip, kategoriya tartibida, ichida alifbo bo'yicha ---- */
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses
      .filter((c) => (!q || c.name.toLowerCase().includes(q)) && (catFilter === null || catKey(c.category) === catKey(catFilter)))
      .sort((a, b) => {
        const oa = catKey(a.category) ? (catOrder.get(catKey(a.category)) ?? 999) : 1000;
        const ob = catKey(b.category) ? (catOrder.get(catKey(b.category)) ?? 999) : 1000;
        return oa - ob || a.name.localeCompare(b.name, "uz");
      });
  }, [courses, search, catFilter, catOrder]);

  const dirty = !!edit && (edit.name.trim() !== edit.name0.trim() || normalizeCourseCategory(edit.category) !== normalizeCourseCategory(edit.category0));

  /** Tahrir ochiq va o'zgargan bo'lsa — avval so'raydi, keyin `next`. */
  function guard(next: () => void) {
    if (dirty) setDiscardThen(() => next);
    else next();
  }

  function startEdit(c: OfflineCourse) {
    guard(() => {
      setNameError("");
      setEdit({ id: c.id, name: c.name, category: c.category ?? "", name0: c.name, category0: c.category ?? "" });
    });
  }
  function startNew() {
    guard(() => {
      setNameError("");
      // Kategoriya chipi tanlangan bo'lsa yangi kurs o'sha kategoriyada boshlanadi.
      const category = catFilter ?? "";
      setEdit({ id: "new", name: "", category, name0: "", category0: category });
    });
  }
  function cancel() {
    setEdit(null);
    setNameError("");
  }

  function renamedDetail(r: CourseRenameInfo | undefined): string | undefined {
    if (!r || r.total <= 0) return undefined;
    const parts = Object.entries(r.moved).map(([k, n]) => t(MOVED_LABEL[k] ?? "{n} ta yozuv", { n }));
    return t("Yangi nom yangilandi: {parts}", { parts: parts.join(", ") });
  }

  async function save() {
    if (!edit || saving) return;
    const name = edit.name.trim();
    const category = normalizeCourseCategory(edit.category);
    if (!name) {
      setNameError(t("Kurs nomini kiriting"));
      return;
    }
    if (courses.some((c) => c.id !== edit.id && c.name.trim().toLowerCase() === name.toLowerCase())) {
      setNameError(t("Bunday nomli kurs allaqachon bor"));
      return;
    }
    if (edit.id !== "new" && !dirty) {
      cancel();
      return;
    }
    setSaving(true);
    try {
      if (edit.id === "new") {
        const r = await createCourse({ name, category, active: true });
        if (!r.ok) {
          setNameError(t(r.error));
          return;
        }
        showToast({ tone: "success", title: t("Kurs qo'shildi"), detail: [name, category ? category : t("Kategoriyasiz")] });
      } else {
        const c = courses.find((x) => x.id === edit.id);
        const patch: CoursePatch = {};
        if (!c || name !== c.name) patch.name = name;
        if (!c || category !== normalizeCourseCategory(c.category)) patch.category = category;
        const r = await patchCourse(edit.id, patch);
        if (!r.ok) {
          setNameError(t(r.error));
          return;
        }
        showToast({ tone: "success", title: t("Kurs saqlandi"), detail: renamedDetail(r.renamed) ?? name });
      }
      setEdit(null);
      setNameError("");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: OfflineCourse) {
    const next = !courseIsActive(c);
    const r = await patchCourse(c.id, { active: next });
    if (!r.ok) {
      showError(t(r.error));
      return;
    }
    showToast({
      tone: "success",
      title: next ? t("«{name}» faollashtirildi", { name: c.name }) : t("«{name}» nofaol qilindi", { name: c.name }),
      detail: next ? t("Yangi lid, guruh va xodim oynalarida yana tanlanadi.") : t("Yangi lid, guruh va xodim oynalarida tanlanmaydi — mavjud guruh va lidlarda qoladi."),
    });
  }

  async function confirmDelete() {
    if (!deleteFor || deleting) return;
    setDeleting(true);
    const c = deleteFor;
    const r = await removeCourse(c.id);
    setDeleting(false);
    setDeleteFor(null);
    if (r.ok) {
      if (edit?.id === c.id) cancel();
      showSuccess(t("Kurs o'chirildi — {name}", { name: c.name }));
    } else if (r.groups) {
      showError(t("Bu kurs {n} ta guruhda — o'chirib bo'lmaydi. Uni nofaol qiling.", { n: r.groups }));
    } else {
      showError(t(r.error));
    }
  }

  /* ---- Eksport / import (eski sahifadagi — ./coursesExport.ts) ---- */
  const headers = useMemo(() => courseExportHeaders(shownBranches), [shownBranches]);
  const branchIds = useMemo(() => shownBranches.map((b) => b.id), [shownBranches]);
  function exportFile(kind: "csv" | "xls") {
    const blob = kind === "csv" ? coursesCsvBlob(rows, headers, branchIds) : coursesXlsBlob(rows, headers, branchIds);
    downloadBlob(blob, `oflayn_kurslar_${dateStamp()}.${kind}`);
    showSuccess(t(kind === "csv" ? "CSV yuklab olindi — {filtered} ta yozuv" : "Excel yuklab olindi — {filtered} ta yozuv", { filtered: rows.length }));
  }
  async function importCsv(file: File) {
    setImporting(true);
    try {
      const r = await importCoursesCsv(file);
      if (!r.ok) {
        showError(t(r.error));
        return;
      }
      await reload();
      showSuccess(
        r.skipped > 0
          ? t("{created} ta kurs qo'shildi, {skipped} tasi o'tkazib yuborildi", { created: r.created, skipped: r.skipped })
          : t("{created} ta kurs qo'shildi", { created: r.created }),
      );
    } catch {
      showError(t("Faylni o'qib bo'lmadi"));
    } finally {
      setImporting(false);
    }
  }
  const pageMenu: ActionMenuEntry[] = [
    { key: "xls", label: t("Excel yuklab olish"), icon: FileSpreadsheet, hint: "XLS", onSelect: () => exportFile("xls") },
    { key: "csv", label: t("CSV yuklab olish"), icon: Download, hint: "CSV", onSelect: () => exportFile("csv") },
    { key: "d", divider: true },
    { key: "imp", label: importing ? t("Import qilinmoqda…") : t("CSV'dan import"), icon: Upload, disabled: importing, onSelect: () => fileRef.current?.click() },
  ];

  function rowMenu(c: OfflineCourse): ActionMenuEntry[] {
    const active = courseIsActive(c);
    return [
      { key: "h", heading: c.name },
      { key: "levels", label: t("Darajalar va narxlar"), icon: Layers, href: `/offline-courses/${c.id}` },
      { key: "edit", label: t("Rang va filial narxlari"), icon: Pencil, href: `/offline-courses/${c.id}/edit` },
      { key: "d", divider: true },
      { key: "active", label: active ? t("Nofaol qilish") : t("Faollashtirish"), icon: Power, onSelect: () => void toggleActive(c) },
      { key: "del", label: t("O'chirish"), icon: Trash2, danger: true, onSelect: () => setDeleteFor(c) },
    ];
  }

  /* ---- Kategoriya tanlovi (tahrir qatori) ---- */
  const catOptions: PickerOption[] = categories.map((c) => ({
    value: c,
    label: c,
    lead: <span className={`size-2 rounded-full ${categoryDotCls(c)}`} aria-hidden />,
    hint: counts.get(c.toLowerCase()) ? t("{n} ta kurs", { n: counts.get(c.toLowerCase()) ?? 0 }) : undefined,
  }));

  function onEditKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  const chip = (key: string, label: string, n: number, on: boolean, onClick: () => void): ReactNode => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-full border px-3 text-v2-small transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
        on ? "border-v2-brand bg-v2-brand-bg font-semibold text-v2-brand-text" : "border-v2-border-strong bg-v2-surface font-medium text-v2-text hover:bg-v2-surface-2"
      }`}
    >
      {on && <Check className="size-3.5" strokeWidth={2.25} aria-hidden />}
      {label}
      <span className={on ? "font-normal opacity-80" : "font-normal text-v2-text-3"}>· {n}</span>
    </button>
  );

  const th = "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

  const editRow = (key: string, isNew: boolean) =>
    edit && (
      <Fragment key={key}>
        <tr className={ROW_TINT.brand}>
          <td className="pb-2 pl-3 pr-3 pt-3 align-top">
            <input
              autoFocus
              value={edit.name}
              onChange={(e) => {
                setEdit({ ...edit, name: e.target.value });
                setNameError("");
              }}
              onKeyDown={onEditKey}
              onFocus={(e) => e.currentTarget.select()}
              placeholder={t("Kurs nomi")}
              aria-label={t("Kurs nomi")}
              aria-invalid={!!nameError}
              maxLength={80}
              className={fieldCls(nameError ? "error" : "default", "font-medium", "sm")}
            />
          </td>
          <td className="px-3 pb-2 pt-3 align-top">
            <div className="max-w-[240px]">
              <V2Picker
                size="sm"
                value={edit.category}
                onChange={(v) => setEdit({ ...edit, category: v })}
                options={catOptions}
                label={t("Kategoriya")}
                placeholder={t("Kategoriyasiz")}
                clearable
                searchable
                searchPlaceholder={t("Kategoriyani qidirish")}
                renderValue={(o) => <CategoryBadge name={o.value} />}
                footer={(close) => (
                  <NewCategoryForm
                    onAdd={(name) => {
                      setExtraCats((p) => (p.some((x) => x.toLowerCase() === name.toLowerCase()) ? p : [...p, name]));
                      setEdit({ ...edit, category: categories.find((c) => c.toLowerCase() === name.toLowerCase()) ?? name });
                      close();
                    }}
                  />
                )}
              />
            </div>
          </td>
          <td colSpan={2} className="pb-2 pl-3 pr-3 pt-3 align-top">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className="inline-flex h-9 items-center rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 text-v2-small font-medium text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus"
              >
                {t("Bekor")}
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex h-9 items-center rounded-v2-md bg-v2-brand px-3.5 text-v2-small font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus disabled:opacity-60"
              >
                {saving ? t("Saqlanmoqda...") : isNew ? t("Qo'shish") : t("Saqlash")}
              </button>
            </div>
          </td>
        </tr>
        <tr className={`border-b border-v2-border ${ROW_TINT.brand}`}>
          <td colSpan={4} className="pb-3 pl-3 pr-3">
            {nameError ? (
              <p role="alert" className="text-v2-caption font-medium text-v2-danger">
                {nameError}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-v2-caption text-v2-text-2">
                <Info className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                {isNew
                  ? t("Kurs saqlangach lid, o'quvchi va guruh qo'shishdagi «Kursni tanlang» ro'yxatida chiqadi.")
                  : t("Nom o'zgarsa, shu kursdagi barcha guruh va o'quvchilarda ham yangilanadi.")}
              </p>
            )}
          </td>
        </tr>
      </Fragment>
    );

  return (
    // Kompyuterda sahifa ramka balandligida, jadval o'zi aylanadi (sarlavha qotadi) — pastdagi
    // «+ Yangi kurs qo'shish» va izoh doim ko'rinadi (Guruhlar/O'quvchilar ro'yxatidagi qolip).
    <div className="flex min-h-full flex-col gap-4 p-4 sm:p-6 lg:h-full lg:min-h-0 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-v2-caption text-v2-text-2">{t("O'quv")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Kurslar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Lid, o'quvchi va guruh qo'shishdagi har bir «Kursni tanlang» ro'yxati shu yerdan olinadi.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Bir xil faylni ketma-ket ikki marta tanlash mumkin bo'lsin.
              e.target.value = "";
              if (f) void importCsv(f);
            }}
          />
          <ActionMenu items={pageMenu} label={t("Eksport va import")} width={240}>
            {(trigger) => (
              <button type="button" {...trigger} title={t("Eksport va import")} aria-label={t("Eksport va import")} className={secondaryIcon}>
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </ActionMenu>
          <button type="button" onClick={startNew} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Kurs qo'shish")}
          </button>
        </div>
      </div>

      {/* 2. Qidiruv va kategoriya chiplari */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Kurs nomi")}
            aria-label={t("Kurs nomi bo'yicha qidirish")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
        <div className="flex max-w-full items-center gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label={t("Kategoriya")}>
          {chip("all", t("Barchasi"), courses.length, catFilter === null, () => setCatFilter(null))}
          {categories
            .filter((c) => (counts.get(c.toLowerCase()) ?? 0) > 0)
            .map((c) => chip(c, c, counts.get(c.toLowerCase()) ?? 0, catFilter !== null && catKey(catFilter) === c.toLowerCase(), () => setCatFilter(c)))}
          {uncategorized > 0 && chip("none", t("Kategoriyasiz"), uncategorized, catFilter === "", () => setCatFilter(""))}
        </div>
      </div>

      {/* 3. Jadval */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
        <div className="max-h-[70vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-v2-body">
            <colgroup>
              <col />
              <col className="w-[34%]" />
              <col className="w-[110px]" />
              <col className="w-[92px]" />
            </colgroup>
            <thead>
              <tr>
                <th className={`${th} pl-4 pr-3`}>{t("Kurs nomi")}</th>
                <th className={`${th} px-3`}>{t("Kategoriya")}</th>
                <th className={`${th} px-3`}>{t("Holat")}</th>
                <th className={`${th} pr-3`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-[52px] border-b border-v2-border" aria-hidden>
                    <td className="pl-4 pr-3">
                      <div className="h-3 w-32 rounded bg-v2-skeleton" />
                    </td>
                    <td className="px-3">
                      <div className="h-5 w-24 rounded bg-v2-skeleton" />
                    </td>
                    <td className="px-3">
                      <div className="h-3 w-12 rounded bg-v2-skeleton" />
                    </td>
                    <td />
                  </tr>
                ))}

              {!loading && rows.length === 0 && edit?.id !== "new" && (
                <tr>
                  <td colSpan={4} className="p-6">
                    <div className="flex flex-col items-center gap-2 rounded-v2-lg bg-v2-surface-2 px-6 py-10 text-center">
                      {courses.length === 0 ? (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Hozircha kurs yo'q")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Birinchi kursni qo'shing — u lid, o'quvchi va guruh oynalaridagi ro'yxatda chiqadi.")}</p>
                        </>
                      ) : (
                        <>
                          <div className="text-v2-section text-v2-text">{t("Mos kurs topilmadi")}</div>
                          <p className="text-v2-small text-v2-text-2">{t("Qidiruv yoki kategoriyani o'zgartirib ko'ring.")}</p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((c) =>
                  edit && edit.id === c.id ? (
                    editRow(`e${c.id}`, false)
                  ) : (
                    <tr key={c.id} className={`group h-[52px] border-b border-v2-border transition-colors ${ROW_TINT.hover}`}>
                      <td className="pl-4 pr-3">
                        <Link
                          href={`/offline-courses/${c.id}`}
                          title={t("Darajalar va narxlar")}
                          className={`block truncate font-semibold underline-offset-2 hover:text-v2-brand-text hover:underline ${courseIsActive(c) ? "text-v2-text" : "text-v2-text-2"}`}
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3">
                        <CategoryBadge name={c.category} />
                      </td>
                      <td className="px-3">
                        <CourseStatus active={courseIsActive(c)} />
                      </td>
                      <td className="pr-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            title={t("Tahrirlash")}
                            aria-label={t("{name} — tahrirlash", { name: c.name })}
                            className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-3 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
                          >
                            <Pencil className="size-4" strokeWidth={1.75} />
                          </button>
                          <ActionMenu items={rowMenu(c)} label={t("{name} — amallar", { name: c.name })} width={230}>
                            {(trigger, open) => (
                              <button
                                type="button"
                                {...trigger}
                                title={t("Amallar")}
                                aria-label={t("{name} — amallar", { name: c.name })}
                                className={`inline-flex size-8 items-center justify-center rounded-v2-md transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus ${open ? "bg-v2-surface-2 text-v2-text" : "text-v2-text-3"}`}
                              >
                                <MoreHorizontal className="size-4" strokeWidth={1.75} />
                              </button>
                            )}
                          </ActionMenu>
                        </div>
                      </td>
                    </tr>
                  ),
                )}

              {!loading && edit?.id === "new" && editRow("new", true)}
            </tbody>
          </table>
        </div>
        {!loading && edit?.id !== "new" && (
          <div className="shrink-0 p-2">
            <button
              type="button"
              onClick={startNew}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-v2-md border border-dashed border-v2-border-strong text-v2-small font-medium text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("Yangi kurs qo'shish")}
            </button>
          </div>
        )}
      </div>

      {/* 4. Izoh */}
      <p className="flex shrink-0 items-start gap-1.5 text-v2-caption text-v2-text-3">
        <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span>
          {t("Darajalar, filial narxlari, kitob va mavzular — qatordagi «⋯ → Darajalar va narxlar» da. O'quvchilarning narx toifalari —")}{" "}
          <Link href="/edu-category" className="font-medium text-v2-brand-text underline-offset-2 hover:underline">
            {t("Kategoriyalar")}
          </Link>{" "}
          {t("bo'limida.")}
        </span>
      </p>

      {discardThen && (
        <V2Confirm
          title={t("O'zgarishlar saqlanmagan")}
          body={t("Tahrirdagi kurs o'zgarishlari yo'qoladi. Davom etilsinmi?")}
          confirmLabel={t("Tashlab ketish")}
          cancelLabel={t("Tahrirga qaytish")}
          tone="danger"
          onConfirm={() => {
            const next = discardThen;
            setDiscardThen(null);
            setEdit(null);
            setNameError("");
            next();
          }}
          onCancel={() => setDiscardThen(null)}
        />
      )}
      {deleteFor && (
        <V2Confirm
          title={t("Kursni o'chirish")}
          body={
            <>
              {t("«{name}» kursi o'chiriladi.", { name: deleteFor.name })} {t("Guruhda ishlatilgan kursni o'chirib bo'lmaydi — uni «Nofaol» qiling: yangi tanlovlardan chiqadi, guruhlarda qoladi.")}
            </>
          }
          confirmLabel={deleting ? t("O'chirilmoqda...") : t("O'chirish")}
          tone="danger"
          icon={Trash2}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteFor(null)}
        />
      )}
    </div>
  );
}

/** Kategoriya tanlovi ostidagi «+ Yangi kategoriya» — nomini yozib qo'shish. */
function NewCategoryForm({ onAdd }: { onAdd: (name: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const name = normalizeCourseCategory(value);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-7 items-center gap-1.5 rounded-v2-md px-1.5 font-medium text-v2-brand-text hover:bg-v2-brand-bg">
        <Plus className="size-3.5" strokeWidth={2} aria-hidden />
        {t("Yangi kategoriya")}
      </button>
    );
  }
  return (
    <form
      className="flex w-full items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (name) onAdd(name);
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Enter shu formada qolsin — qatordagi tahrirni saqlab yubormasin.
          if (e.key === "Enter") e.stopPropagation();
          if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        maxLength={40}
        placeholder={t("Kategoriya nomi")}
        aria-label={t("Kategoriya nomi")}
        className="h-8 min-w-0 flex-1 rounded-v2-md border border-v2-border-field bg-v2-surface! px-2 text-v2-small text-v2-text placeholder:text-v2-text-3 focus:border-v2-brand focus:outline-none"
      />
      <button type="submit" disabled={!name} className="inline-flex h-8 items-center rounded-v2-md bg-v2-brand px-2.5 font-semibold text-v2-on-brand disabled:opacity-50">
        {t("Qo'shish")}
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label={t("Yopish")} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-text">
        <X className="size-4" strokeWidth={1.75} />
      </button>
    </form>
  );
}
