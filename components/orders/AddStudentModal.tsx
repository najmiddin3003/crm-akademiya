"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import PanelSelect from "@/components/orders/PanelSelect";
import { usePupils } from "@/components/orders/PupilsContext";
import { useToast } from "@/components/ui/Toast";
import { useEduCategoryNames } from "@/hooks/useEduCategories";
import { SOURCE_OTHER, STUDENT_SOURCES } from "@/constants";
import type { Pupil } from "@/lib/pupilsData";
import DateField from "@/components/ui/DateField";
import Modal, { useModalClose } from "@/components/ui/Modal";

// "O'quvchi qo'shish" tugmasi bosilganda ochiladigan alohida modal — akademiya.edutizim.uz
// dagi "Yangi buyurtma" panelining o'zida joylashgan xuddi shu nomdagi tugma ortidan
// chiqqan referens skrinshotga mos. Bu modal AddOrderModal ustidan (undan yuqori
// z-index bilan) ochiladi, drawer esa orqada ochiq qoladi.
//
// "Saqlash" bosilganda POST /api/pupils orqali MongoDB'ga ("pupils" kolleksiyasi)
// haqiqiy saqlanadi — natijada qaytgan Pupil ota komponentga uzatiladi.

// +998 doim ko'rinib turadi va o'chirib bo'lmaydi (components/auth/PhoneField.tsx
// bilan bir xil g'oya — prefiks alohida <span>, inputning qiymati emas), lekin
// bu yerda ilovaning boshqa joylarida ishlatiladigan "94 408 57 97" formatida
// (bo'sh joy bilan ajratilgan) ko'rsatiladi, auth sahifalaridagi qavs-chizilgan
// "(94) 408-57-97" formatidan farqli o'laroq.
function formatLocalPhone(digits: string): string {
  const d = digits.slice(0, 9);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 7);
  const p4 = d.slice(7, 9);
  return [p1, p2, p3, p4].filter(Boolean).join(" ");
}

function PhoneInput({ label, value, onChange }: { label: string; value: string; onChange: (digits: string) => void }) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      <div className="auth-phone">
        <span className="auth-phone-prefix">+998</span>
        <input
          type="tel"
          inputMode="numeric"
          value={formatLocalPhone(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
          placeholder="94 408 57 97"
          className="auth-phone-input"
        />
      </div>
    </div>
  );
}

export interface AddStudentModalProps {
  onClose: () => void;
  onSave: (pupil: Pupil) => void;
}

