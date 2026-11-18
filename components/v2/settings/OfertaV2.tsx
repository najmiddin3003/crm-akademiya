"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, FileText, Info, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { Segmented, TextInput, fieldCls } from "@/components/v2/form/fields";
import { Switch } from "@/components/v2/settings/financeKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar } from "@/components/v2/students/lists/listKit";

// YANGI VERSIYA — SOZLAMALAR → UMUMIY → «OMMAVIY OFERTA» (40-qism, rasm «Sozlamalar · Ommaviy oferta»). Bo'limlar
// (tartib raqami, sarlavha, qisqa matn, Majburiy/Ixtiyoriy, tahrirlash — joyida ochiladi, yuqoriga/pastga surish,
// o'chirish), o'ngda o'quvchi ilovasidagi ko'rinish. Saqlash — eski tab bilan bir hujjat (`settings`
// «system.public-oferta», /api/settings). «Tanishdim» tasdig'i hali hech qayerda so'ralmaydi (tepadagi izoh).

interface Section {
  id: string;
  title: string;
  text: string;
  required: boolean;
}

const KEY = "system.public-oferta";
let seq = 0;
const newId = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `of-${++seq}-${Math.random().toString(36).slice(2, 8)}`);
const norm = (s: Partial<Section> | null): Section => ({ id: s?.id || newId(), title: typeof s?.title === "string" ? s.title : "", text: typeof s?.text === "string" ? s.text : "", required: Boolean(s?.required) });

