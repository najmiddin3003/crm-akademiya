"use client";

/* eslint-disable @next/next/no-img-element -- nomzod rasmi data: URL (brauzerda kichraytirilgan), next/image kerak emas. */

import { useCallback, useState, type DragEvent, type ReactNode } from "react";
import { FileText, Paperclip, Trash2, Upload, UserRound } from "lucide-react";
import BirthDateField, { birthText as birthTextOf, parseBirth, type BirthState } from "@/components/v2/form/BirthDateField";
import V2DateField from "@/components/v2/form/V2DateField";
import V2Picker, { type PickerOption } from "@/components/v2/form/V2Picker";
import V2TimeField, { isTime } from "@/components/v2/form/V2TimeField";
import { Chip, Field, FieldError, FieldHint, FieldLabel, MoneyField, PhoneField, Segmented, TextInput, fieldCls } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { fmtSize, type CvApplyForm } from "@/components/management/cvApplyForm";
import {
  CV_AGE_GROUPS,
  CV_CERT_TYPES,
  CV_EDU_LEVELS,
  CV_EXP_LEVELS,
  CV_LOADS,
  CV_MIN_AGE,
  CV_SOURCES,
  CV_TEACH_SUBJECTS,
  CV_TEACHING_ROLES,
  CV_WORK_DAYS,
} from "@/constants/managementCv";
import { dateOfIso, isoOfDate } from "./cvBits";

// YANGI VERSIYA — ISHGA QABUL ANKETASI BO'LIMLARI (rasm «Ochiq anketa (#ariza) · Kompyuter»,
// yorug'/qorong'i, 25.10.2026, 13-qism). 4 bo'lim: Shaxsiy ma'lumotlar · Ma'lumot va tajriba ·
// Ish sharoiti · Rezyume. Ikki joyda: ommaviy /ariza (bittadan bo'lim, «Keyingisi →») va CRM'dagi
// «Nomzod qo'shish» oynasi (hammasi bitta varaqda). Mantiq — eski anketa bilan BITTA hook
// (components/management/cvApplyForm.ts, `multiSubject`): savol kalitlari, fayllar, yuborish.
//
// MAJBURIYLIK (rasm: «Ixtiyoriy savollar alohida belgilangan, qolganlari majburiy»): server talab
// qiladiganlar (lib: app/api/management-cv → createFromPublicForm) + ommaviy anketada rasmda
// majburiy ko'ringanlari — mutaxassislik va bitirgan yil (oliy ta'limda), «Sertifikatingiz bormi?».
// Xodim kiritganda bular ixtiyoriy (qog'oz CV'da bo'lmasligi mumkin).

export type ApplyMode = "public" | "staff";

export const APPLY_STEPS = ["Shaxsiy ma'lumotlar", "Ma'lumot va tajriba", "Ish sharoiti", "Rezyume"] as const;

const HIGHER_EDU = ["Talaba (hozir o'qiyapman)", "Bakalavr", "Magistr", "Ilmiy daraja"];
const isHigherEdu = (edu: string) => HIGHER_EDU.includes(edu);
const STUDENT_EDU = "Talaba (hozir o'qiyapman)";

function gradYearOk(y: string): boolean {
  return /^\d{4}$/.test(y) && Number(y) >= 1960 && Number(y) <= new Date().getFullYear() + 6;
}

/** Tajriba segmenti — rasmdagidek qisqa: «Yo'q», «5+ yil». */
function expShort(e: string): string {
  if (e === "Tajribam yo'q") return "Yo'q";
  if (e === "5 yildan ko'p") return "5+ yil";
  return e;
}

/* ── Tug'ilgan sana: matn («kk.oo.yyyy») → hook'dagi ISO ─────────────────── */

export interface BirthInput {
  text: string;
  state: BirthState;
  setText: (s: string) => void;
  /** Qoralama tiklanganda / forma tozalanganda. */
  sync: (iso: string) => void;
}

