"use client";

import { useState } from "react";
import { Info, Loader2, MessageSquare, Pencil, Plus, Smartphone, Trash2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { Switch } from "@/components/v2/settings/financeKit";
import ListItemDialogV2, { type ListField } from "@/components/v2/settings/ListItemDialogV2";
import { primaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar, TH } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";

// YANGI VERSIYA — INTEGRATSIYALAR → «SMS QURILMALAR» (40-qism, rasm «Integratsiyalar · SMS qurilmalar»). Qurilmalar
// jadvali (nom, kompaniya, yashirilgan IMEI, mas'ul moderator, aloqa belgisi, «Faol»), «Qurilma qo'shish» qadamlari
// va SMS operatorlar (Eskiz — muhit sozlamasidan). Telefon ilovasi bilan ulanish hali yo'q — SMS faqat operator orqali
// ketadi; «Aloqa» qo'lda belgilanadi (SAVOLLAR 530). Server: /api/sms-devices-overview; yozish — /api/settings-lists.

type Device = { id: number; name: string; company: string; imei: string; imeiMasked: string; moderator: string; online: boolean; active: boolean };
type Data = { ok: true; devices: Device[]; moderators: string[]; operators: { eskiz: boolean; eskizFallback: boolean } };

const COMPANIES = ["Beeline", "Ucell", "Uzmobile", "Mobiuz", "Humans"];

export default function SmsDevicesV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<Data>("/api/sms-devices-overview");
  const [edit, setEdit] = useState<Device | "new" | null>(null);
  const [del, setDel] = useState<Device | null>(null);
  async function patch(id: number, body: Record<string, unknown>) {
    const r = await fetch(`/api/settings-lists/${id}?kind=sms-devices`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Saqlandi"));
    reload();
  }
  async function remove(dv: Device) {
    const r = await fetch(`/api/settings-lists/${dv.id}?kind=sms-devices`, { method: "DELETE" })
      .then((x) => x.json())
      .catch(() => null);
    setDel(null);
    if (!r?.ok) return showError(t(r?.error || "O'chirib bo'lmadi"));
    showSuccess(t("O'chirildi"));
    reload();
  }
  if (error) return <div className="p-6"><NoticeBar>{t("Faqat direktor uchun")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const fields: ListField[] = [
    { key: "name", label: "Qurilma", kind: "text", placeholder: "Masalan: Chortoq 1 · kassa telefoni" },
    { key: "company", label: "Kompaniya", kind: "select", options: COMPANIES },
    { key: "imei", label: "IMEI", kind: "text", placeholder: "15 xonali raqam", hint: "Telefonda *#06# tering", max: 20 },
    { key: "moderator", label: "Mas'ul moderator", kind: "select", options: d.moderators, optional: true },
  ];
  const ops = [
    { name: "Eskiz", on: d.operators.eskiz, note: d.operators.eskizFallback ? t("asosiy + zaxira akkaunt") : t("asosiy akkaunt") },
    { name: "Play mobile", on: false, note: "" },
  ];
  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-v2-small text-v2-text-2">{t("Integratsiyalar")}</div>
          <h1 className="text-v2-page text-v2-text">{t("SMS qurilmalar")}</h1>
          <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("Markaz telefonidagi SIM-karta orqali SMS yuborish. Qurilma IMEI raqami bilan qo'shiladi va mas'ul moderatorga biriktiriladi.")}</p>
        </div>
        <button type="button" onClick={() => setEdit("new")} className={primaryBtn}>
          <Plus className="size-4" aria-hidden /> {t("Qurilma qo'shish")}
        </button>
      </div>
      <NoticeBar>{t("Telefon ilovasi bilan ulanish hali ishga tushmagan: hozir barcha SMS operator (Eskiz) orqali ketadi. Qurilmalar ro'yxati saqlanadi, «Aloqa» qo'lda belgilanadi.")}</NoticeBar>
      <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
        <div className="mb-2 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-info-bg text-v2-info">
            <Smartphone className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-v2-text">
              {t("Qurilmalar")} · {d.devices.length}
            </h2>
            <p className="text-v2-small text-v2-text-2">{t("«Faol» o'chirilsa, qurilmaga SMS berilmaydi")}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-v2-small">
            <thead>
              <tr className="border-b border-v2-border">
                <th className={TH}>{t("Qurilma")}</th>
                <th className={TH}>{t("Kompaniya")}</th>
                <th className={TH}>IMEI</th>
                <th className={TH}>{t("Moderator")}</th>
                <th className={TH}>{t("Aloqa")}</th>
                <th className={`${TH} text-right`}>{t("Faol")}</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody className="divide-y divide-v2-border">
              {d.devices.map((dv) => (
                <tr key={dv.id}>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2 font-semibold text-v2-text">
                      <Smartphone className="size-4 text-v2-text-3" aria-hidden /> {dv.name}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-v2-text">{dv.company || "—"}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums text-v2-text" title={dv.imei}>
                    {dv.imeiMasked || "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-v2-text">{dv.moderator || "—"}</td>
                  <td className="py-2.5 pr-3">
                    <button type="button" onClick={() => void patch(dv.id, { online: !dv.online })} className="inline-flex items-center gap-1.5" title={t("Qo'lda belgilanadi — bosib almashtiring")}>
                      <span className={`size-2 rounded-full ${dv.online ? "bg-v2-success" : "bg-v2-text-3"}`} />
                      <span className={dv.online ? "font-semibold text-v2-success" : "text-v2-text-2"}>{dv.online ? t("Onlayn") : t("Oflayn")}</span>
                    </button>
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <Switch on={dv.active} label={t("Faol")} onChange={(v) => void patch(dv.id, { active: v })} />
                  </td>
                  <td className="py-1.5">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEdit(dv)} aria-label={t("Tahrirlash")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button type="button" onClick={() => setDel(dv)} aria-label={t("O'chirish")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!d.devices.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-v2-text-3">{t("Qurilma qo'shilmagan")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
          <div className="mb-2 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand">
              <Plus className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold text-v2-text">{t("Qurilma qo'shish")}</h2>
              <p className="text-v2-small text-v2-text-2">{t("3 qadam")}</p>
            </div>
          </div>
          <ol className="divide-y divide-v2-border">
            {[
              [t("Telefonni tayyorlang"), t("Android telefon va SIM-karta — markaz raqami")],
              [t("IMEI'ni kiriting"), t("Telefonda *#06# tering — 15 xonali raqam chiqadi")],
              [t("Kompaniya va moderator"), t("SIM operatori va qurilmaga mas'ul xodimni tanlang")],
            ].map(([a, b], i) => (
              <li key={a} className="flex gap-3 py-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-v2-brand-bg text-v2-caption font-semibold text-v2-brand">{i + 1}</span>
                <div>
                  <div className="text-v2-small font-semibold text-v2-text">{a}</div>
                  <div className="text-v2-small text-v2-text-2">{b}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
          <div className="mb-2 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-warning-bg text-v2-warning">
              <MessageSquare className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold text-v2-text">{t("SMS operatorlar")}</h2>
              <p className="text-v2-small text-v2-text-2">{t("Qurilmadan tashqari — operator orqali yuborish")}</p>
            </div>
          </div>
          <ul className="divide-y divide-v2-border">
            {ops.map((o) => (
              <li key={o.name} className="flex items-center gap-3 py-2.5">
                <MessageSquare className="size-4 text-v2-text-3" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-v2-small font-semibold text-v2-text">{o.name}</div>
                  {o.note && <div className="text-v2-caption text-v2-text-2">{o.note}</div>}
                </div>
                {o.on ? (
                  <span className="rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-success">{t("ulangan")}</span>
                ) : o.name === "Eskiz" ? (
                  <span className="rounded-full bg-v2-warning-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-warning">{t("sozlanmagan")}</span>
                ) : (
                  <span className="rounded-v2-sm bg-v2-info-bg px-1.5 text-v2-caption font-semibold text-v2-info">{t("Tez orada")}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Operator kaliti server sozlamasida saqlanadi — Tizimli jamoasi ulaydi.")}
          </div>
        </section>
      </div>
      {edit && (
        <ListItemDialogV2
          kind="sms-devices"
          id={edit === "new" ? undefined : edit.id}
          title={edit === "new" ? t("Qurilma qo'shish") : t("Qurilmani tahrirlash")}
          subtitle={t("SIM-kartali Android telefon")}
          fields={fields}
          initial={edit === "new" ? { name: "", company: "", imei: "", moderator: "" } : { name: edit.name, company: edit.company, imei: edit.imei, moderator: edit.moderator }}
          onClose={() => setEdit(null)}
          onDone={reload}
        />
      )}
      {del && <V2Confirm title={t("Qurilmani o'chirasizmi?")} body={t("«{n}» ro'yxatdan olib tashlanadi.", { n: del.name })} confirmLabel={t("O'chirish")} onConfirm={() => void remove(del)} onCancel={() => setDel(null)} />}
    </div>
  );
}
