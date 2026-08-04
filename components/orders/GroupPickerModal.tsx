"use client";

import { useState } from "react";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { DEMO_GROUPS, type GroupOption } from "@/lib/groupsData";

// "Guruhga qo'shish" tugmasi bosilganda ochiladigan modal (OrderDetailPage.tsx)
// — akademiya.edutizim.uz referensiga mos: "Guruh shaklini tanlang" sarlavha,
// qidiruv maydoni + har doim ko'rinib turadigan (popover emas) guruhlar
// ro'yxati, har biri raqam + bosqich/kun/vaqt/o'qituvchi qatori bilan.

export interface GroupPickerModalProps {
  onClose: () => void;
  onSelect: (group: GroupOption) => void;
}

export default function GroupPickerModal({ onClose, onSelect }: GroupPickerModalProps) {
  const [query, setQuery] = useState("");
  useEscapeClose(onClose);

  const filtered = DEMO_GROUPS.filter((g) => {
    const haystack = `${g.id} ${g.level} ${g.dayPattern} ${g.timeRange} ${g.teacher}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

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
              placeholder="Search group"
              className="w-full h-11 rounded-lg border border-border bg-secondary/20 px-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <use href="#i-chevron-down" />
            </svg>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">Topilmadi</div>
            ) : (
              filtered.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelect(g)}
                  className="w-full text-left px-2 py-3 hover:bg-secondary/50"
                >
                  <div className="font-semibold">{g.id}</div>
                  <div className="text-sm text-muted-foreground">
                    {g.level} • {g.dayPattern} • {g.timeRange} • {g.teacher}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
