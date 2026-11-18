"use client";

import { useState } from "react";
import { ArrowRight, CalendarCheck, DoorOpen, Info, Loader2, Pencil, Plus, X, XCircle } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import ListItemDialogV2, { type ListField } from "@/components/v2/settings/ListItemDialogV2";
import { primaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar, SegmentPills } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import type { ReasonType } from "@/lib/reasonsPage";

// YANGI VERSIYA — SOZLAMALAR → O'QUV → «SABABLAR» (40-qism, rasm «Sozlamalar · Sabablar»). Tur bo'yicha tablar,
// har tur kartasi (sabab, oxirgi 3 oyda necha marta tanlangan, tahrirlash/o'chirish), o'ngda «Sabab turlari» va
// lid «Rad etdi» sabablari (Lid sozlamalarida). Ro'yxat — /api/settings-lists?kind=reasons; sanoq — /api/reasons-overview.

type Row = { id: number; name: string; type: ReasonType; count: number; system: boolean };
type Data = { ok: true; since: string; rows: Row[]; defaults: Record<ReasonType, { name: string; count: number }[]>; ketdiOther: number };

const TYPES: { k: ReasonType; icon: typeof DoorOpen; tone: string; where: string; sub: string }[] = [
  { k: "Ketdi", icon: DoorOpen, tone: "bg-v2-danger-bg text-v2-danger", where: "O'quvchini arxivlash yoki muzlatish oynasida so'raladi", sub: "O'quvchi holati oynasi · Ketish sabablari hisoboti" },
  { k: "Bekor qilindi", icon: XCircle, tone: "bg-v2-warning-bg text-v2-warning", where: "Buyurtma rad etilganda tanlanadi", sub: "Buyurtma (eski lid kartasi) rad etilganda" },
  { k: "Davomat", icon: CalendarCheck, tone: "bg-v2-info-bg text-v2-info", where: "Davomatda «sababli» belgilanganda tanlanadi", sub: "Davomatda «sababli» belgilanganda" },
];

