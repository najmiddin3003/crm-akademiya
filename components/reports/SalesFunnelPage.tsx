"use client";

import { useMemo, useState } from "react";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { COURSES, MODERATORS, SUBCOURSES, TEACHERS, createInitialOrders, type Order } from "@/lib/ordersData";
import { buildFunnelReport, buildFunnelSteps, buildStageSummary } from "@/lib/salesFunnel";

// Hisobotlar → Sotuv voronkasi (href /reports-funnel). Ma'lumot mavjud
// buyurtmalardan (lib/ordersData.ts) hisoblanadi — yangi backend yo'q,
// O'quvchilar/Guruh sahifalari bilan bir xil manba.
//
// Chapda 11 qatorli "Hisobot turlari" jadvali, o'ngda voronka (bosqichma-
// bosqich toraya boradigan shakl) va lid bosqichlari taqsimoti.

const selectCls =
  "h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const SOURCES = ["Instagram", "Telegram", "Tanish", "Facebook", "YouTube", "Sayt"];

// Referensda lid voronkasi ustida shu uch filtr turadi. "Yopilgan" lid —
// yakuniy holatga yetgani (bekor/yakun/o'tkazma) yoki "Ketdim" bosqichidagisi;
// qolganlari hali ishlanmoqda.
const LEAD_STATES = [
  { key: "all", label: "Hammasi" },
  { key: "active", label: "Hozir ishlanayotgan lidlar" },
  { key: "closed", label: "Yopilganlar" },
] as const;

type LeadStateKey = (typeof LEAD_STATES)[number]["key"];

const CLOSED_STATUSES = new Set(["Bekor qilindi", "Yakunlandi", "O'tkazildi"]);

function isClosedLead(o: Order): boolean {
  return o.stage === "ketdim" || CLOSED_STATUSES.has(o.status);
}

function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

