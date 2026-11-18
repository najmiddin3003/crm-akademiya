"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Info,
  Minus,
  Percent,
  Plus,
  BookOpen,
  ClipboardCheck,
  Clock,
  Coins,
  Compass,
  Crown,
  FlaskConical,
  Flame,
  Footprints,
  Gift,
  GraduationCap,
  Shield,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useT } from "@/components/shared/Language";
import StudentGame from "@/components/gamification/student/StudentGame";
import { fanOf, FAN_BG, FAN_TEXT } from "@/components/v2/ui/fan";
import { Card, CardHead, Empty, fmtSom, useCabinetFmt, type CabinetTabProps } from "./bits";
import { PageHead } from "./lessonParts";

// O'QUVCHI KABINETI (v2) — «TANGALARIM» (33-qism telefon; 44-qism kengaytmasi — rasmlar «Kabinet · Tanga», «Kabinet · Do'kon»):
//   44-qism: kengda 3 karta (Balans · Daraja · Ketma-ket), Reyting (guruhlar yonma-yon) + Istaklarim,
//   Tanga tarixi (filtr: Hammasi / Berilgan / Ayirilgan / Do'kon) + «Qanday tanga olaman», Nishonlarim to'ri.
//   «Do'kon» — o'z sahifasi (ShopView): turlar bo'yicha kartalar, «Istak» qo'shish/olish, Qanday ishlaydi,
//   Olganlarim. Ombor soni ko'rsatilmaydi (TZ 5.5) — faqat «Bor / Tugagan».
//   Balansim (oyda +N, eng yaxshi o'rin) + «Do'kon — sovg'alar»; Darajam (keyingisigacha); Ketma-ket
//   (uzluksiz davomat bonusigacha); Reyting · Top-5 (guruhlar bo'yicha segment, «siz» belgisi);
//   Nishonlarim (gorizontal); Istaklarim (tanga yetadi — «adminga ayting»).
// Ma'lumot — o'quvchi sahifasi API'si (/api/me/tg, lib/gamification/studentPage.ts), StudentGame bilan
// bitta manba. «Do'kon — sovg'alar», «+ Istak qo'shish», «hammasi» — to'liq StudentGame (do'kon, tarix,
// istak qo'shish) ochiladi, «← Tangalarim» bilan qaytiladi. Modul o'chiq — StudentGame fallback'i.

interface PageData {
  enabled: boolean;
  month: string;
  pupil: { firstName: string; center?: string };
  wallet: { balance: number; earnedTotal: number };
  levels: { position: number; name: string; minEarned: number }[];
  levelIndex: number;
  streakOn: boolean;
  streakBonus: number;
  bestStreak: { run: number; next: number; group: string } | null;
  wishlistMax: number;
  wishes: { itemId: number; title: string; price: number; ready: boolean; noStock: boolean }[];
  rankings: { groupId: number; label: string; total: number; top: { rank: number; name: string; points: number; me: boolean }[]; me: { rank: number; points: number } | null; needForTop5: number }[];
  badges: { code: string; name: string; earned: boolean }[];
  // 44-qism: tarix, do'kon, olinganlar, «Qanday tanga olaman».
  history?: { total: number; rows: HistoryRow[] };
  shop?: ShopRow[];
  orders?: { id: number; itemName: string; priceCoins: number; givenDate: string; status: string }[];
  earnRules?: { name: string; amount: string; minus: boolean }[];
}
export interface HistoryRow {
  id: number;
  date: string;
  label: string;
  note: string;
  groupLabel: string;
  amount: number;
  status: string;
  createdByName: string;
}
export interface ShopRow {
  id: number;
  title: string;
  kind: string;
  percent: number | null;
  emoji: string | null;
  price: number;
  wished: boolean;
  need: number;
  inStock?: boolean;
}

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

const LEVEL_TONE = ["bg-v2-surface-2 text-v2-text-2", "bg-v2-success-bg text-v2-success", "bg-v2-info-bg text-v2-info", "bg-v2-violet-bg text-v2-violet", "bg-v2-warning-bg text-v2-warning"];
const courseOf = (label: string) => label.replace(/\s*\(.*\)\s*$/, "").trim() || label;

