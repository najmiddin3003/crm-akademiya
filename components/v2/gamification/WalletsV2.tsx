"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Download, Loader2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { gamApi } from "@/components/gamification/api";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { Avatar, NoticeBar, PageHead, PageShell, SearchBox, SegmentPills, SimplePager, TH, downloadCsv, matchQuery } from "@/components/v2/students/lists/listKit";
import { useGamToastV2 } from "./gamBits";
import { CoinDot, LevelBadge } from "./levelBits";
import WalletDrawerV2 from "./WalletDrawerV2";

// YANGI VERSIYA — GAMIFIKATSIYA → «HAMYONLAR» (33-qism; eski nomi «O'quvchilar»). Har o'quvchida bitta
// hamyon — barcha guruhlari uchun umumiy. Kartalar: muomaladagi tanga, oyda berilgan, ayirilgan (shundan
// davomat), do'konda sarflangan, darajalar bo'yicha; Hammasi / Faol / Muzlatilgan, qidiruv, Toifa /
// Daraja / Guruh; jadval balans bo'yicha. Qatorni bosish — o'ngdan «O'quvchi hamyoni» (WalletDrawerV2).
// Server: GET /api/gamification/students?summary=1 (lib/gamification/students.ts → listStudents,
// walletSummary) — kim kimni ko'rishi TZ 3 bo'yicha serverda.

interface Row {
  pupilId: number;
  name: string;
  grade: number | null;
  toifa: "kids" | "older";
  branchName: string;
  groups: string[];
  levelPosition: number;
  levelName: string;
  balance: number;
  frozen: boolean;
  earnedTotal: number;
  month: number;
  frozenSince: string | null;
}

interface Summary {
  month: string;
  circulating: number;
  activeWallets: number;
  given: number;
  taken: number;
  takenAttendance: number;
  shopCoins: number;
  shopCount: number;
  levels: { position: number; name: string; count: number }[];
}

