"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Info, MapPin, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import { invalidateBranches } from "@/hooks/useBranches";
import { useShell } from "@/components/v2/shell/ShellContext";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { formatLocalPhone } from "@/components/v2/form/fields";
import { isPathAllowed } from "@/lib/permissions";
import { branchAddressLine, branchHours, branchPhoneDigits, workDaysLabel, type ManagementBranch } from "@/lib/managementBranches";
import BranchDialogV2 from "./BranchDialogV2";

// YANGI VERSIYA — «SOZLAMALAR → FILIALLAR» (23-qism, rasmlar «Sozlamalar · Filiallar»,
// yorug'/qorong'i, 13.11.2026). Ma'lumot — /api/branches?stats=1 (filiallar + har
// birida tirik guruhlar va xonalar soni).
//
// Rasmdan farqlar (design/v2/SAVOLLAR.md):
//   • «Holat» — hammasi «Faol»: filialda arxiv holati hali yo'q. O'chirish faqat
//     BO'SH filialga (server 409 bilan to'sadi) — ma'lumoti bor filial o'chmaydi.
//   • «Guruh va xona» bosilsa — shu filialning Guruhlar / Xonalar ro'yxati. Ro'yxatlar
//     navbardagi filial bo'yicha, shuning uchun boshqa filialniki bosilsa avval filial
//     almashtiriladi (yon menyudagi tanlov bilan bir xil POST /api/branch).
//   • Ish vaqti kiritilmagan filialda sukut (Du–Sha · 08:00–22:00) xira yoziladi.

type Stats = Record<number, { groups: number; rooms: number }>;

