"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";

// "Kurs biriktirish" — o'ngdan chiquvchi drawer (crm-akademiya
// #bind-course-drawer). Guruh/Kurs rejimlari orasida almashadi; ikkalasi ham
// statik variant ro'yxati (manbada ham haqiqiy ma'lumotdan kelmaydi).
// "Saqlash" faqat toast ko'rsatadi — manbada ham hech narsa saqlanmaydi.

const GROUPS = ["1-guruh A1", "2-guruh B2", "3-guruh IELTS", "4-guruh Speaking", "5-guruh General"];
const SUBJECTS = ["Tarix", "Huquq", "Geografiya", "Kimyo", "Biologiya", "Matematika", "Fizika", "Ona tili", "Adabiyot", "Ingliz tili"];

export default function BindCourseDrawer({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"group" | "course">("group");
  const [value, setValue] = useState("");
  const { showSuccess, showError } = useToast();
  useEscapeClose(onClose);

  function save() {
    if (!value) {
      showError(mode === "group" ? "Guruh tanlang" : "Kurs tanlang");
      return;
    }
    showSuccess(`Biriktirildi — ${value}`);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-[110]" style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-[120] w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold tracking-tight">Kurs biriktirish</h2>
        </div>
        <div className="px-6">
          <div className="grid grid-cols-2 gap-0 rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => { setMode("group"); setValue(""); }}
              className={`h-10 text-sm font-medium ${mode === "group" ? "bg-primary text-white" : "bg-card text-foreground hover:bg-secondary"}`}
            >
              Guruh
            </button>
            <button
              onClick={() => { setMode("course"); setValue(""); }}
              className={`h-10 text-sm font-medium ${mode === "course" ? "bg-primary text-white" : "bg-card text-foreground hover:bg-secondary"}`}
            >
              Kurs
            </button>
          </div>

          {mode === "group" ? (
            <div className="mt-6">
              <label className="text-[13px] font-medium">Guruh</label>
              <select value={value} onChange={(e) => setValue(e.target.value)} className="filter-select w-full h-10 mt-2 appearance-none rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">Guruh</option>
                {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          ) : (
            <div className="mt-6">
              <label className="text-[13px] font-medium">Kurs</label>
              <select value={value} onChange={(e) => setValue(e.target.value)} className="filter-select w-full h-10 mt-2 appearance-none rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="">Kurs</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex-1" />
        <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Orqaga</button>
          <button onClick={save} className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90">Saqlash</button>
        </div>
      </div>
    </>
  );
}
