"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowRight, Crown, Info, Loader2, Lock, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useBranch } from "@/components/shared/BranchContext";
import { useT } from "@/components/shared/Language";
import { dropCashboxes } from "@/components/v2/finance/cashboxesCache";
import V2Confirm from "@/components/v2/form/V2Confirm";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Picker from "@/components/v2/form/V2Picker";
import { Field, FieldError, methodDot } from "@/components/v2/form/fields";
import { fmtNum } from "@/components/v2/reports/reportFormat";
import { useShell } from "@/components/v2/shell/ShellContext";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ROW_TINT } from "@/components/v2/ui/table";
import type { Cashbox } from "@/lib/cashboxes";
import type { PaymentMethod } from "@/lib/paymentMethods";
import { cashboxBlocksArchive, initials, methodsOfCashbox, USAGE_DAYS, type MethodUsage } from "@/lib/paymentMethodUsage";
import CashboxDialogV2 from "./CashboxDialogV2";

// YANGI VERSIYA — «SOZLAMALAR → MOLIYA → KASSALAR» (24-qism, rasmlar «Sozlamalar · Kassalar ·
// Yorug'/Qorong'i», 13.11.2026). PUL SAHIFASI EMAS: qoldiq, kirim/chiqim, ko'chirma — Moliya →
// Kassalar (/finance-cash, o'zgarmagan). Bu yerda kassaning O'ZI: nomi, mas'uli, filiali,
// bosh kassa, arxiv.
//
// HAQIQIY QOIDALAR (rasmdan farqi — design/v2/SAVOLLAR.md 280-…):
//   • Kassani boshqarish FAQAT administratorda (app/api/cashboxes POST, [id] PATCH/DELETE,
//     set-primary) — boshqa xodimga sahifa izoh ko'rsatadi.
//   • To'lov oynasida xodim FILIAL bo'yicha emas, MAS'UL bo'yicha kassa ko'radi: faqat o'zi
//     mas'ul bo'lgan kassani (GET /api/cashboxes). Rahbar — hamma faol kassani.
//   • «Qabul qiladigan to'lov turlari» sozlamasi tizimda YO'Q — ustunda oxirgi USAGE_DAYS kunda
//     shu kassaga yozilgan tushum turlari (GET /api/payment-methods → usage).
//   • Ko'chirma faqat bosh kassaga cheklanmagan — bosh kassa «topshiruv» hisobining boshi,
//     kunlik topshiruv hisoboti, oylik va botdagi sukut kassa.
//   • Arxiv: qoldig'i yoki tasdiq kutayotgan ko'chirmasi bor kassa arxivlanmaydi (shu sahifada;
//     server buni tekshirmaydi), bosh kassa arxivlanmaydi. O'chirish — faqat arxivdagi va
//     tarixi yo'q kassa (server 409 qaytaradi).

const TH = "sticky top-0 z-[1] bg-v2-surface-2 px-4 py-2.5 text-left text-v2-caption font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
const TD = "border-t border-v2-border px-4 py-3 align-middle";
const ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";

interface Loaded {
  cashboxes: Cashbox[];
  methods: PaymentMethod[];
  usage: MethodUsage;
}

function MethodChips({ methods }: { methods: PaymentMethod[] }) {
  const { t } = useT();
  return (
    <div className="flex max-w-[20rem] flex-wrap gap-1.5">
      {methods.map((m) => (
        <span key={m.key} className="inline-flex items-center gap-1.5 rounded-v2-sm border border-v2-border bg-v2-surface-2 px-2 py-0.5 text-v2-caption font-medium text-v2-text">
          <span className={`size-1.5 shrink-0 rounded-full ${methodDot(m.key)}`} aria-hidden />
          {t(m.name)}
        </span>
      ))}
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <tr key={i}>
          <td className={TD}>
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-v2-md bg-v2-skeleton" />
              <div className="h-3 w-28 rounded bg-v2-skeleton" />
            </div>
          </td>
          <td className={TD}>
            <div className="h-3 w-24 rounded bg-v2-skeleton" />
          </td>
          <td className={TD}>
            <div className="h-3 w-20 rounded bg-v2-skeleton" />
          </td>
          <td className={TD}>
            <div className="h-5 w-36 rounded bg-v2-skeleton" />
          </td>
          <td className={TD} />
        </tr>
      ))}
    </>
  );
}

