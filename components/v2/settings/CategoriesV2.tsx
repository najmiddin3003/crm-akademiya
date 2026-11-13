"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, Info, MoreHorizontal, Pencil, Plus, RefreshCw, Scale, Tags, Trash2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useBranch } from "@/components/shared/BranchContext";
import { useT } from "@/components/shared/Language";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import ActionMenu from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { buildCategoryCards, type CategoryCard, type CatCourse, type CatGroup, type PriceRow } from "@/lib/categoryPrices";
import { branchPool } from "@/lib/branchPools";
import { categoryBadgeCls, categoryDotCls } from "./courseBits";
import CategoryDialogV2 from "./CategoryDialogV2";
import PriceDialogV2, { money } from "./PriceDialogV2";

// YANGI VERSIYA — «SOZLAMALAR → O'QUV → KATEGORIYALAR» (24-qism, rasmlar «Sozlamalar ·
// Kategoriyalar · Yorug'/Qorong'i», «Narxni o'zgartirish», 13.11.2026).
//
//   • Kategoriya — kurslarning `category` maydoni (lib/courseCategories.ts); karta = kategoriya,
//     chiplari — uning kurslari. Qo'shish/tahrir/olib tashlash — kurslarni qayta guruhlaydi.
//   • «Narx darajasi» — kurs DARAJASI va uning NAVBARDAGI filialdagi oylik narxi; turli
//     kurslardagi bir xil nomli, bir xil narxli darajalar bitta qator (lib/categoryPrices.ts).
//     Narx qoidasi Qarzdorlar hisoboti bilan bitta (lib/coursePrice.ts).
//   • «Guruh» — shu filial (1+2 hovuzi bilan) tirik guruhlari, narxi shu qatordan kelganlari.
//   • Narxni o'zgartirish — faqat admin; tarix yo'qligi oynada ochiq aytiladi (SAVOLLAR 271).
//   • O'quvchi kartasidagi «Kategoriya» (`edu_categories`) — BOSHQA ro'yxat, eski
//     ko'rinishda qoldi (pastdagi havola, `?tab=` — sahifa eski versiyaga tushadi).

interface CategoriesData {
  ok: true;
  branchId: number;
  branchName: string;
  canEditPrice: boolean;
  courses: CatCourse[];
  groups: CatGroup[];
}

const TH = "px-2.5 py-2 text-left text-v2-caption font-medium text-v2-text-2 first:pl-4 last:pr-3";

function levelLabelOf(row: PriceRow, t: (s: string) => string): string {
  return row.level || t("Asosiy narx");
}

function sortRows(rows: PriceRow[]): PriceRow[] {
  return [...rows].sort(
    (a, b) =>
      (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER) ||
      a.level.localeCompare(b.level, "uz", { numeric: true, sensitivity: "base" }),
  );
}

function SkeletonCard({ rows }: { rows: number }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="h-4 w-32 rounded bg-v2-skeleton" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-6 w-20 rounded bg-v2-skeleton" />
        <div className="h-6 w-16 rounded bg-v2-skeleton" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mt-4 flex justify-between">
          <div className="h-3 w-40 rounded bg-v2-skeleton" />
          <div className="h-3 w-20 rounded bg-v2-skeleton" />
        </div>
      ))}
    </div>
  );
}

