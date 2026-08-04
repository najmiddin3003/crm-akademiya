export default function DateField({
  label,
  defaultValue,
  placeholder = "mm/dd/yyyy",
}: {
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={defaultValue ? "date" : "text"}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-calendar" /></svg>
      </div>
    </div>
  );
}
