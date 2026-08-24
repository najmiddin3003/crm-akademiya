"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { Toggle } from "./SettingsForm";
import SettingsNote from "./SettingsNote";
import { OFERTA_NEW_SECTION, OFERTA_TEXTS } from "@/constants/settingsOferta";

// Umumiy sozlamalar → Ommaviy oferta. Oferta bo'limlarga bo'lingan matn
// ko'rinishida saqlanadi. Mobil ilova bo'limlarni alohida kartochka +
// "Tanishdim" switch'i bilan chiqaradi, shuning uchun har bir bo'limda
// "Majburiy" bayrog'i bor.
//
// PDF YUKLASH KARTASI OLIB TASHLANDI. U fayl tanlagichi ko'rinishida edi,
// lekin faylni hech qayerga yubormasdi — faqat `fileName` ni saqlardi.
// Ya'ni "Oferta fayli: shartnoma.pdf" deb turardi-yu, o'sha PDF tizimda
// umuman yo'q edi va uni ochib bo'lmasdi. Haqiqiy yuklash uchun endpoint
// yo'q: /api/upload/image faqat PNG/JPG/WEBP, /api/upload/video faqat
// video qabul qiladi, PDF (Cloudinary `raw`) uchun yo'l yo'q. Yolg'on
// tugmani qoldirgandan ko'ra olib tashlash to'g'ri — oferta matni
// pastdagi bo'limlar orqali to'liq kiritiladi.

interface OfertaSection {
  id: string;
  title: string;
  text: string;
  required: boolean;
}

interface OfertaData {
  sections: OfertaSection[];
}

const STORAGE_KEY = "system.public-oferta";
const T = OFERTA_TEXTS as Record<string, string>;

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

let seq = 0;
function newId(): string {
  // Date.now() emas: bir millisekundda ikkita bo'lim qo'shilsa id takrorlanardi.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  seq += 1;
  return `of-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

// Saqlangan bo'lim id'siz yoki maydonsiz kelishi mumkin (hujjat qo'lda
// tahrirlangan bo'lsa): id'siz qator tahrirlanmay qolardi, undefined qiymat
// esa input'ni nazoratsiz qilib qo'yardi.
function normalizeSection(s: Partial<OfertaSection> | null): OfertaSection {
  return {
    id: s?.id || newId(),
    title: typeof s?.title === "string" ? s.title : "",
    text: typeof s?.text === "string" ? s.text : "",
    required: Boolean(s?.required),
  };
}

export default function PublicOfertaTab() {
  const { showSuccess, showError } = useToast();
  const [data, setData] = useState<OfertaData>(() => ({ sections: [] }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${encodeURIComponent(STORAGE_KEY)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const saved = (d.values ?? {}) as Partial<OfertaData>;
        // Eski hujjatda sections yo'q yoki noto'g'ri turda bo'lishi mumkin.
        // Eskirgan `fileName` esa o'qilmaydi va birinchi saqlashda hujjatdan
        // butunlay yo'qoladi (PUT `values` ni to'liq almashtiradi).
        setData({
          sections: Array.isArray(saved.sections) ? saved.sections.map(normalizeSection) : [],
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function updateSection(id: string, patch: Partial<OfertaSection>) {
    setData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function addSection() {
    setData((prev) => ({
      ...prev,
      sections: [...prev.sections, { ...(OFERTA_NEW_SECTION as Omit<OfertaSection, "id">), id: newId() }],
    }));
  }

  function removeSection(id: string) {
    setData((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== id) }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STORAGE_KEY, values: data }),
      });
      const resData = await res.json();
      if (!resData.ok) {
        showError(resData.error || "Saqlanmadi");
        return;
      }
      showSuccess("Sozlamalar saqlandi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-8">
        <SpinnerBlock />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold">{T.title}</h3>
        <p className="text-[13px] text-muted-foreground mt-1 max-w-3xl">{T.description}</p>
      </div>

      {/* Sahifa matni "mobil ilovada 'Tanishdim' bilan ko'rsatiladi" deb
          va'da beradi, pastdagi izoh esa "tasdiqlanmaguncha kira olmaydi"
          deydi. Aslida "system.public-oferta" hujjatini o'qiydigan kod
          repoda yo'q. Bo'limlar rost saqlanadi, lekin va'da hali
          bajarilmayotganini ochiq aytamiz. */}
      <SettingsNote>
        Bo&apos;limlar saqlanadi, lekin ularni ko&apos;rsatadigan mobil ilova bu tizimga hali
        ulanmagan &mdash; &quot;Tanishdim&quot; tasdig&apos;i hozircha hech qayerda so&apos;ralmaydi.
      </SettingsNote>

      {/* Bo'limlar kartasi. Ro'yxat faqat "Saqlash"da serverga ketadi. */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {T.sectionsTitle}
            </div>
            <p className="text-[12px] text-muted-foreground">{T.sectionsHint}</p>
          </div>
          <span className="text-[12px] text-muted-foreground shrink-0">
            {/* Shablon-satr: &apos; li matn oldidagi probel JSX'da yo'qolib qolardi. */}
            {`${data.sections.length} ta bo'lim`}
          </span>
        </div>

        {data.sections.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{T.sectionsEmpty}</div>
        ) : (
          <div className="mt-4 space-y-3">
            {data.sections.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {i + 1}-bo&apos;lim
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      s.required ? "text-emerald-700 bg-emerald-100" : "text-muted-foreground bg-secondary"
                    }`}
                  >
                    {s.required ? T.requiredLabel : T.optionalLabel}
                  </span>
                </div>

                <div>
                  <label className="block text-[13px] font-medium mb-1.5">Sarlavha</label>
                  <input
                    value={s.title}
                    onChange={(e) => updateSection(s.id, { title: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium mb-1.5">Matni</label>
                  <textarea
                    rows={4}
                    value={s.text}
                    onChange={(e) => updateSection(s.id, { text: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px]">{T.requiredLabel}</span>
                    <Toggle on={Boolean(s.required)} onChange={(v) => updateSection(s.id, { required: v })} />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSection(s.id)}
                    className="h-8 px-3 rounded-lg border border-border text-[13px] font-medium inline-flex items-center gap-1.5 text-rose-600 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    O&apos;chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={addSection}
            className="h-10 px-6 rounded-lg border border-border text-sm font-medium inline-flex items-center gap-1.5 hover:bg-secondary"
          >
            <Plus className="w-4 h-4" />
            {T.addSection}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-[12px] text-muted-foreground max-w-3xl">{T.footerNote}</p>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium shrink-0 hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}
