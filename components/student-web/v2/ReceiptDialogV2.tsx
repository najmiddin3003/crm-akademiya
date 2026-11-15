"use client";

import { useState, useSyncExternalStore } from "react";
import { ImageDown, Loader2, Printer, X } from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { CENTER_LOGO } from "@/lib/center";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import type { CabinetPayment, StudentCabinet } from "@/lib/studentCabinetTypes";
import { fmtSom, useCabinetFmt } from "./bits";
import { printStudentReceipt, saveReceiptImage, type StudentReceiptModel } from "./receiptPrint";

// O'QUVCHI KABINETI (v2) — TO'LOV CHEKI OYNASI. To'lov tarixidagi «Chek» tugmasi
// ochadi: chek ko'rinishi (v2 tokenlarida, tungi rejimga mos) va ikki amal —
// «Rasm sifatida saqlash» (PNG) va «Chop etish / PDF» (brauzer bosma oynasi).
// Qobiq — ui/Modal (portal, Esc steki, animatsiya); ichki blok `data-ui="v2"`,
// telefonda pastdan chiqadi (components/v2/form/V2Dialog bilan bir xil).

const subscribeNoop = () => () => {};
/** Telegram Mini App ichidami (bosma u yerda ko'pincha ishlamaydi). */
function inTelegram(): boolean {
  const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
  return !!w.Telegram?.WebApp?.initData;
}

function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** Ko'rinish, bosma va rasm uchun bitta model (joriy tilda). */
export function useReceiptModel(payment: CabinetPayment, cab: StudentCabinet, studentName: string): StudentReceiptModel {
  const { t } = useT();
  const f = useCabinetFmt();
  const { profile, branch } = cab.receipt;
  const som = (n: number) => `${fmtSom(n)} ${t("so'm")}`;
  const [py] = payment.periodMonth.split("-");
  const rows: [string, string][] = [
    [t("Chek №"), String(payment.id)],
    [t("Sana"), payment.time ? `${dmy(payment.date)} | ${payment.time}` : dmy(payment.date)],
    [t("O'quvchi"), studentName || "—"],
    [t("Kassa"), payment.cashbox || "—"],
    [t("To'lov turi"), t(payment.paymentType) || "—"],
    [t("Qaysi oy uchun"), `${f.monthName(payment.periodMonth)} ${py ?? ""}`.trim()],
  ];
  if (payment.discount > 0) rows.push([t("Chegirma (tanga)"), som(payment.discount)]);
  return {
    logo: profile.showLogo && CENTER_LOGO ? CENTER_LOGO : null,
    brand: profile.title,
    branchLines: [branch.address, branch.phone].filter((x): x is string => !!x && !!x.trim()),
    heading: payment.refund ? t("QAYTARISH CHEKI") : t("TO'LOV CHEKI"),
    stamp: payment.cancelled ? t("BEKOR QILINGAN") : null,
    rows,
    totalLabel: payment.refund ? t("Qaytarildi") : t("Jami"),
    total: som(Math.abs(payment.amount)),
    footer: profile.footer,
    docTitle: t("Chek #{id}", { id: payment.id }),
    fileName: `chek-${payment.id}.png`,
  };
}

