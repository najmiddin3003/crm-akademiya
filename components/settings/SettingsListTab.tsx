"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import type { ListFieldKey, SettingsListItem } from "@/lib/settingsLists";
import Select from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";
import Modal, { useModalClose } from "@/components/ui/Modal";

// Sozlamalardagi barcha oddiy CRUD ro'yxatlari uchun umumiy komponent
// (Sabablar, To'lov turlari, Hamkorlar, grading tizimi, Hashtag …).
// Ustunlar va forma maydonlari `fields` orqali beriladi — hammasi bir xil
// naqshda ishlaydi.

export interface ListFieldDef {
  key: ListFieldKey;
  label: string;
  input: "text" | "select" | "toggle" | "date" | "color";
  options?: string[];
  // Toggle ustuni matnlari; standart — Faol / Nofaol.
  onLabel?: string;
  offLabel?: string;
  // Qiymatdan keyin ko'rinadigan birlik: "%", "UZS".
  suffix?: string;
}

/**
 * Yozuvda SAQLANMAYDIGAN, boshqa kolleksiyadan hisoblanadigan ustun
 * (hozircha yagona foydalanuvchisi — Oylik foizlaridagi "Bog'langan xodim
 * soni", u xodim kartochkalaridan sanaladi).
 *
 * Ilgari bunday ustun oddiy `readOnly` maydon edi: qiymat yozuv ichida
 * yotardi va uni hech kim yangilamasdi. Endi u umuman maydon emas — shuning
 * uchun uni tasodifan formadan yoki POST tanasidan yozib bo'lmaydi.
 */
