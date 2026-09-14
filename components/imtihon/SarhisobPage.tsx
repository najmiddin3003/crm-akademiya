"use client";

import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "@/components/ui/Link";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { imTier, type GroupExam } from "@/lib/imtihon";
import TierBadge from "./TierBadge";

// Imtihon → Sarhisob (/imtihon/sarhisob) — "Natija kiritish" panelidan
// saqlangan guruh imtihonlari tarixi (MongoDB `group_exams`, joriy filial).
//
// Ustunlar: imtihon O'TKAZILGAN sana (panelda tanlangani, yozuv qo'shilgan
// sana emas), fan, ustoz, guruh, o'quvchilar soni, savollar soni va guruh
// o'rtacha bali — foiz rang toifalari bilan (lib/imtihon.ts → imTier).
// Qator bosilsa ostida har bir o'quvchining natijasi ochiladi.

/** "2026-09-14" → "14.09.2026". */
function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export default function SarhisobPage() {
  const [exams, setExams] = useState<GroupExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/imtihon/group")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setExams(d.exams as GroupExam[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/imtihon"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Imtihonga qaytish
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sarhisob</h1>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              Guruh bo&apos;yicha kiritilgan imtihon natijalari — sana, fan, ustoz, guruh va o&apos;rtacha ball
            </div>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{exams.length}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Sana</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Fan</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Ustoz</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Guruh</th>
                <th className="text-right px-4 py-3 whitespace-nowrap">O&apos;quvchilar soni</th>
                <th className="text-right px-4 py-3 whitespace-nowrap">Savollar soni</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Guruh o&apos;rtacha bali</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8">
                    <SpinnerBlock size={22} />
                  </td>
                </tr>
              )}
              {!loading && exams.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-[13px]">
                    Hali natija kiritilmagan. Imtihon sahifasidagi &quot;Natija kiritish&quot; tugmasidan foydalaning.
                  </td>
                </tr>
              )}
              {!loading &&
                exams.map((r, i) => {
                  const open = openId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => setOpenId(open ? null : r.id)}
                        className={`border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer ${open ? "bg-secondary/20" : ""}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                        <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="px-4 py-3 text-[13px] font-medium">{r.course}</td>
                        <td className="px-4 py-3 text-[13px]">{r.teacher}</td>
                        <td className="px-4 py-3 text-[13px]">
                          {r.groupLabel}
                          {r.level ? <span className="text-muted-foreground"> · {r.level}</span> : null}
                        </td>
                        <td className="px-4 py-3 text-[13px] tabular-nums text-right">{r.studentCount}</td>
                        <td className="px-4 py-3 text-[13px] tabular-nums text-right">{r.total}</td>
                        <td className="px-4 py-3">
                          <TierBadge pct={r.avgPct} />
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-border/50 bg-secondary/10">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="text-[12px] font-bold uppercase tracking-wider text-primary mb-2">
                              O&apos;quvchilar natijasi — {r.groupLabel}
                            </div>
                            <div className="rounded-lg border border-border overflow-hidden max-w-2xl">
                              <table className="w-full text-sm">
                                <thead className="bg-secondary/40">
                                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                                    <th className="text-left px-3 py-2 w-12">№</th>
                                    <th className="text-left px-3 py-2">Ism familiya</th>
                                    <th className="text-right px-3 py-2 whitespace-nowrap">To&apos;g&apos;ri javoblar</th>
                                    <th className="text-left px-3 py-2 w-32">O&apos;zlashtirish</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.students.map((s, j) => (
                                    <tr key={s.pupilId} className="border-b border-border/50 last:border-b-0">
                                      <td className="px-3 py-2 text-muted-foreground tabular-nums text-[13px]">{j + 1}</td>
                                      <td className="px-3 py-2 text-[13px]">{s.name}</td>
                                      <td className="px-3 py-2 text-[13px] tabular-nums text-right">
                                        {s.correct} / {r.total}
                                      </td>
                                      <td className="px-3 py-2">
                                        <TierBadge pct={s.pct} />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-secondary/30 border-t border-border">
                                    <td colSpan={3} className="px-3 py-2 text-[12px] font-semibold">Guruh o&apos;rtachasi</td>
                                    <td className="px-3 py-2">
                                      <span className={`text-[14px] font-bold tabular-nums ${imTier(r.avgPct).text}`}>{r.avgPct}%</span>
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-2">
                              Kiritildi: {r.createdAt}
                              {r.createdBy ? ` · ${r.createdBy}` : ""}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
