"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Crown, Monitor, RefreshCw, Settings2, Trophy } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import ProfileModal from "@/components/gamification/profile/ProfileModal";
import { Projector } from "@/components/gamification/ranking/RankingPage";
import { gamApi } from "@/components/gamification/api";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { EmptyBlock, SegTabs, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { useGamToastV2 } from "./gamBits";

// YANGI VERSIYA — REYTING (rasm «Reyting · oylik va umumiy», yorug'/qorong'i, 24.10.2026):
//   sarlavha «Reyting» + «Filial · N o'quvchi · oktyabr 1–12 bo'yicha»; o'ngda «Oktyabr · oylik |
//   Umumiy» va «Guruh: Hammasi»; uchlik (2 · 1 · 3, birinchisi `brand-bg` + 👑); jadval O'rin |
//   O'quvchi | Guruh | Oktyabr, tanga (chiziq) | Jami tanga; o'ngda «O'tgan oylar g'oliblari» va
//   «Qanday hisoblanadi». Ma'lumot — GET /api/gamification/ranking/board (lib/gamification/
//   rankingBoard.ts). Qatorni bosish — o'quvchining tanga profili (eski oyna); «Ekranga
//   chiqarish» — eski proyektor (top-5, kosmik fon).

interface Row {
  pupilId: number;
  name: string;
  grade: number | null;
  groupLabel: string;
  month: number;
  balance: number;
  points: number;
  rank: number;
}
interface Board {
  enabled: boolean;
  role: string;
  period: "month" | "all";
  month: string;
  today: string;
  branchName: string;
  groups: { id: number; label: string }[];
  groupId: number | null;
  rows: Row[];
  winners: { month: string; pupilId: number; name: string; points: number }[];
}

const signedPts = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export default function RankingV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const toast = useGamToastV2();
  const canRules = useCanOpen("/settings-gamification");
  const [period, setPeriod] = useState<"month" | "all">("month");
  const [groupId, setGroupId] = useState("");
  const [state, setState] = useState<{ key: string; board: Board | null; error: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [screen, setScreen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const key = `${period}|${groupId}|${version}`;
  useEffect(() => {
    let off = false;
    const q = new URLSearchParams({ period });
    if (groupId) q.set("groupId", groupId);
    gamApi<Board>(`/api/gamification/ranking/board?${q}`).then((res) => {
      if (off) return;
      setState((cur) => ({ key, board: res.ok ? res : (cur?.board ?? null), error: res.ok ? "" : res.error }));
    });
    return () => {
      off = true;
    };
  }, [key, period, groupId]);

  const board = state?.board ?? null;
  const loading = !state || state.key !== key;

  if (!board) {
    return (
      <Frame>
        <Header />
        {state?.error ? (
          <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
            <p className="text-v2-body text-v2-text-2">{t(state.error)}</p>
            <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-3`}>
              <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Qayta urinish")}
            </button>
          </div>
        ) : (
          <Skeleton />
        )}
      </Frame>
    );
  }

  const monthName = fmt.monthName(board.month);
  const day = Number(board.today.slice(8, 10));
  const rows = board.rows;
  const max = Math.max(0, ...rows.map((r) => r.points));
  // Uchlik — faqat tangasi 0 dan katta (hamma 0 da hammaga «1-o'rin» chiqmasin — 27.09 qarori).
  const podium = rows.filter((r) => r.points > 0).slice(0, 3);
  const groupName = board.groupId !== null ? (board.groups.find((g) => g.id === board.groupId)?.label ?? "") : "";
  const scopeName = groupName || board.branchName || t("Barcha guruhlar");
  const sub =
    board.period === "month"
      ? t("{scope} · {n} o'quvchi · {month} 1–{day} bo'yicha", { scope: scopeName, n: rows.length, month: fmt.monthLower(board.month), day })
      : t("{scope} · {n} o'quvchi · hozirgi balans bo'yicha", { scope: scopeName, n: rows.length });

  return (
    <Frame>
      <Header
        sub={sub}
        controls={
          <>
            <SegTabs
              label={t("Reyting turi")}
              value={period}
              onChange={(v) => setPeriod(v)}
              options={[
                { value: "month", label: t("{month} · oylik", { month: monthName }) },
                { value: "all", label: t("Umumiy") },
              ]}
            />
            <V2Select
              variant="value"
              label="Guruh"
              value={groupId}
              onChange={setGroupId}
              emptyLabel="Hammasi"
              options={board.groups.map((g) => ({ value: String(g.id), label: g.label }))}
            />
            <button
              type="button"
              onClick={() => setScreen(true)}
              disabled={!rows.length}
              title={t("Ekranga chiqarish")}
              aria-label={t("Ekranga chiqarish")}
              className={`${secondaryIcon} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Monitor className="size-4" strokeWidth={1.75} />
            </button>
          </>
        }
      />

      {!board.enabled && (
        <div role="note" className="rounded-v2-md bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
          {t("Tangalar tizimi hali ishga tushirilmagan — reyting bo'sh.")}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <EmptyBlock icon={<Trophy className="size-5" strokeWidth={1.75} />} title={t("Reytingda o'quvchi yo'q")} text={t("Faol guruhlardagi o'quvchilar shu yerda chiqadi.")} />
        </div>
      ) : (
        <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          {/* ── Uchlik ── */}
          {podium.length > 0 && (
            <section aria-label={t("Eng yaxshi uchlik")} className="rounded-v2-lg border border-v2-border bg-v2-surface-2 p-3 sm:p-4">
              <div className="grid gap-3 min-[40rem]:grid-cols-3">
                {[1, 0, 2].map((i) => {
                  const r = podium[i];
                  if (!r) return <div key={i} className="hidden min-[40rem]:block" />;
                  const first = i === 0;
                  return (
                    <button
                      key={r.pupilId}
                      type="button"
                      onClick={() => setOpen(r.pupilId)}
                      className={`flex flex-col items-center rounded-v2-lg border px-3 py-4 text-center transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                        first ? "order-first border-v2-brand bg-v2-brand-bg min-[40rem]:order-none" : "border-v2-border bg-v2-surface hover:bg-v2-surface-2"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center gap-1 rounded-v2-full px-2 py-0.5 text-v2-caption font-semibold ${
                          first ? "bg-v2-warning-bg text-v2-warning" : "border border-v2-border bg-v2-surface-2 text-v2-text-2"
                        }`}
                      >
                        {first && <Crown className="size-3.5" strokeWidth={2} aria-hidden />}
                        {t("{n}-o'rin", { n: r.rank })}
                      </span>
                      <span
                        className={`mt-2.5 inline-flex size-10 items-center justify-center rounded-full border text-v2-small font-semibold ${
                          first ? "border-v2-brand bg-v2-surface text-v2-text" : "border-v2-border bg-v2-surface-2 text-v2-text-2"
                        }`}
                        aria-hidden
                      >
                        {initialsOf(r.name)}
                      </span>
                      <span className="mt-2 max-w-full truncate text-v2-body font-semibold text-v2-text">{r.name}</span>
                      {r.groupLabel && <span className="max-w-full truncate text-v2-caption text-v2-text-2">{r.groupLabel}</span>}
                      <span className="mt-2 inline-flex items-baseline gap-1">
                        <b className="text-[1.375rem] font-semibold tabular-nums text-v2-text">{board.period === "month" ? signedPts(r.points) : r.points}</b>
                        <span className="text-v2-small text-v2-text-2">{t("tanga")}</span>
                      </span>
                      {board.period === "month" && <span className="mt-0.5 text-v2-caption text-v2-text-2">{t("jami {n}", { n: r.balance })}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <div className="grid items-start gap-4 min-[64rem]:grid-cols-[minmax(0,1fr)_17.5rem]">
            {/* ── Jadval ── */}
            <div className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className="relative overflow-x-auto overflow-y-hidden">
                <table className="w-full min-w-[40rem] border-collapse text-v2-small">
                  <thead>
                    <tr className="text-v2-caption text-v2-text-2">
                      <th className="w-14 whitespace-nowrap bg-v2-surface-2 py-2.5 pl-4 text-left font-medium shadow-[inset_0_-1px_0_var(--v2-border)]">{t("O'rin")}</th>
                      <th className="bg-v2-surface-2 px-3 py-2.5 text-left font-medium shadow-[inset_0_-1px_0_var(--v2-border)]">{t("O'quvchi")}</th>
                      <th className="bg-v2-surface-2 px-3 py-2.5 text-left font-medium shadow-[inset_0_-1px_0_var(--v2-border)]">{t("Guruh")}</th>
                      <th className="w-[13rem] whitespace-nowrap bg-v2-surface-2 px-3 py-2.5 text-left font-semibold text-v2-text shadow-[inset_0_-1px_0_var(--v2-border)]">
                        {board.period === "month" ? t("{month}, tanga", { month: monthName }) : t("Jami tanga")}
                      </th>
                      <th className="w-24 whitespace-nowrap bg-v2-surface-2 py-2.5 pl-3 pr-4 text-right font-medium shadow-[inset_0_-1px_0_var(--v2-border)]">
                        {board.period === "month" ? t("Jami tanga") : t("{month}, tanga", { month: monthName })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const pct = max > 0 && r.points > 0 ? Math.max(2, Math.round((r.points / max) * 100)) : 0;
                      return (
                        <tr
                          key={r.pupilId}
                          tabIndex={0}
                          onClick={() => setOpen(r.pupilId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setOpen(r.pupilId);
                          }}
                          className="cursor-pointer border-b border-v2-border transition-colors last:border-b-0 hover:bg-v2-surface-2 focus-visible:bg-v2-surface-2 focus-visible:outline-none"
                        >
                          <td className="py-2 pl-4 tabular-nums">
                            {r.rank === 1 && r.points > 0 ? (
                              <span className="inline-flex size-6 items-center justify-center rounded-v2-md bg-v2-warning-bg text-v2-caption font-semibold text-v2-warning">1</span>
                            ) : (
                              <span className="inline-flex w-6 justify-center text-v2-text-2">{r.rank}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
                                {initialsOf(r.name)}
                              </span>
                              <span className="truncate font-semibold text-v2-text">{r.name}</span>
                            </span>
                          </td>
                          <td className="max-w-[16rem] truncate px-3 py-2 text-v2-text-2" title={r.groupLabel}>
                            {r.groupLabel || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2.5">
                              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-v2-full" aria-hidden>
                                <span className="block h-full rounded-v2-full bg-v2-series-1" style={{ width: `${pct}%` }} />
                              </span>
                              <b className="w-10 shrink-0 text-right font-semibold tabular-nums text-v2-text">{board.period === "month" ? signedPts(r.points) : r.points}</b>
                            </span>
                          </td>
                          <td className="py-2 pl-3 pr-4 text-right tabular-nums text-v2-text-2">{board.period === "month" ? r.balance : signedPts(r.month)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── O'ng ustun ── */}
            <div className="flex flex-col gap-4">
              <section aria-labelledby="past-winners" className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                <h2 id="past-winners" className="text-v2-section text-v2-text">
                  {t("O'tgan oylar g'oliblari")}
                </h2>
                {board.winners.length === 0 ? (
                  <p className="mt-2 text-v2-small text-v2-text-2">{t("Hali g'olib yo'q — oy yakunida shu yerda chiqadi.")}</p>
                ) : (
                  <ul className="mt-2 divide-y divide-v2-border">
                    {board.winners.map((w) => (
                      <li key={w.month} className="flex items-center gap-2.5 py-2.5">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
                          {initialsOf(w.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-v2-small font-semibold text-v2-text">{w.name}</span>
                          <span className="block text-v2-caption text-v2-text-2">{t("{month} g'olibi", { month: fmt.monthName(w.month) })}</span>
                        </span>
                        <b className="shrink-0 text-v2-small font-semibold tabular-nums text-v2-text">{signedPts(w.points)}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="how-ranking" className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                <h2 id="how-ranking" className="text-v2-section text-v2-text">
                  {t("Qanday hisoblanadi")}
                </h2>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-v2-small text-v2-text-2 marker:text-v2-text-3">
                  <li>
                    <b className="font-semibold text-v2-text">{t("Oylik reyting")}</b> — {t("shu oy olingan tangalar (ayirilganlari hisobga olinadi). Har oyning 1-sanasida noldan boshlanadi.")}
                  </li>
                  <li>
                    <b className="font-semibold text-v2-text">{t("Umumiy reyting")}</b> — {t("o'quvchining hozirgi tanga balansi. Sovg'a olganda kamayadi.")}
                  </li>
                  <li>{t("Teng tanga to'plaganlar bir xil o'rinni egallaydi.")}</li>
                </ul>
                {canRules && (
                  <Link href="/settings-gamification?tab=reasons" className="mt-3 inline-flex items-center gap-1.5 text-v2-small font-semibold text-v2-brand-text underline-offset-2 hover:underline">
                    <Settings2 className="size-4" strokeWidth={1.75} aria-hidden />
                    {t("Tanga qoidalari")}
                  </Link>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {screen && (
        <Projector
          title={scopeName}
          sub={board.period === "month" ? t("{month} reytingi", { month: monthName }) : t("Umumiy reyting")}
          rows={rows.filter((r) => r.points > 0)}
          onClose={() => setScreen(false)}
        />
      )}
      {open !== null && <ProfileModal pupilId={open} onClose={() => setOpen(null)} toast={toast} onChanged={() => setVersion((v) => v + 1)} />}
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">{children}</div>;
}

function Header({ sub, controls }: { sub?: string; controls?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold leading-7 text-v2-text">{t("Reyting")}</h1>
        {sub && <p className="mt-0.5 text-v2-small text-v2-text-2">{sub}</p>}
      </div>
      {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <div className="h-44 rounded-v2-lg bg-v2-skeleton" />
      <div className="grid gap-4 min-[64rem]:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="h-96 rounded-v2-lg bg-v2-skeleton" />
        <div className="h-60 rounded-v2-lg bg-v2-skeleton" />
      </div>
    </div>
  );
}
