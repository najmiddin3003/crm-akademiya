"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  ArrowLeft,
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
  Heart,
  Shield,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useT } from "@/components/shared/Language";
import StudentGame from "@/components/gamification/student/StudentGame";
import { Card, CardHead, fmtSom, useCabinetFmt, type CabinetTabProps } from "./bits";
import { PageHead } from "./lessonParts";

// O'QUVCHI KABINETI (v2) — «TANGALARIM» (33-qism, rasm «O'quvchi kabineti · Tangalarim · Telefon»):
//   Balansim (oyda +N, eng yaxshi o'rin) + «Do'kon — sovg'alar»; Darajam (keyingisigacha); Ketma-ket
//   (uzluksiz davomat bonusigacha); Reyting · Top-5 (guruhlar bo'yicha segment, «siz» belgisi);
//   Nishonlarim (gorizontal); Istaklarim (tanga yetadi — «adminga ayting»).
// Ma'lumot — o'quvchi sahifasi API'si (/api/me/tg, lib/gamification/studentPage.ts), StudentGame bilan
// bitta manba. «Do'kon — sovg'alar», «+ Istak qo'shish», «hammasi» — to'liq StudentGame (do'kon, tarix,
// istak qo'shish) ochiladi, «← Tangalarim» bilan qaytiladi. Modul o'chiq — StudentGame fallback'i.

