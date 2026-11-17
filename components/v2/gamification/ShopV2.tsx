"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { History, MoreHorizontal, Plus, RefreshCw, SquareArrowOutUpRight } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { gamApi } from "@/components/gamification/api";
import { withReward } from "@/components/gamification/ui";
import { DeleteItemModal, DiscountModal, GiveModal, ProductModal, ReturnModal, type ReturnTarget, type ShopItemView } from "@/components/gamification/shop/ShopModals";
import ActionMenu from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { DiscountApproveDialog, HistoryDrawer, RejectDialog } from "./ShopDialogs";
import GiveDialogV2 from "./GiveDialogV2";
import ShopBoardV2, { type AudTab } from "./ShopBoardV2";
import ShopRequestsTab from "./ShopRequestsTab";
import type { AwaitRow, HistoryRow, ReqRow, ReqView, ShopData } from "./shopTypes";

// YANGI VERSIYA — DO'KON (11-qism, rasmlar «Do'kon · So'rovlar» va «Do'kon · Sovg'alar»,
// yorug'/qorong'i, 24.10.2026): sarlavha «Do'kon» + «Sovg'alar tanga evaziga · o'quvchi
// kabinetdan so'rov yuboradi, siz tasdiqlaysiz», o'ngda «+ Sovg'a qo'shish» (direktor); tablar
// So'rovlar [N yangi] | Sovg'alar N (`?tab=` — replaceState).
//
// Ma'lumot: katalog — GET /api/gamification/shop (eski sahifa bilan bitta), so'rovlar —
// GET /api/gamification/shop/requests (lib/gamification/shopRequests.ts). Sovg'a qo'shish /
// tahrirlash / o'chirish / berish / qaytarish oynalari — eski (ShopModals.tsx). Byudjet va
// chegirmalar ro'yxati — «⋯ → Eski ko'rinishda ochish».
//
// 33-qism (17.11.2026, rasm «Do'kon»): «Sovg'alar» — birinchi va sukut tab, yangi ko'rinish
// (./ShopBoardV2.tsx: byudjet, toifa va ombor, kartalar, istaklar, oyda berilganlar); buyum va
// xizmatni berish — ./GiveDialogV2.tsx (chegirma — eski oyna, kurs tanlanadi). «So'rovlar» saqlandi.

export type ShopTab = "sorovlar" | "sovgalar";

