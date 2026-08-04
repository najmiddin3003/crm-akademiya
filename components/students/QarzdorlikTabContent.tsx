// Ported from crm-akademiya/src/app.js renderStudentEditQarzdorlik() (~line 34612),
// with the input+Saqlash laid out inline (matches the real site's screenshot).

export default function QarzdorlikTabContent() {
  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="max-w-3xl">
        <label className="block text-[13px] font-medium mb-1.5">Qarzdorlik limiti</label>
        <div className="flex items-center gap-2">
          <input type="number" className="flex-1 h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <button type="button" className="inline-flex items-center h-11 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 flex-shrink-0">Saqlash</button>
        </div>
      </div>
    </div>
  );
}
