"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useSettingsListNames } from "@/hooks/useSettingsList";
import { STUDENT_CATEGORIES } from "@/constants";
import type { Pupil } from "@/lib/pupilsData";
import type { Order } from "@/lib/ordersData";
import type { TransactionEntry } from "@/lib/transactionEntries";
import TahrirlashTabButton from "@/components/shared/TahrirlashTabButton";
import ParolTabButton from "@/components/shared/ParolTabButton";
import ModeratorTabButton from "@/components/shared/ModeratorTabButton";
import QongiroqlarTabButton from "@/components/shared/QongiroqlarTabButton";
import GuruhTabButton from "@/components/shared/GuruhTabButton";
import QarzdorlikTabButton from "@/components/shared/QarzdorlikTabButton";
import VazifaTabButton from "@/components/shared/VazifaTabButton";
import CoinTabButton from "@/components/shared/CoinTabButton";
import BlokTabButton from "@/components/shared/BlokTabButton";
import TranzaksiyaTabButton from "@/components/shared/TranzaksiyaTabButton";
import BuyurtmaTabButton from "@/components/shared/BuyurtmaTabButton";
import HarakatlarTabButton from "@/components/shared/HarakatlarTabButton";
import LtvTabButton from "@/components/shared/LtvTabButton";
import SmsTabButton from "@/components/shared/SmsTabButton";
import ShartnomaBiriktirishTabButton from "@/components/shared/ShartnomaBiriktirishTabButton";
import ManzilTabButton from "@/components/shared/ManzilTabButton";
import ShartnomalarTabButton from "@/components/shared/ShartnomalarTabButton";
import KoproqTabButton from "@/components/shared/KoproqTabButton";
import ParolTabContent from "@/components/students/ParolTabContent";
import ModeratorTabContent from "@/components/students/ModeratorTabContent";
import QongiroqlarTabContent from "@/components/students/QongiroqlarTabContent";
import GuruhTabContent from "@/components/students/GuruhTabContent";
import QarzdorlikTabContent from "@/components/students/QarzdorlikTabContent";
import VazifaTabContent from "@/components/students/VazifaTabContent";
import CoinTabContent from "@/components/students/CoinTabContent";
import BlokTabContent from "@/components/students/BlokTabContent";
import TranzaksiyaTabContent from "@/components/students/TranzaksiyaTabContent";
import BuyurtmaTabContent from "@/components/students/BuyurtmaTabContent";
import HarakatlarTabContent from "@/components/students/HarakatlarTabContent";
import LtvTabContent from "@/components/students/LtvTabContent";
import SmsTabContent from "@/components/students/SmsTabContent";
import ShartnomaBiriktirishTabContent from "@/components/students/ShartnomaBiriktirishTabContent";
import ManzilTabContent from "@/components/students/ManzilTabContent";
import ShartnomalarTabContent from "@/components/students/ShartnomalarTabContent";
import TablarniSozlashModal from "@/components/students/TablarniSozlashModal";
import TextField from "@/components/students/fields/TextField";
import PhoneField from "@/components/students/fields/PhoneField";
import SelectField from "@/components/students/fields/SelectField";
import DateField from "@/components/students/fields/DateField";
import { invalidateStudents } from "@/hooks/useStudents";

// Ported from crm-akademiya/src/app.js renderStudentEdit() / renderStudentEditTahrirlash()
// (~line 34100-35000, view: 'student-edit'). Only the "Tahrirlash" tab has real
// content; the other tabs render a generic placeholder naming the clicked
// component (real per-tab content is a later step). The 17 tabs + "Ko'proq" are
// separate components (components/shared/*TabButton.tsx), coordinated here so
// only one is active at a time.

// Tanlov ro'yxatlari — hozircha shu yerda (referensda ular sozlamalardan
// keladi; alohida backend qo'shilganda shu joydan olinadi).
const LESSON_TIMES = ["Ertalabki", "Kunduzgi", "Kechki", "Dam olish kunlari"];
const LANGUAGES = ["O'zbek", "Rus", "Ingliz"];

function fmtSpace(n: number): string {
  return n.toLocaleString("ru-RU").replace(/,/g, " ");
}

