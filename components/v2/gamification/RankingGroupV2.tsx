"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Eye, Loader2, MonitorUp } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { gamApi } from "@/components/gamification/api";
import ProfileModal from "@/components/gamification/profile/ProfileModal";
import { Projector } from "@/components/gamification/ranking/RankingPage";
import { Segmented } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { Avatar, NoticeBar, PageHead, PageShell, TH } from "@/components/v2/students/lists/listKit";
import { useGamToastV2 } from "./gamBits";
import { CoinDot, LevelBadge } from "./levelBits";

// YANGI VERSIYA — GAMIFIKATSIYA → «REYTING · GURUH ICHIDA» (33-qism). Guruh tanlanadi; «Oktabr | Jami»;
// uchlik (2 · 1 · 3) — reyting tangasi, daraja, bugun, balans; jadvalda top-5 dan keyin ajratgich
// («qolganlar faqat o'z o'rnini ko'radi»); o'ngda — «Qanday hisoblanadi», o'tgan oy yakuni va guruhning
// filial musobaqasidagi o'rni. Server: GET /api/gamification/ranking (lib/gamification/rankingView.ts).
// Qatorni bosish — o'quvchining tanga profili (eski oyna). Filial bo'yicha umumiy ro'yxat (11-qism,
// RankingV2) — `?scope=branch`.

interface RankRowV2 {
  pupilId: number;
  name: string;
  points: number;
  rank: number;
  levelPosition: number;
  levelName: string;
  balance: number;
  today: number;
}

interface RankViewV2 {
  enabled: boolean;
  month: string;
  today: string;
  period: "month" | "all";
  groups: { id: number; label: string; branchName: string }[];
  group: { id: number; label: string; branchName: string; members: number } | null;
  rows: RankRowV2[];
  prevMonth: { month: string; top: { pupilId: number; name: string; points: number; rank: number; studentOfMonth: boolean }[] };
  competition: { rank: number; avg: number; groups: number; other: { label: string; avg: number; rank: number } | null } | null;
}

const TOP = 5;
const signedNum = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
const toneOf = (n: number) => (n > 0 ? "text-v2-success" : n < 0 ? "text-v2-danger" : "text-v2-text-2");

/** O'rin belgisi: 1 — oltin, 2 — kumush, 3 — bronza, qolgani oddiy raqam. */
function RankMark({ rank, show }: { rank: number; show: boolean }) {
  const cls =
    show && rank === 1
      ? "bg-v2-warning-bg text-v2-warning"
      : show && rank === 2
        ? "bg-v2-surface-2 text-v2-text-2"
        : show && rank === 3
          ? "bg-v2-danger-bg text-v2-danger"
          : "text-v2-text-2";
  return <span className={`grid size-8 place-items-center rounded-full text-v2-small font-semibold tabular-nums ${cls}`}>{rank}</span>;
}

