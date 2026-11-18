"use client";

import { useState } from "react";
import { ArrowRight, GraduationCap, Info, Loader2, Pencil, Plus, Users, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Confirm from "@/components/v2/form/V2Confirm";
import ListItemDialogV2, { type ListField } from "@/components/v2/settings/ListItemDialogV2";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar, TH, fmtNum } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";

// YANGI VERSIYA — SOZLAMALAR → MOLIYA → «LAVOZIM VA STAVKALAR» (40-qism, rasm «Sozlamalar · Lavozim va stavkalar»).
// Xodim lavozimlari (yarim / bir stavka, nechta xodimda) va o'qituvchi lavozimlari (bir stavka); o'ngda misol (lavozim
// stavkasi va kartadagi oklad) va «Qanday ishlaydi». Ro'yxatlar eski grading tablari bilan umumiy
// (/api/settings-lists), sanoq — /api/positions-overview. Oklad stavkadan avtomatik olinmaydi (SAVOLLAR 528).

type Pos = { id: number; name: string; halfRate: number; fullRate: number; staff: number };
type Data = {
  ok: true;
  managers: Pos[];
  teachers: Pos[];
  unassigned: { moderators: number; teachers: number };
  example: { name: string; degree: string; rate: string; rateSum: number; cardOklad: number } | null;
};
type Kind = "degrees-manager" | "degrees-teacher";

const money = (n: number) => (n ? fmtNum(n) : "—");

