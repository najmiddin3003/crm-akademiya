import type { Order } from "@/lib/ordersData";
import Button from "@/components/ui/Button";

// Ported from the real site's Tranzaksiyalar tarixi tab: filter row + 3
// toolbar icon buttons + a transactions table. Since there's no real
// transactions backend yet, the single row shown mirrors the balance already
// displayed in the left sidebar card (so the two stay consistent) instead of
// an empty state.

function fmtSpace(n: number): string {
  return n.toLocaleString("ru-RU").replace(/,/g, " ");
}

export default function TranzaksiyaTabContent({ order, balans }: { order: Order; balans: number }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button variant="icon" title="Filtr">
          <svg viewBox="0 0 24 24" className="icon icon-sm"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
        </Button>
        <Button variant="icon" icon="i-settings" title="Sozlash" />
        <button type="button" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary" title="Ustunlar">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="1.8" fill="currentColor" stroke="none" />
            <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none" />
            <line x1="4" y1="18" x2="20" y2="18" /><circle cx="11" cy="18" r="1.8" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <button type="button" className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-left inline-flex items-center gap-2 text-muted-foreground">
          <svg className="icon icon-sm"><use href="#i-calendar" /></svg>
          Sana
        </button>
        <div className="relative">
          <select className="w-full h-10 px-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Tranzaksiya turi</option>
          </select>
          <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select className="w-full h-10 px-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Holat</option>
          </select>
          <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
        <div className="relative">
          <select className="w-full h-10 px-3 pr-9 rounded-lg border border-border bg-card text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Guruh</option>
          </select>
          <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex justify-end p-3 border-b border-border">
          <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">Umumiy soni: 1</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[12px] text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium">№</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Sana</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Miqdori</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Oldingi miqdor</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Keyingi miqdor</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Tranzaksiya turi</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">To&apos;lov turi</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Tranzaksiya nomi</th>
                <th className="px-4 py-3 text-left font-medium">Guruh</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 text-[13px]">1</td>
                <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{order.created}</td>
                <td className="px-4 py-3 text-[13px] tabular-nums">{fmtSpace(balans)}</td>
                <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">0</td>
                <td className="px-4 py-3 text-[13px] tabular-nums">{fmtSpace(balans)}</td>
                <td className="px-4 py-3 text-[13px]">Daromad</td>
                <td className="px-4 py-3 text-[13px]">Naqd</td>
                <td className="px-4 py-3 text-[13px]">O&apos;quvchi to&apos;ladi</td>
                <td className="px-4 py-3 text-[13px] text-muted-foreground">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
