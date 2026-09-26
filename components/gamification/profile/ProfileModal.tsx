"use client";

import "../gamification.css";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useLang, useT } from "@/components/shared/Language";
import { MONTHS } from "@/lib/i18n";
import type { GamLevel, GamRole } from "@/lib/gamification/types";
import { gamApi } from "../api";
import { btnGhost, btnSm, Chip, fmtDate, signed, Signed, withReward } from "../ui";
import ReasonModal, { type ReasonDone, type ReasonOption } from "../lesson/ReasonModal";
import { GiveModal, ReturnModal, type ReturnTarget } from "../shop/ShopModals";
import CancelModal from "./CancelModal";
import ReferralModal, { type ReferralDone } from "./ReferralModal";
import ShopSections, { type WishItem } from "./ShopSections";

// O'QUVCHI PROFILI — ko'rish oynasi (TZ 5.4; prototipdagi profile()).
// Esc bilan yopiladi; sarlavha va «Yopish» yuqorida qotib turadi. Ichki
// forma oynalari (sabab, do'st bonusi, bekor qilish, sovg'a berish va
// qaytarish) ustiga ochiladi va yopilganda profilga qaytiladi.

type Toast = (text: string, opts?: { error?: boolean; undo?: () => Promise<void> | void }) => void;

interface GroupRow {
  id: number;
  label: string;
  points: number;
  rank: number | null;
  total: number;
  streak: { run: number; next: number };
  exam: { prev: number | null; cur: number | null };
  absentToday: boolean;
}

interface Profile {
  enabled: boolean;
  role: GamRole;
  today: string;
  month: string;
  pupil: { id: number; name: string; grade: number | null; toifa: "kids" | "older"; branchName: string; frozen: boolean };
  wallet: { balance: number; earnedTotal: number };
  levels: GamLevel[];
  levelIndex: number;
  streakOn: boolean;
  streakBonus: number;
  bestStreak: { run: number; next: number; group: string } | null;
  groups: GroupRow[];
  actions: { reason: boolean; referral: boolean };
  referralBonus: number;
  badges: { code: string; emoji: string; name: string; desc: string; earned: boolean; earnedAt: string | null; times: number }[];
  reasons: ReasonOption[];
  reasonUse: Record<number, number>;
  deducted: number;
  dailyLimit: number;
  objectionDays: number;
}

type Filter = "all" | "month" | "plus" | "minus" | "shop" | "cancelled";
interface HistoryRow {
  id: number;
  date: string;
  type: string;
  label: string;
  note: string;
  groupId: number | null;
  groupLabel: string | null;
  amount: number;
  applied: number;
  status: "active" | "cancelled";
  cancelNote: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  createdByName: string;
  action: "cancel" | "excuse" | "unexcuse" | "expired" | "return" | null;
  order: { id: number; itemName: string; priceCoins: number; givenDate: string; kind: "item" | "service" | "discount" } | null;
}

export function ToifaChip({ toifa }: { toifa: "kids" | "older" }) {
  const { t } = useT();
  return toifa === "kids" ? <Chip tone="b">{t("Kichiklar")}</Chip> : <Chip tone="m">{t("Kattalar")}</Chip>;
}

