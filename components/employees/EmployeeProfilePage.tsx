"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Archive, ArrowLeft, Briefcase, Check, ChevronDown, Copy, CreditCard, DollarSign,
  Edit, Frown, Lock, MoreVertical, Percent, Phone, Settings, Users, XCircle,
} from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { EP_MORE_IDS, EP_TABS, ROLE_LABELS } from "@/constants/employees";
import type { HrEmployee } from "@/lib/hrEmployees";

// Xodim profili (crm-akademiya #view-management-xodim-profile, skrinshot 4).
// Mavjud o'quvchi profili bilan bir xil tuzilma — faqat tab nomlari boshqacha.
// Backend yo'q: chap kartadagi moliyaviy ko'rsatkichlar va "Tranzaksiyalar
// tarixi" jadvali demo. Faqat "Tranzaksiyalar tarixi" tabi to'ldirilgan;
// qolganlari bo'sh holat ("Ma'lumotlar topilmadi") ko'rsatadi.

function nf(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}

// Demo tranzaksiyalar (skrinshot 4 qiymatlari) — barcha xodimlar uchun bir xil.
const TX = [
  { date: "20.07.2026 | 17:22", amount: -100000, next: -1400000, prev: -1300000 },
  { date: "15.07.2026 | 09:11", amount: -300000, next: -1300000, prev: -1000000 },
  { date: "11.07.2026 | 14:57", amount: -600000, next: -1000000, prev: -400000 },
  { date: "10.07.2026 | 14:39", amount: -100000, next: -400000, prev: -300000 },
  { date: "08.07.2026 | 11:57", amount: -50000, next: -300000, prev: -250000 },
  { date: "07.07.2026 | 15:56", amount: -50000, next: -250000, prev: -200000 },
  { date: "04.07.2026 | 16:54", amount: -200000, next: -200000, prev: 0 },
];

interface Stat {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  wrap: string;
  valueCls?: string;
}
const STATS: Stat[] = [
  { label: "Davomat", value: "0 UZS", icon: Check, wrap: "bg-emerald-100 text-emerald-600" },
  { label: "Davomatdan foizi", value: "0 UZS", icon: Percent, wrap: "bg-blue-100 text-blue-600" },
  { label: "Bonus", value: "0 UZS", icon: Lock, wrap: "bg-violet-100 text-violet-700" },
  { label: "Avans", value: "1 400 000 UZS", icon: XCircle, wrap: "bg-rose-100 text-rose-600" },
  { label: "Jarima", value: "0 UZS", icon: Frown, wrap: "bg-amber-100 text-amber-600" },
  { label: "Akladi", value: "0 UZS", icon: Briefcase, wrap: "bg-secondary text-foreground/70" },
  { label: "Oylik", value: "-1 400 000 UZS", icon: CreditCard, wrap: "bg-blue-100 text-blue-700", valueCls: "text-rose-600" },
  { label: "To'lanmagan", value: "0 UZS", icon: DollarSign, wrap: "bg-emerald-100 text-emerald-700" },
];

const ROLE_BADGE: Record<string, string> = {
  teacher: "bg-primary",
  moderator: "bg-purple-500",
  admin: "bg-slate-400",
};

const ACTION_BTNS = [
  { icon: Users, title: "Guruhlar", cls: "bg-blue-50 hover:bg-blue-100 text-blue-700" },
  { icon: Archive, title: "Arxiv", cls: "bg-amber-50 hover:bg-amber-100 text-amber-700" },
  { icon: Phone, title: "Qo'ng'iroq", cls: "bg-emerald-50 hover:bg-emerald-200 text-emerald-700" },
  { icon: Edit, title: "Tahrirlash", cls: "bg-secondary hover:bg-secondary/80 text-foreground" },
];