function Actions({ onEdit, onDel }: { onEdit: () => void; onDel: () => void }) {
  const { t } = useT();
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={onEdit} aria-label={t("Tahrirlash")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
        <Pencil className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={onDel} aria-label={t("O'chirish")} className="flex size-8 items-center justify-center rounded-v2-sm text-v2-text-2 hover:bg-v2-surface-2">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export default function PositionsV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<Data>("/api/positions-overview");
  const [edit, setEdit] = useState<{ kind: Kind; row?: Pos } | null>(null);
  const [del, setDel] = useState<{ kind: Kind; row: Pos } | null>(null);
  async function remove(kind: Kind, r: Pos) {
    const x = await fetch(`/api/settings-lists/${r.id}?kind=${kind}`, { method: "DELETE" })
      .then((y) => y.json())
      .catch(() => null);
    setDel(null);
    if (!x?.ok) return showError(t(x?.error || "O'chirib bo'lmadi"));
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
  const fields = (kind: Kind): ListField[] =>
    kind === "degrees-manager"
      ? [
          { key: "name", label: "Lavozim", kind: "text", placeholder: "Masalan: Qabul admin." },
          { key: "halfRate", label: "Yarim stavka", kind: "money", optional: true, hint: "Ish vaqtining yarmi" },
          { key: "fullRate", label: "Bir stavka", kind: "money" },
        ]
      : [
          { key: "name", label: "Lavozim", kind: "text", placeholder: "Masalan: Teacher support" },
          { key: "fullRate", label: "Bir stavka", kind: "money" },
        ];
  const ex = d.example;
  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div>
        <div className="text-v2-small text-v2-text-2">{t("Moliya")}</div>
        <h1 className="text-v2-page text-v2-text">{t("Lavozim va stavkalar")}</h1>
        <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("Xodim lavozimlari va ularning stavkasi. Xodim kartasida «Darajasi» va «Bandlik darajasi» shu ro'yxatdan tanlanadi.")}</p>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
            <div className="mb-2 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand">
                <Users className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-v2-text">
                  {t("Xodim lavozimlari")} · {d.managers.length}
                </h2>
                <p className="text-v2-small text-v2-text-2">{t("Moderator va boshqa xodimlar · yarim stavka — ish vaqtining yarmi")}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-v2-small">
                <thead>
                  <tr className="border-b border-v2-border">
                    <th className={TH}>{t("Lavozim")}</th>
                    <th className={`${TH} text-right`}>{t("Yarim stavka")}</th>
                    <th className={`${TH} text-right`}>{t("Bir stavka")}</th>
                    <th className={`${TH} text-right`}>{t("Xodimlar")}</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-v2-border">
                  {d.managers.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pr-3 font-semibold text-v2-text">{r.name}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-v2-text">{money(r.halfRate)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-v2-text">{money(r.fullRate)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-v2-text">{r.staff}</td>
                      <td className="py-1.5">
                        <Actions onEdit={() => setEdit({ kind: "degrees-manager", row: r })} onDel={() => setDel({ kind: "degrees-manager", row: r })} />
                      </td>
                    </tr>
                  ))}
                  {!d.managers.length && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-v2-text-3">{t("Lavozim qo'shilmagan")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1 text-v2-small text-v2-text-2">{d.unassigned.moderators ? t("{n} moderatorda lavozim tanlanmagan", { n: d.unassigned.moderators }) : ""}</span>
              <button type="button" onClick={() => setEdit({ kind: "degrees-manager" })} className={secondaryBtn}>
                <Plus className="size-4" aria-hidden /> {t("Lavozim qo'shish")}
              </button>
            </div>
          </section>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
            <div className="mb-2 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-warning-bg text-v2-warning">
                <GraduationCap className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-v2-text">
                  {t("O'qituvchi lavozimlari")} · {d.teachers.length}
                </h2>
                <p className="text-v2-small text-v2-text-2">{t("Faqat bir stavka")}</p>
              </div>
            </div>
            <ul className="divide-y divide-v2-border">
              {d.teachers.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5 text-v2-small">
                  <span className="min-w-0 flex-1 font-semibold text-v2-text">{r.name}</span>
                  <span className="text-v2-text-2">{t("{n} ustoz", { n: r.staff })}</span>
                  <span className="w-28 text-right tabular-nums text-v2-text">{t("{s} so'm", { s: money(r.fullRate) })}</span>
                  <Actions onEdit={() => setEdit({ kind: "degrees-teacher", row: r })} onDel={() => setDel({ kind: "degrees-teacher", row: r })} />
                </li>
              ))}
              {!d.teachers.length && <li className="py-6 text-center text-v2-small text-v2-text-3">{t("Lavozim qo'shilmagan")}</li>}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1 text-v2-small text-v2-text-2">
                {t("Ustozning asosiy oyligi (foiz yoki oklad) —")}{" "}
                <Link href="/settings-payroll" className="font-semibold text-v2-brand">
                  {t("Oylik va soliq")}
                </Link>
              </span>
              <button type="button" onClick={() => setEdit({ kind: "degrees-teacher" })} className={secondaryBtn}>
                <Plus className="size-4" aria-hidden /> {t("Lavozim qo'shish")}
              </button>
            </div>
          </section>
        </div>
        <div className="space-y-4">
          {ex && (
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
              <h2 className="font-semibold text-v2-text">{t("Misol: {name}", { name: ex.name })}</h2>
              <div className="mt-2 divide-y divide-v2-border text-v2-small">
                {[
                  [t("Lavozim"), ex.degree],
                  [t("Stavka"), t(ex.rate)],
                  [t("Stavka summasi"), fmtNum(ex.rateSum)],
                  [t("Kartadagi oklad"), fmtNum(ex.cardOklad)],
                ].map(([a, b]) => (
                  <div key={a} className="flex justify-between gap-3 py-2">
                    <span className="text-v2-text-2">{a}</span>
                    <span className="font-semibold tabular-nums text-v2-text">{b}</span>
                  </div>
                ))}
              </div>
              {ex.rateSum !== ex.cardOklad && <p className="mt-2 text-v2-caption text-v2-warning">{t("Kartadagi oklad stavkadan farq qiladi — oylik kartadagi summa bilan hisoblanadi.")}</p>}
            </section>
          )}
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Qanday ishlaydi")}</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-v2-small text-v2-text-2">
              <li>{t("Xodim kartasida lavozim va bandlik (yarim / bir stavka) tanlanadi.")}</li>
              <li>{t("Oklad hozircha kartada filial bo'yicha kiritiladi — stavka yo'l-yo'riq bo'lib turadi.")}</li>
              <li>{t("Stavka o'zgarsa, chiqarilgan oyliklar o'zgarmaydi.")}</li>
            </ol>
            <div className="mt-3 flex gap-2 rounded-v2-md bg-v2-surface-2 p-3 text-v2-small text-v2-text-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("Okladni stavkadan avtomatik olish — rahbar qarori bilan.")}
            </div>
            <Link href="/management-xodimlar" className="mt-2 inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
              {t("Xodimlar")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>
        </div>
      </div>
      {edit && (
        <ListItemDialogV2
          kind={edit.kind}
          id={edit.row?.id}
          title={edit.row ? t("Lavozimni tahrirlash") : t("Lavozim qo'shish")}
          subtitle={edit.kind === "degrees-manager" ? t("Xodim lavozimi") : t("O'qituvchi lavozimi")}
          fields={fields(edit.kind)}
          initial={{ name: edit.row?.name ?? "", halfRate: edit.row?.halfRate ? String(edit.row.halfRate) : "", fullRate: edit.row?.fullRate ? String(edit.row.fullRate) : "" }}
          onClose={() => setEdit(null)}
          onDone={reload}
        />
      )}
      {del && <V2Confirm title={t("Lavozimni o'chirasizmi?")} body={t("«{n}» ro'yxatdan olib tashlanadi. Kartasida shu lavozim tanlangan xodimlarda yozuv o'zgarmaydi.", { n: del.row.name })} confirmLabel={t("O'chirish")} onConfirm={() => void remove(del.kind, del.row)} onCancel={() => setDel(null)} />}
    </div>
  );
}
