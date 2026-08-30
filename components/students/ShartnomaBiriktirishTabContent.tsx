"use client";

import { useEffect, useMemo, useState } from "react";
import TextField from "@/components/students/fields/TextField";
import PhoneField from "@/components/students/fields/PhoneField";
import SelectField from "@/components/students/fields/SelectField";
import DateField from "@/components/students/fields/DateField";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useSettingsListNames } from "@/hooks/useSettingsList";
import { useProfilePupil } from "@/hooks/useProfilePupil";
import { STUDENT_CATEGORIES } from "@/constants";
import type { Contract } from "@/lib/contracts";
import type { Pupil } from "@/lib/pupilsData";
import { invalidateStudents } from "@/hooks/useStudents";

// O'quvchi profili → "Shartnoma biriktirish".
//
// ILGARI NIMA NOTO'G'RI EDI: 22 maydonli forma butunlay BOSHQARILMAYDIGAN
// edi (faqat `defaultValue`), barcha SelectField'lar BIRORTA variantsiz
// chizilardi, va sahifada umuman "Saqlash" tugmasi YO'Q edi — yozilgan
// har qanday narsa jimgina yo'qolardi. O'ng tomondagi muharrirga terilgan
// shartnoma matni ham hech qayerga bormasdi.
//
// ENDI NIMA QILINDI:
//   • Formadagi maydonlar o'quvchining BAZADAGI yozuvidan to'ladi va
//     "Saqlash" ularni PATCH /api/pupils/:id ga yuboradi (Tahrirlash tabi
//     bilan bir xil yo'l — maydon to'plami ham o'sha, manba saytda ham shu
//     tabda takrorlanadi). Ya'ni endi HAMMA maydon haqiqatan saqlanadi.
//   • "Shartnoma turi" — /api/contracts dagi HAQIQIY shartnoma andozalari
//     (O'quv bo'limi → Shartnoma sahifasi boshqaradi). Ilgari bo'sh edi.
//   • O'ng tomondagi bo'sh muharrir o'rniga tanlangan andozaning matni
//     ko'rsatiladi va undagi {{ism}}, {{familiya}}, {{telefon}} kabi
//     birlashtirish (mail-merge) tokenlari shu o'quvchining haqiqiy
//     ma'lumotlari bilan almashtiriladi (tokenlar ro'yxati:
//     constants/contracts.js CONTRACT_FIELDS).
//
// SAQLANMAYDIGAN QISM (ochiq aytilgan): shartnomaning O'QUVCHIGA
// BIRIKTIRILGAN NUSXASI bazaga yozilmaydi — `contracts` kolleksiyasida
// faqat andoza (title/type/content) bor, `finance_contracts` esa summa va
// qismlardan iborat bo'lib, matn uchun maydoni yo'q. Shu bois o'ng taraf
// FAQAT KO'RISH uchun: unga yozib bo'lmaydi (yozilgani yo'qolmasin).

// Dars vaqti / o'qish tili ro'yxatlari — Tahrirlash tabidagi bilan bir xil
// (StudentEditPage.tsx da ham shunday e'lon qilingan; sozlamalarga alohida
// ro'yxat qo'shilsa, ikkalasi ham o'sha yerdan olishi kerak).
const LESSON_TIMES = ["Ertalabki", "Kunduzgi", "Kechki", "Dam olish kunlari"];
const LANGUAGES = ["O'zbek", "Rus", "Ingliz"];

/** PATCH /api/pupils/:id qabul qiladigan maydonlar (route'dagi EDITABLE). */
const FIELD_KEYS = [
  "firstName", "lastName", "phone", "email", "birthDate", "lessonTime",
  "category", "language", "paymentDate", "survey", "targetUniversity",
  "fatherName", "fatherPhone", "fatherWork",
  "motherName", "motherPhone", "motherWork",
  "address", "studyPlace", "note", "tags",
] as const;

type FormState = Record<string, string>;

function formFromPupil(p: Pupil): FormState {
  return {
    firstName: p.firstName ?? "", lastName: p.lastName ?? "", phone: p.phone ?? "",
    email: p.email ?? "", birthDate: p.birthDate ?? "", lessonTime: p.lessonTime ?? "",
    category: p.category ?? "", language: p.language ?? "", paymentDate: p.paymentDate ?? "",
    survey: p.survey ?? "", targetUniversity: p.targetUniversity ?? "",
    fatherName: p.fatherName ?? "", fatherPhone: p.fatherPhone ?? "", fatherWork: p.fatherWork ?? "",
    motherName: p.motherName ?? "", motherPhone: p.motherPhone ?? "", motherWork: p.motherWork ?? "",
    address: p.address ?? "", studyPlace: p.studyPlace ?? "", note: p.note ?? "", tags: p.tags ?? "",
  };
}

