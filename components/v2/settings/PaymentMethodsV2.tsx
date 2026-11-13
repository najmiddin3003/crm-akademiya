"use client";

import { useEffect, useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, Ban, CheckCircle2, CreditCard, GripVertical, Info, Loader2, Lock, MoreHorizontal, Pencil, Plus, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { methodDot } from "@/components/v2/form/fields";
import { fmtNum } from "@/components/v2/reports/reportFormat";
import { useShell } from "@/components/v2/shell/ShellContext";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import { invalidateSharedList } from "@/hooks/useSharedList";
import type { Cashbox, CashboxName } from "@/lib/cashboxes";
import type { PaymentMethod } from "@/lib/paymentMethods";
import { cashboxCoverage, isLockedMethod, moveItem, PINNED_METHOD_KEY, USAGE_DAYS, type MethodUsage } from "@/lib/paymentMethodUsage";
import PaymentMethodDialogV2 from "./PaymentMethodDialogV2";

// YANGI VERSIYA — «SOZLAMALAR → MOLIYA → TO'LOV TURLARI» (24-qism, rasmlar «Sozlamalar · To'lov
// turlari · Yorug'/Qorong'i», 13.11.2026). Eski sahifa (?tab=payment-methods, eski versiyada)
// o'zgarmagan.
//
//   • Tartib — qatorni sudrab (yoki ⋯ → Yuqoriga/Pastga): PUT /api/payment-methods, `order`
//     maydoni. To'lov oynasi, kassa amallari, hisobotlar va bot shu tartibda ko'rsatadi
//     (hooks/usePaymentMethods.ts, lib/paymentMethods.ts). «Naqd» doim birinchi (oylik oynasi
//     sukut bo'yicha birinchi turni oladi — components/finance/usePayroll.ts).
//   • «Qabul qiladigan kassalar» — SOZLAMA EMAS: oxirgi USAGE_DAYS kunda shu tur bilan tushum
//     yozilgan kassalar (GET /api/payment-methods → usage). Kassaga turni cheklash tizimda yo'q.
//   • Tur o'chirilmaydi — «Nofaol» qilinadi. «Naqd», «Plastik» — tizim turi, nofaol bo'lmaydi.
//   • Rang — tur kalitidan (methodDot), tanlanmaydi.
//   • «Kassa kartasida» — bosh kassaning hozirgi qoldig'i turlar bo'yicha; pul bo'lgani uchun
//     faqat administratorga (GET /api/cashboxes boshqaga faqat o'z kassasini beradi).

const TH = "sticky top-0 z-[1] bg-v2-surface-2 px-4 py-2.5 text-left text-v2-caption font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
const TD = "border-t border-v2-border px-4 py-3 align-middle";
const ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";

interface Loaded {
  methods: PaymentMethod[];
  usage: MethodUsage;
  names: CashboxName[];
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <tr key={i}>
          <td className={`${TD} w-10`} />
          <td className={TD}>
            <div className="flex items-center gap-3">
              <div className="size-4 rounded bg-v2-skeleton" />
              <div className="h-3 w-24 rounded bg-v2-skeleton" />
            </div>
          </td>
          <td className={TD}>
            <div className="h-3 w-16 rounded bg-v2-skeleton" />
            <div className="mt-1.5 h-2.5 w-40 rounded bg-v2-skeleton" />
          </td>
          <td className={TD}>
            <div className="h-3 w-12 rounded bg-v2-skeleton" />
          </td>
          <td className={TD} />
        </tr>
      ))}
    </>
  );
}