export default function EmployeeProfilePage({ id }: { id: number }) {
  const { showSuccess } = useToast();
  const [emp, setEmp] = useState<HrEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transactions");
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleTabs = EP_TABS.filter((t) => !EP_MORE_IDS.includes(t.id));
  const moreTabs = EP_TABS.filter((t) => EP_MORE_IDS.includes(t.id));

  // Xodim ma'lumotini backend'dan (/api/hr-employees/:id) yuklaymiz.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hr-employees/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) setEmp(data.employee);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <div className="container mx-auto max-w-[1900px] p-4 md:p-5"><SpinnerBlock /></div>;
  }
  if (!emp) {
    return (
      <div className="container mx-auto max-w-[1900px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">Xodim topilmadi.</p>
        <Link href="/management-xodimlar" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">Orqaga</Link>
      </div>
    );
  }

  const initials = emp.name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const phone = emp.phone.startsWith("+") ? emp.phone : "+998" + (emp.phone || "").replace(/\s/g, "");
  const roleLabel = ROLE_LABELS[emp.turi as keyof typeof ROLE_LABELS] ?? emp.turi;

  function selectTab(tabId: string) {
    setActiveTab(tabId);
    setMoreOpen(false);
  }

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <Link href="/management-xodimlar" className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
          <ArrowLeft className="icon icon-sm" />
          <span>Orqaga</span>
        </Link>
        <button onClick={() => showSuccess("Tablarni sozlash (demo)")} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm">
          <Settings className="icon icon-sm text-primary" />
          <span>Tablarni sozlash</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* LEFT */}
        <aside className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-300 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  <span>{initials}</span>
                </div>
                <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow ${ROLE_BADGE[emp.turi] ?? "bg-slate-400"}`}>
                  {roleLabel}
                </span>
              </div>
              <h2 className="mt-4 text-[17px] font-bold tracking-tight">{emp.name}</h2>
              <div className="mt-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                <span className="tabular-nums">{phone}</span>
                <button onClick={() => { navigator.clipboard?.writeText(phone); showSuccess("Nusxa olindi"); }} className="hover:text-primary" title="Nusxa olish">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5 w-full">
                {ACTION_BTNS.map((b) => (
                  <button key={b.title} className={`aspect-square rounded-lg inline-flex items-center justify-center ${b.cls}`} title={b.title}>
                    <b.icon className="icon icon-sm" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-2">
            <ul className="divide-y divide-border">
              {STATS.map((s) => (
                <li key={s.label} className="flex items-center gap-3 px-3 py-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0 ${s.wrap}`}>
                    <s.icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                    <div className={`text-[14px] font-semibold tabular-nums ${s.valueCls ?? ""}`}>{s.value}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* RIGHT */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-border">
            <div className="flex flex-wrap items-center gap-1.5">
              {visibleTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTab(t.id)}
                  className={`h-9 px-4 rounded-full text-[13px] font-medium transition-all ${activeTab === t.id ? "bg-primary text-white shadow-sm" : "bg-secondary/50 text-foreground/80 hover:bg-secondary"}`}
                >
                  {t.label}
                </button>
              ))}
              <div className="relative">
                <button onClick={() => setMoreOpen((o) => !o)} className="h-9 px-4 rounded-full text-[13px] font-medium bg-secondary/50 text-foreground/80 hover:bg-secondary inline-flex items-center gap-1.5">
                  Ko&apos;proq
                  <ChevronDown className="w-3 h-3" />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-11 w-56 rounded-xl border border-border bg-card shadow-xl p-1 z-30">
                    {moreTabs.map((t) => (
                      <button key={t.id} onClick={() => selectTab(t.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                        <MoreVertical className="icon icon-xs text-muted-foreground" />
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 min-h-[500px]">
            {activeTab === "transactions" ? (
              <>
                <div className="flex flex-wrap items-center gap-2.5 mb-4">
                  <input type="text" placeholder="Sana" className="h-9 w-44 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  {["Tranzaksiya turi", "Talaba", "Guruh"].map((ph) => (
                    <div key={ph} className="relative">
                      <select className="h-9 w-44 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" defaultValue="">
                        <option value="">{ph}</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end mb-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary/40 text-[11px] font-medium">Umumiy soni: <span className="ml-1 tabular-nums font-semibold">{TX.length}</span></span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                        {["№", "Sana", "O'quvchilar", "Guruh", "Turi", "Holati", "Izoh", "Miqdori", "Keyingi miqdor", "Oldingi miqdor"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {TX.map((t, i) => (
                        <tr key={i} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap">{t.date}</td>
                          <td className="px-4 py-3">-</td>
                          <td className="px-4 py-3">-</td>
                          <td className="px-4 py-3 whitespace-nowrap">Oldindan to&apos;lash</td>
                          <td className="px-4 py-3">-</td>
                          <td className="px-4 py-3">iyul</td>
                          <td className="px-4 py-3 tabular-nums text-rose-600 font-medium whitespace-nowrap">{nf(t.amount)}</td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap">{nf(t.next)}</td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap">{nf(t.prev)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center mb-3 text-muted-foreground">
                  <Archive className="w-6 h-6" />
                </span>
                <div className="text-[14px] font-semibold">Ma&apos;lumotlar topilmadi</div>
                <div className="text-[12px] text-muted-foreground mt-1">Ma&apos;lumotlar topilmadi. Filterni o&apos;zgartirib ko&apos;ring.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
