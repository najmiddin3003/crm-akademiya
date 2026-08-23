// O'quvchi profilidagi matn maydoni.
//
// Boshqariladigan (controlled): `value` + `onChange` berilsa forma holatiga
// ulanadi. Ular berilmasa — faqat ko'rsatish uchun (`defaultValue`), eski
// chaqiruvlar ishlayveradi.
export default function TextField({
  label,
  defaultValue,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const controlled = value !== undefined && onChange !== undefined;
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      <input
        type={type}
        {...(controlled ? { value, onChange: (e) => onChange(e.target.value) } : { defaultValue })}
        placeholder={placeholder}
        className="w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
