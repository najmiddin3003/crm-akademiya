"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import DatePicker from "@/components/ui/DatePicker";
import MoneyInput from "@/components/ui/MoneyInput";
import Select from "@/components/ui/Select";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox, type CashboxName } from "@/lib/cashboxes";
import { invalidateTransactions } from "@/lib/cacheKeys";

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
  useEscapeClose(onClose);
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
  useEffect(() => {
    let cancelled = false;
    fetch("/api/cashboxes?names=1")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setAllNames(d.cashboxes as CashboxName[]); })
      .catch(() => {});
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

  // To'lov turlari ro'yxatida faqat SHU KASSADA puli borlari turadi va har
  // birining yonida qoldig'i ko'rinadi. Nol qoldiqli turdan ko'chirib
  // bo'lmaydi (server ham 400 beradi — transfer-to/route.ts), shu bois
  // ro'yxatda ham turmaydi: kassir tanlab ko'rib, keyin xato eshitmasin.
  const methodOptions = useMemo(
    () =>
      paymentMethods
        .filter((m) => (cashbox.methodTotals[m.key] ?? 0) > 0)
        .map((m) => ({
          value: m.key,
          label: m.name,
          hint: fmtSum(cashbox.methodTotals[m.key] ?? 0),
        })),
    [paymentMethods, cashbox.methodTotals],
  );

  /** Tanlangan turdagi qoldiq — summani yuborishdan oldin tekshirish uchun. */
  const available = method ? cashbox.methodTotals[method] ?? 0 : null;

  async function save() {
    if (!toCashboxId) {
      showError("Moliya bo'limini tanlang");
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      showError("Qiymatni to'g'ri kiriting");
      return;
    }
    if (!method) {
      showError("To'lov turini tanlang");
      return;
    }
    // Qoldiqdan ko'p summa serverda ham rad etiladi; bu yerda tekshirilishi
    // shunchaki javobni kutmaslik uchun.
    if (available !== null && amountNum > available) {
      showError(`Mablag' yetarli emas — qoldiq ${fmtSum(available)}`);
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
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved({ from: data.from as Cashbox, to: data.to as Cashbox });
      showSuccess("Pul ko'chirildi");
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">Ko&apos;chirish</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Moliya bo&apos;limi</label>
            {/* Manzil kassalari — faqat NOMLARI. Balans ataylab yozilmaydi:
                bu boshqa odamning kassasi, uning puli bu yerda ko'rinmasin. */}
            <Select
              value={toCashboxId}
              onChange={setToCashboxId}
              options={destinations.map((c) => ({
                value: String(c.id),
                label: c.name,
                hint: c.archived ? "arxivda" : undefined,
              }))}
              placeholder={destinations.length === 0 ? "Boshqa kassa yo'q" : "Tanlang"}
              disabled={destinations.length === 0}
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Qiymat</label>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">To&apos;lov turi</label>
            <Select
              value={method}
              onChange={setMethod}
              options={methodOptions}
              placeholder={
                // Ro'yxat kelmaguncha "mablag' yo'q" deb yozib bo'lmaydi —
                // bu yolg'on bo'lardi: hali hech narsa o'qilmagan.
                loadingMethods
                  ? "Yuklanmoqda…"
                  : methodOptions.length === 0
                    ? "Kassada mablag' yo'q"
                    : "Tanlang"
              }
              disabled={loadingMethods || methodOptions.length === 0}
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Sanani tanlang</label>
            <DatePicker value={date} onChange={setDate} className="w-full" />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Izoh</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            Orqaga
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