export default function ReceiptDialogV2({
  payment,
  cab,
  studentName,
  onClose,
}: {
  payment: CabinetPayment;
  cab: StudentCabinet;
  studentName: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const m = useReceiptModel(payment, cab, studentName);
  const tg = useSyncExternalStore(subscribeNoop, inTelegram, () => false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onSaveImage() {
    if (saving) return;
    setSaving(true);
    setNote(null);
    const r = await saveReceiptImage(m).catch(() => "failed" as const);
    setSaving(false);
    if (r === "failed") setNote(t("Rasmni saqlab bo'lmadi — ekran rasmini oling."));
    else if (r === "downloaded" && tg) setNote(t("Fayl yuklanmagan bo'lsa — ekran rasmini oling."));
  }

  const printButton = (
    <button type="button" onClick={() => printStudentReceipt(m)} className={`${tg ? secondaryBtn : primaryBtn} justify-center`}>
      <Printer className="size-4" strokeWidth={1.75} aria-hidden />
      {t("Chop etish / PDF")}
    </button>
  );
  const saveButton = (
    <button
      type="button"
      onClick={onSaveImage}
      disabled={saving}
      aria-busy={saving}
      className={`${tg ? primaryBtn : secondaryBtn} justify-center disabled:opacity-60`}
    >
      {saving ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden /> : <ImageDown className="size-4" strokeWidth={1.75} aria-hidden />}
      {t("Rasm sifatida saqlash")}
    </button>
  );

  return (
    <Modal
      onClose={onClose}
      controller={modal}
      bare
      size="7xl"
      zIndex={120}
      containerClassName="max-sm:items-end max-sm:p-0"
      panelStyle={{ maxWidth: 400 }}
      panelClassName="bg-transparent! border-0! shadow-none! rounded-none! overflow-hidden max-sm:max-w-none! max-sm:max-h-[92dvh]!"
    >
      <div
        data-ui="v2"
        role="document"
        className="flex max-h-[90vh] min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface font-v2 text-v2-text shadow-v2-md max-sm:max-h-[92dvh] max-sm:rounded-b-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-4">
          <h2 className="text-v2-section text-v2-text">{m.docTitle}</h2>
          <button
            type="button"
            onClick={modal.close}
            aria-label={t("Yopish")}
            title={t("Yopish")}
            className="-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-hover hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-v2-bg px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-[320px] rounded-v2-md border border-v2-border bg-v2-surface px-5 py-5 shadow-v2-sm">
            {m.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- chek: oddiy rasm, optimizatsiya kerak emas
              <img src={m.logo} alt="" className="mx-auto mb-1.5 h-9 w-auto max-w-[70%] object-contain brightness-0 dark:invert" />
            ) : null}
            <div className="text-center text-v2-body font-bold tracking-wide">{m.brand}</div>
            {m.branchLines.map((l) => (
              <div key={l} className="mt-0.5 text-center text-v2-caption text-v2-text-3">
                {l}
              </div>
            ))}
            <div className="mt-3 text-center text-v2-body font-bold tracking-wide">{m.heading}</div>
            {m.stamp ? (
              <div className="mx-auto mt-2 w-fit rounded-v2-sm border-[1.5px] border-v2-danger px-2.5 py-0.5 text-v2-caption font-bold tracking-wider text-v2-danger">
                {m.stamp}
              </div>
            ) : null}
            <div className="my-3 border-t border-dashed border-v2-border-strong" />
            <dl className="space-y-1.5 text-v2-small">
              {m.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-v2-text-3">{k}</dt>
                  <dd className="break-words text-right font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="my-3 border-t border-dashed border-v2-border-strong" />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-v2-small italic text-v2-text-3">{m.totalLabel}</span>
              <span className={`text-lg font-bold tabular-nums ${payment.cancelled ? "text-v2-text-3 line-through" : ""}`}>{m.total}</span>
            </div>
            {m.footer ? (
              <>
                <div className="my-3 border-t border-dashed border-v2-border-strong" />
                <div className="text-center text-v2-caption italic text-v2-text-3">{m.footer}</div>
              </>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-v2-border bg-v2-surface-2 px-5 py-3">
          {tg || note ? (
            <p className="mb-2 text-v2-caption text-v2-text-3" role={note ? "status" : undefined}>
              {note ?? t("Telegram ichida chop etish ishlamasligi mumkin — chekni rasm qilib saqlang.")}
            </p>
          ) : null}
          {/* Asosiy amal o'ngda (telefonda tepada): Telegram'da — rasm, boshqa joyda — bosma. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {tg ? (
              <>
                {printButton}
                {saveButton}
              </>
            ) : (
              <>
                {saveButton}
                {printButton}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
