export default function PhoneField({
  label,
  defaultValue,
}: {
  label: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      <div className="flex">
        <button type="button" className="inline-flex items-center gap-1.5 h-11 px-3 rounded-l-lg border border-r-0 border-border bg-secondary/30 text-sm flex-shrink-0">
          <span className="inline-block w-5 h-3.5 rounded-sm overflow-hidden" style={{ background: "linear-gradient(to bottom, #00abca 33%, #fff 33% 66%, #1eb53a 66%)" }} />
          <svg className="icon icon-xs text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </button>
        <input
          type="text"
          defaultValue={defaultValue ?? "+998"}
          className="flex-1 h-11 px-3 rounded-r-lg border border-border bg-secondary/30 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </div>
  );
}
