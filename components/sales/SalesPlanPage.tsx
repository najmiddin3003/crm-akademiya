"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { SalesPlanRow } from "@/lib/salesPlan";

// Sotuv va marketing → Savdo plani (sidebar: Sotuv va marketing > Savdo
// plani, href /sales-plan). Ma'lumot HAQIQIY — /api/sales-plans.
//
// Moderatorlar `hr_employees`dan, "To'lovlar soni" `transaction_entries`dan
// hisoblanadi; faqat "Plan" raqami saqlanadi. "Planni sozlash" tugmasi
// barcha moderatorlarning planini bir oynada tahrirlashga imkon beradi.

export default function SalesPlanPage() {
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<SalesPlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [setupOpen, setSetupOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sales-plans")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setRows(d.rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function openSetup() {
    setDraft(Object.fromEntries(rows.map((r) => [r.moderatorName, String(r.plan)])));
    setSetupOpen(true);
  }

  async function savePlans() {
    setSaving(true);
    try {
      const plans = rows.map((r) => ({
        moderatorName: r.moderatorName,
        plan: Number(draft[r.moderatorName] ?? r.plan) || 0,
      }));
      const res = await fetch("/api/sales-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      const planByName = new Map(plans.map((p) => [p.moderatorName, p.plan]));
      setRows((prev) => prev.map((r) => ({ ...r, plan: planByName.get(r.moderatorName) ?? r.plan })));
      showSuccess("Plan saqlandi");
      setSetupOpen(false);
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={openSetup}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm disabled:opacity-60"
        >
          <span>Planni sozlash</span>
        </button>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">Moderator</th>
                <th className="px-5 py-3 text-right">Plan</th>
                <th className="px-5 py-3 text-right pr-5">To&apos;lovlar soni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={r.moderatorName} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3 font-medium">{r.moderatorName}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.plan.toLocaleString("ru-RU")}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums">{r.paymentsCount}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Yuklanmoqda…" : "Moderator topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {setupOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setSetupOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
            <h3 className="text-[16px] font-semibold">Planni sozlash</h3>
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
              {rows.map((r) => (
                <div key={r.moderatorName} className="flex items-center gap-3">
                  <span className="flex-1 text-[13px]">{r.moderatorName}</span>
                  <input
                    type="number"
                    min={0}
                    value={draft[r.moderatorName] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.moderatorName]: e.target.value }))}
                    className="h-9 w-32 rounded-lg border border-border bg-card px-3 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setSetupOpen(false)}
                disabled={saving}
                className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Bekor qilish
              </button>
              <button
                onClick={savePlans}
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
