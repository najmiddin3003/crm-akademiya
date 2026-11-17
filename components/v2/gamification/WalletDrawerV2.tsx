"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Clock,
  Compass,
  Crown,
  ExternalLink,
  FlaskConical,
  Flame,
  Footprints,
  Gift,
  GraduationCap,
  Heart,
  Loader2,
  Send,
  Shield,
  Star,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { gamApi } from "@/components/gamification/api";
import { withReward } from "@/components/gamification/ui";
import ReasonModal, { type ReasonDone, type ReasonOption } from "@/components/gamification/lesson/ReasonModal";
import { GiveModal, ReturnModal, type ReturnTarget } from "@/components/gamification/shop/ShopModals";
import CancelModal from "@/components/gamification/profile/CancelModal";
import ReferralModal, { type ReferralDone } from "@/components/gamification/profile/ReferralModal";
import type { WishItem } from "@/components/gamification/profile/ShopSections";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { initialsOf } from "@/components/v2/students/lists/listKit";
import { uzParts } from "./gamBits";
import { CoinDot, LevelBadge } from "./levelBits";

// YANGI VERSIYA — «O'QUVCHI HAMYONI» (33-qism, rasm «Hamyonlar · O'quvchi hamyoni»): o'ngdan panel.
// Balans (oyda +N), daraja (keyingisigacha), uzluksiz davomat; amallar «± Sabab bo'yicha tanga»,
// «Do'st olib keldi», «Sovg'a berish» (istaklardan); guruhlar jadvali (reyting, o'rni, uzluksiz,
// Sarhisob); nishonlar (olinmaganlari kulrang); istaklar («Berish»); tanga tarixi (filtrlar,
// bekor qilish / qaytarish); o'quvchi havolasi. Server — mavjud API'lar:
//   GET /api/gamification/students/:id               — profil (lib/gamification/students.ts → studentProfile)
//   GET /api/gamification/students/:id/shop          — istaklar va xaridlar
//   GET /api/gamification/students/:id/transactions  — tarix (?filter=&offset=)
//   GET/POST /api/gamification/students/:id/access-token — havola
// Amal oynalari — eski (ReasonModal, ReferralModal, GiveModal, ReturnModal, CancelModal).

type Toast = (text: string, opts?: { error?: boolean; undo?: () => Promise<void> | void }) => void;

interface Profile {
  enabled: boolean;
  role: string;
  month: string;
  pupil: { id: number; name: string; grade: number | null; toifa: "kids" | "older"; branchName: string; frozen: boolean };
  wallet: { balance: number; earnedTotal: number };
  levels: { position: number; name: string; minEarned: number }[];
  levelIndex: number;
  streakOn: boolean;
  streakBonus: number;
  bestStreak: { run: number; next: number; group: string } | null;
  groups: { id: number; label: string; points: number; rank: number | null; total: number; streak: { run: number; next: number }; exam: { prev: number | null; cur: number | null }; absentToday: boolean }[];
  actions: { reason: boolean; referral: boolean };
  referralBonus: number;
  badges: { code: string; name: string; desc: string; earned: boolean; earnedAt: string | null; times: number }[];
  reasons: ReasonOption[];
  reasonUse: Record<number, number>;
  deducted: number;
  dailyLimit: number;
  objectionDays: number;
}

interface PupilShop {
  wishlistMax: number;
  balance: number;
  canGive: boolean;
  wishes: WishItem[];
  orders: { id: number; itemName: string; priceCoins: number; givenDate: string; status: "given" | "returned" }[];
}

interface HistRow {
  id: number;
  date: string;
  type: string;
  label: string;
  note: string;
  groupLabel: string | null;
  amount: number;
  applied: number;
  status: "active" | "cancelled";
  cancelNote: string | null;
  createdByName: string;
  createdAt: string;
  action: "cancel" | "excuse" | "unexcuse" | "expired" | "return" | null;
  order: { id: number; itemName: string; priceCoins: number; givenDate: string; kind: "item" | "service" | "discount" } | null;
}

interface Access {
  path: string | null;
  links: { id: number }[];
}

type Filter = "all" | "month" | "plus" | "minus" | "shop" | "cancelled";

const BADGE_ICON: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  first_coin: Footprints,
  on_time: Clock,
  iron_discipline: Shield,
  homework_master: ClipboardCheck,
  active: Zap,
  excellent: Star,
  growth: TrendingUp,
  friendship: Users,
  level_2: Compass,
  level_3: BookOpen,
  level_4: FlaskConical,
  level_5: GraduationCap,
  student_of_month: Crown,
};

