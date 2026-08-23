"use client";

import { useState } from "react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useGroups } from "@/hooks/useGroups";
import type { Group } from "@/lib/groups";

// "Guruhga qo'shish" tugmasi bosilganda ochiladigan modal (OrderDetailPage.tsx)
// — akademiya.edutizim.uz referensiga mos: "Guruh shaklini tanlang" sarlavha,
// qidiruv maydoni + har doim ko'rinib turadigan (popover emas) guruhlar
// ro'yxati, har biri nom + bosqich/kun/vaqt/o'qituvchi qatori bilan.
//
// Guruhlar BAZADAN keladi (/api/groups) — ilgari qattiq yozilgan DEMO_GROUPS
// ro'yxati ishlatilardi va u Guruh sahifasidagi haqiqiy guruhlar bilan
// bog'liq emas edi.

export interface GroupPickerModalProps {
  onClose: () => void;
  onSelect: (group: Group) => void;
}

/** Ro'yxatdagi ikkinchi satr: bo'sh maydonlar tushirib qoldiriladi. */
function subtitleOf(g: Group): string {
  return [g.course, g.level, g.day, g.time, g.teacher].filter(Boolean).join(" • ");
}

export default function GroupPickerModal({ onClose, onSelect }: GroupPickerModalProps) {
  const [query, setQuery] = useState("");
  const { groups, loading } = useGroups();
  useEscapeClose(onClose);

  const q = query.trim().toLowerCase();
  const filtered = groups.filter((g) => `${g.id} ${g.name} ${subtitleOf(g)}`.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-4 text-center border-b border-border">
          <h3 className="text-xl font-semibold">Guruh shaklini tanlang</h3>
        </div>

        <div className="p-5 space-y-2">
          <label className="block text-sm font-medium">Guruh</label>
          <div className="relative">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Guruhni qidirish"
              className="w-full h-11 rounded-lg border border-border bg-secondary/20 px-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <use href="#i-chevron-down" />
            </svg>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">Yuklanmoqda…</div>
            ) : filtered.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                {groups.length === 0 ? "Guruhlar yo'q — avval Guruh sahifasida qo'shing" : "Topilmadi"}
              </div>
            ) : (
              filtered.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelect(g)}
                  className="w-full text-left px-2 py-3 hover:bg-secondary/50"
                >
                  <div className="font-semibold">{g.name || g.id}</div>
                  <div className="text-sm text-muted-foreground">{subtitleOf(g) || "—"}</div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