/**
 * Andozadagi {{token}} → o'quvchining haqiqiy qiymati.
 *
 * Faqat yozuvda HAQIQATAN bor maydonlar bog'langan. `kategoriya_id`,
 * `sorov_id`, `teg_idlari`, `takliflar_soni`, `keys.ofertaAcceptances`
 * tokenlariga mos ma'lumot bazada yo'q (kategoriya nomi saqlanadi, id
 * emas; takliflar hisobi umuman yuritilmaydi) — ular o'ylab topilgan son
 * bilan emas, "—" bilan almashtiriladi.
 */
function tokenValue(token: string, f: FormState): string {
  switch (token) {
    case "ism": return f.firstName;
    case "familiya": return f.lastName;
    case "telefon": return f.phone;
    case "email": return f.email;
    case "tugilgan_sana": return f.birthDate;
    case "dars_turi": return f.lessonTime;
    case "til": return f.language;
    case "tolov_sanasi": return f.paymentDate;
    case "otasining_ismi": return f.fatherName;
    case "otasining_telefon": return f.fatherPhone;
    case "onasining_ismi": return f.motherName;
    case "onasining_telefon": return f.motherPhone;
    default: return "";
  }
}

/** Andoza HTML ichiga qo'yiladigan qiymatlar ekranlanadi (ism ichidagi
 *  "<" belgisi bilan sahifa buzilmasin). */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mergeTokens(html: string, f: FormState): string {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, token: string) => {
    const v = tokenValue(token, f).trim();
    return v ? escapeHtml(v) : "—";
  });
}

