"use client";

import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import DatePicker from "@/components/ui/DatePicker";
import MoneyInput from "@/components/ui/MoneyInput";
import Select from "@/components/ui/Select";
import { type Cashbox } from "@/lib/cashboxes";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { useTransferToForm } from "./useTransferToForm";

function fmtSum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU") + " so'm";
}

// Kassalar sahifasidagi asosiy kassa kartochkasining "Ko'chirish" tugmasi —
// referens saytdagi oyna: "Moliya bo'limi" (boshqa kassa) + Qiymat + To'lov
// turi + Sana + Izoh. Metod kartochkasidagi "Ko'chirish"dan farqi — bu safar
// pul boshqa KASSAGA ko'chadi (ikkala kassaning balansi ham o'zgaradi),
// bitta kassa ichida to'lov turlari orasida emas (CashboxTransferDrawer'ga
// qarang).
export default function CashboxTransferToDrawer({
  cashbox,
  onClose,
  onSaved,
}: {
  cashbox: Cashbox;
  onClose: () => void;
  onSaved: (updated: { from: Cashbox; to: Cashbox }) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "drawer");
  const { showSuccess } = useToast();
  // Mantiq va so'rov — yangi versiya «Kassa amali» bilan BITTA manba
  // (./useTransferToForm.ts, 19.10.2026 da shu fayldan aynan ko'chirildi).
  const {
    loadingMethods,
    toCashboxId,
    setToCashboxId,
    amount,
    setAmount,
    method,
    setMethod,
    date,
    setDate,
    note,
    setNote,
    saving,
    cashboxesLoading,
    destinations,
    methodOptions,
    held,
    save,
  } = useTransferToForm({
    cashbox,
    onSuccess: (updated) => {
      onSaved(updated);
      // "Ko'chirildi" DEB BO'LMAYDI: pul hali hech qayerga ketgani yo'q,
      // u qabul qiluvchi ✓ bosgunicha shu kassada turadi.
      showSuccess(t("Ko'chirma jo'natildi — tasdiq kutilmoqda"));
      modal.close();
    },
  });

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="sm" zIndex={110}>
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">{t("Ko'chirish")}</h3>
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Moliya bo'limi")}</label>
            {/* Manzil kassalari — faqat NOMLARI. Balans ataylab yozilmaydi:
                bu boshqa odamning kassasi, uning puli bu yerda ko'rinmasin.

                Ro'yxat kelmaguncha "Boshqa kassa yo'q" deb yozib bo'lmaydi —
                bu yolg'on bo'lardi: hali hech narsa o'qilmagan, kassir esa
                buni "ko'chiradigan joy yo'q ekan" deb tushunardi. `loading`
                o'sha paytda o'zi "Yuklanmoqda…" yozadi. */}
            <Select
              value={toCashboxId}
              onChange={setToCashboxId}
              options={destinations.map((c) => ({
                value: String(c.id),
                label: c.name,
                hint: c.archived ? "arxivda" : undefined,
              }))}
              loading={cashboxesLoading}
              placeholder={destinations.length === 0 ? t("Boshqa kassa yo'q") : t("Tanlang")}
              disabled={destinations.length === 0}
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("To'lov turi")}</label>
            {/* Ro'yxat kelmaguncha "mablag' yo'q" deb yozib bo'lmaydi — bu
                yolg'on bo'lardi: hali hech narsa o'qilmagan. Ilgari shu
                shart qo'lda yozilgan edi; endi `loading` propining o'zi
                "Yuklanmoqda…" yozadi va tugmani bosdirmaydi. */}
            <Select
              value={method}
              onChange={setMethod}
              options={methodOptions}
              loading={loadingMethods}
              placeholder={methodOptions.length === 0 ? t("Kassada mablag' yo'q") : t("Tanlang")}
              disabled={methodOptions.length === 0}
            />
            {/* Ro'yxatdagi summa kartadagi balansdan KICHIK bo'lishi
                mumkin — farqni ochiq aytamiz, aks holda kassir buni xato
                deb o'ylardi. Tasdiq kutayotgan pul kassada turibdi,
                lekin uni ikkinchi marta jo'natib bo'lmaydi.

                Jumla BITTA ifodada yozilgan: bu loyihada JSX ifodadan
                keyingi bo'shliqni yeb qo'yadi ("so'mtasdiq" bo'lib
                chiqadi — kartadagi "3 000 000so'm" ham shundan). */}
            {held > 0 && (
              <p className="mt-1.5 text-[12px] text-amber-600">
                {t("{held} tasdiq kutmoqda — bu summani qayta jo'natib bo'lmaydi.", { held: fmtSum(held) })}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Sanani tanlang")}</label>
            <DatePicker value={date} onChange={setDate} className="w-full" />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Izoh")}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={modal.close} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            {t("Orqaga")}
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </Modal>
  );
}