export default function AddStudentModal({ onClose, onSave }: AddStudentModalProps) {
  const modal = useModalClose(onClose);
  // O'quvchi kategoriyalari — O'quv bo'limi → Kategoriya (`edu_categories`).
  const { names: categoryNames, loading: categoriesLoading } = useEduCategoryNames();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  // O'quvchi qayerdan keldi — MAJBURIY. Ro'yxat constants/index.js da
  // (Kategoriya bilan bir xil qolip: sozlanadigan CRUD ro'yxati emas).
  const [source, setSource] = useState("");
  // "Boshqa" tanlanganda ochiladigan qo'shimcha oyna: moderator manbani
  // o'z so'zi bilan yozadi.
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [extraPhone, setExtraPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { createPupil } = usePupils();
  const { showSuccess, showError } = useToast();

  const closeOther = useCallback(() => setOtherOpen(false), []);
  // Ichki oyna — alohida controller. Escape: ui/Modal ochiq modallar
  // stekini yuritadi va faqat ENG USTKI oynani yopadi, ya'ni ichki oyna
  // ochiq bo'lsa faqat u yopiladi (moderator manbani yozayotib butun
  // formani yo'qotmaydi).
  const otherModal = useModalClose(closeOther);

  /**
   * Manba tanlovlari BAZADAN — Sotuv va marketing → O'quvchilar oqimi
   * sahifasidagi "Manbalar ro'yxati" oynasidan boshqariladi.
   *
   * KONSTANTA ZAXIRA bo'lib qoladi: so'rov yiqilsa yoki hali kelmagan
   * bo'lsa ro'yxat bo'sh chiqmasligi kerak — "Manba" MAJBURIY maydon,
   * ya'ni bo'sh tanlov butun formani saqlab bo'lmaydigan qilib qo'yardi.
   */
  const [dbSources, setDbSources] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/student-sources/options")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const names = (d.options as { name: string }[]).map((o) => o.name).filter(Boolean);
        if (names.length > 0) setDbSources(names);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /**
   * `<select>` da ko'rsatiladigan variantlar.
   *
   * "Boshqa" DOIM oxirida — u ro'yxatning bir qismi emas, darvoza
   * (pastdagi `pickSource` izohiga qarang) va bazadagi ro'yxatda saqlanmaydi.
   *
   * Qo'lda yozilgan manba (masalan "Maktabdan eshitgan") ro'yxatda YO'Q,
   * `PanelSelect` esa oddiy `<select>` — ro'yxatda yo'q qiymat umuman
   * ko'rinmaydi va maydon bo'sh turgandek tuyulardi. Shu bois yozilgan
   * qiymat oxiriga QO'SHILADI. Naqsh loyihada bor (AddOrderModal ham
   * tahrirlashda joriy qiymatni ro'yxat boshiga qo'shadi).
   */
  const knownSources = useMemo(
    () => dbSources ?? (STUDENT_SOURCES as string[]).filter((s) => s !== SOURCE_OTHER),
    [dbSources],
  );
  const sourceOptions = useMemo(() => {
    const base = [...knownSources, SOURCE_OTHER];
    return source && !base.includes(source) ? [...base, source] : base;
  }, [knownSources, source]);

  /**
   * Manba tanlanganda. "Boshqa" — qiymat EMAS, darvoza: u `source` ga
   * YOZILMAYDI, faqat oynani ochadi. Shu sabab moderator oynani bekor
   * qilsa, avvalgi tanlov joyida qoladi va bazaga hech qachon "Boshqa"
   * degan mazmunsiz qiymat tushmaydi.
   */
  function pickSource(v: string) {
    setError(null);
    if (v === SOURCE_OTHER) {
      // Qayta tahrirlashda avval yozilgani ko'rinib tursin. Solishtiruv
      // `knownSources` bo'yicha — ro'yxat endi bazadan keladi va konstanta
      // bilan solishtirish o'chirilgan/qo'shilgan qiymatlarda adashardi.
      setOtherText(knownSources.includes(source) ? "" : source);
      setOtherOpen(true);
      return;
    }
    setSource(v);
  }

  function confirmOther() {
    const v = otherText.trim();
    if (!v) return;
    setSource(v);
    setOtherOpen(false);
  }

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError("Ism majburiy");
      return;
    }
    // Serverda ham tekshiriladi (POST /api/pupils) — bu yerdagisi shunchaki
    // so'rovni bekorga yubormaslik uchun, "Ism majburiy" bilan bir qolipda.
    if (!source) {
      setError("Manba majburiy");
      return;
    }
    setSaving(true);
    setError(null);
    const pupil = await createPupil({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: formatLocalPhone(phone),
      extraPhone: showExtra ? formatLocalPhone(extraPhone) : "",
      category,
      birthDate,
      source,
    });
    setSaving(false);
    if (!pupil) {
      setError("Saqlashda xatolik yuz berdi");
      showError("O'quvchi qo'shishda xatolik yuz berdi");
      return;
    }
    showSuccess("O'quvchi muvaffaqiyatli qo'shildi");
    onSave(pupil);
  };

  return (
    <><Modal onClose={onClose} controller={modal} bare panelClassName="p-5 space-y-4 overflow-y-auto">
        <div>
          <h3 className="text-lg font-semibold">Yangi o&apos;quvchi qo&apos;shish</h3>
          <p className="text-xs text-muted-foreground mt-1">* Zarurligini bildiradi</p>
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-1.5">
            Ism<span className="text-red-500"> *</span>
          </label>
          <input
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setError(null);
            }}
            placeholder="Ism"
            className={`h-11 w-full rounded-lg border bg-secondary/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${error === "Ism majburiy" ? "border-red-400 ring-2 ring-red-400" : "border-border"}`}
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium mb-1.5">Familiya</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Familiya"
            className="h-11 w-full rounded-lg border border-border bg-secondary/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <PhoneInput label="Telefon raqam" value={phone} onChange={setPhone} />

        <PanelSelect label="Kategoriyani tanlang" value={category} onChange={setCategory} options={categoryNames} placeholder="Kategoriyani tanlang" loading={categoriesLoading} />

        {/* Majburiy — `required` qizil yulduzcha, `error` esa qizil halqa
            chizadi (PanelSelect'da ikkala prop ham allaqachon bor). */}
        <PanelSelect
          label="Manba"
          required
          value={source}
          onChange={pickSource}
          options={sourceOptions}
          placeholder="O'quvchi qayerdan keldi?"
          error={error === "Manba majburiy"}
        />

        <div>
          <label className="block text-[13px] font-medium mb-1.5">Tug&apos;ilgan sanasi</label>
          <DateField value={birthDate} onChange={(v) => setBirthDate(v)} variant="panel" />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showExtra}
            onChange={(e) => setShowExtra(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Qo&apos;shimcha ma&apos;lumotlar
        </label>

        {showExtra && <PhoneInput label="Qo'shimcha telefon raqam" value={extraPhone} onChange={setExtraPhone} />}

        {/* Majburiylik xatolari maydonning O'ZIDA ko'rsatiladi (qizil ramka /
            halqa), shu bois pastda takrorlanmaydi — aks holda bitta xato bir
            vaqtda ikki xil ko'rinishda chiqardi. */}
        {error && error !== "Ism majburiy" && error !== "Manba majburiy" && (
          <div className="text-sm text-red-600">⚠ {error}</div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={modal.close}>
            Orqaga
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </Modal>{otherOpen && (
        <Modal onClose={closeOther} controller={otherModal} bare size="sm" panelClassName="p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold">Manbani yozing</h3>
              <p className="text-xs text-muted-foreground mt-1">
                O&apos;quvchi markazni qayerdan eshitgan?
              </p>
            </div>

            <input
              autoFocus
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              // Enter — "Tasdiqlash" bilan bir xil. Bir maydonli oynada
              // sichqonchaga uzatish ortiqcha.
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmOther();
                }
              }}
              maxLength={60}
              placeholder="Masalan: Maktabdan eshitgan"
              className="h-11 w-full rounded-lg border border-border bg-secondary/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={otherModal.close}>
                Orqaga
              </Button>
              {/* Bo'sh matn bilan yopib bo'lmaydi: "Manba" majburiy maydon,
                  bo'sh qoldirilsa moderator buni faqat "Saqlash" bosganda
                  bilardi. */}
              <Button variant="primary" onClick={confirmOther} disabled={!otherText.trim()}>
                Tasdiqlash
              </Button>
            </div>
          </Modal>
      )}</>
  );
}
