"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, Star } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Select from "@/components/v2/ui/V2Select";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, PageHead, PageShell, TH } from "@/components/v2/students/lists/listKit";
import { MIN_RATINGS_FOR_AVG, type TeacherRatingsPayload } from "@/lib/lessonRatingTypes";

// YANGI VERSIYA — NAZORAT → «USTOZLAR REYTINGI» (34-qism; eski nomi «Xodimlar reytingi», sahifasi bo'sh edi).
// O'quvchi har darsdan keyin kabinetda ustozni 1–5 baholaydi (components/student-web/v2/LessonRatingCard.tsx).
// Ko'rsatkichlar (o'rtacha, baho qo'yganlar ulushi, past baholar, izohlar), ustozlar jadvali (soni, o'rtacha,
// 5→1 taqsimot, o'tgan oy), «Diqqat talab qiladi», «So'nggi izohlar». Server: GET /api/lesson-ratings.

const DIST_CLS = ["bg-v2-success", "bg-v2-brand", "bg-v2-text-3", "bg-v2-warning", "bg-v2-danger"];
const fmt1 = (n: number | null) => (n === null ? "—" : n.toFixed(1).replace(".", ","));

export default function TeacherRatingsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [branch, setBranch] = useState("all");
  const [course, setCourse] = useState("");
  const [d, setD] = useState<TeacherRatingsPayload | null>(null);
  const [err, setErr] = useState("");

  const months = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const x = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
      out.push({ value: key, label: `${fmt.monthName(key)} ${x.getFullYear()}` });
    }
    return out;
  }, [fmt]);

  useEffect(() => {
    let off = false;
    void fetch(`/api/lesson-ratings?month=${month}${branch !== "all" ? `&branchId=${branch}` : ""}${course ? `&course=${encodeURIComponent(course)}` : ""}`, { cache: "no-store" })
      .then((x) => x.json())
      .then((j) => {
        if (off) return;
        if (j?.ok) {
          setD(j);
          setErr("");
        } else setErr(String(j?.error || "Ma'lumot olinmadi"));
      })
      .catch(() => !off && setErr("Tarmoq xatosi"));
    return () => {
      off = true;
    };
  }, [month, branch, course]);

  const k = d?.kpi;
  return (
    <PageShell flow>
      <PageHead
        title={t("Ustozlar reytingi")}
        subtitle={`${t("O'quvchi har darsdan keyin kabinetda ustozni 1–5 baholaydi")} · ${branch === "all" ? t("barcha filiallar") : (d?.branches.find((b) => String(b.id) === branch)?.name ?? "")}`}
        actions={
          <>
            <div className="w-48">
              <V2Select label={t("Oy")} value={month} onChange={setMonth} options={months} />
            </div>
            {(d?.branches.length ?? 0) > 1 && (
              <div className="w-56">
                <V2Select variant="value" label={t("Filial")} value={branch} onChange={setBranch} options={[{ value: "all", label: t("Barchasi") }, ...(d?.branches ?? []).map((b) => ({ value: String(b.id), label: b.name }))]} />
              </div>
            )}
            <div className="w-56">
              <V2Select variant="value" label={t("Kurs")} value={course} onChange={setCourse} emptyLabel={t("Hammasi")} clearable options={(d?.courses ?? []).map((c) => ({ value: c, label: c }))} />
            </div>
          </>
        }
      />

      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!d && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {d && k && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label={t("O'rtacha baho")}
              value={
                <span className="inline-flex items-center gap-2">
                  {fmt1(k.avg)}
                  <Star className="size-5 fill-v2-warning text-v2-warning" strokeWidth={1.75} aria-hidden />
                </span>
              }
              sub={t("{n} ta baho · {m} ustoz", { n: k.count, m: k.teachers })}
            />
            <Kpi label={t("Baho qo'yganlar")} value={k.ratedPct === null ? "—" : `${k.ratedPct}%`} sub={t("darsga kelgan o'quvchilardan")} />
            <Kpi label={t("Past baholar · 1–2")} value={<span className={k.low ? "text-v2-danger" : ""}>{k.low}</span>} sub={k.low ? t("{p}% · {n} tasi bitta ustozda", { p: k.lowPct, n: k.lowTopTeacher }) : t("past baho yo'q")} />
            <Kpi label={t("Izohlar")} value={k.comments} sub={k.count ? t("har {n}-bahoda izoh bor", { n: Math.max(1, Math.round(k.count / Math.max(1, k.comments))) }) : t("hali baho yo'q")} />
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              {d.rows.length === 0 ? (
                <p className="px-5 py-10 text-center text-v2-small text-v2-text-3">{t("Bu oyda hali baho yo'q — o'quvchilar kabinetda kelgan darsini baholaydi")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-v2-body">
                    <thead>
                      <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                        <th className={`${TH} pl-5`}>{t("Ustoz")}</th>
                        <th className={`${TH} text-right`}>{t("Baho")}</th>
                        <th className={`${TH} text-right`}>{t("O'rtacha")}</th>
                        <th className={TH}>{t("5 → 1 yulduz")}</th>
                        <th className={`${TH} pr-5 text-right`}>{fmt.monthName(prevOf(month))}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.rows.map((r) => {
                        const warn = r.avg !== null && r.avg < 3.5;
                        const delta = r.avg !== null && r.prevAvg !== null ? Math.round((r.avg - r.prevAvg) * 10) / 10 : null;
                        return (
                          <tr key={r.teacher} className={`border-b border-v2-border last:border-b-0 ${d.attention?.teacher === r.teacher ? "bg-v2-warning-bg" : ""}`}>
                            <td className="py-3 pl-5 pr-3">
                              <div className="font-semibold text-v2-text">{r.teacher}</div>
                              <div className="text-v2-small text-v2-text-2">{r.sub}</div>
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-v2-text-2">{r.count}</td>
                            <td className="px-3 py-3 text-right">
                              <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${warn ? "text-v2-danger" : "text-v2-text"}`}>
                                <Star className="size-4 fill-v2-warning text-v2-warning" strokeWidth={1.75} aria-hidden />
                                {fmt1(r.avg)}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex h-2 w-44 overflow-hidden rounded-full bg-v2-surface-2" title={r.dist.map((n, i) => `${5 - i}★ ${n}`).join(" · ")}>
                                {r.dist.map((n, i) => (n ? <span key={i} className={DIST_CLS[i]} style={{ width: `${(n / r.count) * 100}%` }} /> : null))}
                              </div>
                            </td>
                            <td className={`py-3 pl-3 pr-5 text-right text-v2-small font-semibold tabular-nums ${delta === null ? "text-v2-text-3" : delta >= 0 ? "text-v2-success" : "text-v2-danger"}`}>
                              {r.prevAvg === null ? "—" : `${fmt1(r.prevAvg)}${delta !== null ? ` (${delta >= 0 ? "+" : ""}${fmt1(delta)})` : ""}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-v2-border px-5 py-3 text-v2-small text-v2-text-2">
                <span>{t("{n} ustoz · {m} tadan kam baho olganlar o'rtachaga kirmaydi", { n: d.rows.length, m: MIN_RATINGS_FOR_AVG })}</span>
                <span className="flex gap-2">
                  {DIST_CLS.map((c, i) => (
                    <span key={c} className="inline-flex items-center gap-1">
                      <span className={`size-2 rounded-[2px] ${c}`} aria-hidden />
                      {5 - i}
                    </span>
                  ))}
                </span>
              </div>
            </section>

            <aside className="space-y-4">
              {d.attention && (
                <section className="rounded-v2-lg border border-v2-warning bg-v2-warning-bg p-5">
                  <span className="flex items-center gap-2 text-v2-small font-semibold text-v2-warning">
                    <AlertTriangle className="size-4" strokeWidth={1.75} aria-hidden />
                    {t("Diqqat talab qiladi")}
                  </span>
                  <div className="mt-2 font-semibold text-v2-text">
                    {d.attention.teacher}
                    {d.attention.groupLabel ? ` · ${d.attention.groupLabel}` : ""}
                  </div>
                  <p className="mt-1 text-v2-small text-v2-text-2">
                    {t("Oxirgi {n} darsda o'rtacha {a}. {l} ta past baho.", { n: d.attention.lastN, a: fmt1(d.attention.lastAvg), l: d.attention.low })}
                    {d.attention.tags.length > 0 && ` ${t("Ko'p takrorlangan")}: ${d.attention.tags.map((x) => `«${t(x)}»`).join(", ")}.`}
                  </p>
                </section>
              )}
              <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
                <h2 className="border-b border-v2-border px-5 py-4 text-v2-h3 font-semibold text-v2-text">{t("So'nggi izohlar")}</h2>
                {d.comments.length === 0 && <p className="px-5 py-4 text-v2-small text-v2-text-3">{t("Hali izoh yo'q")}</p>}
                {d.comments.map((c, i) => (
                  <div key={i} className="border-b border-v2-border px-5 py-3">
                    <div className="flex items-baseline justify-between gap-2 text-v2-small text-v2-text-2">
                      <span className="truncate">
                        {c.groupLabel} · {fmt.dayMonth(c.date)}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-v2-text">
                        <Star className="size-3.5 fill-v2-warning text-v2-warning" strokeWidth={1.75} aria-hidden />
                        {c.stars}
                      </span>
                    </div>
                    <p className="mt-1 text-v2-body text-v2-text">«{c.text}»</p>
                  </div>
                ))}
                <p className="px-5 py-3 text-v2-small text-v2-text-2">{t("Kim qo'ygani hech kimga ko'rsatilmaydi. Bir o'quvchi kelgan darsini bir marta baholaydi.")}</p>
              </section>
            </aside>
          </div>
        </>
      )}
    </PageShell>
  );
}

function prevOf(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub: string }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <span className="text-v2-small font-semibold text-v2-text-2">{label}</span>
      <b className="mt-1 block text-[28px] font-semibold tabular-nums text-v2-text">{value}</b>
      <span className="text-v2-small text-v2-text-2">{sub}</span>
    </div>
  );
}
