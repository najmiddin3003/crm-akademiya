// Ported from the real site's Coin tarixi tab (wider than the reference
// crm-akademiya/src/app.js renderStudentEditCoin() placeholder — that one
// only had 5 columns; the live site has 9).

export default function CoinTabContent() {
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex justify-end p-3 border-b border-border">
        <span className="inline-flex items-center h-7 px-3 rounded-md bg-secondary/50 text-[12px] font-medium tabular-nums">Umumiy soni: 0</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[12px] text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium">№</th>
              <th className="px-4 py-3 text-left font-medium">Kim tomonidan</th>
              <th className="px-4 py-3 text-left font-medium">Turi</th>
              <th className="px-4 py-3 text-left font-medium">Miqdori</th>
              <th className="px-4 py-3 text-left font-medium">Avvalgi balans</th>
              <th className="px-4 py-3 text-left font-medium">Yangi balans</th>
              <th className="px-4 py-3 text-left font-medium">Yaratildi</th>
              <th className="px-4 py-3 text-left font-medium">Sababi</th>
              <th className="px-4 py-3 text-left font-medium">Izoh</th>
            </tr>
          </thead>
        </table>
      </div>
      <div className="py-16 text-center">
        <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto text-muted-foreground/40 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 10h8M8 14h5" />
        </svg>
        <div className="text-[14px] font-medium">Ma&apos;lumotlar topilmadi</div>
        <div className="text-[12px] text-muted-foreground mt-0.5">Ma&apos;lumotlar topilmadi. Filterni o&apos;zgartirib ko&apos;ring.</div>
      </div>
    </div>
  );
}