export default function ReasonsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<Data>("/api/reasons-overview");
  const [tab, setTab] = useState<ReasonType | "all">("all");
  const [edit, setEdit] = useState<{ id?: number; name: string; type: ReasonType } | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  async function adoptDefaults(type: ReasonType, names: string[]) {
    setBusy(true);
    for (const name of names) await fetch("/api/settings-lists?kind=reasons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, type }) }).catch(() => null);
    setBusy(false);
    showSuccess(t("Ro'yxatga qo'shildi"));
    reload();
  }
  async function remove(r: Row) {
    const x = await fetch(`/api/settings-lists/${r.id}?kind=reasons`, { method: "DELETE" })
      .then((y) => y.json())
      .catch(() => null);
    setDel(null);
    if (!x?.ok) return showError(t(x?.error || "O'chirib bo'lmadi"));
    showSuccess(t("O'chirildi"));
    reload();
  }

  if (error) return <div className="p-6"><NoticeBar>{t("Ma'lumotni yuklab bo'lmadi")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const of = (k: ReasonType) => d.rows.filter((r) => r.type === k);
  const shown = TYPES.filter((x) => tab === "all" || x.k === tab);
  const fields: ListField[] = [
    { key: "name", label: "Sabab", kind: "text", placeholder: "Masalan: Ko'chib ketdi" },
    { key: "type", label: "Turi", kind: "segment", options: TYPES.map((x) => ({ value: x.k, label: x.k })) },
  ];
  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-v2-small text-v2-text-2">{t("O'quv")}</div>
          <h1 className="text-v2-page text-v2-text">{t("Sabablar")}</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("O'quvchi ketganda, buyurtma bekor qilinganda va darsga kelmaganda shu ro'yxatdan sabab tanlanadi.")}</p>
        </div>
        <button type="button" onClick={() => setEdit({ name: "", type: tab === "all" ? "Ketdi" : tab })} className={primaryBtn}>
          <Plus className="size-4" aria-hidden /> {t("Sabab qo'shish")}
        </button>
      </div>
      <SegmentPills
        value={tab}
        onChange={setTab}
        items={[{ key: "all" as const, label: t("Hammasi"), count: d.rows.length }, ...TYPES.map((x) => ({ key: x.k, label: t(x.k), count: of(x.k).length }))]}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {shown.map((x) => {
            const rows = of(x.k);
            const defs = d.defaults[x.k] ?? [];
            return (
              <section key={x.k} className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
                <div className="mb-2 flex items-start gap-3">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-v2-md ${x.tone}`}>
                    <x.icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-v2-text">
                      {t(x.k)} · {rows.length}
                    </h2>
                    <p className="text-v2-small text-v2-text-2">
                      {t(x.where)} · {t("soni — {d}dan", { d: fmt.dayMonth(d.since) })}
                    </p>
                  </div>
                </div>
                {rows.length > 0 ? (
                  <ul className="divide-y divide-v2-border">
                    {rows.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 py-2.5">
                        <span className="min-w-0 flex-1 text-v2-small font-semibold text-v2-text">{r.name}</span>
                        <span className="w-10 text-right text-v2-small tabular-nums text-v2-text">{r.count}</span>
                        <button type="button" onClick={() => setEdit({ id: r.id, name: r.name, type: r.type })} aria-label={t("Tahrirlash")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        {!r.system && (
                          <button type="button" onClick={() => setDel(r)} aria-label={t("O'chirish")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                            <X className="size-4" aria-hidden />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : defs.length > 0 ? (
                  <>
                    <ul className="divide-y divide-v2-border opacity-70">
                      {defs.map((r) => (
                        <li key={r.name} className="flex items-center gap-3 py-2.5">
                          <span className="min-w-0 flex-1 text-v2-small text-v2-text">{t(r.name)}</span>
                          <span className="w-10 text-right text-v2-small tabular-nums text-v2-text">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
                      <Info className="size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1">{x.k === "Ketdi" ? t("Ro'yxat sozlanmagan — sabab qo'lda yoziladi. Oxirgi 3 oyda eng ko'p yozilganlar:") : t("Ro'yxat sozlanmagan — tizim shu standart sabablarni ko'rsatadi.")}</span>
                      <button type="button" disabled={busy} onClick={() => void adoptDefaults(x.k, defs.map((z) => z.name))} className="font-semibold text-v2-brand disabled:opacity-50">
                        {t("Tahrirlash uchun ro'yxatga olish")}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="py-4 text-center text-v2-small text-v2-text-3">{t("Sabab qo'shilmagan — oynada sabab qo'lda yoziladi")}</p>
                )}
                {x.k === "Ketdi" && d.ketdiOther > 0 && (
                  <div className="mt-2 flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Yana {n} o'quvchi ro'yxatda yo'q sabab bilan chiqarilgan — hisobotda o'z matni bilan turibdi.", { n: d.ketdiOther })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <div className="space-y-4">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Sabab turlari")}</h2>
            <p className="text-v2-small text-v2-text-2">{t("sabab qo'shilganda tur tanlanadi")}</p>
            <ul className="mt-2 divide-y divide-v2-border">
              {TYPES.map((x) => (
                <li key={x.k} className="flex gap-3 py-2.5">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-v2-md ${x.tone}`}>
                    <x.icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-v2-text">{t(x.k)}</span>
                      <span className="text-v2-small text-v2-text-2">{t("{n} ta", { n: of(x.k).length })}</span>
                    </div>
                    <div className="text-v2-small text-v2-text-2">{t(x.sub)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Lid «Rad etdi» sabablari")}</h2>
            <p className="mt-1 text-v2-small text-v2-text-2">{t("Lid rad etilganda chiqadigan sabablar — Lid sozlamalarida, so'rovnoma ro'yxatlari yonida.")}</p>
            <Link href="/settings-leads" className="mt-2 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
              {t("Lid sozlamalari")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>
        </div>
      </div>
      {edit && (
        <ListItemDialogV2
          kind="reasons"
          id={edit.id}
          title={edit.id ? t("Sababni tahrirlash") : t("Sabab qo'shish")}
          subtitle={t("Tanlangan turdagi oynada chiqadi")}
          fields={fields}
          initial={{ name: edit.name, type: edit.type }}
          onClose={() => setEdit(null)}
          onDone={reload}
        />
      )}
      {del && <V2Confirm title={t("Sababni o'chirasizmi?")} body={t("«{n}» ro'yxatdan olib tashlanadi. Avval tanlanganlari o'z matni bilan qoladi.", { n: del.name })} confirmLabel={t("O'chirish")} onConfirm={() => void remove(del)} onCancel={() => setDel(null)} />}
    </div>
  );
}
