"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { emitMoneyChanged } from "@/components/v2/shell/v2Events";
import { ApiError, fetchJson } from "@/lib/fetchJson";
import { uzMoney } from "@/lib/notifications";
import type { TransferReturnItem } from "@/lib/transferReturns";
import { uzStamp } from "@/lib/uzTime";

// «PUL QAYTDI» OYNASI (01.11.2026) — foydalanuvchi: «pul qaytarilganda
// moderatorga habar kelishi kerak modal oynasida, siz yuborgan pulni rahbar
// cancel qildi, pul sizga qaytdi degan».
//
// Jo'natuvchi kassa egasi (filial kassiri) qaysi sahifada bo'lmasin — qobiqda
// (components/shared/AppShell.tsx va v2 AppShellV2). Manba GET
// /api/transfer-returns (rahbar bekor qilgan, hali ko'rilmagan ko'chirmalar),
// so'rov halqasi TaskInboxProvider bilan bir xil: 60 soniya, yashirin tab
// so'ramaydi, 15 daqiqa tegilmagan tab so'ramaydi, 401 dan keyin to'xtaydi.
// Server «ruxsat yo'q» yoki «kassa yo'q» desa — shu sessiyada qayta so'ramaydi.
//
// Oyna boshqa modal ochiq paytda CHIQMAYDI (kassir forma o'rtasida bo'lishi
// mumkin) — u yopilishini kutadi. Yopilganda (Tushunarli, Esc, ×) hammasi
// «ko'rildi» bo'ladi — xabar har daqiqada qaytib tushmasin; yozib bo'lmasa
// keyingi so'rovda yana chiqadi.

const POLL_MS = 60_000;
const IDLE_MS = 15 * 60_000;
const STALE_MS = 30_000;
/** Boshqa modal yopilishini kutish — shu oraliqda tekshiriladi. */
const WAIT_MS = 1_500;

type Payload = { ok: true; state: "on" | "off" | "no-cashbox"; items: TransferReturnItem[] };

export default function TransferReturnNotice({ enabled, v2 = false }: { enabled: boolean; v2?: boolean }) {
  const [items, setItems] = useState<TransferReturnItem[]>([]);
  const [open, setOpen] = useState(false);
  /** `open` ning nusxasi — so'rov javobi eskirgan yopilish holatini ko'rmasin. */
  const openRef = useRef(false);
  /** Shu sessiyada yopilgan qatorlar — «ko'rildi» yozilguncha GET ularni yana bersa ham chiqmasin. */
  const acked = useRef(new Set<number>());
  const busy = useRef(false);
  const stopped = useRef(false);
  const lastOkAt = useRef(0);
  const lastActiveAt = useRef(0);

  const run = useCallback(async () => {
    if (busy.current || stopped.current) return;
    busy.current = true;
    try {
      const d = await fetchJson<Payload>("/api/transfer-returns");
      lastOkAt.current = Date.now();
      if (d.state !== "on") stopped.current = true;
      // Ochiq oynadagi ro'yxat almashmasin (o'qib turgan qator sakramasin) —
      // yangisi oyna yopilgach keyingi so'rovda chiqadi.
      if (!openRef.current) setItems((d.items ?? []).filter((x) => !acked.current.has(x.id)));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) stopped.current = true;
    } finally {
      busy.current = false;
    }
  }, []);

  // So'rov halqasi — components/shared/TaskInboxProvider.tsx bilan bir xil.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    lastActiveAt.current = Date.now();
    const bump = () => {
      lastActiveAt.current = Date.now();
    };
    window.addEventListener("pointerdown", bump, { passive: true });
    window.addEventListener("keydown", bump, { passive: true });
    window.addEventListener("focus", bump);
    const onTick = () => {
      if (cancelled || document.hidden) return;
      if (Date.now() - lastActiveAt.current > IDLE_MS) return;
      void run();
    };
    const first = setTimeout(() => {
      if (!cancelled) void run();
    }, 0);
    const timer = setInterval(onTick, POLL_MS);
    const onVisible = () => {
      if (cancelled || document.hidden) return;
      bump();
      if (Date.now() - lastOkAt.current > STALE_MS) void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("focus", bump);
    };
  }, [enabled, run]);

  // Xabar bor — boshqa modal (forma, topshiriq oynasi) yopilgach ochiladi.
  const pending = items.length > 0 && !open;
  useEffect(() => {
    if (!pending) return;
    const tryOpen = () => {
      if (document.querySelector('[aria-modal="true"]')) return;
      openRef.current = true;
      setOpen(true);
    };
    const first = setTimeout(tryOpen, 0);
    const timer = setInterval(tryOpen, WAIT_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [pending]);

  const onClosed = () => {
    const ids = items.map((x) => x.id);
    for (const id of ids) acked.current.add(id);
    openRef.current = false;
    setOpen(false);
    setItems([]);
    // Ochiq «Kassalar» sahifasi yangi qoldiqni ko'rsatsin (yangi versiya tinglaydi).
    emitMoneyChanged();
    if (ids.length === 0) return;
    fetchJson("/api/transfer-returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen: ids }),
    }).catch(() => {
      // Yozilmadi — keyingi so'rovda oyna yana chiqadi.
      for (const id of ids) acked.current.delete(id);
    });
  };

  if (!open || items.length === 0) return null;
  return <NoticeModal items={items} v2={v2} onClose={onClosed} />;
}

function fmtDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function NoticeModal({ items, v2, onClose }: { items: TransferReturnItem[]; v2: boolean; onClose: () => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const many = items.length > 1;

  // Ikki versiya — bitta tuzilish, ranglar o'z tizimidan.
  const c = v2
    ? {
        shell: "overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface font-v2 text-v2-text shadow-v2-md",
        icon: "flex size-10 shrink-0 items-center justify-center rounded-v2-md bg-v2-danger-bg text-v2-danger",
        title: "text-v2-section text-v2-text",
        sub: "mt-0.5 text-v2-small text-v2-text-2",
        card: "rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-2.5",
        amount: "text-v2-body font-semibold tabular-nums text-v2-text",
        muted: "text-v2-caption text-v2-text-3",
        line: "text-v2-small text-v2-text-2",
        reason: "mt-1.5 whitespace-pre-wrap break-words rounded-v2-sm bg-v2-surface px-2.5 py-1.5 text-v2-small text-v2-text",
        badge: "inline-flex rounded-v2-full bg-v2-warning-bg px-1.5 py-px text-[11px] font-medium text-v2-warning",
        foot: "flex justify-end border-t border-v2-border bg-v2-surface-2 px-5 py-3",
        btn: "inline-flex h-9 items-center rounded-v2-md bg-v2-brand px-5 text-v2-body font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:shadow-v2-focus focus-visible:outline-none",
      }
    : {
        shell: "overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-xl",
        icon: "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600",
        title: "text-[16px] font-semibold",
        sub: "mt-0.5 text-[13px] text-muted-foreground",
        card: "rounded-lg border border-border bg-secondary/40 px-3 py-2.5",
        amount: "text-[14px] font-semibold tabular-nums",
        muted: "text-[11.5px] text-muted-foreground",
        line: "text-[12.5px] text-foreground/80",
        reason: "mt-1.5 whitespace-pre-wrap break-words rounded-md bg-background px-2.5 py-1.5 text-[13px]",
        badge: "inline-flex rounded-full bg-amber-500/15 px-1.5 py-px text-[11px] font-medium text-amber-700",
        foot: "flex justify-end border-t border-border px-5 py-3",
        btn: "inline-flex h-9 items-center rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90",
      };

  return (
    <Modal
      onClose={onClose}
      controller={modal}
      bare
      size="md"
      zIndex={1250}
      panelClassName="bg-transparent! border-0! shadow-none! rounded-none! overflow-hidden max-w-[460px]!"
    >
      <div data-ui={v2 ? "v2" : undefined} role="alertdialog" aria-label={t("Siz yuborgan pulni rahbar bekor qildi")} className={c.shell}>
        <div className="flex gap-3 px-5 pt-5">
          <span className={c.icon} aria-hidden>
            <Undo2 className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className={c.title}>{t("Siz yuborgan pulni rahbar bekor qildi")}</h2>
            <p className={c.sub}>{many ? t("{n} ta ko'chirma bekor qilindi — pul kassangizga qaytdi.", { n: items.length }) : t("Pul kassangizga qaytdi.")}</p>
          </div>
        </div>

        <ul className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-4">
          {items.map((x) => (
            <li key={x.id} className={c.card}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className={c.amount}>
                  {uzMoney(x.amount)} {t("so'm")}
                  {x.method && <span className="font-normal"> · {t(x.method)}</span>}
                </span>
                <span className={c.muted}>
                  {t("Jo'natilgan")}: {fmtDay(x.sentDate)}
                  {x.sentTime ? ` ${x.sentTime}` : ""}
                </span>
              </div>
              {(x.fromCashbox || x.toCashbox) && (
                <div className={c.line}>
                  {x.fromCashbox || "—"} → {x.toCashbox || "—"}
                </div>
              )}
              <div className={`mt-1 ${c.line}`}>
                {t("Bekor qildi")}: <span className="font-medium">{x.returnedBy || "—"}</span>
                {x.returnedAt && <span> · {uzStamp(new Date(x.returnedAt))}</span>}
              </div>
              {x.afterConfirm && (
                <div className="mt-1">
                  <span className={c.badge}>{t("Qabul qilingandan keyin bekor qilindi")}</span>
                </div>
              )}
              <div className={c.reason}>
                <span className={c.muted}>{t("Sabab")}: </span>
                {x.comment || <span className={c.muted}>{t("Sabab yozilmagan")}</span>}
              </div>
            </li>
          ))}
        </ul>

        <div className={c.foot}>
          <button type="button" autoFocus onClick={modal.close} className={c.btn}>
            {t("Tushunarli")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