export function useBirthInput(form: CvApplyForm): BirthInput {
  const [text, setTextRaw] = useState(() => birthTextOf(form.v.birth));
  const { set } = form;
  const setText = useCallback(
    (s: string) => {
      setTextRaw(s);
      const p = parseBirth(s);
      set("birth", p.state === "ok" ? p.iso : "");
    },
    [set],
  );
  const sync = useCallback((iso: string) => setTextRaw(birthTextOf(iso)), []);
  return { text, state: parseBirth(text).state, setText, sync };
}

/* ── Tekshiruv (bo'lim bo'yicha) ────────────────────────────────────────── */

/** Bo'limdagi to'ldirilmagan yoki xato maydonlar — tartibi ekrandagidek (birinchisiga fokus). */
export function stepProblems(form: CvApplyForm, step: number, mode: ApplyMode): string[] {
  const { v } = form;
  const pub = mode === "public";
  const out: string[] = [];
  const need = (k: string, ok: boolean) => {
    if (!ok && !out.includes(k)) out.push(k);
  };
  if (step === 1) {
    if (pub) need("photoBtn", Boolean(form.photo));
    need("firstName", Boolean(v.firstName.trim()));
    need("lastName", Boolean(v.lastName.trim()));
    need("birth", form.fieldOk("birth"));
    need("phone", form.fieldOk("phone"));
    need("city", Boolean(v.city.trim()));
    need("role", Boolean(v.role));
  } else if (step === 2) {
    need("edu", Boolean(v.edu));
    need("school", Boolean(v.school.trim()));
    if (pub && isHigherEdu(v.edu)) {
      need("specialty", Boolean(v.specialty.trim()));
      need("gradYear", Boolean(v.gradYear));
    }
    if (v.gradYear) need("gradYear", gradYearOk(v.gradYear));
    if (pub) need("certType", Boolean(v.certType));
    if (v.certType && v.certType !== "Yo'q") need("certLevel", Boolean(v.certLevel.trim()));
    need("exp", Boolean(v.exp));
    if (form.teaching) need("subject", form.subjects.length > 0);
  } else if (step === 3) {
    need("branch", Boolean(v.branch));
    need("load1", Boolean(v.load));
    need("startDate", Boolean(v.startDate) && v.startDate >= form.today);
    need("salary", Boolean(v.salary.replace(/\D/g, "")));
    if (v.workFrom || v.workTo) need("workTime", isTime(v.workFrom) && isTime(v.workTo) && v.workFrom < v.workTo);
  } else if (step === 4) {
    need("about", Boolean(v.about.trim()));
    if (pub) need("consent", form.consent);
  }
  return out;
}

