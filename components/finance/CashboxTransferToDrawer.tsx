"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import DatePicker from "@/components/ui/DatePicker";
import MoneyInput from "@/components/ui/MoneyInput";
import Select from "@/components/ui/Select";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox, type CashboxName } from "@/lib/cashboxes";
import { invalidateTransactions } from "@/lib/cacheKeys";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

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
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan (faqat faollari).
  const { active: paymentMethods, loading: loadingMethods } = usePaymentMethods();
  const { showSuccess, showError } = useToast();
  const [toCashboxId, setToCashboxId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Manzil kassalari — TIZIMDAGI hammasi, nomlari bilan.
  //
  // `GET /api/cashboxes` endi xodimga biriktirilganini qaytaradi, ya'ni
  // sahifadagi ro'yxatdan manzil olinsa kassirda bitta ham manzil
  // qolmasdi va ko'chirish umuman ishlamay qolardi. `?names=1` esa faqat
  // id va nomni beradi — boshqa odamning puli oshkor bo'lmaydi.
  const [allNames, setAllNames] = useState<CashboxName[]>([]);
  // Bu ro'yxat hooksiz, xom `fetch` bilan olinadi — demak "keldimi?"
  // bayrog'ini ham shu yerda yuritamiz. Boshlang'ich qiymat `true`:
  // birinchi chizilishda ro'yxat aniq bo'sh, lekin so'rov hali yo'lda.
  const [cashboxesLoading, setCashboxesLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/cashboxes?names=1")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setAllNames(d.cashboxes as CashboxName[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCashboxesLoading(false); });
    return () => { cancelled = true; };
  }, []);
  // Manzil ro'yxatida TIZIMDAGI hamma kassa turadi — o'zidan boshqasi.
  //
  // NIMA NOTO'G'RI EDI: arxivdagilar chiqarib tashlanardi. Bazadagi uchta
  // kassadan ikkitasi arxivda, ya'ni ro'yxat bo'shab qolib "Boshqa kassa
  // yo'q" deb turardi — ko'chirishning umuman iloji yo'q edi.
  //
  // Server arxivdagi kassaga ko'chirishni TAQIQLAMAYDI (transfer-to/route.ts
  // faqat kassa mavjudligini tekshiradi), shuning uchun uni interfeysda
  // to'sib qo'yish sun'iy cheklov edi. Arxivdagilar yonida shu haqda
  // eslatma turadi — foydalanuvchi bilib tanlasin.
  const destinations = allNames.filter((c) => c.id !== cashbox.id);

  // MAVJUD MABLAG' = qoldiq − TASDIQ KUTAYOTGAN summa.
  //
  // Jo'natilgan pul qabul qiluvchi ✓ bosgunicha shu kassada TURAVERADI
  // (transfer-to/route.ts). Ya'ni `methodTotals` ning bir qismi allaqachon
  // va'da qilingan bo'lishi mumkin va uni ikkinchi marta jo'natib
  // bo'lmaydi — server ham shu hisobga qarab 400 beradi.
  const availableOf = useCallback(
    (key: string) => (cashbox.methodTotals[key] ?? 0) - (cashbox.pendingOut?.[key] ?? 0),
    [cashbox.methodTotals, cashbox.pendingOut],
  );

  // To'lov turlari ro'yxatida faqat SHU KASSADA mavjud puli borlari turadi
  // va har birining yonida qoldig'i ko'rinadi. Nol qoldiqli turdan
  // ko'chirib bo'lmaydi (server ham 400 beradi), shu bois ro'yxatda ham
  // turmaydi: kassir tanlab ko'rib, keyin xato eshitmasin.
  const methodOptions = useMemo(
    () =>
      paymentMethods
        .filter((m) => availableOf(m.key) > 0)
        .map((m) => ({
          value: m.key,
          label: m.name,
          // FAQAT summa. Ilgari bu yerga "(… tasdiq kutmoqda)" ham
          // qo'shilgan edi va uzun matn to'lov turining nomini "N.."
          // holiga siqib qo'yardi (Select'da `hint` — `shrink-0`).
          // Eslatma pastda, ro'yxatdan tashqarida turadi.
          hint: fmtSum(availableOf(m.key)),
        })),
    [paymentMethods, availableOf],
  );

  /** Tanlangan turdagi mavjud mablag' — yuborishdan oldin tekshirish uchun. */
  const available = method ? availableOf(method) : null;
  /** Tanlangan turda tasdiq kutayotgan summa — pastdagi eslatma uchun. */
  const held = method ? cashbox.pendingOut?.[method] ?? 0 : 0;

  async function save() {
    if (!toCashboxId) {
      showError(t("Moliya bo'limini tanlang"));
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      showError(t("Qiymatni to'g'ri kiriting"));
      return;
    }
    if (!method) {
      showError(t("To'lov turini tanlang"));
      return;
    }
    // Mavjuddan ko'p summa serverda ham rad etiladi; bu yerda tekshirilishi
    // shunchaki javobni kutmaslik uchun.
    if (available !== null && amountNum > available) {
      showError(t("Mablag' yetarli emas — mavjud {available}", { available: fmtSum(available) }));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cashboxes/${cashbox.id}/transfer-to`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toCashboxId: Number(toCashboxId),
          method,
          amount: amountNum,
          date: date ? toIso(date) : undefined,
          note,
        }),
      });
      const data = await res.json();
      invalidateTransactions(); // yangi tranzaksiya yozildi -> kesh bekor
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved({ from: data.from as Cashbox, to: data.to as Cashbox });
      // "Ko'chirildi" DEB BO'LMAYDI: pul hali hech qayerga ketgani yo'q,
      // u qabul qiluvchi ✓ bosgunicha shu kassada turadi.
      showSuccess(t("Ko'chirma jo'natildi — tasdiq kutilmoqda"));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

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