export default function RankingGroupV2({ initialGroupId }: { initialGroupId?: number | null }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const toast = useGamToastV2();
  const [period, setPeriod] = useState<"month" | "all">("month");
  const [groupId, setGroupId] = useState<number | null>(initialGroupId ?? null);
  const [view, setView] = useState<RankViewV2 | null>(null);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [version, setVersion] = useState(0);

  const load = useCallback(
    (gid: number | null, p: "month" | "all") =>
      gamApi<RankViewV2>(`/api/gamification/ranking?period=${p}${gid ? `&groupId=${gid}` : ""}`).then((res) => {
        if (!res.ok) setError(res.error);
        else {
          setView(res);
          setError("");
        }
      }),
    [],
  );

  useEffect(() => {
    void load(groupId, period);
  }, [load, groupId, period, version]);

  function pickGroup(id: string) {
    const gid = Number(id);
    const url = new URL(window.location.href);
    url.searchParams.set("groupId", String(gid));
    window.history.replaceState(null, "", url.toString());
    setGroupId(gid);
  }

  if (!view) {
    return (
      <PageShell flow>
        <PageHead title={t("Reyting")} subtitle="" />
        {error ? (
          <NoticeBar>{t(error)}</NoticeBar>
        ) : (
          <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
          </div>
        )}
      </PageShell>
    );
  }

  const g = view.group;
  const rows = view.rows;
  const maxPts = Math.max(1, ...rows.map((r) => r.points));
  const scored = rows.filter((r) => r.points > 0);
  const podium = [scored.find((r) => r.rank === 2) ?? scored[1], scored.find((r) => r.rank === 1) ?? scored[0], scored.find((r) => r.rank === 3) ?? scored[2]];
  const topCount = rows.filter((r) => r.rank <= TOP).length;
  const monthLabel = fmt.monthName(view.month);
  const dayNum = Number(view.today.slice(8, 10));
  const range = view.period === "month" ? `1–${dayNum}-${fmt.monthLower(view.month)}` : t("barcha vaqt");
  const subtitle = g ? [g.label, g.branchName, t("{n} o'quvchi", { n: g.members }), range].filter(Boolean).join(" · ") : t("Sizga biriktirilgan faol guruh yo'q");
  const nextMonth = (() => {
    const [y, m] = view.month.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  })();

  return (
    <PageShell flow>
      <PageHead
        title={t("Reyting")}
        subtitle={subtitle}
        actions={
          g ? (
            <>
              <div className="w-48">
                <Segmented
                  label={t("Davr")}
                  value={period}
                  onChange={(v) => setPeriod(v as "month" | "all")}
                  options={[
                    { value: "month", label: monthLabel },
                    { value: "all", label: t("Jami") },
                  ]}
                />
              </div>
              <div className="w-[min(20rem,80vw)]">
                <V2Select
                  label={t("Guruh")}
                  value={String(g.id)}
                  onChange={pickGroup}
                  searchable="auto"
                  options={view.groups.map((x) => ({ value: String(x.id), label: x.label }))}
                />
              </div>
              <button type="button" onClick={() => setScreen(true)} disabled={!scored.length} className={`${primaryBtn} disabled:opacity-50`}>
                <MonitorUp className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Ekranga chiqarish")}
              </button>
            </>
          ) : undefined
        }
      />

      {!view.enabled && <NoticeBar>{t("Gamifikatsiya o'chiq — tanga yozilmaydi. Yoqish: Sozlamalar → Tanga tizimi.")}</NoticeBar>}

      {g && scored.length > 0 && (
        <section className="grid gap-3 rounded-v2-lg border border-v2-border bg-v2-surface-2 p-4 sm:grid-cols-3 sm:items-end">
          {podium.map((r, i) =>
            r ? (
              <button
                key={r.pupilId}
                type="button"
                onClick={() => setOpen(r.pupilId)}
                className={`flex flex-col items-center rounded-v2-lg border px-4 text-center transition-colors hover:brightness-[0.99] ${
                  i === 1 ? "border-v2-brand bg-v2-brand-bg py-6 sm:order-none max-sm:order-first" : "border-v2-border bg-v2-surface py-5"
                }`}
              >
                <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-v2-small font-semibold ${r.rank === 1 ? "bg-v2-warning-bg text-v2-warning" : r.rank === 3 ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-surface-2 text-v2-text-2"}`}>
                  {r.rank === 1 && <Crown className="size-3.5" strokeWidth={2} aria-hidden />}
                  {t("{n}-o'rin", { n: r.rank })}
                </span>
                <span className="mt-3 grid size-14 place-items-center rounded-full border border-v2-border bg-v2-surface text-v2-body font-semibold text-v2-text-2">
                  {r.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="mt-2 text-v2-h3 font-semibold text-v2-text">{r.name}</span>
                <span className="mt-1.5">
                  <LevelBadge position={r.levelPosition} name={r.levelName} />
                </span>
                <span className="mt-2 text-v2-body text-v2-text-2">
                  <b className={`font-semibold tabular-nums text-v2-text ${i === 1 ? "text-[34px]" : "text-[28px]"}`}>{r.points}</b> {t("reyting tangasi")}
                </span>
                <span className="mt-1 flex items-center gap-1 text-v2-small text-v2-text-2">
                  {t("bugun")} <b className={`font-semibold ${toneOf(r.today)}`}>{signedNum(r.today)}</b> · {t("balans")} <CoinDot n={r.balance} />
                </span>
              </button>
            ) : (
              <div key={`empty-${i}`} className="hidden sm:block" />
            ),
          )}
        </section>
      )}

      {g && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-v2-body">
                <thead>
                  <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                    <th className={`${TH} w-16 pl-5`}>{t("O'rin")}</th>
                    <th className={TH}>{t("O'quvchi")}</th>
                    <th className={TH}>{t("Daraja")}</th>
                    <th className={TH}>{t("Reyting tangasi")}</th>
                    <th className={`${TH} text-right`}>{t("Bugun")}</th>
                    <th className={`${TH} text-right`}>{t("Balans")}</th>
                    <th className={`${TH} pr-5`}>{t("O'quvchilarga")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                        {t("Guruhda faol o'quvchi yo'q")}
                      </td>
                    </tr>
                  )}
                  {rows.map((r, idx) => {
                    const divider = idx === topCount && idx > 0;
                    return [
                      divider ? (
                        <tr key={`div-${r.pupilId}`} className="border-b border-v2-border bg-v2-surface-2">
                          <td colSpan={7} className="px-5 py-2 text-v2-small text-v2-text-2">
                            {t("Yuqoridagi {n} o'quvchi kabinetda va ekranda ko'rinadi · qolganlar faqat o'z o'rnini ko'radi", { n: topCount })}
                          </td>
                        </tr>
                      ) : null,
                      <tr key={r.pupilId} onClick={() => setOpen(r.pupilId)} className="cursor-pointer border-b border-v2-border last:border-b-0 hover:bg-v2-hover">
                        <td className="py-3 pl-5 pr-2">
                          <RankMark rank={r.rank} show={r.points > 0} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.name} />
                            <span className="truncate font-semibold text-v2-text">{r.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <LevelBadge position={r.levelPosition} name={r.levelName} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-v2-surface-2">
                              <span className="block h-full rounded-full bg-v2-brand" style={{ width: `${Math.max(0, (r.points / maxPts) * 100)}%` }} />
                            </span>
                            <b className="w-10 text-right font-semibold tabular-nums text-v2-text">{r.points}</b>
                          </div>
                        </td>
                        <td className={`px-3 py-3 text-right font-semibold tabular-nums ${toneOf(r.today)}`}>{signedNum(r.today)}</td>
                        <td className="px-3 py-3 text-right">
                          <CoinDot n={r.balance} />
                        </td>
                        <td className="py-3 pl-3 pr-5">
                          {r.rank <= TOP ? (
                            <span className="inline-flex items-center gap-1.5 text-v2-small font-semibold text-v2-brand">
                              <Eye className="size-4" strokeWidth={1.75} aria-hidden /> Top-{TOP}
                            </span>
                          ) : (
                            <span className="text-v2-small text-v2-text-2">{t("faqat o'ziga")}</span>
                          )}
                        </td>
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
              <h2 className="text-v2-h3 font-semibold text-v2-text">{t("Qanday hisoblanadi")}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-v2-small text-v2-text-2 marker:text-v2-text-3">
                <li>
                  <b className="font-semibold text-v2-text">{t("Reyting tangasi")}</b> — {t("shu oyda berilgan minus ayirilgan tanga. Do'kondagi xaridlar ta'sir qilmaydi.")}
                </li>
                <li>{t("Teng tanga to'plaganlar bir xil o'rinda turadi.")}</li>
                <li>
                  {t("Kabinet va ekranda faqat")} <b className="font-semibold text-v2-text">Top-{TOP}</b> {t("chiqadi — pastdagilar hammaning oldida taqqoslanmaydi.")}
                </li>
                <li>{t("1-{month} tunda yakun qayd etiladi: 1-o'rin «Oy o'quvchisi» nishonini oladi.", { month: fmt.monthLower(nextMonth) })}</li>
              </ul>
              <Link href="/settings-gamification?tab=reasons" className="mt-3 inline-block text-v2-small font-semibold text-v2-brand hover:underline">
                {t("Tanga qoidalari")} →
              </Link>
            </section>

            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <h2 className="border-b border-v2-border px-5 py-4 text-v2-h3 font-semibold text-v2-text">{t("{month} yakuni", { month: fmt.monthName(view.prevMonth.month) })}</h2>
              {view.prevMonth.top.length === 0 ? (
                <p className="px-5 py-4 text-v2-small text-v2-text-3">{t("O'tgan oyda bu guruhda reyting tangasi yo'q")}</p>
              ) : (
                view.prevMonth.top.map((p) => (
                  <div key={p.pupilId} className="flex items-center gap-3 border-b border-v2-border px-5 py-3 last:border-b-0">
                    <RankMark rank={p.rank} show />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-v2-text">{p.name}</div>
                      <div className="truncate text-v2-small text-v2-text-2">{p.studentOfMonth ? t("«Oy o'quvchisi» nishoni") : g.label}</div>
                    </div>
                    <b className="font-semibold tabular-nums text-v2-text">{p.points}</b>
                  </div>
                ))
              )}
            </section>

            {view.competition && (
              <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
                <span className="text-v2-small font-semibold text-v2-text-2">
                  {t("Guruhlar musobaqasida")} · {g.branchName}
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <b className="text-[26px] font-semibold text-v2-text">{t("{n}-o'rin", { n: view.competition.rank })}</b>
                  <span className="text-v2-small text-v2-text-2">
                    {t("o'rtacha {n}", { n: view.competition.avg })} · {t("{n} ta guruhdan", { n: view.competition.groups })}
                  </span>
                </div>
                {view.competition.other && (
                  <p className="mt-2 text-v2-small text-v2-text-2">
                    {view.competition.rank === 1
                      ? t("Keyingi o'rinda {label} ({avg}). Farq — {d} tanga.", {
                          label: view.competition.other.label,
                          avg: view.competition.other.avg,
                          d: view.competition.avg - view.competition.other.avg,
                        })
                      : t("1-o'rinda {label} ({avg}). Farq — {d} tanga.", {
                          label: view.competition.other.label,
                          avg: view.competition.other.avg,
                          d: view.competition.other.avg - view.competition.avg,
                        })}
                  </p>
                )}
                <Link href="/gamification-competition" className="mt-3 inline-block text-v2-small font-semibold text-v2-brand hover:underline">
                  {t("Musobaqani ochish")} →
                </Link>
              </section>
            )}

            <Link href="/gamification-ranking?scope=branch" className="block px-1 text-v2-small text-v2-text-2 hover:text-v2-brand hover:underline">
              {t("Filial bo'yicha umumiy reyting")} →
            </Link>
          </aside>
        </div>
      )}

      {screen && g && (
        <Projector
          title={g.label}
          sub={view.period === "month" ? t("{month} reytingi", { month: monthLabel }) : t("Umumiy reyting")}
          rows={scored}
          onClose={() => setScreen(false)}
        />
      )}
      {open !== null && <ProfileModal pupilId={open} onClose={() => setOpen(null)} toast={toast} onChanged={() => setVersion((v) => v + 1)} />}
    </PageShell>
  );
}