interface PageData {
  enabled: boolean;
  month: string;
  pupil: { firstName: string };
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

export default function TangaTab({ me, initData }: CabinetTabProps) {
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
    if (view === "overview") void load();
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

  // To'liq ko'rinish (do'kon, tarix) yoki modul o'chiq / ma'lumot kelmadi — avvalgi StudentGame.
  if (view !== "overview" || failed || (data && !data.enabled)) {
    return (
      <div className="space-y-4">
        {view !== "overview" && (
          <button type="button" onClick={() => setView("overview")} className="inline-flex items-center gap-1.5 text-v2-small font-semibold text-v2-brand-text">
            <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Tangalarim")}
          </button>
        )}
        <StudentGame key={view} source={{ kind: "tg", initData }} pupilId={me.profile.id} embedded initialTab={view === "shop" ? "shop" : "me"} fallback={fallback} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHead title={t("Tangalarim")} />
        <div className="h-48 animate-pulse rounded-v2-lg bg-v2-skeleton" />
        <div className="h-32 animate-pulse rounded-v2-lg bg-v2-skeleton" />
      </div>
    );
  }

  const lvl = data.levels[data.levelIndex];
  const next = data.levels[data.levelIndex + 1] ?? null;
  const lvlPct = lvl && next ? Math.min(100, ((data.wallet.earnedTotal - lvl.minEarned) / Math.max(1, next.minEarned - lvl.minEarned)) * 100) : 100;
  const monthNet = data.rankings.reduce((a, r) => a + (r.me?.points ?? 0), 0);
  const best = [...data.rankings].filter((r) => r.me && r.me.points > 0).sort((a, b) => a.me!.rank - b.me!.rank)[0] ?? null;
  const rk = data.rankings[Math.min(gi, Math.max(0, data.rankings.length - 1))] ?? null;
  const earned = data.badges.filter((b) => b.earned).length;
  const badges = [...data.badges].sort((a, b) => Number(b.earned) - Number(a.earned));
  const monthName = fmt.monthName(data.month);
  const day = new Date().getDate();
  const nextMonth = (() => {
    const [y, m] = data.month.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  })();

  return (
    <div className="space-y-4">
      <PageHead title={t("Tangalarim")} />

      {/* Balansim */}
      <section className="rounded-v2-lg bg-v2-warning-bg p-5">
        <span className="text-v2-small font-semibold text-v2-warning">{t("Balansim")}</span>
        <div className="mt-1 flex items-center gap-3">
          <span className="size-8 rounded-full bg-v2-warning" aria-hidden />
          <b className="text-[44px] font-semibold leading-none tabular-nums text-v2-text">{fmtSom(data.wallet.balance)}</b>
          <span className="text-v2-body text-v2-text-2">{t("tanga")}</span>
        </div>
        <p className="mt-2 text-v2-small text-v2-text-2">
          {t("{month}da", { month: monthName })} <b className={`font-semibold ${monthNet >= 0 ? "text-v2-success" : "text-v2-danger"}`}>{monthNet > 0 ? `+${monthNet}` : monthNet}</b>
          {best && (
            <>
              {" · "}
              {t("{course}da", { course: courseOf(best.label) })} <b className="font-semibold text-v2-text">{t("{n}-o'rin", { n: best.me!.rank })}</b>
            </>
          )}
        </p>
        <button type="button" onClick={() => setView("shop")} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-v2-md border border-v2-border-strong bg-v2-surface font-semibold text-v2-text">
          <Gift className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Do'kon — sovg'alar")}
        </button>
      </section>

      {/* Darajam · Ketma-ket */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="text-v2-small text-v2-text-2">{t("Darajam")}</span>
            {lvl && (
              <span className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-2 text-v2-caption font-semibold ${LEVEL_TONE[data.levelIndex] ?? LEVEL_TONE[0]}`}>
                <span className="grid size-4 place-items-center rounded-full bg-v2-surface text-[10px] text-v2-text-2">{lvl.position}</span>
                {t(lvl.name)}
              </span>
            )}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-v2-surface-2">
            <div className="h-full rounded-full bg-v2-success" style={{ width: `${lvlPct}%` }} />
          </div>
          <p className="mt-2 text-v2-small text-v2-text-2">
            {next ? (
              <>
                {t("yana")} <b className="font-semibold text-v2-text">{Math.max(0, next.minEarned - data.wallet.earnedTotal)}</b> {t("tanga")} — «{t(next.name)}»
              </>
            ) : (
              t("eng yuqori daraja")
            )}
          </p>
        </Card>
        <Card>
          <span className="text-v2-small text-v2-text-2">{t("Ketma-ket")}</span>
          <div className="mt-1 flex items-center gap-1.5">
            <Flame className="size-5 text-v2-danger" strokeWidth={2} aria-hidden />
            <b className="text-[26px] font-semibold tabular-nums text-v2-text">{data.bestStreak?.run ?? 0}</b>
            <span className="text-v2-body font-semibold text-v2-text">{t("dars")}</span>
          </div>
          {data.streakOn && data.bestStreak && (
            <p className="mt-1 text-v2-small text-v2-text-2">
              {t("yana {n} dars", { n: data.bestStreak.next })} — <b className="font-semibold text-v2-success">+{data.streakBonus}</b>
            </p>
          )}
        </Card>
      </div>

      {/* Reyting · Top-5 */}
      {data.rankings.length > 0 && rk && (
        <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface">
          <div className="flex items-baseline justify-between gap-2 px-5 pb-3 pt-4">
            <h2 className="text-v2-h3 font-semibold text-v2-text">{t("Reyting · Top-5")}</h2>
            <span className="text-v2-small text-v2-text-3">
              {fmt.monthLower(data.month)} · 1–{day}
            </span>
          </div>
          {data.rankings.length > 1 && (
            <div role="tablist" aria-label={t("Guruh")} className="mx-5 mb-3 flex gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
              {data.rankings.map((r, i) => (
                <button
                  key={r.groupId}
                  type="button"
                  role="tab"
                  aria-selected={i === gi}
                  onClick={() => setGi(i)}
                  className={`h-9 min-w-0 flex-1 truncate rounded-[6px] px-2 text-v2-small ${i === gi ? "border border-v2-border bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "border border-transparent text-v2-text-2"}`}
                >
                  {courseOf(r.label)}
                </button>
              ))}
            </div>
          )}
          {rk.top.length === 0 ? (
            <p className="border-t border-v2-border px-5 py-4 text-v2-small text-v2-text-3">{t("Bu oyda hali tanga yo'q")}</p>
          ) : (
            rk.top.map((r) => (
              <div key={`${r.rank}-${r.name}`} className={`flex items-center gap-3 border-t border-v2-border px-5 py-3 ${r.me ? "bg-v2-brand-bg" : ""}`}>
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-v2-small font-semibold ${
                    r.rank === 1 ? "bg-v2-warning-bg text-v2-warning" : r.rank === 2 ? "bg-v2-surface-2 text-v2-text-2" : r.rank === 3 ? "bg-v2-danger-bg text-v2-danger" : "text-v2-text-2"
                  }`}
                >
                  {r.rank}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-v2-text">
                  {r.name}
                  {r.me && <span className="font-semibold text-v2-brand-text"> · {t("siz")}</span>}
                </span>
                <b className="font-semibold tabular-nums text-v2-text">{r.points}</b>
              </div>
            ))
          )}
          {rk.me && rk.me.rank > 5 && (
            <div className="flex items-center gap-3 border-t border-v2-border bg-v2-brand-bg px-5 py-3">
              <span className="grid size-8 shrink-0 place-items-center text-v2-small font-semibold text-v2-text-2">{rk.me.rank}</span>
              <span className="min-w-0 flex-1 font-semibold text-v2-brand-text">
                {t("Siz")}
                {rk.needForTop5 > 0 && <span className="font-normal text-v2-text-2"> · {t("Top-5 ga yana {n} tanga", { n: rk.needForTop5 })}</span>}
              </span>
              <b className="font-semibold tabular-nums text-v2-text">{rk.me.points}</b>
            </div>
          )}
          <p className="border-t border-v2-border px-5 py-3 text-v2-small text-v2-text-3">{t("Hammaga faqat Top-5 ko'rinadi · yakun 1-{month} tunda", { month: fmt.monthLower(nextMonth) })}</p>
        </section>
      )}

      {/* Nishonlarim */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-v2-h3 font-semibold text-v2-text">{t("Nishonlarim")}</h2>
          <button type="button" onClick={() => setView("me")} className="text-v2-small font-semibold text-v2-brand-text">
            {earned} / {data.badges.length} · {t("hammasi")}
          </button>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {badges.map((b) => {
            const Icon = BADGE_ICON[b.code] ?? Star;
            return (
              <div key={b.code} className={`flex w-28 shrink-0 flex-col items-center gap-2 rounded-v2-lg border bg-v2-surface px-2 py-3 text-center ${b.earned ? "border-v2-border" : "border-dashed border-v2-border opacity-60"}`}>
                <span className={`grid size-10 place-items-center rounded-full ${b.earned ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-surface-2 text-v2-text-3"}`}>
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <span className="text-v2-small font-semibold leading-tight text-v2-text">{t(b.name)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Istaklarim */}
      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface">
        <div className="flex items-baseline justify-between gap-2 px-5 pb-3 pt-4">
          <h2 className="text-v2-h3 font-semibold text-v2-text">
            {t("Istaklarim")} <span className="font-normal text-v2-text-3">· {data.wishes.length} / {data.wishlistMax}</span>
          </h2>
          {data.wishes.length < data.wishlistMax && (
            <button type="button" onClick={() => setView("shop")} className="text-v2-small font-semibold text-v2-brand-text">
              + {t("Istak qo'shish")}
            </button>
          )}
        </div>
        {data.wishes.length === 0 ? (
          <p className="border-t border-v2-border px-5 py-4 text-v2-small text-v2-text-3">{t("Do'kondan yoqqan sovg'aga ♥ bosing — shu yerda ko'rinadi")}</p>
        ) : (
          data.wishes.map((w) => (
            <div key={w.itemId} className="flex items-center gap-3 border-t border-v2-border px-5 py-3">
              <Heart className="size-5 shrink-0 fill-v2-danger text-v2-danger" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-v2-text">{t(w.title)}</div>
                <div className={`truncate text-v2-small ${w.noStock ? "text-v2-danger" : w.ready ? "text-v2-success" : "text-v2-text-2"}`}>
                  {w.noStock ? t("Hozir omborda yo'q") : w.ready ? t("Tanga yetadi — adminga ayting") : t("yana {n} tanga", { n: Math.max(0, w.price - data.wallet.balance) })}
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold tabular-nums text-v2-text">
                <span className="size-2.5 rounded-full bg-v2-warning" aria-hidden />
                {w.price}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