export default function ShopV2({ initialTab }: { initialTab?: string }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [shop, setShop] = useState<ShopData | null>(null);
  const [req, setReq] = useState<ReqView | null>(null);
  const [err, setErr] = useState("");
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<ShopTab | null>(initialTab === "sovgalar" || initialTab === "sorovlar" ? initialTab : null);
  const [busy, setBusy] = useState<string | null>(null);

  const [reject, setReject] = useState<ReqRow | null>(null);
  const [discount, setDiscount] = useState<ReqRow | null>(null);
  const [history, setHistory] = useState(false);
  const [give, setGive] = useState<ShopItemView | null>(null);
  const [giveV2, setGiveV2] = useState<{ item: ShopItemView; pupilId: number | null; meta: string } | null>(null);
  const [aud, setAud] = useState<AudTab>("all");
  const [branchSel, setBranchSel] = useState<number | null>(null);
  const [edit, setEdit] = useState<{ item: ShopItemView | null } | null>(null);
  const [del, setDel] = useState<ShopItemView | null>(null);
  const [ret, setRet] = useState<ReturnTarget | null>(null);

  useEffect(() => {
    let off = false;
    Promise.all([gamApi<ShopData>("/api/gamification/shop"), gamApi<ReqView>("/api/gamification/shop/requests")]).then(([s, r]) => {
      if (off) return;
      if (s.ok) setShop(s);
      if (r.ok) setReq(r);
      setErr(!s.ok ? s.error : !r.ok ? r.error : "");
    });
    return () => {
      off = true;
    };
  }, [version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const goTab = useCallback((next: ShopTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);

  if (!shop || !req) {
    return (
      <Frame>
        <Header />
        {err ? (
          <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
            <p className="text-v2-body text-v2-text-2">{t(err)}</p>
            <button type="button" onClick={reload} className={`${secondaryBtn} mt-3`}>
              <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Qayta urinish")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4" aria-busy>
            <div className="h-10 w-72 rounded bg-v2-skeleton" />
            <div className="h-12 rounded-v2-md bg-v2-skeleton" />
            <div className="h-64 rounded-v2-lg bg-v2-skeleton" />
          </div>
        )}
      </Frame>
    );
  }

  const director = shop.role === "director";
  const current: ShopTab = tab ?? "sovgalar";
  const giveBranch = req.branches.length === 1 ? req.branches[0].id : null;
  const stockBranch = branchSel ?? req.branches[0]?.id ?? null;
  const stockBranchName = req.branches.find((b) => b.id === stockBranch)?.name ?? "";

  function openGive(item: ShopItemView, pupilId?: number) {
    if (item.kind === "discount") {
      setGive(item);
      return;
    }
    const d = new Date();
    const hm = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
    const day = d.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
    setGiveV2({ item, pupilId: pupilId ?? null, meta: [stockBranchName, `${fmtDay(day)} | ${hm}`].filter(Boolean).join(" · ") });
  }

  /* ── So'rov amallari ── */
  async function approve(r: ReqRow) {
    if (r.kind === "discount") {
      setDiscount(r);
      return;
    }
    setBusy(r.key);
    const res = await gamApi<{ levelUp: { name: string } | null; badges: { name: string }[] }>("/api/gamification/shop/requests/approve", {
      method: "POST",
      body: { pupilId: r.pupilId, itemId: r.itemId },
    });
    setBusy(null);
    if (!res.ok) {
      showError(t(res.error));
      reload();
      return;
    }
    showSuccess(withReward(t, t("{name}: «{gift}» tasdiqlandi, −{n} tanga — topshirish kutilmoqda", { name: r.pupilName, gift: t(r.title), n: r.price }), r.pupilName, res));
    reload();
  }

  async function handover(o: AwaitRow) {
    setBusy(`o${o.orderId}`);
    const res = await gamApi<object>(`/api/gamification/shop/orders/${o.orderId}/handover`, { method: "POST", body: {} });
    setBusy(null);
    if (!res.ok) {
      showError(t(res.error));
      reload();
      return;
    }
    showSuccess(t("{name}: «{gift}» topshirildi", { name: o.pupilName, gift: t(o.title) }));
    reload();
  }

  const returnTarget = (o: { id: number; pupilName: string; title: string; price: number; givenDate: string; kind: ShopItemView["kind"]; branchName: string }): ReturnTarget => ({
    id: o.id,
    pupilName: o.pupilName,
    itemName: o.title,
    priceCoins: o.price,
    givenDate: o.givenDate,
    kind: o.kind,
    branchName: o.branchName,
  });

  const newCount = req.requests.length;

  return (
    <Frame>
      <Header
        actions={
          <>
            <ActionMenu
              label={t("Do'kon amallari")}
              width={260}
              items={[
                ...(req.canManage ? [{ key: "hist", label: t("Tarix: topshirilgan va rad etilganlar"), icon: History, onSelect: () => setHistory(true) }] : []),
                { key: "classic", label: t("Eski ko'rinishda ochish"), icon: SquareArrowOutUpRight, href: "/gamification-shop?classic=1" },
              ]}
            >
              {(trigger, open) => (
                <button type="button" {...trigger} title={t("Amallar")} aria-label={t("Do'kon amallari")} className={`${secondaryIcon} ${open ? "bg-v2-surface-2" : ""}`}>
                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                </button>
              )}
            </ActionMenu>
            {director && (
              <button type="button" onClick={() => setEdit({ item: null })} className={primaryBtn}>
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                {t("Sovg'a qo'shish")}
              </button>
            )}
          </>
        }
      />

      {!shop.enabled && (
        <div role="note" className="rounded-v2-md bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
          {t("Tangalar tizimi hali ishga tushirilmagan — sovg'a berib bo'lmaydi.")}
        </div>
      )}

      {/* Tablar */}
      <div role="tablist" aria-label={t("Do'kon")} className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--v2-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            { key: "sovgalar" as const, label: t("Sovg'alar"), badge: null, count: shop.items.length },
            { key: "sorovlar" as const, label: t("So'rovlar"), badge: newCount > 0 ? t("{n} yangi", { n: newCount }) : null, count: null },
          ]
        ).map((x) => {
          const on = current === x.key;
          return (
            <button
              key={x.key}
              type="button"
              role="tab"
              id={`stab-${x.key}`}
              aria-selected={on}
              aria-controls={`spanel-${x.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => goTab(x.key)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const next = current === "sorovlar" ? "sovgalar" : "sorovlar";
                goTab(next);
                requestAnimationFrame(() => document.getElementById(`stab-${next}`)?.focus());
              }}
              className={`relative inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-v2-body transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                on ? "font-semibold text-v2-text" : "text-v2-text-2 hover:text-v2-text"
              }`}
            >
              {x.label}
              {x.badge && <span className="rounded-v2-full bg-v2-brand px-1.5 py-px text-v2-caption font-semibold text-v2-on-brand">{x.badge}</span>}
              {x.count !== null && <span className="text-v2-caption font-medium tabular-nums text-v2-text-3">{x.count}</span>}
              {on && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-v2-brand" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`spanel-${current}`} aria-labelledby={`stab-${current}`}>
        {current === "sorovlar" ? (
          <ShopRequestsTab
            req={req}
            busy={busy}
            onApprove={(r) => void approve(r)}
            onReject={setReject}
            onHandover={(o) => void handover(o)}
            onReturn={(o) => setRet(returnTarget({ id: o.orderId, pupilName: o.pupilName, title: o.title, price: o.price, givenDate: o.givenDate, kind: o.kind, branchName: o.branchName }))}
            onHistory={() => setHistory(true)}
          />
        ) : (
          <ShopBoardV2
            shop={shop}
            branches={req.branches}
            branchId={stockBranch}
            onBranch={setBranchSel}
            aud={aud}
            onAud={setAud}
            onGive={openGive}
            onEdit={(i) => setEdit({ item: i })}
            onAdd={() => setEdit({ item: null })}
          />
        )}
      </div>

      {/* ── Oynalar ── */}
      {reject && (
        <RejectDialog
          row={reject}
          onClose={() => setReject(null)}
          onDone={() => {
            showSuccess(t("{name}: «{gift}» so'rovi rad etildi", { name: reject.pupilName, gift: t(reject.title) }));
            reload();
          }}
        />
      )}
      {discount && (
        <DiscountApproveDialog
          row={discount}
          onClose={() => setDiscount(null)}
          onDone={(res) => {
            showSuccess(withReward(t, t("{name}: «{gift}» tasdiqlandi, −{n} tanga", { name: discount.pupilName, gift: t(discount.title), n: discount.price }), discount.pupilName, res));
            reload();
          }}
        />
      )}
      {history && (
        <HistoryDrawer
          version={version}
          onClose={() => setHistory(false)}
          onReturn={(r: HistoryRow) => setRet(returnTarget({ id: r.id, pupilName: r.pupilName, title: r.title, price: r.price, givenDate: r.givenDate, kind: r.itemKind, branchName: r.branchName }))}
        />
      )}
      {give && (
        <GiveModal
          item={give}
          branchId={giveBranch}
          preselect={null}
          onClose={() => setGive(null)}
          onDone={(r) => {
            const msg = t("{name}: «{title}» berildi, −{n} tanga", { name: r.pupilName, title: t(r.title), n: r.price });
            showSuccess(withReward(t, r.wished ? `${msg} · ${t("istaklardan olindi")}` : msg, r.pupilName, r));
            reload();
          }}
        />
      )}
      {giveV2 && (
        <GiveDialogV2
          item={giveV2.item}
          branchId={stockBranch}
          branchName={stockBranchName}
          stock={giveV2.item.kind === "item" ? Number((giveV2.item.stockAll ?? giveV2.item.stock ?? {})[String(stockBranch)]) || 0 : null}
          budgetLeft={shop.budget.find((b) => b.branchId === stockBranch)?.left ?? null}
          preselect={giveV2.pupilId}
          meta={giveV2.meta}
          onClose={() => setGiveV2(null)}
          onDone={(r) => {
            const msg = t("{name}: «{title}» berildi, −{n} tanga", { name: r.pupilName, title: t(r.title), n: r.price });
            showSuccess(withReward(t, r.wished ? `${msg} · ${t("istaklardan olindi")}` : msg, r.pupilName, r));
            reload();
          }}
        />
      )}
      {ret && (
        <ReturnModal
          order={ret}
          onClose={() => setRet(null)}
          onDone={() => {
            showSuccess(t("{name}: «{title}» qaytarildi, +{n} tanga", { name: ret.pupilName, title: t(ret.itemName), n: ret.priceCoins }));
            reload();
          }}
        />
      )}
      {edit && edit.item?.kind === "discount" && (
        <DiscountModal
          item={edit.item}
          kidsMaxGrade={shop.kidsMaxGrade}
          onClose={() => setEdit(null)}
          onSaved={(m) => {
            showSuccess(m);
            reload();
          }}
        />
      )}
      {edit && edit.item?.kind !== "discount" && (
        <ProductModal
          item={edit.item}
          branches={shop.branchOptions.length ? shop.branchOptions : shop.budget.map((b) => ({ id: b.branchId, name: b.name }))}
          kidsMaxGrade={shop.kidsMaxGrade}
          onClose={() => setEdit(null)}
          onSaved={(m) => {
            showSuccess(m);
            reload();
          }}
          onDelete={(it) => setDel(it)}
        />
      )}
      {del && (
        <DeleteItemModal
          item={del}
          onClose={() => setDel(null)}
          onDone={(m) => {
            setEdit(null);
            showSuccess(m);
            reload();
          }}
        />
      )}
    </Frame>
  );
}

/** "2026-10-12" → «12-oktabr» (uz) — oyna sarlavhasi uchun. */
function fmtDay(iso: string): string {
  const m = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"][Number(iso.slice(5, 7)) - 1] ?? "";
  return `${Number(iso.slice(8, 10))}-${m}`;
}

function Frame({ children }: { children: ReactNode }) {
  return <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">{children}</div>;
}

function Header({ actions }: { actions?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold leading-7 text-v2-text">{t("Do'kon")}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">{t("O'quvchi tangani sovg'aga almashtiradi, sovg'ani filial admini beradi · kichiklar va kattalar uchun alohida")}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