/** Xatolarni ko'rsatadi va birinchisiga o'tadi; `true` — xato yo'q. */
export function showProblems(form: CvApplyForm, problems: string[], idPrefix: string): boolean {
  form.setBad(new Set(problems));
  if (problems.includes("photoBtn")) form.setPhotoErr(form.t("Rasmingizni yuklang."));
  form.setConsentBad(problems.includes("consent"));
  const first = problems[0];
  if (first) {
    requestAnimationFrame(() => {
      const el = document.getElementById(`${idPrefix}${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    });
  }
  return problems.length === 0;
}

function clearBad(form: CvApplyForm, key: string) {
  form.setBad((b) => {
    if (!b.has(key)) return b;
    const next = new Set(b);
    next.delete(key);
    return next;
  });
}

/* ── Bo'lim ─────────────────────────────────────────────────────────────── */

export default function CvApplySection({
  form,
  step,
  mode,
  birth,
  idPrefix,
  honeypot,
}: {
  form: CvApplyForm;
  step: number;
  mode: ApplyMode;
  birth: BirthInput;
  idPrefix: string;
  /** Ommaviy anketa: botlar uchun tuzoq maydoni (odam ko'rmaydi). */
  honeypot?: { value: string; onChange: (v: string) => void };
}) {
  // Hammasi boshida olinadi: `form` ichida ref'lar bor (rasm/fayl input'lari) — render paytida
  // `form.x` murojaati react-hooks/refs qoidasiga tushadi (eski CvApplyPage ham shunday qiladi).
  const {
    t, v, set, bad, photo, photoErr, cvFile, docs, certErr, consent, consentBad, teaching, subjects, ageGroups,
    branchTel, roleOptions, branchOptions, photoInput, cvInput, docsInput,
    onPhotoPick, removePhoto, onCvPick, removeCv, addDocs, removeDoc, toggleSubject, toggleAgeGroup,
    setSubjects, setAgeGroups, setConsent, setConsentBad,
  } = form;
  const pub = mode === "public";
  const id = (k: string) => `${idPrefix}${k}`;
  const st = (k: string) => (bad.has(k) ? "error" : "default") as "error" | "default";
  const [dragOver, setDragOver] = useState(false);

  const err = (k: string): ReactNode => {
    if (!bad.has(k)) return "";
    switch (k) {
      case "firstName":
        return t("Ismingizni yozing.");
      case "lastName":
        return t("Familiyangizni yozing.");
      case "birth":
        return birth.state === "ok" ? t("Ishga qabul {age} yoshdan boshlanadi — sanani tekshiring.", { age: CV_MIN_AGE }) : t("Tug'ilgan sanani kk.oo.yyyy ko'rinishida yozing.");
      case "phone":
        return t("Raqamni to'liq kiriting: +998 va 9 ta raqam.");
      case "city":
        return t("Tuman va viloyatni yozing.");
      case "role":
        return t("Vakansiya turini tanlang.");
      case "edu":
        return t("Ta'lim darajangizni tanlang.");
      case "school":
        return t("O'quv yurtini yozing.");
      case "specialty":
        return t("Mutaxassisligingizni yozing.");
      case "gradYear":
        return v.gradYear ? t("Bitirgan yilni to'g'ri yozing") : t("Bitirgan yilingizni yozing.");
      case "certType":
        return t("Sertifikat bor-yo'qligini belgilang.");
      case "certLevel":
        return t("Sertifikat darajasi yoki balini yozing");
      case "exp":
        return t("Tajribangizni tanlang.");
      case "subject":
        return t("Fan yoki yo'nalishni tanlang.");
      case "branch":
        return t("Filialni tanlang.");
      case "load1":
        return t("Bandlik turini tanlang.");
      case "startDate":
        return v.startDate ? t("Sana bugundan oldin bo'lmasin.") : t("Sanani tanlang.");
      case "salary":
        return t("Taxminiy summani yozing.");
      case "workTime":
        return t("Ish vaqtini to'g'ri tanlang");
      case "about":
        return t("Bir-ikki jumla yozing.");
      default:
        return "";
    }
  };

  const chipGroup = (key: string, label: ReactNode, children: ReactNode, opts: { optional?: boolean; hint?: ReactNode } = {}) => (
    <div className="min-w-0">
      <FieldLabel optional={opts.optional}>{label}</FieldLabel>
      <div id={id(key)} tabIndex={-1} role="group" aria-label={typeof label === "string" ? label : undefined} className="flex flex-wrap gap-1.5 rounded-v2-md focus-visible:outline-none">
        {children}
      </div>
      {bad.has(key) ? <FieldError>{err(key)}</FieldError> : opts.hint ? <FieldHint>{opts.hint}</FieldHint> : null}
    </div>
  );

  /* ═════ 1. Shaxsiy ma'lumotlar ═════ */
  if (step === 1) {
    const phoneDigits = v.phone.replace(/\D/g, "").replace(/^998/, "").slice(0, 9);
    const roleOpts: PickerOption[] = roleOptions.map((o) => ({ value: o.value, label: o.label, group: o.group }));
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              id={id("photoBtn")}
              onClick={() => photoInput.current?.click()}
              aria-label={t("Rasm tanlash")}
              className={`relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-v2-surface-2 text-v2-text-3 transition-colors hover:bg-v2-hover focus-visible:outline-none focus-visible:shadow-v2-focus ${
                photoErr ? "border-v2-danger" : "border-dashed border-v2-border-strong"
              }`}
            >
              {photo ? <img src={photo} alt={t("Yuklangan rasm")} className="size-full object-cover" /> : <UserRound className="size-7" strokeWidth={1.5} aria-hidden />}
            </button>
            <div className="min-w-0">
              <div className="text-v2-small font-medium text-v2-text">
                {pub ? t("Rasmingizni yuklang") : t("Nomzod rasmi")}
                {!pub && <span className="font-normal text-v2-text-3"> ({t("ixtiyoriy")})</span>}
              </div>
              <p className="mt-0.5 text-v2-caption font-normal text-v2-text-3">{t("3×4 yoki oddiy portret rasm bo'lsa ham bo'ladi. JPG yoki PNG, 10 MB gacha.")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => photoInput.current?.click()} className={`${secondaryBtn} h-8 text-v2-small`}>
                  {photo ? t("Boshqa rasm") : t("Rasm tanlash")}
                </button>
                {photo && (
                  <button type="button" onClick={removePhoto} className="inline-flex h-8 items-center rounded-v2-md px-2 text-v2-small font-medium text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-danger">
                    {t("O'chirish")}
                  </button>
                )}
              </div>
              <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPhotoPick} />
            </div>
          </div>
          {photoErr && <FieldError>{photoErr}</FieldError>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Ism")} htmlFor={id("firstName")} error={err("firstName")}>
            <TextInput id={id("firstName")} value={v.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" placeholder="Maftuna" state={st("firstName")} />
          </Field>
          <Field label={t("Familiya")} htmlFor={id("lastName")} error={err("lastName")}>
            <TextInput id={id("lastName")} value={v.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" placeholder="Ismoilova" state={st("lastName")} />
          </Field>
          <Field label={t("Tug'ilgan sana")} htmlFor={id("birth")} error={err("birth")}>
            <BirthDateField id={id("birth")} value={birth.text} onChange={birth.setText} state={st("birth")} />
          </Field>
          <Field label={t("Telefon")} htmlFor={id("phone")} error={err("phone")}>
            <PhoneField id={id("phone")} value={phoneDigits} onChange={(d) => set("phone", d ? `998${d}` : "")} state={st("phone")} />
          </Field>
          <Field label="Telegram" optional htmlFor={id("telegram")}>
            <TextInput id={id("telegram")} value={v.telegram} onChange={(e) => set("telegram", e.target.value)} autoComplete="off" placeholder="@username" />
          </Field>
          <Field label={t("Yashash manzili")} htmlFor={id("city")} error={err("city")}>
            <TextInput id={id("city")} value={v.city} onChange={(e) => set("city", e.target.value)} placeholder={t("Chortoq tumani, Namangan")} state={st("city")} />
          </Field>
        </div>

        <Field label={t("Vakansiya turi")} htmlFor={id("role")} error={err("role")} hint={t("Bir nechta yo'nalish mos kelsa, asosiysini tanlang — qolganini suhbatda gaplashamiz.")}>
          <V2Picker
            id={id("role")}
            value={v.role}
            onChange={(val) => {
              set("role", val);
              if (!CV_TEACHING_ROLES.includes(val)) {
                setSubjects([]);
                setAgeGroups([]);
              }
            }}
            options={roleOpts}
            label={t("Vakansiya turi")}
            placeholder={t("Vakansiyani tanlang")}
            searchPlaceholder={t("Qidirish")}
            state={st("role")}
          />
        </Field>
      </div>
    );
  }

  /* ═════ 2. Ma'lumot va tajriba ═════ */
  if (step === 2) {
    const higher = isHigherEdu(v.edu);
    return (
      <div className="space-y-4">
        {chipGroup(
          "edu",
          t("Ta'lim darajasi"),
          CV_EDU_LEVELS.map((e) => (
            <Chip key={e} on={v.edu === e} onClick={() => set("edu", e)}>
              {t(e)}
            </Chip>
          )),
        )}
        <Field label={higher || !v.edu ? t("Oliy ta'lim muassasasi") : t("O'quv yurti")} htmlFor={id("school")} error={err("school")}>
          <TextInput id={id("school")} value={v.school} onChange={(e) => set("school", e.target.value)} placeholder={higher || !v.edu ? t("NamDU — Namangan davlat universiteti") : t("Masalan: 12-maktab yoki Chortoq pedagogika kolleji")} state={st("school")} />
        </Field>
        {higher && (
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label={t("Mutaxassislik")} optional={!pub} htmlFor={id("specialty")} error={err("specialty")}>
              <TextInput id={id("specialty")} value={v.specialty} onChange={(e) => set("specialty", e.target.value.slice(0, 120))} placeholder={t("Ingliz tili va adabiyoti")} state={st("specialty")} />
            </Field>
            <Field label={v.edu === STUDENT_EDU ? t("Bitiradigan yili") : t("Bitirgan yili")} optional={!pub} htmlFor={id("gradYear")} error={err("gradYear")}>
              <TextInput id={id("gradYear")} inputMode="numeric" value={v.gradYear} onChange={(e) => set("gradYear", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2020" state={st("gradYear")} className="tabular-nums" />
            </Field>
          </div>
        )}
        <div className="min-w-0">
          <FieldLabel optional={!pub}>{t("Sertifikatingiz bormi?")}</FieldLabel>
          <div id={id("certType")} tabIndex={-1} role="group" aria-label={t("Sertifikatingiz bormi?")} className="flex flex-wrap gap-1.5 focus-visible:outline-none">
            {CV_CERT_TYPES.map((c) => (
              <Chip
                key={c}
                on={v.certType === c}
                onClick={() => {
                  set("certType", v.certType === c ? "" : c);
                  if (c === "Yo'q") set("certLevel", "");
                }}
              >
                {t(c)}
              </Chip>
            ))}
          </div>
          {bad.has("certType") && <FieldError>{err("certType")}</FieldError>}
          {v.certType && v.certType !== "Yo'q" && (
            <div className="mt-2.5">
              <div className="flex items-center gap-2.5">
                <label htmlFor={id("certLevel")} className="shrink-0 text-v2-small text-v2-text-2">
                  {t("Daraja yoki ball")}
                </label>
                <div className="w-32">
                  <TextInput id={id("certLevel")} value={v.certLevel} onChange={(e) => set("certLevel", e.target.value.slice(0, 40))} placeholder={v.certType === "IELTS" ? "7.0" : "C1"} state={st("certLevel")} className="font-medium" />
                </div>
              </div>
              {bad.has("certLevel") && <FieldError>{err("certLevel")}</FieldError>}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <FieldLabel>{t("Ish tajribangiz")}</FieldLabel>
          <div id={id("exp")} tabIndex={-1} className="rounded-v2-md focus-visible:outline-none">
            <Segmented value={v.exp} onChange={(x) => set("exp", x)} label={t("Ish tajribangiz")} options={CV_EXP_LEVELS.map((e) => ({ value: e, label: t(expShort(e)) }))} />
          </div>
          {bad.has("exp") && <FieldError>{err("exp")}</FieldError>}
        </div>
        {teaching &&
          chipGroup(
            "subject",
            t("Qaysi fandan dars bera olasiz?"),
            CV_TEACH_SUBJECTS.map((s) => (
              <Chip key={s} on={subjects.includes(s)} onClick={() => toggleSubject(s)}>
                {t(s)}
              </Chip>
            )),
            { hint: t("bir nechtasini tanlash mumkin") },
          )}
        <Field label={t("Oldingi ish joyi")} optional htmlFor={id("lastJob")}>
          <TextInput id={id("lastJob")} value={v.lastJob} onChange={(e) => set("lastJob", e.target.value)} placeholder={t("Xususiy o'quv markazi, Namangan")} />
        </Field>
      </div>
    );
  }

  /* ═════ 3. Ish sharoiti ═════ */
  if (step === 3) {
    const branchOpts: PickerOption[] = branchOptions.map((o) => ({ value: o.value, label: o.label, sublabel: "sub" in o ? o.sub : undefined }));
    // Manzil tanlovning o'zida (sublabel) — ostida faqat «hammasi» izohi va telefon.
    const place = v.branch === "any" ? t("Barcha filiallar ko'rib chiqiladi") : "";
    return (
      <div className="space-y-4">
        <Field
          label={t("Filial")}
          htmlFor={id("branch")}
          error={err("branch")}
          hint={v.branch ? [place, `${t("Telefon:")} ${branchTel}`].filter(Boolean).join(" · ") : undefined}
        >
          <V2Picker id={id("branch")} value={v.branch} onChange={(val) => set("branch", val)} options={branchOpts} label={t("Filial")} placeholder={t("Filialni tanlang")} searchable={false} state={st("branch")} />
        </Field>
        <div className="min-w-0">
          <FieldLabel>{t("Bandlik turi")}</FieldLabel>
          <div id={id("load1")} tabIndex={-1} className="rounded-v2-md focus-visible:outline-none">
            <Segmented value={v.load} onChange={(x) => set("load", x)} label={t("Bandlik turi")} options={CV_LOADS.map((l) => ({ value: l, label: t(l) }))} />
          </div>
          {bad.has("load1") && <FieldError>{err("load1")}</FieldError>}
        </div>
        {chipGroup(
          "workDays",
          t("Qaysi kunlari ishlay olasiz?"),
          CV_WORK_DAYS.map((d) => (
            <Chip key={d} on={v.workDays === d} onClick={() => set("workDays", v.workDays === d ? "" : d)}>
              {t(d)}
            </Chip>
          )),
          { optional: true },
        )}
        <div className="min-w-0">
          <FieldLabel optional htmlFor={id("workTime")}>
            {t("Qaysi soatlarda?")}
          </FieldLabel>
          <div className="flex items-center gap-2">
            <div className="w-32">
              <V2TimeField
                id={id("workTime")}
                value={v.workFrom}
                onChange={(x) => {
                  set("workFrom", x);
                  clearBad(form, "workTime");
                }}
                ariaLabel={t("Boshlanishi")}
                state={st("workTime")}
              />
            </div>
            <span className="text-v2-text-3" aria-hidden>
              –
            </span>
            <div className="w-32">
              <V2TimeField
                value={v.workTo}
                onChange={(x) => {
                  set("workTo", x);
                  clearBad(form, "workTime");
                }}
                ariaLabel={t("Tugashi")}
                state={st("workTime")}
              />
            </div>
          </div>
          {bad.has("workTime") ? <FieldError>{err("workTime")}</FieldError> : <FieldHint>{t("Masalan: 14:00 – 18:00")}</FieldHint>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Qachondan boshlay olasiz")} htmlFor={id("startDate")} error={err("startDate")}>
            <V2DateField id={id("startDate")} value={v.startDate ? dateOfIso(v.startDate) : null} onChange={(d) => set("startDate", isoOfDate(d))} state={st("startDate")} />
          </Field>
          <Field label={t("Kutayotgan oylik")} htmlFor={id("salary")} error={err("salary")}>
            <MoneyField id={id("salary")} value={v.salary.replace(/\D/g, "")} onChange={(d) => set("salary", d)} compact placeholder="4 000 000" state={st("salary")} />
          </Field>
        </div>
        {teaching &&
          chipGroup(
            "ageGroups",
            t("Qaysi yoshdagi o'quvchilar bilan ishlay olasiz?"),
            CV_AGE_GROUPS.map((g) => (
              <Chip key={g} on={ageGroups.includes(g)} onClick={() => toggleAgeGroup(g)}>
                {t(g)}
              </Chip>
            )),
            { optional: true, hint: t("bir nechtasini tanlash mumkin") },
          )}
      </div>
    );
  }

  /* ═════ 4. Rezyume ═════ */
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) addDocs(e.dataTransfer.files);
  };
  const fileRow = (name: string, size: number, onRemove: () => void, key: string) => (
    <li key={key} className="flex items-center gap-3 rounded-v2-md border border-v2-border bg-v2-surface px-3 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md bg-v2-danger-bg text-v2-danger" aria-hidden>
        <FileText className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-v2-small font-medium text-v2-text">{name}</span>
        <span className="block text-v2-caption font-normal tabular-nums text-v2-text-3">{fmtSize(size)}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("{name} faylini olib tashlash", { name })}
        title={t("Olib tashlash")}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-danger"
      >
        <Trash2 className="size-4" strokeWidth={1.75} />
      </button>
    </li>
  );
  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <FieldLabel optional htmlFor={id("cv")}>
          {t("CV fayli (rezyume)")}
        </FieldLabel>
        {cvFile ? (
          <ul>{fileRow(cvFile.name, cvFile.size, removeCv, "cv")}</ul>
        ) : (
          <label
            htmlFor={id("cv")}
            className="flex cursor-pointer items-center gap-3 rounded-v2-md border border-dashed border-v2-border-strong bg-v2-surface-2 px-3.5 py-3 transition-colors hover:bg-v2-hover focus-within:shadow-v2-focus"
          >
            <Upload className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0">
              <span className="block text-v2-small font-medium text-v2-text">{t("Fayl tanlash")}</span>
              <span className="block text-v2-caption font-normal text-v2-text-3">{t("PDF, DOC yoki rasm · 10 MB gacha")}</span>
            </span>
          </label>
        )}
        <input ref={cvInput} id={id("cv")} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="sr-only" onChange={onCvPick} />
      </div>

      <div className="min-w-0">
        <FieldLabel optional htmlFor={id("certFiles")}>
          {t("Sertifikat va diplom nusxalari")}
        </FieldLabel>
        <label
          htmlFor={id("certFiles")}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-v2-md border border-dashed px-4 py-5 text-center transition-colors focus-within:shadow-v2-focus ${
            dragOver ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border-strong bg-v2-surface-2 hover:bg-v2-hover"
          }`}
        >
          <Paperclip className="size-5 text-v2-text-2" strokeWidth={1.75} aria-hidden />
          <span className="text-v2-small font-medium text-v2-text">
            {t("Fayllarni tanlang")} <span className="hidden font-normal text-v2-text-2 sm:inline">{t("yoki shu yerga tashlang")}</span>
          </span>
          <span className="text-v2-caption font-normal text-v2-text-3">
            {docs.length ? t("{n} ta fayl tanlandi — yana qo'shishingiz mumkin", { n: docs.length }) : t("PDF yoki rasm · bitta fayl 10 MB gacha · 10 tagacha")}
          </span>
        </label>
        <input
          ref={docsInput}
          id={id("certFiles")}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) addDocs(e.target.files);
            e.target.value = "";
          }}
        />
        {docs.length > 0 && <ul className="mt-2 space-y-1.5">{docs.map((f, i) => fileRow(f.name, f.size, () => removeDoc(i), `${f.name}-${f.size}`))}</ul>}
        {certErr && <FieldError>{certErr}</FieldError>}
      </div>

      <Field label={t("Nega aynan Akademiyada ishlamoqchisiz va nimani yaxshi uddalaysiz")} htmlFor={id("about")} error={err("about")}>
        <textarea
          id={id("about")}
          value={v.about}
          onChange={(e) => set("about", e.target.value)}
          rows={4}
          placeholder={t("Qisqacha bo'lsa ham bo'ladi: nimalarda kuchlisiz, qanday natijalarga erishgansiz.")}
          className={`${fieldCls(st("about"))} h-auto! min-h-[6rem] resize-y py-2`}
        />
      </Field>

      {chipGroup(
        "source",
        t("Vakansiyani qayerdan bildingiz"),
        CV_SOURCES.map((s) => (
          <Chip key={s} on={v.source === s} onClick={() => set("source", v.source === s ? "" : s)}>
            {t(s)}
          </Chip>
        )),
        { optional: true },
      )}

      {honeypot && (
        <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor={id("website")}>Website</label>
          <input id={id("website")} type="text" tabIndex={-1} autoComplete="off" value={honeypot.value} onChange={(e) => honeypot.onChange(e.target.value)} />
        </div>
      )}

      {pub && (
        <div>
          {/* `htmlFor` yo'q — ichidagi katakcha belgilanadi (matn bosilsa ham). */}
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-v2-md border px-3.5 py-3 ${consentBad ? "border-v2-danger bg-v2-danger-bg" : "border-v2-border bg-v2-surface-2"}`}>
            <span className="mt-0.5" id={id("consent")}>
              <V2Checkbox
                checked={consent}
                onChange={(c) => {
                  setConsent(c);
                  if (c) setConsentBad(false);
                }}
                label={t("Roziman")}
              />
            </span>
            <span className="text-v2-small text-v2-text">{t("Ma'lumotlarim ishga qabul jarayonida ko'rib chiqilishiga roziman va ular to'g'riligini tasdiqlayman.")}</span>
          </label>
          {consentBad && <FieldError>{t("Rozilikni belgilang.")}</FieldError>}
        </div>
      )}
    </div>
  );
}