/** «Bosh kassani almashtirish» — faol kassalardan biri. */
function PrimaryDialog({ cashboxes, current, onClose, onPick }: { cashboxes: Cashbox[]; current: Cashbox | null; onClose: () => void; onPick: (c: Cashbox) => Promise<string | null> }) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const options = cashboxes
    .filter((c) => !c.archived && c.id !== current?.id)
    .map((c) => ({ value: String(c.id), label: c.name, sublabel: c.moderator || t("mas'ulsiz") }));

  async function submit() {
    const chosen = cashboxes.find((c) => String(c.id) === value);
    if (!chosen) return setErr(t("Kassani tanlang"));
    setSaving(true);
    const fail = await onPick(chosen);
    setSaving(false);
    if (fail) setErr(fail);
    else modal.close();
  }

  return (
    <V2Dialog
      title={t("Bosh kassani almashtirish")}
      subtitle={current ? t("Hozir: {name}", { name: current.name }) : t("Bosh kassa belgilanmagan")}
      onClose={onClose}
      controller={modal}
      dirty={Boolean(value)}
      saving={saving}
      onSubmit={() => void submit()}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving || !value} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />}
            {t("Bosh kassa qilish")}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label={t("Yangi bosh kassa")} htmlFor="primary-v2-pick">
          <V2Picker
            id="primary-v2-pick"
            label={t("Yangi bosh kassa")}
            value={value}
            onChange={(v) => {
              setValue(v);
              setErr("");
            }}
            options={options}
            placeholder={t("Kassani tanlang")}
            emptyText={t("Boshqa faol kassa yo'q")}
          />
        </Field>
        <p className="text-v2-small text-v2-text-2">
          {t("Boshqa kassalarning «oxirgi topshiruvdan beri» hisobi endi yangi bosh kassaga qabul qilingan ko'chirmadan boshlanadi. Pul ko'chmaydi.")}
        </p>
        {err && <FieldError>{err}</FieldError>}
      </div>
    </V2Dialog>
  );
}

