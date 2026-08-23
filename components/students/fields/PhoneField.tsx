// O'quvchi profilidagi telefon maydoni (O'zbekiston bayrog'i bilan).
// TextField kabi: `value` + `onChange` berilsa boshqariladigan bo'ladi.
export default function PhoneField({
  label,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const controlled = value !== undefined && onChange !== undefined;
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      <div className="flex">
        <span className="inline-flex items-center gap-1.5 h-11 px-3 rounded-l-lg border border-r-0 border-border bg-secondary/30 text-sm flex-shrink-0">
          <span className="inline-block w-5 h-3.5 rounded-sm overflow-hidden" style={{ background: "linear-gradient(to bottom, #00abca 33%, #fff 33% 66%, #1eb53a 66%)" }} />
          <span className="text-muted-foreground tabular-nums">+998</span>
        </span>
        <input
          type="text"
          {...(controlled ? { value, onChange: (e) => onChange(e.target.value) } : { defaultValue })}
          className="flex-1 h-11 px-3 rounded-r-lg border border-border bg-secondary/30 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </div>
  );
}
