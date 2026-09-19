"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { ADDRESS_TYPES, type PupilAddress } from "@/lib/pupilsData";
import { invalidateStudents } from "@/hooks/useStudents";
import Select from "@/components/ui/Select";
import { useT } from "@/components/shared/Language";

// O'quvchi profili → "Manzil".
//
// Ilgari "Qo'shish" tugmasi hech nima qilmasdi va "Manzillar" ro'yxati
// doim bo'sh turardi. Endi manzillar o'quvchi yozuviga (pupils.addresses)
// saqlanadi, ro'yxatda ko'rinadi va o'chirilishi mumkin.
//
// Xarita hali haqiqiy emas: loyihada xarita kutubxonasi ulanmagan, shu bois
// u ko'rinish uchun — manzil matn bilan kiritiladi.
export default function ManzilTabContent({
  pupilId,
  initialAddresses,
}: {
  pupilId?: number;
  initialAddresses?: PupilAddress[];
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [list, setList] = useState<PupilAddress[]>(initialAddresses ?? []);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);

  const persist = async (next: PupilAddress[], okMsg: string) => {
    if (!pupilId) return;
    setBusy(true);
    const res = await fetch(`/api/pupils/${pupilId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: next }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    invalidateStudents(); // ro'yxat o'zgardi -> umumiy kesh bekor
    if (!res?.ok) {
      showError(t(res?.error || "Saqlashda xatolik yuz berdi"));
      return;
    }
    setList(next);
    showSuccess(okMsg);
  };

  const add = () => {
    if (!name.trim()) {
      showError(t("Manzil nomini kiriting"));
      return;
    }
    const nextId = list.reduce((mx, a) => Math.max(mx, a.id), 0) + 1;
    persist([...list, { id: nextId, name: name.trim(), type }], "Manzil qo'shildi").then(() => {
      setName("");
      setType("");
    });
  };

  const remove = (id: number) => persist(list.filter((a) => a.id !== id), "Manzil o'chirildi");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <h3 className="text-[15px] font-bold">{t("Manzil qo'shish")}</h3>

        {!pupilId && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-[13px]">
            {t("Bu yozuv o'quvchilar bazasida topilmadi — manzil saqlab bo'lmaydi.")}
          </div>
        )}

        <div>
          <label className="block text-[13px] font-medium mb-1.5">{t("Manzil nomi")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("Masalan: Chilonzor 12-uy")}
            className="w-full h-11 px-3 rounded-lg border border-border bg-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-1.5">{t("Manzil turi")}</label>
          <Select value={type} onChange={(v) => setType(v)} options={ADDRESS_TYPES.map((tv) => ({ value: tv, label: tv }))} placeholder={t("Tanlang")} clearable size="lg" />
        </div>

        <div>
          <h4 className="text-[14px] font-semibold">{t("Xarita")}</h4>
          <p className="text-[12px] text-muted-foreground mt-0.5 mb-2">
            {t("Xarita hali ulanmagan — manzilni matn bilan kiriting.")}
          </p>
          <div
            className="relative rounded-lg border border-border overflow-hidden h-48"
            style={{
              background:
                "repeating-linear-gradient(135deg, rgba(34,197,94,0.08) 0px, rgba(34,197,94,0.08) 2px, transparent 2px, transparent 40px), repeating-linear-gradient(45deg, rgba(148,163,184,0.15) 0px, rgba(148,163,184,0.15) 1px, transparent 1px, transparent 60px), #eef2f0",
            }}
          >
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px] font-semibold text-foreground/70">{t("Toshkent")}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={!pupilId || busy}
          onClick={add}
          className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? t("Saqlanmoqda...") : t("Qo'shish")}
        </button>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5">
        <h3 className="text-[15px] font-bold mb-3">{t("Manzillar")}</h3>
        {list.length === 0 ? (
          <p className="text-[13px] text-muted-foreground italic">{t("Hozircha manzil qo'shilmagan")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium break-words">{a.name}</div>
                  {a.type && <div className="text-[12px] text-muted-foreground">{t(a.type)}</div>}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(a.id)}
                  title={t("O'chirish")}
                  className="shrink-0 h-8 w-8 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 inline-flex items-center justify-center disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