export interface ComputedColumnDef {
  label: string;
  /** Shu maydondan keyin chiziladi — referensdagi ustun tartibi saqlansin. */
  afterKey: ListFieldKey;
  /**
   * Yozuv nomi (trim + kichik harf) → son. Barqaror (modul darajasidagi)
   * funksiya bo'lishi shart: u useEffect bog'lanishida turadi.
   */
  load: () => Promise<Map<string, number>>;
}

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function SettingsListTab({
  kind,
  addLabel,
  fields,
  computed,
}: {
  kind: string;
  addLabel: string;
  fields: ListFieldDef[];
  computed?: ComputedColumnDef;
}) {
  const modal = useModalClose(closeForm);
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<SettingsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  // `null` — hali yuklanmoqda yoki olinmadi; bunday paytda 0 KO'RSATILMAYDI,
  // chunki 0 ("bitta ham xodim yo'q") — bu ham bir da'vo.
  const [counts, setCounts] = useState<Map<string, number> | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SettingsListItem | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SettingsListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // `kind` komponent hayoti davomida o'zgarmaydi (har tab alohida mount
  // bo'ladi), shuning uchun yuklanish holatini qayta tiklash shart emas.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings-lists?kind=${kind}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setItems(d.items); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind]);

  // Hisoblanadigan ustun bazadan emas, boshqa kolleksiyadan keladi.
  const load = computed?.load;
  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    load()
      // Xato bo'lsa `counts` `null` bo'lib qoladi va ustunda "—" turadi —
      // soxta 0 ko'rsatgandan ko'ra "noma'lum" rost.
      .then((m) => { if (!cancelled) setCounts(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [load]);

  function blank(): Record<string, string | boolean> {
    const o: Record<string, string | boolean> = {};
    for (const f of fields) {
      if (f.input === "toggle") o[f.key] = true;
      else if (f.input === "color") o[f.key] = "#3b82f6";
      else o[f.key] = f.options?.[0] ?? "";
    }
    return o;
  }

  function openAdd() {
    setForm(blank());
    setAddOpen(true);
  }
  function openEdit(it: SettingsListItem) {
    const o: Record<string, string | boolean> = {};
    for (const f of fields) {
      const v = it[f.key];
      o[f.key] = f.input === "toggle" ? Boolean(v) : String(v ?? "");
    }
    setForm(o);
    setEditTarget(it);
  }
  function closeForm() {
    setAddOpen(false);
    setEditTarget(null);
  }

  async function save() {
    if (!String(form.name ?? "").trim()) {
      showError("Nomini kiriting");
      return;
    }
    setSaving(true);
    try {
      const editing = editTarget !== null;
      const url = editing
        ? `/api/settings-lists/${editTarget.id}?kind=${kind}`
        : `/api/settings-lists?kind=${kind}`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      setItems((prev) =>
        editing ? prev.map((x) => (x.id === data.item.id ? data.item : x)) : [...prev, data.item],
      );
      showSuccess(editing ? "Yangilandi" : "Qo'shildi");
      modal.close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/settings-lists/${deleteTarget.id}?kind=${kind}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      showSuccess("O'chirildi");
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const formOpen = addOpen || editTarget !== null;

  function cell(it: SettingsListItem, f: ListFieldDef) {
    const v = it[f.key];

    if (f.input === "toggle") {
      const on = Boolean(v);
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
            on ? "text-emerald-700 bg-emerald-100" : "text-muted-foreground bg-secondary"
          }`}
        >
          {on ? f.onLabel ?? "Faol" : f.offLabel ?? "Nofaol"}
        </span>
      );
    }

    // Rang ustuni — kichik namuna kvadrati + kod (referensda lid bosqichlari
    // shu rang bilan belgilanadi).
    if (f.input === "color") {
      const hex = String(v ?? "");
      if (!hex) return <span className="text-[13px]">—</span>;
      return (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded border border-border" style={{ background: hex }} />
          <span className="text-[13px] text-muted-foreground tabular-nums">{hex}</span>
        </span>
      );
    }

    const text = String(v ?? "");
    if (!text) return <span className="text-[13px]">—</span>;
    return (
      <span className={f.key === "name" ? "font-medium" : "text-[13px]"}>
        {text}
        {f.suffix ? <span className="text-muted-foreground"> {f.suffix}</span> : null}
      </span>
    );
  }

  // Hisoblangan ustun katakchasi. Manba hali kelmagan bo'lsa "—" — o'sha
  // paytda 0 yozish "hech kim bog'lanmagan" degan yolg'on da'vo bo'lardi.
  function computedCell(it: SettingsListItem) {
    if (!counts) return <span className="text-[13px] text-muted-foreground">—</span>;
    return <span className="text-[13px] tabular-nums">{counts.get(it.name.trim().toLowerCase()) ?? 0}</span>;
  }

  // Ustunlar ro'yxati: hisoblanadigan ustun o'z joyiga (afterKey dan keyin)
  // qo'shiladi, shunda referensdagi tartib saqlanadi.
  const columns: ({ field: ListFieldDef } | { computed: ComputedColumnDef })[] = [];
  for (const f of fields) {
    columns.push({ field: f });
    if (computed && computed.afterKey === f.key) columns.push({ computed });
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <span>+ {addLabel}</span>
        </button>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                {columns.map((c) =>
                  "field" in c ? (
                    <th key={c.field.key} className="px-5 py-3 text-left whitespace-nowrap">{c.field.label}</th>
                  ) : (
                    <th key="__computed" className="px-5 py-3 text-left whitespace-nowrap">{c.computed.label}</th>
                  ),
                )}
                <th className="px-5 py-3 text-right pr-5 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it, i) => (
                <tr key={it.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  {columns.map((c) =>
                    "field" in c ? (
                      <td key={c.field.key} className="px-5 py-3">{cell(it, c.field)}</td>
                    ) : (
                      <td key="__computed" className="px-5 py-3">{computedCell(it)}</td>
                    ),
                  )}
                  <td className="px-5 py-3 pr-5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(it)}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        title="Tahrirlash"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {/* Tizimli yozuvda o'chirish tugmasi ko'rinmaydi — referensdagidek */}
                      {!it.system && (
                        <button
                          onClick={() => setDeleteTarget(it)}
                          className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Ma'lumot topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <Modal onClose={closeForm} controller={modal} locked={saving} bare zIndex={110} panelClassName="overflow-y-auto p-6 space-y-4">
            <h3 className="text-[16px] font-semibold">{editTarget ? "Tahrirlash" : addLabel}</h3>
            {fields.map((f) => (
              <div key={f.key}>
                {f.input === "toggle" ? (
                  <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form[f.key])}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.checked }))}
                      className="h-4 w-4 rounded border-border accent-[var(--primary)]"
                    />
                    <span>{f.label}</span>
                  </label>
                ) : (
                  <>
                    <label className="block text-[13px] font-medium mb-1.5">{f.label}</label>
                    {f.input === "date" ? (
                      <DateField value={String(form[f.key] ?? "")} onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))} variant="form" />
                    ) : f.input === "color" ? (
                      // Rang tanlagich + kod maydoni — ikkalasi bir qiymatni
                      // boshqaradi, shunda qo'lda ham kiritish mumkin.
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={String(form[f.key] ?? "#3b82f6")}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="h-10 w-14 shrink-0 rounded-lg border border-border bg-card p-1 cursor-pointer"
                        />
                        <input
                          value={String(form[f.key] ?? "")}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                    ) : f.input === "select" ? (
                      <Select value={String(form[f.key] ?? "")} onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))} options={(f.options ?? []).map((o) => ({ value: o, label: o }))} />
                    ) : (
                      <div className="relative">
                        <input
                          value={String(form[f.key] ?? "")}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className={f.suffix ? `${inputCls} pr-14` : inputCls}
                        />
                        {f.suffix && (
                          <span className="absolute inset-y-0 right-3 flex items-center text-[12px] text-muted-foreground pointer-events-none">
                            {f.suffix}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={modal.close}
                disabled={saving}
                className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Bekor qilish
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>
          </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} locked={deleting} bare size="sm" zIndex={120} panelClassName="p-6">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">Rostdan ham o&apos;chirmoqchimisiz?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={modal.close}
                disabled={deleting}
                className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
              >
                Yo&apos;q
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? "O'chirilmoqda…" : "Ha"}
              </button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
