"use client";

// Kichik qayta ishlatiladigan toggle (switch). Xodim qo'shish modalida
// ("Ish haqi chiqarish", "Ikki bosqichli tasdiqlash") va maxsus maydon
// drawer'ida ("Majburiy maydon", "So'rovnomada ko'rinishi") ishlatiladi.
export interface EmployeeToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export default function EmployeeToggle({ checked, onChange, label }: EmployeeToggleProps) {
  const btn = (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );

  if (!label) return btn;
  return (
    <div className="flex items-center gap-2">
      {btn}
      <span className="text-[13px] font-medium">{label}</span>
    </div>
  );
}
