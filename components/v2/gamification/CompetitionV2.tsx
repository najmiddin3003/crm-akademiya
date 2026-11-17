"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Loader2, Trophy } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { gamApi } from "@/components/gamification/api";
import V2Confirm from "@/components/v2/form/V2Confirm";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, PageHead, PageShell, TH } from "@/components/v2/students/lists/listKit";
import { uzParts } from "./gamBits";

// YANGI VERSIYA — GAMIFIKATSIYA → «GURUHLAR MUSOBAQASI» (33-qism). Filial tablari va oy; peshqadam
// banneri (o'rtacha tanga, 2-o'rindan farqi, oy tugashiga necha kun, g'olibga tanga); jadval — o'rin,
// guruh, ustoz, o'quvchi, reyting tangasi, o'rtacha (chiziq); kam o'quvchili guruh «Qatnashmaydi»;
// o'ngda — «Qanday hisoblanadi», o'tgan oy g'olibi, boshqa filiallarda 1-o'rin. Direktorga «Oyni
// yakunlash» (o'tgan oy yakunlanmagan bo'lsa). Server: GET /api/gamification/competition
// (lib/gamification/competition.ts → competitionView), POST /api/gamification/month-close.

interface CompGroup {
  id: number;
  label: string;
  teacher: string;
  members: number;
  total: number;
  avg: number;
  rank: number;
  participates: boolean;
}

interface Branch {
  id: number;
  name: string;
  groups: CompGroup[];
  lastWinnerInfo: { label: string; teacher: string; avg: number; members: number; paidCoins: number; paidMembers: number; closedAt: string }[];
}

interface View {
  enabled: boolean;
  role: string;
  month: string;
  currentMonth: string;
  monthCloseDay: number;
  canClose: boolean;
  closeMonth: string;
  prevMonth: string;
  winnerCoins: number;
  minMembers: number;
  branchOptions: { id: number; name: string }[];
  branches: Branch[];
}

const shortBranch = (s: string) => s.replace(/^Akademiya\s+\d+\s+/i, "").trim() || s;
const fmtAvg = (n: number) => String(n);