export default function OfertaV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [sections, setSections] = useState<Section[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; text: string }>({ title: "", text: "" });
  const [del, setDel] = useState<Section | null>(null);
  const [saving, setSaving] = useState(false);
  // 42-qism: kirishda tasdiq so'ralsinmi (`app_settings` «student_app».ofertaGate, /api/student-app).
  const { data: app, reload: reloadApp } = useReportData<{ ok: true; prefs: { ofertaGate?: boolean } }>("/api/student-app");
  async function setGate(on: boolean) {
    const r = await fetch("/api/student-app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ofertaGate: on }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Saqlandi"));
    reloadApp();
  }

  useEffect(() => {
    let off = false;
    fetch(`/api/settings?key=${encodeURIComponent(KEY)}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        if (!d?.ok) return setFailed(true);
        const v = (d.values ?? {}) as { sections?: Partial<Section>[] };
        setSections(Array.isArray(v.sections) ? v.sections.map(norm) : []);
      })
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, []);

  async function persist(next: Section[], msg = "Saqlandi") {
    setSaving(true);
    const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: KEY, values: { sections: next } }) })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!r?.ok) {
      showError(t(r?.error || "Saqlab bo'lmadi"));
      return false;
    }
    setSections(next);
    showSuccess(t(msg));
    return true;
  }

  if (failed) return <div className="p-6"><NoticeBar>{t("Ma'lumotni yuklab bo'lmadi")}</NoticeBar></div>;
  if (!sections)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );

  const startEdit = (s: Section) => {
    setOpen(s.id);
    setDraft({ title: s.title, text: s.text });
  };
  const add = async () => {
    const s: Section = { id: newId(), title: t("Yangi bo'lim"), text: "", required: true };
    if (await persist([...sections, s], "Qo'shildi")) startEdit(s);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    void persist(next);
  };
  const req = sections.filter((s) => s.required).length;

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-v2-small text-v2-text-2">{t("Umumiy")}</div>
          <h1 className="text-v2-page text-v2-text">{t("Ommaviy oferta")}</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("Oferta bo'limlarga bo'linadi. O'quvchi ilovaga kirishdan oldin har bir bo'limni alohida «Tanishdim» deb tasdiqlaydi.")}</p>
        </div>
        <button type="button" disabled={saving} onClick={() => void add()} className={`${primaryBtn} disabled:opacity-60`}>
          <Plus className="size-4" aria-hidden /> {t("Bo'lim qo'shish")}
        </button>
      </div>
      <section className="flex flex-wrap items-center gap-3 rounded-v2-lg border border-v2-border bg-v2-surface px-4 py-3 shadow-v2-sm">
        <div className="min-w-0 flex-1">
          <div className="text-v2-small font-semibold text-v2-text">{t("Kabinetga kirishda tasdiq so'ralsin")}</div>
          <div className="text-v2-small text-v2-text-2">{t("Yoqilsa, o'quvchi va ota-ona majburiy bo'limlarni «Tanishdim» qilmaguncha kabinet ochilmaydi (Telegram kabineti).")}</div>
        </div>
        <Switch on={!!app?.prefs?.ofertaGate} label={t("Kabinetga kirishda tasdiq so'ralsin")} disabled={!app || !sections.length} onChange={(v) => void setGate(v)} />
        <Link href="/settings-student-app" className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
          {t("O'quvchi ilovasi")} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </section>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
          <div className="mb-2 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand">
              <FileText className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold text-v2-text">
                {t("Bo'limlar")} · {sections.length}
              </h2>
              <p className="text-v2-small text-v2-text-2">{t("Tartib — ilovadagi tartib")}</p>
            </div>
          </div>
          <ul className="divide-y divide-v2-border">
            {sections.map((s, i) => (
              <li key={s.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2">{i + 1}</span>
                  <div className="min-w-[160px] flex-1">
                    <div className="text-v2-small font-semibold text-v2-text">{s.title || t("Sarlavhasiz")}</div>
                    {open !== s.id && <div className="truncate text-v2-caption text-v2-text-2">{s.text || t("Matn kiritilmagan")}</div>}
                  </div>
                  <div className="w-44">
                    <Segmented
                      label={t("Bo'lim turi")}
                      value={s.required ? "req" : "opt"}
                      onChange={(v) => void persist(sections.map((x) => (x.id === s.id ? { ...x, required: v === "req" } : x)))}
                      options={[
                        { value: "req", label: t("Majburiy") },
                        { value: "opt", label: t("Ixtiyoriy") },
                      ]}
                    />
                  </div>
                  <div className="flex">
                    <button type="button" disabled={i === 0 || saving} onClick={() => move(i, -1)} aria-label={t("Yuqoriga")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2 disabled:opacity-30">
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button type="button" disabled={i === sections.length - 1 || saving} onClick={() => move(i, 1)} aria-label={t("Pastga")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2 disabled:opacity-30">
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => (open === s.id ? setOpen(null) : startEdit(s))} aria-label={t("Tahrirlash")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => setDel(s)} aria-label={t("O'chirish")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
                {open === s.id && (
                  <div className="mt-3 space-y-2 pl-10">
                    <TextInput value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={80} aria-label={t("Sarlavha")} />
                    <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={5} maxLength={6000} aria-label={t("Matn")} className={fieldCls("default", "h-auto py-2")} />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 text-v2-caption text-v2-text-2">{t("Ilovada sarlavha va shu matn chiqadi")}</span>
                      <button type="button" onClick={() => setOpen(null)} className={secondaryBtn}>
                        {t("Bekor qilish")}
                      </button>
                      <button
                        type="button"
                        disabled={saving || !draft.title.trim()}
                        onClick={() => void persist(sections.map((x) => (x.id === s.id ? { ...x, title: draft.title.trim(), text: draft.text.trim() } : x))).then((ok) => ok && setOpen(null))}
                        className={`${primaryBtn} disabled:opacity-60`}
                      >
                        {t("Bo'limni saqlash")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {!sections.length && <li className="py-8 text-center text-v2-small text-v2-text-3">{t("Hozircha bo'lim qo'shilmagan")}</li>}
          </ul>
          <div className="mt-2 flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("«Majburiy» bo'limlarning hammasi tasdiqlanmaguncha o'quvchi ilova ichiga kira olmaydi. «Ixtiyoriy» bo'lim faqat o'qib chiqish uchun.")}
          </div>
        </section>
        <div className="space-y-4">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Ilovada shunday ko'rinadi")}</h2>
            <p className="text-v2-small text-v2-text-2">{t("o'quvchi ilovasi · birinchi kirish")}</p>
            <div className="mt-3 rounded-v2-lg border border-v2-border bg-v2-surface-2 p-3">
              <div className="font-semibold text-v2-text">{t("Ommaviy oferta")}</div>
              <div className="text-v2-caption text-v2-text-2">{t("Ilovaga kirish uchun majburiy bo'limlarni o'qib, tasdiqlang · {n} ta", { n: req })}</div>
              <ul className="mt-2 space-y-1.5">
                {sections.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-v2-md border border-v2-border bg-v2-surface px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-v2-caption font-semibold text-v2-text">{s.title || t("Sarlavhasiz")}</div>
                      <div className={`text-[11px] ${s.required ? "text-v2-text-3" : "text-v2-info"}`}>{s.required ? t("majburiy") : t("ixtiyoriy")}</div>
                    </div>
                    <span className="text-[11px] text-v2-text-2">{t("Tanishdim")}</span>
                    <span className="h-4 w-7 rounded-full bg-v2-border-strong" aria-hidden />
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex h-9 items-center justify-center rounded-v2-md bg-v2-brand/40 text-v2-small font-semibold text-v2-on-brand">{t("Ilovaga kirish")}</div>
            </div>
          </section>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Qanday ishlaydi")}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-v2-small text-v2-text-2">
              <li>{t("Bo'limni yuqoriga/pastga surib tartibini o'zgartirish mumkin.")}</li>
              <li>{t("Ixtiyoriy bo'lim kirishni to'xtatmaydi.")}</li>
              <li>{t("Har o'zgarish darhol saqlanadi.")}</li>
            </ul>
          </section>
        </div>
      </div>
      {del && (
        <V2Confirm
          title={t("Bo'limni o'chirasizmi?")}
          body={t("«{n}» bo'limi ofertadan olib tashlanadi.", { n: del.title })}
          confirmLabel={t("O'chirish")}
          onConfirm={() => {
            const d = del;
            setDel(null);
            void persist(
              sections.filter((x) => x.id !== d.id),
              "O'chirildi",
            );
          }}
          onCancel={() => setDel(null)}
        />
      )}
    </div>
  );
}