function CategoryCardView({
  card,
  canEditPrice,
  onEdit,
  onDelete,
  onPrice,
}: {
  card: CategoryCard;
  canEditPrice: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPrice: (row: PriceRow) => void;
}) {
  const { t } = useT();
  const named = Boolean(card.name);
  const multi = card.courses.length > 1;
  const rows = sortRows(card.rows);
  return (
    <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      {/* Sarlavha */}
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span className={`size-2 shrink-0 rounded-[3px] ${named ? categoryDotCls(card.name) : "bg-v2-text-3"}`} aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-v2-body font-semibold text-v2-text">{named ? card.name : t("Kategoriyasiz")}</h2>
        <span className="shrink-0 text-v2-caption text-v2-text-2">
          {t("{c} kurs · {g} guruh", { c: card.courses.length, g: card.groups })}
        </span>
        {named && (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label={t("Kategoriyani tahrirlash")}
              title={t("Kategoriyani tahrirlash")}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:shadow-v2-focus focus-visible:outline-none"
            >
              <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden />
            </button>
            <ActionMenu
              label={t("Kategoriya amallari")}
              items={[
                { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: onEdit },
                { key: "courses", label: t("Kurslar sahifasi"), icon: BookOpen, href: "/offline-courses" },
                { key: "d", divider: true },
                { key: "del", label: t("Olib tashlash"), icon: Trash2, danger: true, onSelect: onDelete },
              ]}
            >
              {(trigger) => (
                <button
                  type="button"
                  {...trigger}
                  aria-label={t("Kategoriya amallari")}
                  className="-mr-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:shadow-v2-focus focus-visible:outline-none"
                >
                  <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
                </button>
              )}
            </ActionMenu>
          </>
        )}
      </div>

      {/* Kurs chiplari */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3 pt-2.5">
        {card.courses.map((c) => (
          <span
            key={c.id}
            title={c.active ? undefined : t("Nofaol")}
            className={`inline-flex h-6 items-center rounded-v2-sm px-2 text-v2-caption font-medium ${named ? categoryBadgeCls(card.name) : "bg-v2-surface-2 text-v2-text-2"} ${c.active ? "" : "line-through opacity-60"}`}
          >
            {c.name}
          </span>
        ))}
      </div>

      {/* Narx darajalari */}
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[18rem] border-separate border-spacing-0 text-v2-body">
          <thead>
            <tr className="bg-v2-surface-2">
              <th className={`${TH} border-y border-v2-border`}>{t("Narx darajasi")}</th>
              <th className={`${TH} border-y border-v2-border text-right!`}>{t("Oylik narx")}</th>
              <th className={`${TH} w-12 border-y border-v2-border text-right!`}>{t("Guruh")}</th>
              <th className={`${TH} w-10 border-y border-v2-border`}>
                <span className="sr-only">{t("Amallar")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-v2-small text-v2-text-3">
                  {t("Kurslarda daraja ham, narx ham yo'q")}
                </td>
              </tr>
            )}
            {rows.map((row, i) => {
              const partial = multi && row.courses.length < card.courses.length;
              const td = `px-2.5 py-2.5 align-middle first:pl-4 last:pr-3 ${i > 0 ? "border-t border-v2-border" : ""}`;
              return (
                <tr key={row.key} className="transition-colors hover:bg-v2-surface-2/60">
                  <td className={td}>
                    <div className="text-v2-body text-v2-text">{levelLabelOf(row, t)}</div>
                    {partial && <div className="mt-0.5 text-v2-caption text-v2-text-3">{row.courses.map((c) => c.name).join(", ")}</div>}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {row.price === null ? (
                      <span className="text-v2-small font-medium text-v2-warning">{t("Kiritilmagan")}</span>
                    ) : (
                      <>
                        <span className="font-semibold tabular-nums text-v2-text">{money(row.price)}</span>
                        <span className="text-v2-small text-v2-text-3 max-[30rem]:hidden"> {t("so'm")}</span>
                      </>
                    )}
                  </td>
                  <td className={`${td} text-right tabular-nums ${row.groups ? "text-v2-text" : "text-v2-text-3"}`}>{row.groups}</td>
                  <td className={`${td} text-right`}>
                    <button
                      type="button"
                      onClick={() => onPrice(row)}
                      disabled={!canEditPrice}
                      aria-label={t("Narxni o'zgartirish")}
                      title={canEditPrice ? t("Narxni o'zgartirish") : t("Narxni faqat administrator o'zgartiradi")}
                      className="inline-flex size-7 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:shadow-v2-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {card.noPriceGroups.length > 0 && (
        <div className="flex items-start gap-2 border-t border-v2-border bg-v2-warning-bg px-4 py-2.5 text-v2-small text-v2-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
          <span>
            {t("{n} ta guruhning narxi topilmadi — Qarzdorlar hisobotida qarzi sanalmaydi.", { n: card.noPriceGroups.length })}{" "}
            <Link href="/offline-courses" className="font-semibold text-v2-brand-text underline-offset-2 hover:underline">
              {t("Kurslarda narx kiritish")}
            </Link>
          </span>
        </div>
      )}
    </section>
  );
}

export default function CategoriesV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { branchId: navBranch } = useBranch();
  const canDiscounts = useCanOpen("/reports-discounts");
  const [data, setData] = useState<CategoriesData | null>(null);
  const [err, setErr] = useState("");
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<{ name: string | null } | null>(null);
  const [pricing, setPricing] = useState<{ category: string; row: PriceRow } | null>(null);
  const [del, setDel] = useState<CategoryCard | null>(null);

  useEffect(() => {
    let off = false;
    fetch("/api/course-categories")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (off) return;
        if (!r.ok || !d.ok) {
          setErr(d.error || "Yuklanmadi");
          return;
        }
        setErr("");
        setData(d as CategoriesData);
      })
      .catch(() => {
        if (!off) setErr("Serverga ulanib bo'lmadi");
      });
    return () => {
      off = true;
    };
  }, [version, navBranch]);
  const reload = () => setVersion((v) => v + 1);

  const cards = data ? buildCategoryCards(data.courses, data.groups, data.branchId) : [];
  const named = cards.filter((c) => c.name);
  const totalGroups = cards.reduce((s, c) => s + c.groups, 0);
  const multiBranch = data ? branchPool(data.branchId).length > 1 : false;
  // Ikki ustun: har karta navbatdagi qisqaroq ustunga (taxminiy balandlik — qatorlar soni).
  const columns: CategoryCard[][] = [[], []];
  const heights = [0, 0];
  for (const card of cards) {
    const i = heights[0] <= heights[1] ? 0 : 1;
    columns[i].push(card);
    heights[i] += 4 + card.rows.length + (card.noPriceGroups.length ? 1 : 0) + Math.ceil(card.courses.length / 5);
  }
  const rulesCol = heights[0] <= heights[1] ? 0 : 1;

  async function doDelete(card: CategoryCard) {
    setDel(null);
    try {
      const res = await fetch(`/api/course-categories?name=${encodeURIComponent(card.name)}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        showError(t(d.error || "O'chirilmadi"));
        return;
      }
      showSuccess(t("«{name}» olib tashlandi — kurslari kategoriyasiz", { name: card.name }));
      reload();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    }
  }

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[36rem]">
          <div className="text-v2-caption text-v2-text-2">{t("O'quv")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Kategoriyalar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {data
              ? t("Kurslar {n} ta kategoriyada. Narxlar — {branch} filialiniki: guruh har oy kurs darajasining shu narxidan hisoblanadi.", {
                  n: named.length,
                  branch: data.branchName || t("joriy"),
                })
              : t("Kurslar kategoriyalari va oylik narxlari")}
          </p>
        </div>
        <button type="button" onClick={() => setEditing({ name: null })} disabled={!data} className={`${primaryBtn} disabled:opacity-60`}>
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {t("Kategoriya qo'shish")}
        </button>
      </div>

      {err ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
          <p className="text-v2-body text-v2-text-2">{t(err)}</p>
          <button type="button" onClick={reload} className={`${secondaryBtn} mt-3`}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      ) : (
        <>
          {/* 2. Kartalar — ikki ustun (sahifa kengligi yetsa), balandlik bo'yicha taqsimlanadi.
              CSS `columns` ishlatilmadi: Chromium ustun ichidagi aylanadigan jadvalni xira chizadi. */}
          <div className="@container">
            {!data ? (
              <div className="grid grid-cols-1 items-start gap-4 @[54rem]:grid-cols-2">
                <SkeletonCard rows={5} />
                <SkeletonCard rows={3} />
              </div>
            ) : cards.length === 0 ? (
              <div className="rounded-v2-lg border border-v2-border bg-v2-surface px-4 py-12 text-center shadow-v2-sm">
                <Tags className="mx-auto size-8 text-v2-text-3" strokeWidth={1.5} aria-hidden />
                <p className="mt-2 text-v2-body font-medium text-v2-text">{t("Hali kurs yo'q")}</p>
                <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Avval Kurslar sahifasida kurs qo'shing — keyin shu yerda kategoriyaga ajratasiz.")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 items-start gap-4 @[54rem]:grid-cols-2">
                {columns.map((col, ci) => (
                  <div key={ci} className="flex min-w-0 flex-col gap-4">
                    {col.map((card) => (
                      <CategoryCardView
                        key={card.name || "-"}
                        card={card}
                        canEditPrice={data.canEditPrice}
                        onEdit={() => setEditing({ name: card.name })}
                        onDelete={() => setDel(card)}
                        onPrice={(row) => setPricing({ category: card.name, row })}
                      />
                    ))}
                    {/* 3. Narx qoidalari — tizimda HAQIQATAN qanday ishlaydi (qisqa ustun oxirida) */}
                    {ci === rulesCol && (
                      <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                        <h2 className="flex items-center gap-2 text-v2-body font-semibold text-v2-text">
                          <Scale className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                          {t("Narx qoidalari")}
                        </h2>
                        <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-v2-small text-v2-text-2 marker:text-v2-text-3">
                          <li>{t("Guruh narxi — kurs darajasining shu filialdagi narxi; daraja narxi bo'lmasa — kursning asosiy narxi.")}</li>
                          {multiBranch && <li>{t("1+2 filiallarda narx bitta — biri o'zgarsa ikkalasiga yoziladi.")}</li>}
                          <li>{t("Narx o'zgarsa — barcha guruhlarga darhol. Narx tarixi yo'q: o'tgan oylar qarzi ham yangi narxdan sanaladi.")}</li>
                          <li>
                            {canDiscounts ? (
                              <>
                                {t("Chegirma narxdan keyin, o'quvchi kartasida qo'llanadi —")}{" "}
                                <Link href="/reports-discounts" className="font-semibold text-v2-brand-text underline-offset-2 hover:underline">
                                  {t("Chegirmalar")}
                                </Link>
                                .
                              </>
                            ) : (
                              t("Chegirma narxdan keyin, o'quvchi kartasida qo'llanadi.")
                            )}
                          </li>
                          {!data.canEditPrice && <li>{t("Narxni faqat administrator o'zgartiradi.")}</li>}
                        </ul>
                      </section>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Izoh */}
          {data && (
            <p className="flex items-start gap-1.5 text-v2-caption text-v2-text-2">
              <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span>
                {t("«Guruh» — shu narxdagi tirik guruhlar (yig'ilmoqda, faol, muzlatilgan), {branch} bo'yicha (jami {n}).", {
                  branch: data.branchName || t("joriy filial"),
                  n: totalGroups,
                })}{" "}
                {t("O'quvchi kartasidagi «Kategoriya» — boshqa ro'yxat:")}{" "}
                <Link href="/edu-category?tab=oquvchi" className="font-semibold text-v2-brand-text underline-offset-2 hover:underline">
                  {t("o'quvchi toifalari (eski ko'rinish)")}
                </Link>
              </span>
            </p>
          )}
        </>
      )}

      {editing && data && (
        <CategoryDialogV2
          current={editing.name}
          courses={data.courses}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            showSuccess(m);
            reload();
          }}
        />
      )}
      {pricing && data && (
        <PriceDialogV2
          category={pricing.category}
          row={pricing.row}
          levelLabel={levelLabelOf(pricing.row, t)}
          multiBranch={multiBranch}
          onClose={() => setPricing(null)}
          onSaved={(m) => {
            showSuccess(m);
            reload();
          }}
        />
      )}
      {del && (
        <V2Confirm
          title={t("«{name}» kategoriyasini olib tashlaysizmi?", { name: del.name })}
          body={t("{n} ta kurs kategoriyasiz qoladi. Kurslar, guruhlar va narxlar o'zgarmaydi.", { n: del.courses.length })}
          confirmLabel={t("Olib tashlash")}
          onCancel={() => setDel(null)}
          onConfirm={() => void doDelete(del)}
        />
      )}
    </div>
  );
}
