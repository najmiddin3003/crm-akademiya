"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, DollarSign, History, RotateCcw, Search } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import {
  payrollBase,
  payrollDebt,
  payrollDue,
  payrollEarned,
  payrollPaid,
  payrollPeriod,
  payrollPeriodLabel,
  type EmployeePayroll,
} from "@/lib/salary";

// Moliya → Oylik chiqarish → xodim tanlash (/finance-payroll/create).
//
// Har bir qator /api/salary-runs/employees-payroll'dan keladi va HAMMA
// qiymat haqiqiy (lib/payrollSources.ts):
//   oklad   ← xodim kartasidagi filial bo'yicha ish haqi
//   tushum  ← o'quvchilari to'lagan pul (transaction_entries.teacherName)
//   foiz    ← Sozlamalar > Moliya > Oylik foizlari
//   avans / to'langan oylik ← kassadan chiqarilgan yozuvlar
//   bonus / jarima ← o'z kolleksiyalari
//
// Ish haqi sozlanmagan xodimda raqam KO'RSATILMAYDI — "Sozlanmagan" deb
// turadi va uni tanlab oylik chiqarib bo'lmaydi (server ham rad etadi).

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}
function fmtSum(n: number): string {
  return fmtNum(n) + " so'm";
}

type HisoblashFilter = "all" | "foiz" | "fixed";

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  tone: "cyan" | "amber" | "blue" | "rose";
}
function StatCard({ label, value, hint, tone }: StatCardProps) {
  const tones = {
    cyan:  { bar: "bg-cyan-500",  text: "text-cyan-500",  dot: "bg-cyan-500" },
    amber: { bar: "bg-amber-500", text: "text-amber-500", dot: "bg-amber-500" },
    blue:  { bar: "bg-sky-500",   text: "text-sky-500",   dot: "bg-sky-500" },
    rose:  { bar: "bg-rose-500",  text: "text-rose-500",  dot: "bg-rose-500" },
  }[tone];
  return (
    <div className="relative rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm overflow-hidden">
      <span className={`absolute left-0 top-0 h-full w-1 ${tones.bar}`} />
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${tones.dot}`} />
        {label}
      </div>
      <div className={`mt-1.5 text-[22px] font-bold tabular-nums leading-tight ${tones.text}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

export default function SalaryCreatePage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [employees, setEmployees] = useState<EmployeePayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [turiFilter, setTuriFilter] = useState<string>("all");
  const [hisoblash, setHisoblash] = useState<HisoblashFilter>("all");
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const period = useMemo(() => payrollPeriod(), []);
  const periodLabel = useMemo(() => payrollPeriodLabel(period), [period]);

  function fetchRows() {
    return fetch("/api/salary-runs/employees-payroll")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setEmployees(d.employees); })
      .finally(() => setLoading(false));
  }
  /** "Qayta hisoblash" tugmasi — spinnerni qayta yoqadi. */
  function load() {
    setLoading(true);
    fetchRows();
  }
  // Effekt tanasida setState chaqirilmaydi (`loading` boshlanishida true).
  useEffect(() => { fetchRows(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (turiFilter !== "all" && e.turi !== turiFilter) return false;
      if (hisoblash !== "all" && e.salaryType !== hisoblash) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.phone.toLowerCase().includes(q);
    });
  }, [employees, query, turiFilter, hisoblash]);

  const allSelected = filtered.filter((e) => e.configured).length > 0
    && filtered.filter((e) => e.configured).every((e) => selected.has(e.id));
  const someSelected = selected.size > 0 && !allSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

  // "Hammasini tanlash" ham faqat sozlanganlarni oladi.
  const selectable = useMemo(() => filtered.filter((e) => e.configured), [filtered]);
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) { selectable.forEach((e) => next.delete(e.id)); }
      else { selectable.forEach((e) => next.add(e.id)); }
      return next;
    });
  }
  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Faqat ish haqi SOZLANGAN xodimlar jamlanadi — sozlanmaganning
  // "hisoblangan"i 0 bo'ladi va uni yig'indiga qo'shish jami summani
  // haqiqatdan kichik ko'rsatgan bo'lardi.
  const stats = useMemo(() => {
    let hisoblangan = 0, avans = 0, tolangan = 0, qolgan = 0, otganOydan = 0, qarzdorlik = 0;
    for (const e of employees.filter((x) => x.configured)) {
      hisoblangan += payrollEarned(e, period);
      avans += e.paidAvans;
      tolangan += e.paidOylik;
      // To'lanadigan va qarzdorlik ALOHIDA yig'iladi — ishorali yig'indi
      // bo'lganda bir xodimning qarzi boshqasiga to'lanadigan pulni
      // "yeb" qo'yardi va karta jamini haqiqatdan kichik ko'rsatardi.
      qolgan += Math.max(payrollDue(e, period), 0);
      qarzdorlik += payrollDebt(e, period);
      otganOydan += e.carryOver;
    }
    return { hisoblangan, avans, tolangan, qolgan, otganOydan, qarzdorlik };
  }, [employees, period]);

  async function confirmPayout() {
    setSaving(true);
    try {
      const res = await fetch("/api/salary-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Oylik chiqarilmadi");
        setSaving(false);
        return;
      }
      showSuccess("Oylik chiqarildi");
      router.push("/finance-payroll");
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  const selectedCount = selected.size;
  const turiOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => set.add(e.turi));
    return Array.from(set);
  }, [employees]);
  const turiLabel = (t: string) =>
    t === "teacher" ? "O'qituvchilar" : t === "moderator" ? "Moderatorlar" : t === "admin" ? "Adminlar" : t;

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/finance-payroll"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Orqaga
        </Link>
        <h1 className="text-[18px] md:text-[20px] font-bold">Oylik hisob-kitob</h1>
        <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-primary/10 text-primary text-[12px] font-semibold">
          {periodLabel}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            href="/finance-payroll"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <History className="w-4 h-4" />
            Chiqarishlar tarixi
          </Link>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            Qayta hisoblash
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={selectedCount === 0}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DollarSign className="w-4 h-4" />
            Oylikni chiqarish
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/20 text-[11px] font-bold tabular-nums">
              {selectedCount}
            </span>
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          tone="cyan"
          label="Hisoblangan oylik (shu kungacha)"
          value={fmtSum(stats.hisoblangan)}
          hint={`${employees.length} ta xodim · ${periodLabel}`}
        />
        <StatCard
          tone="amber"
          label="Berilgan avans"
          value={fmtSum(stats.avans)}
          hint="oylikdan ushlab qolinadi"
        />
        <StatCard
          tone="blue"
          label="To'langan oylik"
          value={fmtSum(stats.tolangan)}
          hint="kassadan chiqarilgan"
        />
        <StatCard
          tone="rose"
          label="Qolgan to'lanadigan"
          value={fmtSum(stats.qolgan)}
          hint={
            stats.qarzdorlik > 0
              ? `o'tgan oydan: ${fmtSum(stats.otganOydan)} · xodim qarzi: ${fmtSum(stats.qarzdorlik)}`
              : `shu jumladan o'tgan oydan: ${fmtSum(stats.otganOydan)}`
          }
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism yoki telefon raqami…"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="relative">
          <select
            value={turiFilter}
            onChange={(e) => setTuriFilter(e.target.value)}
            className="h-10 pl-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]"
          >
            <option value="all">Barcha xodimlar</option>
            {turiOptions.map((t) => (
              <option key={t} value={t}>{turiLabel(t)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={hisoblash}
            onChange={(e) => setHisoblash(e.target.value as HisoblashFilter)}
            className="h-10 pl-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[200px]"
          >
            <option value="all">Hisoblash: barchasi</option>
            <option value="foiz">Hisoblash: foizli</option>
            <option value="fixed">Hisoblash: okladli</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-secondary/30">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              ref={headerCheckboxRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="rounded border-border w-4 h-4"
            />
            <span className="font-medium">Hammasini tanlash</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground tabular-nums">{selectedCount} ta tanlangan</span>
          </label>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 text-primary text-xs">
            <span className="font-medium">Umumiy soni:</span>
            <span className="font-bold tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 w-10" />
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;liq ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Turi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Hisob-kitob (shu kungacha)</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Bonus</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Jarima</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Hisoblangan</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Avans olingan</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">To&apos;langan oylik</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">O&apos;tgan oydan</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">Qolgan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const base = payrollBase(e, period);
                const earned = payrollEarned(e, period);
                const paid = payrollPaid(e);
                const due = payrollDue(e, period);
                const isFoiz = e.salaryType === "foiz";
                const badgeCls = isFoiz
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-sky-500/10 text-sky-600 border-sky-500/20";
                const formula = isFoiz
                  ? `${fmtNum(e.collected)} × ${e.percent}% = ${fmtNum(base)}`
                  : `${fmtNum(e.fixedSalary)} × ${period.day}/${period.daysIn} kun = ${fmtNum(base)}`;
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-border/50 transition-colors hover:bg-secondary/30 ${selected.has(e.id) ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-3 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggleOne(e.id)}
                        disabled={!e.configured}
                        title={e.configured ? undefined : "Ish haqi sozlanmagan — oylik chiqarib bo'lmaydi"}
                        className="rounded border-border w-4 h-4 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-3 py-3 align-top text-muted-foreground tabular-nums text-[13px]">{i + 1}</td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">
                      {/* Ism — xodim profiliga havola (qaysi hisob-kitob
                          qaysi odamga tegishli ekanini tekshirish uchun). */}
                      <Link
                        href={`/management-xodimlar/${e.id}`}
                        className="text-[13px] font-medium text-primary hover:underline"
                      >
                        {e.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground tabular-nums">{e.phone}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {e.configured ? (
                        <span className={`inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium ${badgeCls} whitespace-nowrap`}>
                          {isFoiz ? `Foiz ${e.percent}%` : "Oklad"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-medium bg-amber-500/10 text-amber-700 border-amber-500/20 whitespace-nowrap">
                          Sozlanmagan
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-[12.5px] tabular-nums">
                      {e.configured ? (
                        <div className="whitespace-nowrap">{formula}</div>
                      ) : (
                        <Link href={`/management-xodimlar/${e.id}`} className="text-[12px] text-primary hover:underline">
                          Ish haqi kiritilmagan — sozlash
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {e.bonus > 0 ? <span className="text-emerald-600 font-medium">{fmtNum(e.bonus)}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {e.jarima > 0 ? <span className="text-rose-600 font-medium">{fmtNum(e.jarima)}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums font-semibold whitespace-nowrap">
                      {e.configured ? fmtNum(earned) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {e.paidAvans > 0 ? <span className="text-amber-600 font-medium">{fmtNum(e.paidAvans)}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {paid > e.paidAvans ? fmtNum(paid - e.paidAvans) : <span className="text-muted-foreground">0</span>}
                    </td>
                    {/* O'tgan oydan qolgan qoldiq ISHORALI: musbat —
                        akademiya qarzi, manfiy — xodimning qarzdorligi
                        (o'tgan oyda ortiqcha olgan pul). */}
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums whitespace-nowrap">
                      {e.carryOver !== 0 ? (
                        <div>
                          <div className={e.carryOver < 0 ? "text-amber-600 font-medium" : ""}>
                            {fmtNum(e.carryOver)}
                          </div>
                          {e.carryNote && <div className="text-[11px] text-muted-foreground">{e.carryNote}</div>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right text-[13px] tabular-nums font-bold whitespace-nowrap">
                      {e.configured ? (
                        due < 0 ? (
                          <div>
                            <div className="text-amber-600">{fmtNum(due)}</div>
                            <div className="text-[11px] font-normal text-muted-foreground">qarzdor</div>
                          </div>
                        ) : (
                          fmtNum(due)
                        )
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Xodim topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setConfirmOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">
              Haqiqatdan ham {selectedCount} ta xodim uchun oylik chiqarishni xohlaysizmi?
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Yo&apos;q
              </button>
              <button
                onClick={confirmPayout}
                disabled={saving}
                className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Chiqarilmoqda…" : "Ha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