export default function CompetitionV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const [month, setMonth] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [ask, setAsk] = useState(false);
  const [ver, setVer] = useState(0);

  const load = useCallback(
    (m: string | null) =>
      gamApi<View>(m ? `/api/gamification/competition?month=${m}` : "/api/gamification/competition").then((r) => {
        if (r.ok) {
          setView(r);
          setError("");
        } else setError(r.error);
      }),
    [],
  );

  useEffect(() => {
    void load(month);
  }, [load, month, ver]);

  const monthOptions = useMemo(() => {
    if (!view) return [];
    const out: { value: string; label: string }[] = [];
    let [y, m] = view.currentMonth.split("-").map(Number);
    for (let i = 0; i < 12; i++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      out.push({ value: key, label: `${fmt.monthName(key)} ${y}` });
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
    return out;
  }, [view, fmt]);

  async function closeMonth() {
    if (!view) return;
    const r = await gamApi<{ groups: number; winners: number; studentsOfMonth: number }>("/api/gamification/month-close", { method: "POST", body: { month: view.closeMonth } });
    setAsk(false);
    if (!r.ok) return showError(t(r.error));
    showSuccess(t("{month} yakunlandi: {g} ta guruh, {w} ta g'olib, {s} ta «Oy o'quvchisi»", { month: fmt.monthName(view.closeMonth), g: r.groups, w: r.winners, s: r.studentsOfMonth }));
    setVer((v) => v + 1);
  }

  if (!view) {
    return (
      <PageShell flow>
        <PageHead title={t("Guruhlar musobaqasi")} subtitle="" />
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

  const branches = view.branches;
  const cur = branches.find((b) => b.id === branchId) ?? branches[0] ?? null;
  const ranked = cur ? cur.groups.filter((g) => g.participates) : [];
  const out = cur ? cur.groups.filter((g) => !g.participates) : [];
  const leader = ranked[0] && ranked[0].avg > 0 ? ranked[0] : null;
  const second = ranked.find((g) => leader && g.id !== leader.id) ?? null;
  const maxAvg = Math.max(1, ...ranked.map((g) => g.avg));
  const isCur = view.month === view.currentMonth;
  const [yy, mm] = view.month.split("-").map(Number);
  const lastDay = new Date(yy, mm, 0).getDate();
  const todayDay = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }).slice(8, 10));
  const daysLeft = Math.max(0, lastDay - todayDay);
  const nextMonth = mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, "0")}`;
  const winner = cur?.lastWinnerInfo[0] ?? null;
  const others = branches.filter((b) => b.id !== cur?.id).map((b) => ({ b, top: b.groups.filter((g) => g.participates)[0] ?? null })).filter((x) => x.top && x.top.avg > 0);

  return (
    <PageShell flow>
      <PageHead
        title={t("Guruhlar musobaqasi")}
        subtitle={t("Har filialda guruhlar o'rtacha reyting tangasi bo'yicha bellashadi · natija 1-{month} tunda o'zi qayd etiladi", { month: fmt.monthLower(nextMonth) })}
        actions={
          view.canClose ? (
            <button type="button" onClick={() => setAsk(true)} className={secondaryBtn}>
              {t("Oyni yakunlash")} · {fmt.monthName(view.closeMonth)}
            </button>
          ) : undefined
        }
      />

      {!view.enabled && <NoticeBar>{t("Gamifikatsiya o'chiq — tanga yozilmaydi. Yoqish: Sozlamalar → Tanga tizimi.")}</NoticeBar>}

      <div className="flex flex-wrap items-center gap-2">
        {branches.length > 1 && (
          <div role="tablist" aria-label={t("Filial")} className="flex gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
            {branches.map((b) => {
              const on = b.id === cur?.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setBranchId(b.id)}
                  className={`h-9 rounded-[6px] px-3.5 text-v2-small transition-colors ${on ? "border border-v2-border bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "border border-transparent text-v2-text-2 hover:text-v2-text"}`}
                >
                  {shortBranch(b.name)}
                </button>
              );
            })}
          </div>
        )}
        <div className="w-52">
          <V2Select label={t("Oy")} value={view.month} onChange={(v) => setMonth(v)} options={monthOptions} />
        </div>
      </div>

      {!cur ? (
        <NoticeBar>{t("Bu oyda musobaqada qatnashadigan guruh yo'q")}</NoticeBar>
      ) : (
        <>
          {leader && (
            <section className="flex flex-wrap items-center gap-5 rounded-v2-lg border border-v2-brand bg-v2-brand-bg p-5">
              <span className="grid size-14 shrink-0 place-items-center rounded-v2-lg bg-v2-surface text-v2-warning shadow-v2-sm">
                <Trophy className="size-7" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-v2-small font-semibold text-v2-brand-text">
                  {isCur ? t("Hozir 1-o'rinda") : t("1-o'rin")} · {cur.name}
                </span>
                <div className="text-[24px] font-semibold text-v2-text">{leader.label}</div>
                <p className="text-v2-small text-v2-text-2">
                  {[leader.teacher ? `${t("ustoz")} ${leader.teacher}` : "", t("{n} o'quvchi", { n: leader.members })].filter(Boolean).join(" · ")}
                  {second && (
                    <>
                      {" · "}
                      {t("2-o'rindagi {label}dan", { label: second.label })} <b className="font-semibold text-v2-text">{fmtAvg(leader.avg - second.avg)}</b> {t("oldinda")}
                    </>
                  )}
                </p>
              </div>
              <div className="text-right">
                <b className="block text-[34px] font-semibold leading-none tabular-nums text-v2-text">{fmtAvg(leader.avg)}</b>
                <span className="text-v2-small text-v2-text-2">{t("o'rtacha tanga")}</span>
              </div>
              {isCur && (
                <div className="border-l border-v2-border pl-5 max-md:border-l-0 max-md:pl-0">
                  <b className="block text-v2-body font-semibold text-v2-text">{t("Oy tugashiga {n} kun", { n: daysLeft })}</b>
                  {view.winnerCoins > 0 && (
                    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-v2-warning-bg px-3 py-1 text-v2-small font-semibold text-v2-warning">
                      <span className="size-2 rounded-full bg-v2-warning" aria-hidden />
                      {t("G'olib o'quvchilariga +{n} tangadan", { n: view.winnerCoins })}
                    </span>
                  )}
                </div>
              )}
            </section>
          )}

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-v2-body">
                  <thead>
                    <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                      <th className={`${TH} w-16 pl-5`}>{t("O'rin")}</th>
                      <th className={TH}>{t("Guruh")}</th>
                      <th className={TH}>{t("Ustoz")}</th>
                      <th className={`${TH} text-right`}>{t("O'quvchi")}</th>
                      <th className={`${TH} text-right`}>{t("Reyting tangasi")}</th>
                      <th className={`${TH} pr-5`}>{t("O'rtacha")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((g) => (
                      <tr key={g.id} className="border-b border-v2-border hover:bg-v2-hover">
                        <td className="py-3 pl-5 pr-2">
                          <span
                            className={`grid size-8 place-items-center rounded-full text-v2-small font-semibold tabular-nums ${
                              g.avg > 0 && g.rank === 1 ? "bg-v2-warning-bg text-v2-warning" : g.avg > 0 && g.rank === 2 ? "bg-v2-surface-2 text-v2-text-2" : g.avg > 0 && g.rank === 3 ? "bg-v2-danger-bg text-v2-danger" : "text-v2-text-2"
                            }`}
                          >
                            {g.rank}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-2 font-semibold text-v2-text">
                            <span className={`size-2.5 shrink-0 rounded-full ${FAN_DOT[fanOf(g.label)]}`} aria-hidden />
                            {g.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-v2-text-2">{g.teacher || "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-v2-text-2">{g.members}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-v2-text-2">{g.total}</td>
                        <td className="py-3 pl-3 pr-5">
                          <div className="flex items-center gap-3">
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-v2-surface-2">
                              <span className={`block h-full rounded-full ${g.rank === 1 && g.avg > 0 ? "bg-v2-warning" : "bg-v2-brand"}`} style={{ width: `${Math.max(0, (g.avg / maxAvg) * 100)}%` }} />
                            </span>
                            <b className="w-12 text-right font-semibold tabular-nums text-v2-text">{fmtAvg(g.avg)}</b>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {out.map((g) => (
                      <tr key={g.id} className="border-b border-v2-border bg-v2-surface-2 last:border-b-0">
                        <td className="py-3 pl-5 pr-2 text-v2-text-3">—</td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-2 font-semibold text-v2-text-2">
                            <span className={`size-2.5 shrink-0 rounded-full ${FAN_DOT[fanOf(g.label)]}`} aria-hidden />
                            {g.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-v2-text-2">{g.teacher || "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-v2-text-2">{g.members}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-v2-text-2">{g.total}</td>
                        <td className="py-3 pl-3 pr-5 text-v2-small text-v2-text-3">{t("Qatnashmaydi · {n} tadan kam", { n: view.minMembers })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
                <h2 className="text-v2-h3 font-semibold text-v2-text">{t("Qanday hisoblanadi")}</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-v2-small text-v2-text-2 marker:text-v2-text-3">
                  <li>
                    <b className="font-semibold text-v2-text">{t("O'rtacha")}</b> = {t("guruhning shu oydagi reyting tangasi ÷ o'quvchilar soni. Katta va kichik guruh teng sharoitda.")}
                  </li>
                  <li>{t("Do'kondagi xaridlar va boshqa guruhdagi tangalar hisobga kirmaydi.")}</li>
                  {view.minMembers > 1 && <li>{t("Kamida {n} o'quvchili guruhlar qatnashadi.", { n: view.minMembers })}</li>}
                  <li>
                    {view.winnerCoins > 0
                      ? t("1-{month} tunda yakun qayd etiladi va g'olib guruhning har bir o'quvchisiga +{n} tanga yoziladi.", { month: fmt.monthLower(nextMonth), n: view.winnerCoins })
                      : t("1-{month} tunda yakun qayd etiladi.", { month: fmt.monthLower(nextMonth) })}
                  </li>
                </ul>
              </section>

              <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
                <span className="text-v2-small font-semibold text-v2-text-2">
                  {t("{month} g'olibi", { month: fmt.monthName(view.prevMonth) })} · {shortBranch(cur.name)}
                </span>
                {winner ? (
                  <>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-v2-md bg-v2-warning-bg text-v2-warning">
                        <Crown className="size-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-v2-h3 font-semibold text-v2-text">{winner.label}</div>
                        <div className="truncate text-v2-small text-v2-text-2">
                          {[winner.teacher, t("o'rtacha {n}", { n: winner.avg })].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                    {winner.paidCoins > 0 && (
                      <p className="mt-2 text-v2-small text-v2-text-2">
                        {t("{n} o'quvchiga +{c} tangadan yozildi", { n: winner.paidMembers, c: winner.paidCoins })}
                        {winner.closedAt && ` — ${fmt.dayMonth(uzParts(winner.closedAt).iso)} | ${uzParts(winner.closedAt).hm}`}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-v2-small text-v2-text-3">{t("O'tgan oy hali yakunlanmagan yoki g'olib yo'q")}</p>
                )}
              </section>

              {others.length > 0 && (
                <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
                  <h2 className="border-b border-v2-border px-5 py-3 text-v2-small font-semibold text-v2-text-2">{t("Boshqa filiallarda hozir 1-o'rin")}</h2>
                  {others.map(({ b, top }) => (
                    <button key={b.id} type="button" onClick={() => setBranchId(b.id)} className="block w-full border-b border-v2-border px-5 py-3 text-left last:border-b-0 hover:bg-v2-hover">
                      <div className="font-semibold text-v2-text">{top!.label}</div>
                      <div className="text-v2-small text-v2-text-2">
                        {b.name} · {t("o'rtacha {n}", { n: top!.avg })} · {t("{n} guruhdan", { n: b.groups.filter((g) => g.participates).length })}
                      </div>
                    </button>
                  ))}
                </section>
              )}
            </aside>
          </div>
        </>
      )}

      {ask && (
        <V2Confirm
          tone="brand"
          title={t("{month} oyini yakunlash", { month: fmt.monthName(view.closeMonth) })}
          body={t("Guruhlar o'rni va «Oy o'quvchisi» muzlatiladi, g'olib guruhga tanga yoziladi (sozlamada bo'lsa). Qaytarib bo'lmaydi.")}
          confirmLabel={t("Yakunlash")}
          onCancel={() => setAsk(false)}
          onConfirm={() => void closeMonth()}
        />
      )}
    </PageShell>
  );
}
