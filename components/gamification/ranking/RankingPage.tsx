"use client";

import "../gamification.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SpinnerBlock } from "@/components/ui/Spinner";
import Select from "@/components/ui/Select";
import { useLang, useT } from "@/components/shared/Language";
import { MONTHS } from "@/lib/i18n";
import type { GamRole } from "@/lib/gamification/types";
import { gamApi } from "../api";
import { btnPrimary, cardCls, Chip, Signed, useGamToast } from "../ui";
import ProfileModal from "../profile/ProfileModal";
import SpaceBackdrop from "./SpaceBackdrop";

// Gamifikatsiya → Reyting (TZ 4.3, 5.2; prototipdagi «Reyting» va
// «Ekranga chiqarish»). Guruh ichida — joriy oy yoki jami reyting tangasi
// (berilgan − ayirilgan, xarid kirmaydi). Teng tangali o'quvchilar bir xil
// o'rinni oladi; o'quvchilarga faqat top-5 ko'rinadi. Proyektor ekrani
// katta shriftli top-5 ni ochadi, Esc bilan yopiladi; uning orqa fonida —
// jonli kosmos (yulduzlar sekin suzadi, SpaceBackdrop.tsx).

interface Row {
  pupilId: number;
  name: string;
  points: number;
  rank: number;
  grade: number | null;
  levelPosition: number;
  levelName: string;
  balance: number;
}
interface View {
  enabled: boolean;
  role: GamRole;
  month: string;
  period: "month" | "all";
  groups: { id: number; label: string; branchName: string }[];
  group: { id: number; label: string; branchName: string } | null;
  rows: Row[];
}