export default function BranchesV2() {
  const { t } = useT();
  const router = useRouter();
  const { isAdmin, permissions } = useShell();
  const { branchId: currentId } = useBranch();
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<ManagementBranch[] | null>(null);
  const [stats, setStats] = useState<Stats>({});
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<{ branch: ManagementBranch | null } | null>(null);
  const [del, setDel] = useState<ManagementBranch | null>(null);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await fetch("/api/branches?stats=1").then((r) => r.json());
      if (!d?.ok) throw new Error(d?.error || "Yuklanmadi");
      setRows(d.branches);
      setStats(d.stats ?? {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yuklanmadi");
    }
  }, []);

  useEffect(() => {
    // Birinchi yuklash: holat effekt ichida emas, so'rov tugagach o'rnatiladi.
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const canGroups = isPathAllowed("/groups", permissions);
  const canRooms = isPathAllowed("/groups-rooms", permissions);

  /** Shu filialning ro'yxatini ochish: boshqa filial bo'lsa avval almashtiriladi. */
  async function openIn(branchId: number, href: string) {
    if (branchId === currentId) {
      router.push(href);
      return;
    }
    setSwitching(true);
    try {
      const d = await fetch("/api/branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId }),
      }).then((r) => r.json());
      if (!d?.ok) {
        showError(t(d?.error || "Filialni almashtirib bo'lmadi"));
        setSwitching(false);
        return;
      }
      window.location.assign(href);
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSwitching(false);
    }
  }

  async function confirmDelete(b: ManagementBranch) {
    setDel(null);
    try {
      const d = await fetch(`/api/branches/${b.id}`, { method: "DELETE" }).then((r) => r.json());
      if (!d?.ok) {
        showError(t(d?.error || "O'chirilmadi"));
        return;
      }
      invalidateBranches();
      setRows((p) => (p ?? []).filter((x) => x.id !== b.id));
      showSuccess(t("Filial o'chirildi"));
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    }
  }

  const nextId = (rows ?? []).reduce((m, b) => Math.max(m, b.id), 0) + 1;
  const th = "sticky top-0 z-[1] bg-v2-surface-2 px-4 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
  const countBtn =
    "rounded-v2-sm text-v2-small text-v2-text-2 underline-offset-2 transition-colors hover:text-v2-text hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none disabled:no-underline";

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[44rem]">
          <div className="text-v2-caption text-v2-text-2">{t("Umumiy")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Filiallar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("Har filialning manzili, telefoni va ish vaqti. Chek va filial tanlash ro'yxati shu yerdan olinadi. Filial qo'shish — faqat rahbarda.")}
          </p>
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setForm({ branch: null })} disabled={!rows} className={`${primaryBtn} disabled:opacity-60`}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Filial qo'shish")}
          </button>
        )}
      </div>

      {err ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
          <p className="text-v2-body text-v2-text-2">{t(err)}</p>
          <button type="button" onClick={() => void load()} className={`${secondaryBtn} mt-3`}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      ) : (
        <section className="relative overflow-x-auto rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr>
                <th className={th}>{t("Filial")}</th>
                <th className={th}>{t("Manzil va telefon")}</th>
                <th className={th}>{t("Ish vaqti")}</th>
                <th className={th}>{t("Guruh va xona")}</th>
                <th className={th}>{t("Holat")}</th>
                <th className={`${th} w-20`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!rows &&
                [0, 1, 2].map((i) => (
                  <tr key={i} className="border-t border-v2-border first:border-t-0">
                    {[0, 1, 2, 3, 4, 5].map((c) => (
                      <td key={c} className="px-4 py-4">
                        <div className="h-4 w-24 animate-pulse rounded-v2-sm bg-v2-skeleton" />
                      </td>
                    ))}
                  </tr>
                ))}
              {rows?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-v2-body text-v2-text-2">
                    {t("Filial topilmadi")}
                  </td>
                </tr>
              )}
              {rows?.map((b) => {
                const current = b.id === currentId;
                const h = branchHours(b);
                const s = stats[b.id] ?? { groups: 0, rooms: 0 };
                const addr = branchAddressLine(b);
                const phone = branchPhoneDigits(b.phone);
                const menu: ActionMenuEntry[] = [
                  { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setForm({ branch: b }) },
                  ...(isAdmin
                    ? [
                        { key: "div", divider: true as const },
                        {
                          key: "del",
                          label: t("O'chirish"),
                          icon: Trash2,
                          danger: true,
                          disabled: s.groups + s.rooms > 0,
                          title: s.groups + s.rooms > 0 ? t("Ma'lumoti bor filial o'chirilmaydi") : undefined,
                          onSelect: () => setDel(b),
                        },
                      ]
                    : []),
                ];
                return (
                  <tr key={b.id} className={`border-t border-v2-border first:border-t-0 ${ROW_TINT.hover}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md border text-v2-small font-semibold tabular-nums ${
                            current ? "border-v2-brand/30 bg-v2-brand-bg text-v2-brand-text" : "border-v2-border bg-v2-surface-2 text-v2-text"
                          }`}
                        >
                          {b.id}
                        </span>
                        <span className="min-w-0 truncate text-v2-body font-semibold text-v2-text">{b.name}</span>
                        {current && (
                          <span className="shrink-0 rounded-v2-sm bg-v2-brand-bg px-1.5 py-px text-v2-caption text-v2-brand-text">{t("joriy")}</span>
                        )}
                      </div>
                    </td>
                    <td className="min-w-[13rem] px-4 py-3.5">
                      <div className="flex items-start gap-1.5 text-v2-small text-v2-text">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                        <span className="min-w-0">
                          <span className={`block ${addr ? "" : "text-v2-text-3"}`}>{addr || t("Manzil kiritilmagan")}</span>
                          <span className="block whitespace-nowrap tabular-nums text-v2-text-2">{phone ? formatLocalPhone(phone) : "—"}</span>
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5" title={h.custom ? undefined : t("Ish vaqti kiritilmagan — sukut")}>
                      <span className={`block text-v2-small font-semibold ${h.custom ? "text-v2-text" : "text-v2-text-3"}`}>{t(workDaysLabel(h.days))}</span>
                      <span className={`block text-v2-small tabular-nums ${h.custom ? "text-v2-text-2" : "text-v2-text-3"}`}>
                        {h.from}–{h.to}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <button
                        type="button"
                        disabled={!canGroups || switching}
                        onClick={() => void openIn(b.id, "/groups")}
                        className={countBtn}
                        title={canGroups ? t("Shu filialning guruhlari") : undefined}
                      >
                        <b className="font-semibold text-v2-text tabular-nums">{s.groups}</b> {t("guruh")}
                      </button>
                      <span className="px-1 text-v2-text-3">·</span>
                      <button
                        type="button"
                        disabled={!canRooms || switching}
                        onClick={() => void openIn(b.id, "/groups-rooms")}
                        className={countBtn}
                        title={canRooms ? t("Shu filialning xonalari") : undefined}
                      >
                        <b className="font-semibold text-v2-text tabular-nums">{s.rooms}</b> {t("xona")}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-v2-small text-v2-text">
                        <span className="size-1.5 rounded-full bg-v2-success" aria-hidden />
                        {t("Faol")}
                      </span>
                    </td>
                    <td className="px-2 py-3.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => setForm({ branch: b })}
                          aria-label={t("Tahrirlash")}
                          title={t("Tahrirlash")}
                          className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:shadow-v2-focus focus-visible:outline-none"
                        >
                          <Pencil className="size-4" strokeWidth={1.75} />
                        </button>
                        <ActionMenu items={menu} label={t("Filial amallari")}>
                          {(trigger, open) => (
                            <button
                              type="button"
                              {...trigger}
                              aria-label={t("Yana")}
                              className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:shadow-v2-focus focus-visible:outline-none ${open ? "bg-v2-surface-2 text-v2-text" : ""}`}
                            >
                              <MoreHorizontal className="size-4" strokeWidth={1.75} />
                            </button>
                          )}
                        </ActionMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <div className="space-y-2 text-v2-caption text-v2-text-2">
        <p className="flex items-start gap-2">
          <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Ish vaqti — dars jadvali va xonalar bandligi shu oraliqda hisoblanadi. Ma'lumoti bor filial o'chirilmaydi — faqat xato qo'shilgan bo'sh filialni o'chirish mumkin.")}
        </p>
        <p className="flex items-start gap-2">
          <ArrowRight className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Guruh va xona soniga bosilsa, shu filialning Guruhlar va Xonalar ro'yxati ochiladi.")}
        </p>
      </div>

      {form && (
        <BranchDialogV2
          branch={form.branch}
          nextId={nextId}
          onClose={() => setForm(null)}
          onSaved={(saved, created) => {
            setRows((p) => (created ? [...(p ?? []), saved] : (p ?? []).map((x) => (x.id === saved.id ? saved : x))));
            if (created) setStats((p) => ({ ...p, [saved.id]: { groups: 0, rooms: 0 } }));
          }}
        />
      )}
      {del && (
        <V2Confirm
          title={t("«{name}» filialini o'chirasizmi?", { name: del.name })}
          body={t("Filial barcha filial tanlash ro'yxatlaridan chiqadi. Bu amalni ortga qaytarib bo'lmaydi.")}
          confirmLabel={t("O'chirish")}
          cancelLabel={t("Bekor qilish")}
          onCancel={() => setDel(null)}
          onConfirm={() => void confirmDelete(del)}
        />
      )}
    </div>
  );
}