function Stat({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="text-[12px] font-semibold text-muted-foreground">{title}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function ProfileModal({
  pupilId,
  onClose,
  toast,
  onChanged,
}: {
  pupilId: number;
  onClose: () => void;
  toast: Toast;
  /** Tanga o'zgardi — chaqiruvchi ro'yxatini yangilasin. */
  onChanged?: () => void;
}) {
  const { t } = useT();
  const [lang] = useLang();
  const modal = useModalClose(onClose);
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [hist, setHist] = useState<{ rows: HistoryRow[]; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState<
    | null
    | { kind: "reason" }
    | { kind: "referral" }
    | { kind: "cancel"; txId: number }
    | { kind: "give"; item: WishItem }
    | { kind: "return"; order: ReturnTarget }
  >(null);
  // Do'kon bo'limlari (istaklar, xaridlar) shu kalit o'zgarganda qayta yuklanadi.
  const [shopKey, setShopKey] = useState(0);

  const loadProfile = useCallback(
    () =>
      gamApi<Profile>(`/api/gamification/students/${pupilId}`).then((res) => {
        if (res.ok) setP(res);
        else setErr(res.error);
      }),
    [pupilId],
  );
  const loadHistory = useCallback(
    (f: Filter, offset: number, append: boolean) =>
      gamApi<{ rows: HistoryRow[]; total: number }>(`/api/gamification/students/${pupilId}/transactions?filter=${f}&offset=${offset}`).then((res) => {
        if (!res.ok) return;
        setHist((h) => (append && h ? { rows: [...h.rows, ...res.rows], total: res.total } : { rows: res.rows, total: res.total }));
      }),
    [pupilId],
  );

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);
  useEffect(() => {
    void loadHistory(filter, 0, false);
  }, [loadHistory, filter]);

  const refresh = useCallback(async () => {
    setShopKey((k) => k + 1);
    await Promise.all([loadProfile(), loadHistory(filter, 0, false)]);
    onChanged?.();
  }, [loadProfile, loadHistory, filter, onChanged]);

  const monthName = (m: string) => (MONTHS[lang] ?? MONTHS.uz)[Number(m.slice(5, 7)) - 1] ?? m;

  async function undo(txId: number) {
    const res = await gamApi<object>(`/api/gamification/transactions/${txId}/undo`, { method: "POST", body: {} });
    if (!res.ok) toast(t(res.error), { error: true });
    else toast(t("Ortga qaytarildi"));
    await refresh();
  }

  async function excuse(row: HistoryRow, action: "excuse" | "unexcuse", isUndo = false) {
    if (busy || row.groupId === null) return;
    setBusy(true);
    const res = await gamApi<{ refunded: number }>("/api/gamification/excuse", {
      method: "POST",
      body: { groupId: row.groupId, pupilId, date: row.date, action },
    });
    setBusy(false);
    await refresh();
    if (!res.ok) {
      toast(t(res.error), { error: true });
      return;
    }
    if (isUndo) {
      toast(action === "excuse" ? t("Ortga qaytarildi: sababli") : t("Ortga qaytarildi: sababsiz"));
      return;
    }
    const name = p?.pupil.name ?? "";
    const date = fmtDate(row.date);
    const msg =
      action === "excuse"
        ? res.refunded
          ? t("{name} · {date}: sababli — {n} tanga qaytarildi, seriya uzilmaydi", { name, date, n: res.refunded })
          : t("{name} · {date}: sababli, seriya uzilmaydi", { name, date })
        : t("{name} · {date}: sababsiz deb qaytarildi", { name, date });
    toast(msg, { undo: () => excuse(row, action === "excuse" ? "unexcuse" : "excuse", true) });
  }

  const header = (
    <div className="flex items-start gap-3 border-b border-border px-5 py-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[15px] font-bold text-primary">
        {(p?.pupil.name ?? "?")
          .split(/\s+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join("")}
      </div>
      <div className="min-w-0 flex-1">
        <h2 id="gm-profile-title" className="truncate text-[17px] font-semibold">
          {p?.pupil.name ?? t("O'quvchi")}
        </h2>
        {p && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
            {p.pupil.grade !== null && <span className="whitespace-nowrap">{t("{n}-sinf", { n: p.pupil.grade })}</span>}
            <ToifaChip toifa={p.pupil.toifa} />
            <span>· {p.pupil.branchName}</span>
            {p.pupil.frozen ? <Chip tone="m">{t("Ketgan — muzlatilgan")}</Chip> : <Chip tone="g">{t("Faol")}</Chip>}
          </div>
        )}
      </div>
      <button type="button" className={btnGhost} onClick={modal.close}>
        {t("Yopish")}
      </button>
    </div>
  );

  let body: ReactNode;
  if (err) body = <div className="p-5 text-sm text-muted-foreground">{t(err)}</div>;
  else if (!p) body = <SpinnerBlock />;
  else {
    const L = p.levels;
    const li = p.levelIndex;
    const nx = L[li + 1];
    const pct = nx ? Math.max(0, Math.min(100, Math.round(((p.wallet.earnedTotal - L[li].minEarned) / (nx.minEarned - L[li].minEarned)) * 100))) : 100;
    const filters: [Filter, string][] = [
      ["all", t("Hammasi")],
      ["month", monthName(p.month)],
      ["plus", t("Berilgan")],
      ["minus", t("Ayirilgan")],
      ["shop", t("Do'kon")],
      ["cancelled", t("Bekor qilingan")],
    ];
    body = (
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Stat title={t("Balans")}>
            <span className="gm-coin text-[22px]">{p.wallet.balance}</span>
          </Stat>
          <Stat title={t("Daraja · {n}/{total}", { n: li + 1, total: L.length })}>
            <b className="text-[16px]">{t(L[li]?.name ?? "")}</b>
            <div className="mt-2 flex gap-1" aria-hidden>
              {L.map((l, k) => (
                <i key={l.position} title={t(l.name)} className={`h-1.5 flex-1 rounded-full ${k <= li ? "bg-primary" : "bg-secondary"}`} />
              ))}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <i className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 text-[12px] text-muted-foreground">
              {nx
                ? t("«{level}» darajasigacha {n} tanga", { level: t(nx.name), n: nx.minEarned - p.wallet.earnedTotal })
                : t("Eng yuqori daraja")}{" "}
              · {t("jami topilgan {n}", { n: p.wallet.earnedTotal })}
            </div>
          </Stat>
          <Stat title={p.groups.length > 1 && p.bestStreak ? `${t("Uzluksiz davomat")} · ${p.bestStreak.group}` : t("Uzluksiz davomat")}>
            <b className="text-[16px]">🔥 {t("{n} dars", { n: p.bestStreak?.run ?? 0 })}</b>
            {p.streakOn && p.bestStreak && (
              <div className="mt-1 text-[12px] text-muted-foreground">
                {t("yana {n} darsdan keyin +{bonus}", { n: p.bestStreak.next, bonus: p.streakBonus })}
              </div>
            )}
          </Stat>
        </div>

        {(p.actions.reason || p.actions.referral) && (
          <div className="flex flex-wrap gap-2">
            {p.actions.reason && (
              <button type="button" className={btnGhost} onClick={() => setSub({ kind: "reason" })}>
                ± {t("Sabab bo'yicha tanga")}
              </button>
            )}
            {p.actions.referral && (
              <button type="button" className={btnGhost} onClick={() => setSub({ kind: "referral" })}>
                🤝 {t("Do'st olib keldi")}
              </button>
            )}
          </div>
        )}

        <section>
          <h3 className="mb-2 text-[14px] font-semibold">{t("Guruhlar")}</h3>
          {p.groups.length === 0 ? (
            <div className="rounded-xl border border-border px-4 py-3 text-[13px] text-muted-foreground">{t("O'quvchi hozir faol guruhda emas.")}</div>
          ) : (
            <div className="gm-scroll-card overflow-x-auto rounded-2xl border border-border">
              <table className="gm-table">
                <thead>
                  <tr>
                    <th>{t("Guruh")}</th>
                    <th>{t("Reyting tangasi ({month})", { month: monthName(p.month).toLowerCase() })}</th>
                    <th>{t("Guruhdagi o'rni")}</th>
                    <th>{t("Uzluksiz davomat")}</th>
                    <th>{t("Sarhisob")}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.groups.map((g) => (
                    <tr key={g.id}>
                      <td data-l="" className="gm-lead font-semibold">
                        {g.label}
                      </td>
                      <td data-l={t("Reyting tangasi ({month})", { month: monthName(p.month).toLowerCase() })}>
                        <Signed n={g.points} />
                      </td>
                      <td data-l={t("Guruhdagi o'rni")}>{g.rank !== null ? `${g.rank} / ${g.total}` : t("— (ketgan)")}</td>
                      <td data-l={t("Uzluksiz davomat")}>
                        🔥 {t("{n} dars", { n: g.streak.run })}
                        {p.streakOn && (
                          <span className="text-[12px] text-muted-foreground"> · {t("keyingi bonusgacha {n} dars", { n: g.streak.next })}</span>
                        )}
                      </td>
                      <td data-l={t("Sarhisob")}>
                        {g.exam.prev === null && g.exam.cur === null
                          ? "—"
                          : `${g.exam.prev !== null ? `${g.exam.prev}%` : "—"} → ${g.exam.cur !== null ? `${g.exam.cur}%` : "—"}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[14px] font-semibold">{t("Nishonlar")}</h3>
          {/* 13 nishon (TZ 4.19): olinganlari rangli, olinmaganlari xira. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {p.badges.map((b) => (
              <div
                key={b.code}
                title={b.earned ? t("Olingan") : t("Hali olinmagan")}
                className={`rounded-xl border px-3 py-2.5 text-center ${b.earned ? "border-amber-400/50 bg-amber-400/10" : "border-border opacity-45 grayscale"}`}
              >
                <div className="text-[24px] leading-none">{b.emoji}</div>
                <div className="mt-1 text-[12.5px] font-semibold">
                  {t(b.name)}
                  {b.times > 1 && <span className="ml-1 text-[11px] text-muted-foreground">×{b.times}</span>}
                </div>
                <div className="text-[11.5px] leading-snug text-muted-foreground">{t(b.desc)}</div>
              </div>
            ))}
          </div>
        </section>

        <ShopSections
          pupilId={pupilId}
          pupilName={p.pupil.name}
          reloadKey={shopKey}
          onGive={(item) => setSub({ kind: "give", item })}
          onReturn={(order) => setSub({ kind: "return", order })}
        />

        <section>
          <h3 className="mb-2 text-[14px] font-semibold">{t("Tanga tarixi")}</h3>
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={t("Tarix filtri")}>
            {filters.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`gm-tap rounded-full border px-3 py-1 text-[12.5px] font-medium ${
                  filter === k ? "border-primary bg-primary text-white" : "border-border bg-card hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {!hist ? (
            <SpinnerBlock />
          ) : hist.rows.length === 0 ? (
            <div className="rounded-xl border border-border px-4 py-3 text-[13px] text-muted-foreground">{t("Bu filtr bo'yicha yozuv yo'q.")}</div>
          ) : (
            <div className="gm-scroll-card overflow-x-auto rounded-2xl border border-border">
              <table className="gm-table">
                <thead>
                  <tr>
                    <th>{t("Sana")}</th>
                    <th>{t("Turi")}</th>
                    <th>{t("Izoh")}</th>
                    <th>{t("Tanga")}</th>
                    <th>{t("Kim")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {hist.rows.map((r) => {
                    const cx = r.status === "cancelled";
                    const tone = r.type === "shop" ? "a" : r.amount < 0 ? "r" : "m";
                    return (
                      <tr key={r.id} className={cx ? "gm-cx" : ""}>
                        <td data-l={t("Sana")} className="whitespace-nowrap">
                          {fmtDate(r.date)}
                        </td>
                        <td data-l={t("Turi")}>
                          <Chip tone={tone}>{t(r.label)}</Chip>
                        </td>
                        <td data-l={t("Izoh")}>
                          <span className="text-[12.5px]">{t(r.note)}</span>
                          {r.groupLabel && <div className="text-[12px] text-muted-foreground">{r.groupLabel}</div>}
                          {cx && (
                            <div className="gm-neg text-[12px]">
                              {t("Bekor qilindi: {note} · {by}, {date}", {
                                note: t(r.cancelNote ?? ""),
                                by: t(r.cancelledByName ?? ""),
                                date: r.cancelledAt ? fmtDate(r.cancelledAt) : "",
                              })}
                            </div>
                          )}
                        </td>
                        <td data-l={t("Tanga")} className="whitespace-nowrap">
                          {cx ? <span className="gm-strike">{signed(r.amount)}</span> : <Signed n={r.amount} />}
                          {!cx && r.type !== "shop" && r.amount < 0 && r.applied !== r.amount && (
                            <div className="text-[12px] text-muted-foreground">{t("hamyondan {x} (balans yetmadi)", { x: -r.applied })}</div>
                          )}
                        </td>
                        <td data-l={t("Kim")} className="text-[12.5px] text-muted-foreground">
                          {t(r.createdByName)}
                        </td>
                        <td data-l="" className="gm-keep">
                          {r.action === "cancel" && (
                            <button type="button" className={btnSm} onClick={() => setSub({ kind: "cancel", txId: r.id })}>
                              {t("Bekor qilish")}
                            </button>
                          )}
                          {r.action === "excuse" && (
                            <button type="button" className={btnSm} disabled={busy} onClick={() => void excuse(r, "excuse")}>
                              {t("Sababli qilish")}
                            </button>
                          )}
                          {r.action === "unexcuse" && (
                            <button type="button" className={btnSm} disabled={busy} onClick={() => void excuse(r, "unexcuse")}>
                              {t("Sababsizga qaytarish")}
                            </button>
                          )}
                          {r.action === "expired" && <span className="text-[12px] text-muted-foreground">{t("e'tiroz muddati o'tgan")}</span>}
                          {r.action === "return" && r.order && (
                            <button
                              type="button"
                              className={btnSm}
                              onClick={() => {
                                const o = r.order!;
                                setSub({
                                  kind: "return",
                                  order: { id: o.id, pupilName: p.pupil.name, itemName: o.itemName, priceCoins: o.priceCoins, givenDate: o.givenDate, kind: o.kind },
                                });
                              }}
                            >
                              {t("Qaytarish")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {hist.total > hist.rows.length && (
                <div className="p-2 text-center">
                  <button type="button" className={btnSm} onClick={() => void loadHistory(filter, hist.rows.length, true)}>
                    {t("Yana ko'rsatish ({n} ta qoldi)", { n: hist.total - hist.rows.length })}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <>
      <Modal onClose={onClose} controller={modal} bare size="4xl" panelClassName="gm-page">
        <div aria-labelledby="gm-profile-title" className="flex max-h-[90vh] min-h-0 flex-col">
          <div className="shrink-0">{header}</div>
          <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        </div>
      </Modal>

      {p && sub?.kind === "reason" && (
        <ReasonModal
          target={{
            pupilId,
            name: p.pupil.name,
            balance: p.wallet.balance,
            deducted: p.deducted,
            reasonUse: p.reasonUse,
            groupId: null,
            groupLabel: "",
            absent: false,
            groups: p.groups.map((g) => ({ id: g.id, label: g.label, absentToday: g.absentToday })),
          }}
          reasons={p.reasons}
          dailyLimit={p.dailyLimit}
          objectionDays={p.objectionDays}
          onClose={() => setSub(null)}
          onDone={(res: ReasonDone) => {
            void refresh();
            const v = Math.abs(res.amount);
            const name = p.pupil.name;
            const msg =
              res.direction > 0
                ? t("{name}: +{v} · {reason}", { name, v, reason: res.reasonName })
                : res.applied === res.amount
                  ? t("{name}: −{v} · {reason}", { name, v, reason: res.reasonName })
                  : t("{name}: balans yetmadi — hamyondan {x} ayirildi (reytingda −{y})", { name, x: -res.applied, y: v });
            const txId = res.txId;
            toast(withReward(t, msg, name, res), { undo: txId ? () => undo(txId) : undefined });
          }}
        />
      )}
      {p && sub?.kind === "referral" && (
        <ReferralModal
          pupilId={pupilId}
          pupilName={p.pupil.name}
          bonus={p.referralBonus}
          onClose={() => setSub(null)}
          onDone={(res: ReferralDone) => {
            void refresh();
            const name = p.pupil.name;
            toast(withReward(t, t("{name}: +{n} · do'st olib keldi", { name, n: res.amount }), name, res), {
              undo: () => undo(res.txId),
            });
          }}
        />
      )}
      {p && sub?.kind === "give" && (
        <GiveModal
          item={{
            id: sub.item.itemId,
            title: sub.item.title,
            priceCoins: sub.item.price,
            audience: sub.item.audience,
            kind: sub.item.kind,
            imageUrl: sub.item.imageUrl,
            emoji: sub.item.emoji,
          }}
          branchId={null}
          preselect={pupilId}
          onClose={() => setSub(null)}
          onDone={(r) => {
            void refresh();
            const msg = t("{name}: «{title}» berildi, −{n} tanga", { name: r.pupilName, title: t(r.title), n: r.price });
            toast(withReward(t, r.wished ? `${msg} · ${t("istaklardan olindi")}` : msg, r.pupilName, r));
          }}
        />
      )}
      {sub?.kind === "return" && (
        <ReturnModal
          order={sub.order}
          onClose={() => setSub(null)}
          onDone={() => {
            void refresh();
            toast(t("{name}: «{title}» qaytarildi, +{n} tanga", { name: sub.order.pupilName, title: t(sub.order.itemName), n: sub.order.priceCoins }));
          }}
        />
      )}
      {sub?.kind === "cancel" && (
        <CancelModal
          txId={sub.txId}
          onClose={() => setSub(null)}
          onDone={() => {
            void refresh();
            toast(t("Yozuv bekor qilindi"));
          }}
        />
      )}
    </>
  );
}
