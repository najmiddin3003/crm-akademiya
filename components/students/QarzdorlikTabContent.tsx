"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

// O'quvchi profili → "Qarzdorlik limiti".
// Ilgari "Saqlash" hech nima qilmasdi; endi qiymat o'quvchi yozuviga
// (pupils.debtLimit) PATCH orqali yoziladi.
export default function QarzdorlikTabContent({
  pupilId,
  initialLimit,
}: {
  pupilId?: number;
  initialLimit?: number;
}) {
  const { showSuccess, showError } = useToast();
  const [limit, setLimit] = useState(initialLimit != null ? String(initialLimit) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!pupilId) return;
    const n = Number(limit);
    if (limit !== "" && (!Number.isFinite(n) || n < 0)) {
      showError("Limit manfiy bo'lmagan son bo'lishi kerak");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/pupils/${pupilId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debtLimit: limit === "" ? 0 : n }),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      showError(res?.error || "Saqlashda xatolik yuz berdi");
      return;
    }
    showSuccess("Qarzdorlik limiti saqlandi");
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="max-w-3xl">
        <label className="block text-[13px] font-medium mb-1.5">Qarzdorlik limiti</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="flex-1 h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            disabled={!pupilId || saving}
            onClick={save}
            className="inline-flex items-center h-11 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 flex-shrink-0 disabled:opacity-50 disabled:pointer-events-none"
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
        {!pupilId && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Bu yozuv o&apos;quvchilar bazasida topilmadi — limitni saqlab bo&apos;lmaydi.
          </p>
        )}
      </div>
    </div>
  );
}