export default function ShartnomaBiriktirishTabContent({
  ism,
  familiya,
  phone,
  pupilId: pupilIdProp,
}: {
  ism: string;
  familiya: string;
  phone: string;
  /** StudentEditPage hali uzatmaydi — u holda id URL'dan olinadi. */
  pupilId?: number;
}) {
  const { showSuccess, showError } = useToast();
  const { pupilId, pupil, loading } = useProfilePupil(pupilIdProp);
  const { names: categoryNames } = useSettingsListNames("student-categories", STUDENT_CATEGORIES);

  // Forma qiymati HISOBLANADI, nusxalanmaydi: `base` — bazadagi yozuv,
  // `edits` — foydalanuvchi yozgani. Effekt bilan sinxronlash (setForm)
  // ortiqcha render zanjirini keltirib chiqaradi (react-hooks qoidasi),
  // shuning uchun ustma-ust qo'yiladi. Saqlangandan keyin serverdan
  // qaytgan yozuv `savedPupil` ga tushadi va `edits` tozalanadi.
  const [edits, setEdits] = useState<FormState>({});
  const [savedPupil, setSavedPupil] = useState<Pupil | null>(null);
  const [templates, setTemplates] = useState<Contract[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);

  const current = savedPupil ?? pupil;
  // Yozuv topilmasa profil sarlavhasidagi ism/telefon ko'rinadi. PhoneField
  // "+998" ni o'zi chizadi, prop esa u bilan keladi — takrorlanmasin.
  const base = useMemo<FormState>(
    () => (current
      ? formFromPupil(current)
      : { firstName: ism, lastName: familiya, phone: phone.replace(/^\+998\s*/, "") }),
    [current, ism, familiya, phone],
  );
  const form = useMemo<FormState>(() => ({ ...base, ...edits }), [base, edits]);

  // Andozalar yuklanmagunicha "Andoza yo'q" deyish mumkin emas — bu javob
  // kelmasdan turib "hech narsa yo'q" deb da'vo qilish bo'lardi.
  const [templatesLoading, setTemplatesLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTemplates(d.contracts as Contract[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setTemplatesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const set = (k: string) => (v: string) => setEdits((e) => ({ ...e, [k]: v }));

  const template = useMemo(
    () => templates.find((t) => String(t.id) === templateId) ?? null,
    [templates, templateId],
  );
  const mergedHtml = useMemo(
    () => (template ? mergeTokens(template.content || "", form) : ""),
    [template, form],
  );

  const save = async () => {
    if (!pupil || pupilId === undefined) return;
    if (!form.firstName?.trim()) {
      showError("Ism majburiy");
      return;
    }
    setSaving(true);
    const payload: FormState = {};
    for (const k of FIELD_KEYS) payload[k] = form[k] ?? "";
    const res = await fetch(`/api/pupils/${pupilId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    invalidateStudents(); // ro'yxat o'zgardi -> umumiy kesh bekor
    if (!res?.ok) {
      showError(res?.error || "Saqlashda xatolik yuz berdi");
      return;
    }
    setSavedPupil(res.pupil as Pupil);
    setEdits({});
    // Faqat o'quvchi maydonlari saqlanadi — "Shartnoma turi" tanlovi emas
    // (uni saqlaydigan maydon yo'q). Xabar shuni aniq aytadi.
    showSuccess("O'quvchi ma'lumotlari saqlandi");
  };

  return (
    <div className="space-y-4">
      {!loading && !pupil && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-[13px]">
          Bu yozuv o&apos;quvchilar bazasida topilmadi — maydonlarni saqlab bo&apos;lmaydi.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="rounded-2xl bg-card border border-border p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "70vh" }}>
          {loading ? (
            <SpinnerBlock />
          ) : (
            <>
              {/* Andozalar bazadan; ro'yxat bo'sh bo'lsa buni ochiq aytamiz. */}
              <div>
                <label className="block text-[13px] font-medium mb-1.5">Shartnoma turi</label>
                <div className="relative">
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">
                      {templatesLoading ? "Yuklanmoqda…" : templates.length ? "Andozani tanlang" : "Andoza yo'q"}
                    </option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  <svg className="icon icon-sm pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
                </div>
                {/* Tanlangan andoza SAQLANMAYDI: `pupils` hujjatida ham,
                    shartnoma modellarida ham o'quvchiga biriktirilgan
                    andozani saqlaydigan maydon yo'q. Shuning uchun buni
                    ochiq aytamiz — aks holda Saqlash tugmasi uni ham
                    saqlagandek tuyulardi. */}
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  Andoza faqat quyidagi ko&apos;rinishni hosil qilish uchun — u o&apos;quvchiga
                  biriktirilib saqlanmaydi (bazada mos maydon yo&apos;q).
                </p>
              </div>

              <TextField label="Ism" value={form.firstName ?? ""} onChange={set("firstName")} />
              <TextField label="Familiya" value={form.lastName ?? ""} onChange={set("lastName")} />
              <PhoneField label="Telefon raqam" value={form.phone ?? ""} onChange={set("phone")} />
              <TextField label="Elektron pochta" type="email" placeholder="example@gmail.com" value={form.email ?? ""} onChange={set("email")} />
              <DateField label="Tug'ilgan sanasi" value={form.birthDate ?? ""} onChange={set("birthDate")} />
              <SelectField label="Dars vaqti" placeholder="Dars shaklini tanlang" options={LESSON_TIMES} value={form.lessonTime ?? ""} onChange={set("lessonTime")} />
              <SelectField label="O'quvchi kategoriyasi" options={categoryNames} value={form.category ?? ""} onChange={set("category")} />
              <SelectField label="O'qish tili" options={LANGUAGES} value={form.language ?? ""} onChange={set("language")} />
              <DateField label="O'quvchining pul to'lash sanasi" value={form.paymentDate ?? ""} onChange={set("paymentDate")} />
              {/* Marketing so'rovnomasi va Teglar — bazada erkin matn
                  (pupils.survey / pupils.tags), shuning uchun variantsiz
                  tanlov emas, matn maydoni. */}
              <TextField label="Marketing so'rovnomasi" value={form.survey ?? ""} onChange={set("survey")} />
              <TextField label="Maqsadidagi universiteti" value={form.targetUniversity ?? ""} onChange={set("targetUniversity")} />
              <TextField label="Otasining ismi" value={form.fatherName ?? ""} onChange={set("fatherName")} />
              <PhoneField label="Telefon raqam" value={form.fatherPhone ?? ""} onChange={set("fatherPhone")} />
              <TextField label="Otasining ish joyi" value={form.fatherWork ?? ""} onChange={set("fatherWork")} />
              <TextField label="Onasining ismi" value={form.motherName ?? ""} onChange={set("motherName")} />
              <PhoneField label="Telefon raqam" value={form.motherPhone ?? ""} onChange={set("motherPhone")} />
              <TextField label="Onasining ish joyi" value={form.motherWork ?? ""} onChange={set("motherWork")} />
              <TextField label="Uy adresi" value={form.address ?? ""} onChange={set("address")} />
              <TextField label="O'qish joyi" value={form.studyPlace ?? ""} onChange={set("studyPlace")} />
              <TextField label="Izoh" value={form.note ?? ""} onChange={set("note")} />
              <TextField label="Teglar" value={form.tags ?? ""} onChange={set("tags")} />
            </>
          )}
        </div>

        <div className="rounded-2xl bg-card border border-border overflow-hidden flex flex-col" style={{ maxHeight: "70vh" }}>
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-[14px] font-semibold">Shartnoma matni</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Andoza matni O&apos;quv bo&apos;limi &rarr; Shartnoma bo&apos;limida tahrirlanadi.
              Bu yerda u faqat ko&apos;rish uchun: {"{{ism}}"} kabi tokenlar o&apos;quvchining
              ma&apos;lumotlari bilan to&apos;ldiriladi.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            {!template ? (
              <div className="py-16 text-center text-muted-foreground text-[13px]">
                {templates.length
                  ? "Chapdan shartnoma andozasini tanlang."
                  : "Shartnoma andozalari yo'q — O'quv bo'limi → Shartnoma bo'limida qo'shiladi."}
              </div>
            ) : (
              // Matn o'z bazamizdagi andozadan keladi; ichiga qo'yiladigan
              // o'quvchi qiymatlari mergeTokens'da ekranlanadi.
              <div dangerouslySetInnerHTML={{ __html: mergedHtml }} />
            )}
          </div>
        </div>
      </div>

      {/* Ilgari bu sahifada "Saqlash" umuman yo'q edi. */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={!pupil || saving}
          onClick={save}
          className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </button>
      </div>
    </div>
  );
}
