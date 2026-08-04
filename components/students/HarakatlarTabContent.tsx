import type { Order } from "@/lib/ordersData";

// Ported from the real site's Harakatlar tarixi tab: grouped cards (employee +
// timestamp) each holding a field-change table (Ism/Harakatlar/Xodim/Turi/
// Qurilma nomi). There's no real audit-log backend yet, so the 3 entries here
// are the deterministic "student record created + first payment" trail that
// applies to any order, tied to this order's own moderator/date/balance
// (kept consistent with the Tranzaksiyalar tab's balance figure).

interface HistoryEntry {
  ism: string;
  from: string;
  to: string;
}

function fmtSpace(n: number): string {
  return n.toLocaleString("ru-RU").replace(/,/g, " ");
}

export default function HarakatlarTabContent({ order, balans }: { order: Order; balans: number }) {
  const xodim = order.moderator || "Tizim";
  const entries: HistoryEntry[] = [
    { ism: "Birinchi to'lov", from: "null", to: "{}" },
    { ism: "paidAt", from: "null", to: "{}" },
    { ism: "Balans", from: "0", to: fmtSpace(balans) },
  ];

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.ism} className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-4 flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-[14px]">{xodim}</span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <svg className="icon icon-xs"><use href="#i-calendar" /></svg>
              {order.created}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 16 14" />
              </svg>
              {order.created.split("|")[1]?.trim() ?? order.created}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="text-[12px] text-muted-foreground uppercase bg-secondary/20">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium border border-border">Ism</th>
                  <th className="px-4 py-2.5 text-left font-medium border border-border">Harakatlar</th>
                  <th className="px-4 py-2.5 text-left font-medium border border-border">Xodim</th>
                  <th className="px-4 py-2.5 text-left font-medium border border-border">Turi</th>
                  <th className="px-4 py-2.5 text-left font-medium border border-border">Qurilma nomi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 text-[13px] border border-border">{entry.ism}</td>
                  <td className="px-4 py-3 text-[13px] border border-border">
                    <div>{entry.from}</div>
                    <div className="text-muted-foreground">&rarr;</div>
                    <div>{entry.to}</div>
                  </td>
                  <td className="px-4 py-3 text-[13px] border border-border">{xodim}</td>
                  <td className="px-4 py-3 text-[13px] border border-border">Moderator</td>
                  <td className="px-4 py-3 text-[13px] border border-border">&quot;Windows&quot;, chrome</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
