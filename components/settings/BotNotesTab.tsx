"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Toggle } from "./SettingsForm";
import { BOT_NOTE_DEFAULTS, BOT_NOTE_TYPES, BOT_NOTE_VARIABLES } from "@/constants/settingsBotNotes";

// Sozlamalar → Sotuv va marketing → Bot eslatmalari.
// Chapda shablon konstruktori, o'ngda Telegram xabarining jonli namunasi,
// pastda saqlangan shablonlar ro'yxati. Har qanday o'zgarish (saqlash,
// o'chirish) darhol serverga PUT bilan yoziladi.

interface Template {
  id: string;
  name: string;
  type: string;
  minutes: number;
  text: string;
  active: boolean;
}

// Formada minutes matn sifatida turadi — maydonni butunlay bo'shatib
// qayta yozish mumkin bo'lsin (Number bo'lsa 0 yopishib qolardi).
interface FormState {
  id: string | null;
  name: string;
  type: string;
  minutes: string;
  text: string;
  active: boolean;
}

const STORAGE_KEY = "sale-marketing.bot-notes";
const DEFAULTS = BOT_NOTE_DEFAULTS as { templates: Template[] };

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

const EMPTY_FORM: FormState = { id: null, name: "", type: "", minutes: "", text: "", active: true };

let seq = 0;
function newId(): string {
  // Date.now() emas: bir millisekundda ikkita shablon qo'shilsa id takrorlanardi.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  seq += 1;
  return `bn-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function BotNotesTab() {
  const { showSuccess, showError } = useToast();
  const [templates, setTemplates] = useState<Template[]>(DEFAULTS.templates);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${encodeURIComponent(STORAGE_KEY)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        // Defaultlar ustiga yozamiz — yangi maydon qo'shilganda eski hujjat buzilmaydi.
        const merged = { ...DEFAULTS, ...d.values } as { templates?: Template[] };
        setTemplates(Array.isArray(merged.templates) ? merged.templates : DEFAULTS.templates);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Ro'yxatni serverga yozadi; xato bo'lsa oldingi holatni qaytaradi.
  async function persist(next: Template[], okMsg: string) {
    const prev = templates;
    setTemplates(next);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STORAGE_KEY, values: { templates: next } }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setTemplates(prev);
        return false;
      }
      showSuccess(okMsg);
      return true;
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setTemplates(prev);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      showError("Shablon nomini kiriting");
      return;
    }
    if (!form.type) {
      showError("Shablon turini tanlang");
      return;
    }
    const item: Template = {
      id: form.id ?? newId(),
      name: form.name.trim(),
      type: form.type,
      minutes: Number(form.minutes) || 0,
      text: form.text,
      active: form.active,
    };
    const next = form.id
      ? templates.map((t) => (t.id === form.id ? item : t))
      : [...templates, item];
    const ok = await persist(next, "Sozlamalar saqlandi");
    if (ok) setForm(EMPTY_FORM);
  }

  function edit(t: Template) {
    setForm({
      id: t.id,
      name: t.name,
      type: t.type,
      minutes: String(t.minutes ?? ""),
      text: t.text ?? "",
      active: Boolean(t.active),
    });
  }

  function remove(t: Template) {
    // Tahrirlanayotgan shablon o'chsa, forma ham bo'shashi kerak.
    if (form.id === t.id) setForm(EMPTY_FORM);
    void persist(templates.filter((x) => x.id !== t.id), "Sozlamalar saqlandi");
  }

  // O'zgaruvchi chipi — kursor turgan joyga qo'shiladi, so'ng fokus qaytadi.
  function insertVar(v: string) {
    const el = textRef.current;
    const pos = el ? el.selectionStart : form.text.length;
    setForm((p) => ({ ...p, text: p.text.slice(0, pos) + v + p.text.slice(pos) }));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos + v.length, pos + v.length);
    });
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-8 text-center text-sm text-muted-foreground">
        Yuklanmoqda…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
        {/* CHAP — shablon konstruktori */}
        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {form.id ? "Shablonni tahrirlash" : "Yangi shablon"}
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Shablon nomi</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Shablon turi</label>
            <div className="relative">
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Tanlang</option>
                {BOT_NOTE_TYPES.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
              <svg className="icon icon-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <use href="#i-chevron-down" />
              </svg>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Yuborish vaqti (minutda)</label>
            <input
              type="number"
              min={0}
              value={form.minutes}
              onChange={(e) => setForm((p) => ({ ...p, minutes: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Mavjud o&apos;zgaruvchilar</label>
            <div className="flex flex-wrap gap-1.5">
              {BOT_NOTE_VARIABLES.map((v: string) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVar(v)}
                  className="h-8 px-3 rounded-lg border border-border bg-card text-[12px] font-medium text-muted-foreground hover:bg-secondary hover:text-primary transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Xabar matni</label>
            <textarea
              ref={textRef}
              rows={5}
              value={form.text}
              onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-3 border-t border-border">
            <span className="text-[13px]">Shablonni faollashtirish</span>
            <Toggle on={form.active} onChange={(v) => setForm((p) => ({ ...p, active: v }))} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
              disabled={saving}
              className="h-10 px-6 rounded-lg border border-border text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              Orqaga
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        </div>

        {/* O'NG — matn qanday yetib borishini ko'rsatuvchi namuna */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Shablon namunasi
          </div>

          <div className="mt-3 rounded-xl border border-border bg-secondary/25 p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground mb-3">
              <span aria-hidden>📱</span>
              <span>Telegram</span>
            </div>

            <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
              {form.text.trim() ? (
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{form.text}</p>
              ) : (
                <p className="text-[13px] text-muted-foreground">Matn kiritsangiz shu yerda ko&apos;rinadi...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PASTDA — saqlangan shablonlar */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Mavjud Shablonlar
        </div>

        {templates.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Shablon topilmadi</div>
        ) : (
          <div className="mt-3 grid gap-3 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[14px] font-semibold break-words">{t.name}</span>
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      t.active ? "text-emerald-700 bg-emerald-100" : "text-muted-foreground bg-secondary"
                    }`}
                  >
                    {t.active ? "Aktiv" : "Nofaol"}
                  </span>
                </div>

                <div className="text-[12px] text-muted-foreground">Vaqt: {t.minutes} daqiqa</div>
                <div className="text-[12px] text-muted-foreground">Turi: {t.type || "—"}</div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => edit(t)}
                    disabled={saving}
                    className="h-8 px-3 rounded-lg border border-border text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-secondary disabled:opacity-60"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Tahrirlash
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    disabled={saving}
                    className="h-8 px-3 rounded-lg border border-border text-[13px] font-medium inline-flex items-center gap-1.5 text-rose-600 hover:bg-rose-500/10 disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    O&apos;chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
