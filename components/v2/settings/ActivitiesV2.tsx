"use client";

import { useState } from "react";
import { CalendarDays, Info, Loader2, Pencil, Plus, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { TextInput } from "@/components/v2/form/fields";
import ListItemDialogV2 from "@/components/v2/settings/ListItemDialogV2";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";

// YANGI VERSIYA — SOZLAMALAR → O'QUV → «QO'SHIMCHA MASHG'ULOTLAR» (41-qism, rasm «Sozlamalar · Qo'shimcha
// mashg'ulotlar»). Asosiy darsdan tashqari mashg'ulot turlari: raqamlangan ro'yxat, tahrirlash, o'chirish, pastda
// tezkor qo'shish maydoni; bo'sh bo'lsa — «Hali mashg'ulot yo'q». Ro'yxat eski tab bilan bir
// (`settings_activities`, /api/settings-lists?kind=activities). Hozircha boshqa sahifalar uni o'qimaydi (SAVOLLAR 533).

type Row = { id: number; name: string };

export default function ActivitiesV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<{ ok: true; items: Row[] }>("/api/settings-lists?kind=activities");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [del, setDel] = useState<Row | null>(null);

  async function add(v: string) {
    const n = v.trim();
    if (!n) return;
    if (d?.items.some((x) => x.name.toLowerCase() === n.toLowerCase())) return showError(t("Bu qiymat ro'yxatda bor"));
    setBusy(true);
    const r = await fetch("/api/settings-lists?kind=activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    setName("");
    showSuccess(t("Qo'shildi"));
    reload();
  }
  async function remove(x: Row) {
    const r = await fetch(`/api/settings-lists/${x.id}?kind=activities`, { method: "DELETE" })
      .then((y) => y.json())
      .catch(() => null);
    setDel(null);
    if (!r?.ok) return showError(t(r?.error || "O'chirib bo'lmadi"));
    showSuccess(t("O'chirildi"));
    reload();
  }
  const focusInput = () => document.getElementById("act-new")?.focus();

  if (error) return <div className="p-6"><NoticeBar>{t("Ma'lumotni yuklab bo'lmadi")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const items = d.items;
  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-v2-small text-v2-text-2">{t("O'quv")}</div>
          <h1 className="text-v2-page text-v2-text">{t("Qo'shimcha mashg'ulotlar")}</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("Asosiy darsdan tashqari mashg'ulot turlari: speaking club, mock imtihon va boshqalar. Ro'yxat shu yerda yuritiladi.")}</p>
        </div>
        <button type="button" onClick={focusInput} className={primaryBtn}>
          <Plus className="size-4" aria-hidden /> {t("Mashg'ulot qo'shish")}
        </button>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
          <div className="mb-2 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-success-bg text-v2-success">
              <CalendarDays className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold text-v2-text">
                {t("Mashg'ulotlar")} · {items.length}
              </h2>
              <p className="text-v2-small text-v2-text-2">{t("Faqat nomi saqlanadi")}</p>
            </div>
          </div>
          {items.length > 0 ? (
            <ul className="divide-y divide-v2-border">
              {items.map((x, i) => (
                <li key={x.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 text-right text-v2-small tabular-nums text-v2-text-3">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-v2-small font-semibold text-v2-text">{x.name}</span>
                  <button type="button" onClick={() => setEdit(x)} aria-label={t("Tahrirlash")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => setDel(x)} aria-label={t("O'chirish")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-v2-md border border-dashed border-v2-border px-4 py-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface-2 text-v2-text-2">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <div className="font-semibold text-v2-text">{t("Hali mashg'ulot yo'q")}</div>
              <p className="max-w-[320px] text-v2-small text-v2-text-2">{t("Masalan: speaking club yoki mock imtihon. Nomini pastda yozing — ro'yxatga qo'shiladi.")}</p>
            </div>
          )}
          <form
            className="mt-3 flex gap-2 border-t border-v2-border pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void add(name);
            }}
          >
            <div className="min-w-0 flex-1">
              <TextInput id="act-new" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("Yangi mashg'ulot nomi")} aria-label={t("Yangi mashg'ulot nomi")} />
            </div>
            <button type="submit" disabled={busy || !name.trim()} className={`${secondaryBtn} disabled:opacity-50`}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />} {t("Qo'shish")}
            </button>
          </form>
        </section>
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
          <h2 className="font-semibold text-v2-text">{t("Qayerda ishlatiladi")}</h2>
          <div className="mt-2 flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Hozircha faqat ro'yxat: mashg'ulotni guruh, jadval yoki o'quvchiga bog'lash keyingi bosqichda.")}
          </div>
        </section>
      </div>
      {edit && <ListItemDialogV2 kind="activities" id={edit.id} title={t("Mashg'ulotni tahrirlash")} fields={[{ key: "name", label: "Nomi", kind: "text", max: 60 }]} initial={{ name: edit.name }} onClose={() => setEdit(null)} onDone={reload} />}
      {del && <V2Confirm title={t("Mashg'ulotni o'chirasizmi?")} body={t("«{n}» ro'yxatdan olib tashlanadi.", { n: del.name })} confirmLabel={t("O'chirish")} onConfirm={() => void remove(del)} onCancel={() => setDel(null)} />}
    </div>
  );
}