export default function CashboxSettingsV2() {
  const { t } = useT();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { isAdmin } = useShell();
  const { branches, branchId: navBranch } = useBranch();
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState("");
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [dialog, setDialog] = useState<{ cashbox: Cashbox | null } | null>(null);
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [makePrimary, setMakePrimary] = useState<Cashbox | null>(null);
  const [archive, setArchive] = useState<Cashbox | null>(null);
  const [del, setDel] = useState<Cashbox | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let off = false;
    Promise.all([fetch("/api/cashboxes"), fetch("/api/payment-methods")])
      .then(async ([a, b]) => {
        const da = await a.json().catch(() => ({}));
        const db = await b.json().catch(() => ({}));
        if (off) return;
        if (!a.ok || !da.ok) return setErr(da.error || "Yuklanmadi");
        setErr("");
        // Turlar ro'yxati yiqilsa ham kassalar ko'rinsin — ustun «—» bo'ladi.
        setData({
          cashboxes: da.cashboxes as Cashbox[],
          methods: b.ok && db.ok ? (db.methods as PaymentMethod[]) : [],
          usage: b.ok && db.ok ? (db.usage as MethodUsage) : {},
        });
      })
      .catch(() => {
        if (!off) setErr("Serverga ulanib bo'lmadi");
      });
    return () => {
      off = true;
    };
  }, [isAdmin, version]);
  const reload = () => setVersion((v) => v + 1);
  const changed = () => {
    dropCashboxes();
    reload();
  };

  const branchName = (id: number | undefined) => (typeof id === "number" ? (branches.find((b) => b.id === id)?.name ?? t("{n}-filial", { n: id })) : "");

  // ── Ruxsat: kassani boshqarish faqat administratorda ──
  if (!isAdmin) {
    return (
      <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
        <div>
          <div className="text-v2-caption text-v2-text-2">{t("Moliya")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Kassalar")}</h1>
        </div>
        <div className="flex max-w-[40rem] items-start gap-3 rounded-v2-lg border border-v2-border bg-v2-surface p-5">
          <Lock className="mt-0.5 size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0">
            <p className="text-v2-body font-medium text-v2-text">{t("Kassalarni faqat administrator sozlaydi")}</p>
            <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Kassa qo'shish, mas'ulni almashtirish, bosh kassa va arxiv — rahbar ishi. O'z kassangizning qoldig'i va amallari — Moliya → Kassalar.")}</p>
            <Link href="/finance-cash" className="mt-2 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand-text underline-offset-2 hover:underline">
              {t("Moliya → Kassalar")}
              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const all = data?.cashboxes ?? [];
  const active = all.filter((c) => !c.archived);
  const archived = all.filter((c) => c.archived);
  const rows = tab === "active" ? active : archived;
  const primary = all.find((c) => c.isPrimary) ?? null;

  // «To'lov oynasida» kartasi: faol kassalar filial bo'yicha (filialsizlar oxirida).
  const byBranch = new Map<string, Cashbox[]>();
  for (const c of [...active].sort((a, b) => (a.branchId ?? 1e9) - (b.branchId ?? 1e9) || a.id - b.id)) {
    const k = branchName(c.branchId) || t("Filialsiz");
    byBranch.set(k, [...(byBranch.get(k) ?? []), c]);
  }

  async function post(url: string, init: RequestInit, okText: string): Promise<string | null> {
    try {
      const res = await fetch(url, init);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        const msg = res.status === 409 ? t("Bu kassada yozuvlar bor — o'chirib bo'lmaydi, arxivda qoladi.") : t(d.error || "Saqlanmadi");
        return msg;
      }
      showSuccess(okText);
      changed();
      return null;
    } catch {
      return t("Serverga ulanib bo'lmadi");
    }
  }

  const setPrimary = (c: Cashbox) => post(`/api/cashboxes/${c.id}/set-primary`, { method: "POST" }, t("«{name}» endi bosh kassa", { name: c.name }));
  const patch = (c: Cashbox, body: object, okText: string) =>
    post(`/api/cashboxes/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, okText);

  async function run(p: Promise<string | null>) {
    const fail = await p;
    if (fail) showError(fail);
  }

  function menu(c: Cashbox): ActionMenuEntry[] {
    const items: ActionMenuEntry[] = [{ key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setDialog({ cashbox: c }) }];
    if (!c.archived && !c.isPrimary) items.push({ key: "primary", label: t("Bosh kassa qilish"), icon: Crown, onSelect: () => setMakePrimary(c) });
    items.push({ key: "open", label: t("Qoldiq va amallar"), icon: ArrowRight, onSelect: () => router.push("/finance-cash") });
    items.push({ key: "div", divider: true });
    if (c.archived) {
      items.push({ key: "restore", label: t("Arxivdan chiqarish"), icon: ArchiveRestore, onSelect: () => void run(patch(c, { archived: false }, t("«{name}» arxivdan chiqarildi", { name: c.name }))) });
      items.push({ key: "del", label: t("O'chirish"), icon: Trash2, danger: true, onSelect: () => setDel(c) });
    } else {
      items.push({
        key: "archive",
        label: t("Arxivga o'tkazish"),
        icon: Archive,
        disabled: c.isPrimary,
        title: c.isPrimary ? t("Bosh kassa arxivlanmaydi — avval boshqa kassani bosh qiling") : undefined,
        onSelect: () => setArchive(c),
      });
    }
    return items;
  }

  const archiveBlock = archive ? cashboxBlocksArchive(archive) : null;

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[36rem]">
          <div className="text-v2-caption text-v2-text-2">{t("Moliya")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Kassalar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("Har kassaning mas'uli, filiali va qabul qilgan to'lov turlari. Qoldiq va pul amallari —")}{" "}
            <Link href="/finance-cash" className="font-medium text-v2-brand-text underline-offset-2 hover:underline">
              {t("Moliya → Kassalar")}
            </Link>
            .
          </p>
        </div>
        <button type="button" onClick={() => setDialog({ cashbox: null })} disabled={!data} className={`${primaryBtn} disabled:opacity-60`}>
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {t("Kassa qo'shish")}
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
          {/* 2. Faol / Arxiv */}
          <div role="tablist" aria-label={t("Holat")} className="flex flex-wrap gap-2">
            {(
              [
                ["active", t("Faol"), active.length],
                ["archived", t("Arxiv"), archived.length],
              ] as const
            ).map(([key, label, n]) => {
              const on = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(key)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-v2-full border px-3 text-v2-small font-medium transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                    on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"
                  }`}
                >
                  {label}
                  <span className={on ? "text-v2-brand-text" : "text-v2-text-3"}>· {data ? n : "…"}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            {/* 3. Jadval */}
            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-0 text-v2-body">
                  <thead>
                    <tr>
                      <th className={TH}>{t("Kassa")}</th>
                      <th className={TH}>{t("Mas'ul")}</th>
                      <th className={TH}>{t("Filial")}</th>
                      <th className={TH}>
                        {t("To'lov turlari")} <span className="font-normal text-v2-text-3">· {t("{n} kun", { n: USAGE_DAYS })}</span>
                      </th>
                      <th className={`${TH} w-20`}>
                        <span className="sr-only">{t("Amallar")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!data && <SkeletonRows />}
                    {data && rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <Wallet className="mx-auto size-8 text-v2-text-3" strokeWidth={1.5} aria-hidden />
                          <p className="mt-2 text-v2-body font-medium text-v2-text">{tab === "active" ? t("Faol kassa yo'q") : t("Arxivda kassa yo'q")}</p>
                          {tab === "active" && <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Kassa qo'shilgach, to'lov oynasida mas'uliga ko'rinadi.")}</p>}
                        </td>
                      </tr>
                    )}
                    {data &&
                      rows.map((c) => {
                        const used = methodsOfCashbox(data.usage, c.id, data.methods);
                        return (
                          <tr key={c.id} className={ROW_TINT.hover}>
                            <td className={TD}>
                              <div className="flex items-center gap-3">
                                <span
                                  className={`flex size-8 shrink-0 items-center justify-center rounded-v2-md border ${
                                    c.isPrimary ? "border-v2-warning/30 bg-v2-warning-bg text-v2-warning" : "border-v2-border bg-v2-surface-2 text-v2-text-2"
                                  }`}
                                  aria-hidden
                                >
                                  {c.isPrimary ? <Crown className="size-4" strokeWidth={1.75} /> : <Wallet className="size-4" strokeWidth={1.75} />}
                                </span>
                                <span className="min-w-0">
                                  <span className={`block truncate font-semibold ${c.archived ? "text-v2-text-2" : "text-v2-text"}`}>{c.name}</span>
                                  {c.isPrimary && <span className="block text-v2-caption font-medium text-v2-warning">{t("Bosh kassa")}</span>}
                                </span>
                              </div>
                            </td>
                            <td className={TD}>
                              {c.moderator ? (
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
                                    {initials(c.moderator)}
                                  </span>
                                  <span className="truncate text-v2-text">{c.moderator}</span>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-v2-small font-medium text-v2-warning">{t("Biriktirilmagan")}</div>
                                  <div className="text-v2-caption text-v2-text-3">{t("tushumni faqat rahbar yozadi")}</div>
                                </div>
                              )}
                            </td>
                            <td className={TD}>{c.branchId !== undefined ? <span className="text-v2-text">{branchName(c.branchId)}</span> : <span className="text-v2-text-3">{t("Filialsiz")}</span>}</td>
                            <td className={TD}>
                              {used.length > 0 ? <MethodChips methods={used} /> : <span className="text-v2-small text-v2-text-3">{t("{n} kunda tushum yo'q", { n: USAGE_DAYS })}</span>}
                            </td>
                            <td className={TD}>
                              <div className="flex items-center justify-end gap-0.5">
                                <button type="button" onClick={() => setDialog({ cashbox: c })} title={t("Tahrirlash")} aria-label={t("Tahrirlash")} className={ICON_BTN}>
                                  <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                                </button>
                                <ActionMenu label={t("Amallar")} items={menu(c)}>
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
            </section>

            {/* 4. Jadval ostida ikki karta (rasmdagidek) */}
            <aside className="grid items-start gap-4 lg:grid-cols-2">
              <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-v2-body font-semibold text-v2-text">
                    <Crown className="size-4 text-v2-warning" strokeWidth={1.75} aria-hidden />
                    {t("Bosh kassa")}
                  </h2>
                  <button type="button" onClick={() => setPrimaryOpen(true)} disabled={!data || active.length < 2} className={`${secondaryBtn} h-8 disabled:opacity-60`}>
                    {t("Almashtirish")}
                  </button>
                </div>
                {!data ? (
                  <div className="mt-3 h-10 rounded-v2-md bg-v2-skeleton" />
                ) : primary ? (
                  <div className="mt-3 rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
                    <div className="truncate font-semibold text-v2-text">{primary.name}</div>
                    <div className="truncate text-v2-caption text-v2-text-2">{[primary.moderator || t("mas'ulsiz"), branchName(primary.branchId)].filter(Boolean).join(" · ")}</div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-v2-md bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">{t("Bosh kassa belgilanmagan — kunlik topshiruv hisoboti ishlamaydi.")}</p>
                )}
                <ul className="mt-3 space-y-1.5 text-v2-small text-v2-text-2">
                  {[
                    t("Boshqa kassalarning «oxirgi topshiruvdan beri» hisobi shu kassaga qabul qilingan ko'chirmadan boshlanadi."),
                    t("Kunlik topshiruv hisobotini rahbar va bosh kassa mas'uli ko'radi."),
                    t("Oylik chiqarishda va botda sukut bo'yicha shu kassa tanlanadi."),
                    t("Bosh kassani faqat administrator almashtiradi."),
                  ].map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-v2-text-3" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                <h2 className="text-v2-body font-semibold text-v2-text">{t("To'lov oynasida chiqadi")}</h2>
                <p className="mt-0.5 text-v2-caption text-v2-text-2">{t("Xodim faqat o'zi mas'ul bo'lgan kassani ko'radi")}</p>
                {!data ? (
                  <div className="mt-3 h-16 rounded-v2-md bg-v2-skeleton" />
                ) : byBranch.size === 0 ? (
                  <p className="mt-3 text-v2-small text-v2-text-3">{t("Faol kassa yo'q")}</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {[...byBranch.entries()].map(([bName, list]) => (
                      <div key={bName}>
                        <div className="text-v2-caption font-medium text-v2-text-2">{bName}</div>
                        <ul className="mt-1 space-y-1">
                          {list.map((c) => (
                            <li key={c.id} className="flex min-w-0 items-center gap-2 text-v2-small">
                              {c.isPrimary ? <Crown className="size-3.5 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden /> : <Wallet className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />}
                              <span className="truncate text-v2-text">
                                {c.name} <span className="text-v2-text-2">· {c.moderator || t("faqat rahbar")}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 border-t border-v2-border pt-3 text-v2-caption text-v2-text-2">{t("Rahbar hamma faol kassani ko'radi. Arxivdagi kassa to'lov oynasida chiqmaydi.")}</p>
              </section>
            </aside>
          </div>

          {/* 5. Izoh */}
          <div className="space-y-1.5 text-v2-caption text-v2-text-2">
            <p className="flex items-start gap-2">
              <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <span>{t("Yozuvi bor kassa o'chirilmaydi — «Arxiv»ga o'tadi. Qoldig'i yoki tasdiq kutayotgan ko'chirmasi bor kassa arxivlanmaydi: avval Moliya → Kassalar'da bosh kassaga ko'chiring.")}</span>
            </p>
            <p className="flex items-start gap-2">
              <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <span>{t("To'lov turlari — oxirgi {n} kunda shu kassaga yozilgan tushumlardan. Kassaga turlarni cheklash sozlamasi hozircha yo'q: to'lov oynasida hamma faol tur chiqadi.", { n: USAGE_DAYS })}</span>
            </p>
          </div>
        </>
      )}

      {/* ── Oynalar ── */}
      {dialog && data && (
        <CashboxDialogV2
          cashbox={dialog.cashbox}
          cashboxes={data.cashboxes}
          branchName={dialog.cashbox ? branchName(dialog.cashbox.branchId) : branchName(navBranch ?? undefined)}
          onClose={() => setDialog(null)}
          onSaved={(_saved, message) => {
            showSuccess(message);
            changed();
          }}
        />
      )}
      {primaryOpen && data && <PrimaryDialog cashboxes={data.cashboxes} current={primary} onClose={() => setPrimaryOpen(false)} onPick={setPrimary} />}
      {makePrimary && (
        <V2Confirm
          tone="brand"
          icon={Crown}
          title={t("«{name}» bosh kassa bo'lsinmi?", { name: makePrimary.name })}
          body={
            primary
              ? t("Hozirgi bosh kassa — «{name}». Pul ko'chmaydi: faqat topshiruv hisobi, oylik va botdagi sukut kassa o'zgaradi.", { name: primary.name })
              : t("Pul ko'chmaydi: faqat topshiruv hisobi, oylik va botdagi sukut kassa o'zgaradi.")
          }
          confirmLabel={t("Bosh kassa qilish")}
          onCancel={() => setMakePrimary(null)}
          onConfirm={() => {
            const c = makePrimary;
            setMakePrimary(null);
            void run(setPrimary(c));
          }}
        />
      )}
      {archive &&
        (archiveBlock ? (
          <V2Confirm
            tone="brand"
            icon={Wallet}
            title={archiveBlock === "balance" ? t("Kassada qoldiq bor") : t("Kassada tasdiq kutayotgan ko'chirma bor")}
            body={
              archiveBlock === "balance"
                ? t("«{name}» kassasida {sum} so'm turibdi. Arxivdagi kassa to'lov oynasida chiqmaydi — avval qoldiqni Moliya → Kassalar'da bosh kassaga ko'chiring.", {
                    name: archive.name,
                    sum: fmtNum(archive.balance),
                  })
                : t("«{name}» kassasining ko'chirmasi hali qabul qilinmagan. Avval Moliya → Kassalar'da uni tasdiqlang yoki bekor qiling.", { name: archive.name })
            }
            confirmLabel={t("Moliya → Kassalar")}
            onCancel={() => setArchive(null)}
            onConfirm={() => {
              setArchive(null);
              router.push("/finance-cash");
            }}
          />
        ) : (
          <V2Confirm
            tone="brand"
            icon={Archive}
            title={t("«{name}» arxivga o'tsinmi?", { name: archive.name })}
            body={t("Kassa to'lov oynasidan va kunlik topshiruv hisobotidan chiqadi. Tarixi saqlanadi, istalgan vaqt arxivdan qaytariladi.")}
            confirmLabel={t("Arxivga o'tkazish")}
            onCancel={() => setArchive(null)}
            onConfirm={() => {
              const c = archive;
              setArchive(null);
              void run(patch(c, { archived: true }, t("«{name}» arxivga o'tdi", { name: c.name })));
            }}
          />
        ))}
      {del && (
        <V2Confirm
          title={t("«{name}» kassasini o'chirasizmi?", { name: del.name })}
          body={t("Faqat hech qanday yozuvi bo'lmagan (xato ochilgan) kassa o'chadi. Yozuvi bor kassa arxivda qoladi.")}
          confirmLabel={t("O'chirish")}
          onCancel={() => setDel(null)}
          onConfirm={() => {
            const c = del;
            setDel(null);
            void run(post(`/api/cashboxes/${c.id}`, { method: "DELETE" }, t("«{name}» o'chirildi", { name: c.name })));
          }}
        />
      )}
    </div>
  );
}
