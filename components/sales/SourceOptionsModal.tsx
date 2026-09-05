"use client";

import { useEffect, useState } from "react";
import { Check, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import type { StudentSourceOption } from "@/lib/studentSources";

// "Manba" tanlovlarini boshqarish oynasi — O'quvchilar oqimi sahifasidan
// ochiladi. Bu yerda qo'shilgan qiymatlar o'quvchi qo'shish formasidagi
// "Manba" ro'yxatida chiqadi.
//
// NEGA SETTINGS'DAGI UMUMIY KOMPONENT (SettingsListTab) ISHLATILMADI: u
// `/api/settings-lists` ga uriladi va o'sha route BARCHA sozlama
// ro'yxatlariga xizmat qiladi (soliqlar, to'lov turlari, hamkorlar…).
// Ruxsatlar jadvali route'ni sahifaga bog'laydi, ya'ni uni bu sahifaga
// ulash "O'quvchilar oqimi" ruxsati berilgan xodimga soliq va to'lov
// turlarini ham tahrirlash imkonini berardi. Shu bois o'z route'i va
// o'z, kichik oynasi.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function SourceOptionsModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  /** Ro'yxat o'zgardi — sahifa taqsimotni qayta o'qisin. */
  onChanged: () => void;
}) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();

  const [options, setOptions] = useState<StudentSourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student-sources/options")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setOptions(d.options as StudentSourceOption[]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /**
   * Uchala amal ham bir xil javob qaytaradi — YANGI RO'YXAT. Shu bois
   * bitta yordamchi: mahalliy holatni "taxmin qilib" yangilash o'rniga
   * server aytganini olamiz (takror nom rad etilishi, urug' yozilishi
   * kabi qarorlar serverda).
   */
  async function send(init: RequestInit & { url: string }, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(init.url, init);
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return false;
      }
      setOptions(data.options as StudentSourceOption[]);
      // `renamed` — nom o'zgarganda tuzatilgan o'quvchilar soni. Amal
      // ko'rinmaydigan joyga ham tegadi, shuning uchun aytiladi.
      const n = Number(data.renamed ?? 0);
      showSuccess(n > 0 ? `${okMsg} · ${n} ta o'quvchida ham yangilandi` : okMsg);
      onChanged();
      return true;
    } catch {
      showError("Serverga ulanib bo'lmadi");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;
    if (await send({ url: "/api/student-sources/options/manage", method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }, "Manba qo'shildi")) {
      setNewName("");
    }
  }

  async function saveEdit() {
    const name = editName.trim();
    if (!name || editId === null) return;
    if (await send({ url: "/api/student-sources/options/manage", method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, name }) }, "Nomi o'zgartirildi")) {
      setEditId(null);
    }
  }

  async function remove(id: number) {
    if (await send({ url: `/api/student-sources/options/manage?id=${id}`, method: "DELETE" }, "Manba o'chirildi")) {
      setDeleteId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
          <div className="flex-1">
            <h3 className="text-base font-semibold">Manbalar ro&apos;yxati</h3>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              Bu yerdagi qiymatlar o&apos;quvchi qo&apos;shish oynasidagi
              &laquo;Manba&raquo; tanlovida chiqadi.
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              maxLength={60}
              placeholder="Yangi manba, masalan: TikTok"
              className={inputCls}
            />
            <Button onClick={add} disabled={busy || !newName.trim()} lucideIcon={Plus} className="shrink-0">
              Qo&apos;shish
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Spinner size={22} /></div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {options.map((o) => (
                <div key={o.id} className="flex items-center gap-2 px-3 py-2.5">
                  {editId === o.id ? (
                    <>
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
                          if (e.key === "Escape") { e.preventDefault(); setEditId(null); }
                        }}
                        maxLength={60}
                        className={inputCls}
                      />
                      <button onClick={saveEdit} disabled={busy || !editName.trim()} title="Saqlash" className="h-9 w-9 shrink-0 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 inline-flex items-center justify-center disabled:opacity-50">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditId(null)} title="Bekor qilish" className="h-9 w-9 shrink-0 rounded-lg border border-border hover:bg-secondary inline-flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : deleteId === o.id ? (
                    <>
                      <span className="flex-1 text-[13px] truncate">
                        <strong>{o.name}</strong>{" "}o&apos;chirilsinmi?
                      </span>
                      <Button variant="outline" onClick={() => setDeleteId(null)} className="shrink-0">Yo&apos;q</Button>
                      <button
                        onClick={() => remove(o.id)}
                        disabled={busy}
                        className="h-9 px-3.5 shrink-0 rounded-lg bg-rose-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        O&apos;chirish
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-[13px] truncate">{o.name}</span>
                      {o.system ? (
                        // Tizimli qiymat — sababi ko'rinib tursin, aks holda
                        // tugmalarning yo'qligi nosozlikdek tuyulardi.
                        <span
                          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0"
                          title="O'quvchilar ro'yxatidagi «Tavsiyalarni yuklash» tugmasi aynan shu nomga tayanadi"
                        >
                          <Lock className="w-3 h-3" /> tizimli
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditId(o.id); setEditName(o.name); setDeleteId(null); }}
                            title="Nomini o'zgartirish"
                            className="h-8 w-8 shrink-0 rounded-md hover:bg-primary/10 hover:text-primary inline-flex items-center justify-center text-muted-foreground"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setDeleteId(o.id); setEditId(null); }}
                            title="O'chirish"
                            className="h-8 w-8 shrink-0 rounded-md hover:bg-rose-500/10 hover:text-rose-600 inline-flex items-center justify-center text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
              {options.length === 0 && (
                <div className="px-3 py-10 text-center text-sm text-muted-foreground">Ro&apos;yxat bo&apos;sh</div>
              )}
            </div>
          )}

          {/* IKKI AMALNING KO'RINMAYDIGAN TOMONI. Ikkalasi ham shu oynadan
              tashqarida ta'sir qiladi, shuning uchun oldindan aytiladi. */}
          <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1">
            <li>
              <strong>Nomi o&apos;zgartirilsa</strong> — shu manba yozilgan o&apos;quvchilarda ham
              yangilanadi, ya&apos;ni taqsimotda ikkita ustun paydo bo&apos;lmaydi.
            </li>
            <li>
              <strong>O&apos;chirilsa</strong> — faqat tanlovlar ro&apos;yxatidan chiqadi. Ilgari shu
              manba yozilgan o&apos;quvchilar o&apos;zgarmaydi va taqsimotda ko&apos;rinib turaveradi.
            </li>
            <li>
              &laquo;Boshqa&raquo; bu ro&apos;yxatda yo&apos;q — u tanlov emas, moderator manbani
              o&apos;z so&apos;zi bilan yozadigan darvoza va doim turadi.
            </li>
          </ul>
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Yopish</Button>
        </div>
      </div>
    </div>
  );
}
