"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox, type CashboxName } from "@/lib/cashboxes";
import { invalidateTransactions } from "@/lib/cacheKeys";
import { useT } from "@/components/shared/Language";

// BOSHQA KASSAGA KO'CHIRISH — ma'lumot va mantiq, ESKI oyna
// (./CashboxTransferToDrawer.tsx) va YANGI versiya «Kassa amali → Ko'chirish»
// (components/v2/finance/CashOperationModalV2.tsx) uchun BITTA manba.
// 19.10.2026 da eski oynadan izohlari bilan AYNAN ko'chirildi: manzil
// ro'yxati (?names=1), «mavjud = qoldiq − tasdiq kutayotgan», tekshiruvlar va
// so'rov tanasi o'zgarmadi. Muvaffaqiyatdan keyingi ish chaqiruvchida —
// `onSuccess` ("Ko'chirildi" DEB BO'LMAYDI: pul qabul qiluvchi ✓ bosgunicha
// shu kassada turadi — toast «jo'natildi, tasdiq kutilmoqda»).

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
export function useTransferToForm({
  cashbox,
  onSuccess,
}: {
  cashbox: Cashbox;
  onSuccess: (data: { from: Cashbox; to: Cashbox }) => void;
}) {
  const { t } = useT();
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan (faqat faollari).
  const { active: paymentMethods, loading: loadingMethods } = usePaymentMethods();
  const { showError } = useToast();
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
      onSuccess({ from: data.from as Cashbox, to: data.to as Cashbox });
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return {
    t,
    paymentMethods,
    loadingMethods,
    showError,
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
    setSaving,
    allNames,
    setAllNames,
    cashboxesLoading,
    setCashboxesLoading,
    destinations,
    availableOf,
    methodOptions,
    available,
    held,
    save,
  };
}

export type TransferToFormState = ReturnType<typeof useTransferToForm>;