export default function PaymentMethodsV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { isAdmin } = useShell();
  const [data, setData] = useState<Loaded | null>(null);
  const [primary, setPrimary] = useState<Cashbox | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<{ method: PaymentMethod | null } | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);

  useEffect(() => {
    let off = false;
    fetch("/api/payment-methods")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (off) return;
        if (!r.ok || !d.ok) return setErr(d.error || "Yuklanmadi");
        setErr("");
        setData({ methods: d.methods as PaymentMethod[], usage: (d.usage ?? {}) as MethodUsage, names: (d.cashboxes ?? []) as CashboxName[] });
      })
      .catch(() => {
        if (!off) setErr("Serverga ulanib bo'lmadi");
      });
    return () => {
      off = true;
    };
  }, [version]);

  // Bosh kassa qoldig'i turlar bo'yicha — faqat administratorga (pul).
  useEffect(() => {
    if (!isAdmin) return;
    let off = false;
    fetch("/api/cashboxes")
      .then((r) => r.json())
      .then((d) => {
        if (!off) setPrimary(d?.ok ? ((d.cashboxes as Cashbox[]).find((c) => c.isPrimary) ?? null) : null);
      })
      .catch(() => {
        if (!off) setPrimary(null);
      });
    return () => {
      off = true;
    };
  }, [isAdmin, version]);

  const reload = () => setVersion((v) => v + 1);
  const methods = data?.methods ?? [];
  const pinnedFirst = methods[0]?.key === PINNED_METHOD_KEY;
  const minIndex = pinnedFirst ? 1 : 0;
  const nameOf = new Map((data?.names ?? []).map((c) => [c.id, c]));
  const activeIds = (data?.names ?? []).filter((c) => !c.archived).map((c) => c.id);
  const activeMethods = methods.filter((m) => m.active !== false);

  async function saveOrder(next: PaymentMethod[]) {
    if (!data) return;
    const prev = data.methods;
    setData({ ...data, methods: next });
    setSavingOrder(true);
    try {
      const res = await fetch("/api/payment-methods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((m) => m.id) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setData((cur) => (cur ? { ...cur, methods: prev } : cur));
        showError(t(d.error || "Tartib saqlanmadi"));
        if (res.status === 409) reload();
        return;
      }
      setData((cur) => (cur ? { ...cur, methods: d.methods as PaymentMethod[] } : cur));
      invalidateSharedList("shared:payment-methods");
      showSuccess(t("Tartib saqlandi"));
    } catch {
      setData((cur) => (cur ? { ...cur, methods: prev } : cur));
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSavingOrder(false);
    }
  }

  function move(from: number, to: number) {
    const target = Math.max(minIndex, Math.min(to, methods.length - 1));
    if (from < minIndex || target === from || savingOrder) return;
    void saveOrder(moveItem(methods, from, target));
  }

  async function setActive(m: PaymentMethod, active: boolean) {
    setBusyId(m.id);
    try {
      const res = await fetch(`/api/settings-lists/${m.id}?kind=payment-methods`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        showError(t(d.error || "Saqlanmadi"));
        return;
      }
      invalidateSharedList("shared:payment-methods");
      showSuccess(active ? t("«{name}» faol qilindi", { name: t(m.name) }) : t("«{name}» nofaol qilindi", { name: t(m.name) }));
      reload();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setBusyId(null);
    }
  }

  function menu(m: PaymentMethod, i: number): ActionMenuEntry[] {
    const locked = isLockedMethod(m.key);
    const pinned = m.key === PINNED_METHOD_KEY && i === 0;
    const items: ActionMenuEntry[] = [{ key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setDialog({ method: m }) }];
    if (!pinned) {
      items.push({ key: "up", label: t("Yuqoriga"), icon: ArrowUp, disabled: i <= minIndex || savingOrder, onSelect: () => move(i, i - 1) });
      items.push({ key: "down", label: t("Pastga"), icon: ArrowDown, disabled: i >= methods.length - 1 || savingOrder, onSelect: () => move(i, i + 1) });
    }
    items.push({ key: "div", divider: true });
    if (m.active === false) items.push({ key: "on", label: t("Faol qilish"), icon: CheckCircle2, onSelect: () => void setActive(m, true) });
    else
      items.push({
        key: "off",
        label: t("Nofaol qilish"),
        icon: Ban,
        danger: !locked,
        disabled: locked,
        title: locked ? t("Tizim turi — nofaol qilinmaydi") : undefined,
        onSelect: () => void setActive(m, false),
      });
    return items;
  }

  // ── Sudrash (faqat ushlagichdan; «Naqd» joyida qoladi) ──
  function onDragStart(e: DragEvent<HTMLElement>, i: number) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(methods[i]?.id ?? ""));
    const row = e.currentTarget.closest("tr");
    if (row) e.dataTransfer.setDragImage(row, 24, 20);
    setDrag({ from: i, over: i });
  }
  function onDragOver(e: DragEvent<HTMLTableRowElement>, i: number) {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const over = Math.max(minIndex, i);
    if (over !== drag.over) setDrag({ ...drag, over });
  }
  function onDrop(e: DragEvent<HTMLTableRowElement>) {
    e.preventDefault();
    if (drag) move(drag.from, drag.over);
    setDrag(null);
  }

  // «Kassa kartasida» — bosh kassa qoldig'i, ro'yxat tartibida, faqat puli borlari.
  const cardRows = primary ? methods.map((m) => ({ m, val: Number(primary.methodTotals?.[m.key]) || 0 })).filter((r) => r.val > 0) : [];
  const cardTotal = cardRows.reduce((s, r) => s + r.val, 0);

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[36rem]">
          <div className="text-v2-caption text-v2-text-2">{t("Moliya")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("To'lov turlari")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("To'lov qabul qilish va kassa amallaridagi turlar. Tartib — to'lov oynasi, kassa kartalari va hisobotlarda shunday chiqadi.")}
          </p>
        </div>
        <button type="button" onClick={() => setDialog({ method: null })} disabled={!data} className={`${primaryBtn} disabled:opacity-60`}>
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {t("To'lov turi qo'shish")}
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
          <div className="flex flex-col gap-4">
            {/* 2. Jadval */}
            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[680px] border-separate border-spacing-0 text-v2-body">
                  <thead>
                    <tr>
                      <th className={`${TH} w-10`}>
                        <span className="sr-only">{t("Tartib")}</span>
                      </th>
                      <th className={TH}>{t("To'lov turi")}</th>
                      <th className={TH}>
                        {t("Qabul qilgan kassalar")} <span className="font-normal text-v2-text-3">· {t("{n} kun", { n: USAGE_DAYS })}</span>
                      </th>
                      <th className={TH}>{t("Holat")}</th>
                      <th className={`${TH} w-20`}>
                        <span className="sr-only">{t("Amallar")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!data && <SkeletonRows />}
                    {data && methods.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <CreditCard className="mx-auto size-8 text-v2-text-3" strokeWidth={1.5} aria-hidden />
                          <p className="mt-2 text-v2-body font-medium text-v2-text">{t("To'lov turlari yo'q")}</p>
                        </td>
                      </tr>
                    )}
                    {methods.map((m, i) => {
                      const pinned = m.key === PINNED_METHOD_KEY && i === 0;
                      const locked = isLockedMethod(m.key);
                      const off = m.active === false;
                      const cov = data ? cashboxCoverage(data.usage, m.key, activeIds) : { ids: [], all: false };
                      const names = cov.ids.map((id) => {
                        const c = nameOf.get(id);
                        return c ? (c.archived ? `${c.name} (${t("arxiv")})` : c.name) : `#${id}`;
                      });
                      const isOver = drag !== null && drag.over === i && drag.from !== i;
                      const line = isOver ? (drag.from < i ? "shadow-[inset_0_-2px_0_var(--v2-brand)]" : "shadow-[inset_0_2px_0_var(--v2-brand)]") : "";
                      return (
                        <tr
                          key={m.id}
                          onDragOver={(e) => onDragOver(e, i)}
                          onDrop={onDrop}
                          className={`${drag?.from === i ? "opacity-50" : ""} ${line || ROW_TINT.hover}`}
                        >
                          <td className={`${TD} w-10 pr-0`}>
                            {pinned ? (
                              <span className="inline-flex size-6 items-center justify-center text-v2-text-3" title={t("Naqd doim birinchi")}>
                                <Lock className="size-3.5" strokeWidth={1.75} aria-hidden />
                              </span>
                            ) : (
                              <span
                                draggable={!savingOrder}
                                onDragStart={(e) => onDragStart(e, i)}
                                onDragEnd={() => setDrag(null)}
                                title={t("Sudrab tartibni o'zgartiring")}
                                className="inline-flex size-6 cursor-grab items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-text-2 active:cursor-grabbing"
                              >
                                <GripVertical className="size-4" strokeWidth={1.75} aria-hidden />
                              </span>
                            )}
                          </td>
                          <td className={TD}>
                            <div className="flex items-center gap-2.5">
                              <span className={`size-3.5 shrink-0 rounded-[4px] ${methodDot(m.key)} ${off ? "opacity-40" : ""}`} aria-hidden />
                              <span className={`font-semibold ${off ? "text-v2-text-2" : "text-v2-text"}`}>{t(m.name)}</span>
                              {locked && (
                                <span className="inline-flex items-center gap-1 rounded-v2-sm bg-v2-surface-2 px-1.5 py-0.5 text-v2-caption text-v2-text-2">
                                  <Lock className="size-3" strokeWidth={2} aria-hidden />
                                  {t("tizim turi")}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={TD}>
                            {cov.ids.length === 0 ? (
                              <div>
                                <div className="text-v2-text-3">—</div>
                                <div className="text-v2-caption text-v2-text-3">{t("{n} kunda ishlatilmagan", { n: USAGE_DAYS })}</div>
                              </div>
                            ) : (
                              <div className="min-w-0 max-w-[22rem]">
                                <div className="font-semibold text-v2-text">{t("{n} ta", { n: cov.ids.length })}</div>
                                <div className="truncate text-v2-caption text-v2-text-2" title={names.join(", ")}>
                                  {cov.all ? t("Hamma faol kassalarda") : names.join(", ")}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className={TD}>
                            {busyId === m.id ? (
                              <Loader2 className="size-4 animate-spin text-v2-text-3" strokeWidth={2} aria-hidden />
                            ) : off ? (
                              <span className="inline-flex items-center gap-1.5 text-v2-small text-v2-text-2">
                                <span className="size-1.5 rounded-full bg-v2-text-3" aria-hidden />
                                {t("Nofaol")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-v2-small text-v2-text">
                                <span className="size-1.5 rounded-full bg-v2-success" aria-hidden />
                                {t("Faol")}
                              </span>
                            )}
                          </td>
                          <td className={TD}>
                            <div className="flex items-center justify-end gap-0.5">
                              <button type="button" onClick={() => setDialog({ method: m })} title={t("Tahrirlash")} aria-label={t("Tahrirlash")} className={ICON_BTN}>
                                <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                              </button>
                              <ActionMenu label={t("Amallar")} items={menu(m, i)}>
                                {(trigger, open) => (
                                  <button type="button" {...trigger} aria-label={t("Amallar")} className={`${ICON_BTN} ${open ? "bg-v2-surface-2 text-v2-text" : ""}`}>
                                    <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
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
              </div>
              {data && methods.length > 1 && (
                <div className="flex items-center gap-2 border-t border-v2-border bg-v2-surface-2 px-4 py-2.5 text-v2-small text-v2-text-2">
                  {savingOrder ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden /> : <GripVertical className="size-3.5 text-v2-text-3" strokeWidth={1.75} aria-hidden />}
                  {savingOrder ? t("Tartib saqlanmoqda…") : t("Tartibni o'zgartirish — qatorni ushlagichdan sudrang yoki ⋯ → Yuqoriga / Pastga.")}
                </div>
              )}
            </section>

            {/* 3. Jadval ostida ikki karta (rasmdagidek) */}
            <aside className="grid items-start gap-4 lg:grid-cols-2">
              <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                <h2 className="text-v2-body font-semibold text-v2-text">{t("To'lov oynasida")}</h2>
                <p className="mt-0.5 text-v2-caption text-v2-text-2">{t("Faol turlar — shu tartibda")}</p>
                {!data ? (
                  <div className="mt-3 h-10 rounded-v2-md bg-v2-skeleton" />
                ) : activeMethods.length === 0 ? (
                  <p className="mt-3 text-v2-small text-v2-text-3">{t("Faol to'lov turi yo'q")}</p>
                ) : (
                  <div aria-hidden className="mt-3 flex flex-wrap gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
                    {activeMethods.map((m) => (
                      <span key={m.id} className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-[6px] px-2 text-v2-small text-v2-text-2">
                        <span className={`size-2 shrink-0 rounded-full ${methodDot(m.key)}`} />
                        <span className="truncate">{t(m.name)}</span>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-v2-caption text-v2-text-3">{t("Tartib jadvaldagi kabi — qatorni sudrab o'zgartiring. Naqd doim birinchi.")}</p>
              </section>

              {isAdmin && (
                <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                  <h2 className="text-v2-body font-semibold text-v2-text">{t("Kassa kartasida")}</h2>
                  <p className="mt-0.5 truncate text-v2-caption text-v2-text-2">
                    {primary ? t("{name} · hozir, so'm", { name: primary.name }) : primary === null ? t("Bosh kassa belgilanmagan") : "…"}
                  </p>
                  {primary === undefined ? (
                    <div className="mt-3 h-16 rounded-v2-md bg-v2-skeleton" />
                  ) : primary && cardTotal > 0 ? (
                    <>
                      <div className="mt-3 flex h-2 overflow-hidden rounded-v2-full bg-v2-track" role="presentation">
                        {cardRows.map((r) => (
                          <div key={r.m.key} className={`h-full ${methodDot(r.m.key)}`} style={{ width: `${(r.val / cardTotal) * 100}%` }} />
                        ))}
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {cardRows.map((r) => (
                          <li key={r.m.key} className="flex items-center justify-between gap-3 text-v2-small">
                            <span className="flex min-w-0 items-center gap-2 text-v2-text-2">
                              <span className={`size-2 shrink-0 rounded-full ${methodDot(r.m.key)}`} aria-hidden />
                              <span className="truncate">{t(r.m.name)}</span>
                            </span>
                            <span className="font-semibold tabular-nums text-v2-text">{fmtNum(r.val)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : primary ? (
                    <p className="mt-3 text-v2-small text-v2-text-3">{t("Bosh kassada hozir pul yo'q")}</p>
                  ) : null}
                </section>
              )}
            </aside>
          </div>

          {/* 4. Izoh */}
          <div className="space-y-1.5 text-v2-caption text-v2-text-2">
            <p className="flex items-start gap-2">
              <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <span>{t("«Qabul qilgan kassalar» — oxirgi {n} kunda shu tur bilan tushum yozilgan kassalar. Kassaga turni cheklash sozlamasi hozircha yo'q: to'lov oynasida hamma faol tur chiqadi.", { n: USAGE_DAYS })}</span>
            </p>
            <p className="flex items-start gap-2">
              <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <span>{t("Tur o'chirilmaydi: eski to'lovlarda saqlanadi, «Nofaol» qilinadi. Naqd va Plastik — tizim turi (kassa hisobi va oylik shular bilan), nofaol qilinmaydi.")}</span>
            </p>
          </div>
        </>
      )}

      {dialog && (
        <PaymentMethodDialogV2
          method={dialog.method}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            invalidateSharedList("shared:payment-methods");
            showSuccess(message);
            reload();
          }}
        />
      )}
    </div>
  );
}
