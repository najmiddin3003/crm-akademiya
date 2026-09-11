import UiDateField from "@/components/ui/DateField";

// O'quvchi profilidagi sana maydoni — yorliq + ui/DateField (h-11, kalendar).
// Qiymat ISO ("YYYY-MM-DD") ko'rinishida. Ilgari native <input type="date">
// edi — brauzer tiliga qarab formati o'zgarar va stillanmasdi.
export default function DateField({
  label,
  value,
  onChange,
  placeholder = "kk/oo/yyyy",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      <UiDateField value={value} onChange={onChange} placeholder={placeholder} variant="panel" />
    </div>
  );
}
