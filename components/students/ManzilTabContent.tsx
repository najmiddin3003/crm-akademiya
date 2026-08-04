// Ported from the real site's Manzil tab: address form + a map picker on the
// left, saved addresses list on the right. There's no map library in this
// project (Leaflet etc. isn't installed), so the map is a visual-only
// placeholder — matches the layout/labels but isn't click-to-pick yet.

export default function ManzilTabContent() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <h3 className="text-[15px] font-bold">Manzil qo&apos;shish</h3>

        <div>
          <label className="block text-[13px] font-medium mb-1.5">Manzil nomi</label>
          <input type="text" placeholder="Manzil qidirish" className="w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-1.5">Manzil turi</label>
          <div className="relative">
            <select className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">Tanlang</option>
            </select>
            <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
        </div>

        <div>
          <h4 className="text-[14px] font-semibold">Xarita tanlash</h4>
          <p className="text-[12px] text-muted-foreground mt-0.5 mb-2">Manzilni tanlash uchun xaritaga bosing</p>
          <div
            className="relative rounded-lg border border-border overflow-hidden h-64"
            style={{
              background:
                "repeating-linear-gradient(135deg, rgba(34,197,94,0.08) 0px, rgba(34,197,94,0.08) 2px, transparent 2px, transparent 40px), repeating-linear-gradient(45deg, rgba(148,163,184,0.15) 0px, rgba(148,163,184,0.15) 1px, transparent 1px, transparent 60px), #eef2f0",
            }}
          >
            <div className="absolute left-3 top-3 flex flex-col rounded-md border border-border bg-card shadow-sm overflow-hidden">
              <button type="button" className="h-8 w-8 inline-flex items-center justify-center hover:bg-secondary/60 border-b border-border text-foreground/80 font-medium">+</button>
              <button type="button" className="h-8 w-8 inline-flex items-center justify-center hover:bg-secondary/60 text-foreground/80 font-medium">&minus;</button>
            </div>
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px] font-semibold text-foreground/70">Toshkent</span>
          </div>
        </div>

        <button type="button" className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90">Qo&apos;shish</button>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5">
        <h3 className="text-[15px] font-bold mb-2">Manzillar</h3>
        <p className="text-[13px] text-muted-foreground italic">Hozircha manzil qo&apos;shilmagan</p>
      </div>
    </div>
  );
}
