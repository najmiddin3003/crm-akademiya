// O'quvchi profilidagi sana maydoni. Qiymat ISO ("YYYY-MM-DD") ko'rinishida.
export default function DateField({
  label,
  defaultValue,
  value,
  onChange,
  placeholder = "kk.oo.yyyy",
}: {
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}) {
  const controlled = value !== undefined && onChange !== undefined;
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="date"
          {...(controlled ? { value, onChange: (e) => onChange(e.target.value) } : { defaultValue })}
          placeholder={placeholder}
          className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </div>
  );
}