export default function SalesFunnelPage() {
  const allOrders = useMemo(() => createInitialOrders(), []);

  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [course, setCourse] = useState("");
  const [subcourse, setSubcourse] = useState("");
  const [moderator, setModerator] = useState("");
  const [teacher, setTeacher] = useState("");
  const [source, setSource] = useState("");
  const [funnelMode, setFunnelMode] = useState<"student" | "course">("student");
  const [leadState, setLeadState] = useState<LeadStateKey>("all");

  const orders = useMemo(
    () =>
      allOrders.filter((o) => {
        if (course && o.course !== course) return false;
        if (subcourse && o.subcourse !== subcourse) return false;
        if (moderator && o.moderator !== moderator) return false;
        if (teacher && o.teacher !== teacher) return false;
        if (source && o.source !== source) return false;
        return true;
      }),
    [allOrders, course, subcourse, moderator, teacher, source],
  );

  const rows = useMemo(() => buildFunnelReport(orders), [orders]);
  const steps = useMemo(() => buildFunnelSteps(rows), [rows]);
  // Lid bosqichlari bloki qo'shimcha ravishda "Hammasi / ishlanayotgan /
  // yopilgan" filtri bilan toraytiriladi — yuqoridagi filtrlar esa butun
  // sahifaga ta'sir qiladi.
  const leadOrders = useMemo(() => {
    if (leadState === "all") return orders;
    const closed = leadState === "closed";
    return orders.filter((o) => isClosedLead(o) === closed);
  }, [orders, leadState]);

  const stages = useMemo(() => buildStageSummary(leadOrders), [leadOrders]);

  // "Kurslar kesimida buyurtmalar taqsimoti" — eng ko'p buyurtmali 8 ta kurs.
  const courseBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orders) {
      if (!o.course) continue;
      counts.set(o.course, (counts.get(o.course) ?? 0) + 1);
    }
    const total = orders.length || 1;
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value, percent: (value / total) * 100 }));
  }, [orders]);

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Filtrlar */}
      <div className="flex items-center gap-2 flex-wrap">
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Oraliqni tanlang" />
        <select value={source} onChange={(e) => setSource(e.target.value)} className={`${selectCls} w-40`}>
          <option value="">Marketing</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={course} onChange={(e) => setCourse(e.target.value)} className={`${selectCls} w-40`}>
          <option value="">Kurs</option>
          {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={subcourse} onChange={(e) => setSubcourse(e.target.value)} className={`${selectCls} w-40`}>
          <option value="">Subkurs</option>
          {SUBCOURSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={moderator} onChange={(e) => setModerator(e.target.value)} className={`${selectCls} w-44`}>
          <option value="">Moderator</option>
          {MODERATORS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className={`${selectCls} w-48`}>
          <option value="">O&apos;qituvchi</option>
          {TEACHERS.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Hisobot turlari */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/20">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-5 py-3 text-left w-12">№</th>
                  <th className="px-5 py-3 text-left">Hisobot turlari</th>
                  <th className="px-5 py-3 text-right w-24">Soni</th>
                  <th className="px-5 py-3 text-right pr-5 w-32">Kurslar soni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr key={r.label} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-5 py-3">{r.label}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">{fmt(r.count)}</td>
                    <td className="px-5 py-3 pr-5 text-right tabular-nums text-muted-foreground">{fmt(r.courses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Voronka */}
        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="inline-flex items-center rounded-lg border border-border p-1">
            <button
              onClick={() => setFunnelMode("student")}
              className={`h-8 px-4 rounded-md text-sm font-medium ${funnelMode === "student" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
            >
              O&apos;quvchi
            </button>
            <button
              onClick={() => setFunnelMode("course")}
              className={`h-8 px-4 rounded-md text-sm font-medium ${funnelMode === "course" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
            >
              Kurs
            </button>
          </div>

          <div className="space-y-2">
            {steps.map((s, i) => {
              // Voronka: har bosqich kengligi foizga mos, pastga qarab torayadi.
              const width = Math.max(8, s.percent);
              const shade = 55 - i * 8;
              return (
                <div key={s.label} className="flex items-center gap-4">
                  <div className="w-44 shrink-0 text-right">
                    <div className="text-[18px] font-semibold tabular-nums leading-tight">
                      {fmt(funnelMode === "course" ? rows[i]?.courses ?? 0 : s.count)}
                    </div>
                    <div className="text-[12px] text-primary">{s.label}</div>
                    <div className="text-[12px] text-muted-foreground tabular-nums">{s.percent.toFixed(1)}%</div>
                  </div>
                  <div className="flex-1 h-12 flex items-center">
                    <div
                      className="h-full rounded-md mx-auto transition-all"
                      style={{ width: `${width}%`, background: `hsl(211 90% ${shade}%)` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lid bosqichlari + kurslar taqsimoti */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {LEAD_STATES.map((s) => (
              <button
                key={s.key}
                onClick={() => setLeadState(s.key)}
                className={`h-8 px-3.5 rounded-lg text-[13px] font-medium transition-colors ${
                  leadState === s.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="text-[14px] font-semibold mb-1">Lidlar soni</div>
          <div className="text-[13px] text-muted-foreground mb-4">{fmt(leadOrders.length)} ta</div>
          <div className="space-y-3">
            {stages.map((s) => (
              <div key={s.key}>
                <div className="flex items-center justify-between text-[13px] mb-1">
                  <span>{s.emoji} {s.label}</span>
                  <span className="text-muted-foreground tabular-nums">{fmt(s.count)} ta lid · {s.percent.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${s.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="text-[14px] font-semibold mb-4">Kurslar kesimida buyurtmalar taqsimoti</div>
          {courseBreakdown.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Ma&apos;lumot topilmadi</div>
          ) : (
            <div className="space-y-3">
              {courseBreakdown.map((c) => (
                <div key={c.label} className="flex items-center gap-3">
                  <div className="w-32 shrink-0 text-[13px] truncate">{c.label}</div>
                  <div className="relative flex-1 h-7 rounded-full overflow-hidden bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary flex items-center justify-center"
                      style={{ width: `${Math.max(c.percent, 4)}%` }}
                    >
                      {c.percent >= 8 && (
                        <span className="text-[11px] font-semibold text-white">{c.percent.toFixed(1)} %</span>
                      )}
                    </div>
                    {c.percent < 8 && (
                      <span className="absolute inset-0 flex items-center pl-2 text-[11px] text-muted-foreground">
                        {c.percent.toFixed(1)} %
                      </span>
                    )}
                  </div>
                  <div className="w-20 shrink-0 text-right text-[13px] tabular-nums font-medium">{fmt(c.value)} ta</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
