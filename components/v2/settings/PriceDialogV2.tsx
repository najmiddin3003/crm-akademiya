"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, History, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { FieldError, FieldLabel, MoneyField } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { priceImpact, type PriceRow } from "@/lib/categoryPrices";
import { MIN_MONTHLY_PRICE } from "@/lib/coursePrice";

// YANGI VERSIYA — «NARXNI O'ZGARTIRISH» (24-qism, rasm «Sozlamalar · Narxni o'zgartirish»).
//
// Rasmdagi «Faqat yangi guruhlarga» varianti O'CHIQ: narx guruhda emas, kurs darajasida
// saqlanadi va guruh har oy shu narxdan hisoblanadi — narx o'zgarsa barcha guruhlarga
// darhol o'tadi. Narx TARIXI yo'q: Qarzdorlar hisoboti o'tgan oylarni ham yangi narxdan
// sanaydi — rasmdagi «O'tgan oylar qarzi o'zgarmaydi» o'rniga halol ogohlantirish
// (design/v2/SAVOLLAR.md 271). Yozish — POST /api/course-categories/price (faqat admin).

export function money(n: number): string {
  return Math.round(n).toLocaleString("ru-RU").replace(/\s/g, " ");
}

export default function PriceDialogV2({
  category,
  row,
  levelLabel,
  multiBranch,
  onClose,
  onSaved,
}: {
  category: string;
  row: PriceRow;
  levelLabel: string;
  /** Hovuzdagi filiallar (1+2 Chortoq) — narx ikkalasiga yoziladi. */
  multiBranch: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "center");
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const next = Number(value) || 0;
  const valid = next >= MIN_MONTHLY_PRICE && next !== row.price;
  const impact = valid ? priceImpact(row, row.price, next) : 0;

  async function submit() {
    if (next < MIN_MONTHLY_PRICE) return setErr(t("Oylik narx 50 000 so'mdan kam bo'lmasin"));
    if (next === row.price) return setErr(t("Yangi narx hozirgisidan farq qilsin"));
    setErr("");
    setSaving(true);
    try {
      const res = await fetch("/api/course-categories/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, level: row.level, oldPrice: row.price, price: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setErr(t(d.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(t("Narx yangilandi: {sum} so'm", { sum: money(next) }));
      setSaving(false);
      modal.close();
    } catch {
      setErr(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  const courseLine = row.courses
    .filter((c) => c.students > 0 || c.groups > 0)
    .map((c) => t("{course} — {n} o'quvchi", { course: c.name, n: c.students }))
    .join(", ");

  return (
    <V2Dialog
      title={row.price === null ? t("Narx kiritish") : t("Narxni o'zgartirish")}
      subtitle={`${category || t("Kategoriyasiz")} · ${levelLabel}`}
      onClose={onClose}
      controller={modal}
      dirty={Boolean(value)}
      saving={saving}
      onSubmit={() => void submit()}
      width={520}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void submit()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving ? <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
            {t("Narxni saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {/* Hozirgi → yangi */}
        <div className="grid grid-cols-1 items-end gap-2 min-[30rem]:grid-cols-[1fr_auto_1fr]">
          <div>
            <FieldLabel htmlFor="price-v2-old">{t("Hozirgi narx")}</FieldLabel>
            {row.price === null ? (
              <div className="flex h-9 items-center rounded-v2-md border border-dashed border-v2-border-strong bg-v2-surface-2 px-3 text-v2-body text-v2-text-3">{t("Kiritilmagan")}</div>
            ) : (
              <MoneyField id="price-v2-old" value={String(row.price)} onChange={() => {}} readOnly compact ariaLabel={t("Hozirgi narx")} />
            )}
          </div>
          <ArrowRight className="mx-auto mb-2.5 hidden size-4 text-v2-text-3 min-[30rem]:block" strokeWidth={1.75} aria-hidden />
          <div>
            <FieldLabel htmlFor="price-v2-new">{t("Yangi narx")}</FieldLabel>
            <MoneyField
              id="price-v2-new"
              value={value}
              onChange={(v) => {
                setValue(v.slice(0, 9));
                if (err) setErr("");
              }}
              state={err ? "error" : "default"}
              placeholder={row.price ? money(row.price) : "300 000"}
              autoFocus
              compact
              ariaLabel={t("Yangi narx")}
            />
          </div>
        </div>

        {/* Kimlarga qo'llanadi */}
        <div>
          <FieldLabel>{t("Kimlarga qo'llanadi")}</FieldLabel>
          <div className="grid grid-cols-1 gap-2 min-[30rem]:grid-cols-2">
            <div aria-disabled="true" className="flex gap-2.5 rounded-v2-md border border-v2-border bg-v2-surface-2 p-3 opacity-70">
              <span className="mt-0.5 size-4 shrink-0 rounded-full border border-v2-border-strong bg-v2-surface" aria-hidden />
              <div className="min-w-0">
                <div className="text-v2-small font-semibold text-v2-text-2">{t("Faqat yangi guruhlarga")}</div>
                <div className="mt-0.5 text-v2-caption text-v2-text-3">{t("Hozircha yo'q: narx guruhga emas, kurs darajasiga yozilgan")}</div>
              </div>
            </div>
            <div className="flex gap-2.5 rounded-v2-md border border-v2-brand bg-v2-brand-bg p-3">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-[5px] border-v2-brand bg-v2-surface" aria-hidden />
              <div className="min-w-0">
                <div className="text-v2-small font-semibold text-v2-text">{t("Mavjud guruhlarga ham")}</div>
                <div className="mt-0.5 text-v2-caption text-v2-text-2">
                  {t("{g} guruh · {s} o'quvchi · darhol", { g: row.groups, s: row.students })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ta'sir */}
        {valid && row.price !== null && row.students > 0 && (
          <div className="flex gap-2.5 rounded-v2-md bg-v2-info-bg px-3 py-2.5 text-v2-small text-v2-text">
            {impact >= 0 ? (
              <TrendingUp className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={2} aria-hidden />
            ) : (
              <TrendingDown className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={2} aria-hidden />
            )}
            <span>
              <b className="font-semibold">
                {t("Oylik tushumga ta'siri: taxminan {sum} so'm", { sum: `${impact >= 0 ? "+" : "−"}${money(Math.abs(impact))}` })}
              </b>{" "}
              <span className="text-v2-text-2">{t("(chegirmalarsiz)")}</span>
            </span>
          </div>
        )}
        <div className="flex gap-2.5 rounded-v2-md border border-v2-warning/30 bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
          <span>{t("Narx tarixi saqlanmaydi: Qarzdorlar hisoboti va o'quvchi qarzi o'tgan oylar uchun ham yangi narxdan qayta sanaladi.")}</span>
        </div>

        <div className="space-y-1 text-v2-caption text-v2-text-2">
          {courseLine && <p>{t("Shu narxda: {list}.", { list: courseLine })}</p>}
          {multiBranch && <p>{t("1+2 filiallarda narx bitta — ikkalasiga yoziladi.")}</p>}
          <p className="flex items-center gap-1.5">
            <History className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {row.price === null
              ? t("Amallar jurnaliga yoziladi.")
              : t("Amallar jurnaliga «{from} → {to}» bo'lib yoziladi.", { from: money(row.price), to: valid ? money(next) : "…" })}
          </p>
        </div>
        {err && <FieldError>{err}</FieldError>}
      </div>
    </V2Dialog>
  );
}