const PAGE = "gm-page page-frame-lg container mx-auto max-w-[1900px] space-y-4 p-4 md:p-5";
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * O'rin belgisi RO'YXATDAGI TARTIB bo'yicha: faqat dastlabki uch qatorda
 * 🥇🥈🥉, qolganlarida hech narsa (27.09.2026, foydalanuvchi: "faqat
 * birinchi uchlikda 1, 2, 3 o'rinlar tursin"). Teng tangalilar bir xil
 * o'rinni olgani uchun ilgari hamma 0 da hammaga 🥇, keyin "1, 1, 1…"
 * chiqardi — ikkalasi ham xunuk ko'rindi. `index` — ro'yxatdagi o'rni (0 dan).
 */
function placeMedal(index: number): string | undefined {
  return MEDAL[index + 1];
}

/**
 * Proyektor uchun top-5 (TZ 4.3.7) — to'liq ekran, Esc yopadi.
 *
 * AYLANTIRISH (27.09.2026, foydalanuvchi: "o'quvchi ko'p bo'lsa ekranga
 * sig'mayapti, tepadagi ismlar ko'rinmayapti"): teng tangalilar bir xil
 * o'rinni olgani uchun "top-5" ancha uzun bo'lishi mumkin. Ilgari ro'yxat
 * `justify-center` bilan o'rtaga tekislanardi — sig'masa tepasi chegaradan
 * chiqib, unga aylantirib ham yetib bo'lmasdi. Endi ichki o'ram `min-h-full`
 * + `justify-center`: kalta ro'yxat o'rtada, uzuni tepadan boshlanib
 * aylanadi. "Yopish" va yulduzli fon `fixed` — aylantirganda joyida turadi;
 * oyna ochilganda fokus oladi — strelka/PageDown bilan ham aylanadi.
 */
function Projector({ title, sub, rows, onClose }: { title: string; sub: string; rows: Row[]; onClose: () => void }) {
  const { t } = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    boxRef.current?.focus();
  }, []);
  const top = rows.filter((r) => r.rank <= 5);
  return createPortal(
    <div
      ref={boxRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t("Reyting — top-5")}
      className="fixed inset-0 z-[250] isolate overflow-y-auto overscroll-contain bg-[#050816] text-white outline-none"
    >
      {/* -z-10 SHART: `fixed` o'zi qatlam (stacking context) hosil qiladi va
          z-index'siz oddiy matndan KEYIN chiziladi — sarlavha fon ostida qolardi. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <SpaceBackdrop />
      </div>
      <button type="button" onClick={onClose} className="fixed right-5 top-5 z-10 rounded-xl border border-white/30 bg-[#050816]/60 px-4 py-2 text-[15px] font-semibold backdrop-blur hover:bg-white/10">
        {t("Yopish")} · Esc
      </button>
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
        <div className="text-center">
          <div className="text-[clamp(28px,4vw,56px)] font-extrabold tracking-tight">🏆 {title}</div>
          <div className="mt-1 text-[clamp(14px,1.6vw,22px)] text-white/70">{sub}</div>
        </div>
        <ol className="mt-8 w-full max-w-4xl space-y-3">
          {top.map((r, i) => (
            <li key={r.pupilId} className="flex items-center gap-5 rounded-2xl bg-white/10 px-6 py-4 backdrop-blur">
              <span className="w-14 text-center text-[clamp(28px,3.4vw,48px)] font-extrabold">{placeMedal(i)}</span>
              <span className="min-w-0 flex-1 truncate text-[clamp(22px,3vw,42px)] font-bold">{r.name}</span>
              <span className="text-[clamp(22px,3vw,42px)] font-extrabold tabular-nums text-amber-300">{r.points}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>,
    document.body,
  );
}

export default function RankingPage() {
  const { t } = useT();
  const [lang] = useLang();
  const [toastNode, toast] = useGamToast();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"month" | "all">("month");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [screen, setScreen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(
    (gid: number | null, p: "month" | "all") =>
      gamApi<View>(gid ? `/api/gamification/ranking?groupId=${gid}&period=${p}` : `/api/gamification/ranking?period=${p}`).then((res) => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setError("");
        setView(res);
        if (res.group) setGroupId(res.group.id);
      }),
    [],
  );
  useEffect(() => {
    void load(null, "month");
  }, [load]);

  const monthName = (m: string) => (MONTHS[lang] ?? MONTHS.uz)[Number(m.slice(5, 7)) - 1] ?? m;

  if (error && !view) {
    return (
      <div className={PAGE}>
        <h1 className="text-xl font-semibold">{t("Reyting")}</h1>
        <div className={`${cardCls} text-sm text-muted-foreground`}>{t(error)}</div>
      </div>
    );
  }
  if (!view) return <div className={PAGE}><SpinnerBlock /></div>;
  const g = view.group;

  return (
    <div className={PAGE}>
      {toastNode}
      <div>
        <h1 className="text-xl font-semibold">{t("Reyting")}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {period === "all"
            ? t("Guruh ichidagi reyting — shu guruhda jami olingan reyting tangasi bo'yicha (berilgan − ayirilgan; do'kon xaridlari ta'sir qilmaydi). Teng tangali o'quvchilar bir xil o'rinni oladi. Ekranda va o'quvchilarga faqat top-5 ko'rinadi.")
            : t("Guruh ichidagi reyting — {month} oyida shu guruhda olingan reyting tangasi bo'yicha (berilgan − ayirilgan; do'kon xaridlari ta'sir qilmaydi). Teng tangali o'quvchilar bir xil o'rinni oladi. Ekranda va o'quvchilarga faqat top-5 ko'rinadi.", {
                month: monthName(view.month).toLowerCase(),
              })}
        </p>
      </div>
      {!g ? (
        <div className={`${cardCls} text-sm text-muted-foreground`}>{t("Guruh yo'q.")}</div>
      ) : (
        <>
          <div className={cardCls}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-[28rem]">
                <Select
                  value={String(g.id)}
                  onChange={(v) => void load(Number(v), period)}
                  options={view.groups.map((x) => ({ value: String(x.id), label: x.branchName ? `${x.label} — ${x.branchName}` : x.label }))}
                  size="md"
                  searchable
                />
              </div>
              <div className="inline-flex h-10 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 text-[13px]" role="tablist">
                {(["month", "all"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={period === p}
                    onClick={() => {
                      setPeriod(p);
                      void load(groupId, p);
                    }}
                    className={`h-9 rounded-md px-3 ${period === p ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
                  >
                    {p === "month" ? monthName(view.month) : t("Jami")}
                  </button>
                ))}
              </div>
              <button type="button" className={`${btnPrimary} sm:ml-auto`} disabled={!view.rows.length} onClick={() => setScreen(true)}>
                {t("Ekranga chiqarish")}
              </button>
            </div>
          </div>
          {view.rows.length === 0 ? (
            <div className={`${cardCls} text-sm text-muted-foreground`}>{t("Bu guruhda faol o'quvchi yo'q.")}</div>
          ) : (
            <div className={`${cardCls} gm-scroll-card table-frame overflow-hidden !p-0`}>
              <div className="table-scroll">
                <table className="gm-table">
                  <thead>
                    <tr>
                      <th>{t("O'rin")}</th>
                      <th>{t("O'quvchi")}</th>
                      <th>{t("Daraja")}</th>
                      <th>{t("Reyting tangasi")}</th>
                      <th>{t("Balans")}</th>
                      <th>{t("O'quvchilarga")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows.map((r, i) => (
                      <tr
                        key={r.pupilId}
                        className="gm-click"
                        tabIndex={0}
                        onClick={() => setOpen(r.pupilId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setOpen(r.pupilId);
                        }}
                      >
                        <td data-l={t("O'rin")}>
                          {placeMedal(i) && (
                            <span className="text-[18px]" aria-label={String(i + 1)}>
                              {placeMedal(i)}
                            </span>
                          )}
                        </td>
                        <td data-l="" className="gm-lead">
                          <b>{r.name}</b>
                          {r.grade !== null && <span className="ml-1.5 whitespace-nowrap text-[12px] text-muted-foreground">{t("{n}-sinf", { n: r.grade })}</span>}
                        </td>
                        <td data-l={t("Daraja")}>
                          <Chip tone="b">
                            {r.levelPosition} · {t(r.levelName)}
                          </Chip>
                        </td>
                        <td data-l={t("Reyting tangasi")}>
                          <Signed n={r.points} />
                        </td>
                        <td data-l={t("Balans")}>
                          <span className="gm-coin">{r.balance}</span>
                        </td>
                        <td data-l={t("O'quvchilarga")}>
                          {r.rank <= 5 ? <Chip tone="g">{t("Top-5 · ochiq")}</Chip> : <Chip tone="m">{t("Faqat o'ziga")}</Chip>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      {screen && g && (
        <Projector
          title={g.label}
          sub={period === "all" ? t("Jami reyting") : t("{month} reytingi", { month: monthName(view.month) })}
          rows={view.rows}
          onClose={() => setScreen(false)}
        />
      )}
      {open !== null && <ProfileModal pupilId={open} onClose={() => setOpen(null)} toast={toast} onChanged={() => void load(groupId, period)} />}
    </div>
  );
}
