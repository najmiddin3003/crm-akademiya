export default function SelectField({
  label,
  value,
  placeholder = "Tanlang",
  clearable = false,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  clearable?: boolean;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      <div className="relative">
        <select className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40">
          {value ? <option>{value}</option> : <option value="">{placeholder}</option>}
        </select>
        {clearable && value && (
          <button type="button" className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
      </div>
    </div>
  );
}
