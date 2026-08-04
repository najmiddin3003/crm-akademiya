import type { Order } from "@/lib/ordersData";

// Ported from the real site's SMS tab: a single welcome-SMS row (there's no
// real SMS backend yet, so this mirrors the screenshot's "registration SMS"
// entry using this order's own name/moderator/date instead of an empty state).

export default function SmsTabContent({ order }: { order: Order }) {
  const moderator = order.moderator || "Tizim";
  const message = `Assalomu alaykum ${order.name}, Siz Akademiya o'quv markaziga muvaffaqiyatli ro'yxatdan o'tdingiz.`;

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex justify-end p-3 border-b border-border">
        <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">Umumiy soni: 1</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[12px] text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">№</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Yaratilgan sanasi</th>
              <th className="px-4 py-3 text-left font-medium">Moderator</th>
              <th className="px-4 py-3 text-left font-medium">Holati</th>
              <th className="px-4 py-3 text-left font-medium">Xabar</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50 last:border-0">
              <td className="px-4 py-3 text-[13px]">1</td>
              <td className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap tabular-nums">{order.created}</td>
              <td className="px-4 py-3 text-[13px]">{moderator}</td>
              <td className="px-4 py-3 text-[13px]">
                <span className="inline-flex items-center h-6 px-2.5 rounded-md bg-emerald-50 text-emerald-700 text-[12px] font-medium">Qabul qilindi</span>
              </td>
              <td className="px-4 py-3 text-[13px] text-muted-foreground max-w-[420px] truncate" title={message}>{message}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
