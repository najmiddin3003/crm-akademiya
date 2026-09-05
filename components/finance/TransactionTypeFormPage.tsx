"use client";

import { invalidateTransactionTypes } from "@/hooks/useTransactionTypes";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import MoneyInput from "@/components/ui/MoneyInput";
import { CUSTOMER_TYPES, CATEGORY_OPTIONS } from "@/constants/transactionTypes";
import type { TransactionType } from "@/lib/transactionTypes";

const chipCls = (active: boolean) =>
  `h-9 px-4 rounded-lg text-[13px] font-medium border ${active ? "bg-primary text-white border-primary" : "border-border text-foreground hover:bg-secondary"}`;

/** "Mijoz" katakchasi — belgilangani chip bo'lib emas, GALOCHKA bilan ko'rinadi. */
const checkCls = (active: boolean) =>
  `h-9 pl-2.5 pr-3.5 rounded-lg text-[13px] font-medium border inline-flex items-center gap-2 ${
    active ? "border-primary bg-primary/10 text-foreground" : "border-border text-foreground hover:bg-secondary"
  }`;

// Moliya → Tranzaksiya turi → "Qo'shish"/tahrirlash (skrinshot 2). `typeId`
// berilsa — mavjud turni tahrirlaydi (PATCH), aks holda yangi yaratadi
// (POST) — yangisi ro'yxat sahifasida faol bo'lgan tab (?type=) ostida
// ko'rinadi.
//
// ILGARI: "Ism" maydoni yonida rang tanlagich turardi — tanlangan rang
// hech qayerga yuborilmasdi (`TransactionType` da `color` maydoni yo'q,
// POST/PATCH route'lari ham uni qabul qilmaydi) va ro'yxat sahifasi ham
// rangni ko'rsatmasdi. Ya'ni foydalanuvchi rang tanlab "Saqlash" bosardi,
// keyin qaytib kelganda tanlovi yo'qolgan bo'lardi. Bunday boshqaruv
// yolg'on — shuning uchun olib tashlandi (rang kerak bo'lsa avval
// schema'ga `color` maydonini qo'shish kerak).
export default function TransactionTypeFormPage({ typeId }: { typeId?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useToast();

  const [loaded, setLoaded] = useState(typeId == null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  // KO'P TANLOVLI. Sukut — BO'SH: yangi turda hech narsa belgilanmagan
  // bo'ladi va kassa oynasi tanlovni tur nomiga qarab chiqaradi
  // (lib/txTarget.ts). Ilgari bu yerda "Boshqa" oldindan tanlangan turardi
  // va admin maydonga tegmasa tur jimgina "hech kim" bo'lib qolardi.
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [mainType, setMainType] = useState(searchParams.get("type") || "kirim");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeId == null) return;
    let cancelled = false;
    fetch("/api/transaction-types")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const found = (d.types as TransactionType[]).find((t) => t.id === typeId);
        if (!found) { setNotFound(true); setLoaded(true); return; }
        setName(found.name);
        setMinAmount(found.minAmount ? String(found.minAmount) : "");
        setMaxAmount(found.maxAmount ? String(found.maxAmount) : "");
        // Eski yozuvlarda `customerType` — bitta SATR. Bir elementli
        // ro'yxatga keltiriladi, ya'ni forma ikkala shaklni ham ochadi
        // va birinchi saqlashda yozuv yangi shaklga o'tadi.
        setCustomerTypes(
          Array.isArray(found.customerType)
            ? found.customerType
            : (found.customerType ? [found.customerType] : []),
        );
        setCategory(found.category);
        setMainType(found.mainType);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [typeId]);

  function toggleCustomerType(c: string) {
    setCustomerTypes((prev) =>
      prev.includes(c)
        ? prev.filter((x) => x !== c)
        // Tartib CUSTOMER_TYPES bo'yicha saqlanadi — bir xil tanlov har doim
        // bir xil ko'rinsin (server ham shunday tozalaydi).
        : CUSTOMER_TYPES.filter((x: string) => x === c || prev.includes(x)),
    );
  }

  const hasStudent = customerTypes.includes("O'quvchilar");
  const hasEmployee = customerTypes.includes("Xodim");
  const hasThird = customerTypes.includes("Uchinchi shaxs");

  /** Kassa oynasida nima chiqishini odam tilida aytadi. */
  const audienceHint = (() => {
    const parts: string[] = [];
    if (hasStudent) parts.push("«O'quvchini tanlang»");
    // Kirim oynasida xodim tanlovi O'QITUVCHILAR ro'yxati bilan
    // to'ldiriladi (foizli oylik shu ism bo'yicha hisoblanadi), chiqimda
    // esa butun xodimlar ro'yxati. Yorliq shu bois turlicha.
    if (hasEmployee) parts.push(mainType === "kirim" ? "«O'qituvchini tanlang»" : "«Xodimni tanlang»");
    if (hasThird) parts.push("(Qiymat + Oy) qatorlari");
    if (parts.length > 0) return `Kassa oynasida chiqadi: ${parts.join(" · ")}.`;
    if (customerTypes.length === 0) {
      return "Belgilanmagan — kassa oynasida tanlov tur NOMIGA qarab chiqadi (ichida «o'quvchi» yoki «xodim» so'zi bo'lsa).";
    }
    return "Kassa oynasida hech qanday tanlov chiqmaydi — pul odamga biriktirilmaydi.";
  })();

  /**
   * Eng qimmat xato uchun ogohlantirish.
   *
   * "Xodim" belgilanmagan kirim turida O'QITUVCHI tanlovi chiqmaydi, ya'ni
   * yozuvda `teacherName` bo'sh qoladi. Foizli oylik aynan shu maydon
   * bo'yicha hisoblanadi (lib/payrollSources.ts) — ya'ni pul kassaga
   * kiradi, lekin o'qituvchining oyligiga qo'shilmaydi. Bu jimgina yuz
   * beradi va faqat oy oxirida ma'lum bo'ladi.
   */
  const teacherWarning =
    mainType === "kirim" && customerTypes.length > 0 && !hasEmployee
      ? "«Xodim» belgilanmagan — bu turdagi to'lovda o'qituvchi tanlanmaydi va uning foizli oyligiga qo'shilmaydi."
      : "";

  async function save() {
    if (!name.trim()) {
      showError("Ismni kiriting");
      return;
    }
    setSaving(true);
    const url = typeId != null ? `/api/transaction-types/${typeId}` : "/api/transaction-types";
    const method = typeId != null ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          minAmount: minAmount ? Number(minAmount) : 0,
          maxAmount: maxAmount ? Number(maxAmount) : 0,
          customerType: customerTypes,
          category,
          mainType,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      // Kesh bekor qilinadi: keyin mount bo'ladigan iste'molchilar
      // yangi ro'yxatni oladi (lib/referenceCache.ts).
      invalidateTransactionTypes();
      showSuccess(typeId != null ? "Tranzaksiya turi yangilandi" : "Tranzaksiya turi qo'shildi");
      router.push("/finance-tx-types");
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  if (typeId != null && !loaded) {
    return <div className="container mx-auto max-w-[1600px] p-4 md:p-5"><SpinnerBlock /></div>;
  }
  if (notFound) {
    return <div className="container mx-auto max-w-[1600px] p-4 md:p-5 text-sm text-muted-foreground">Tranzaksiya turi topilmadi.</div>;
  }

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
      <div className="rounded-xl border border-border bg-card p-6 space-y-6 max-w-2xl">
        <h1 className="text-[16px] font-semibold">{typeId != null ? "Tahrirlash" : "Qo'shish"}</h1>

        <div>
          <label className="block text-[13px] font-medium mb-1.5">Ism</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            className="w-full h-11 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Minimal miqdor</label>
            <MoneyInput
              value={minAmount}
              onChange={setMinAmount}
              className="w-full h-11 rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Maksimal miqdor</label>
            <MoneyInput
              value={maxAmount}
              onChange={setMaxAmount}
              className="w-full h-11 rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* MIJOZ — ko'p tanlovli. Aynan shu belgilar kassa oynasida qaysi
            tanlov chiqishini hal qiladi (lib/txTarget.ts → txAudience).
            Pastdagi izoh natijani JONLI ko'rsatadi: bu maydonning ta'siri
            boshqa sahifada ko'rinadi, ya'ni sinab ko'rish uchun kassaga
            borib qaytishga to'g'ri kelardi. */}
        <div>
          <label className="block text-[13px] font-medium mb-2">Mijoz</label>
          <div className="flex items-center gap-2 flex-wrap">
            {CUSTOMER_TYPES.map((c) => {
              const on = customerTypes.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleCustomerType(c)}
                  className={checkCls(on)}
                >
                  <span
                    aria-hidden
                    className={`h-4 w-4 shrink-0 rounded-[4px] border inline-flex items-center justify-center ${
                      on ? "bg-primary border-primary text-white" : "border-border bg-card"
                    }`}
                  >
                    {on && <Check className="w-3 h-3" strokeWidth={3} />}
                  </span>
                  {c}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">{audienceHint}</p>
          {teacherWarning && (
            <p className="mt-1 text-[12px] text-amber-600">{teacherWarning}</p>
          )}
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-2">Kategoriyasi</label>
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORY_OPTIONS.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={chipCls(category === c)}>{c}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/finance-tx-types")} disabled={saving} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
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