export default function TangaTab({ me, cab, initData }: CabinetTabProps) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const [data, setData] = useState<PageData | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<"overview" | "me" | "shop">("overview");
  const [gi, setGi] = useState(0);

  const load = useCallback(() => {
    const q = new URLSearchParams({ pupilId: String(me.profile.id) });
    return fetch(`/api/me/tg?${q}`, { headers: { "X-Telegram-Init-Data": initData } })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setData(j as PageData);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [initData, me.profile.id]);

  useEffect(() => {
    if (view !== "me") void load();
  }, [load, view]);

  const fallback = (
    <Card>
      <CardHead title={t("Tangalar")} icon={<Coins className="size-4 text-v2-text-3" strokeWidth={1.75} aria-hidden />} />
      <div className="py-3 text-center">
        <div className="text-v2-number tabular-nums text-v2-brand-text">{fmtSom(me.profile.coin)}</div>
        <p className="mx-auto mt-2 max-w-sm text-v2-small text-v2-text-3">{t("Koinlar faollik va yutuqlar uchun beriladi. Sarflash tartibi haqida ustozingizdan so'rang.")}</p>
      </div>
    </Card>
  );

  // To'liq tarix (StudentGame) yoki modul o'chiq / ma'lumot kelmadi — avvalgi StudentGame.
  if (view === "me" || failed || (data && !data.enabled)) {
    return (
      <div className="space-y-4">
        {view !== "overview" && <BackLink label={t("Tangalarim")} onClick={() => setView("overview")} />}
        <StudentGame key={view} source={{ kind: "tg", initData }} pupilId={me.profile.id} embedded initialTab="me" fallback={fallback} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHead title={t("Tangalarim")} />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-v2-lg bg-v2-skeleton" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-v2-lg bg-v2-skeleton" />
      </div>
    );
  }

  if (view === "shop") return <ShopView data={data} initData={initData} pupilId={me.profile.id} branch={cab.branch.name || me.profile.branch} onBack={() => setView("overview")} onChanged={load} />;

  const lvl = data.levels[data.levelIndex];
  const next = data.levels[data.levelIndex + 1] ?? null;
  const lvlPct = lvl && next ? Math.min(100, ((data.wallet.earnedTotal - lvl.minEarned) / Math.max(1, next.minEarned - lvl.minEarned)) * 100) : 100;
  const monthNet = data.rankings.reduce((a, r) => a + (r.me?.points ?? 0), 0);
  const best = [...data.rankings].filter((r) => r.me && r.me.points > 0).sort((a, b) => a.me!.rank - b.me!.rank)[0] ?? null;
  const rk = data.rankings[Math.min(gi, Math.max(0, data.rankings.length - 1))] ?? null;
  const earned = data.badges.filter((b) => b.earned).length;
  const badges = [...data.badges].sort((a, b) => Number(b.earned) - Number(a.earned));
  const monthName = fmt.monthName(data.month);
  const day = Number(cab.today.slice(8, 10));
  const nextMonth = (() => {
    const [y, m] = data.month.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  })();
  const sub = [cab.groups.map((g) => g.title).join(t(" va ")), fmt.monthLower(data.month)].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <PageHead
        title={t("Tangalarim")}
        sub={sub}
        right={
          <button type="button" onClick={() => setView("shop")} className="inline-flex h-10 items-center gap-2 rounded-v2-md bg-v2-brand px-4 text-v2-small font-semibold text-v2-on-brand hover:opacity-90">
            <Gift className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Do'kon — sovg'alar")}
          </button>
        }
      />

      {/* Balansim · Darajam · Ketma-ket */}
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-v2-lg border border-v2-border bg-v2-warning-bg p-5 md:bg-v2-surface">
          <span className="text-v2-small text-v2-text-2">{t("Balansim")}</span>
          <div className="mt-2 flex items-center gap-3">
            <span className="size-9 rounded-full bg-v2-warning" aria-hidden />
            <b className="text-[40px] font-semibold leading-none tabular-nums text-v2-text">{fmtSom(data.wallet.balance)}</b>
            <span className="text-v2-body text-v2-text-2">{t("tanga")}</span>
          </div>
          <p className="mt-3 text-v2-small text-v2-text-2">
            {t("{month}da", { month: monthName })} <b className={`font-semibold ${monthNet >= 0 ? "text-v2-success" : "text-v2-danger"}`}>{monthNet > 0 ? `+${monthNet}` : monthNet}</b>
            {best && (
              <>
                {" · "}
                {t("{course}da", { course: courseOf(best.label) })} <b className="font-semibold text-v2-text">{t("{n}-o'rin", { n: best.me!.rank })}</b>
              </>
            )}
            {" · "}
            {t("jami topilgan {n}", { n: fmtSom(data.wallet.earnedTotal) })}
          </p>
        </section>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="text-v2-small text-v2-text-2">{t("Darajam")}</span>
            {lvl && (
              <span className={`inline-flex items-center gap-1 rounded-v2-sm px-2 py-0.5 text-v2-caption font-semibold ${LEVEL_TONE[data.levelIndex] ?? LEVEL_TONE[0]}`}>
                {lvl.position} · {t(lvl.name)}
              </span>
            )}
          </div>
          <div className="mt-2 text-v2-section text-v2-text">{lvl ? t(lvl.name) : "—"}</div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-v2-surface-2">
            <div className="h-full rounded-full bg-v2-success" style={{ width: `${lvlPct}%` }} />
          </div>
          <p className="mt-2 text-v2-small text-v2-text-2">
            {next ? (
              <>
                {t("Yana")} <b className="font-semibold text-v2-text">{Math.max(0, next.minEarned - data.wallet.earnedTotal)}</b> {t("tanga")} — «{t(next.name)}» ({next.minEarned})
              </>
            ) : (
              t("eng yuqori daraja")
            )}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-v2-small text-v2-text-2">{t("Ketma-ket darslar")}</span>
            <Flame className="size-5 text-v2-danger" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <b className="text-[32px] font-semibold leading-none tabular-nums text-v2-text">{data.bestStreak?.run ?? 0}</b>
            <span className="text-v2-body text-v2-text-2">{t("dars")}</span>
          </div>
          {data.streakOn && data.bestStreak ? (
            <p className="mt-3 text-v2-small text-v2-text-2">
              {t("Yana {n} dars", { n: data.bestStreak.next })} — <b className="font-semibold text-v2-success">+{data.streakBonus}</b> {t("tanga bonus")}
            </p>
          ) : null}
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Reyting · Top-5 — kengda guruhlar yonma-yon, telefonda tanlov. */}
        {data.rankings.length > 0 && rk ? (
          <Card className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-v2-section text-v2-text">{t("Reyting · Top-5")}</h2>
                <p className="text-v2-small text-v2-text-3">
                  {fmt.monthLower(data.month)} · 1–{day} · {t("guruh ichida")}
                </p>
              </div>
              <span className="rounded-v2-sm bg-v2-info-bg px-2 py-0.5 text-v2-caption font-medium text-v2-info">{t("yakun 1-{month} tunda", { month: fmt.monthLower(nextMonth) })}</span>
            </div>
            {data.rankings.length > 1 && (
              <div role="tablist" aria-label={t("Guruh")} className="mt-3 flex gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1 md:hidden">
                {data.rankings.map((r, i) => (
                  <button key={r.groupId} type="button" role="tab" aria-selected={i === gi} onClick={() => setGi(i)} className={`h-9 min-w-0 flex-1 truncate rounded-[6px] px-2 text-v2-small ${i === gi ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
                    {courseOf(r.label)}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 grid gap-4 md:grid-cols-2 md:divide-x md:divide-v2-border">
              {data.rankings.map((r, i) => (
                <div key={r.groupId} className={`min-w-0 md:block md:[&:nth-child(2n)]:pl-4 ${i === gi ? "" : "hidden"}`}>
                  <RankList r={r} />
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 border-t border-v2-border pt-3 text-v2-small text-v2-text-3">
              <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {t("Hammaga faqat Top-5 ko'rinadi. Reyting = oyda berilgan − ayirilgan tanga, do'kon xaridlari ta'sir qilmaydi.")}
            </p>
          </Card>
        ) : (
          <div />
        )}

        <WishesCard data={data} onShop={() => setView("shop")} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <HistoryCard initial={data.history ?? null} initData={initData} pupilId={me.profile.id} month={fmt.monthLower(data.month)} onAll={() => setView("me")} />
        {data.earnRules?.length ? (
          <Card>
            <h2 className="text-v2-section text-v2-text">{t("Qanday tanga olaman")}</h2>
            <p className="mb-3 text-v2-small text-v2-text-3">{t("markaz sozlamalari bo'yicha")}</p>
            <ul className="divide-y divide-v2-border">
              {data.earnRules.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-3 py-2 text-v2-small">
                  <span className="text-v2-text-2">{t(r.name)}</span>
                  <b className={`shrink-0 font-semibold tabular-nums ${r.minus ? "text-v2-danger" : "text-v2-success"}`}>{r.amount}</b>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      {/* Nishonlarim */}
      <Card>
        <h2 className="text-v2-section text-v2-text">{t("Nishonlarim")}</h2>
        <p className="mb-3 text-v2-small text-v2-text-3">{t("{n} / {total} · kulranglari hali olinmagan", { n: earned, total: data.badges.length })}</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {badges.map((b) => {
            const Icon = BADGE_ICON[b.code] ?? Star;
            return (
              <div key={b.code} className={`flex w-24 shrink-0 flex-col items-center gap-2 rounded-v2-md border px-1.5 py-3 text-center sm:w-auto ${b.earned ? "border-v2-border bg-v2-surface" : "border-v2-border bg-v2-surface-2 opacity-70"}`}>
                <span className={`grid size-9 place-items-center rounded-full ${b.earned ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-surface text-v2-text-3"}`}>
                  <Icon className="size-[18px]" strokeWidth={1.75} />
                </span>
                <span className={`text-v2-caption font-semibold leading-tight ${b.earned ? "text-v2-text" : "text-v2-text-3"}`}>{t(b.name)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-v2-small text-v2-text-2 hover:text-v2-text">
      <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}

function RankList({ r }: { r: PageData["rankings"][number] }) {
  const { t } = useT();
  return (
    <>
      <span className={`inline-block rounded-v2-sm px-2 py-0.5 text-v2-caption font-medium ${FAN_BG[fanOf(r.label)]} ${FAN_TEXT[fanOf(r.label)]}`}>{courseOf(r.label)}</span>
      {r.top.length === 0 ? (
        <p className="py-4 text-v2-small text-v2-text-3">{t("Bu oyda hali tanga yo'q")}</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {r.top.map((x) => (
            <li key={`${x.rank}-${x.name}`} className={`flex items-center gap-3 rounded-v2-md px-2.5 py-2 ${x.me ? "bg-v2-brand-bg" : ""}`}>
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-v2-caption font-semibold ${x.rank === 1 ? "bg-v2-warning-bg text-v2-warning" : x.rank === 2 ? "bg-v2-surface-2 text-v2-text-2" : x.rank === 3 ? "bg-v2-danger-bg text-v2-danger" : "text-v2-text-2"}`}>{x.rank}</span>
              <span className={`min-w-0 flex-1 truncate text-v2-body ${x.me ? "font-semibold text-v2-text" : "text-v2-text"}`}>
                {x.name}
                {x.me && <span className="font-semibold text-v2-brand-text"> · {t("siz")}</span>}
              </span>
              <b className="font-semibold tabular-nums text-v2-text">{x.points}</b>
            </li>
          ))}
          {r.me && r.me.rank > 5 ? (
            <li className="flex items-center gap-3 rounded-v2-md bg-v2-brand-bg px-2.5 py-2">
              <span className="grid size-6 shrink-0 place-items-center text-v2-caption font-semibold text-v2-text-2">{r.me.rank}</span>
              <span className="min-w-0 flex-1 text-v2-body font-semibold text-v2-brand-text">
                {t("Siz")}
                {r.needForTop5 > 0 && <span className="font-normal text-v2-text-2"> · {t("Top-5 ga yana {n} tanga", { n: r.needForTop5 })}</span>}
              </span>
              <b className="font-semibold tabular-nums text-v2-text">{r.me.points}</b>
            </li>
          ) : null}
        </ul>
      )}
    </>
  );
}

function WishesCard({ data, onShop }: { data: PageData; onShop?: () => void }) {
  const { t } = useT();
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-v2-section text-v2-text">{t("Istaklarim")}</h2>
          <p className="text-v2-small text-v2-text-3">
            {data.wishes.length} / {data.wishlistMax}
          </p>
        </div>
        {onShop ? (
        <button type="button" onClick={onShop} className="inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
          {t("Do'kon")}
          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        ) : null}
      </div>
      {data.wishes.length === 0 ? (
        <p className="py-4 text-v2-small text-v2-text-3">{t("Do'kondan yoqqan sovg'aga «Istak» bosing — shu yerda ko'rinadi")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-v2-border">
          {data.wishes.map((w) => (
            <li key={w.itemId} className="flex items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-v2-md bg-v2-violet-bg text-v2-violet">
                <Gift className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-v2-body font-semibold text-v2-text">{t(w.title)}</div>
                <div className={`text-v2-caption ${w.noStock ? "text-v2-danger" : w.ready ? "text-v2-success" : "text-v2-text-2"}`}>
                  {w.noStock ? t("Hozir omborda yo'q") : w.ready ? t("Tanga yetadi — adminga ayting") : t("yana {n} tanga", { n: Math.max(0, w.price - data.wallet.balance) })}
                </div>
              </div>
              <CoinPrice n={w.price} />
            </li>
          ))}
        </ul>
      )}
      {onShop && data.wishes.length < data.wishlistMax ? (
        <button type="button" onClick={onShop} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-v2-md border border-v2-border-strong text-v2-small font-medium text-v2-text hover:bg-v2-surface-2">
          <Plus className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Istak qo'shish")}
        </button>
      ) : null}
    </Card>
  );
}

function CoinPrice({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 font-semibold tabular-nums text-v2-text ${className}`}>
      <Coins className="size-4 text-v2-warning" strokeWidth={1.75} aria-hidden />
      {n}
    </span>
  );
}

type HFilter = "all" | "plus" | "minus" | "shop";

function HistoryCard({ initial, initData, pupilId, month, onAll }: { initial: { total: number; rows: HistoryRow[] } | null; initData: string; pupilId: number; month: string; onAll: () => void }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const [filter, setFilter] = useState<HFilter>("all");
  const [rows, setRows] = useState<HistoryRow[] | null>(initial?.rows ?? null);
  const pick = (f: HFilter) => {
    setFilter(f);
    if (f === "all") return setRows(initial?.rows ?? []);
    setRows(null);
    const q = new URLSearchParams({ pupilId: String(pupilId), part: "history", filter: f });
    void fetch(`/api/me/tg?${q}`, { headers: { "X-Telegram-Init-Data": initData } })
      .then((r) => r.json())
      .then((j) => setRows(j?.ok ? (j.history.rows as HistoryRow[]) : []))
      .catch(() => setRows([]));
  };
  const shown = (rows ?? []).slice(0, 6);
  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-v2-section text-v2-text">{t("Tanga tarixi")}</h2>
          <p className="text-v2-small text-v2-text-3">{month}</p>
        </div>
        <div role="tablist" aria-label={t("Filtr")} className="inline-flex max-w-full overflow-x-auto rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
          {(
            [
              ["all", t("Hammasi")],
              ["plus", t("Berilgan")],
              ["minus", t("Ayirilgan")],
              ["shop", t("Do'kon")],
            ] as [HFilter, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => pick(k)} className={`h-8 shrink-0 rounded-v2-sm px-3 text-v2-small ${filter === k ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {rows === null ? (
        <div className="mt-3 h-40 animate-pulse rounded-v2-md bg-v2-skeleton" />
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-v2-small text-v2-text-3">{t("Hozircha yozuv yo'q")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-v2-border">
          {shown.map((r) => {
            const plus = r.amount > 0;
            const off = r.status !== "active";
            return (
              <li key={r.id} className={`flex items-center gap-3 py-3 ${off ? "opacity-60" : ""}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-v2-md ${plus ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"}`}>
                  {plus ? <Plus className="size-4" strokeWidth={2} aria-hidden /> : <Minus className="size-4" strokeWidth={2} aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-v2-body font-medium text-v2-text ${off ? "line-through" : ""}`}>{[t(r.label), r.note].filter(Boolean).join(" · ")}</div>
                  <div className="truncate text-v2-caption text-v2-text-3">{[fmt.dayMonth(r.date.slice(0, 10)), r.groupLabel, r.createdByName].filter(Boolean).join(" · ")}</div>
                </div>
                <b className={`shrink-0 font-semibold tabular-nums ${plus ? "text-v2-success" : "text-v2-danger"}`}>{plus ? `+${r.amount}` : r.amount}</b>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" onClick={onAll} className="mt-2 inline-flex items-center gap-1 text-v2-small font-medium text-v2-brand-text">
        {t("Hammasini ko'rish")}
        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    </Card>
  );
}

/* ───────────────────────── Do'kon (44-qism, rasm «Kabinet · Do'kon») ───────────────────────── */

const KIND_LABEL: Record<string, string> = { item: "Buyum", service: "Xizmat", discount: "Chegirma" };
const KIND_TONE: Record<string, string> = { item: "bg-v2-violet-bg text-v2-violet", service: "bg-v2-info-bg text-v2-info", discount: "bg-v2-success-bg text-v2-success" };

function ShopView({ data, initData, pupilId, branch, onBack, onChanged }: { data: PageData; initData: string; pupilId: number; branch: string; onBack: () => void; onChanged: () => Promise<void> }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const [kind, setKind] = useState<string>("");
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const items = data.shop ?? [];
  const kinds = ["item", "service", "discount"].filter((k) => items.some((i) => i.kind === k));
  const shown = kind ? items.filter((i) => i.kind === kind) : items;
  const full = data.wishes.length >= data.wishlistMax;

  const toggle = async (it: ShopRow) => {
    setBusy(it.id);
    setErr("");
    try {
      const r = await fetch(`/api/me/tg/wishlist/${it.id}?pupilId=${pupilId}`, { method: it.wished ? "DELETE" : "POST", headers: { "X-Telegram-Init-Data": initData } });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) setErr(String(j?.error ?? t("Saqlanmadi")));
      await onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <BackLink label={t("Tangalarim")} onClick={onBack} />
      <PageHead
        title={t("Do'kon")}
        sub={[t("Tangani sovg'aga almashtiring — sovg'ani filial admini beradi"), branch].filter(Boolean).join(" · ")}
        right={
          <span className="inline-flex h-10 items-center gap-2 rounded-v2-full bg-v2-warning-bg px-4 text-v2-small font-semibold text-v2-warning">
            <Coins className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Balans: {n} tanga", { n: fmtSom(data.wallet.balance) })}
          </span>
        }
      />
      <div role="tablist" aria-label={t("Tur")} className="inline-flex max-w-full overflow-x-auto rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
        {["", ...kinds].map((k) => (
          <button key={k || "all"} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`h-8 shrink-0 rounded-v2-sm px-3 text-v2-small ${kind === k ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
            {k ? t(KIND_LABEL[k]) : t("Hammasi")} · {k ? items.filter((i) => i.kind === k).length : items.length}
          </button>
        ))}
      </div>
      {err ? <p className="text-v2-small text-v2-danger">{err}</p> : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {shown.length === 0 ? (
          <Card>
            <Empty>{t("Do'konda hozircha sovg'a yo'q.")}</Empty>
          </Card>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            {shown.map((it) => {
              const out = it.inStock === false;
              return (
                <li key={it.id} className={`flex flex-col rounded-v2-lg border bg-v2-surface p-3 shadow-v2-sm ${it.wished ? "border-v2-brand" : "border-v2-border"}`}>
                  <div className={`grid h-20 place-items-center rounded-v2-md text-3xl ${KIND_TONE[it.kind] ?? KIND_TONE.item}`} aria-hidden>
                    {it.emoji || (it.kind === "discount" ? <Percent className="size-6" strokeWidth={1.75} /> : <Gift className="size-6" strokeWidth={1.75} />)}
                  </div>
                  <span className="mt-2 text-v2-caption text-v2-text-3">{t(KIND_LABEL[it.kind] ?? "Buyum")}</span>
                  <span className="text-v2-body font-semibold text-v2-text">{t(it.title)}</span>
                  <span className={`text-v2-caption ${out ? "text-v2-danger" : "text-v2-text-3"}`}>{out ? t("Tugagan") : it.kind === "discount" ? t("Oyiga 1 marta") : t("Bor")}</span>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <CoinPrice n={it.price} />
                    {it.wished ? (
                      <button type="button" disabled={busy === it.id} onClick={() => void toggle(it)} className="inline-flex h-8 items-center gap-1 rounded-v2-md border border-v2-brand bg-v2-brand-bg px-2.5 text-v2-small font-medium text-v2-brand-text disabled:opacity-50">
                        <Check className="size-4" strokeWidth={2} aria-hidden />
                        {t("Istakda")}
                      </button>
                    ) : it.need > 0 && it.kind === "discount" ? (
                      <span className="text-v2-caption text-v2-text-3">{t("Yana {n} tanga kerak", { n: it.need })}</span>
                    ) : (
                      <button type="button" disabled={busy === it.id || full} title={full ? t("Istaklar ro'yxati to'la") : undefined} onClick={() => void toggle(it)} className="inline-flex h-8 items-center gap-1 rounded-v2-md border border-v2-border-strong px-2.5 text-v2-small font-medium text-v2-text hover:bg-v2-surface-2 disabled:opacity-50">
                        <Plus className="size-4" strokeWidth={1.75} aria-hidden />
                        {t("Istak")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-v2-section text-v2-text">{t("Qanday ishlaydi")}</h2>
            <ol className="space-y-3">
              {[
                [t("Istak qo'shing"), t("{n} tagacha · tanga yetsa, «Tanga yetadi» deb chiqadi", { n: data.wishlistMax })],
                [t("Adminga ayting"), t("filialda admin sovg'ani istaklaringizdan beradi")],
                [t("Tanga o'shanda yechiladi"), t("istak qo'shganda tanga ayirilmaydi")],
              ].map(([a, b], i) => (
                <li key={a} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-v2-brand-bg text-v2-caption font-semibold text-v2-brand-text">{i + 1}</span>
                  <span>
                    <span className="block text-v2-body font-medium text-v2-text">{a}</span>
                    <span className="block text-v2-small text-v2-text-3">{b}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 flex items-start gap-2 text-v2-small text-v2-text-3">
              <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {t("Kichiklar va kattalar uchun sovg'alar alohida — sizga o'z toifangiz ro'yxati ko'rinadi.")}
            </p>
          </Card>
          <WishesCard data={data} />
          <Card>
            <h2 className="text-v2-section text-v2-text">{t("Olganlarim")}</h2>
            <p className="mb-2 text-v2-small text-v2-text-3">{t("{n} ta", { n: (data.orders ?? []).length })}</p>
            {(data.orders ?? []).length === 0 ? (
              <p className="py-3 text-v2-small text-v2-text-3">{t("Hali sovg'a olinmagan.")}</p>
            ) : (
              <ul className="divide-y divide-v2-border">
                {(data.orders ?? []).slice(0, 8).map((o) => (
                  <li key={o.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-v2-md bg-v2-success-bg text-v2-success">
                      <Gift className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-v2-body font-medium text-v2-text">{t(o.itemName)}</div>
                      <div className="text-v2-caption text-v2-text-3">{o.givenDate ? fmt.dayMonth(o.givenDate.slice(0, 10)) : ""}</div>
                    </div>
                    <b className="shrink-0 tabular-nums text-v2-text">−{o.priceCoins}</b>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