const TABS: { key: string; label: string }[] = [
  { key: "tahrirlash", label: "Tahrirlash" },
  { key: "parol", label: "Parol o'rnatish" },
  { key: "moderator", label: "Moderatorni tahrirlash" },
  { key: "qongiroqlar", label: "Qo'ng'iroqlar tarixi" },
  { key: "guruh", label: "Guruh" },
  { key: "qarzdorlik", label: "Qarzdorlik limiti" },
  { key: "vazifa", label: "Vazifa" },
  { key: "coin", label: "Coin tarixi" },
  { key: "blok", label: "Blok xolatini tekshirish" },
  { key: "tranzaksiya", label: "Tranzaksiyalar tarixi" },
  { key: "buyurtma", label: "Buyurtmalar" },
  { key: "harakatlar", label: "Harakatlar tarixi" },
  { key: "ltv", label: "LTV" },
  { key: "sms", label: "SMS" },
  { key: "shartnoma-biriktirish", label: "Shartnoma biriktirish" },
  { key: "manzil", label: "Manzil" },
  { key: "shartnomalar", label: "Shartnomalar" },
];

export default function StudentEditPage({ order, initialTab }: { order: Order; initialTab?: string }) {
  // O'quvchi kategoriyalari — Sozlamalar → Sotuv va marketing → Kategoriya.
  // Sozlamada ro'yxat bo'sh bo'lsa constants'dagi standart uchlik ishlatiladi.
  const { names: categoryNames } = useSettingsListNames("student-categories", STUDENT_CATEGORIES);
  const [ism, ...rest] = order.name.trim().split(/\s+/);
  const familiya = rest.join(" ");
  const phone = order.phone ? `+998${order.phone.replace(/\s/g, "")}` : "+998";

  // O'quvchining HAQIQIY to'lovlari (MongoDB `transaction_entries`).
  // Bog'lanish kaliti — ism satri: to'lov yozuvida o'quvchining raqamli
  // id'si saqlanmaydi (lib/transactionEntries.ts). Shu bois bir xil ismli
  // o'quvchilar bir-birining to'lovini ko'rishi mumkin — bu ma'lumot
  // sxemasidagi cheklov, keyinchalik yozuvga studentId qo'shilsa yopiladi.
  const [entries, setEntries] = useState<TransactionEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);

  useEffect(() => {
    // `entriesLoading` boshlanishida true — effekt tanasida qayta
    // o'rnatilsa, ortiqcha render zanjiri chiqadi (react-hooks qoidasi).
    let alive = true;
    fetch(`/api/transaction-entries?studentName=${encodeURIComponent(order.name)}&txType=payIn`)
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setEntries(d.entries as TransactionEntry[]); })
      .catch(() => {})
      .finally(() => { if (alive) setEntriesLoading(false); });
    return () => { alive = false; };
  }, [order.name]);

  // Balans — bekor qilinganlardan tashqari to'lovlar yig'indisi
  // (app/api/employee-salary-summary/route.ts dagi bilan bir xil qoida).
  const balans = entries
    .filter((e) => e.status !== "cancelled")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  // Qolgan darslar va to'lanishi kerak bo'lgan summa uchun tizimda hali
  // dars/majburiyat hisobi yo'q — soxta 0 o'rniga "—" ko'rsatamiz.
  const qolganDarslar: number | null = null;
  const tolanishKerak: number | null = null;

  // Boshlangʻich tab ?tab= dan keladi — oʻquvchilar roʻyxatidagi qator
  // ikonkalari toʻgʻridan-toʻgʻri kerakli tabga olib boradi.
  const [activeTab, setActiveTab] = useState(
    initialTab && TABS.some((t) => t.key === initialTab) ? initialTab : "tahrirlash",
  );
  const [sozlashOpen, setSozlashOpen] = useState(false);

  // --- "Tahrirlash" formasi ------------------------------------------------
  // Ilgari maydonlar faqat `defaultValue` bilan chizilardi va "Saqlash"
  // tugmasi hech qanday so'rov yubormasdi — yozilgan narsa jimgina
  // yo'qolardi. Endi forma o'quvchining BAZADAGI yozuvidan to'ldiriladi va
  // PATCH /api/pupils/:id ga yuboriladi.
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [pupil, setPupil] = useState<Pupil | null>(null);
  const [loadingPupil, setLoadingPupil] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fillForm = useCallback((p: Pupil) => {
    setForm({
      firstName: p.firstName ?? "", lastName: p.lastName ?? "",
      phone: p.phone ?? "", email: p.email ?? "", tags: p.tags ?? "",
      birthDate: p.birthDate ?? "", lessonTime: p.lessonTime ?? "",
      category: p.category ?? "", paymentDate: p.paymentDate ?? "",
      language: p.language ?? "", survey: p.survey ?? "",
      targetUniversity: p.targetUniversity ?? "",
      fatherName: p.fatherName ?? "", fatherPhone: p.fatherPhone ?? "", fatherWork: p.fatherWork ?? "",
      motherName: p.motherName ?? "", motherPhone: p.motherPhone ?? "", motherWork: p.motherWork ?? "",
      address: p.address ?? "", studyPlace: p.studyPlace ?? "", note: p.note ?? "",
    });
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/pupils/${order.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.ok) return;
        setPupil(d.pupil as Pupil);
        fillForm(d.pupil as Pupil);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingPupil(false); });
    return () => { alive = false; };
  }, [order.id, fillForm]);

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!pupil) return;
    if (!form.firstName?.trim()) {
      showError("Ism majburiy");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/pupils/${pupil.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    invalidateStudents(); // ro'yxat o'zgardi -> umumiy kesh bekor
    if (!res?.ok) {
      showError(res?.error || "Saqlashda xatolik yuz berdi");
      return;
    }
    setPupil(res.pupil as Pupil);
    fillForm(res.pupil as Pupil);
    showSuccess("O'quvchi ma'lumotlari saqlandi");
  };

  const handleDelete = async () => {
    if (!pupil) return;
    setDeleting(true);
    const res = await fetch(`/api/pupils/${pupil.id}`, { method: "DELETE" })
      .then((r) => r.json()).catch(() => null);
    setDeleting(false);
    invalidateStudents(); // ro'yxat o'zgardi -> umumiy kesh bekor
    setConfirmDelete(false);
    if (!res?.ok) {
      showError(res?.error || "O'chirishda xatolik yuz berdi");
      return;
    }
    showSuccess("O'quvchi o'chirildi");
    router.push("/students-list");
  };

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-5">
      <div className="student-edit-layout">
        {/* LEFT SIDEBAR — Student card */}
        <aside className="space-y-3">
          <div className="rounded-2xl bg-card border border-border p-5 text-center">
            <div className="relative inline-block">
              <div className="h-28 w-28 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 mx-auto flex items-center justify-center text-5xl text-slate-400 dark:text-slate-500">
                <svg viewBox="0 0 24 24" className="w-16 h-16" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <button type="button" className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-primary text-white inline-flex items-center justify-center shadow-md hover:opacity-90" title="Rasm yuklash">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
            </div>
            <h3 className="text-[16px] font-bold tracking-tight mt-3">{order.name}</h3>
            <div className="flex items-center justify-center gap-1.5 mt-1 text-[13px] text-muted-foreground">
              <span>{phone}</span>
              <button type="button" className="h-5 w-5 inline-flex items-center justify-center hover:text-foreground" title="Nusxa olish">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
            {/* Quick action buttons */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <button type="button" className="h-9 w-9 rounded-full bg-violet-500/15 text-violet-600 inline-flex items-center justify-center hover:bg-violet-500/25" title="Xabar yuborish">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </button>
              <button type="button" className="h-9 w-9 rounded-full bg-emerald-500/15 text-emerald-600 inline-flex items-center justify-center hover:bg-emerald-500/25" title="To'lov">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </button>
              <button type="button" className="h-9 w-9 rounded-full bg-rose-500/15 text-rose-600 inline-flex items-center justify-center hover:bg-rose-500/25" title="Qo'ng'iroq qilish">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border divide-y divide-border">
            <div className="flex items-center gap-3 p-4">
              <span className="h-10 w-10 rounded-lg bg-sky-500/10 text-sky-600 inline-flex items-center justify-center flex-shrink-0">
                <svg className="icon icon-sm"><use href="#i-book" /></svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-muted-foreground">Qolgan darslar soni</div>
                <div className="text-[15px] font-bold tabular-nums">{qolganDarslar ?? "—"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <span className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 inline-flex items-center justify-center flex-shrink-0">
                <svg className="icon icon-sm"><use href="#i-wallet" /></svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-muted-foreground">To&apos;lanish kerak</div>
                <div className="text-[15px] font-bold tabular-nums">{tolanishKerak === null ? "—" : `${fmtSpace(tolanishKerak)} UZS`}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <span className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 inline-flex items-center justify-center flex-shrink-0">
                <svg className="icon icon-sm"><use href="#i-shield" /></svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-muted-foreground">Balans</div>
                <div className="text-[15px] font-bold tabular-nums">{entriesLoading ? "…" : `${fmtSpace(balans)} UZS`}</div>
              </div>
            </div>
          </div>
          {/* Info cards */}
        </aside>

        {/* RIGHT — Main content with tabs */}
        <main className="space-y-4">
          {/* Tab bar — each button is its own shared component; only one active at a time */}
          <div className="rounded-2xl bg-card border border-border p-3 flex flex-wrap items-center gap-2">
            <TahrirlashTabButton active={activeTab === "tahrirlash"} onClick={() => setActiveTab("tahrirlash")} />
            <ParolTabButton active={activeTab === "parol"} onClick={() => setActiveTab("parol")} />
            <ModeratorTabButton active={activeTab === "moderator"} onClick={() => setActiveTab("moderator")} />
            <QongiroqlarTabButton active={activeTab === "qongiroqlar"} onClick={() => setActiveTab("qongiroqlar")} />
            <GuruhTabButton active={activeTab === "guruh"} onClick={() => setActiveTab("guruh")} />
            <QarzdorlikTabButton active={activeTab === "qarzdorlik"} onClick={() => setActiveTab("qarzdorlik")} />
            <VazifaTabButton active={activeTab === "vazifa"} onClick={() => setActiveTab("vazifa")} />
            <CoinTabButton active={activeTab === "coin"} onClick={() => setActiveTab("coin")} />
            <BlokTabButton active={activeTab === "blok"} onClick={() => setActiveTab("blok")} />
            <TranzaksiyaTabButton active={activeTab === "tranzaksiya"} onClick={() => setActiveTab("tranzaksiya")} />
            <BuyurtmaTabButton active={activeTab === "buyurtma"} onClick={() => setActiveTab("buyurtma")} />
            <HarakatlarTabButton active={activeTab === "harakatlar"} onClick={() => setActiveTab("harakatlar")} />
            <LtvTabButton active={activeTab === "ltv"} onClick={() => setActiveTab("ltv")} />
            <SmsTabButton active={activeTab === "sms"} onClick={() => setActiveTab("sms")} />
            <ShartnomaBiriktirishTabButton active={activeTab === "shartnoma-biriktirish"} onClick={() => setActiveTab("shartnoma-biriktirish")} />
            <ManzilTabButton active={activeTab === "manzil"} onClick={() => setActiveTab("manzil")} />
            <ShartnomalarTabButton active={activeTab === "shartnomalar"} onClick={() => setActiveTab("shartnomalar")} />
            <KoproqTabButton onClick={() => setSozlashOpen(true)} />
          </div>

          {/* Tab content — every tab now renders its own component */}
          {activeTab === "parol" && <ParolTabContent login={phone} pupilId={pupil?.id} />}
          {activeTab === "moderator" && <ModeratorTabContent initialModerator={pupil?.moderator ?? order.moderator} pupilId={pupil?.id} />}
          {activeTab === "qongiroqlar" && <QongiroqlarTabContent />}
          {activeTab === "guruh" && <GuruhTabContent pupilId={pupil?.id} />}
          {activeTab === "qarzdorlik" && <QarzdorlikTabContent pupilId={pupil?.id} initialLimit={pupil?.debtLimit} />}
          {activeTab === "vazifa" && <VazifaTabContent pupilId={pupil?.id} />}
          {activeTab === "coin" && <CoinTabContent />}
          {activeTab === "blok" && <BlokTabContent />}
          {activeTab === "tranzaksiya" && <TranzaksiyaTabContent entries={entries} loading={entriesLoading} />}
          {activeTab === "buyurtma" && <BuyurtmaTabContent />}
          {activeTab === "harakatlar" && <HarakatlarTabContent order={order} balans={balans} />}
          {activeTab === "ltv" && <LtvTabContent />}
          {activeTab === "sms" && <SmsTabContent order={order} />}
          {activeTab === "shartnoma-biriktirish" && <ShartnomaBiriktirishTabContent ism={ism} familiya={familiya} phone={phone} pupilId={pupil?.id} />}
          {activeTab === "manzil" && <ManzilTabContent pupilId={pupil?.id} initialAddresses={pupil?.addresses} />}
          {activeTab === "shartnomalar" && <ShartnomalarTabContent />}

          {/* Tab content — "Tahrirlash" */}
          {activeTab === "tahrirlash" && (
          <>
          <div className="rounded-2xl bg-card border border-border p-5 space-y-5">
            {!loadingPupil && !pupil && (
              <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-[13px]">
                Bu yozuv o&apos;quvchilar bazasida topilmadi — maydonlarni saqlab bo&apos;lmaydi.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField label="Ism" value={form.firstName ?? ism} onChange={set("firstName")} />
              <TextField label="Familiya" value={form.lastName ?? familiya} onChange={set("lastName")} />
              <PhoneField label="Telefon raqam" value={form.phone ?? phone} onChange={set("phone")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField label="Teglar" value={form.tags ?? ""} onChange={set("tags")} />
              <TextField label="Elektron pochta" type="email" placeholder="example@gmail.com" value={form.email ?? ""} onChange={set("email")} />
              <DateField label="Tug'ilgan sanasi" value={form.birthDate ?? ""} onChange={set("birthDate")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SelectField label="Dars vaqti" placeholder="Dars shaklini tanlang" options={LESSON_TIMES} value={form.lessonTime ?? ""} onChange={set("lessonTime")} />
              <SelectField label="O'quvchi kategoriyasi" options={categoryNames} value={form.category ?? ""} onChange={set("category")} />
              <DateField label="O'quvchining pul to'lash sanasi" value={form.paymentDate ?? ""} onChange={set("paymentDate")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SelectField label="O'qish tili" options={LANGUAGES} value={form.language ?? ""} onChange={set("language")} />
              <TextField label="Marketing so'rovnomasi" value={form.survey ?? ""} onChange={set("survey")} />
              <TextField label="Maqsadidagi universiteti" value={form.targetUniversity ?? ""} onChange={set("targetUniversity")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField label="Otasining ismi" value={form.fatherName ?? ""} onChange={set("fatherName")} />
              <PhoneField label="Telefon raqam" value={form.fatherPhone ?? ""} onChange={set("fatherPhone")} />
              <TextField label="Otasining ish joyi" value={form.fatherWork ?? ""} onChange={set("fatherWork")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField label="Onasining ismi" value={form.motherName ?? ""} onChange={set("motherName")} />
              <PhoneField label="Telefon raqam" value={form.motherPhone ?? ""} onChange={set("motherPhone")} />
              <TextField label="Onasining ish joyi" value={form.motherWork ?? ""} onChange={set("motherWork")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField label="Uy adresi" value={form.address ?? ""} onChange={set("address")} />
              <TextField label="O'qish joyi" value={form.studyPlace ?? ""} onChange={set("studyPlace")} />
              <TextField label="Izoh" value={form.note ?? ""} onChange={set("note")} />
            </div>
          </div>

          {/* Bottom action buttons */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={!pupil || deleting}
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center h-10 px-5 rounded-lg bg-rose-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            >
              O&apos;chirish
            </button>
            <Link href="/students-list" className="inline-flex items-center h-10 px-5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary/60">Orqaga</Link>
            <button
              type="button"
              disabled={!pupil || saving}
              onClick={handleSave}
              className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>

          {confirmDelete && pupil && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDelete(false)}>
              <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold">O&apos;quvchini o&apos;chirish</h3>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{`${pupil.firstName} ${pupil.lastName}`.trim()}</strong>
                  {" "}o&apos;chiriladi va barcha guruhlardan chiqariladi. Bu amalni qaytarib bo&apos;lmaydi.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmDelete(false)} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
                    Bekor qilish
                  </button>
                  <button type="button" disabled={deleting} onClick={handleDelete} className="h-9 rounded-lg bg-rose-500 px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
                    {deleting ? "O'chirilmoqda..." : "O'chirish"}
                  </button>
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </main>
      </div>

      <TablarniSozlashModal open={sozlashOpen} onClose={() => setSozlashOpen(false)} tabs={TABS} />
    </div>
  );
}