const signedNum = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

type Sub =
  | { kind: "reason" }
  | { kind: "referral" }
  | { kind: "give"; item: WishItem }
  | { kind: "return"; order: ReturnTarget }
  | { kind: "cancel"; txId: number };

export default function WalletDrawerV2({
  pupilId,
  monthNet: monthNetProp,
  onClose,
  onChanged,
  toast,
}: {
  pupilId: number;
  /** Ro'yxatdan — shu oy jami (guruhsiz yozuvlar bilan); bo'lmasa guruhlar yig'indisi. */
  monthNet?: number;
  onClose: () => void;
  onChanged: () => void;
  toast: Toast;
}) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [p, setP] = useState<Profile | null>(null);
  const [shop, setShop] = useState<PupilShop | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [filter, setFilter] = useState<Filter>("month");
  const [hist, setHist] = useState<{ rows: HistRow[]; total: number } | null>(null);
  const [err, setErr] = useState("");
  const [sub, setSub] = useState<Sub | null>(null);
  const [ver, setVer] = useState(0);

  const base = `/api/gamification/students/${pupilId}`;

  useEffect(() => {
    let alive = true;
    void Promise.all([gamApi<Profile>(base), gamApi<PupilShop>(`${base}/shop`)]).then(([a, b]) => {
      if (!alive) return;
      if (a.ok) setP(a);
      else setErr(a.error);
      if (b.ok) setShop(b);
    });
    return () => {
      alive = false;
    };
  }, [base, ver]);

  useEffect(() => {
    let alive = true;
    void gamApi<{ rows: HistRow[]; total: number }>(`${base}/transactions?filter=${filter}&offset=0`).then((r) => {
      if (alive && r.ok) setHist(r);
    });
    return () => {
      alive = false;
    };
  }, [base, filter, ver]);

  useEffect(() => {
    if (!p || p.role === "teacher") return;
    let alive = true;
    void gamApi<Access>(`${base}/access-token`).then((r) => {
      if (alive && r.ok) setAccess(r);
    });
    return () => {
      alive = false;
    };
  }, [base, p]);

  const refresh = useCallback(() => {
    setVer((v) => v + 1);
    onChanged();
  }, [onChanged]);

  async function undo(txId: number) {
    const r = await gamApi(`/api/gamification/transactions/${txId}/undo`, { method: "POST", body: {} });
    if (!r.ok) toast(t(r.error), { error: true });
    else toast(t("Ortga qaytarildi"));
    refresh();
  }

  async function copyLink() {
    let path = access?.path ?? null;
    if (!path) {
      const r = await gamApi<Access>(`${base}/access-token`, { method: "POST", body: {} });
      if (!r.ok) return toast(t(r.error), { error: true });
      setAccess(r);
      path = r.path;
    }
    if (!path) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast(t("Havola nusxalandi"));
    } catch {
      toast(t("Nusxalab bo'lmadi — havolani qo'lda belgilab oling"), { error: true });
    }
  }

  const title = p ? (
    <span className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-v2-brand-bg text-v2-body font-semibold text-v2-brand-text">{initialsOf(p.pupil.name)}</span>
      <span className="min-w-0">
        <span className="block truncate">{p.pupil.name}</span>
        <span className="block truncate text-v2-small font-normal text-v2-text-2">
          {[p.pupil.toifa === "kids" ? t("Kichiklar") : t("Kattalar"), p.pupil.grade ? t("{n}-sinf", { n: p.pupil.grade }) : "", p.pupil.branchName].filter(Boolean).join(" · ")}
        </span>
      </span>
    </span>
  ) : (
    t("O'quvchi hamyoni")
  );

  const lvl = p ? p.levels[p.levelIndex] : null;
  const next = p ? p.levels[p.levelIndex + 1] ?? null : null;
  const lvlPct = p && lvl && next ? Math.min(100, ((p.wallet.earnedTotal - lvl.minEarned) / Math.max(1, next.minEarned - lvl.minEarned)) * 100) : 100;
  const monthNet = monthNetProp ?? (p ? p.groups.reduce((a, g) => a + g.points, 0) : 0);
  const lastOrder = shop?.orders.find((o) => o.status === "given") ?? null;
  const earnedBadges = p ? p.badges.filter((b) => b.earned).length : 0;
  const wishes = shop?.wishes ?? [];
  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: t("Hammasi") },
    { key: "month", label: p ? fmt.monthName(p.month) : t("Shu oy") },
    { key: "plus", label: t("Berilgan") },
    { key: "minus", label: t("Ayirilgan") },
    { key: "shop", label: t("Do'kon") },
    { key: "cancelled", label: t("Bekor qilingan") },
  ];

  return (
    <>
      <V2Dialog variant="right" width={620} title={title} onClose={onClose}>
        {!p ? (
          <div className="flex items-center gap-2 py-10 text-v2-small text-v2-text-3">
            {err ? t(err) : <Loader2 className="size-4 animate-spin" aria-hidden />}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-end">
              <Link href={`/student-edit/${p.pupil.id}`} className="inline-flex items-center gap-1.5 text-v2-small font-semibold text-v2-brand hover:underline">
                {t("O'quvchi sahifasi")} <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
              </Link>
            </div>

            {/* Balans · daraja · uzluksiz */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-v2-lg border border-v2-border bg-v2-warning-bg p-4">
                <span className="text-v2-small font-semibold text-v2-warning">{t("Balans")}</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="size-3.5 rounded-full bg-v2-warning" aria-hidden />
                  <b className="text-[30px] font-semibold leading-none tabular-nums text-v2-text">{p.wallet.balance}</b>
                </div>
                <span className="mt-2 block text-v2-small text-v2-text-2">
                  {t("{month}da", { month: fmt.monthLower(p.month) })} <b className={`font-semibold ${monthNet >= 0 ? "text-v2-success" : "text-v2-danger"}`}>{signedNum(monthNet)}</b>
                </span>
              </div>
              <div className="rounded-v2-lg border border-v2-border p-4">
                <span className="text-v2-small text-v2-text-2">{t("Daraja")}</span>
                {lvl && (
                  <div className="mt-1">
                    <LevelBadge position={lvl.position} name={lvl.name} />
                  </div>
                )}
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
                  <div className="h-full rounded-full bg-v2-success" style={{ width: `${lvlPct}%` }} />
                </div>
                <span className="mt-2 block text-v2-small text-v2-text-2">
                  {t("jami topilgan {n}", { n: p.wallet.earnedTotal })}
                  {next && (
                    <>
                      {" · «"}
                      {t(next.name)}
                      {"»"}
                      {t("gacha")} <b className="font-semibold text-v2-text">{Math.max(0, next.minEarned - p.wallet.earnedTotal)}</b>
                    </>
                  )}
                </span>
              </div>
              <div className="rounded-v2-lg border border-v2-border p-4">
                <span className="text-v2-small text-v2-text-2">{t("Uzluksiz davomat")}</span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <Flame className="size-5 self-center text-v2-danger" strokeWidth={2} aria-hidden />
                  <b className="text-[26px] font-semibold tabular-nums text-v2-text">{p.bestStreak?.run ?? 0}</b>
                  <span className="text-v2-small text-v2-text-2">{t("dars")}</span>
                </div>
                {p.streakOn && p.bestStreak && (
                  <span className="mt-1 block text-v2-small text-v2-text-2">
                    {t("yana {n} darsdan keyin", { n: p.bestStreak.next })} <b className="font-semibold text-v2-success">+{p.streakBonus}</b>
                  </span>
                )}
              </div>
            </div>

            {/* Amallar */}
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" disabled={!p.actions.reason} onClick={() => setSub({ kind: "reason" })} className={`${secondaryBtn} justify-center disabled:opacity-50`}>
                ± {t("Sabab bo'yicha tanga")}
              </button>
              <button type="button" disabled={!p.actions.referral} onClick={() => setSub({ kind: "referral" })} className={`${secondaryBtn} justify-center disabled:opacity-50`}>
                <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Do'st olib keldi")}
              </button>
              <Link href="/gamification-shop" className={`${primaryBtn} justify-center ${shop?.canGive ? "" : "pointer-events-none opacity-50"}`}>
                <Gift className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Sovg'a berish")}
              </Link>
            </div>

            {/* Guruhlar */}
            {p.groups.length > 0 && (
              <section>
                <h3 className="mb-2 text-v2-small font-semibold text-v2-text-2">
                  {t("Guruhlar")} · {fmt.monthLower(p.month)}
                </h3>
                <div className="overflow-hidden rounded-v2-lg border border-v2-border">
                  <table className="w-full border-collapse text-v2-small">
                    <thead>
                      <tr className="border-b border-v2-border bg-v2-surface-2 text-left text-v2-text-2">
                        <th className="px-3 py-2 font-medium">{t("Guruh")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("Reyting")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("O'rni")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("Uzluksiz")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("Sarhisob")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.groups.map((g) => (
                        <tr key={g.id} className="border-b border-v2-border last:border-b-0">
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2">
                              <span className={`size-2 shrink-0 rounded-[2px] ${FAN_DOT[fanOf(g.label)]}`} aria-hidden />
                              <span className="truncate text-v2-text">{g.label}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-v2-text">{g.points}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <b className="font-semibold text-v2-text">{g.rank ?? "—"}</b> <span className="text-v2-text-3">/ {g.total}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-v2-text-2">{t("{n} dars", { n: g.streak.run })}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-v2-text-2">{g.exam.cur !== null ? `${g.exam.cur}%` : g.exam.prev !== null ? `${g.exam.prev}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Nishonlar */}
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-v2-small font-semibold text-v2-text-2">
                  {t("Nishonlar")} · {earnedBadges} / {p.badges.length}
                </h3>
                <span className="text-v2-caption text-v2-text-3">{t("kulrang — hali olinmagan")}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {p.badges.map((b) => {
                  const Icon = BADGE_ICON[b.code] ?? Star;
                  return (
                    <div
                      key={b.code}
                      title={`${t(b.desc)}${b.earnedAt ? ` · ${fmt.dayMonth(uzParts(b.earnedAt).iso)}` : ""}`}
                      className={`flex flex-col items-center gap-1.5 rounded-v2-md border px-1.5 py-3 text-center ${b.earned ? "border-v2-border" : "border-dashed border-v2-border opacity-60"}`}
                    >
                      <span className={`grid size-9 place-items-center rounded-full ${b.earned ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-surface-2 text-v2-text-3"}`}>
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                      <span className={`text-v2-caption font-semibold leading-tight ${b.earned ? "text-v2-text" : "text-v2-text-2"}`}>
                        {t(b.name)}
                        {b.times > 1 ? ` ×${b.times}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Istaklar */}
            {shop && (
              <section>
                <h3 className="mb-2 text-v2-small font-semibold text-v2-text-2">
                  {t("Istaklari")} · {wishes.length} / {shop.wishlistMax}
                </h3>
                {wishes.length === 0 ? (
                  <p className="rounded-v2-md border border-dashed border-v2-border px-3 py-3 text-v2-small text-v2-text-3">{t("O'quvchi hali istak qo'shmagan")}</p>
                ) : (
                  <div className="overflow-hidden rounded-v2-lg border border-v2-border">
                    {wishes.map((w) => (
                      <div key={w.itemId} className="flex items-center gap-3 border-b border-v2-border px-3 py-2.5 last:border-b-0">
                        <Heart className="size-4 shrink-0 fill-v2-danger text-v2-danger" strokeWidth={1.75} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-v2-text">{t(w.title)}</div>
                          <div className={`truncate text-v2-small ${w.noStock ? "text-v2-danger" : w.ready ? "text-v2-success" : "text-v2-text-2"}`}>
                            {w.noStock ? t("Omborda yo'q") : w.ready ? t("Tanga yetadi") : t("Yana {n} tanga kerak", { n: Math.max(0, w.price - shop.balance) })}
                          </div>
                        </div>
                        <CoinDot n={w.price} strong />
                        <button
                          type="button"
                          disabled={!shop.canGive || !w.ready || w.noStock}
                          onClick={() => setSub({ kind: "give", item: w })}
                          className={`${secondaryBtn} h-8 disabled:opacity-50`}
                        >
                          {t("Berish")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Tanga tarixi */}
            <section>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-v2-small font-semibold text-v2-text-2">{t("Tanga tarixi")}</h3>
                {lastOrder && (
                  <span className="text-v2-caption text-v2-text-3">
                    {t("do'kondan")}: {t(lastOrder.itemName)} · {lastOrder.priceCoins} · {fmt.dayMonth(lastOrder.givenDate)}
                  </span>
                )}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={filter === f.key}
                    onClick={() => setFilter(f.key)}
                    className={`h-8 rounded-full border px-3 text-v2-small transition-colors ${filter === f.key ? "border-v2-brand bg-v2-brand-bg font-semibold text-v2-brand-text" : "border-v2-border text-v2-text-2 hover:bg-v2-hover"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="overflow-hidden rounded-v2-lg border border-v2-border">
                {!hist ? (
                  <div className="px-3 py-4 text-v2-small text-v2-text-3">
                    <Loader2 className="inline size-4 animate-spin" aria-hidden />
                  </div>
                ) : hist.rows.length === 0 ? (
                  <p className="px-3 py-4 text-v2-small text-v2-text-3">{t("Yozuv yo'q")}</p>
                ) : (
                  hist.rows.map((h) => {
                    const at = uzParts(h.createdAt || h.date);
                    const off = h.status === "cancelled";
                    return (
                      <div key={h.id} className="flex items-start gap-3 border-b border-v2-border px-3 py-2.5 last:border-b-0">
                        <div className="min-w-0 flex-1">
                          <div className={`font-semibold ${off ? "text-v2-text-3 line-through" : "text-v2-text"}`}>
                            {t(h.label)}
                            {h.note ? ` · «${h.note}»` : ""}
                          </div>
                          <div className="text-v2-small text-v2-text-2">
                            {[`${fmt.dayMonth(at.iso || h.date)}${at.hm ? ` | ${at.hm}` : ""}`, h.groupLabel, h.createdByName].filter(Boolean).join(" · ")}
                            {off && h.cancelNote ? ` · ${t("bekor")}: ${h.cancelNote}` : ""}
                          </div>
                          {(h.action === "cancel" || (h.action === "return" && h.order)) && (
                            <button
                              type="button"
                              onClick={() =>
                                h.action === "cancel"
                                  ? setSub({ kind: "cancel", txId: h.id })
                                  : setSub({
                                      kind: "return",
                                      order: { id: h.order!.id, pupilName: p.pupil.name, itemName: h.order!.itemName, priceCoins: h.order!.priceCoins, givenDate: h.order!.givenDate, kind: h.order!.kind },
                                    })
                              }
                              className="mt-1 text-v2-small font-semibold text-v2-brand hover:underline"
                            >
                              {h.action === "cancel" ? t("Bekor qilish") : t("Qaytarish")}
                            </button>
                          )}
                        </div>
                        <b className={`shrink-0 font-semibold tabular-nums ${off ? "text-v2-text-3" : h.amount > 0 ? "text-v2-success" : "text-v2-danger"}`}>{signedNum(h.amount)}</b>
                      </div>
                    );
                  })
                )}
              </div>
              {hist && hist.total > hist.rows.length && (
                <p className="mt-1.5 text-v2-caption text-v2-text-3">{t("Oxirgi {n} ta yozuv · jami {total}", { n: hist.rows.length, total: hist.total })}</p>
              )}
            </section>

            {/* Havola */}
            {p.role !== "teacher" && (
              <section className="flex items-center gap-3 rounded-v2-lg border border-v2-border bg-v2-surface-2 px-4 py-3">
                <Send className="size-5 shrink-0 text-v2-brand" strokeWidth={1.75} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-v2-text">{t("O'quvchi havolasi va Telegram")}</div>
                  <div className="text-v2-small text-v2-text-2">{t("{n} / 3 akkaunt ulangan · o'quvchi va onasi", { n: access?.links.length ?? 0 })}</div>
                </div>
                <button type="button" onClick={() => void copyLink()} className={secondaryBtn}>
                  {access?.path ? t("Havolani nusxalash") : t("Havola yaratish")}
                </button>
              </section>
            )}
          </div>
        )}
      </V2Dialog>

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
            refresh();
            const name = p.pupil.name;
            const msg = `${name}: ${signedNum(res.amount)} · ${t(res.reasonName)}`;
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
            refresh();
            toast(withReward(t, t("{name}: +{n} · do'st olib keldi", { name: p.pupil.name, n: res.amount }), p.pupil.name, res), { undo: () => undo(res.txId) });
          }}
        />
      )}
      {p && sub?.kind === "give" && (
        <GiveModal
          item={{ id: sub.item.itemId, title: sub.item.title, priceCoins: sub.item.price, audience: sub.item.audience, kind: sub.item.kind, imageUrl: sub.item.imageUrl, emoji: sub.item.emoji }}
          branchId={null}
          preselect={pupilId}
          onClose={() => setSub(null)}
          onDone={(r) => {
            refresh();
            toast(withReward(t, t("{name}: «{title}» berildi, −{n} tanga", { name: r.pupilName, title: t(r.title), n: r.price }), r.pupilName, r));
          }}
        />
      )}
      {sub?.kind === "return" && (
        <ReturnModal
          order={sub.order}
          onClose={() => setSub(null)}
          onDone={() => {
            refresh();
            toast(t("{name}: «{title}» qaytarildi, +{n} tanga", { name: sub.order.pupilName, title: t(sub.order.itemName), n: sub.order.priceCoins }));
          }}
        />
      )}
      {sub?.kind === "cancel" && (
        <CancelModal
          txId={sub.txId}
          onClose={() => setSub(null)}
          onDone={() => {
            refresh();
            toast(t("Yozuv bekor qilindi"));
          }}
        />
      )}
    </>
  );
}