type Seg = "all" | "active" | "frozen";
const LEVEL_BAR = ["bg-v2-border-strong", "bg-v2-success", "bg-v2-info", "bg-v2-violet", "bg-v2-warning"];
const signedNum = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export default function WalletsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const toast = useGamToastV2();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sum, setSum] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [seg, setSeg] = useState<Seg>("all");
  const [q, setQ] = useState("");
  const [toifa, setToifa] = useState("");
  const [level, setLevel] = useState("");
  const [group, setGroup] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState<Row | null>(null);
  const [ver, setVer] = useState(0);

  useEffect(() => {
    let alive = true;
    void gamApi<{ rows: Row[]; summary: Summary }>("/api/gamification/students?summary=1").then((r) => {
      if (!alive) return;
      if (r.ok) {
        setRows(r.rows);
        setSum(r.summary);
        setError("");
      } else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [ver]);

  const reload = useCallback(() => setVer((v) => v + 1), []);

  const groupOptions = useMemo(() => [...new Set((rows ?? []).flatMap((r) => r.groups))].sort((a, b) => a.localeCompare(b, "uz")), [rows]);
  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          (seg === "all" || (seg === "active" ? !r.frozen : r.frozen)) &&
          (!toifa || r.toifa === toifa) &&
          (!level || String(r.levelPosition) === level) &&
          (!group || r.groups.includes(group)) &&
          matchQuery(q, r.name, ...r.groups),
      ),
    [rows, seg, toifa, level, group, q],
  );
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const counts = { all: rows?.length ?? 0, active: rows?.filter((r) => !r.frozen).length ?? 0, frozen: rows?.filter((r) => r.frozen).length ?? 0 };
  const branches = [...new Set((rows ?? []).map((r) => r.branchName).filter(Boolean))];
  const monthLabel = sum ? fmt.monthName(sum.month) : "";
  const dayNum = new Date().getDate();

  function exportCsv() {
    downloadCsv(
      "hamyonlar.csv",
      [t("O'quvchi"), t("Guruh(lar)"), t("Daraja"), monthLabel, t("Jami topilgan"), t("Balans"), t("Holat")],
      filtered.map((r) => [r.name, r.groups.join("; "), `${r.levelPosition} · ${t(r.levelName)}`, r.month, r.earnedTotal, r.balance, r.frozen ? t("Muzlatilgan") : t("Faol")]),
    );
  }

  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  return (
    <PageShell flow>
      <PageHead
        title={t("Hamyonlar")}
        subtitle={`${branches.length === 1 ? branches[0] : t("Barcha filiallar")} · ${t("har o'quvchida bitta hamyon — barcha guruhlari uchun umumiy")}`}
        actions={
          <button type="button" onClick={exportCsv} disabled={!filtered.length} className={`${secondaryBtn} disabled:opacity-50`}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Export")}
          </button>
        }
      />

      {error && <NoticeBar>{t(error)}</NoticeBar>}
      {!rows && !error && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {sum && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.35fr]">
          <Kpi label={t("Muomaladagi tanga")} value={<CoinDot n={sum.circulating.toLocaleString("ru-RU").replace(/,/g, " ")} strong />} sub={t("{n} faol hamyonda", { n: sum.activeWallets })} />
          <Kpi label={t("{month}da berilgan", { month: monthLabel })} value={<span className="text-v2-success">+{sum.given}</span>} sub={`1–${dayNum}-${fmt.monthLower(sum.month)}`} />
          <Kpi label={t("Ayirilgan")} value={<span className="text-v2-danger">{signedNum(sum.taken)}</span>} sub={t("shundan davomat {n}", { n: signedNum(sum.takenAttendance) })} />
          <Kpi label={t("Do'konda sarflangan")} value={<CoinDot n={sum.shopCoins} strong />} sub={t("{n} ta sovg'a · {month}", { n: sum.shopCount, month: fmt.monthLower(sum.month) })} />
          <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <span className="text-v2-small font-semibold text-v2-text-2">
              {t("Darajalar bo'yicha")} · {t("{n} faol", { n: sum.activeWallets })}
            </span>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-v2-surface-2">
              {sum.levels.map((l, i) =>
                l.count > 0 ? <span key={l.position} className={LEVEL_BAR[i] ?? "bg-v2-brand"} style={{ width: `${(l.count / Math.max(1, sum.activeWallets)) * 100}%` }} /> : null,
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-v2-small text-v2-text-2">
              {sum.levels
                .filter((l) => l.count > 0)
                .map((l) => (
                  <span key={l.position} className="inline-flex items-center gap-1.5">
                    <span className={`size-2 rounded-[2px] ${LEVEL_BAR[l.position - 1] ?? "bg-v2-brand"}`} aria-hidden />
                    {t(l.name)} <b className="font-semibold text-v2-text">{l.count}</b>
                  </span>
                ))}
            </div>
          </div>
        </section>
      )}

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentPills
              items={[
                { key: "all", label: t("Hammasi"), count: counts.all },
                { key: "active", label: t("Faol"), count: counts.active },
                { key: "frozen", label: t("Muzlatilgan"), count: counts.frozen },
              ]}
              value={seg}
              onChange={resetPage(setSeg)}
            />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <SearchBox value={q} onChange={resetPage(setQ)} placeholder={t("Ism yoki guruh")} />
              <V2Select variant="chip" label={t("Toifa")} value={toifa} onChange={resetPage(setToifa)} options={[{ value: "kids", label: t("Kichiklar") }, { value: "older", label: t("Kattalar") }]} />
              <V2Select variant="chip" label={t("Daraja")} value={level} onChange={resetPage(setLevel)} options={(sum?.levels ?? []).map((l) => ({ value: String(l.position), label: `${l.position} · ${t(l.name)}` }))} />
              <V2Select variant="chip" label={t("Guruh")} value={group} onChange={resetPage(setGroup)} searchable="auto" options={groupOptions.map((g) => ({ value: g, label: g }))} />
            </div>
          </div>

          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-v2-body">
                <thead>
                  <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                    <th className={`${TH} pl-5`}>{t("O'quvchi")}</th>
                    <th className={TH}>{t("Guruh(lar)")}</th>
                    <th className={TH}>{t("Daraja")}</th>
                    <th className={`${TH} text-right`}>{monthLabel}</th>
                    <th className={`${TH} text-right`}>{t("Jami topilgan")}</th>
                    <th className={`${TH} text-right`}>{t("Balans")}</th>
                    <th className={TH}>{t("Holat")}</th>
                    <th className={`${TH} w-10 pr-4`} aria-label={t("Ochish")} />
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-v2-small text-v2-text-3">
                        {t("Mos o'quvchi topilmadi")}
                      </td>
                    </tr>
                  )}
                  {shown.map((r) => (
                    <tr key={r.pupilId} onClick={() => setOpen(r)} className={`cursor-pointer border-b border-v2-border last:border-b-0 hover:bg-v2-hover ${open?.pupilId === r.pupilId ? "bg-v2-brand-bg" : ""}`}>
                      <td className="py-3 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.name} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-v2-text">{r.name}</div>
                            <div className="truncate text-v2-small text-v2-text-2">
                              {[r.toifa === "kids" ? t("Kichiklar") : t("Kattalar"), r.grade ? t("{n}-sinf", { n: r.grade }) : ""].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {r.groups.length === 0 ? (
                          <span className="text-v2-small text-v2-text-3">{t("guruhda emas")}</span>
                        ) : (
                          <div className="space-y-0.5">
                            {r.groups.map((g) => (
                              <div key={g} className="flex items-center gap-2 text-v2-small text-v2-text">
                                <span className={`size-2 shrink-0 rounded-[2px] ${FAN_DOT[fanOf(g)]}`} aria-hidden />
                                <span className="truncate">{g}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <LevelBadge position={r.levelPosition} name={r.levelName} />
                      </td>
                      <td className={`px-3 py-3 text-right font-semibold tabular-nums ${r.month > 0 ? "text-v2-success" : r.month < 0 ? "text-v2-danger" : "text-v2-text-3"}`}>{signedNum(r.month)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-v2-text-2">{r.earnedTotal}</td>
                      <td className="px-3 py-3 text-right">
                        <CoinDot n={r.balance} strong />
                      </td>
                      <td className="px-3 py-3">
                        {r.frozen ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-v2-info-bg px-2 py-0.5 text-v2-small font-semibold text-v2-info">
                              <span className="size-1.5 rounded-full bg-v2-info" aria-hidden />
                              {t("Muzlatilgan")}
                            </span>
                            {r.frozenSince && <div className="mt-0.5 text-v2-caption text-v2-text-3">{t("{date}dan · arxivda", { date: fmt.dayMonth(r.frozenSince) })}</div>}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-small font-semibold text-v2-success">
                            <span className="size-1.5 rounded-full bg-v2-success" aria-hidden />
                            {t("Faol")}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pl-2 pr-4 text-v2-text-3">
                        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SimplePager total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} note={t("balans bo'yicha")} />
          </section>
        </>
      )}

      {open && <WalletDrawerV2 pupilId={open.pupilId} monthNet={open.month} onClose={() => setOpen(null)} onChanged={reload} toast={toast} />}
    </PageShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub: string }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <span className="text-v2-small font-semibold text-v2-text-2">{label}</span>
      <div className="mt-1 text-[26px] font-semibold tabular-nums leading-tight text-v2-text">{value}</div>
      <span className="mt-1 block text-v2-small text-v2-text-2">{sub}</span>
    </div>
  );
}
