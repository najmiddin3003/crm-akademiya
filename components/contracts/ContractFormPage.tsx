"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { CONTRACT_TYPES, CONTRACT_FIELDS } from "@/constants/contracts";
import type { Contract } from "@/lib/contracts";
import type { RichTextEditorField } from "@/components/ui/RichTextEditor";
import Select from "@/components/ui/Select";

const CONTRACT_FIELDS_MAP = CONTRACT_FIELDS as Record<string, RichTextEditorField[]>;

// O'quv bo'limi → Shartnoma → "Shartnoma yaratish" / tahrirlash. Ikkalasi ham
// AYNAN BIR XIL sahifa (foydalanuvchi so'roviga ko'ra): `contractId` berilsa —
// mavjud shartnoma yuklanib tahrirlanadi (PATCH), aks holda yangi yaratiladi
// (POST). Chap panel — "Shartnoma turi" + shu turga tegishli birlashtirish
// maydonlari (bosilganda {{token}} klipbordga nusxalanadi, keyin matn ichiga
// joylashtiriladi — RichTextEditor'ning "@" tugmasi ham xuddi shu maydonlarni
// bevosita kursor joyiga qo'yadi).
export default function ContractFormPage({ contractId }: { contractId?: number }) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [loaded, setLoaded] = useState(contractId == null);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>(CONTRACT_TYPES[0]?.value || "");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contractId == null) return;
    let cancelled = false;
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const found = (d.contracts as Contract[]).find((c) => c.id === contractId);
        if (!found) {
          setNotFound(true);
          setLoaded(true);
          return;
        }
        setTitle(found.title);
        setType(found.type);
        setContent(found.content);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [contractId]);

  const fields = CONTRACT_FIELDS_MAP[type] || [];

  function copyToken(token: string) {
    navigator.clipboard.writeText(`{{${token}}}`);
    showSuccess(`Nusxalandi: {{${token}}}`);
  }

  async function save() {
    if (!title.trim()) {
      showError("Sarlavhani kiriting");
      return;
    }
    setSaving(true);
    const url = contractId != null ? `/api/contracts/${contractId}` : "/api/contracts";
    const method = contractId != null ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, content }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      showSuccess(contractId != null ? "Shartnoma yangilandi" : "Shartnoma yaratildi");
      router.push("/contract");
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  if (contractId != null && !loaded) {
    return <div className="container mx-auto max-w-[1600px] p-4 md:p-5"><SpinnerBlock /></div>;
  }
  if (notFound) {
    return (
      <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">Shartnoma topilmadi.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-0" style={{ minHeight: "75vh" }}>
      <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-border p-4 space-y-4">
        <h2 className="text-[16px] font-semibold">Shartnoma</h2>
        <div>
          <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Shartnoma turi</label>
          <Select value={type} onChange={(v) => setType(v)} options={CONTRACT_TYPES.map((t) => ({ value: t.value, label: t.label }))} size="sm" />
        </div>
        <div className="space-y-1.5">
          {fields.map((f) => (
            <button
              key={f.token}
              type="button"
              onClick={() => copyToken(f.token)}
              className="w-full flex items-center justify-between gap-2 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-[13px] text-left"
              title="Nusxalash"
            >
              <span className="truncate">{f.label}</span>
              <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            type="text"
            placeholder="Sarlavha"
            className="flex-1 h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button onClick={save} disabled={saving} className="inline-flex items-center h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 shrink-0">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>

        <RichTextEditor value={content} onChange={setContent} fields={fields} minHeight={420} />
      </div>
    </div>
  );
}
